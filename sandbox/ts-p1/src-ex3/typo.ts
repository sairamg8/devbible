interface Options { retries?: number; timeoutMs?: number }
function run(o: Options) { return o.retries ?? 0; }
interface Mixed { id: string; timeoutMs?: number }
function runMixed(o: Mixed) { return o.id; }

run({ timeoutMS: 500 });          // ERROR: literal, so the typo is caught
const opts = { timeoutMS: 500 };
run(opts);                        // ALSO errors — TS2559 weak type detection:
                                  // a type whose properties are ALL optional rejects
                                  // an object with no properties in common.
                                  // (Expected no error here; the measurement said otherwise.)

// with one REQUIRED property the weak-type rule does not apply,
// so the same typo passes through a variable unnoticed
const m = { id: 'P-1', timeoutMS: 500 };
runMixed(m);
