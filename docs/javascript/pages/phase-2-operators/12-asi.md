---
title: "12 · Automatic semicolon insertion"
sidebar_label: "12 · ASI"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0**. Script: `sandbox/js-p2/ex10-expr-stmt-asi.mjs`.

**JavaScript does not have optional semicolons. It has a parser that inserts
them under specific rules, and those rules occasionally insert one you did not
want — or refuse to insert one you did.** Both failure modes are measured below.

## Measured

```
--- ASI: return + newline ---
  return with newline            -> undefined
  return same line               -> {"a":1}

--- the five dangerous line starts ---
  ( leading                      -> TypeError: 1 is not a function
  [ leading                      -> TypeError: Cannot read properties of undefined (reading 'forEach')
  ` leading                      -> TypeError: "x" is not a function
  + leading                      -> undefined
  - leading                      -> undefined
  / leading                      -> SyntaxError: Unexpected token '.'

--- no ASI before ++ on the next line ---
  x NL ++ NL y                   -> "[1,2]"
```

## The three rules

A semicolon is inserted when:

1. **A newline appears before a token that cannot continue the statement.**
2. **The end of the file is reached** with an unterminated statement.
3. **A `restricted production` is followed by a newline** — see below.

The critical inversion: **ASI only inserts a semicolon where the code would
otherwise be a syntax error.** If the next line *can* be read as a continuation,
it will be, no matter what you meant.

## The `return` trap — a semicolon you did not want

```
  return with newline  -> undefined
  return same line     -> {"a":1}
```

```js
function getConfig() {
  return
    { retries: 3 };      // unreachable
}
```

`return` is a **restricted production**: a newline immediately after it forces a
semicolon. The function returns `undefined` and the object literal is dead code.
Measured, and it produces no warning.

The same applies to `throw`, `break`, `continue`, `yield`, and postfix `++`/`--`.
Never put a newline after any of them.

```
  x NL ++ NL y   -> "[1,2]"
```

That measurement shows it from the other side: `x` then newline then `++` then
newline then `y` incremented **`y`**, not `x`. ASI ended the statement after `x`,
and `++y` became the next one.

## The five dangerous line starts — a semicolon you needed and did not get

If you omit semicolons, a line beginning with any of these continues the previous
line:

| Starts with | Read as | Measured error |
|---|---|---|
| `(` | a **call** of the previous expression | `TypeError: 1 is not a function` |
| `[` | an **index** into the previous expression | `Cannot read properties of undefined` |
| `` ` `` | a **tagged template** | `TypeError: "x" is not a function` |
| `+` | binary addition | silently wrong |
| `-` | binary subtraction | silently wrong |
| `/` | division — or a regex, depending | `SyntaxError` |

```js
const total = subtotal
(items).forEach(…)        // parsed as subtotal(items)
```

The `+` and `-` cases are the worst, because they produce **no error at all** —
just a different number.

The defence, if you write semicolon-free code, is a leading semicolon on any line
starting with one of those characters:

```js
const a = 1
;[1, 2].forEach(fn)
```

That is the "defensive semicolon" you see in semicolon-free codebases. It works,
and it is uglier than simply writing semicolons.

## The `no-semicolons` debate, settled practically

Both styles work if applied consistently with a formatter:

- **Semicolons everywhere** (Prettier default, Google, Airbnb) — no defensive
  cases to remember.
- **No semicolons** (StandardJS) — needs the leading-`;` habit for five
  characters.

**Pick one and let Prettier enforce it.** The important part is that the choice
is mechanical rather than per-line judgement. What is *not* safe is writing
semicolons inconsistently by hand, because that is where a missing one hides.

Two things ASI never rescues, whichever style you use:

- A newline after `return` — always a bug.
- A statement that spans lines and happens to be valid two ways.

## A real one

```js
const styles = { padding: 8 }
(function init() { … })()
```

Reads as `{ padding: 8 }(function init(){…})()` — calling the object. `TypeError:
styles is not a function`, at runtime, in whichever file it lands in after
bundling. This is the archetypal ASI incident report.

## Gotchas

**Symptom:** a function returns `undefined` although a `return` value is clearly
written below.
**Cause:** a newline after `return` inserted a semicolon — measured.
**Fix:** put the value on the same line, or open a parenthesis on the `return`
line.

**Symptom:** `TypeError: x is not a function` on a line that has no call.
**Cause:** the next line began with `(`, continuing the previous expression.
**Fix:** a semicolon on the previous line, or a leading `;`.

**Symptom:** `Cannot read properties of undefined` where an array literal starts
a line.
**Cause:** the `[` was parsed as an index into the previous expression.
**Fix:** as above.

**Symptom:** an arithmetic result is silently wrong.
**Cause:** a line starting with `+` or `-` continued the previous expression. No
error is produced.
**Fix:** semicolons, or a formatter.

**Symptom:** `++` incremented the wrong variable.
**Cause:** postfix `++` is a restricted production; a preceding newline ended the
statement — measured `[1,2]`.
**Fix:** keep `++` on the same line as its operand.

**Symptom:** code works unminified and breaks after bundling.
**Cause:** concatenation changed which lines are adjacent.
**Fix:** semicolons via a formatter. Modern bundlers handle this, older
concatenation-based ones did not.

## Interview questions

**★ Are semicolons optional in JavaScript?**
No — the parser inserts them under specific rules. It only inserts one where the
code would otherwise be a syntax error, so any line that *can* continue the
previous one will. That makes semicolons optional in the same way that brakes are
optional.

**★ Why does a `return` followed by a newline return `undefined`?**
`return` is a restricted production: a newline immediately after it forces a
semicolon. Measured, `return \n {a:1}` yields `undefined` and the object literal
becomes unreachable. The same applies to `throw`, `break`, `continue`, `yield`
and postfix `++`/`--`.

**★ Which line starts are dangerous without semicolons?**
Five: `(`, `[`, `` ` ``, `+` and `-`, plus `/` which may be division or a regex.
Each continues the previous line. Measured, `(` produced `TypeError: 1 is not a
function` and `[` produced `Cannot read properties of undefined`; `+` and `-`
produce **no error at all**, just a wrong value.

**Is semicolon-free style safe?**
Yes, if applied mechanically by a formatter and you keep the leading-`;` habit
for those five characters. The unsafe option is hand-written inconsistency, where
a single missing semicolon hides among deliberate omissions.

**What does ASI never fix?**
A newline after `return` — that is always a bug, not a style choice — and any
statement that spans lines and is validly parseable two ways. In those cases ASI
does exactly what it is specified to do and the result is still wrong.

---

← [11 · Expressions vs statements](./11-expressions-vs-statements.md) · [Phase index](./) · Next: [13 · break, continue, labels](./13-break-continue-labels.md) →
