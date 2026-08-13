// Phase 8 page 15 — insecure deserialization, open redirects, mass assignment.
const line = (s) => console.log('\n== ' + s + ' ==');

line('open redirect: what new URL(userInput, base) actually returns');
const BASE = 'https://app.example.com/dashboard';
for (const next of [
  '/settings',
  '/settings?tab=1',
  'https://evil.example/phish',
  '//evil.example/phish',
  '/\\evil.example',
  '\\/evil.example',
  '/%09/evil.example',
  'https:/evil.example',
  'javascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  '/redirect?to=https://evil.example',
]) {
  let out;
  try {
    out = new URL(next, BASE).href;
  } catch (e) {
    out = 'THREW ' + e.message;
  }
  const sameHost = out.startsWith('http') && (() => { try { return new URL(out).host === 'app.example.com'; } catch { return false; } })();
  console.log(JSON.stringify(next).padEnd(44), '->', out.padEnd(46), sameHost ? 'same host' : '*** OFF SITE ***');
}

line('the naive checks people write, against the same inputs');
const naive = {
  "startsWith('/')": (s) => s.startsWith('/'),
  "!startsWith('http')": (s) => !s.startsWith('http'),
  "includes('app.example.com')": (s) => s.includes('app.example.com'),
};
for (const next of ['//evil.example/phish', '/\\evil.example', 'https:/evil.example', 'https://evil.example/#app.example.com']) {
  const verdicts = Object.entries(naive).map(([n, f]) => `${n}=${f(next) ? 'PASS' : 'block'}`);
  console.log(JSON.stringify(next).padEnd(42), verdicts.join('  '));
}

line('the check that holds: parse against the base, compare origin');
function safeNext(next, base = BASE) {
  let u;
  try { u = new URL(next, base); } catch { return '/'; }
  if (u.origin !== new URL(base).origin) return '/';
  return u.pathname + u.search + u.hash;
}
for (const next of ['/settings?tab=1', '//evil.example/phish', 'https://evil.example/phish', '/\\evil.example', 'javascript:alert(1)']) {
  console.log(JSON.stringify(next).padEnd(42), '->', safeNext(next));
}

line('mass assignment: Object.assign over a row');
const user = { id: 7, email: 'ada@example.com', displayName: 'Ada', isAdmin: false, credits: 0 };
const body = JSON.parse('{"displayName":"Mallory","isAdmin":true,"credits":999999}');
const patched = Object.assign({ ...user }, body);
console.log('after Object.assign ->', JSON.stringify(patched));
console.log('escalated =', patched.isAdmin, '| credits =', patched.credits);

line('the allowlist — pick the fields, never spread the body');
const pick = (src, keys) => Object.fromEntries(keys.filter((k) => k in src).map((k) => [k, src[k]]));
console.log('pick(body, ["displayName"]) ->', JSON.stringify(pick(body, ['displayName'])));
console.log('applied ->', JSON.stringify({ ...user, ...pick(body, ['displayName']) }));

line('a denylist is the version that breaks later');
const deny = new Set(['isAdmin', 'role']);
const filtered = Object.fromEntries(Object.entries(body).filter(([k]) => !deny.has(k)));
console.log('denylist output ->', JSON.stringify(filtered), '<- credits still through; the new column tomorrow is too');

line('deserialization: JSON.parse cannot execute code');
const hostile = '{"a":1,"b":"() => process.exit(1)"}';
console.log('JSON.parse ->', JSON.stringify(JSON.parse(hostile)), '<- the function is a string, still inert');
try {
  JSON.parse('{"a":1,}');
} catch (e) {
  console.log('trailing comma ->', e.constructor.name + ':', e.message.split('\n')[0]);
}

line('...but a "deserializer" built on eval does');
let executed = false;
globalThis.__mark = () => { executed = true; return 'RCE'; };
const payload = '{"note":"hi","onLoad":"__mark()"}';
const parsed = JSON.parse(payload);
// this is the anti-pattern, shown so it is recognisable in a code review:
const result = eval(parsed.onLoad);            // eslint-disable-line no-eval
console.log('eval of a field from the payload ->', result, '| executed =', executed);
console.log('Same class: new Function(), vm.runInNewContext, YAML custom tags, any "revive the function" library.');

line('the JSON.parse reviver sees keys before you do');
const seen = [];
JSON.parse('{"__proto__":{"x":1},"constructor":{"y":2},"ok":3}', function (k, v) {
  seen.push(k);
  return v;
});
console.log('reviver keys ->', seen.join(', '), '<- the hook where you can reject dangerous keys for free');

line('structuredClone does not run constructors');
class Account { constructor() { console.log('  Account ctor ran'); } }
const clone = structuredClone({ tag: 'plain' });
console.log('structuredClone ->', JSON.stringify(clone), '| instance of Account?', clone instanceof Account);
