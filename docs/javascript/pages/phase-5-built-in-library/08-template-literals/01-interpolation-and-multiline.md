---
title: "1 · Interpolation and multiline"
sidebar_label: "1 · Interpolation and multiline"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals), [`String()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/String), [`Symbol.toPrimitive`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/toPrimitive), [`Array.prototype.join()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/join), [`JSON.stringify()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify), [`String.prototype.trim()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/trim). Documentation-validated; **no timings**.

```js
const name = "Ada";
const greeting = `Hi, ${name}!`;
```

**`${}` takes any expression**, not just a variable — a call, a ternary, a nested template, an
`await`. What it does *not* take is a statement: no `if`, no `for`, which is why complex logic ends
up in a helper function or a ternary chain.

```js
`Total: ${items.reduce((n, i) => n + i.price, 0)}`
`${count} item${count === 1 ? "" : "s"}`
`${user ? `Hi ${user.name}` : "Hi there"}`      // nesting is legal, and rarely readable
```

## Every interpolation is a string conversion

`${x}` runs the same **ToPrimitive with the `"string"` hint** covered in
[Phase 4 · 17 · The ToPrimitive protocol](../../phase-4-objects-and-classes/17-tostring-valueof-toprimitive/01-the-toprimitive-protocol.md).
Four consequences you meet constantly:

```js
`${{ a: 1 }}`         // "[object Object]"   — the default toString
`${[1, 2, 3]}`        // "1,2,3"             — Array.prototype.toString joins with commas
`${null} ${undefined}`// "null undefined"    — spelled out, not empty
`${Symbol("id")}`     // 🔴 TypeError: Cannot convert a Symbol value to a string
```

🔴 **`"[object Object]"` in a log or a UI is always this.** The fix is `JSON.stringify(x)` for
debugging, an explicit field for display, or — if the object is yours — a `toString`. And when
logging, prefer passing the object to `console.log` as a separate argument so devtools can format
it, rather than interpolating it into the message.

⚠️ **`null` and `undefined` interpolate as the words `"null"` and `"undefined"`.** A missing value
becomes visible text in the UI rather than nothing, which is why `${user.name ?? ""}` is worth
writing where the value is optional.

## Multiline keeps exactly what you typed

```js
const message = `Dear ${name},

Your order shipped.`;
```

Newlines are literal — no `\n`, no concatenation. **And so is the leading whitespace**, which is the
one real trap:

```js
function render(name) {
  return `
    <div>
      <h1>${name}</h1>
    </div>
  `;
}
```

That string starts with a newline and every line carries the function's indentation. It is harmless
in HTML, and it is **not** harmless in anything whitespace-sensitive — a Markdown block, a YAML
fragment, a snapshot test, a diff, or a hash of the content.

Fixes, in order of how much they cost:

```js
`<div>
  <h1>${name}</h1>
</div>`                                   // ✅ just do not indent the literal

someTemplate.trim()                       // ✅ handles the leading/trailing newline only

const dedent = (s) => s.split("\n").map((l) => l.trimStart()).join("\n");   // ⚠️ crude
```

A real `dedent` strips the **common** indent rather than all of it, which matters when the content
has its own nesting — that is a tagged template, and it is in
[chunk 2](./02-tagged-templates.md).

⚠️ **Escaping in a template literal:** a backtick needs `` \` ``, and a literal `${` needs `\${`.
Backslashes still work as escapes (`\n`, `\t`, `A`) — the raw-string version that turns them
off is `String.raw`, also in chunk 2.

## When a template literal is the wrong tool

**Building HTML from user data.** A template literal escapes **nothing**:

```js
el.innerHTML = `<div>${userInput}</div>`;   // 🔴 XSS — the input can close the tag
```

`textContent` for text, `createElement` for structure, or a framework that escapes for you. This is
the single most consequential thing on the page, and it is covered from the DOM side in **Phase 9 ·
The DOM** *(lane B)*.

**Building SQL from user data.** Same reasoning, different consequence — parameterised queries, or a
SQL tagged template that parameterises for you (chunk 2).

**Long documents.** Anything more than a few lines of structure is a template *file*, or a
component, not a string in the middle of a function.

**A single value.** `` `${x}` `` is a slower-to-read `String(x)`, and if `x` is already a string it
is nothing at all. Reviewers notice.

## Concatenation is not obsolete

```js
`Hi, ${name}`          // ✅ idiomatic for mixed text and values
"Hi, " + name          // fine, and shorter when there is exactly one value
parts.join("")         // ✅ the right tool for an array of pieces
```

Use a template when there is *text around* the value. For assembling many pieces, `join` says what
it means and avoids a chain of `+=`.

## Gotchas

**Symptom:** `"[object Object]"` appears in the UI or a log
**Cause:** An object was interpolated; the default `toString` produced it.
**Fix:** `JSON.stringify(x)`, an explicit field, or pass the object as a separate `console.log` argument.

**Symptom:** The literal words `"null"` or `"undefined"` show up in the interface
**Cause:** Interpolation spells them out rather than producing empty text.
**Fix:** `${value ?? ""}`.

**Symptom:** `TypeError: Cannot convert a Symbol value to a string`
**Cause:** Symbols block implicit string conversion.
**Fix:** `String(sym)`.

**Symptom:** An array interpolated as `"1,2,3"` with no brackets
**Cause:** `Array.prototype.toString` joins with commas.
**Fix:** `JSON.stringify(arr)` or an explicit `join`.

**Symptom:** A generated file or snapshot has unexpected leading whitespace
**Cause:** The literal was indented with the surrounding code, and that indentation is part of the string.
**Fix:** Do not indent the literal, `.trim()` it, or use a dedent tag.

**Symptom:** User input broke out of the markup
**Cause:** Template literals do not escape anything.
**Fix:** `textContent`, `createElement`, or a framework. Never `innerHTML` with interpolated input.

**Symptom:** A `${` needed to appear literally and the parser complained
**Cause:** It starts an interpolation.
**Fix:** `\${`, or `String.raw` if there are many.

## Interview questions

**★ What can go inside `${}`?**
Any *expression* — a call, a ternary, an `await`, another template literal. Not a statement, so `if`
and `for` need a helper function or a ternary. The result is converted to a string using the
`"string"` hint of the ToPrimitive protocol.

**★ Why does interpolating an object give `"[object Object]"`?**
Because the interpolation is a string conversion and `Object.prototype.toString` returns exactly
that. Arrays look different only because `Array.prototype.toString` joins with commas. `Symbol`
throws instead, deliberately.

**★ What is the whitespace trap with multiline templates?**
The literal keeps every character you typed, including the indentation of the surrounding code. It
is invisible in HTML and breaks Markdown, YAML, snapshots and anything hashed. Fix by not indenting
the literal, trimming, or using a dedent tag.

**★ Is a template literal safe for building HTML?**
No. It performs no escaping whatsoever, so interpolating user input into `innerHTML` is an XSS hole.
Use `textContent`, `createElement`, or a framework that escapes. The same reasoning applies to SQL.

**★ When would you not use one?**
For a single value (`` `${x}` `` is just a noisier `String(x)`), for assembling many pieces where
`join("")` reads better, and for long documents that should be a template file or a component
rather than a string inside a function.

**How do you interpolate `null` without printing the word?**
`${value ?? ""}`. Interpolation spells `null` and `undefined` out as text; `??` supplies an empty
string only when the value is genuinely missing.

---

← [Topic index](./README.md) · [Phase index](../README.md) · Next: [2 · Tagged templates](./02-tagged-templates.md) →
