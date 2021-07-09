import {Observable} from "rxjs";
import {Status} from "../model/status.model";
import {tap} from "rxjs/operators";
import {CommonUtils} from "../common.utils";
import {ErrorCodeError} from "../model/error/error-code.error";
import {ErrorCode} from "../model/error/error-code.enum";


/*
 * EmailService
 * @author Severin Toldo
 * */
export class EmailService {

    public static readonly MAX_ALLOWED_ATTACHMENT_SIZE_IN_MB = 25;

    private transporter: any;

    constructor(private nodemailer: any) {
    }

    public createTransporter(service: string, user: string, password: string): EmailService {
        this.transporter = this.nodemailer.createTransport({
            service: service,
            auth: {
                user: user,
                pass: password
            }
        });

        return this;
    }

    public sendEmail(mailOptions: any): Observable<Status> {
        return Observable.create(observer => {
            if (!this.transporter) {
                observer.next({status: 'error', payload: new ErrorCodeError(ErrorCode.SENDING_EMAIL_FAILED, new Error('no transporter was set up!'))})
            }

            this.transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    observer.next({status: 'error', payload: new ErrorCodeError(ErrorCode.SENDING_EMAIL_FAILED, error)})
                } else {
                    observer.next({status: 'success', payload: info.response});
                }
            });
        })
            .pipe(tap((status: Status) => CommonUtils.handleStatus(status)));
    }

}
