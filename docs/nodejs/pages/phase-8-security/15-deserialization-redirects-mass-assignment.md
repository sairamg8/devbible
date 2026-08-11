---
title: "Deserialization, open redirects, mass assignment"
sidebar_label: "15 · Deser., redirects, mass assignment"
sidebar_position: 15
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** — URL resolution, `Object.assign` behaviour and
> `JSON.parse` semantics executed on this machine.

Three bugs that share one root: **the request decided the shape of the data, and the
code accepted that shape.** Grouped because the fix is the same sentence in all three —
name what you accept, and ignore the rest.

## Insecure deserialization

In languages with native object serialization this is the RCE class — Python's `pickle`,
Java's `ObjectInputStream`, PHP's `unserialize`. **JavaScript's default is safe:**

```console
JSON.parse('{"a":1,"b":"() => process.exit(1)"}')
  -> {"a":1,"b":"() => process.exit(1)"}     <- the function is a string, still inert
```

`JSON.parse` produces data. It cannot construct a class instance, cannot call a
constructor, cannot execute anything. It is also strict — `{"a":1,}` throws
`SyntaxError: Expected double-quoted property name in JSON at position 7`.

The vulnerability appears when someone builds a "richer" deserializer on top:

```js
// the anti-pattern, shown so it is recognisable in review
const parsed = JSON.parse(payload);
const result = eval(parsed.onLoad);      // ← attacker-authored code, executed
```

```console
eval of a field from the payload -> RCE | executed = true
```

Same class, different spelling: `new Function(body)`, `vm.runInNewContext`, YAML loaded
with custom tags enabled, and any library advertising that it can "serialize functions"
or "revive class instances". A serialization format that can reconstruct behaviour is a
remote code execution feature.

**What to do:** keep transport data as data. Where you need a class instance, construct it
yourself from validated fields — `new Order(parsed.id, parsed.total)`, never
`Object.assign(new Order(), parsed)`. Use `JSON.parse` for JSON, and a YAML loader in
safe/core-schema mode for YAML.

Two supporting facts. The **reviver sees every key** before you do, nested first, which
makes it a free rejection point (see [page 13](./13-prototype-pollution.md)):

```console
reviver keys -> x, __proto__, y, constructor, ok,
```

And **`structuredClone` does not run constructors** — the clone of a plain object is a
plain object, `clone instanceof Account` is `false`. It is a deep copy, not a revival
mechanism, and equally not a sanitiser.

## Open redirects

`GET /login?next=/settings` is a good feature. `GET /login?next=https://evil.example` is a
phishing page hosted on your domain, with your TLS certificate and your brand in the
address bar until the moment of the redirect. It is also how OAuth `redirect_uri`
validation gets bypassed ([page 06](./06-oauth-oidc.md)) — there the prize is the
authorization code.

What `new URL(next, base)` returns for the inputs that matter, base
`https://app.example.com/dashboard`:

```console
"/settings?tab=1"              -> https://app.example.com/settings?tab=1     same host
"https://evil.example/phish"   -> https://evil.example/phish                 *** OFF SITE ***
"//evil.example/phish"         -> https://evil.example/                      *** OFF SITE ***
"/\\evil.example"              -> https://evil.example/                      *** OFF SITE ***
"\\/evil.example"              -> https://evil.example/                      *** OFF SITE ***
"https:/evil.example"          -> https://app.example.com/evil.example       same host
"javascript:alert(1)"          -> javascript:alert(1)                        *** OFF SITE ***
```

**A protocol-relative `//host` is the one people miss**, and `/\host` — a slash followed
by a backslash — is treated identically by the URL parser. Both start with `/`.

That is exactly why the usual checks fail:

```console
"//evil.example/phish"                    startsWith('/')=PASS   !startsWith('http')=PASS
"/\evil.example"                          startsWith('/')=PASS   !startsWith('http')=PASS
"https://evil.example/#app.example.com"   includes('app.example.com')=PASS
```

Every one of those is a real bypass of a real check people write.

**The version that holds** — parse against your own base and compare the resolved origin:

```js
const BASE = 'https://app.example.com';

export function safeNext(next) {
  let url;
  try { url = new URL(next, BASE); } catch { return '/'; }
  if (url.origin !== BASE) return '/';                // covers //host, /\host, javascript:, data:
  return url.pathname + url.search + url.hash;        // return a path, never the full URL
}
```

```console
"/settings?tab=1"             -> /settings?tab=1
"//evil.example/phish"        -> /
"https://evil.example/phish"  -> /
"/\evil.example"              -> /
"javascript:alert(1)"         -> /
```

Returning `pathname + search + hash` rather than the parsed href means even a mistake
downstream cannot emit an absolute URL. Where off-site redirects are a genuine
requirement, keep an **allowlist of destination origins** — never a pattern match on the
string, since `https://evil.example/#app.example.com` passes `includes()`.

**Fail closed to a fixed path.** `safeNext` returns `/` rather than throwing, because a
login flow that 500s on a malformed `next` is its own bug.

## Mass assignment

The request body arrives as an object; the record is an object; spreading one onto the
other is a single line and reviews well. It is also privilege escalation:

```js
const user = { id: 7, email: 'ada@example.com', displayName: 'Ada', isAdmin: false, credits: 0 };
const body = JSON.parse('{"displayName":"Mallory","isAdmin":true,"credits":999999}');
Object.assign({ ...user }, body);
```

```console
{"id":7,"email":"ada@example.com","displayName":"Mallory","isAdmin":true,"credits":999999}
escalated = true | credits = 999999
```

The client sent fields your form never renders. Nothing rejected them, because nothing was
asked to.

**Allowlist the fields:**

```js
const pick = (src, keys) => Object.fromEntries(keys.filter((k) => k in src).map((k) => [k, src[k]]));

const patch = pick(req.body, ['displayName', 'timezone', 'locale']);
await users.update(req.user.id, patch);
```

```console
pick(body, ["displayName"]) -> {"displayName":"Mallory"}
applied -> {"id":7,...,"isAdmin":false,"credits":0}
```

**A denylist is the version that breaks later:**

```console
denylist output -> {"displayName":"Mallory","credits":999999}
```

`isAdmin` was blocked, `credits` was not — and neither will be the column somebody adds
next month. An allowlist fails safe on the new field; a denylist fails open on it.

In practice this is the same boundary as [page 17](./17-input-validation.md): a schema
that strips unknown keys gives you the allowlist as a by-product, and gives you the types
at the same time. The ORM shortcuts deserve specific care —
`prisma.user.update({ data: req.body })` and `Model.findByIdAndUpdate(id, req.body)` are
mass assignment with a database round trip attached.

**The same bug at the row level.** `WHERE id = $1` without `AND user_id = $2` lets a valid
user patch someone else's record — object-level authorization, covered in
[page 04](./04-authentication-vs-authorization.md).

## Gotchas

**Symptom:** A user's role changed and no admin action is in the audit log
**Cause:** Mass assignment — the body carried `isAdmin` and the update spread it.
**Fix:** `pick` an explicit field list, or validate with a schema that strips unknown keys.

**Symptom:** A redirect check with `startsWith('/')` still sends users off-site
**Cause:** `//evil.example` and `/\evil.example` both begin with `/` and resolve off-origin — verified.
**Fix:** `new URL(next, BASE)` and compare `.origin`; return only path + search + hash.

**Symptom:** An open-redirect filter passes for a URL containing your own domain
**Cause:** `includes('app.example.com')` matches it in the fragment — `https://evil.example/#app.example.com`.
**Fix:** Compare parsed origins, never substrings.

**Symptom:** `new URL(next)` throws and the login route 500s
**Cause:** Malformed `next` with no base and no `try`.
**Fix:** Parse against your base inside `try`, fall back to a fixed path.

**Symptom:** A deserialization library "restores" objects and a payload executed code
**Cause:** The format can encode behaviour — `eval`, `new Function`, or YAML custom tags.
**Fix:** Plain JSON in, construct instances yourself from validated fields.

**Symptom:** A new database column is writable from the API on the day it ships
**Cause:** Denylist filtering — the new field was never added to it.
**Fix:** Allowlist. It fails safe when the schema grows.

## Interview questions

**★ Is insecure deserialization a real risk in Node?**
Not from `JSON.parse` — it produces inert data and cannot execute anything; verified, a
function written as a JSON string stays a string. The risk comes from code built on top:
`eval`, `new Function`, `vm`, YAML with custom tags, or any library that revives
functions or class instances.

**★ Why is `startsWith('/')` not a valid open-redirect check?**
Protocol-relative URLs. `//evil.example` starts with `/` and resolves to
`https://evil.example/`, and `/\evil.example` behaves identically — both verified. Parse
against your own base and compare `url.origin`.

**★ What is mass assignment and why does an allowlist beat a denylist?**
Applying a request body wholesale to a record, so the client chooses which fields to
write — verified to set `isAdmin: true` through `Object.assign`. A denylist protects only
the fields someone remembered; the column added next month is writable on the day it
ships. An allowlist fails safe by default.

**★ How does an open redirect become an account takeover?**
Through OAuth. If `redirect_uri` validation can be bypassed with a protocol-relative or
prefix-matched URL, the authorization code is delivered to the attacker's host and
exchanged for tokens. Redirect URIs are matched exactly, against a registered list.

**What should a redirect helper return?**
A path, not a URL — `pathname + search + hash` after the origin check. Then even a
downstream mistake cannot produce an absolute off-site location.

**Does `structuredClone` protect you from a hostile payload?**
No. It is a deep copy: it does not run constructors, and it does not strip anything —
verified, it preserves an own `__proto__` property. Sanitising is a separate step.

---

← Prev: [ReDoS](./14-redos.md) · Next → [Timing attacks](./16-timing-attacks.md)
