// #!/usr/bin/env node

import {debounceTime, delay, map, min, publishReplay, refCount, switchMap, tap} from 'rxjs/operators';
import {FileService} from "./service/file.service";
import {CommonUtils} from "./common.utils";
import {ConfigKeys} from "./model/config/config-keys.model";
import {combineLatest, noop, Observable, Subject} from "rxjs";
import {Status} from "./model/status.model";
import {FtpClient} from "./model/ftp/ftp-client.model";
import {ConfirmationFileInformation} from "./model/confirmation-file-information.model";
import {EmailService} from "./service/email.service";
import {XmlToSimpleInvoiceConverter} from "./converter/xml-to-simple-invoice.converter";
import {SimpleInvoice} from "./model/invoice/simple-invoice.model";


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
var XML_2_JSON = require('xml2json');

// services
const fileService = new FileService(FS, OS, ARCHIVER, MD5, ZIPPER);
const emailService = new EmailService(NODEMAILER);

// converters
const xmlToSimpleInvoiceConverter = new XmlToSimpleInvoiceConverter(XML_2_JSON);

// global constants
const SCRIPT_NAME = 'eBillPut';
const EBILL_PUT_TMP_DIR_NAME = 'ebillPutTmpDir';
const DEFAULT_CONFIG_FILE_NAME = 'ebill-put-config.json';
const DEFAULT_CONFIG_FILE_PATH = fileService.getHomeDirPath() + '/' + DEFAULT_CONFIG_FILE_NAME;
const CONFIG = buildConfig();

const LOG_FILE_PATH = CommonUtils.getConfigKeyValue(ConfigKeys.LOG_FILE_PATH, CONFIG);
const PAYMENT_SYSTEM_FTP_HOST = CommonUtils.getConfigKeyValue(ConfigKeys.PAYMENT_SYSTEM_FTP_HOST, CONFIG);
const PAYMENT_SYSTEM_FTP_USER = CommonUtils.getConfigKeyValue(ConfigKeys.PAYMENT_SYSTEM_FTP_USER, CONFIG);
const PAYMENT_SYSTEM_FTP_PASSWORD = CommonUtils.getConfigKeyValue(ConfigKeys.PAYMENT_SYSTEM_FTP_PASSWORD, CONFIG);
const CUSTOMER_SYSTEM_FTP_HOST = CommonUtils.getConfigKeyValue(ConfigKeys.CUSTOMER_SYSTEM_FTP_HOST, CONFIG);
const CUSTOMER_SYSTEM_FTP_USER = CommonUtils.getConfigKeyValue(ConfigKeys.CUSTOMER_SYSTEM_FTP_USER, CONFIG);
const CUSTOMER_SYSTEM_FTP_PASSWORD = CommonUtils.getConfigKeyValue(ConfigKeys.CUSTOMER_SYSTEM_FTP_PASSWORD, CONFIG);
const EMAIL_SERVICE = CommonUtils.getConfigKeyValue(ConfigKeys.EMAIL_SERVICE, CONFIG);
const EMAIL_USER = CommonUtils.getConfigKeyValue(ConfigKeys.EMAIL_USER, CONFIG);
const EMAIL_PASSWORD = CommonUtils.getConfigKeyValue(ConfigKeys.EMAIL_PASSWORD, CONFIG);
const CONFIRMATION_FILE_FTP_LOCATION = normalizeFtpLocation(CommonUtils.getConfigKeyValue(ConfigKeys.CONFIRMATION_FILE_FTP_LOCATION, CONFIG));
const INVOICE_FILES_FTP_LOCATION = normalizeFtpLocation(CommonUtils.getConfigKeyValue(ConfigKeys.INVOICE_FILES_FTP_LOCATION, CONFIG));
const CUSTOMER_INVOICES_ARCHIVE_FTP_LOCATION = normalizeFtpLocation(CommonUtils.getConfigKeyValue(ConfigKeys.CUSTOMER_INVOICES_ARCHIVE_FTP_LOCATION, CONFIG));


const logger = buildLogger();


// TODO logging
// TOOD subscribe for each
// TODO:  logger.info('Sending E-Mail...');











// business logic
logger.info('Starting ' + SCRIPT_NAME);


// create tmp folder for E-Bill script
fileService.createDirectoryIfNotExists(getTmpDirPath());


// set up and connect ftp clients
const paymentSystemFtpClient = new FtpClient(FTP, fileService, logger);
const customerSystemFtpClient = new FtpClient(FTP, fileService, logger);

const paymentSystemFtpClientConnected$ = paymentSystemFtpClient.connect(PAYMENT_SYSTEM_FTP_HOST, PAYMENT_SYSTEM_FTP_USER, PAYMENT_SYSTEM_FTP_PASSWORD);
const customerSystemFtpClientConnected$ = customerSystemFtpClient.connect(CUSTOMER_SYSTEM_FTP_HOST, CUSTOMER_SYSTEM_FTP_USER, CUSTOMER_SYSTEM_FTP_PASSWORD);


// fetch confirmation file and parse information
const confirmationFileInformation$: Observable<ConfirmationFileInformation> = paymentSystemFtpClientConnected$
    .pipe(switchMap(() => paymentSystemFtpClient.list(CONFIRMATION_FILE_FTP_LOCATION)))
    .pipe(map(response => response.payload.filter(e => e.name.includes('quittungsfile') && e.name.endsWith('.txt'))))
    .pipe(switchMap(confirmationFileResponse => paymentSystemFtpClient.download(getConfirmationFileFtpGetPath(confirmationFileResponse[0].name))))
    .pipe(map((confirmationFileDownloadStatus: Status) => {
        return parseConfirmationFile(confirmationFileDownloadStatus);
    }))
    .pipe(publishReplay(1))
    .pipe(refCount())




// TODO delete conformation file on remote
// confirmationFileInformation$






// download invoice files to tmp directory
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
            const localFilePath = getTmpFilePath(fileName);

            fileService.writeToFile(localFilePath, fileData);

            return {
                filePath: localFilePath
            }
        });
    }))
    .pipe(publishReplay(1))
    .pipe(refCount());


// create zip file
const zipFile$ = combineLatest(
    confirmationFileInformation$,
    invoiceFilesInformation$
)
    .pipe(map(() => fileService.zipFile(getTmpDirPath(), getZipFilePath())))
    .pipe(publishReplay(1))
    .pipe(refCount());


// upload zip file to customer archive
const zipFileUploadedToCustomerArchive$ = combineLatest(
    zipFile$,
    customerSystemFtpClientConnected$
)
    .pipe(switchMap(([zipFile, _]) => customerSystemFtpClient.upload(zipFile, CUSTOMER_INVOICES_ARCHIVE_FTP_LOCATION + buildZipFileName())));


// send email
const emailSent$ = combineLatest(
    zipFile$,
    confirmationFileInformation$,
    invoiceFilesInformation$
)
    .pipe(switchMap(([zipFile, cfi, ifi]) => {
        const sendMailObserbales: Observable<Status>[] = ifi
            .filter(i => i.filePath.endsWith('.xml'))
            .map((i => {
                const fileContent = fileService.getFileContent(i.filePath);
                return xmlToSimpleInvoiceConverter.convert(fileContent);
            }))
            .map(invoice => {
                let text = [];

                text.push(`Sehr geehrter ${invoice.recipientName}`);
                text.push(``);
                text.push(`Am ${formatTimestamp(cfi.timestamp)} wurde die erfolgreiche Bearbeitung der Rechnung ${invoice.invoiceNumber} vom Zahlungsystem "${PAYMENT_SYSTEM_FTP_HOST}" gemeldet.`);
                text.push(``);
                text.push(`Mit freundlichen Grüssen`);
                text.push(`${invoice.customerName}`);

                text = text.map(e => e + '\n');


                const mailOptions: any = {
                    from: 'severin.toldo@edu.tbz.ch',
                    to: invoice.recipientEmail,
                    subject: `Erfolgte Verarbeitung Rechnung ${invoice.invoiceNumber}`,
                    text: text.join(''),
                    attachments: [
                        {
                            filename: buildZipFileName(),
                            path: zipFile
                        }
                    ]
                };

                return emailService
                    .createTransporter(EMAIL_SERVICE, EMAIL_USER, EMAIL_PASSWORD)
                    .sendEmail(mailOptions);
            });

        return combineLatest(...sendMailObserbales);
    }))
    .pipe(publishReplay(1))
    .pipe(refCount());





// TODO delete getTmpDirPath() and getZipFilePath();
// emailSent$ && zipFileUploadedToCustomerArchive$






confirmationFileInformation$.subscribe(() => {
    logger.info('Successfully parsed confirmation file.');
}, error => {
    logger.error(`Error parsing confirmation file.: ${error.message}`);
});

invoiceFilesInformation$.subscribe(() => {
    logger.info('Successfully downloaded invoices files.');
}, error => {
    logger.error(`Error downloading invoice files: ${error.message}`);
});

zipFile$.subscribe(() => {
    logger.info('Successfully created tip file.');
}, error => {
    logger.error(`Error creating zip file: ${error.message}`);
});

zipFileUploadedToCustomerArchive$.subscribe(() => {
    logger.info('Successfully uploaded zip file to customer archive.');
}, error => {
    logger.error(`Error uploading zip file to customer archive: ${error.message}`);
});

emailSent$.subscribe(() => {
    logger.info(' Successfully sent invoice email.');
}, error => {
    logger.error(`Error sending invoice email: ${error.message}`);
});




























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








// confirmationFileInformation$.subscribe(cfi => console.log(cfi));









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





function formatTimestamp(timestamp: string): string {
    const tsParts = timestamp.split('');

    const year = tsParts[0] + tsParts[1] + tsParts[2] + tsParts[3];
    const month = tsParts[4] + tsParts[5];
    const day = tsParts[6] + tsParts[7];
    const hours = tsParts[9] + tsParts[10];
    const minutes = tsParts[11] + tsParts[12];
    const seconds = tsParts[13] + tsParts[14];

    return `${day}.${month}.${year} um ${hours}:${minutes}:${seconds}`;
}

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

function getZipFilePath() {
    return fileService.getTmpDirPath() + '/' + buildZipFileName();
}

function buildZipFileName(): string {
    const currentTimeStamp = Math.floor(Date.now() / 1000);
    return 'invoices_' + currentTimeStamp + '.zip';
}


function getTmpFilePath(fileName: string) {
    return getTmpDirPath() + fileName;
}

function getTmpDirPath() {
    return fileService.getTmpDirPath() + '/' + EBILL_PUT_TMP_DIR_NAME + '/';
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
