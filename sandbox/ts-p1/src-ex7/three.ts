declare function lower(v: object): void;
declare function upper(v: Object): void;
declare function empty(v: {}): void;

lower({ a: 1 }); lower([1, 2]); lower(() => {});
lower('hello');            // ERROR
lower(42);                 // ERROR

upper('hello'); upper(42); // both fine — primitives autobox
empty('hello'); empty(42); // both fine
empty(null);               // ERROR

declare const o: object;
o.id;                      // ERROR: object carries no members

const s: String = 'hello';
const t: string = s;       // ERROR: String is not string
