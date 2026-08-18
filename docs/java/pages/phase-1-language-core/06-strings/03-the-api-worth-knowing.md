---
title: "The String API worth knowing"
sidebar_label: "3 · The API worth knowing"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 `String`, `Character` and `Pattern`
> Javadoc — in particular the `split`, `trim`, `strip` and `replaceAll`
> method contracts.

**Half the `String` API does exactly what its name says. This chunk is about
the other half: `split` takes a *regex* and silently drops trailing empties,
`trim` only knows ASCII, `replaceAll`'s first argument is a pattern, and case
operations consult the default locale. Every one of these is a specified
behaviour, documented in the Javadoc, and rediscovered the hard way in
production weekly.**

## `split` — two surprises in one method

```java
"a.b.c".split(".")      // NOT {"a","b","c"} — the argument is a REGEX
"a.b.c".split("\\.")    // {"a","b","c"} — escape the metacharacter
"a,b,,".split(",")      // {"a","b"} — trailing empty strings REMOVED
"a,b,,".split(",", -1)  // {"a","b","",""} — negative limit keeps them
```

Surprise one: the parameter is a regular expression. `"."` matches every
character, so every token between matches is empty — and per the second
surprise, trailing empties are removed, leaving an **empty array**. Splitting
on `.`, `|`, `+`, `*` or `(` without escaping is the classic form; use
`Pattern.quote(sep)` when the separator is a variable.

Surprise two matters for record-shaped data: parsing CSV-ish lines where the
last fields may be blank *requires* `split(sep, -1)`, or rows lose columns
exactly when the optional fields are empty — a data-corruption bug, not a
crash. (Real CSV with quoting and embedded separators needs a real parser —
regex splitting is for simple delimited data only.)

For the inverse — one delimiter-joined string from parts —
[chunk 2's](02-building-and-formatting.md) `String.join`.

## `trim` vs `strip` — ASCII vs Unicode

```java
s.trim()    // removes only chars <= U+0020 from both ends (1996 semantics)
s.strip()   // removes Character.isWhitespace() chars (11+) — Unicode-aware
s.stripLeading(); s.stripTrailing(); s.isBlank()   // same definition
```

`trim` predates Unicode maturity: it strips anything `<= U+0020`, which
happens to cover space, tab, `\r`, `\n` — and misses every Unicode space
(em-space U+2003, ideographic space U+3000, line separator U+2028...).
`strip` uses `Character.isWhitespace`, the definition `isBlank` also uses.

One character defeats both: **U+00A0 no-break space is not whitespace** by
`Character.isWhitespace`, so neither `trim` nor `strip` removes it. Text
pasted from browsers and Word documents is full of NBSPs; when
"identical-looking" strings refuse to compare equal at an input boundary,
suspect it first, and normalize deliberately
(`s.replace(' ', ' ').strip()`) where user-pasted input enters.

## `replace` vs `replaceAll` — the misnamed pair

```java
s.replace("a.b", "x")       // literal replacement, ALL occurrences
s.replaceAll("a.b", "x")    // REGEX replacement, all occurrences
s.replaceFirst("a.b", "x")  // regex, first occurrence
```

The names suggest `replace` does one and `replaceAll` does all. Wrong axis:
**both replace every occurrence; the difference is literal vs regex.**
`replaceAll` also treats `$` and `\` in the *replacement* specially
(group references) — user-supplied replacement text containing `$` throws or
corrupts. Default to `replace`; reach for `replaceAll` only when you mean
patterns, and then mind `Matcher.quoteReplacement` for dynamic replacements.
(Full regex — `Pattern`, compile-once, catastrophic backtracking — is
[Phase 7's regex topic](../../phase-7-io-time-stdlib/06-regex.md).)

## Case operations and the locale trap

```java
s.toUpperCase()              // uses the DEFAULT locale — varies by host
s.toUpperCase(Locale.ROOT)   // stable, locale-independent
a.equalsIgnoreCase(b)        // per-char, locale-independent — safe for codes
```

The famous failure is the Turkish locale: uppercasing `"id"` yields `"İD"`
(dotted capital I) under `tr-TR`, so `"id".toUpperCase().equals("ID")` is
false on a Turkish-locale JVM — protocol tokens, enum lookups and header
names break on exactly one customer's server (Phase 0's WORA-leak table,
in miniature). Rules: **`Locale.ROOT` for machine text, explicit locale for
human text, `equalsIgnoreCase` for comparisons** — it compares character-wise
without locale rules.

`compareTo` orders by raw code point — fine for stable technical ordering,
wrong for human-visible sorting (`"Z" < "a"`, accents misplace). Human
sorting wants `java.text.Collator`; document which one a sort is.

## The quiet essentials

| Method | The point |
|---|---|
| `isEmpty()` / `isBlank()` (11+) | length-zero vs whitespace-only — validation almost always means `isBlank` |
| `contains`, `startsWith`, `endsWith` | literal checks — no regex, no surprises |
| `indexOf` / `lastIndexOf` | −1 protocol; combine with `substring` for light parsing |
| `substring(from, to)` | half-open `[from, to)`; copies since 7u6 — no hidden retention of the original |
| `charAt` vs `chars()` vs `codePoints()` | `charAt` yields UTF-16 units, not characters — emoji and many scripts occupy two; iterate `codePoints()` when "character" means what users mean |
| `repeat(n)` (11+), `indent(n)` (12+) | padding, separators, test fixtures |
| `lines()` (11+) | stream of lines split on terminators — pairs with text blocks |
| `String.valueOf(...)` | null-safe, overloaded for primitives |
| `toCharArray()` | the mutable escape hatch — for algorithms, not storage |

## Gotchas

**Symptom:** `split(".")` returns an empty array; `split("|")` splits between every character
**Cause:** the argument is a regex; `.` and `|` are metacharacters
**Fix:** escape (`"\\."`) or `Pattern.quote(sep)`. If the separator comes from config or users, quoting is mandatory

**Symptom:** parsed rows have fewer columns exactly when trailing fields are blank
**Cause:** `split` removes trailing empty strings by default
**Fix:** `split(sep, -1)` for record-shaped data. Add a test row with empty trailing fields — it is the case nobody's happy-path data covers

**Symptom:** two strings print identically, `equals` is false, `strip()` didn't help
**Cause:** U+00A0 no-break space (or another exotic space) — not whitespace per `Character.isWhitespace`, so `strip` keeps it; invisible in logs
**Fix:** dump code points when equality surprises; normalize NBSP → space at input boundaries where pasted text arrives

**Symptom:** `replaceAll` throws `IllegalArgumentException` or mangles output when the replacement contains `$`
**Cause:** regex group-reference syntax in the replacement string
**Fix:** use `replace` (literal) when no pattern is meant; otherwise `Matcher.quoteReplacement` around dynamic replacement text

**Symptom:** uppercased identifier comparisons fail on one customer's deployment only
**Cause:** default-locale case mapping — Turkish dotted/dotless I is the canonical case
**Fix:** `Locale.ROOT` for identifiers and protocol text; `equalsIgnoreCase` for comparisons. Audit every bare `toUpperCase()`/`toLowerCase()`

**Symptom:** a sorted list of names puts `"Ärger"` after `"Zebra"` and users file a bug
**Cause:** `compareTo` orders by code point, not linguistic order
**Fix:** `Collator.getInstance(locale)` for human-facing sort; keep `compareTo` for internal stable ordering and say so in a comment

**Symptom:** `substring`/`charAt` cut an emoji in half, producing a replacement character in output
**Cause:** indices count UTF-16 units; supplementary characters occupy two (a surrogate pair)
**Fix:** iterate `codePoints()` or use `offsetByCodePoints` when slicing user-visible text; never slice at arbitrary `char` indices in free-form Unicode

**Symptom:** validation accepts `"   "` as a name
**Cause:** `isEmpty()` checks length only
**Fix:** `isBlank()` — whitespace-only fails; it is almost always the intended check at input boundaries

## Interview questions

**★ Why does `"a.b.c".split(".")` return an empty array?**
`split` takes a regex; `.` matches every character, so all tokens are empty
strings — and `split` removes trailing empty strings by default, leaving
nothing. `split("\\.")` fixes the pattern; a `-1` limit would keep the
empties.

**★ What's the difference between `replace` and `replaceAll`?**
Not "one vs all" — both replace all occurrences. `replace` is literal;
`replaceAll` interprets its first argument as a regex and its replacement's
`$`/`\` as group references. Default to `replace`; regex only when a pattern
is genuinely meant.

**★ `trim` vs `strip`?**
`trim` removes only characters `<= U+0020` — 1990s ASCII semantics. `strip`
(11+) removes `Character.isWhitespace` characters — Unicode-aware, matching
`isBlank`'s definition. Neither removes U+00A0 no-break space, the pasted-text
character that makes visually identical strings unequal.

**★ Why can `toUpperCase()` break a program on exactly one server?**
It uses the JVM's default locale; under `tr-TR`, `i` uppercases to dotted
`İ`, so ASCII-token comparisons fail. Machine text takes `Locale.ROOT`,
human text an explicit locale, comparisons `equalsIgnoreCase` — and this is
the WORA leak table's locale row made concrete.

**When is `charAt`/`substring` indexing wrong even for correct indices?**
When the text contains supplementary-plane characters (emoji, many scripts):
indices address UTF-16 units and such characters span two, so unit-based
slicing can split a surrogate pair. Use `codePoints()`/`offsetByCodePoints`
where "character" means a user-perceived character.

**How do you check "the user typed something meaningful"?**
`isBlank()` negated — it rejects empty and whitespace-only. `isEmpty` passes
`"   "`, which is never what a required-field check means.

**Does `substring` leak the original string?**
Not since 7u6 — it copies the range. Before that it shared the backing array,
so a 3-character token could pin a megabyte buffer; the change traded that
retention bug for copy cost, and is why `new String(bigStr.substring(...))`
idioms in old code are now pointless.

---

← Prev: [Building and formatting](02-building-and-formatting.md) · Index: [Strings](README.md)
