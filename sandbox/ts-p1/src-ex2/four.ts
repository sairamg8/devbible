declare const a: any;
declare const u: unknown;

a.whatever.deeply.nested();      // no error: any disables checking
const n1: number = a;            // no error: any flows anywhere

u.toUpperCase();                 // error: must narrow first
const n2: number = u;            // error: unknown assigns to nothing

if (typeof u === 'string') {
  u.toUpperCase();               // fine once narrowed
}

function fail(msg: string): never {
  throw new Error(msg);
}
const nv: never = fail('x');
const s: string = fail('x');     // never assigns TO everything

function log(): void { }
const v = log();
const bad: number = v;           // void assigns to nothing useful
