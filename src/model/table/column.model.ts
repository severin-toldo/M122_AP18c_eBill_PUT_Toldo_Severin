import {Align} from "./align.enum";
import {Padding} from "./padding.model";

export class Column {
    public name: string;
    public align: Align;
    public paddingRight?: Padding;
    public paddingLeft?: Padding;
}
