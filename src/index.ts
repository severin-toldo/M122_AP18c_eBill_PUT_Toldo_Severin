// #!/usr/bin/env node

import {debounceTime, delay, map, publishReplay, refCount, switchMap, tap} from 'rxjs/operators';
import {FileService} from "./service/file.service";
import {CommonUtils} from "./common.utils";
import {ConfigKeys} from "./model/config/config-keys.model";
import {combineLatest, noop, Observable, Subject} from "rxjs";
import {Status} from "./model/status.model";
import {FtpClient} from "./model/ftp/ftp-client.model";
import {ConfirmationFileInformation} from "./model/confirmation-file-information.model";


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
// const csvToInvoiceConverter = new CsvToInvoiceConverter(CSV_TO_JSON, DATE_FORMAT, SYNCHRONIZED_PROMISE);
// const invoiceToTxtConverter = new InvoiceToTxtConverter(DATE_FORMAT);
// const invoiceToXmlConverter = new InvoiceToXmlConverter(DATE_FORMAT);

// global constants
const SCRIPT_NAME = 'eBillPut';
const DEFAULT_CONFIG_FILE_NAME = 'ebill-put-config.json';
const DEFAULT_CONFIG_FILE_PATH = fileService.getHomeDirPath() + '/' + DEFAULT_CONFIG_FILE_NAME;
const CONFIG = buildConfig();

const LOG_FILE_PATH = CommonUtils.getConfigKeyValue(ConfigKeys.LOG_FILE_PATH, CONFIG);
const PAYMENT_SYSTEM_FTP_HOST = CommonUtils.getConfigKeyValue(ConfigKeys.PAYMENT_SYSTEM_FTP_HOST, CONFIG);
const PAYMENT_SYSTEM_FTP_USER = CommonUtils.getConfigKeyValue(ConfigKeys.PAYMENT_SYSTEM_FTP_USER, CONFIG);
const PAYMENT_SYSTEM_FTP_PASSWORD = CommonUtils.getConfigKeyValue(ConfigKeys.PAYMENT_SYSTEM_FTP_PASSWORD, CONFIG);
const EMAIL_SERVICE = CommonUtils.getConfigKeyValue(ConfigKeys.EMAIL_SERVICE, CONFIG);
const EMAIL_USER = CommonUtils.getConfigKeyValue(ConfigKeys.EMAIL_USER, CONFIG);
const EMAIL_PASSWORD = CommonUtils.getConfigKeyValue(ConfigKeys.EMAIL_PASSWORD, CONFIG);
const CONFIRMATION_FILE_FTP_LOCATION = normalizeFtpLocation(CommonUtils.getConfigKeyValue(ConfigKeys.CONFIRMATION_FILE_FTP_LOCATION, CONFIG));
const INVOICE_FILES_FTP_LOCATION = normalizeFtpLocation(CommonUtils.getConfigKeyValue(ConfigKeys.INVOICE_FILES_FTP_LOCATION, CONFIG));

const logger = buildLogger();


// business logic
logger.info('Starting ' + SCRIPT_NAME);









// set up and connect ftp client
const paymentSystemFtpClient = new FtpClient(FTP, fileService, logger);
const paymentSystemFtpClientConnected$ = paymentSystemFtpClient.connect(PAYMENT_SYSTEM_FTP_HOST, PAYMENT_SYSTEM_FTP_USER, PAYMENT_SYSTEM_FTP_PASSWORD);


// fetch confirmation file and parse information
const confirmationFileInformation$: Observable<ConfirmationFileInformation> = paymentSystemFtpClientConnected$
    .pipe(switchMap(() => paymentSystemFtpClient.list(CONFIRMATION_FILE_FTP_LOCATION)))
    .pipe(map(response => response.payload.filter(e => e.name.includes('quittungsfile') && e.name.endsWith('.txt'))))
    .pipe(switchMap(confirmationFileResponse => paymentSystemFtpClient.download(getConfirmationFileFtpGetPath(confirmationFileResponse[0].name))))
    .pipe(map((confirmationFileDownloadStatus: Status) => {
        return parseConfirmationFile(confirmationFileDownloadStatus);
    }))
    .pipe(tap(() => logger.info('Successfully parsed confirmation file.')))
    .pipe(publishReplay(1))
    .pipe(refCount());


const invoiceFilesInformation$: Observable<any> = combineLatest(
    confirmationFileInformation$,
    paymentSystemFtpClientConnected$
)
    .pipe(switchMap(([cfi, _]) => {
        const invoiceFileDownloadObservables: Observable<any>[] = cfi.processedInvoiceFileNames.map(fileName => {
            const client = new FtpClient(FTP, fileService, logger);

            // work around since downloading to many files in one connection doesn't work
            return client
                .connect(PAYMENT_SYSTEM_FTP_HOST, PAYMENT_SYSTEM_FTP_USER, PAYMENT_SYSTEM_FTP_PASSWORD, false)
                .pipe(switchMap(() => client.download(INVOICE_FILES_FTP_LOCATION + cfi.timestamp + '/' + fileName)))
                .pipe(map(res => {
                    return {
                        ftpClient: client,
                        response: res
                    };
                }));
        });

        return combineLatest(...invoiceFileDownloadObservables)
    }))
    .pipe(map((downloadResponses: any[]) => {
        return downloadResponses.map(res => {
            // work around since downloading to many files in one connection doesn't work
            res.ftpClient.disconnect(false).subscribe(noop);

            const fileName = res.response.payload.fileName;
            const fileData = res.response.payload.fileData;
            const localFilePath = fileService.getTmpDirPath() + '/' + fileName;

            fileService.writeToFile(localFilePath, fileData);

            return {
                filePath: localFilePath
            }
        });
    }));

const zipFile$ = combineLatest(
    confirmationFileInformation$,
    invoiceFilesInformation$
)
    .pipe()










// invoiceFilesDownloaded$.subscribe(res => console.log(res));

// fileService.writeToFile(getTmpFilePath(fileName), fileData);






// fileService.writeToFile(getLocalConfirmationFilePath(fileName), fileData);
// return fileService.getTmpDirPath() + '/' + fileName;


// delete successfully fetched invoices on ftp server
// fileDownloadedLocally$
// confirmationFileInformation$
//     .pipe(switchMap(cfi => paymentSystemFtpClient.delete(getConfirmationFileFtpGetPath(cfi.originalFileName))))
//     .subscribe(() => {
//         logger.info('Successfully deleted confirmation file on remote.');
//     }, error => {
//         logger.error(`Error deleting confirmation file on remote: ${error.message}`);
//         throw error;
//     });




// TODO delete local files -> invoice files, quitungs file, zip file








confirmationFileInformation$.subscribe(cfi => console.log(cfi));









// TODO close ftp client
// .subscribe(() => {
//     logger.info('Successfully deleted confirmation file on remote.');
//     confirmationFileDeleted$$.next();
// }, error => {
//     logger.error(`Error deleting confirmation file on remote: ${error.message}`);
//     confirmationFileDeleted$$.next();
//     throw error;
// });
//
// someEvent$
//     .pipe(switchMap(() => paymentSystemFtpClient.disconnect()))
//     .subscribe(noop);


// // disconnect ftp clients

//
// invoiceFilesUploadedToPaymentSystem$
//     .pipe(switchMap(() => paymentSystemFtpClient.disconnect()))
//     .subscribe(noop);





//
//
// // create and upload txt and xml files
// const invoiceFilesUploadedToPaymentSystem$ = new Subject<void>();
//
// combineLatest(
//     invoices$,
//     paymentSystemFtpClientConnected$
// )
//     .pipe(map(([invoices, _]) => {
//         return invoices.map(invoice => {
//             const txtStr = invoiceToTxtConverter.convert(invoice);
//             const xmlStr = invoiceToXmlConverter.convert(invoice);
//
//             const txtFileName = getInvoiceTxtFileName(invoice);
//             const xmlFileName = getInvoiceXmlFileName(invoice);
//
//             const txtFilePath = getInvoiceTxtFilePath(invoice);
//             const xmlFilePath = getInvoiceXmlFilePath(invoice);
//
//             fileService.writeToFile(txtFilePath, txtStr);
//             fileService.writeToFile(xmlFilePath, xmlStr);
//
//             return {
//                 txt: {
//                     fileName: txtFileName,
//                     filePath: txtFilePath,
//                 },
//                 xml: {
//                     fileName: xmlFileName,
//                     filePath: xmlFilePath,
//                 }
//             };
//         });
//     }))
//     .pipe(tap(() => logger.info('Successfully create TXT and XML files for invoices.')))
//     .pipe(switchMap((filesToUploadInformation: any[]) => {
//         const uploadFilesObservables: Observable<Status>[] = [];
//
//         filesToUploadInformation.forEach((info: any) => {
//             uploadFilesObservables.push(paymentSystemFtpClient.upload(info.txt.filePath, INVOICE_PUT_FTP_LOCATION + info.txt.fileName));
//             uploadFilesObservables.push(paymentSystemFtpClient.upload(info.xml.filePath, INVOICE_PUT_FTP_LOCATION + info.xml.fileName));
//         });
//
//         return combineLatest(...uploadFilesObservables);
//     }))
//     .pipe(tap((res: Status[]) => {
//         res
//             .map(e => e.payload)
//             .forEach(tmpFilePathToDelete => {
//                 fileService.deleteFile(tmpFilePathToDelete);
//             });
//     }))
//     .subscribe(() => {
//         logger.info('Successfully uploaded TXT and XML files for invoices to remote.');
//         invoiceFilesUploadedToPaymentSystem$.next();
//     }, error => {
//         logger.error(`Error uploading TXT and XML files for invoices to remote: ${error.message}`);
//         invoiceFilesUploadedToPaymentSystem$.next();
//         throw error;
//     });
//
//
//
//
//
// // helper functions
// function getInvoiceTxtFilePath(invoice: Invoice): string {
//     return getInvoiceOutputFilePath(invoice, 'txt');
// }
//
// function getInvoiceXmlFilePath(invoice: Invoice): string {
//     return getInvoiceOutputFilePath(invoice, 'xml');
// }
//
// function getInvoiceOutputFilePath(invoice: Invoice, fileExtension: string): string {
//     return  fileService.getTmpDirPath() + '/' + getInvoiceOutputFileName(invoice, fileExtension);
// }
//
// function getInvoiceTxtFileName(invoice: Invoice): string {
//     return getInvoiceOutputFileName(invoice, 'txt');
// }
//
// function getInvoiceXmlFileName(invoice: Invoice): string {
//     return getInvoiceOutputFileName(invoice, 'xml');
// }
//
// function getInvoiceOutputFileName(invoice: Invoice, fileExtension: string): string {
//     return  `${invoice.recipient.recipientNumber}_${invoice.invoiceNumber}.${fileExtension}`;
// }
//
//



function parseConfirmationFile(confirmationFileDownloadStatus: Status) {
    const fileName = confirmationFileDownloadStatus.payload.fileName;
    const fileData = confirmationFileDownloadStatus.payload.fileData;

    const lines = fileData.split('\n');

    const timestamp = lines[0]
        .split(' ')[0]
        .replace('-', '_');

    const processedInvoiceFileNames = lines
        .map(line => line.split(' ')[2])
        .filter(val => !!val);

    fileService.writeToFile(getTmpFilePath(fileName), fileData);

    const cfi = new ConfirmationFileInformation();
    cfi.fileName = fileName;
    cfi.timestamp = timestamp;
    cfi.processedInvoiceFileNames = processedInvoiceFileNames;

    return cfi;
}

function getTmpFilePath(fileName: string) {
    return fileService.getTmpDirPath() + '/' + fileName;
}

function getConfirmationFileFtpGetPath(fileName: string): string {
    return CONFIRMATION_FILE_FTP_LOCATION + fileName;
}

function normalizeFtpLocation(ftpLocation: string): string {
    if (!ftpLocation.endsWith('/')) {
        return ftpLocation + '/';
    }

    return ftpLocation;
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
