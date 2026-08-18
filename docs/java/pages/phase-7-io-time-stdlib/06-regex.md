---
title: "Regex"
sidebar_label: "06 · Regex"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-18 against the JDK 25 API documentation for
> `java.util.regex.Pattern` (the class Javadoc's full syntax table,
> including possessive quantifiers and independent non-capturing groups)
> and `java.util.regex.Matcher` (`quoteReplacement`, replacement-string
> `$`/`\` rules, thread-safety note), plus the `String.split` and
> `String.replaceAll` Javadoc for their delegation to `Pattern`.

**A compiled `Pattern` is an immutable, thread-safe object that costs
real work to build; a `Matcher` is the cheap, mutable, *not*
thread-safe cursor you run over one input. Java's engine is a
backtracking matcher with no time limit — which means the wrong pattern
plus attacker-shaped input is not a bug that throws, it's a thread spun
at 100% CPU until someone restarts the service. Compile once, know your
three matching modes, and treat every quantifier ambiguity as a
performance question.**

## Compile once — the object model

```java
private static final Pattern SKU = Pattern.compile("[A-Z]{3}-\\d{4}");

boolean ok = SKU.matcher(input).matches();
```

- `Pattern.compile` parses the regex into an internal node tree — do it
  once, in a `static final`. `Pattern` is immutable and safe to share
  across threads.
- `Matcher` holds the match state (region, group boundaries, append
  position). It is mutable and **must not** be shared across threads —
  create one per use; creation is cheap.
- `String.matches(regex)`, `String.replaceAll`, and
  `String.replaceFirst` recompile the pattern on **every call** — fine
  in a script, waste in a hot path. (`String.split` has a fast path for
  a single literal character and skips the regex engine entirely; any
  real pattern compiles per call.)

## The three matching modes

| Call | Anchoring | Question it answers |
|---|---|---|
| `matches()` | whole input | "is the *entire* input this shape?" |
| `lookingAt()` | start only | "does the input *begin* with this?" |
| `find()` | none — scans | "does this occur *anywhere*?" (call repeatedly for all hits) |

`matches` needing the whole input is the top confusion with other
languages: Java's `"abc".matches("b")` is false where Perl/JS `test`
would be true. The scanning behavior lives on `find()`:

```java
Matcher m = WORD.matcher(text);
while (m.find()) {
    process(m.group());        // the current hit
}
```

## Groups

```java
Pattern date = Pattern.compile("(?<year>\\d{4})-(?<month>\\d{2})-(\\d{2})");
Matcher m = date.matcher("2026-08-18");
if (m.matches()) {
    m.group(0);        // whole match
    m.group("year");   // named
    m.group(3);        // day — numbered by left parens, 1-based
}
```

- Groups number by **opening parenthesis**, left to right, starting
  at 1; group 0 is the whole match. `(?:...)` groups without capturing
  — use it for grouping-only parens so numbering stays sane.
- Named groups `(?<name>...)` read better and survive pattern edits;
  backreference with `\k<name>` in the pattern, `${name}` in
  replacements.
- Calling `group()` before a successful `matches()`/`find()` throws
  `IllegalStateException` — the matcher is a cursor, not a result.
- A group inside a quantifier (`(\\d+,)*`) captures only its **last**
  repetition; regex can't give you "all repetitions" — loop `find()`
  instead.

## Replacement is its own mini-language

In `replaceAll`/`appendReplacement`, `$` starts a group reference and
`\` escapes — so replacing with user-supplied text breaks (or worse,
substitutes groups) when it contains either:

```java
m.replaceAll(Matcher.quoteReplacement(userText));   // literal replacement
Pattern.compile(Pattern.quote(userLiteral));        // literal *pattern*
```

`Pattern.quote` wraps the whole string in `\Q...\E` for matching a
literal; `Matcher.quoteReplacement` neutralizes the replacement side.
Different sides, different tool. And when no pattern is needed at all,
**`String.replace` is literal** and does the job without the regex
engine.

## Flags

```java
Pattern.compile("^error:.*$", Pattern.CASE_INSENSITIVE | Pattern.MULTILINE)
```

- `CASE_INSENSITIVE` — ASCII-only unless combined with `UNICODE_CASE`
  (`é` vs `É` needs both). Inline form `(?iu)`.
- `MULTILINE` — `^`/`$` match at every line boundary instead of input
  start/end. Without it, `^` in a multi-line log matches once.
- `DOTALL` — `.` also matches line terminators (`(?s)`); the default
  `.` stopping at `\n` is why "match across lines" patterns mysteriously
  fail.
- `COMMENTS` (`(?x)`) permits whitespace and `#` comments inside the
  pattern — the only way a 40-character pattern stays reviewable.
- `LITERAL` — the whole pattern is literal text; the flag form of
  `Pattern.quote`.

## Catastrophic backtracking — the input that hangs a thread

A backtracking engine tries alternatives until the input fails every
one. When quantifiers can divide the same text in many ways, the number
of ways is exponential — and the engine explores *all* of them before
reporting "no match":

```java
Pattern bad = Pattern.compile("(a+)+b");
bad.matcher("a".repeat(40) + "!").matches();   // ~2^40 paths — minutes to never
```

The dangerous shapes, all "same text, many parses":

- **Nested quantifiers** over overlapping sets: `(a+)+`, `(\w*)*`,
  `(.*)+`.
- **Overlapping alternation under a quantifier**: `(a|aa)+`,
  `(\s| )*` where the branches can match the same characters.
- Both are harmless on *matching* input — the blow-up needs a **long
  near-match that fails at the end**, which is exactly what an attacker
  sends. This is **ReDoS**: one crafted string per thread pins one CPU
  core, no exception, no timeout — Java has no linear-time engine
  option (unlike RE2) and no matcher deadline.

Defenses, in order of preference:

1. **Rewrite so the parse is unambiguous** — `(a+)+b` → `a+b`;
   `(\s| )*` → `[\s ]*`. Character classes can't backtrack
   against each other.
2. **Possessive quantifiers** (`a++`, `[^"]*+`) or **atomic groups**
   (`(?>...)`) — they match greedily and *never give back*, cutting the
   retry tree at the cost of refusing some matches a backtracking parse
   would find. Both are in Java's syntax table.
3. **Bound the input** before matching — length caps on anything
   user-supplied that meets a nontrivial pattern.
4. Last resort for untrusted patterns: match on a `CharSequence` whose
   `charAt` checks `Thread.interrupted()` and throws — the only way to
   impose a deadline on a running match.

## `String.split` small print

- Trailing empty strings are **removed** by default: `"a,,b,,".split(",")`
  → `["a", "", "b"]`. Pass limit `-1` to keep them — the difference
  corrupts positional CSV parsing silently.
- The argument is a **regex**: `line.split(".")` matches everything
  (result: empty array once trailing empties are trimmed);
  `split("|")` splits between every character. Escape (`"\\."`) or
  `Pattern.quote(".")`.
- A leading match produces a leading empty string — only trailing ones
  are trimmed: `",a".split(",")` → `["", "a"]`.
- For repeated splitting, `SKU.split(input)` on a compiled `Pattern`
  skips recompilation.

## When regex is the wrong tool

- **Nested or recursive structure** — HTML, JSON, expressions with
  balanced brackets. Regular expressions can't count nesting; use the
  parser (Jackson for JSON — [JSON with Jackson](05-json-jackson/README.md)).
- **Fixed-string tests** — `contains`, `startsWith`, `indexOf`,
  `String.replace` are clearer and engine-free.
- **Dates and numbers** — `\d{4}-\d{2}-\d{2}` accepts `9999-99-99`;
  parse with `java.time` ([java.time](01-java-time/README.md)) or
  `Integer.parseInt` and let the domain type validate.
- **Anything you can't explain in review** — `COMMENTS` mode first;
  a parser second.

## Gotchas

**Symptom:** validation that works in the JS frontend rejects everything in the Java backend
**Cause:** Java's `matches()` anchors to the whole input; the same pattern in JS `test()` scans — a pattern like `\d+` passes `"abc123"` in JS and fails it in Java
**Fix:** decide what you mean: whole-shape validation → keep `matches()` and fix the frontend; substring search → use `find()`

**Symptom:** one API endpoint intermittently drives a core to 100% and never returns; thread dump shows the thread alive inside `java.util.regex`
**Cause:** catastrophic backtracking — a nested/overlapping quantifier pattern fed a long input that *almost* matches; the engine is exploring an exponential retry tree
**Fix:** rewrite the ambiguity away (character classes, possessive quantifiers/atomic groups); cap input length before matching; there is no engine timeout to save you

**Symptom:** `replaceAll` throws `IllegalArgumentException: Illegal group reference` — but only for some users
**Cause:** the replacement string came from user data containing `$` (or a lone `\`) — the replacement side treats both as special
**Fix:** `Matcher.quoteReplacement(userText)`; and if the *pattern* side is user data, `Pattern.quote` it (different escape, different side)

**Symptom:** CSV rows lose their trailing columns when they're empty
**Cause:** `split(",")` with the default limit 0 removes trailing empty strings — `"a,b,,"` becomes 2 elements, not 4
**Fix:** `split(",", -1)` preserves positional integrity; better, a real CSV library once quoting appears

**Symptom:** `^` in a log-scanning pattern only ever matches the first line
**Cause:** without `MULTILINE`, `^`/`$` mean input start/end, not line boundaries
**Fix:** compile with `Pattern.MULTILINE` (or prefix `(?m)`) — and add `DOTALL` only if you *also* want `.` crossing lines; they're independent flags

**Symptom:** pattern extracting all items from `"a,b,c,"` with `(\w+,)+` only ever yields `c,` in group 1
**Cause:** a quantified group captures its last repetition only — earlier captures are overwritten
**Fix:** invert the loop: `while (m.find())` with a pattern for *one* item, collecting each hit

**Symptom:** a shared `Matcher` behind a cache returns groups from another request's input under load
**Cause:** `Matcher` is mutable match state and not thread-safe — two threads interleaving `find()`/`group()` corrupt each other
**Fix:** share the `Pattern` (immutable), create a `Matcher` per call — creation is cheap; the compile was the expensive part

## Interview questions

**★ What exactly does `Pattern.compile` buy, and what are the sharing rules for `Pattern` vs `Matcher`?**
`compile` parses the regex into an internal matcher program — the
expensive step. `Pattern` is immutable and thread-safe: build it once
(`static final`) and share freely. `Matcher` is the per-use cursor
holding match state (group boundaries, position); it's mutable, not
thread-safe, and cheap — one per match operation. `String.matches`/
`replaceAll` hide a fresh compile per call, which is the hot-path
smell.

**★ `matches()` vs `find()` vs `lookingAt()` — and which one do developers coming from JS/Perl misuse?**
`matches()` requires the entire input to match; `lookingAt()` anchors
only the start; `find()` scans for the next occurrence anywhere, and
repeated calls iterate all occurrences. JS `test()` and Perl `//`
scan — so `matches()` is the misused one: substring patterns that
"work everywhere else" fail in Java until anchoring intent is made
explicit.

**★ Explain catastrophic backtracking to someone who writes regexes weekly. What shapes, what input, what defenses?**
The engine backtracks: on failure it retries every other way the
quantifiers could have divided the input. If two quantifiers can absorb
the same characters — nested (`(a+)+`) or overlapping alternation
(`(a|aa)+`) — the number of divisions grows exponentially, and a long
input that fails *at the end* forces the engine through all of them.
Matching inputs are fast; the near-miss hangs. Defenses: make the parse
unambiguous (single character class beats alternation of overlapping
sets), possessive quantifiers `x*+` / atomic groups `(?>...)` to forbid
giving back, cap untrusted input length. Java has no match timeout, so
prevention is the only control — this is the ReDoS attack class.

**★ Why is there both a `Pattern.quote` and a `Matcher.quoteReplacement`?**
Two different mini-languages. The *pattern* side gives `.`/`*`/`(` etc.
meaning — `Pattern.quote` wraps input in `\Q...\E` so it matches
literally. The *replacement* side gives `$` (group refs) and `\`
meaning — `quoteReplacement` escapes those. Using the wrong one either
leaves metacharacters live or double-escapes; user data crossing either
boundary needs its side's quoting.

**★ What does a capturing group inside a quantifier return, and how do you actually get every repetition?**
Only the final repetition — `(\w+,)+` over `"a,b,c,"` leaves group 1 as
`"c,"` because each iteration overwrites the capture. To collect all
pieces, flip the structure: write the pattern for one occurrence and
drive it with `while (m.find())`, or `split` on the delimiter, or use
`Matcher.results()` for a stream of `MatchResult`s.

**★ Name the `String.split` behaviors that silently corrupt positional data.**
Default limit 0 strips *trailing* empty strings (`"a,b,,"` → 2
elements) — limit `-1` keeps them. Leading empties are kept, so the
asymmetry itself surprises. And the separator is a full regex: `"."`
or `"|"` split on everything; escape or `Pattern.quote` literals.
Fixed-width or quoted CSV needs a parser, not `split`.

**★ Your service must run user-*supplied* patterns (a search feature). What's your risk posture?**
Treat it as running untrusted code on your CPU. Bound both sides:
pattern length and input length; reject the known-explosive
constructs if feasible (nested quantifiers); run matching with a
deadline via an interruptible `CharSequence` (a `charAt` that checks
`Thread.interrupted()`), on a pool you can afford to lose threads
from — because the engine itself offers no timeout and a single
near-miss input otherwise pins a core indefinitely.

**★ When do you argue *against* a regex in review?**
Nested structure (HTML/JSON/balanced brackets — regular languages
can't count), literal operations (`contains`/`String.replace` — no
engine, clearer), semantic validation hiding behind shape
(`9999-99-99` passes `\d{4}-\d{2}-\d{2}` — parse with `java.time`
instead), and any pattern the author can't explain line-by-line —
`(?x)` comments first, a parser when that fails.

---

← Prev: [JSON with Jackson](05-json-jackson/README.md) · Index: [Phase 7 — I/O, time and the everyday stdlib](README.md) · Next → [UUID and randomness](07-uuid-and-randomness.md)
