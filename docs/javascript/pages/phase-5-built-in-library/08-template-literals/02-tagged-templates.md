---
title: "2 · Tagged templates"
sidebar_label: "2 · Tagged templates"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals) (tagged templates and raw strings), [`String.raw()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/raw), [`Array.prototype.reduce()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce), [`RegExp`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp), [`Object.isFrozen()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/isFrozen). Documentation-validated; **no timings**.

**A tag is a function called with the template's pieces instead of its result.**

```js
function tag(strings, ...values) {
  return { strings: [...strings], values };
}

const a = 1, b = 2;
tag`sum of ${a} and ${b}!`;
// strings: ["sum of ", " and ", "!"]     ← the literal text, split at the holes
// values:  [1, 2]                        ← the evaluated expressions
```

**`strings.length` is always `values.length + 1`.** The text alternates with the values, starting
and ending with text — empty strings fill in when a template starts or ends with a hole.

Rebuilding the default behaviour makes the shape obvious:

```js
const identity = (strings, ...values) =>
  strings.reduce((out, s, i) => out + s + (i < values.length ? values[i] : ""), "");
```

🔴 **The reason the feature exists: a tag sees the seam between literal text and interpolated
value.** Plain interpolation destroys that distinction — by the time you have the string, "which
part came from the user" is unanswerable. Every real use below is that one property.

## Safe interpolation, which plain templates cannot do

```js
const rows = await sql`SELECT * FROM users WHERE email = ${email}`;
```

A `sql` tag can emit `SELECT * FROM users WHERE email = $1` with `[email]` as parameters, because it
knows `email` arrived through a hole and the rest is trusted text. **The injection is impossible by
construction**, not by remembering to escape.

The same shape gives HTML escaping:

```js
const html = (strings, ...values) =>
  strings.reduce((out, s, i) => out + s + (i < values.length ? escapeHtml(values[i]) : ""), "");

el.innerHTML = html`<div>${userInput}</div>`;   // ✅ the value is escaped, the markup is not
```

⚠️ **The tag is doing the work, not the syntax.** `` html`…` `` is safe only because that function
escapes; an untagged template with the same content is still an XSS hole
([chunk 1](./01-interpolation-and-multiline.md)).

## `.raw` — the escapes as written

The strings array carries a `raw` property holding the text **before** escape processing:

```js
function show(strings) {
  return [strings[0], strings.raw[0]];
}
show`a\nb`;    // ["a\nb" (a real newline), "a\\nb" (backslash, n)]
```

`String.raw` is the built-in tag that just returns the raw text:

```js
String.raw`C:\Users\new`;   // "C:\Users\new" — \U and \n are literal
`C:\Users\new`;             // 🔴 \n became a newline
```

**Two places it earns its keep**: Windows paths, and regex sources built as strings, where the
alternative is doubling every backslash. ⚠️ **`String.raw` still interpolates `${}`** — it only
disables backslash escapes, so it is not a "literal everything" mechanism.

## The strings array is frozen, and cached per call site

```js
function tag(strings) { return strings; }
const first = tag`hello`;
const second = tag`hello`;   // same call site, evaluated again
first === second;            // true
Object.isFrozen(first);      // true
```

**The template object is created once per source location and reused on every evaluation.** That is
a specified guarantee, and libraries lean on it: a GraphQL or CSS tag can use the array itself as a
`WeakMap` key and skip re-parsing on the second call — the parse result is cached against the
template, not against the produced string.

⚠️ **Two identical templates in different places are different objects.** The cache is per call
site, not per content.

## Where you will meet tags in the wild

| Tag | What it does with the seam |
|---|---|
| `` styled.div`…` `` (styled-components, Emotion) | interpolates functions of `props`, generates a class name |
| `` gql`…` `` | parses the query once and caches it against the frozen strings array |
| `` sql`…` `` | emits placeholders and a parameter array — injection-proof by construction |
| `` html`…` `` (lit) | caches the static parts, updates only the holes on re-render |
| `` i18n`…` `` | uses the literal parts as a lookup key, values as substitutions |

**Writing one is easy; the judgement is whether it should exist.** A tag makes ordinary-looking
syntax behave in a way nothing at the call site explains — the same objection as monkey-patching in
[Phase 4 · 16](../../phase-4-objects-and-classes/16-prototype-patterns-to-avoid/01-extending-and-patching.md).
It is worth it when the tag provides a *guarantee* (escaping, parameterisation, caching) and not
worth it as a way to make a helper call look clever.

**One tag worth writing yourself** is `dedent`, which fixes the whitespace trap from chunk 1 by
stripping the *common* indent rather than all of it — that is the version an indented literal
actually needs.

## Gotchas

**Symptom:** `strings.length` and `values.length` differ by one and the loop went out of bounds
**Cause:** That is the invariant — text alternates with values, starting and ending with text.
**Fix:** Iterate `strings` and guard the value index, as in the `identity` reduce above.

**Symptom:** A tagged template lost a backslash sequence
**Cause:** `strings[i]` is the *cooked* text, with escapes processed.
**Fix:** `strings.raw[i]`.

**Symptom:** `String.raw` still substituted a value
**Cause:** It disables backslash escapes only; `${}` interpolation is untouched.
**Fix:** Escape the `${` as `\${` if it must be literal.

**Symptom:** A cache keyed on the strings array missed every time
**Cause:** The array is cached per call site — two identical templates elsewhere are different objects.
**Fix:** Expected. Key on the array only for per-site caching.

**Symptom:** Assigning to `strings[0]` did nothing
**Cause:** The template object is frozen.
**Fix:** Build a new array.

**Symptom:** An `html` tag did not prevent XSS
**Cause:** The escaping is the tag's job; a tag that only concatenates provides no protection.
**Fix:** Escape every interpolated value inside the tag, and never the literal parts.

**Symptom:** A tagged template made the code harder to follow
**Cause:** The behaviour is invisible at the call site.
**Fix:** Use one where it buys a guarantee — escaping, parameterisation, caching — not for cleverness.

## Interview questions

**★ What arguments does a template tag receive?**
The array of literal string pieces first, then each interpolated value as a separate argument.
`strings.length === values.length + 1` always, because the text alternates with the values and both
ends are text.

**★ What can a tagged template do that plain interpolation cannot?**
See which parts came from the source and which came from a value. That distinction is destroyed the
moment the string is built, and it is what lets a `sql` tag parameterise, an `html` tag escape only
the values, and a `gql` tag cache the parse.

**★ What is `strings.raw`?**
The literal text before escape processing — `` String.raw`a\nb` `` keeps a backslash and an `n`
where the cooked version has a newline. Useful for Windows paths and regex sources. It still
performs `${}` interpolation.

**★ Is the strings array new on every call?**
No. The template object is created once per call site and reused on every evaluation, and it is
frozen. Libraries use it as a `WeakMap` key to cache a parse against that specific template. Two
identical templates in different files are still different objects.

**★ Does using a tag make interpolation safe?**
Only if the tag makes it safe. The syntax provides the seam; the function has to escape or
parameterise. `` html`<div>${input}</div>` `` is safe only because that particular `html` escapes
its values.

**When is writing a tag a bad idea?**
When it does not provide a guarantee. A tag makes ordinary syntax behave in a way nothing at the call
site explains, so it should be earning escaping, parameterisation or caching — not just making a
helper call look neat.

---

← [1 · Interpolation and multiline](./01-interpolation-and-multiline.md) · [Topic index](./README.md) · [Phase index](../README.md) →
