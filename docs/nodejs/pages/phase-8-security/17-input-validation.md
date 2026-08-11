---
title: "Input validation at the boundary"
sidebar_label: "17 · Input validation"
sidebar_position: 17
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0**, **zod 4.4.3**, **valibot 1.4.2** — every
> output below is from `sandbox/p8-security/ex14`–`ex16`.

Every bug in the previous nine pages arrives the same way: a value from outside reaches
code that assumed it was something else. **Validation is the one control that sits in
front of all of them** — which is why it is the only Master row in the practices set.

## Parse, don't validate

A validator answers *is this okay?* and hands back the same untrusted object; a parser
answers *what is this, exactly?* and hands back a **new value whose type you know**.

```js
if (!isValidEmail(body.email)) throw new Error('bad email');
await createUser(body);                    // still the raw body, still `any`

const user = CreateUser.parse(body);
await createUser(user);                    // typed, trimmed, stripped
```

The difference shows up six months later when someone adds a field. With `validate`,
`body` still carries it. With `parse`, it does not exist unless the schema says so.

## The boundary is four checks, in order

Reaching for the schema first is the common mistake — by then you have already spent the
expensive part.

```js
const MAX_BODY = 1024;                     // bytes, per route

async function readJson(req, limit = MAX_BODY) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error(`body exceeds ${limit} bytes`), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('body is not valid JSON'), { status: 400 });
  }
}

const CreateUser = z.strictObject({
  email: z.email().max(254),
  name:  z.string().trim().min(1).max(80),
  age:   z.coerce.number().int().min(13).max(130).optional(),
});
```

Content type, then size, then JSON, then schema:

```console
valid                        201 {"created":{"email":"a@b.com","name":"Sai","age":33}}
unknown key                  400 {"error":"invalid body","fields":{}}
bad email + short name       400 {"error":"invalid body","fields":{"email":["Invalid email address"], ...}}
wrong content-type           415 {"error":"expected application/json"}
not JSON                     400 {"error":"body is not valid JSON"}
2 KB body (cap 1 KB)         413 {"error":"body exceeds 1024 bytes"}
```

`"  Sai  "` came back as `"Sai"` and `"33"` as the number `33` — the handler never sees
the original.

**Why the size cap comes first.** A schema cannot protect you from a payload it has not
been given yet:

```console
JSON.parse 20 MB      -> 40.7 ms of event loop, before any schema runs
cap check on 20 MB    -> rejected after 1024 bytes, in 0.002 ms
```

Forty milliseconds of blocked loop per request, from an attacker who never sent a valid
field. The cap is the defence; the schema is what happens after it holds.

## Unknown keys: three behaviours, pick deliberately

The mass-assignment control from [page 15](./15-deserialization-redirects-mass-assignment.md),
and the default is the safe one:

```console
input keys       -> ["email","name","isAdmin"]
z.object()       -> {"email":"a@b.com","name":"Sai"}                          strips
z.looseObject()  -> {"email":"a@b.com","name":"Sai","isAdmin":true,...}       keeps
z.strictObject() -> success: false | unrecognized_keys ["isAdmin"]            rejects
```

Use `strictObject` on anything that writes — a rejection tells you a client is sending
fields you did not design for, which is information `object()` discards silently. Use
`object()` when consuming someone else's payload, where extra keys are normal.

**`looseObject` copies inherited properties, not just own ones:**

```console
own keys        -> ["email","name","extra"]
looseObject out -> {"email":"a@b.com","name":"Sai","extra":1,"inherited":"yes"}
```

`inherited` was never an own property of the input — the shape of a prototype pollution
assist ([page 13](./13-prototype-pollution.md)), and one more reason passthrough should be
a deliberate choice.

**Zod drops `__proto__` for you, but not its relatives.** Through `JSON.parse` it arrives
as a real own key and zod removes it; with `z.record`, where the keys are attacker-chosen
by design, `constructor` survives:

```console
JSON.parse own keys  -> ["email","name","__proto__"]
after zod own keys   -> ["email","name"]
record own keys      -> ["a","constructor"]
```

A schema narrows that door; it does not close it, so keep the page 13 defences.

## Coercion is a second parser, and it is lenient

`z.coerce.number()` is `Number()` with a type check on the result, and `Number()` is
generous:

```console
"42"  -> OK 42     ""      -> OK 0    "  "  -> OK 0     "1e3"   -> OK 1000
[]    -> OK 0      [7]     -> OK 7    null  -> OK 0     "0x10"  -> OK 16
true  -> OK 1      false   -> OK 0    " 12 "-> OK 12    "abc"/"12abc"/{} -> REJECT
```

An empty string, an empty array and `null` all become `0`. Where `0` is meaningful — a
quantity, a price, an offset — coercion has just invented data. `z.coerce.boolean()` is
worse, because it is `Boolean()`:

```console
"false" -> true      "0" -> true      "no" -> true      "" -> false
```

**Never use `z.coerce.boolean()` on a query parameter.** Write the mapping you mean:
`z.enum(['true','false']).transform(s => s === 'true')`.

Coercion exists because query strings and headers are always strings:

```console
z.number() on "2"    -> [["page","invalid_type","Invalid input: expected number, received string"]]
coerce+default {}    -> {"page":1,"limit":20}
limit "500"          -> "Too big: expected number to be <=100"
?sort=a&sort=b       -> "Invalid input: expected string, received array"
```

That last line is the one people forget: a repeated query key produces an **array**, so
every query field is `string | string[]` until a schema decides which.

## What it costs

200 000 parses of the same four-field object, then 20 000 failing ones:

```console
zod parse         212.8 ms / 200k = 1.06 µs      all valid     0.7 µs
zod safeParse     207.5 ms / 200k = 1.04 µs      1 bad field  32.0 µs
valibot parse     187.2 ms / 200k = 0.94 µs      4 bad fields 40.3 µs
hand-written if     5.1 ms / 200k = 0.03 µs
```

About a microsecond. A schema on every request is not a performance decision — the
hand-written check is 35× faster and all of that saving is invisible next to one database
round trip.

**Failure is the expensive path**, at **~45× a successful parse**, and the cost is in
*building* the error rather than reading it — never touching `.error` measured the same
598 ms. At 32 µs that is not a crisis, but an attacker's requests are more expensive to
you than to them: an argument for rate limiting the 400s and not only the 200s.

## Three things validation does not do

**It does not bound work already started.** `.max()` on an array runs *after* every
element is parsed — the capped schema was the **slower** of the two:

```console
200k-element array, no .max() -> success: true  | 12.3 ms
same input, .max(20)          -> success: false | 40.5 ms
```

Length limits document intent; the body-size cap is what stops the work.

**It does not authorize.** This schema is valid and this request is a privilege
escalation:

```js
const Patch = z.strictObject({ role: z.enum(['user', 'admin']).default('user') });
Patch.parse({ role: 'admin' });        // -> { role: 'admin' }, perfectly valid
```

Fields the caller may not set are omitted from the schema entirely and applied
server-side, not validated.

**It does not make the value safe to interpolate.** A validated string is still a string:
SQL needs parameters ([page 08](./08-injection.md)), HTML needs escaping at output
([page 09](./09-xss.md)), paths need resolution ([page 10](./10-path-traversal.md)), URLs
need the SSRF checks ([page 12](./12-ssrf.md)). Validation narrows the input space; it
does not change what the sink requires.

## Reporting errors without leaking

`z.flattenError` is the right shape for a JSON API — `fieldErrors` maps onto form fields;
`z.prettifyError` is for logs and CLIs, not responses. One trap: **unrecognized keys land
in `formErrors`, not `fieldErrors`**, because their path is empty.

```console
flatten (bad fields) -> {"email":["Invalid email address"],"age":["Too small: expected >=18"]}
flatten (strict)     -> {"formErrors":["Unrecognized key: \"isAdmin\""],"fieldErrors":{}}
```

That is why the strict rejection above returned `"fields":{}` — a response that says
nothing. Send both halves, or handle `unrecognized_keys` yourself. And write your own
messages for anything security-relevant: a custom `.refine()` that reports *why* a value
failed can turn a login form into the enumeration oracle from
[page 16](./16-timing-attacks.md).

## zod or valibot

Same job, same defaults — valibot strips unknown keys too and measured marginally faster.
The difference is shape: valibot is a tree-shakeable function library
(`v.pipe(v.string(), v.email())`), so unused validators stay out of a bundle shared with
the browser; zod is a fluent builder with a larger ecosystem. **Pick one and use it on
every boundary** — the expensive failure mode is a codebase with three conventions and
four routes that skipped all of them.

## Gotchas

**Symptom:** A field the API never documented is being written to the database
**Cause:** The raw body is passed to the model; `looseObject`/`passthrough`, or no schema at all.
**Fix:** `z.strictObject`, and omit server-controlled fields from the schema entirely.

**Symptom:** `?flag=false` behaves as true
**Cause:** `z.coerce.boolean()` is `Boolean()` — `"false"` is a non-empty string. Verified.
**Fix:** `z.enum(['true','false']).transform(s => s === 'true')`.

**Symptom:** Empty query parameters silently become `0`, or a field arrives as an array
**Cause:** `Number("")`, `Number([])` and `Number(null)` are all `0`; and a repeated query key parses to an array.
**Fix:** `.min(1)` where zero is illegal, `z.string().regex(/^\d+$/)` before coercion, and decide per field whether an array is allowed.

**Symptom:** The API returns 400 with an empty `fields` object
**Cause:** `unrecognized_keys` has an empty path, so `flattenError` files it under `formErrors`.
**Fix:** Send `formErrors` as well, or map `unrecognized_keys` yourself.

**Symptom:** The event loop stalls under load even though every request is rejected
**Cause:** `JSON.parse` runs before the schema — 40.7 ms for a 20 MB body, measured.
**Fix:** Cap the body while reading it, before parsing. The schema is the second line.

**Symptom:** A schema was added and prototype pollution still got through
**Cause:** `z.record`/`.catchall` keep attacker-chosen keys; `constructor` survived, verified.
**Fix:** Keep the [page 13](./13-prototype-pollution.md) defences; a schema narrows the door, it does not close it.

## Interview questions

**★ What does "parse, don't validate" mean in practice?**
A validator returns a boolean and leaves you holding the untrusted object; a parser
returns a new, typed value and the untrusted version stops existing. It removes the drift
between the check and the use — after `const user = Schema.parse(body)` there is no path
that reaches the handler with an unchecked field.

**★ In what order do the checks at an HTTP boundary run, and why?**
Content-type, size cap, `JSON.parse`, schema. The cap comes before parsing because
parsing is where the cost is — 40.7 ms of blocked event loop for a 20 MB body, versus
0.002 ms to reject it at 1 KB. A schema cannot defend against a payload it has not
received.

**★ How does a schema stop mass assignment, and where does it fail?**
`z.object()` strips unknown keys and `z.strictObject()` rejects them, so `isAdmin: true`
never reaches the model. It fails when the privileged field *is* in the schema —
`role: z.enum(['user','admin'])` is a perfectly valid escalation. Fields the caller may
not set are omitted, not validated.

**★ What is wrong with `z.coerce.number()` on a query parameter?**
It is `Number()`, which accepts more than you mean: `""`, `[]` and `null` all become `0`,
and `"0x10"` becomes 16 — verified. Where `0` is meaningful that is invented data. And
`z.coerce.boolean()` maps `"false"` to `true`.

**Is per-request validation a performance concern?**
No. Measured 1.06 µs per parse; a hand-written check is 0.03 µs and the difference is
invisible against one database call. Rejections cost ~45× a success (32 µs) because
building the error is the expensive part — a reason to rate-limit failing requests, not a
reason to skip the schema.

**Does validating input mean you can interpolate it safely?**
No. A validated string is still a string: SQL needs parameters, HTML needs output
encoding, paths need resolution, URLs need the SSRF checks. Validation reduces the input
space; the sink's rule is unchanged. Nor does it authorize — the choice of *which fields
exist in the schema* is the access-control decision.

---

← Prev: [Timing attacks](./16-timing-attacks.md) · Next → Secrets handling *(being written)*
