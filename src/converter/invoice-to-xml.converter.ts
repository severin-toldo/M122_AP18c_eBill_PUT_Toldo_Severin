import {Converter} from "./converter.interface";
import {Invoice} from "../model/invoice/invoice.model";


export class InvoiceToXmlConverter implements Converter<Invoice, string> {

    private dateFormat: any;


    constructor(dateFormat: any) {
        this.dateFormat = dateFormat;
    }

    public convert(invoice: Invoice): string {
        return `<XML-FSCM-INVOICE-2003A>
  <INTERCHANGE>
    <IC-SENDER>
      <Pid>${invoice.recipient.recipientId}</Pid>
    </IC-SENDER>
    <IC-RECEIVER>
      <Pid>${invoice.customer.customerId}</Pid>
    </IC-RECEIVER>
    <IR-Ref />
  </INTERCHANGE>
  <INVOICE>
    <HEADER>
      <FUNCTION-FLAGS>
        <Confirmation-Flag />
        <Canellation-Flag />
      </FUNCTION-FLAGS>
      <MESSAGE-REFERENCE>
        <REFERENCE-DATE>
          <Reference-No>${invoice.referenceNumber}</Reference-No>
          <Date>${this.toXmlDate(invoice.creationDate)}</Date>
        </REFERENCE-DATE>
      </MESSAGE-REFERENCE>
      <PRINT-DATE>
        <Date>${this.toXmlDate(invoice.creationDate)}</Date>
      </PRINT-DATE>
      <REFERENCE>
        <INVOICE-REFERENCE>
          <REFERENCE-DATE>
            <Reference-No>${invoice.invoiceNumber}</Reference-No>
            <Date>${this.toXmlDate(invoice.creationDate)}</Date>
          </REFERENCE-DATE>
        </INVOICE-REFERENCE>
        <ORDER>
          <REFERENCE-DATE>
            <Reference-No>${invoice.orderNumber}</Reference-No>
            <Date>${this.toXmlDate(invoice.creationDate)}</Date>
          </REFERENCE-DATE>
        </ORDER>
        <REMINDER Which="MAH">
          <REFERENCE-DATE>
            <Reference-No></Reference-No>
            <Date></Date>
          </REFERENCE-DATE>
        </REMINDER>
        <OTHER-REFERENCE Type="ADE">
          <REFERENCE-DATE>
            <Reference-No>${invoice.referenceNumber}</Reference-No>
            <Date>${this.toXmlDate(invoice.creationDate)}</Date>
          </REFERENCE-DATE>
        </OTHER-REFERENCE>
      </REFERENCE>
      <BILLER>
        <Tax-No>${invoice.recipient.companyId}</Tax-No>
        <Doc-Reference Type="ESR-ALT "></Doc-Reference>
        <PARTY-ID>
          <Pid>${invoice.recipient.recipientId}</Pid>
        </PARTY-ID>
        <NAME-ADDRESS Format="COM">
          <NAME>
            <Line-35>${invoice.recipient.address.name}</Line-35>
            <Line-35>${invoice.recipient.address.street}</Line-35>
            <Line-35>${invoice.recipient.address.place}</Line-35>
            <Line-35></Line-35>
            <Line-35></Line-35>
          </NAME>
          <STREET>
            <Line-35></Line-35>
            <Line-35></Line-35>
            <Line-35></Line-35>
          </STREET>
          <City></City>
          <State></State>
          <Zip></Zip>
          <Country></Country>
        </NAME-ADDRESS>
        <BANK-INFO>
          <Acct-No></Acct-No>
          <Acct-Name></Acct-Name>
          <BankId Type="BCNr-nat" Country="CH">001996</BankId>
        </BANK-INFO>
      </BILLER>
      <PAYER>
        <PARTY-ID>
          <Pid>${invoice.customer.customerId}</Pid>
        </PARTY-ID>
        <NAME-ADDRESS Format="COM">
          <NAME>
            <Line-35>${invoice.customer.address.name}</Line-35>
            <Line-35>${invoice.customer.address.street}</Line-35>
            <Line-35>${invoice.customer.address.place}</Line-35>
            <Line-35></Line-35>
            <Line-35></Line-35>
          </NAME>
          <STREET>
            <Line-35></Line-35>
            <Line-35></Line-35>
            <Line-35></Line-35>
          </STREET>
          <City></City>
          <State></State>
          <Zip></Zip>
          <Country></Country>
        </NAME-ADDRESS>
      </PAYER>
    </HEADER>
    <LINE-ITEM />
    <SUMMARY>
      <INVOICE-AMOUNT>
        <Amount>${invoice.total.toFixed(2)}</Amount>
      </INVOICE-AMOUNT>
      <VAT-AMOUNT>
        <Amount></Amount>
      </VAT-AMOUNT>
      <DEPOSIT-AMOUNT>
        <Amount></Amount>
          <REFERENCE-DATE>
            <Reference-No></Reference-No>
            <Date></Date>
          </REFERENCE-DATE>
      </DEPOSIT-AMOUNT>
      <EXTENDED-AMOUNT Type="79">
        <Amount></Amount>
      </EXTENDED-AMOUNT>
      <TAX>
        <TAX-BASIS>
          <Amount></Amount>
        </TAX-BASIS>
        <Rate Categorie="S">0</Rate>
        <Amount></Amount>
      </TAX>
      <PAYMENT-TERMS>
        <BASIC Payment-Type="ESR" Terms-Type="1">
          <TERMS>
            <Payment-Period Type="M" On-Or-After="1" Reference-Day="31">${invoice.paymentTargetInDays}</Payment-Period>
            <Date>${this.toXmlDate(invoice.paymentTarget)}</Date>
          </TERMS>
        </BASIC>
        <DISCOUNT Terms-Type="22">
          <Discount-Percentage>0.0</Discount-Percentage>
          <TERMS>
            <Payment-Period Type="M" On-Or-After="1" Reference-Day="31"></Payment-Period>
            <Date></Date>
          </TERMS>
          <Back-Pack-Container Encode="Base64"> </Back-Pack-Container>
        </DISCOUNT>
      </PAYMENT-TERMS>
    </SUMMARY>
  </INVOICE>
</XML-FSCM-INVOICE-2003A>`;
    }

    private toXmlDate(date: Date): string {
        return this.dateFormat(date, 'yyyymmdd')
    }

}
