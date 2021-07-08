import {Converter} from "./converter.interface";
import {Invoice} from "../model/invoice/invoice.model";
import {Align} from "../model/table/align.enum";
import {Table} from "../model/table/table.model";
import {Row} from "../model/table/row.model";
import {CommonUtils} from "../common.utils";


export class InvoiceToTxtConverter implements Converter<Invoice, string> {

    private static readonly PAYMENT_SLIP_LINE_NUMBER = 41;

    private dateFormat: any;


    constructor(dateFormat: any) {
        this.dateFormat = dateFormat;
    }

    public convert(invoice: Invoice): string {
        const txt = [];

        txt.push(...this.getHeaderContent(invoice));
        txt.push(...this.getPartEntriesContent(invoice));
        txt.push(...this.getFooterContent(invoice, txt.length));

        return txt.map(e => e + CommonUtils.NEW_LINE).join('');
    }

    private getHeaderContent(invoice: Invoice): string[] {
        const content = [];

        content.push(`${invoice.recipient.address.name}`);
        content.push(`${invoice.recipient.address.street}`);
        content.push(`${invoice.recipient.address.place}`);
        content.push(``);
        content.push(`${invoice.recipient.companyId}`);
        content.push(``);
        content.push(``);
        content.push(``);
        content.push(``);
        content.push(`${this.buildCreationInformation(invoice)} ${CommonUtils.insertTabs(6)} ${invoice.customer.address.name}`);
        content.push(`${CommonUtils.insertSpaces(this.buildCreationInformation(invoice).length)} ${CommonUtils.insertTabs(6)} ${invoice.customer.address.street}`);
        content.push(`${CommonUtils.insertSpaces(this.buildCreationInformation(invoice).length)} ${CommonUtils.insertTabs(6)} ${invoice.customer.address.place}`);
        content.push(``);
        content.push(`Kundennummer: ${CommonUtils.insertSpaces(6)} ${invoice.recipient.recipientNumber}`);
        content.push(`Auftragsnummer: ${CommonUtils.insertSpaces(4)} ${invoice.orderNumber}`);
        content.push(``);
        content.push(`Rechnung Nr ${CommonUtils.insertSpaces(8)} ${invoice.invoiceNumber}`);
        content.push(`-----------------------`);

        return content;
    }

    private getPartEntriesContent(invoice: Invoice): string[] {
        const content = [];
        const partEntriesSorted = invoice.partEntries.sort((x, y) => x.partNumber - y.partNumber);
        const table = new Table();

        // part entries
        table.columns = [
            {
                name: 'partNumber',
                align: Align.RIGHT,
                paddingLeft: {
                    value: 2,
                    unit: CommonUtils.SPACE
                },
                paddingRight: {
                    value: 3,
                    unit: CommonUtils.SPACE
                },
            },
            {
                name: 'partDescription',
                align: Align.LEFT,
                paddingRight: {
                    value: 6,
                    unit: CommonUtils.SPACE
                },
            },
            {
                name: 'quantity',
                align: Align.RIGHT,
                paddingRight: {
                    value: 4,
                    unit: CommonUtils.SPACE
                },
            },
            {
                name: 'price',
                align: Align.RIGHT,
                paddingRight: {
                    value: 4,
                    unit: CommonUtils.SPACE
                },
            },
            {
                name: 'currency',
                align: Align.RIGHT,
                paddingRight: {
                    value: 5,
                    unit: CommonUtils.SPACE
                },
            },
            {
                name: 'total',
                align: Align.RIGHT,
                paddingRight: {
                    value: 2,
                    unit: CommonUtils.SPACE
                },
            },
            {
                name: 'vat',
                align: Align.RIGHT
            }
        ];

        table.rows = partEntriesSorted.map(partEntry => new Row(partEntry));

        const tableToString = table.toString();
        content.push(...tableToString);

        // totals
        const partEntryRowLength = tableToString[0].length;
        const partEntryRowPaddingRight = 7;

        const totalHorizontalLine = '-----------';
        const horizontalLinePaddingLeft = partEntryRowLength - partEntryRowPaddingRight - totalHorizontalLine.length;
        content.push(CommonUtils.insertSpaces(horizontalLinePaddingLeft) + totalHorizontalLine);

        const totalText = 'Total CHF';
        const totalTextPaddingRight = 9;
        const totalTextPaddingLeft = partEntryRowLength - totalTextPaddingRight - totalTextPaddingRight - invoice.total.toFixed(2).length - partEntryRowPaddingRight;
        content.push(CommonUtils.insertSpaces(totalTextPaddingLeft) + totalText + CommonUtils.insertSpaces(totalTextPaddingRight) + invoice.total.toFixed(2));
        content.push('');

        const totalVat = '0.00'
        const totalVatText = ' MWST  CHF';
        const totalVatTextPaddingRight = 13;
        const totalVatTextPaddingLeft = partEntryRowLength - totalVatText.length - totalVatTextPaddingRight - totalVat.length - partEntryRowPaddingRight;
        content.push(CommonUtils.insertSpaces(totalVatTextPaddingLeft) + totalVatText + CommonUtils.insertSpaces(totalVatTextPaddingRight) + totalVat);

        return content;
    }

    private getFooterContent(invoice: Invoice, currentLineCount: number): string[] {
        const content = [];

        const lineNumberToAdd = InvoiceToTxtConverter.PAYMENT_SLIP_LINE_NUMBER - currentLineCount;

        for (let i = 0; i < lineNumberToAdd - 1; i++) {
            content.push(``);
        }

        content.push(`Zahlungsziel ohne Abzug ${invoice.paymentTargetInDays} Tage (${this.toTextDate(invoice.paymentTarget)})`);
        content.push(``);
        content.push(`Einzahlungsschein`);
        content.push(``);
        content.push(``);
        content.push(``);
        content.push(``);
        content.push(``);
        content.push(``);
        content.push(``);
        content.push(``);
        content.push(``);
        content.push(``);
        content.push(``);

        const table = new Table();
        table.columns = [
            {
                name: 'col1',
                align: Align.RIGHT,
                paddingRight: {
                    value: 10,
                    unit: CommonUtils.SPACE
                },
            },
            {
                name: 'col2',
                align: Align.RIGHT,
                paddingRight: {
                    value: 5,
                    unit: CommonUtils.SPACE
                },
            },

            {
                name: 'col3',
                align: Align.LEFT,
            },
        ];

        table.rows = [
            {
                col1: invoice.total.toFixed(2),
                col2: invoice.total.toFixed(2),
                col3: invoice.customer.address.name
            },
            {
                col1: '',
                col2: '',
                col3: invoice.customer.address.street
            },
            {
                col1: invoice.referenceNumber,
                col2: '',
                col3: invoice.customer.address.place
            }
        ]
            .map(e => new Row(e));

        const tableToString = table.toString();

        content.push(...tableToString);
        content.push(``);
        content.push(`${invoice.customer.address.name}`);
        content.push(`${invoice.customer.address.street}`);
        content.push(`${invoice.customer.address.place}`);

        return content;
    }

    private buildCreationInformation(invoice: Invoice): string {
        return `${invoice.creationPlace}, den ${this.toTextDate(invoice.creationDate)}`;
    }

    private toTextDate(date: Date): string {
        return this.dateFormat(date, 'dd.mm.yyyy');
    }
}
