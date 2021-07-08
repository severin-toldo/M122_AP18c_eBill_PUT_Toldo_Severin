import {Recipient} from "../recipient.model";
import {Customer} from "../customer.model";
import {InvoicePartEntry} from "./invoice-part.model";

export class Invoice {
    public invoiceNumber: string;
    public orderNumber: string;
    public creationPlace: string;
    public creationDate: Date;
    public paymentTarget: Date;
    public paymentTargetInDays: number;
    public recipient: Recipient;
    public customer: Customer;
    public partEntries: InvoicePartEntry[];
    public total: number;
    public referenceNumber: string;
    public originalFileName: string;
}
