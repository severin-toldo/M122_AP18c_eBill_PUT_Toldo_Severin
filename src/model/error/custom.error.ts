export class CustomError extends Error {

    public message: string;
    public error?: Error;


    constructor(message: string, error?: Error) {
        super(message);
        this.message = message;
        this.error = error;
    }

}
