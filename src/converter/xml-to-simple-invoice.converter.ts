import {Converter} from "./converter.interface";
import {SimpleInvoice} from "../model/invoice/simple-invoice.model";

export class XmlToSimpleInvoiceConverter implements Converter<string, SimpleInvoice> {

    constructor(private xml2Json: any) {
    }

    public convert(xml: string): SimpleInvoice {
        const json = this.xml2Json.toJson(xml);
        const obj = JSON.parse(json);

        const email = obj['XML-FSCM-INVOICE-2003A']['INVOICE']['HEADER']['BILLER']['NAME-ADDRESS']['NAME']['Line-35'][0];
        const recipientName = obj['XML-FSCM-INVOICE-2003A']['INVOICE']['HEADER']['BILLER']['NAME-ADDRESS']['NAME']['Line-35'][1];
        const customerName = obj['XML-FSCM-INVOICE-2003A']['INVOICE']['HEADER']['PAYER']['NAME-ADDRESS']['NAME']['Line-35'][0];
        const invoiceNumber = obj['XML-FSCM-INVOICE-2003A']['INVOICE']['HEADER']['REFERENCE']['INVOICE-REFERENCE']['REFERENCE-DATE']['Reference-No']

        return {
            invoiceNumber: invoiceNumber,
            recipientName: recipientName,
            recipientEmail: email,
            customerName: customerName
        };
    }

}
