// #!/usr/bin/env node

import {map, publishReplay, refCount, switchMap, tap} from 'rxjs/operators';
import {FileService} from "./service/file.service";
import {CommonUtils} from "./common.utils";
import {ConfigKeys} from "./model/config/config-keys.model";
import {CsvToInvoiceConverter} from "./converter/csv-to-invoice.converter";
import {combineLatest, noop, Observable, Subject} from "rxjs";
import {Status} from "./model/status.model";
import {Invoice} from "./model/invoice/invoice.model";
import {InvoiceToTxtConverter} from "./converter/invoice-to-txt.converter";
import {InvoiceToXmlConverter} from "./converter/invoice-to-xml.converter";
import {FtpClient} from "./model/ftp/ftp-client.model";


/*
 * Main Script file
 * @author Severin Toldo
 * */


// typescript runtime declares
declare function require(name: string);
declare const process: { argv: any };

// requires
const OS = require('os');
const FS = require('fs');
const ARGS = require('minimist')(process.argv.slice(2)); // library to parse command line arguments
const FTP = require( 'ftp' );
const ARCHIVER = require('archiver');
const MD5 = require('md5');
const NODEMAILER = require('nodemailer');
const ZIPPER = require('zip-local');
const WINSTON = require('winston');
const {format} = require('logform');
const CSV_TO_JSON = require('csvtojson');
const DATE_FORMAT = require("dateformat");
const SYNCHRONIZED_PROMISE = require('synchronized-promise');

// services
const fileService = new FileService(FS, OS, ARCHIVER, MD5, ZIPPER);

// converters
const csvToInvoiceConverter = new CsvToInvoiceConverter(CSV_TO_JSON, DATE_FORMAT, SYNCHRONIZED_PROMISE);
const invoiceToTxtConverter = new InvoiceToTxtConverter(DATE_FORMAT);
const invoiceToXmlConverter = new InvoiceToXmlConverter(DATE_FORMAT);

// global constants
const SCRIPT_NAME = 'eBillGet';
const DEFAULT_CONFIG_FILE_NAME = 'ebill-get-config.json';
const DEFAULT_CONFIG_FILE_PATH = fileService.getHomeDirPath() + '/' + DEFAULT_CONFIG_FILE_NAME;
const CONFIG = buildConfig();

const LOG_FILE_PATH = CommonUtils.getConfigKeyValue(ConfigKeys.LOG_FILE_PATH, CONFIG);
const CUSTOMER_SYSTEM_FTP_HOST = CommonUtils.getConfigKeyValue(ConfigKeys.CUSTOMER_SYSTEM_FTP_HOST, CONFIG);
const CUSTOMER_SYSTEM_FTP_USER = CommonUtils.getConfigKeyValue(ConfigKeys.CUSTOMER_SYSTEM_FTP_USER, CONFIG);
const CUSTOMER_SYSTEM_FTP_PASSWORD = CommonUtils.getConfigKeyValue(ConfigKeys.CUSTOMER_SYSTEM_FTP_PASSWORD, CONFIG);
const PAYMENT_SYSTEM_FTP_HOST = CommonUtils.getConfigKeyValue(ConfigKeys.PAYMENT_SYSTEM_FTP_HOST, CONFIG);
const PAYMENT_SYSTEM_FTP_USER = CommonUtils.getConfigKeyValue(ConfigKeys.PAYMENT_SYSTEM_FTP_USER, CONFIG);
const PAYMENT_SYSTEM_FTP_PASSWORD = CommonUtils.getConfigKeyValue(ConfigKeys.PAYMENT_SYSTEM_FTP_PASSWORD, CONFIG);
const INVOICE_GET_FTP_LOCATION = normalizeFtpLocation(CommonUtils.getConfigKeyValue(ConfigKeys.INVOICE_GET_FTP_LOCATION, CONFIG));
const INVOICE_PUT_FTP_LOCATION = normalizeFtpLocation(CommonUtils.getConfigKeyValue(ConfigKeys.INVOICE_PUT_FTP_LOCATION, CONFIG));

const logger = buildLogger();


// business logic
logger.info('Starting ' + SCRIPT_NAME);









// set up and connect ftp clients
const customerSystemFtpClient = new FtpClient(FTP, fileService, logger);
const paymentSystemFtpClient = new FtpClient(FTP, fileService, logger);

const customerSystemFtpClientConnected$ = customerSystemFtpClient.connect(CUSTOMER_SYSTEM_FTP_HOST, CUSTOMER_SYSTEM_FTP_USER, CUSTOMER_SYSTEM_FTP_PASSWORD);
const paymentSystemFtpClientConnected$ = paymentSystemFtpClient.connect(PAYMENT_SYSTEM_FTP_HOST, PAYMENT_SYSTEM_FTP_USER, PAYMENT_SYSTEM_FTP_PASSWORD);


// fetch invoices
const invoices$: Observable<Invoice[]> = customerSystemFtpClientConnected$
    .pipe(switchMap(() => customerSystemFtpClient.list(INVOICE_GET_FTP_LOCATION)))
    .pipe(map(response => response.payload.filter(e => e.name.includes('rechnung') && e.name.endsWith('.data'))))
    .pipe(switchMap(newInvoiceFilesResponses => {
        const invoiceDownloadObservables: Observable<Status>[] = newInvoiceFilesResponses.map(fr => {
            return customerSystemFtpClient.download(getInvoiceFtpGetPath(fr.name));
        });

        return combineLatest(...invoiceDownloadObservables);
    }))
    .pipe(tap(() => logger.info('Successfully downloaded invoice files.')))
    .pipe(map((invoicesDownloadResponses: Status[]) => {
        return invoicesDownloadResponses.map(res => {
            const fileName = res.payload.fileName;
            const csv = res.payload.fileData;

            try {
                const invoice = csvToInvoiceConverter.convert(csv);
                return {status: 'success', payload: {fileName: fileName, invoice: invoice}};
            } catch (e) {
                return {status: 'error', payload: {fileName: fileName, errorMessage: e.message}};
            }
        });
    }))
    .pipe(tap((res: Status[]) => {
        res.forEach(e => {
            if (e.status === 'success') {
                logger.info(`Successfully converted invoice ${e.payload.fileName}`);
            } else {
                logger.warn(`Error converting invoice ${e.payload.fileName}: ${e.payload.errorMessage}`);
            }
        });
    }))
    .pipe(map((res: Status[]) => {
        return res
            .filter(e => e.status === 'success')
            .map(e => {
                const invoice = e.payload.invoice;
                invoice.originalFileName = e.payload.fileName;

                return invoice;
            });
    }))
    .pipe(publishReplay(1))
    .pipe(refCount());


// delete successfully fetched invoices on ftp server
const invoiceFileOnCustomerSystemDeleted$ = new Subject<void>();

combineLatest(
    invoices$,
    customerSystemFtpClientConnected$
)
    .pipe(switchMap(([invoices, _]) => {
        const deleteInvoiceObservables: Observable<Status>[] = invoices.map(invoice => {
            return customerSystemFtpClient.delete(getInvoiceFtpGetPath(invoice.originalFileName));
        });

        return combineLatest(...deleteInvoiceObservables);
    }))
    .subscribe(() => {
        logger.info('Successfully delete invoice files on remote.');
        invoiceFileOnCustomerSystemDeleted$.next();
    }, error => {
        logger.error(`Error deleting invoice files on remote: ${error.message}`);
        invoiceFileOnCustomerSystemDeleted$.next();
        throw error;
    });


// create and upload txt and xml files
const invoiceFilesUploadedToPaymentSystem$ = new Subject<void>();

combineLatest(
    invoices$,
    paymentSystemFtpClientConnected$
)
    .pipe(map(([invoices, _]) => {
        return invoices.map(invoice => {
            const txtStr = invoiceToTxtConverter.convert(invoice);
            const xmlStr = invoiceToXmlConverter.convert(invoice);

            const txtFileName = getInvoiceTxtFileName(invoice);
            const xmlFileName = getInvoiceXmlFileName(invoice);

            const txtFilePath = getInvoiceTxtFilePath(invoice);
            const xmlFilePath = getInvoiceXmlFilePath(invoice);

            fileService.writeToFile(txtFilePath, txtStr);
            fileService.writeToFile(xmlFilePath, xmlStr);

            return {
                txt: {
                    fileName: txtFileName,
                    filePath: txtFilePath,
                },
                xml: {
                    fileName: xmlFileName,
                    filePath: xmlFilePath,
                }
            };
        });
    }))
    .pipe(tap(() => logger.info('Successfully create TXT and XML files for invoices.')))
    .pipe(switchMap((filesToUploadInformation: any[]) => {
        const uploadFilesObservables: Observable<Status>[] = [];

        filesToUploadInformation.forEach((info: any) => {
            uploadFilesObservables.push(paymentSystemFtpClient.upload(info.txt.filePath, INVOICE_PUT_FTP_LOCATION + info.txt.fileName));
            uploadFilesObservables.push(paymentSystemFtpClient.upload(info.xml.filePath, INVOICE_PUT_FTP_LOCATION + info.xml.fileName));
        });

        return combineLatest(...uploadFilesObservables);
    }))
    .pipe(tap((res: Status[]) => {
        res
            .map(e => e.payload)
            .forEach(tmpFilePathToDelete => {
                fileService.deleteFile(tmpFilePathToDelete);
            });
    }))
    .subscribe(() => {
        logger.info('Successfully uploaded TXT and XML files for invoices to remote.');
        invoiceFilesUploadedToPaymentSystem$.next();
    }, error => {
        logger.error(`Error uploading TXT and XML files for invoices to remote: ${error.message}`);
        invoiceFilesUploadedToPaymentSystem$.next();
        throw error;
    });


// disconnect ftp clients
invoiceFileOnCustomerSystemDeleted$
    .pipe(switchMap(() => customerSystemFtpClient.disconnect()))
    .subscribe(noop);

invoiceFilesUploadedToPaymentSystem$
    .pipe(switchMap(() => paymentSystemFtpClient.disconnect()))
    .subscribe(noop);



// helper functions
function getInvoiceTxtFilePath(invoice: Invoice): string {
    return getInvoiceOutputFilePath(invoice, 'txt');
}

function getInvoiceXmlFilePath(invoice: Invoice): string {
    return getInvoiceOutputFilePath(invoice, 'xml');
}

function getInvoiceOutputFilePath(invoice: Invoice, fileExtension: string): string {
    return  fileService.getTmpDirPath() + '/' + getInvoiceOutputFileName(invoice, fileExtension);
}

function getInvoiceTxtFileName(invoice: Invoice): string {
    return getInvoiceOutputFileName(invoice, 'txt');
}

function getInvoiceXmlFileName(invoice: Invoice): string {
    return getInvoiceOutputFileName(invoice, 'xml');
}

function getInvoiceOutputFileName(invoice: Invoice, fileExtension: string): string {
    return  `${invoice.recipient.recipientNumber}_${invoice.invoiceNumber}.${fileExtension}`;
}

function normalizeFtpLocation(ftpLocation: string): string {
    if (!ftpLocation.endsWith('/')) {
        return ftpLocation + '/';
    }

    return ftpLocation;
}

function getInvoiceFtpGetPath(fileName: string): string {
    return INVOICE_GET_FTP_LOCATION + fileName;
}

function buildConfig(): any {
    const defaultConfigFile = resolveConfigFile(DEFAULT_CONFIG_FILE_PATH);
    const argumentConfigFile = resolveConfigFile(CommonUtils.getConfigKeyValue(ConfigKeys.CONFIG_FILE, ARGS));

    const config = {};

    // command line argument overwrite config values, custom config overwrites default config
    ConfigKeys.values().forEach(configKey => {
        if (CommonUtils.isConfigKeyPresent(configKey, ARGS)) {
            config[configKey.key] = CommonUtils.getConfigKeyValue(configKey, ARGS);
        } else if (CommonUtils.isConfigKeyPresent(configKey, argumentConfigFile)) {
            config[configKey.key] = CommonUtils.getConfigKeyValue(configKey, argumentConfigFile);
        } else if (CommonUtils.isConfigKeyPresent(configKey, defaultConfigFile)) {
            config[configKey.key] = CommonUtils.getConfigKeyValue(configKey, defaultConfigFile);
        }
    });

    validateConfig(config);

    return config;
}

function resolveConfigFile(path: string): any {
    if (fileService.doesFileExist(path)) {
        const fileContent = fileService.getFileContent(path);

        if (CommonUtils.isValidJson(fileContent)) {
            return JSON.parse(fileContent);
        }
    }

    return null;
}

// all required config keys must be set
function validateConfig(config: any): void {
    ConfigKeys.values().forEach(configKey => {
        if (configKey.required && !CommonUtils.isConfigKeyPresent(configKey, config)) {
            throw new Error('Required config key missing! ' + configKey.key);
        }
    });
}

function buildLogger(): any {
    const formatFunction = (data: any) => {
        return `${data.timestamp} - ${data.level.toUpperCase()} ${SCRIPT_NAME}: ${data.message.trim()}`;
    };

    const logfileFormat = format.combine(
        format.timestamp(),
        format.align(),
        format.printf(info => formatFunction(info))
    );

    const consoleFormat = format.combine(
        format.timestamp(),
        format.align(),
        format.printf(data => WINSTON.format.colorize().colorize(data.level, formatFunction(data)))
    );

    const transports = [new WINSTON.transports.Console({format: consoleFormat})];

    if (LOG_FILE_PATH) {
        transports.push(new WINSTON.transports.File({filename: LOG_FILE_PATH, format: logfileFormat}));
    }

    return WINSTON.createLogger({
        transports: transports,
    });
}
