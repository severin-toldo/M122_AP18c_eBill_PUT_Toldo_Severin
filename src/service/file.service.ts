
/*
 * FileService
 * @author Severin Toldo
 * */
export class FileService {

    public static readonly DEFAULT_CHARSET = 'utf8';
    public static readonly SEPARATOR = '/';


    constructor(private fs: any,
                private os: any,
                private archiver: any,
                private md5: any,
                private zipper: any) {
    }

    public getHomeDirPath(): string {
        return this.os.homedir();
    }

    public getTmpDirPath(): string {
        return this.os.tmpdir();
    }

    public doesFileExist(path: string): boolean {
        return this.fs.existsSync(path);
    }

    public doesParentFileExist(path: string): boolean {
        path = path.substr(0, path.lastIndexOf(FileService.SEPARATOR));
        return this.doesFileExist(path);
    }

    public getFileContent(path: string): string {
        return this.fs.readFileSync(path, FileService.DEFAULT_CHARSET);
    }

    public getFileInformation(path: string): any {
        return this.fs.statSync(path);
    }

    public getFileSize(path: string): number {
        return this.getFileInformation(path).size;
    }

    public getFileSizeInMb(path: string): number {
        return this.getFileSize(path) / (1024 * 1024);
    }

    public getFileMd5Checksum(path: string): string {
        return this.md5(this.getFileContent(path));
    }

    public getFileName(path: string): string {
        return path.replace(/^.*[\\\/]/, '');
    }

    public zipFile(path: string): any {
        return this.zipper
            .sync
            .zip(path)
            .compress()
            .memory();
    }

    public deleteFile(path: string): void {
        this.fs.unlinkSync(path);
    }

    public writeToFile(path: string, content: string): void {
        this.fs.writeFileSync(path, content);
    }
}














