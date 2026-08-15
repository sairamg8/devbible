---
title: "2 · Groups, alternation and lookaround"
sidebar_label: "2 · Groups and lookaround"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Groups and backreferences](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions/Groups_and_backreferences), [Capturing group](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Capturing_group), [Named capturing group](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Named_capturing_group), [Non-capturing group](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Non-capturing_group), [Backreference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Backreference), [Disjunction](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Disjunction), [Lookahead assertion](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Lookahead_assertion), [Lookbehind assertion](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Lookbehind_assertion), [`String.prototype.replace()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace). Documentation-validated; **no timings**.

## Groups do two jobs at once

A `(…)` both **groups** a piece of pattern so a quantifier can apply to all of it, and **captures**
what it matched so you can read it back.

```js
/(ab)+/.test("ababab");        // grouping: the + applies to "ab"
"2026-08-15".match(/(\d{4})-(\d{2})-(\d{2})/);
// [ "2026-08-15", "2026", "08", "15" ]   — index 0 is the whole match
```

**Groups are numbered by the position of their opening parenthesis**, left to right, including
nested ones:

```js
/((a)(b))/    // 1 = "ab", 2 = "a", 3 = "b"
```

🔴 **That numbering is why inserting a group at the front silently breaks every `$1` downstream.**
It is positional, and nothing warns you.

## `(?:…)` when you only want the grouping

```js
/(?:https?):\/\/(\S+)/    // the protocol is grouped but not captured — $1 is the host
```

Use it whenever a group exists only so a quantifier or an alternation can apply. It keeps the
numbering stable and says "this is not part of the result", which is worth the three extra
characters.

## Named groups are the version to write

```js
const m = "2026-08-15".match(/(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/);
m.groups.year;    // "2026"
const { year, month, day } = m.groups;   // destructures cleanly
```

**And they work in `replace` too**, which is where they pay for themselves:

```js
"2026-08-15".replace(/(?<y>\d{4})-(?<m>\d{2})-(?<d>\d{2})/, "$<d>/$<m>/$<y>");
// "15/08/2026"
```

Compare that with `"$3/$2/$1"` — same result, and only one of the two survives someone adding a
group. **Prefer named groups for anything with more than one capture.**

The replacement string has a few other tokens worth recognising: `$&` is the whole match, `` $` ``
and `$'` are the text before and after it, and `$$` is a literal `$`.

## Backreferences: match what you already matched

```js
/(\w+) \1/.test("the the");            // true — a repeated word
/(["'])(.*?)\1/.exec(`say "hi"`);      // matches a quoted string with matching quotes
/(?<q>["']).*?\k<q>/                    // the named form
```

`\1` means "the same text group 1 captured", not "the same pattern" — which is exactly what makes
the matching-quote case work, and what a second `["']` could not do.

## Alternation binds loosest — the classic bug

```js
/^cat|dog$/.test("dogcat");   // 🔴 true
```

`|` has the **lowest precedence in the whole pattern**, so that reads as `(^cat)|(dog$)` — "starts
with cat, OR ends with dog". Almost every use of `|` with anchors needs a group:

```js
/^(cat|dog)$/.test("dogcat");    // false ✅
/^(?:cat|dog)$/.test("dog");     // true — non-capturing, since the value is not needed
```

⚠️ **Alternation is ordered.** The engine tries the branches left to right and takes the **first**
that lets the overall match succeed — not the longest. So `/(a|ab)/` on `"ab"` captures `"a"`. Put
the longer or more specific alternative first.

## Lookaround: assert without consuming

| | Meaning |
|---|---|
| `(?=…)` | lookahead — what follows **must** match |
| `(?!…)` | negative lookahead — what follows **must not** match |
| `(?<=…)` | lookbehind — what precedes must match |
| `(?<!…)` | negative lookbehind — what precedes must not match |

**Lookaround is zero-width**: it tests a position and consumes nothing, so the matched text does not
include it.

```js
"price: 42kg 99usd".match(/\d+(?=usd)/)[0];    // "99"  — the "usd" is not part of the match
"price: 42kg 99usd".match(/(?<=: )\d+/)[0];    // "42"  — the ": " is not part of the match
```

**The two idioms worth memorising:**

```js
// thousands separators — insert at positions, consuming nothing
"1234567".replace(/\B(?=(\d{3})+(?!\d))/g, ",");   // "1,234,567"

// "contains all of these", in one pattern
/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);
```

⚠️ **That password pattern is a good demonstration and a poor design.** Three separate checks give
you three specific error messages, and this gives you one "invalid". Use lookahead composition when
a single pattern is genuinely required — a validator attribute, a config field — not when you
control the code.

⚠️ **Lookbehind is newer than lookahead.** It is widely available in current engines, but **check
your targets** — including older Safari and any embedded runtime — before relying on it.

## Optional groups produce `undefined`

```js
const m = "abc".match(/a(x)?(b)/);
m[1];   // undefined — the group did not participate
m[2];   // "b"
```

🔴 **Not an empty string — `undefined`.** So `m[1].length` throws, and `` `${m[1]}` `` prints
`"undefined"`. Default it (`m[1] ?? ""`) whenever a group is optional.

## Gotchas

**Symptom:** `/^cat|dog$/` matched something it should not
**Cause:** `|` has the lowest precedence, so it means `(^cat)|(dog$)`.
**Fix:** `/^(?:cat|dog)$/`.

**Symptom:** Alternation matched the shorter option
**Cause:** Branches are tried left to right; the first that works wins, not the longest.
**Fix:** Order the alternatives most-specific first.

**Symptom:** `$1` in a replacement suddenly refers to the wrong thing
**Cause:** A group was added earlier in the pattern; numbering is positional.
**Fix:** Named groups and `$<name>`, or `(?:…)` for groups you do not need.

**Symptom:** `TypeError` reading `.length` of a capture
**Cause:** An optional group that did not participate is `undefined`, not `""`.
**Fix:** `m[1] ?? ""`.

**Symptom:** `match.groups` is `undefined`
**Cause:** The pattern has no named groups at all.
**Fix:** Name them, or read by index.

**Symptom:** A lookbehind threw a `SyntaxError` in one browser
**Cause:** It is newer than lookahead and not present in every target.
**Fix:** Check support, or restructure with a capture group and take `m[1]`.

**Symptom:** Matched text unexpectedly included the delimiter
**Cause:** A plain group was used where a lookaround was meant.
**Fix:** `(?=…)` / `(?<=…)` assert without consuming.

## Interview questions

**★ What is the difference between `(…)` and `(?:…)`?**
Both group. Only the first captures. Use the non-capturing form when the group exists purely so a
quantifier or alternation can apply — it keeps the numbering stable and signals that the value is
not part of the result.

**★ Why are named groups better than numbered ones?**
They survive edits. Group numbers are positional, so inserting a group at the front silently
renumbers every `$1` downstream. Named groups read as `m.groups.year` and as `$<year>` in a
replacement, and they destructure.

**★ What does `/^cat|dog$/` actually mean?**
`(^cat)|(dog$)` — alternation has the lowest precedence in the pattern. To anchor both branches you
need `/^(?:cat|dog)$/`. This is the most common regex bug involving `|`.

**★ What is a backreference, and what is it good for?**
`\1` matches the **same text** an earlier group captured, not the same pattern. That is what makes
`/(["']).*?\1/` match a quoted string with *matching* quotes, and `/(\w+) \1/` find a repeated word.

**★ What does lookahead do that a normal group cannot?**
It asserts without consuming, so the matched text excludes it. That is what allows inserting
thousands separators at positions (`/\B(?=(\d{3})+(?!\d))/g`) and combining several
"must contain" requirements into one pattern.

**What does an optional group that did not match produce?**
`undefined`, not an empty string — so `m[1].length` throws and interpolation prints `"undefined"`.
Default it with `?? ""`.

**Is lookbehind safe to use?**
It is widely available in current engines but newer than lookahead, so check your target browsers
and runtimes. Where it is not available, capture the prefix in a group and read `m[1]` instead.

---

← [1 · Characters and quantifiers](./01-characters-and-quantifiers.md) · [Topic index](./README.md) · [Phase index](../README.md) →
