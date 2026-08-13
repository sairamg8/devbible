// Phase 8 page 17 — input validation at the boundary. Node 24.19.0, zod 4.4.3, valibot 1.4.2.
import { z } from 'zod';
import * as v from 'valibot';

const line = (t) => console.log(`\n=== ${t} ===`);
const j = (x) => JSON.stringify(x);

// ---------------------------------------------------------------- 1. unknown keys
line('1. unknown keys: object vs strictObject vs looseObject');
const User = z.object({ email: z.email(), name: z.string() });
const body = { email: 'a@b.com', name: 'Sai', isAdmin: true, __proto__: { polluted: 1 } };
console.log('input keys       ->', j(Object.keys(body)));
console.log('z.object()       ->', j(User.parse(body)));
console.log('z.looseObject()  ->', j(z.looseObject({ email: z.email(), name: z.string() }).parse(body)));
const strict = z.strictObject({ email: z.email(), name: z.string() });
const sr = strict.safeParse(body);
console.log('z.strictObject() -> success:', sr.success, '| issue:', sr.error?.issues[0].code, j(sr.error?.issues[0].keys ?? null));

// ---------------------------------------------------------------- 2. proto keys
line('2. __proto__ through JSON.parse then zod');
const raw = '{"email":"a@b.com","name":"Sai","__proto__":{"polluted":true}}';
const parsedJson = JSON.parse(raw);
console.log('JSON.parse own keys  ->', j(Object.keys(parsedJson)));
console.log('has own __proto__?   ->', Object.hasOwn(parsedJson, '__proto__'));
const out = User.parse(parsedJson);
console.log('after zod own keys   ->', j(Object.keys(out)));
console.log('after zod hasOwn     ->', Object.hasOwn(out, '__proto__'));
console.log('Object.prototype.polluted ->', {}.polluted);

// ---------------------------------------------------------------- 3. identity
line('3. parse returns a new object? (nested identity)');
const Nested = z.object({ profile: z.object({ bio: z.string() }) });
const src = { profile: { bio: 'hi' }, secret: 'x' };
const dst = Nested.parse(src);
console.log('top-level same ref?  ->', dst === src);
console.log('nested same ref?     ->', dst.profile === src.profile);

// ---------------------------------------------------------------- 4. coercion traps
line('4. z.coerce.number() on hostile input');
const num = z.coerce.number();
for (const input of ['42', '', '  ', 'abc', [], [7], null, undefined, true, false, '1e3', '0x10', ' 12 ', '12abc', {}]) {
  const r = num.safeParse(input);
  console.log(String(typeof input === 'object' ? j(input) : String(input)).padEnd(8),
    typeof input === 'string' ? '(string)' : `(${Array.isArray(input) ? 'array' : typeof input})`,
    '->', r.success ? `OK ${j(r.data)}` : `REJECT ${r.error.issues[0].code}`);
}

line('4b. z.coerce.boolean() — the one that surprises people');
for (const input of ['false', '0', '', 'no', 'true']) {
  const r = z.coerce.boolean().safeParse(input);
  console.log(j(input).padEnd(8), '->', r.success ? j(r.data) : 'REJECT');
}

// ---------------------------------------------------------------- 5. query strings
line('5. everything from a query string is a string (or an array)');
const Page = z.object({ page: z.number().int().min(1), limit: z.number().int().max(100) });
console.log('z.number() on "2"    ->', j(Page.safeParse({ page: '2', limit: '10' }).error?.issues.map(i => [i.path.join('.'), i.code, i.message])));
const PageOk = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
console.log('coerce+default {}    ->', j(PageOk.parse({})));
console.log('coerce "2"/"10"      ->', j(PageOk.parse({ page: '2', limit: '10' })));
console.log('limit "500"          ->', j(PageOk.safeParse({ limit: '500' }).error?.issues[0].message));
// repeated key -> array, which a naive string schema does not expect
const Q = z.object({ sort: z.string() });
console.log('?sort=a&sort=b       ->', j(Q.safeParse({ sort: ['a', 'b'] }).error?.issues[0].message));

// ---------------------------------------------------------------- 6. error shape
line('6. error reporting APIs (zod 4)');
const bad = z.object({ email: z.email(), age: z.number().min(18) }).safeParse({ email: 'nope', age: 5 });
console.log('issues     ->', j(bad.error.issues.map(i => ({ path: i.path, code: i.code }))));
console.log('flatten    ->', j(z.flattenError(bad.error).fieldErrors));
console.log('treeify    ->', j(z.treeifyError(bad.error).properties.email.errors));
console.log('prettify   ->\n' + z.prettifyError(bad.error));

// ---------------------------------------------------------------- 7. parse vs validate
line('7. parse, do not validate — transform to a domain value');
const Trimmed = z.string().trim().toLowerCase().pipe(z.email());
console.log('"  A@B.COM " ->', j(Trimmed.parse('  A@B.COM ')));
const Slug = z.string().regex(/^[a-z0-9-]{1,40}$/).brand('Slug');
console.log('branded ok   ->', j(Slug.parse('hello-world')));

// ---------------------------------------------------------------- 8. valibot equivalent
line('8. valibot — same job, different shape');
const VUser = v.object({ email: v.pipe(v.string(), v.email()), name: v.string() });
console.log('valibot strips?      ->', j(v.parse(VUser, body)));
const vr = v.safeParse(v.strictObject({ email: v.pipe(v.string(), v.email()), name: v.string() }), body);
console.log('valibot strict       ->', vr.success, '|', vr.issues?.[0].type);

// ---------------------------------------------------------------- 9. throughput
line('9. throughput (same 4-field object, 200k parses)');
const shape = { email: 'a@b.com', name: 'Sai', age: 33, tags: ['x', 'y'] };
const Z = z.object({ email: z.email(), name: z.string().min(1), age: z.number().int(), tags: z.array(z.string()) });
const V = v.object({ email: v.pipe(v.string(), v.email()), name: v.pipe(v.string(), v.minLength(1)), age: v.number(), tags: v.array(v.string()) });
const N = 200_000;
for (const [label, fn] of [
  ['JSON.parse only  ', () => JSON.parse('{"email":"a@b.com","name":"Sai","age":33,"tags":["x","y"]}')],
  ['zod parse        ', () => Z.parse(shape)],
  ['zod safeParse    ', () => Z.safeParse(shape)],
  ['valibot parse    ', () => v.parse(V, shape)],
  ['hand-written if  ', () => { if (typeof shape.email !== 'string' || !shape.email.includes('@')) throw 0; return shape; }],
]) {
  for (let i = 0; i < 20_000; i++) fn();            // warm
  const t = performance.now();
  for (let i = 0; i < N; i++) fn();
  const ms = performance.now() - t;
  console.log(label, `${ms.toFixed(1)} ms / ${N/1000}k  = ${(ms * 1000 / N).toFixed(2)} µs/parse`);
}

line('9b. cost of a FAILING parse (throw vs safeParse), 50k');
const badInput = { email: 'nope', name: '', age: 1.5, tags: [1] };
for (const [label, fn] of [
  ['parse + try/catch', () => { try { Z.parse(badInput); } catch {} }],
  ['safeParse        ', () => Z.safeParse(badInput)],
]) {
  for (let i = 0; i < 5_000; i++) fn();
  const t = performance.now();
  for (let i = 0; i < 50_000; i++) fn();
  console.log(label, `${(performance.now() - t).toFixed(1)} ms / 50k`);
}

// ---------------------------------------------------------------- 10. validation is not a size limit
line('10. validation runs AFTER JSON.parse');
const big = JSON.stringify({ email: 'a@b.com', name: 'x'.repeat(20_000_000) });
console.log('payload bytes ->', big.length);
let t = performance.now();
const parsedBig = JSON.parse(big);
console.log('JSON.parse    ->', (performance.now() - t).toFixed(1), 'ms  (spent before any schema is consulted)');
t = performance.now();
z.object({ email: z.email(), name: z.string().max(50) }).safeParse(parsedBig);
console.log('zod reject    ->', (performance.now() - t).toFixed(1), 'ms');
