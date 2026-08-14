---
title: "04.2 · URLSearchParams"
sidebar_label: "02 · URLSearchParams"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams), [`URLSearchParams()` constructor](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams/URLSearchParams), [`URLSearchParams.get()`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams/get), [`URLSearchParams.getAll()`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams/getAll), [`URL.searchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URL/searchParams). Documentation-validated.

MDN's own summary is exactly right:

> "The **`URLSearchParams`** interface defines utility methods to work with the query string of a
> URL."

**The thing to internalise is that a query string is a multimap, not an object.** `?tag=a&tag=b`
is legal and meaningful, and every API that models it as a plain object loses one of the values.

## Four ways to build one

```js
new URLSearchParams("?status=open&page=2");           // a string (leading ? is fine)
new URLSearchParams({ status: "open", page: 2 });     // an object
new URLSearchParams([["tag", "a"], ["tag", "b"]]);    // pairs — the only form that repeats a key
new URLSearchParams(existingParams);                   // a copy
```

MDN on the string form:

> "The `URLSearchParams` constructor does *not* parse full URLs. However, it will strip an
> initial leading `?` off of a string, if present."

🔴 **"Does not parse full URLs"** is the trap. `new URLSearchParams("https://x.test/?a=1")`
does not give you `a=1` — it treats the whole thing as one giant key. Pass `url.search`, or use
`url.searchParams`, never the full URL.

🔴 **The object form cannot express duplicate keys**, because an object cannot have two of the
same key. Use the array-of-pairs form when repetition matters — and note that `{ tag: ["a","b"] }`
does *not* do what you want either: values are stringified, producing `tag=a%2Cb`, one key whose
value is the string `"a,b"`. That is the single most common `URLSearchParams` surprise.

Values are stringified in general, which is usually convenient (`page: 2` → `page=2`) and
occasionally not: `undefined` becomes the literal string `"undefined"`, and `null` becomes
`"null"`. Filter those out before constructing.

## Reading — `get` versus `getAll`

```js
const params = new URLSearchParams("tag=a&tag=b");

params.get("tag");        // "a"      — MDN: "the first value"
params.getAll("tag");     // ["a", "b"]
params.get("missing");    // null     — not undefined, not ""
params.has("tag");        // true
params.has("tag", "b");   // true     — the two-argument form checks key AND value
```

MDN:

> "`get()`: Returns the **first** value associated with the given search parameter."

> "`getAll()`: Returns **all** the values associated with a given search parameter."

⚠️ **`get()` returning `null` for a missing key, and `""` for `?flag=`, are different states** —
and both are falsy. `params.get("flag") === ""` means the key was present with an empty value;
`null` means it was absent. Code that tests truthiness collapses the two, which is how "the
filter clears itself when you empty the box" bugs happen. Test with `has()` when presence is the
question.

## Writing — `set` versus `append`

> "`set()`: Sets the value associated with a given search parameter to the given value. **If
> there are several values, the others are deleted.**"

> "`append()`: Appends a specified key/value pair as a new search parameter."

```js
const params = new URLSearchParams("tag=a&tag=b");

params.set("tag", "c");       // tag=c            — the other two are gone
params.append("tag", "d");    // tag=c&tag=d
params.delete("tag");         // removes ALL values for the key
params.delete("tag", "c");    // two-arg form: removes only that pair
```

**`set` is what you want when a control owns a parameter** — a page selector, a sort order, a
single-select filter. **`append` is for genuinely repeatable ones** — a multi-select tag list,
several `id`s.

🔴 **The rebuild-from-scratch bug:** code that calls `append` in a loop each time a filter
changes, without clearing first, accumulates
`?tag=a&tag=a&tag=a&tag=b`. Either `delete` the key before appending, or rebuild the whole
`URLSearchParams` from the current state — the second is usually simpler and always correct.

## Iteration and ordering

`URLSearchParams` is iterable, and yields `[key, value]` pairs **in insertion order**, with
duplicates preserved:

```js
for (const [key, value] of params) …
params.forEach((value, key) => …);       // note: value first, like Map
[...params.keys()], [...params.values()], [...params.entries()];
Object.fromEntries(params);              // ⚠️ lossy — later duplicates win
```

⚠️ **`Object.fromEntries(params)` throws away duplicates.** It is a fine shortcut for a query
string you control and a silent data-loss bug for one you do not. If a parameter can repeat, keep
the params object or use `getAll`.

**`sort()`** — MDN: *"Sorts all key/value pairs, if any, by their keys."* Useful for producing a
canonical form: cache keys, request signatures, or deduplicating URLs that differ only in
parameter order. It sorts by key only, so the relative order of values under one key is
preserved.

**`size`** gives the number of pairs, counting duplicates separately.

## The live link with `URL`

```js
const url = new URL("https://api.example.com/orders?status=open");

url.searchParams.set("page", "2");
url.searchParams.append("tag", "urgent");

String(url);   // https://api.example.com/orders?status=open&page=2&tag=urgent
```

🔴 **`url.searchParams` mutates the URL.** MDN describes it as *"A `URLSearchParams` object which
can be used to access the individual query parameters found in `search`"*, and the property is
**read-only** — you cannot assign a new one:

```js
url.searchParams = new URLSearchParams("a=1");   // ❌ silently does nothing (throws in strict mode)
url.search = "?a=1";                             // ✅ this is the way to replace the query wholesale
```

That asymmetry — mutate through it, but assign to `search` to replace it — is worth remembering,
because the failing assignment is *silent* in sloppy mode and looks like it worked.

The reverse direction also holds: assigning to `url.search` updates what `url.searchParams`
reports. They are two views of the same state, not two copies.

## Building a query without a URL

```js
const query = new URLSearchParams({ q: term, page: String(page) });
const href  = `/search?${query}`;          // template literal calls toString()
```

`toString()` returns the query **without** a leading `?` — which is why the `?` is written by
hand above, and why appending `url.search` (which *includes* the `?`) to a string that already
has one produces `??`.

For a request body, the same object is a `Content-Type: application/x-www-form-urlencoded` body
with no header needed — [02 · Choosing a body](../02-request-bodies/01-choosing-a-body.md). Same
object, same encoding rules, two destinations.

## Gotchas

**Symptom:** `new URLSearchParams(fullUrl)` yields one nonsense key
**Cause:** MDN: *"The `URLSearchParams` constructor does not parse full URLs."*
**Fix:** Pass `url.search`, or use `url.searchParams`.

**Symptom:** `?tag=a%2Cb` instead of two `tag` parameters
**Cause:** An array value in the object form is stringified — `["a","b"]` becomes `"a,b"`.
**Fix:** Use the array-of-pairs form, or `append` in a loop.

**Symptom:** A parameter's value is the literal string `"undefined"`
**Cause:** Values are stringified, including `undefined` and `null`.
**Fix:** Filter empty values out before constructing.

**Symptom:** Only the first of several repeated parameters is read
**Cause:** `get()` returns the first value only.
**Fix:** `getAll()`.

**Symptom:** An empty filter is treated as an absent one
**Cause:** `get()` returns `""` for `?flag=` and `null` when absent — both falsy.
**Fix:** Use `has()` when presence is the question.

**Symptom:** Parameters accumulate on every filter change
**Cause:** `append` in a loop with no clear step.
**Fix:** `set`, or `delete` first, or rebuild the params object from state.

**Symptom:** Duplicate parameters vanish after `Object.fromEntries(params)`
**Cause:** An object cannot hold two identical keys; later values overwrite earlier ones.
**Fix:** Keep the params object, or use `getAll` for the repeatable keys.

**Symptom:** Assigning `url.searchParams = …` has no effect
**Cause:** It is a read-only property. The assignment is silent in sloppy mode.
**Fix:** Assign to `url.search`, or mutate through `url.searchParams`.

**Symptom:** A URL ends up with `??`
**Cause:** `url.search` already carries the `?`, while `params.toString()` does not.
**Fix:** Pick one and be consistent — `` `?${params}` `` or `url.search`.

**Symptom:** Two URLs that should hash identically do not
**Cause:** The parameters are in a different order.
**Fix:** `params.sort()` before serialising — MDN: *"Sorts all key/value pairs, if any, by their
keys."*

## Interview questions

**★ Why is a query string a multimap rather than an object?**
Because `?tag=a&tag=b` is legal and meaningful — repeated keys are how multi-select filters are
expressed. `get()` returns only the first value; `getAll()` returns all of them; and converting to
a plain object silently drops the rest.

**★ `new URLSearchParams({ tag: ["a", "b"] })` — what do you get?**
`tag=a%2Cb`. Values are stringified, so the array becomes the string `"a,b"` under one key. Use
the array-of-pairs form for repeated keys.

**★ `set` or `append`?**
`set` replaces every existing value for that key — MDN: *"If there are several values, the others
are deleted"* — which is what a page selector or sort control wants. `append` adds another value,
for genuinely repeatable parameters. Using `append` where `set` belongs makes parameters
accumulate on every interaction.

**★ How do you tell `?flag=` from an absent `flag`?**
`get()` returns `""` for the first and `null` for the second, and both are falsy. Use `has()`
when presence is the question.

**★ Does `url.searchParams.set(...)` change the URL?**
Yes — it is a live view, and mutating it reserialises `url.search` and `url.href`. But the
property itself is read-only: assigning a new `URLSearchParams` to it does nothing. Assign to
`url.search` to replace the query wholesale.

**★ Why does `params.toString()` have no `?` but `url.search` does?**
`search` is defined as including its leading `?`; `toString()` serialises only the pairs. Mixing
them is how a URL ends up with `??`.

**When is `sort()` useful?**
Canonicalisation — cache keys, request signatures, deduplicating URLs that differ only in
parameter order. It sorts by key and leaves the order of values within a key intact.

---

← [01 · The URL object](./01-the-url-object.md) · [Topic index](./README.md) ·
Next → [03 · Encoding rules](./03-encoding-rules.md)
