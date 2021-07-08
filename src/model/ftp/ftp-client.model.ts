import {Status} from "../status.model";
import {ErrorCodeError} from "../error/error-code.error";
import {ErrorCode} from "../error/error-code.enum";
import {CommonUtils} from "../../common.utils";
import {Observable, race, Subject} from "rxjs";
import {map, publishReplay, refCount, tap} from "rxjs/operators";
import {FileService} from "../../service/file.service";
import {CustomError} from "../error/custom.error";
import {FtpFileResponse} from "./ftp-file-response.model";
import {FtpFileType} from "./ftp-file-type.enum";


/*
 * Wrapper FtpClient to use ftp library effectively
 * @author Severin Toldo
 * */
export class FtpClient {

    private host: string;
    private user: string;
    private password: string;
    private libraryFtpClient: any;

    private ftpClientConnected$ = new Subject<Status>();
    private ftpClientDisconnected$ = new Subject<Status>();
    private ftpClientError$ = new Subject<Status>();



    constructor(private ftp: any,
                private fileService: FileService,
                private logger: any) {
        this.libraryFtpClient = new ftp();
        this.libraryFtpClient.on('ready', () => this.ftpClientConnected$.next({status: 'connected'}));
        this.libraryFtpClient.on('end', () => this.ftpClientDisconnected$.next({status: 'disconnected'}));
        this.libraryFtpClient.on('error', (error) => this.ftpClientError$.next({status: 'error', payload: new ErrorCodeError(ErrorCode.FTP_CONNECTION_FAILED, error)}));
    }

    public connect(host: string, user: string, password: string): Observable<Status> {
        this.host = host;
        this.user = user;
        this.password = password;

        this.libraryFtpClient.connect({
            'host': host,
            'user': user,
            'password': password
        });

        return race(
            this.ftpClientConnected$,
            this.ftpClientError$
        )
            .pipe(map(status => CommonUtils.handleStatus(status)))
            .pipe(tap(() => {
                this.logger.info('Customer system FTP client connected.');
                this.logger.info('URL: ' + host);
                this.logger.info('User: ' + user);
            }))
            .pipe(publishReplay(1))
            .pipe(refCount());
    }

    public disconnect(): Observable<Status> {
        this.libraryFtpClient.end();

        return race(
            this.ftpClientDisconnected$,
            this.ftpClientError$
        )
            .pipe(map(status => CommonUtils.handleStatus(status)))
            .pipe(tap(() => this.logger.info(`ftp client disconnected. (${this.host})`)))
    }

    public upload(sourcePath: string, targetPath: string): Observable<Status> {
        return Observable.create(observer => {
            this.libraryFtpClient.put(sourcePath, targetPath, (error, response) => {
                // library doesn't check if file exists
                if (!this.fileService.doesFileExist(sourcePath)) {
                    observer.next({status: 'error', payload: new ErrorCodeError(ErrorCode.UPLOAD_FAILED, new Error('Invalid source path, file does not exist! ' + sourcePath))});
                    return;
                }

                if (error) {
                    observer.next({status: 'error', payload: new CustomError(ErrorCode.UPLOAD_FAILED.toString() + ' for file ' + sourcePath, error)});
                    return;
                }

                observer.next({status: 'success', payload: sourcePath});
            });
        })
            .pipe(map((status: Status) => CommonUtils.handleStatus(status)));
    }

    public download(sourcePath: string): Observable<Status> {
        return Observable.create(observer => {
            this.libraryFtpClient.get(sourcePath, (error, stream) => {
                if (error) {
                    observer.next({status: 'error', payload: new CustomError(ErrorCode.DOWNLOAD_FAILED.toString() + ' for file ' + sourcePath, error)});
                    return;
                }

                // stream to string
                let fileContentAsString = '';

                stream.on('data', (data) => {
                    fileContentAsString += data.toString();
                });

                stream.on('end', () => {
                    const fileName = sourcePath.substring(sourcePath.lastIndexOf('/') + 1);
                    observer.next({status: 'success', payload: {fileName: fileName, fileData: fileContentAsString}});
                });

                stream.on('error', error => {
                    observer.next({status: 'error', payload: new CustomError(ErrorCode.DOWNLOAD_FAILED.toString() + ' for file ' + sourcePath, error)});
                });
            });
        })
            .pipe(map((status: Status) => CommonUtils.handleStatus(status)));
    }

    public list(path: string): Observable<Status> {
        return Observable.create(observer => {
            this.libraryFtpClient.list(path, (error, response) => {
                if (error) {
                    observer.next({status: 'error', payload: new CustomError(ErrorCode.FETCHING_LIST_FAILED.toString() + ' for path ' + path, error)});
                    return;
                }

                const list = response.map(e => {
                    const ftpFileResponse = new FtpFileResponse();
                    ftpFileResponse.name = e.name;
                    ftpFileResponse.type = e.type === 'd' ? FtpFileType.DIRECTORY : FtpFileType.FILE;

                    return ftpFileResponse;
                });

                observer.next({status: 'success', payload: list});
            });
        })
            .pipe(map((status: Status) => CommonUtils.handleStatus(status)));
    }

    public delete(path: string): Observable<Status> {
        return Observable.create(observer => {
            this.libraryFtpClient.delete(path, (error) => {
                if (error) {
                    observer.next({status: 'error', payload: new CustomError(ErrorCode.DELETE_FAILED.toString() + ' for path ' + path, error)});
                    return;
                }

                observer.next({status: 'success'});
            });
        })
            .pipe(map((status: Status) => CommonUtils.handleStatus(status)));
    }
}
