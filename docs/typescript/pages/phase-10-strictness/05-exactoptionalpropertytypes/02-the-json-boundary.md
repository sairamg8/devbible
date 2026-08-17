---
title: "The JSON boundary and the three states"
sidebar_label: "02 · The JSON boundary"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **ECMAScript specification's** `JSON.stringify`
> behaviour for `undefined`-valued properties (omitted from object output) and
> `JSON.parse`'s value grammar (which has no `undefined` production), and the
> **compiler's diagnostic table** for `TS2375` / `TS2412`, read rather than
> recalled. The applied `PATCH` case is
> [phase 7's](../../phase-7-server/01-tsconfig-for-a-node-service/04-the-annotated-configs.md),
> cited rather than restated. **No sandbox, no console block.**

The flag's reputation is that it is pedantic. It earns its keep in exactly one
place, and that place is the boundary where your objects turn into JSON and back.

> **`JSON.stringify` cannot represent "present and `undefined`".** The key is
> dropped. So a type that permits explicit `undefined` on a field is claiming a
> distinction the wire physically cannot carry — and the code on the other side
> will read it as "absent" no matter what you meant.

## What the wire can and cannot carry

```js
JSON.stringify({ name: 'Ada' });        // '{"name":"Ada"}'
JSON.stringify({ name: null });         // '{"name":null}'
JSON.stringify({ name: undefined });    // '{}'      ← the key is gone
JSON.stringify({});                     // '{}'
```

And in the other direction, `JSON.parse` has **no way to produce `undefined`** —
the JSON grammar has `null`, and nothing else that maps to it:

```js
JSON.parse('{}').name;                  // undefined  (absent)
JSON.parse('{"name":null}').name;       // null
```

📌 **Put those together and you get the rule.** A parsed request body **never**
contains an explicitly-`undefined` property. It can only be absent, `null`, or a
value. So a type describing a request body that permits `name: undefined` is
describing a state that cannot arrive — and permitting it is precisely what
hides the state that *can*.

## The three states, and why two is not enough

Any field on an update payload has three meaningful client intents:

| Intent | Wire form | Type |
|---|---|---|
| **Do not change this** | key absent | the `?` |
| **Clear this** | `"name": null` | `null` in the union |
| **Set it to this** | `"name": "Ada"` | the value type |

Which gives the shape:

```ts
interface UserPatch {
  name?: string | null;   // absent = leave · null = clear · string = set
}
```

🔴 **Without the flag you cannot write this type honestly.** `name?: string |
null` also silently admits `name: undefined`, which is a fourth state with no
wire representation and no defined meaning — and every handler that does
`if (patch.name !== undefined)` will treat it as "do not change" while every
handler that does `if ('name' in patch)` will treat it as "change to
`undefined`". Two reasonable readings of the same object, disagreeing.

With the flag, `name?: string | null` means exactly three states, and the
compiler enforces that nothing constructs a fourth.

## The data-loss bug this prevents

A `PATCH` handler that cannot tell "leave it" from "clear it" either ignores
deletions or performs them by accident. Both are data bugs, not cosmetic ones,
and the second is unrecoverable.

[Phase 7 · the annotated configs](../../phase-7-server/01-tsconfig-for-a-node-service/04-the-annotated-configs.md)
argues that case **in context**, with the config that turns it on for a real
service. This page owns the general rule; that page owns the applied one. The
short version of the applied case is that `{ name?: string }` with the flag off
makes `PATCH /users/1` with body `{}` and body `{"name":null}` arrive as
indistinguishable objects once a middleware has normalised them — and the
normalisation that does the damage is almost always an innocent-looking spread.

## Detecting the state, in the right order

Once the type is honest, the handler is mechanical:

```ts
function applyPatch(user: User, patch: UserPatch): User {
  const next = { ...user };
  if ('name' in patch) {              // present at all?
    next.name = patch.name ?? undefined;   // null → cleared
  }
  return next;
}
```

Three details in four lines, all load-bearing:

- **`'name' in patch`, not `patch.name !== undefined`.** The `in` check is the
  only one that answers "did the client mention this field". Under the flag the
  two happen to agree — because `undefined` can no longer be present — but the
  `in` form states the intent and survives a later relaxation of the type.
- **`??`, not `||`.** `patch.name || undefined` would also clear the field for
  the empty string, which is a value the client legitimately sent.
- **The three cases are exhaustive**, and the compiler can now prove it, because
  `patch.name` inside the branch is `string | null` with no third member.

⚠️ **`Object.keys(patch)` and `'k' in patch` are not equivalent for a parsed
body** in general — `in` walks the prototype chain. For an object from
`JSON.parse` it is safe (null-prototype-free but with no inherited own data), but
`Object.hasOwn(patch, 'name')` is the precise form and costs nothing.

## Serialising back out

The same asymmetry bites on the response side, and this one is quieter because
nothing errors:

```ts
const dto = { id: u.id, name: u.name };   // name: string | undefined
res.json(dto);                            // key vanishes when undefined
```

The client receives `{"id":"a"}` — no `name` key — even though your DTO type
promised a `name` property was there. **The response's runtime shape does not
match its declared type**, and no flag catches it, because `res.json` accepts
anything.

The flag helps indirectly: with it on, `{ id, name: u.name }` where `name` is
declared optional on the DTO is an error unless you either make the property
required and accept the disappearing key, or build the object conditionally
(which [chunk 03](./03-spread-defaults-and-construction.md) covers). Either way
you are forced to make a decision instead of drifting into one.

📌 **The reliable habit: type your DTOs the way the JSON will actually look.**
If the key can vanish, it is optional. If it must always be present, use `null`
for "no value", never `undefined`. A DTO field typed `string | undefined` and
declared required is a contradiction the wire will resolve against you.

## `null` versus `undefined` as a codebase policy

This flag is what makes the common advice enforceable rather than aspirational:

- **`undefined` means "absent"** — a property not supplied, a value not yet
  computed. It is JavaScript-internal and does not survive serialisation.
- **`null` means "explicitly no value"** — a deliberate empty, chosen by someone,
  and it survives the wire.

Without `exactOptionalPropertyTypes`, that policy is a convention a reviewer has
to police. With it, the type `name?: string` **cannot** hold an explicit
`undefined`, so the only way to express "deliberately empty" is `null`, which is
the policy compiling itself.

⚠️ **Databases add a fourth reading, and it is worth naming.** Most drivers map
SQL `NULL` to JavaScript `null` and a missing column to `undefined`, so a row
object naturally has both. A `Partial<Row>` from an ORM under this flag will
reject `{ name: undefined }`, which is often exactly the object the ORM builds
internally — see [chunk 04](./04-living-with-it.md) on third-party types.

## Gotchas

**Symptom:** a `PATCH` request silently clears a field the client never sent.
**Cause:** "absent" and "explicitly `undefined`" collapsed into one type, then a
spread or `Object.assign` wrote the `undefined` over the stored value.
**Fix:** the flag, plus modelling clearing as `null` rather than leaning on
optionality. The spread half is [chunk 03](./03-spread-defaults-and-construction.md).

**Symptom:** a response is missing a key the DTO type says is always there.
**Cause:** the property's value was `undefined` and `JSON.stringify` dropped it.
**Fix:** decide which is true. If the key may be missing, the DTO property is
optional. If it must be present, the value must be `null`, not `undefined`.

**Symptom:** `if (patch.name !== undefined)` and `if ('name' in patch)` disagree
about the same request.
**Cause:** the body contains a present-but-`undefined` property — only reachable
if something in your own code put it there, since `JSON.parse` cannot.
**Fix:** find the middleware that built it. This is nearly always a normalising
spread over a partially-filled defaults object.

**Symptom:** a client sends `{"name":null}` and the server stores the string
`"null"`.
**Cause:** a `String(patch.name)` or template-literal coercion on a value the
type said could not be `null`.
**Fix:** put `null` in the type where the wire allows it, and let the compiler
find the coercions.

**Symptom:** the empty string clears a field.
**Cause:** `patch.name || undefined` — `''` is falsy.
**Fix:** `??`, which only falls through on `null` and `undefined`.

**Symptom:** an ORM's own row objects fail to type-check against your interfaces
after enabling the flag.
**Cause:** the ORM constructs `{ col: undefined }` for absent columns, and its
`.d.ts` was written without this flag.
**Fix:** you cannot change their types; type your own boundary. Map the row into
your domain type in one place and let that function absorb the difference.

**Symptom:** `structuredClone` of a "clean" object still carries the key.
**Cause:** `structuredClone` preserves explicitly-`undefined` properties; only
`JSON` round-tripping removes them.
**Fix:** if you were relying on a clone to normalise, use a JSON round trip
deliberately, or build the object without the key in the first place.

## Interview questions

**Why does this flag matter more at an API boundary than anywhere else?**
Because `JSON.stringify` omits `undefined`-valued keys and `JSON.parse` cannot
produce `undefined` at all. So a type permitting explicit `undefined` at the
boundary is describing a state the wire cannot represent, and the two sides of
the call will disagree about what an absent key meant. The flag removes the
unrepresentable state from the type.

**How do you model "leave unchanged", "clear", and "set" in one payload type?**
`field?: T | null` — absent means leave it, `null` means clear it, a value means
set it. This only works with `exactOptionalPropertyTypes` on; without it the
type also admits `undefined`, giving a fourth state that different handlers
interpret differently.

**Which check should a `PATCH` handler use to decide whether a field was
supplied, and why?**
`Object.hasOwn(patch, 'field')` or `'field' in patch` — a presence check, not a
value check. `patch.field !== undefined` conflates "not supplied" with
"supplied as undefined", which is the exact ambiguity being fixed. With the flag
on the two agree, but the presence check states the intent and does not silently
change meaning if the type is later relaxed.

**A response DTO declares `name: string` as required but the client receives no
`name` key. What happened?**
The value was `undefined` at serialisation time and `JSON.stringify` dropped the
key. The declared type and the runtime shape disagreed, and nothing checked it
because `res.json` accepts any value. Either the property is genuinely optional
or the empty case should be `null`.

**Why prefer `null` over `undefined` for "no value" in a serialised type?**
Because `null` survives serialisation and `undefined` does not. A field that
must always appear in the JSON, and sometimes has no value, has to be `null` —
there is no other option. Reserving `undefined` for "absent" makes the two words
mean different things consistently, and this flag is what makes that policy
enforceable rather than a convention.

**Can a body produced by `JSON.parse` ever contain a present-but-`undefined`
property?**
No. The JSON grammar has no `undefined`, so the parsed object's values are
strings, numbers, booleans, `null`, arrays and objects. Any explicit `undefined`
you find in a request body was put there by your own code after parsing —
usually by a defaults-merging spread.

---

← [01 · Absent vs undefined](./01-absent-versus-undefined.md) · Next → [03 · Spread, defaults and construction](./03-spread-defaults-and-construction.md)
