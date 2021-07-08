import {Column} from "./column.model";
import {Row} from "./row.model";
import {CommonUtils} from "../../common.utils";
import {Align} from "./align.enum";

export class Table {

    public columns: Column[] = [];
    public rows: Row[] = [];


    public toString(): string[] {
        const rowValuesByColumnName: any[] = this.columns.map(col => {
            let rowValuesByIndex = this.rows
                .map((row, index) => {
                    return {
                        index: index, // index necessary to keep order of elements
                        value: '' + row.value[col.name] + '' // ensure that all are strings
                    }
                });

            const longestRowValueLength: number = CommonUtils.getLongestStringLength(rowValuesByIndex.map(rv => rv.value));
            const transformedRowValuesByIndex = rowValuesByIndex.map(rv => {
                rv.value = this.setAlignment(rv.value, longestRowValueLength, col);
                rv.value = this.setPadding(rv.value, col);

                return rv;
            });

            return {
                columnName: col.name,
                values: transformedRowValuesByIndex
            };
        });

        const result = [];

        // build final result
        this.rows.forEach((row, index) => {
            const rowResult = [];

            this.columns.forEach(col => {
                rowResult.push(rowValuesByColumnName.filter(rv => rv.columnName === col.name)[0].values[index].value);
            });

            result.push(rowResult.join(''));
        });

        return result;
    }

    private setAlignment(rowValue: string, longestRowValueLength: number, col: Column): string {
        if (rowValue.length !== longestRowValueLength) {
            // fill up with spaces based on alignment
            if (col.align === Align.RIGHT) {
                return CommonUtils.insertSpaces(longestRowValueLength - rowValue.length) + rowValue;
            } else {
                return rowValue + CommonUtils.insertSpaces(longestRowValueLength - rowValue.length);
            }
        }

        return rowValue;
    }

    private setPadding(rowValue: string, col: Column): string {
        if (col.paddingLeft) {
            rowValue = CommonUtils.insertCharacters(col.paddingLeft.unit, col.paddingLeft.value) + rowValue;
        }

        if(col.paddingRight) {
            rowValue = rowValue + CommonUtils.insertCharacters(col.paddingRight.unit, col.paddingRight.value);
        }

        return rowValue;
    }

}
