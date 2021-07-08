import {Invoice} from "../model/invoice/invoice.model";
import {Recipient} from "../model/recipient.model";
import {Customer} from "../model/customer.model";
import {InvoicePartEntry} from "../model/invoice/invoice-part.model";
import {Address} from "../model/address.model";
import {CommonUtils} from "../common.utils";
import {Converter} from "./converter.interface";


export class CsvToInvoiceConverter implements Converter<string, Invoice> {

    private static readonly CSV_TO_JSON_CONFIG = {
        noheader: true, // Indicating csv data has no header row and first row is data row. Default is false
        output: 'json', // The format to be converted to. "json" (default) -- convert csv to json. "csv" -- convert csv to csv row array. "line" -- convert csv to csv line string
        delimiter: ';', // delimiter used for separating columns. Use "auto" if delimiter is unknown in advance, in this case, delimiter will be auto-detected (by best attempt). Use an array to give a list of potential delimiters e.g. [",","|","$"]. default: ","
        trim: true, // Indicate if parser trim off spaces surrounding column content. e.g. " content " will be trimmed to "content". Default: true
        nullObject: true // How to parse if a csv cell contains "null". Default false will keep "null" as string. Change to true if a null object is needed.
    };

    private static readonly BASE_INFORMATION_INVOICE_JSON_INDEX = 0;
    private static readonly RECIPIENT_INVOICE_JSON_INDEX = 1;
    private static readonly CUSTOMER_INVOICE_JSON_INDEX = 2;
    private static readonly INVOICE_PART_ENTRIES_OFFSET = 3; // take all elements with index >= 3

    private csvToJson: any;
    private dateFormat: any;
    private synchronizedPromise: any;


    constructor(csvToJson: any, dateFormat: any, synchronizedPromise: any) {
        this.csvToJson = csvToJson;
        this.dateFormat = dateFormat;
        this.synchronizedPromise = synchronizedPromise;
    }

    public convert(csv: string): Invoice {
        const asyncFunction = (value) => this.csvToJson(CsvToInvoiceConverter.CSV_TO_JSON_CONFIG).fromString(value);
        const syncFunction = this.synchronizedPromise(asyncFunction);
        const invoiceJson: any[] = syncFunction(csv);

        this.validateInvoiceJson(invoiceJson);

        const invoice = new Invoice();

        invoice.invoiceNumber = this.getInvoiceNumberFromJson(invoiceJson);
        invoice.orderNumber = this.getOrderNumberFromJson(invoiceJson);
        invoice.creationPlace = this.getCreationPlaceFromJson(invoiceJson);
        invoice.creationDate = this.getCreationDateFromJson(invoiceJson);
        invoice.recipient = this.getRecipientFromJson(invoiceJson);
        invoice.customer = this.getCustomerFromJson(invoiceJson);
        invoice.partEntries = this.getPartEntriesFromJson(invoiceJson);

        this.setPaymentTarget(invoiceJson, invoice);
        this.setTotal(invoice);
        this.setReferenceNumber(invoice);

        return invoice;
    }

    private getInvoiceNumberFromJson(invoiceJson: any[]): string {
        const baseInformation: any = invoiceJson[CsvToInvoiceConverter.BASE_INFORMATION_INVOICE_JSON_INDEX];
        const rawInvoiceNumber: string = baseInformation && baseInformation.field1;

        return this.parseUnderlineSeparatedValue(rawInvoiceNumber);
    }

    private getOrderNumberFromJson(invoiceJson: any[]): string {
        const baseInformation: any = invoiceJson[CsvToInvoiceConverter.BASE_INFORMATION_INVOICE_JSON_INDEX];
        const rawOrderNumber: string = baseInformation && baseInformation.field2;

        return this.parseUnderlineSeparatedValue(rawOrderNumber);
    }

    private getCreationPlaceFromJson(invoiceJson: any[]): string {
        const baseInformation: any = invoiceJson[CsvToInvoiceConverter.BASE_INFORMATION_INVOICE_JSON_INDEX];
        return baseInformation && baseInformation.field3;
    }

    private getCreationDateFromJson(invoiceJson: any[]): Date {
        const baseInformation: any = invoiceJson[CsvToInvoiceConverter.BASE_INFORMATION_INVOICE_JSON_INDEX];

        const rawCreationDateStr: string = baseInformation && baseInformation.field4;
        const rawCreationTimeStr: string = baseInformation && baseInformation.field5;

        if (!rawCreationDateStr || !rawCreationTimeStr) {
            return null;
        }

        const day = rawCreationDateStr.split('.')[0];
        const month = rawCreationDateStr.split('.')[1];
        const year = rawCreationDateStr.split('.')[2];

        const hour = rawCreationTimeStr.split(':')[0];
        const minute = rawCreationTimeStr.split(':')[1];
        const second = rawCreationTimeStr.split(':')[2];

        // assuming UTC since no time zone was specified
        const parsableUtcDateSting = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;

        return new Date(parsableUtcDateSting);
    }

    private getRecipientFromJson(invoiceJson: any[]): Recipient {
        const recipientJson: any = invoiceJson[CsvToInvoiceConverter.RECIPIENT_INVOICE_JSON_INDEX];

        const address = new Address();
        address.name = recipientJson && recipientJson.field4;
        address.street = recipientJson && recipientJson.field5;
        address.place = recipientJson && recipientJson.field6;

        const recipient = new Recipient();
        recipient.recipientId = recipientJson && recipientJson.field2;
        recipient.recipientNumber = recipientJson && recipientJson.field3;
        recipient.companyId = recipientJson && recipientJson.field7;
        recipient.email = recipientJson && recipientJson.field8;
        recipient.address = address;

        return recipient;
    }

    private getCustomerFromJson(invoiceJson: any[]): Customer {
        const customerJson: any = invoiceJson[CsvToInvoiceConverter.CUSTOMER_INVOICE_JSON_INDEX];

        const address = new Address();
        address.name = customerJson && customerJson.field3;
        address.street = customerJson && customerJson.field4;
        address.place = customerJson && customerJson.field5;

        const customer = new Customer();
        customer.customerId = customerJson && customerJson.field2;
        customer.address = address;

        return customer;
    }

    private getPartEntriesFromJson(invoiceJson: any[]): InvoicePartEntry[] {
        const partEntries: InvoicePartEntry[] = [];

        // take all elements with index >= INVOICE_PART_ENTRIES_OFFSET
        for (let i = CsvToInvoiceConverter.INVOICE_PART_ENTRIES_OFFSET; i < invoiceJson.length; i++) {
            const partJson: any = invoiceJson[i];

            const partEntry = new InvoicePartEntry();
            partEntry.partNumber = partJson && partJson.field2;
            partEntry.partDescription = partJson && partJson.field3;
            partEntry.quantity = partJson && partJson.field4;
            partEntry.price = partJson && partJson.field5;
            partEntry.total = partJson && partJson.field6;
            partEntry.vat = this.parseUnderlineSeparatedValue(partJson && partJson.field7);
            partEntry.currency = 'CHF';

            partEntries.push(partEntry);
        }

        this.validatePartEntries(partEntries);

        return partEntries;
    }

    private validatePartEntries(partEntries: InvoicePartEntry[]): void {
        partEntries.forEach(e => {
            const calculatedTotal = e.quantity * e.price;

            if (parseFloat(calculatedTotal.toString()) !== parseFloat(e.total.toString())) {
                throw new Error('Given and calculated total do not match for part with number ' + e.partNumber);
            }
        });
    }

    private setPaymentTarget(invoiceJson: any[], invoice: Invoice): void {
        const baseInformation: any = invoiceJson[CsvToInvoiceConverter.BASE_INFORMATION_INVOICE_JSON_INDEX];
        const paymentTargetInDays = this.parseUnderlineSeparatedValue(baseInformation && baseInformation.field6);

        invoice.paymentTargetInDays = paymentTargetInDays;
        invoice.paymentTarget = CommonUtils.addDaysToDate(invoice.creationDate, parseInt(paymentTargetInDays));
    }

    private setTotal(invoice: Invoice) {
        invoice.total = invoice.partEntries
            .map(partEntry => partEntry.total)
            .reduce((total: number, currentTotal: number) => {
                // wtf javascript??
                return parseFloat(total.toString()) + parseFloat(currentTotal.toString());
            });
    }

    private setReferenceNumber(invoice: Invoice) {
        invoice.referenceNumber = this.dateFormat(invoice.creationDate, 'yyyymmddHHMMss');
    }

    private validateInvoiceJson(invoiceJson: any[]): void {
        if (!invoiceJson) {
            throw new Error('Invoice content cannot be empty.');
        }

        if (invoiceJson.length === 0) {
            throw new Error('Invoice content cannot be empty.');
        }


        const baseInformation = invoiceJson[CsvToInvoiceConverter.BASE_INFORMATION_INVOICE_JSON_INDEX];
        const recipientInformation = invoiceJson[CsvToInvoiceConverter.RECIPIENT_INVOICE_JSON_INDEX];
        const customerInformation = invoiceJson[CsvToInvoiceConverter.CUSTOMER_INVOICE_JSON_INDEX];

        const isBaseInformationValid = !!(baseInformation['field1'] && baseInformation['field2'] && baseInformation['field3'] && baseInformation['field4'] && baseInformation['field5'] && baseInformation['field6']);
        const isRecipientInformationValid = !!(recipientInformation['field1'] && recipientInformation['field2'] && recipientInformation['field3'] && recipientInformation['field4'] && recipientInformation['field5'] && recipientInformation['field6'] && recipientInformation['field7'] && recipientInformation['field8']);
        const isCustomerInformationValid = !!(customerInformation['field1'] && customerInformation['field2'] && customerInformation['field3'] && customerInformation['field4'] && customerInformation['field5']);

        if (!isBaseInformationValid) {
            throw new Error('Base information is invalid.');
        }

        if (!isRecipientInformationValid) {
            throw new Error('Recipient information is invalid.');
        }

        if (!isCustomerInformationValid) {
            throw new Error('Customer information is invalid.');
        }


        const partEntriesInformation = [];

        // take all elements with index >= INVOICE_PART_ENTRIES_OFFSET
        for (let i = CsvToInvoiceConverter.INVOICE_PART_ENTRIES_OFFSET; i < invoiceJson.length; i++) {
            partEntriesInformation.push(invoiceJson[i]);
        }

        if (partEntriesInformation.length === 0) {
            throw new Error('Invoice must have parts.');
        }

        partEntriesInformation.forEach((recipientInformation, index) => {
            const isPartEntryInformationValid = !!(recipientInformation['field1'] && recipientInformation['field2'] && recipientInformation['field3'] && recipientInformation['field4'] && recipientInformation['field5'] && recipientInformation['field6'] && recipientInformation['field7']);

            if (!isPartEntryInformationValid) {
                throw new Error(`Part information at index ${index} is invalid.`);
            }
        });
    }

    /**
     * @param value Example: Rechnung_1234
     * @returns Example: 1234
     * */
    private parseUnderlineSeparatedValue(value: string): any {
        return value && value.split('_')[1];
    }
}
