import {ConfigKey} from "./config-key.model";

/*
 * ConfigKeys. Each key represent a config key or a command line argument
 * @author Severin Toldo
 * */
export class ConfigKeys {

    public static values(): ConfigKey[] {
        return [
            this.CONFIG_FILE,
            this.LOG_FILE_PATH,
            this.PAYMENT_SYSTEM_FTP_HOST,
            this.PAYMENT_SYSTEM_FTP_USER,
            this.PAYMENT_SYSTEM_FTP_PASSWORD,
            this.CONFIRMATION_FILE_FTP_LOCATION,
            this.INVOICE_FILES_FTP_LOCATION,
            this.EMAIL_SERVICE,
            this.EMAIL_USER,
            this.EMAIL_PASSWORD,
            this.CUSTOMER_SYSTEM_FTP_HOST,
            this.CUSTOMER_SYSTEM_FTP_USER,
            this.CUSTOMER_SYSTEM_FTP_PASSWORD,
            this.CUSTOMER_INVOICES_ARCHIVE_FTP_LOCATION
        ];
    }

    public static readonly CONFIG_FILE: ConfigKey = {
        key: 'configFile',
        required: false
    };

    public static readonly LOG_FILE_PATH: ConfigKey = {
        key: 'logFile',
        required: false
    };

    public static readonly PAYMENT_SYSTEM_FTP_HOST: ConfigKey = {
        key: 'paymentSystemFtpHost',
        required: true
    };

    public static readonly PAYMENT_SYSTEM_FTP_USER: ConfigKey = {
        key: 'paymentSystemFtpUser',
        required: true
    };

    public static readonly PAYMENT_SYSTEM_FTP_PASSWORD: ConfigKey = {
        key: 'paymentSystemFtpPassword',
        required: true
    };

    public static readonly CONFIRMATION_FILE_FTP_LOCATION: ConfigKey = {
        key: 'confirmationFileFtpLocation',
        required: true
    };

    public static readonly INVOICE_FILES_FTP_LOCATION: ConfigKey = {
        key: 'invoiceFilesFtpLocation',
        required: true
    };

    public static readonly EMAIL_SERVICE: ConfigKey = {
        key: 'emailService',
        required: true
    };

    public static readonly EMAIL_USER: ConfigKey = {
        key: 'emailUser',
        required: true
    };

    public static readonly EMAIL_PASSWORD: ConfigKey = {
        key: 'emailPassword',
        required: true
    };

    public static readonly CUSTOMER_SYSTEM_FTP_HOST: ConfigKey = {
        key: 'customerSystemFtpHost',
        required: true
    };

    public static readonly CUSTOMER_SYSTEM_FTP_USER: ConfigKey = {
        key: 'customerSystemFtpUser',
        required: true
    };

    public static readonly CUSTOMER_SYSTEM_FTP_PASSWORD: ConfigKey = {
        key: 'customerSystemFtpPassword',
        required: true
    };

    public static readonly CUSTOMER_INVOICES_ARCHIVE_FTP_LOCATION: ConfigKey = {
        key: 'customerInvoicesArchiveFtpLocation',
        required: true
    };



}
