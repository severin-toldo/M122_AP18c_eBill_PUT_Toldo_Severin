export interface Converter<SOURCE, TARGET> {

    convert(source: SOURCE): TARGET;

}
