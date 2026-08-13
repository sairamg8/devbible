type Formatter = (value: number, currency: string) => string;

const f1: Formatter = (v, c) => `${c}${v}`;      // params inferred contextually
const f2: Formatter = (v) => `${v}`;             // FEWER params: allowed
const f3: Formatter = (v, c, extra) => `${v}`;   // MORE params: error

type Handler = () => void;
const h: Handler = () => 42;                     // returning a value into void: allowed

declare function each<T>(xs: T[], cb: (x: T) => void): void;
each([1, 2], (x) => x.toFixed(2));               // cb returns string into void: allowed
