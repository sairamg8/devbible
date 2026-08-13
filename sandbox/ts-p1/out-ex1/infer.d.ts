export declare let mutableCity: string;
export declare const constCity = "Hyderabad";
export declare const rates: {
    standard: number;
    express: number;
};
export declare const frozen: {
    readonly standard: 120;
    readonly express: 260;
};
export declare const mixed: (string | number | boolean)[];
export declare const tupleish: readonly [1, 'two'];
export declare const nested: {
    a: {
        b: number[];
    };
};
export declare function quote(weight: number, express?: boolean): number;
export declare const maybe: string | null;
