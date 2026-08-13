// Phase 8 page 17 — follow-ups. Node 24.19.0, zod 4.4.3.
import { z } from 'zod';

const line = (t) => console.log(`\n=== ${t} ===`);
const j = (x) => JSON.stringify(x);

line('A. does looseObject copy INHERITED properties?');
const proto = { inherited: 'yes' };
const obj = Object.create(proto);
obj.email = 'a@b.com'; obj.name = 'Sai'; obj.extra = 1;
console.log('own keys        ->', j(Object.keys(obj)));
console.log('obj.inherited   ->', obj.inherited);
const Loose = z.looseObject({ email: z.email(), name: z.string() });
console.log('looseObject out ->', j(Loose.parse(obj)));
const Strict = z.strictObject({ email: z.email(), name: z.string() });
console.log('strictObject    ->', j(Strict.safeParse(obj).error?.issues[0].keys ?? 'accepted'));
console.log('object() out    ->', j(z.object({ email: z.email(), name: z.string() }).parse(obj)));

line('B. what makes a failing parse expensive? (issue count, 20k each)');
const S = z.object({ a: z.string(), b: z.string(), c: z.string(), d: z.string() });
const cases = {
  'all valid    ': { a: '1', b: '2', c: '3', d: '4' },
  '1 bad field  ': { a: 1, b: '2', c: '3', d: '4' },
  '4 bad fields ': { a: 1, b: 2, c: 3, d: 4 },
};
for (const [label, input] of Object.entries(cases)) {
  for (let i = 0; i < 2_000; i++) S.safeParse(input);
  const t = performance.now();
  for (let i = 0; i < 20_000; i++) S.safeParse(input);
  const ms = performance.now() - t;
  console.log(label, `${ms.toFixed(1)} ms / 20k = ${(ms * 1000 / 20_000).toFixed(1)} µs`);
}

line('B2. is it the Error object or the issues? (20k)');
const one = { a: 1, b: '2', c: '3', d: '4' };
let t = performance.now();
for (let i = 0; i < 20_000; i++) { const r = S.safeParse(one); }
console.log('safeParse, never touch .error ->', (performance.now() - t).toFixed(1), 'ms / 20k');
t = performance.now();
for (let i = 0; i < 20_000; i++) { const r = S.safeParse(one); void r.error.issues.length; }
console.log('safeParse, read .error.issues ->', (performance.now() - t).toFixed(1), 'ms / 20k');

line('C. z.email() vs the zod 3 spelling');
console.log('typeof z.email                    ->', typeof z.email);
console.log('typeof z.string().email           ->', typeof z.string().email);
try { console.log('z.string().email() still parses  ->', j(z.string().email().parse('a@b.com'))); }
catch (e) { console.log('z.string().email() threw ->', e.message); }

line('D. array/depth limits — an unbounded array field');
const Tags = z.object({ tags: z.array(z.string()) });
const many = { tags: Array.from({ length: 200_000 }, (_, i) => 't' + i) };
t = performance.now();
const r = Tags.safeParse(many);
console.log('200k-element array, no .max() -> success:', r.success, '|', (performance.now() - t).toFixed(1), 'ms');
const Capped = z.object({ tags: z.array(z.string()).max(20) });
t = performance.now();
const r2 = Capped.safeParse(many);
console.log('same input, .max(20)          -> success:', r2.success, '|', (performance.now() - t).toFixed(1), 'ms |', r2.error?.issues[0].message);

line('E. .default() vs .optional(), and what reaches your code');
const D = z.object({
  role: z.enum(['user', 'admin']).default('user'),
  bio: z.string().optional(),
  nick: z.string().nullish(),
});
console.log('parse({})            ->', j(D.parse({})));
console.log('keys present         ->', j(Object.keys(D.parse({}))));
console.log('role: "admin" from body ->', j(D.parse({ role: 'admin' })));

line('F. the allowlist that actually stops mass assignment');
const Patch = z.strictObject({ name: z.string().min(1).max(80), bio: z.string().max(500).optional() });
for (const input of [{ name: 'Sai' }, { name: 'Sai', role: 'admin' }, { name: 'Sai', id: 99 }]) {
  const rr = Patch.safeParse(input);
  console.log(j(input).padEnd(32), '->', rr.success ? 'OK ' + j(rr.data) : 'REJECT ' + j(rr.error.issues[0].keys));
}
