import {Status} from "./model/status.model";
import {ConfigKey} from "./model/config/config-key.model";

/*
 * Contains helper functions
 * @author Severin Toldo
 * */
export class CommonUtils {

    public static readonly NEW_LINE = '\r\n';
    public static readonly TAB = '\t';
    public static readonly SPACE = ' ';


    public static addDaysToDate(date: Date, days: number): Date {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    public static getLongestStringLength(array: string[]): number {
        return array
            .sort((x, y) => x.length - y.length)
            .reverse()
            [0]
            .length;
    }

    public static insertTabs(amount: number): string {
        return this.insertCharacters(CommonUtils.TAB, amount);
    }

    public static insertSpaces(amount: number): string {
        return this.insertCharacters(CommonUtils.SPACE, amount);
    }

    public static insertCharacters(character: string, amount: number): string {
        const characters = [];

        for (let i = 0; i < amount; i++) {
            characters.push(character);
        }

        return characters.join('');
    }

    public static handleStatus(status: Status): Status {
        if (status.status === 'error') {
            throw status.payload;
        }

        return status;
    }

    public static isValidJson(str: string): boolean {
        try {
            JSON.parse(str);
            return true;
        } catch (e) {
            return false;
        }
    }

    public static isConfigKeyPresent(configKey: ConfigKey, obj: any): boolean {
        return !!obj &&!!this.getConfigKeyValue(configKey, obj);
    }

    public static getConfigKeyValue(configKey: ConfigKey, obj: any): any {
        return obj ? obj[configKey.key] : null;
    }
}
