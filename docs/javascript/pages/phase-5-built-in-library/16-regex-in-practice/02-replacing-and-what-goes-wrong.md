---
title: "2 · Replacing, and what goes wrong"
sidebar_label: "2 · Replacing and what goes wrong"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`String.prototype.replace()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace), [`String.prototype.replaceAll()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replaceAll), [Specifying a string as the replacement](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#specifying_a_string_as_the_replacement), [Specifying a function as the replacement](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#specifying_a_function_as_the_replacement), [Regular expressions guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions), [`DOMParser`](https://developer.mozilla.org/en-US/docs/Web/API/DOMParser), [`URL`](https://developer.mozilla.org/en-US/docs/Web/API/URL), [`<input type="email">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/email). Documentation-validated; **no timings**.

## `replace` replaces once. `replaceAll` says what it means

```js
"a-b-c".replace("-", "+");       // "a+b+c"? 🔴 no — "a+b-c"
"a-b-c".replace(/-/g, "+");      // "a+b+c"
"a-b-c".replaceAll("-", "+");    // "a+b+c"  ✅ clearest
```

**With a string pattern, `replace` replaces only the first occurrence** — a genuinely common bug
before `replaceAll` existed.

⚠️ **`replaceAll` with a *regex* requires the `g` flag** and throws a `TypeError` without it. That
looks redundant and is a deliberate guard: it stops `replaceAll(/x/, …)` reading as "all" while
behaving as "first".

## The replacement string has its own mini-syntax

| Token | Inserts |
|---|---|
| `$&` | the whole match |
| `$1`, `$2` | capture groups by number |
| `$<name>` | a named group |
| `` $` `` | the text before the match |
| `$'` | the text after the match |
| `$$` | a literal `$` |

🔴 **This is why user-supplied replacement text is dangerous.** A `$&` inside it is *interpreted*:

```js
"cost".replace(/cost/, userInput);   // if userInput is "$& $&" you get "cost cost"
```

If the replacement is data rather than a template, use the **callback form**, which does no
substitution at all:

```js
"cost".replace(/cost/, () => userInput);   // ✅ inserted literally
```

## The callback form is the useful one

```js
str.replace(re, (match, p1, p2, offset, string, groups) => …);
```

The arguments are: the whole match, then **one argument per capture group**, then the offset, then
the full input — and, **if the pattern has named groups, a final `groups` object**. That last one is
positional and easy to get wrong, so destructure the rest instead:

```js
"2026-08-15".replace(/(?<y>\d{4})-(?<m>\d{2})-(?<d>\d{2})/, (...args) => {
  const { y, m, d } = args.at(-1);      // groups is the last argument
  return `${d}/${m}/${y}`;
});
```

**Two things the callback makes possible that a string cannot**: computing the replacement
(`(m) => m.toUpperCase()`), and looking up a value per match — which is the correct way to write a
templating or escaping pass:

```js
const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
```

## 🔴 Catastrophic backtracking, and why JavaScript is exposed

Some patterns take exponential time on input that *almost* matches. The classic shape is **a
quantifier inside a quantifier**:

```js
/^(a+)+$/.test("aaaaaaaaaaaaaaaaaaaaaaaaaaaa!");
```

The engine can split those `a`s between the inner and outer `+` in exponentially many ways, and it
tries them all before concluding the `!` cannot match. Add a few characters and it goes from
instant to effectively forever.

🔴 **JavaScript's engine has no atomic groups and no possessive quantifiers**, which other regex
flavours use to cut this off. You cannot tell it "having matched this, never give it back". So the
mitigation has to be in how the pattern is written:

- **Avoid nesting quantifiers.** `(a+)+`, `(\s*\w+)*`, `(.*,)*` are the shapes to recognise.
- **Use a negated class instead of `.` plus a boundary** — `[^"]*` cannot overshoot and then
  backtrack, where `.*` can.
- **Anchor the pattern** so failure is detected early rather than after a long search.
- **Bound the input.** A length check before matching turns an unbounded risk into a bounded one.
- **Never build a pattern from user input** without escaping it
  ([15 · Characters and quantifiers](../15-regex-syntax/01-characters-and-quantifiers.md)) — and even
  escaped, an attacker-supplied *subject* string is enough for this attack.

**This is a real denial-of-service class (ReDoS)**, and it is worse on a server than in a browser:
Node is single-threaded, so one bad match blocks every other request in that process. If a pattern
must run on untrusted input and cannot be simplified, the answer is a linear-time engine (the RE2
family) rather than a cleverer pattern.

## Where a regex is the wrong tool

**HTML.** Nesting, attributes, comments, CDATA and malformed markup make it unparseable by a regular
language. Use `DOMParser` in the browser, or a real parser on the server. A regex over HTML works on
your test input and fails on real pages.

**URLs.** The `URL` constructor handles the parsing, the encoding and the edge cases:

```js
const { hostname, searchParams } = new URL(href);
```

**Email addresses.** 🔴 **Do not validate email with a regex.** The grammar is far more permissive
than any pattern people write, so a "strict" regex rejects real addresses — and no pattern can tell
you whether the mailbox exists. The workable rule: `<input type="email">` plus a check for an `@`
with something either side, then **send a confirmation link**. Deliverability is the only real
validation.

**Dates, CSV, JSON, code.** Each has a parser that handles the cases a pattern will not: quoted
commas, escaped quotes, time zones, nesting.

**A regex is right for**: simple validation of a format you define (a postcode you control, a slug),
tokenising with `y`, find-and-replace over text, and extracting from a format you know is
well-formed.

## Keeping a pattern readable

```js
const RE_DATE = /(?<y>\d{4})-(?<m>\d{2})-(?<d>\d{2})/;   // ✅ named, hoisted, explained
```

- **Name it and hoist it** — a literal buried in a call is unsearchable.
- **Use named groups** so the extraction reads as prose.
- **A comment with one example of what it matches** is worth more than a description of the pattern.
- **Split it up.** Two simple patterns run in sequence are almost always clearer than one clever one,
  and they cannot nest quantifiers by accident.

## Gotchas

**Symptom:** `replace` only changed the first occurrence
**Cause:** A string pattern replaces once.
**Fix:** `replaceAll`, or a `/…/g` regex.

**Symptom:** `TypeError: replaceAll must be called with a global RegExp`
**Cause:** A non-global regex passed to `replaceAll`.
**Fix:** Add `g`. The requirement prevents a misleading call.

**Symptom:** Replacement text came out mangled, with duplicated content
**Cause:** The replacement string contains `$&` or `$1`, which are interpreted.
**Fix:** Use the callback form — `() => text` inserts literally.

**Symptom:** The `groups` argument in a callback was `undefined`
**Cause:** The pattern has no named groups, so there is no final argument.
**Fix:** Name the groups, or read by position.

**Symptom:** A page or server froze on one input
**Cause:** Catastrophic backtracking — nested quantifiers on almost-matching input.
**Fix:** Remove the nesting, use negated classes, anchor, and bound the input length.

**Symptom:** An HTML-scraping regex broke on real pages
**Cause:** HTML is not a regular language.
**Fix:** `DOMParser` or a real parser.

**Symptom:** Valid email addresses are rejected
**Cause:** A hand-written "strict" email regex.
**Fix:** `type="email"`, a minimal `@` check, and a confirmation email.

## Interview questions

**★ What is the difference between `replace` and `replaceAll`?**
With a string pattern, `replace` replaces only the first occurrence; `replaceAll` replaces every one.
With a regex, `replace` needs the `g` flag to replace all, and `replaceAll` **requires** it —
throwing otherwise, so the name cannot lie about the behaviour.

**★ Why is a user-supplied replacement string dangerous?**
The replacement has its own syntax: `$&`, `$1`, `$<name>`, `` $` ``, `$'`. User text containing those
is interpreted rather than inserted. The callback form performs no substitution, so
`() => userInput` is the safe version.

**★ What is catastrophic backtracking?**
A pattern with nested quantifiers — `/^(a+)+$/` — on input that almost matches. The engine tries
exponentially many ways to split the input before failing. On Node it blocks the entire process,
making it a denial-of-service vector.

**★ Why is JavaScript particularly exposed to it?**
It has no atomic groups and no possessive quantifiers, so there is no way to tell the engine not to
backtrack into a group. The mitigation has to be the pattern itself: no nested quantifiers, negated
classes instead of `.`, anchoring, and bounding the input length.

**★ Why should you not validate email addresses with a regex?**
The real grammar is far more permissive than any hand-written pattern, so a strict one rejects valid
addresses — and no pattern can tell you the mailbox exists. Use `type="email"`, a minimal
sanity check, and a confirmation link.

**When should you reach for a regex at all?**
Formats you define and control, tokenising with the sticky flag, and find-and-replace over text.
Not HTML, not URLs, not CSV, not dates — each has a parser that handles the cases a pattern will
not.

**How do you make a regex maintainable?**
Name it and hoist it, use named groups so the extraction reads as prose, add a comment showing one
example of what it matches, and prefer two simple patterns in sequence over one clever one.

---

← [1 · Methods, flags, lastIndex](./01-the-methods-and-flags.md) · [Topic index](./README.md) · [Phase index](../README.md) →
