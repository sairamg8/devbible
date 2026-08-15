---
title: "1 · The methods, the flags, and `lastIndex`"
sidebar_label: "1 · Methods, flags, lastIndex"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`RegExp.prototype.test()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/test), [`RegExp.prototype.exec()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec), [`RegExp.prototype.lastIndex`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/lastIndex), [`String.prototype.match()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/match), [`String.prototype.matchAll()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/matchAll), [`String.prototype.search()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/search), [`String.prototype.split()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/split), [Advanced searching with flags](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions/Advanced_searching_with_flags), [`RegExp.prototype.sticky`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/sticky), [`RegExp.prototype.hasIndices`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/hasIndices). Documentation-validated; **no timings**.

## Which method to call

| Question | Use | Returns |
|---|---|---|
| Does it match? | `re.test(s)` | boolean |
| Where is the first match? | `s.search(re)` | index, or `-1` |
| What did the first match capture? | `s.match(re)` *(no `g`)* | match object with `groups`, `index` |
| What are all the matches, as strings? | `s.match(re)` *(with `g`)* | array of strings, **no groups** |
| What are all the matches, with captures? | `s.matchAll(re)` *(needs `g`)* | iterator of match objects |
| Replace | `s.replace` / `s.replaceAll` | new string — [chunk 2](./02-replacing-and-what-goes-wrong.md) |
| Split on a pattern | `s.split(re)` | array of strings |

🔴 **`match` with the `g` flag silently discards your capture groups** and returns plain strings.
That surprise is the reason `matchAll` exists:

```js
const s = "a=1, b=2";
s.match(/(\w)=(\d)/g);          // ["a=1", "b=2"]   — 🔴 captures gone
[...s.matchAll(/(\w)=(\d)/g)];  // two full match objects, each with [1] and [2]
```

⚠️ **`matchAll` requires the `g` flag** — without it, it throws a `TypeError`. That is deliberate,
so the "one match or all matches" question is answered by the call rather than by a flag you might
not notice.

**`split` with a capturing group keeps the captures** in the result, which is occasionally exactly
what you want:

```js
"a1b2c".split(/(\d)/);   // ["a", "1", "b", "2", "c"]
```

## 🔴 The `lastIndex` trap — the biggest one in this topic

**A regex with the `g` (or `y`) flag is stateful.** `test` and `exec` start from `re.lastIndex` and
update it after a match. If the *same regex object* is used twice, the second call resumes where the
first stopped:

```js
const re = /\d+/g;

re.test("a1");   // true   — lastIndex is now 2
re.test("a1");   // 🔴 false — resumed at index 2, found nothing
re.test("a1");   // true   — lastIndex reset to 0 after the failure, so it matches again
```

**Alternating true/false on identical input** is the signature. It bites in three shapes:

```js
// 1 · a module-level regex reused across calls
const EMAIL = /\S+@\S+/g;
export const isEmail = (s) => EMAIL.test(s);   // 🔴 alternates

// 2 · the same regex inside a loop
for (const line of lines) if (re.test(line)) …  // 🔴 skips lines

// 3 · a regex reused across React renders or requests
```

**Three fixes, best first:**

```js
const isEmail = (s) => /\S+@\S+/.test(s);     // ✅ no g flag — `test` never needed it
const isEmail = (s) => new RegExp(...).test(s);// a fresh object per call
re.lastIndex = 0;                              // ⚠️ works, and is easy to forget somewhere
```

🔴 **The real lesson: do not put `g` on a regex you only ask yes/no questions about.** `test` does
not need it, and `g` is what makes the object stateful.

⚠️ **`match`, `matchAll`, `replace` and `split` are not affected** — they reset or ignore
`lastIndex` internally. Only `test` and `exec` carry state between calls.

**`exec` in a loop is the intended use of that statefulness**, and it works precisely because of it:

```js
let m;
while ((m = re.exec(s)) !== null) {
  console.log(m[0], m.index);
}
```

⚠️ **A zero-length match makes that loop infinite** — if the pattern can match empty (`/\d*/g`),
`lastIndex` never advances. `matchAll` handles this for you, which is another reason to prefer it.

## The flags

| Flag | Name | Effect |
|---|---|---|
| `g` | global | find all matches; **makes `test`/`exec` stateful** |
| `i` | ignoreCase | case-insensitive |
| `m` | multiline | `^` and `$` match line boundaries |
| `s` | dotAll | `.` also matches line terminators |
| `u` | unicode | correct handling of surrogate pairs; enables `\p{…}` |
| `y` | sticky | match **only** at `lastIndex`, never search forward |
| `d` | hasIndices | adds `.indices` with start/end positions per group |
| `v` | unicodeSets | a newer, stricter superset of `u` — check support |

**`u` is worth defaulting to** for anything touching real text: without it, a surrogate pair is two
separate units to the engine, so `/^.$/.test("👍")` is `false` while `/^.$/u.test("👍")` is `true` —
the same code-unit problem as
[12 · Comparing and sorting](../12-string-searching/02-comparing-and-sorting.md).

**`y` (sticky) is the tokeniser flag.** It refuses to skip ahead, so a lexer can assert "the next
token starts exactly here" rather than "a token appears somewhere later".

**`d` (hasIndices)** gives you `m.indices[1]` as `[start, end]` for each group — useful for
highlighting a match in the original string without recomputing offsets.

## Reading a match object

```js
const m = "2026-08-15".match(/(?<y>\d{4})-(\d{2})/);
m[0];        // "2026-08"     the whole match
m[1];        // "08"          first capture
m.index;     // 0             where it matched
m.input;     // the original string
m.groups;    // { y: "2026" } — undefined if there are no named groups
```

⚠️ **`match` returns `null` when there is no match**, not an empty array — so
`s.match(re).length` throws. `s.match(re) ?? []` or a `test` first.

## Gotchas

**Symptom:** `test` alternates between `true` and `false` on the same input
**Cause:** The `g` flag makes the regex stateful via `lastIndex`, and the object is being reused.
**Fix:** Drop the `g` — `test` never needed it. Or create the regex per call.

**Symptom:** A loop over lines skips some that clearly match
**Cause:** Same reason: one `/…/g` object reused across iterations.
**Fix:** Move the literal inside the loop, or drop `g`.

**Symptom:** `match` with `g` returned strings and lost the captures
**Cause:** That is what `g` does to `match`.
**Fix:** `matchAll`, spread into an array.

**Symptom:** `TypeError: matchAll must be called with a global RegExp`
**Cause:** `matchAll` requires `g`.
**Fix:** Add it — the requirement is deliberate.

**Symptom:** `TypeError: Cannot read properties of null`
**Cause:** `match` returns `null` when nothing matched.
**Fix:** `?? []`, or guard with `test`.

**Symptom:** A `while (re.exec(s))` loop never ends
**Cause:** The pattern can match an empty string, so `lastIndex` never advances.
**Fix:** `matchAll`, or advance `lastIndex` manually on a zero-length match.

**Symptom:** `/^.$/` is `false` for a single emoji
**Cause:** Without `u`, the engine sees two code units.
**Fix:** Add the `u` flag.

**Symptom:** `$` matched before a trailing newline
**Cause:** Multiline semantics, or the end-of-input allowance.
**Fix:** Trim first, and be explicit about `m`.

## Interview questions

**★ Why can `test` return different results for the same string?**
Because a `g`-flagged regex is stateful: `test` and `exec` start at `lastIndex` and update it. Reusing
the object gives `true`, then `false`, then `true`. The fix is to drop `g` — `test` never needed it —
rather than resetting `lastIndex` by hand.

**★ What is the difference between `match` and `matchAll`?**
Without `g`, `match` returns the first match with its captures, `index` and `groups`. **With `g` it
returns plain strings and discards the captures** — which is exactly why `matchAll` exists. `matchAll`
requires `g` and yields full match objects for every match.

**★ Which methods are affected by `lastIndex`?**
Only `test` and `exec`. `match`, `matchAll`, `replace` and `split` reset or ignore it internally.

**★ What does the `u` flag actually change?**
It makes the engine work in code points rather than UTF-16 code units, so a surrogate pair is one
character to `.`, and it enables `\p{…}` property escapes. Default to it for anything handling real
user text.

**★ When would you use the sticky flag?**
Tokenising. `y` matches only at `lastIndex` and refuses to search forward, so a lexer can assert that
the next token begins exactly here instead of finding one somewhere later.

**Why might a `while (re.exec(s))` loop hang?**
A pattern that can match the empty string never advances `lastIndex`. `matchAll` avoids the whole
class of problem.

**What does `split` do with a capture group in the pattern?**
It includes the captured text in the output array alongside the pieces — `"a1b".split(/(\d)/)` gives
`["a", "1", "b"]`.

---

← [Topic index](./README.md) · [Phase index](../README.md) · Next: [2 · Replacing, and what goes wrong](./02-replacing-and-what-goes-wrong.md) →
