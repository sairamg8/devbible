---
title: "1 · Reading a shape you did not define"
sidebar_label: "1 · Reading it safely"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [Optional chaining `?.`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining), [Nullish coalescing `??`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing), [Nullish coalescing assignment `??=`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing_assignment), [Logical OR `||`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Logical_OR), [Destructuring assignment](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment), [`Object.hasOwn()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwn), [`JSON.parse()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse). Documentation-validated; **no timings**.

A payload from an API, a config file, a query string, `localStorage` — none of it is a shape you
declared, and all of it will eventually arrive with a field missing, `null`, or the wrong type.
This chunk is about reading it without crashing. [Chunk 2](./02-normalising-at-the-boundary.md) is
about only having to do that once.

## `?.` short-circuits the whole chain, and that is the point

```js
const city = response?.user?.address?.city;
```

If **any** link is `null` or `undefined`, evaluation stops and the entire expression is
`undefined` — it does not continue and throw further right. All three forms exist:

```js
obj?.prop        // property
obj?.[key]       // computed key
obj.method?.()   // call, only if `method` exists
```

That last one is worth its own note: `obj.method?.()` calls the method **only if it is not
nullish**, which is how you invoke an optional callback without a wrapping `if`. ⚠️ It still throws
if `method` exists but is not a function — the check is for nullish, not for callable.

### The trap: `?.` protects one link, not the rest

```js
const a = { b: undefined };
a?.b.c;    // 🔴 TypeError: Cannot read properties of undefined (reading 'c')
```

`a` exists, so the chain does not short-circuit; then `.c` is read off `undefined`. **The `?.` has
to be at every link that can be missing** — `a?.b?.c`. The error message names `c`, which sends
people looking at the wrong property.

⚠️ **Parentheses break the short-circuit.** `(a?.b).c` throws even when `a` is nullish, because the
grouping ends the chain before `.c` is applied.

## `??` versus `||` — the difference is `0` and `""`

```js
const port    = config.port ?? 3000;      // ✅ 0 stays 0
const portBad = config.port || 3000;      // 🔴 0 becomes 3000
```

`||` falls back on every falsy value — `0`, `""`, `NaN`, `false`. `??` falls back only on `null`
and `undefined`. **For anything numeric, boolean, or a string that may legitimately be empty, `||`
is a bug waiting for the day a user enters zero.**

```js
const label = user.displayName ?? "";      // "" if truly absent
const count = stats.errors ?? 0;           // 0 is a real count, not "missing"
const flag  = settings.darkMode ?? true;   // false is a real choice, not "unset"
```

That last line is the one that matters most: **`settings.darkMode || true` can never be `false`**,
so the user's explicit "off" is silently ignored.

🔴 **Mixing `??` with `||` or `&&` without parentheses is a `SyntaxError`**, not a precedence
surprise:

```js
a || b ?? c;      // 🔴 SyntaxError
(a || b) ?? c;    // ✅ fine — say which you mean
```

The language refuses to guess, deliberately. The logical assignment forms follow the same split:
`??=` assigns only when the target is nullish, `||=` when it is falsy.

## Destructuring defaults fire on `undefined` only

```js
const { retries = 3, timeout = 1000 } = options;
```

⚠️ **A default does not fire for `null`.** And `null` is exactly what a JSON payload sends for an
absent field, because **JSON has no `undefined`**:

```js
const { retries = 3 } = JSON.parse('{"retries": null}');
retries;   // 🔴 null, not 3
```

So at an API boundary, destructuring defaults are the wrong tool and `??` is the right one — the
same conclusion reached from the other direction in
[Phase 3 · 17 · `null`, `undefined` and the API boundary](../../phase-3-functions/17-closure-and-default-gotchas/01-null-undefined-and-the-api-boundary.md).

### Nested destructuring throws on a missing parent

```js
const { user: { name } } = {};   // 🔴 TypeError: Cannot destructure property 'name' of 'undefined'
```

The fix is a default at **every** level you destructure through:

```js
const { user: { name = "anonymous" } = {} } = payload ?? {};
```

⚠️ **That gets unreadable fast**, and the unreadability is a signal. Two or more levels of
defaulted nested destructuring means the shape should be normalised first — which is
[chunk 2](./02-normalising-at-the-boundary.md).

## "Missing" is three different states, and PATCH cares

| The field is | JSON sends | Means |
|---|---|---|
| absent | key not present | *do not change it* |
| explicitly cleared | `null` | *set it to nothing* |
| present | a value | *set it to this* |

`?? fallback` collapses the first two, which is right when **rendering** and wrong when **writing**.
For an update payload, test presence instead:

```js
if (Object.hasOwn(patch, "nickname")) user.nickname = patch.nickname;   // null clears it
```

🔴 **Use `Object.hasOwn`, not `key in obj` and not `obj[key] !== undefined`.** `in` walks the
prototype chain and so returns `true` for `"toString"`; the `!== undefined` test cannot tell an
absent key from one explicitly set to `undefined`. See
[03 · Existence checks and `delete`](../03-existence-checks-and-delete/README.md).

## Parsing is the first thing that can fail

```js
let data;
try {
  data = JSON.parse(raw);
} catch {
  data = null;      // malformed input is a normal event, not an exception to propagate
}
```

`JSON.parse` throws a `SyntaxError` on anything malformed — an HTML error page returned with a
`200`, a truncated response, an empty body. ⚠️ **`JSON.parse("null")` succeeds and returns `null`**,
so a successful parse still guarantees nothing about the shape.

**The optional-catch-binding form (`catch {}`) is the honest one** when you do not use the error.

## What optional chaining does *not* solve

`?.` stops a crash. It does not give you a value you can use:

```js
const total = order?.items?.length ?? 0;
const names = order?.items?.map((i) => i.name) ?? [];   // ✅ every branch returns an array
```

Without the `?? []` the caller gets `undefined` and the crash simply moves one line down. **A chain
of `?.` with no fallback pushes the failure downstream rather than handling it** — which is the
strongest argument for normalising once, at the edge, instead of defending at every read.

## Gotchas

**Symptom:** `TypeError: Cannot read properties of undefined (reading 'c')` despite using `?.`
**Cause:** The `?.` was on an earlier link; a later one was the nullish part.
**Fix:** `a?.b?.c`. The error names the property being read, not the one that was missing.

**Symptom:** A configured `0`, `""` or `false` is being replaced by the default
**Cause:** `||` falls back on every falsy value.
**Fix:** `??`. This is the single most common bug in options handling.

**Symptom:** `SyntaxError` on a line mixing `??` and `||`
**Cause:** The language forbids the combination without parentheses rather than guessing precedence.
**Fix:** Parenthesise the half you mean.

**Symptom:** A destructuring default did not apply
**Cause:** The value was `null`, and defaults fire only on `undefined`. JSON has no `undefined`.
**Fix:** `??` after destructuring, or normalise the payload first.

**Symptom:** `TypeError: Cannot destructure property 'x' of 'undefined'`
**Cause:** Nested destructuring through a parent that is missing.
**Fix:** A default at every level — and if that takes more than one, normalise instead.

**Symptom:** A PATCH request clears a field the user never touched
**Cause:** `?? ` collapsed "absent" and "explicitly null" into one case.
**Fix:** `Object.hasOwn(patch, key)` to test presence, and treat `null` as a real value.

**Symptom:** `"toString" in payload` is `true` on an object that has no such field
**Cause:** `in` walks the prototype chain.
**Fix:** `Object.hasOwn`.

**Symptom:** `JSON.parse` threw on a `200 OK` response
**Cause:** The body was an HTML error page or was truncated.
**Fix:** Wrap it in `try/catch` and treat malformed input as an ordinary outcome.

## Interview questions

**★ What is the difference between `??` and `||`?**
`||` falls back on any falsy value — `0`, `""`, `NaN`, `false`; `??` falls back only on `null` and
`undefined`. For numbers, booleans and strings that may legitimately be empty, `||` silently
overrides real values. `settings.darkMode || true` can never be `false`.

**★ Does `a?.b.c` throw if `b` is undefined?**
Yes. Optional chaining short-circuits only when the link it is attached to is nullish. `a` exists,
so evaluation continues and `.c` is read off `undefined`. Every link that can be missing needs its
own `?.`.

**★ Why do destructuring defaults not help with API responses?**
They fire only on `undefined`, and JSON has no `undefined` — an absent field arrives as `null`. So
`const { retries = 3 } = json` leaves `retries` as `null`. Use `??`, or normalise the payload before
destructuring it.

**★ How do you tell "field absent" from "field explicitly set to null"?**
`Object.hasOwn(obj, key)`. It matters for PATCH semantics: absent means leave it alone, `null` means
clear it. Any `?? ` or truthiness test collapses the two. Do not use `in` (it walks the prototype
chain) or `!== undefined`.

**★ What does optional chaining not solve?**
It prevents the crash but produces `undefined`, which usually crashes one line later. A safe read
needs a fallback that keeps the type — `?? 0`, `?? []`, `?? ""` — and needing them everywhere is the
signal to normalise at the boundary instead.

**Why is mixing `??` and `||` a SyntaxError?**
Because the precedence is genuinely ambiguous to a reader, and the committee chose to require
explicit parentheses rather than pick a rule people would misremember.

**What does `obj.method?.()` do?**
Calls the method only if it is not `null` or `undefined` — the idiomatic way to invoke an optional
callback. It still throws if the property exists but is not callable; the guard is about nullish,
not about callability.

---

← [Topic index](./README.md) · [Phase index](../README.md) · Next: [2 · Normalising at the boundary](./02-normalising-at-the-boundary.md) →
