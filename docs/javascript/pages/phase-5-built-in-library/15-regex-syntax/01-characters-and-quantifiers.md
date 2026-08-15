---
title: "1 · Characters, quantifiers and anchors"
sidebar_label: "1 · Characters and quantifiers"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Regular expressions guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions), [Character classes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Character_class), [Quantifiers](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Quantifier), [Assertions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Assertions), [Wildcard `.`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Wildcard), [Word boundary assertion](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Word_boundary_assertion), [Unicode character class escape](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Unicode_character_class_escape), [`RegExp`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp). Documentation-validated; **no timings**.

A regular expression is built from three kinds of piece: **what to match**, **how many times**, and
**where**. This chunk is all three; [chunk 2](./02-groups-and-lookaround.md) is how to structure
them.

```js
/^\d{3}-\d{4}$/        // a literal, the readable form
new RegExp("^\\d{3}$") // from a string — note every backslash doubles
```

⚠️ **Use the literal unless the pattern is built at runtime.** The `RegExp` constructor takes a
string, so every `\` must be written `\\`, which is the source of a large share of regex bugs.
`String.raw` removes that particular pain:

```js
new RegExp(String.raw`^\d{3}$`);   // single backslashes, as written
```

## Matching characters

| Pattern | Matches |
|---|---|
| `abc` | those three characters, in order |
| `[abc]` | **one** of `a`, `b`, `c` |
| `[a-z0-9]` | one character in either range |
| `[^abc]` | one character that is **not** `a`, `b` or `c` |
| `.` | any character **except line terminators** |
| `\d` `\D` | a digit `[0-9]` / not a digit |
| `\w` `\W` | `[A-Za-z0-9_]` / not that |
| `\s` `\S` | any whitespace / not whitespace |

🔴 **`.` does not match a newline** unless the `s` (dotAll) flag is set. A pattern that works on one
line and mysteriously fails on a multi-line string is almost always this.

🔴 **`\w` is ASCII-only.** It is `[A-Za-z0-9_]` — so `café`, `naïve`, `Müller` and every non-Latin
script fail a `^\w+$` check. **This is the single most common cause of a validation rule that
rejects real names.** With the `u` flag, Unicode property escapes are the correct tool:

```js
/^\p{L}+$/u.test("Müller");    // true  — any Unicode letter
/^\w+$/.test("Müller");        // 🔴 false
```

**Inside a character class, most metacharacters are literal**, which simplifies escaping a lot:

```js
/[.+*?]/     // matches a literal dot, plus, star or question mark
/[a-z-]/     // a hyphen last (or first) is literal
/[\]\\^]/    // ] \ and a leading ^ still need escaping
```

## Quantifiers, and greedy versus lazy

| | Repeats |
|---|---|
| `*` | 0 or more |
| `+` | 1 or more |
| `?` | 0 or 1 (optional) |
| `{3}` | exactly 3 |
| `{2,}` | 2 or more |
| `{2,5}` | between 2 and 5 |

🔴 **Quantifiers are greedy: they take as much as possible, then give back only if the rest of the
pattern fails.**

```js
"<a><b>".match(/<.+>/)[0];    // "<a><b>"   — greedy, one match spanning both
"<a><b>".match(/<.+?>/)[0];   // "<a>"      — lazy, the shortest that works
```

**Appending `?` to any quantifier makes it lazy** — `*?`, `+?`, `??`, `{2,5}?`. The greedy/lazy
distinction is the second most common source of "my regex matches too much", after `.` and
newlines.

⚠️ **The better fix is often a negated class rather than a lazy quantifier:** `/<[^>]+>/` says
"characters that are not a closing bracket" and cannot overshoot at all, which is both clearer and
avoids the backtracking that lazy quantifiers can cause (topic **16 · in practice** *(not written
yet)*).

## Anchors and boundaries

| | Asserts |
|---|---|
| `^` | start of the string — **or of a line**, with the `m` flag |
| `$` | end of the string — or of a line, with `m` |
| `\b` | a word boundary |
| `\B` | not a word boundary |

**Anchors match a position, not a character**, so they consume nothing.

```js
/^\d+$/.test("42\n");   // 🔴 true in some expectations — see below
```

⚠️ **`$` allows a trailing newline in multiline mode**, and without `m` it matches only at the very
end. The reliable way to validate a whole string is to anchor **and** to have trimmed the input
first — anchoring alone does not compensate for stray whitespace.

**`\b` is defined in terms of `\w`**, so it inherits the ASCII problem:

```js
/\bcat\b/.test("the cat sat");    // true
/\bcafé\b/.test("a café here");   // ⚠️ the boundary after "é" is not where you expect
```

For non-ASCII text, prefer explicit context or Unicode property escapes over `\b`.

## Building a pattern from user input

🔴 **Interpolating unescaped user text into a regex is a bug and sometimes a vulnerability.** A `.`
becomes "any character", and a stray `(` throws:

```js
new RegExp(userInput);            // 🔴 SyntaxError, or a wrong pattern
```

The standard defence is to escape every metacharacter:

```js
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
new RegExp(escape(userInput), "i");
```

⚠️ **A built-in `RegExp.escape` is recent** — check support for your targets before relying on it
rather than the helper above.

**And often the right answer is not a regex at all**: `includes`, `startsWith` and `split` handle
most "does this contain that" questions without any of this
([12 · String searching](../12-string-searching/README.md)).

## Gotchas

**Symptom:** A pattern works on one line and fails on multi-line input
**Cause:** `.` does not match line terminators.
**Fix:** The `s` (dotAll) flag, or `[\s\S]` when you must support older targets.

**Symptom:** A name with an accent fails validation
**Cause:** `\w` is `[A-Za-z0-9_]` — ASCII only.
**Fix:** `\p{L}` with the `u` flag. This is the most common cause of names being rejected.

**Symptom:** A match swallowed far more text than intended
**Cause:** Quantifiers are greedy.
**Fix:** A lazy quantifier (`+?`), or better, a negated class like `[^>]+`.

**Symptom:** `^` and `$` matched in the middle of the string
**Cause:** The `m` flag makes them line anchors.
**Fix:** Drop `m`, or use `\A`-style logic by trimming and testing the whole string.

**Symptom:** `new RegExp("\d")` did not match digits
**Cause:** In a string literal `"\d"` is just `d` — the backslash was consumed.
**Fix:** `"\\d"`, or `` String.raw`\d` ``.

**Symptom:** `SyntaxError: Invalid regular expression` from a search box
**Cause:** User input containing a metacharacter was interpolated directly.
**Fix:** Escape it, or use `includes` instead.

**Symptom:** `[a-Z]` threw or behaved oddly
**Cause:** It is not a valid range — uppercase and lowercase are not contiguous in ASCII.
**Fix:** `[a-zA-Z]`, or the `i` flag.

## Interview questions

**★ Does `.` match everything?**
No — everything except line terminators. The `s` (dotAll) flag makes it match those too. A pattern
that works on a single line and fails on a paragraph is nearly always this.

**★ What is wrong with `\w` for validating names?**
It is exactly `[A-Za-z0-9_]`, so any accented or non-Latin name fails. Use `\p{L}` with the `u`
flag. `\b` inherits the same problem, since it is defined in terms of `\w`.

**★ Greedy versus lazy — give an example.**
`/<.+>/` on `"<a><b>"` matches the whole `"<a><b>"` because `+` takes as much as it can; `/<.+?>/`
matches just `"<a>"`. Often the better fix is a negated class — `/<[^>]+>/` — which cannot overshoot
in the first place.

**★ How do you safely build a regex from user input?**
Escape every metacharacter — `s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")` — before passing it to
`new RegExp`. Otherwise a `.` silently becomes "any character" and a `(` throws a `SyntaxError`. A
built-in `RegExp.escape` is recent, so check support. Often the right answer is `includes` rather
than a regex.

**★ Why does `new RegExp("\d")` fail?**
The string literal consumes the backslash, so the pattern is just `d`. Use `"\\d"` or
`` String.raw`\d` `` — which is exactly what `String.raw` is for.

**What is special about a character class's contents?**
Most metacharacters are literal inside `[...]`, so `[.+*?]` matches those actual characters. Only
`]`, `\`, a leading `^`, and a hyphen in a range position need care.

---

← [Topic index](./README.md) · [Phase index](../README.md) · Next: [2 · Groups, alternation and lookaround](./02-groups-and-lookaround.md) →
