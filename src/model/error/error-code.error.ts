import {ErrorCode} from "./error-code.enum";
import {CustomError} from "./custom.error";

/*
 * ErrorCodeError
 * @author Severin Toldo
 * */
export class ErrorCodeError extends CustomError {

    public errorCode: ErrorCode;
    public error?: Error;

    constructor(errorCode: ErrorCode, error?: Error) {
        super(errorCode.toString());
        this.errorCode = errorCode;
        this.error = error;
    }

}
