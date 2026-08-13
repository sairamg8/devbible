type Cat = { name: string; meow(): void };
type Dog = { name: string; bark(): void };
declare const pet: Cat | Dog;

if ('meow' in pet) { const r: 1 = pet; }      // reveals Cat
else               { const r: 1 = pet; }      // reveals Dog

class ApiError extends Error { constructor(public status: number) { super(); } }
declare const e: unknown;
if (e instanceof ApiError) { const r: 1 = e; }
if (e instanceof Error)    { const r: 1 = e; }

function isCat(p: Cat | Dog): p is Cat { return 'meow' in p; }
if (isCat(pet)) { const r: 1 = pet; }

function assertString(v: unknown): asserts v is string {
  if (typeof v !== 'string') throw new Error('not a string');
}
declare const u: unknown;
assertString(u);
const r2: 1 = u;                               // reveals string AFTER the assertion
