---
title: "What a diagnostic code actually is"
sidebar_label: "01 · What a code is"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 by **counting the compiler's own numbered diagnostic table**
> in the **TypeScript 5.9.3** build (`sandbox/ts-p0/node_modules/typescript5/`) —
> **2,073 entries across 13 numeric ranges**, with each entry's
> `DiagnosticCategory` read from the table rather than assumed. The category enum
> (`0 Warning · 1 Error · 2 Suggestion · 3 Message`) and the 7043–7050 Suggestion
> band are read from the same file. Cross-checked against the string table
> compiled into the **TypeScript 7.0.2** native binary. **No sandbox, no console
> block** — this page reports what is *in* two files on disk, which is a file
> read, not a compiler run.

Before the nine codes, the thing nobody explains: **what the number is, and what
it is for.** Learning it once turns every future error from a paragraph to be
read into a key to be looked up.

> **The code is stable. The message is not.** `TS2322` has meant *"Type '{0}' is
> not assignable to type '{1}'"* for a decade. The **wording** of a diagnostic
> changes between releases without notice — this corpus has already caught
> `TS5096` being reworded between 5.9.3 and 7.0.2. So **search by code, never by
> sentence**, in your codebase, your issue tracker and your CI logs alike.

## The message is a template, not a sentence

Every entry in the table is a format string with numbered slots:

```text
Property '{0}' does not exist on type '{1}'.            ← TS2339, the template
Property 'nmae' does not exist on type 'User'.          ← what you see
```

Two consequences that matter in practice:

- **The quoted parts are the only per-error information.** Everything outside the
  quotes is boilerplate that will look identical on every instance of that code.
  Read the slots first.
- 📌 **Grepping your own logs for the prose is fragile; grepping for `TS2339` is
  not.** This is why baselines, `eslint` overrides and CI allowlists are all keyed
  on numbers.

## The ranges, and what each one tells you

Counted from the 5.9.3 table. **The range narrows the cause before you read a
single word of the message**, which is most of the value:

| Range | Count | What it is | What it means for you |
|---|---|---|---|
| **1xxx** | 449 | **Parser and grammar.** *"Unterminated string literal"*, *"'{0}' expected"* | 🔴 **The file did not parse.** Every type error reported in that file is downstream noise — fix these first |
| **2xxx** | 530 | **The checker.** The largest range, and where almost everything you meet lives | A real type problem. All nine codes in this topic except `7053`, `18046` and `18048` are here |
| **4xxx** | 110 | **Declaration emit.** *"Type parameter '{0}' of exported class has or is using private name"* | Your code type-checks; the **`.d.ts` cannot be written**. Only appears with `declaration: true` |
| **5xxx** | 64 | **Options and the command line.** `TS5023` unknown option, `TS5096`, `TS5101`/`TS5102` | 🔴 **Your `tsconfig.json` is wrong, not your code.** Fix before believing anything else |
| **6xxx** | 474 | **Mostly `--help` text** (431 of 474 are `Message`) — but **43 are Errors**, including the whole unused-code family | Mixed range. `6133` and friends are real findings; the rest is UI text |
| **7xxx** | 53 | **The `noImplicitAny` family.** *"…implicitly has an '{1}' type"* | 🔴 **Not a type error — a refusal to insert an implicit `any`.** See [chunk 09](./09-the-index-codes.md) |
| **8xxx** | 35 | **TypeScript syntax in a JavaScript file**, and refactor restrictions | You are in a `.js` file under `allowJs` |
| **9xxx** | 34 | **`isolatedDeclarations` and declaration-emit strictness.** `TS9007` *"Function must have an explicit return type annotation with --isolatedDeclarations"* | A flag you turned on is asking for an annotation |
| **17xxx** | 20 | **JSX** | `--jsx` is unset, or a tag is unbalanced |
| **18xxx** | 51 | ⚠️ **No theme at all** — see below | The number tells you nothing; read the message |
| **69xxx** | 1 | A single stray `Message` | Curiosity |
| **80xxx** | 10 | **All `Suggestion`** — *"File is a CommonJS module; it may be converted to an ES module"* | 🔴 **Never fails a build.** Editor hint only |
| **90xxx** | 50 | **All `Message`** — *"Add missing `super()` call"* | Not a diagnostic |
| **95xxx** | 192 | **All `Message`** — *"Convert function to an ES2015 class"*, *"Extract to {0} in {1}"* | Not a diagnostic |

🔴 **242 of the 2,073 entries are not diagnostics.** The 90xxx and 95xxx ranges
are the **labels on your editor's lightbulb menu**, stored in the same table as
the errors. If you have ever wondered why a "TypeScript error list" you found
online contained *"Extract to constant in enclosing scope"*, that is why.

## ⚠️ 18xxx is the range that means nothing

The other ranges are thematic. **18xxx is an overflow range**, opened when the
low numbers ran out of contiguous room, and its 51 entries have no common
subject:

- `18002`/`18003` — **config file** problems (*"No inputs were found in config
  file"*)
- `18006`–`18030` — **private identifiers** (`#field`)
- `18031`/`18032` — **intersection reduced to `never`**
- `18042`–`18044` — **types in JavaScript files**
- `18046`–`18049` — 🔴 **the nullability quartet**, two of which are in this
  topic's list of nine

So `TS18048` sits next to *"'#!' can only be used at the start of a file"* for no
reason except arrival order. **Do not read meaning into an 18xxx number** — it
means "added after the ranges filled up". Everywhere else, the range is a real
signal; here it is an accident of history.

## 🔴 Three categories, and only one of them fails a build

The table's category field is an enum with four values, of which three are used:

| Value | Category | Behaviour |
|---|---|---|
| `1` | **Error** | Fails `tsc`. Red squiggle |
| `2` | **Suggestion** | 🔴 **Never fails a build.** Grey squiggle, or a lightbulb |
| `3` | **Message** | Informational text — help output, related-information lines |
| `0` | Warning | Declared in the enum, **used by nothing** in 5.9.3 |

📌 **TypeScript has no warning level.** The `0 /* Warning */` slot exists and is
empty: every real finding is either a hard error or an editor-only suggestion,
with nothing in between. That is a deliberate design position, and it is why
"just make it a warning" is not an available answer to any strictness argument —
[topic 08](../08-suppression-directives/03-the-suppression-tiers.md) is what you
get instead.

## 🔴 The Suggestion mirror — the same finding, twice, under two codes

The clearest demonstration that the category is a *presentation* choice rather
than a severity: **eight 7xxx findings exist twice**, once as an Error and once
as a Suggestion with an extra clause.

| Error (fires under `noImplicitAny`) | Suggestion twin | The twin's extra clause |
|---|---|---|
| `TS7005` *Variable '{0}' implicitly has an '{1}' type.* | `TS7043` | *…but a better type may be inferred from usage.* |
| `TS7006` *Parameter '{0}' implicitly has an '{1}' type.* | `TS7044` | same |
| `TS7008` *Member '{0}' implicitly has an '{1}' type.* | `TS7045` | same |
| `TS7034` *Variable '{0}' implicitly has type '{1}' in some locations…* | `TS7046` | same |
| `TS7019` *Rest parameter '{0}' implicitly has an 'any\[]' type.* | `TS7047` | same |
| *(get accessor)* | `TS7048` | *…for its get accessor…* |
| *(set accessor)* | `TS7049` | *…for its set accessor…* |
| `TS7010`/`TS7011` *…implicitly has an '{0}' return type.* | `TS7050` | same |

**So turning `noImplicitAny` off does not remove the finding — it demotes it to
grey.** The compiler still computes it, still knows a better type is inferable
from usage, and still offers *"Infer parameter types from usage"* on the
lightbulb. It just stops failing.

⚠️ **This is the second independent instance of the same three-state mechanism in
this phase.** [Topic 06](../06-the-other-correctness-flags/03-control-flow-flags.md)
found that `allowUnreachableCode` and `allowUnusedLabels` default to `undefined`
rather than `false`, giving exactly these three states — suggestion, silent,
error. Two unrelated features, same pattern: **the editor is stricter than your
build, by default, and nobody configured that.**

📌 The practical read: **if a colleague says "my editor shows something yours
doesn't", the difference is often not settings — it is that one of you is looking
at a Suggestion-category code that CI is contractually unable to report.**

## The order to fix them in

Not a style preference — a consequence of the compiler's own phases:

1. **1xxx first.** Parse errors mean the syntax tree is a guess. Type errors in
   that file are meaningless until it parses.
2. **5xxx second.** An option error can change which files are even in the
   program, which `lib` is loaded, and therefore which 2xxx errors exist. A
   `TS5023` at the top of your output can be the sole cause of a hundred `TS2304`s
   below it.
3. **2xxx / 7xxx / 18xxx third.** Real findings, in whatever order they appear.
4. **4xxx / 9xxx last.** Declaration-emit failures are about the *output*, and
   are usually the same handful of root causes repeated.

🔴 **Step 2 is the one people skip**, and it produces the most wasted time: a
misspelled or removed option is a quiet single line above a wall of type errors
that are all its fault. [Chunk 13](./13-the-suppress-codes-are-gone.md) is an
entire real instance of this.

## Gotchas

**Symptom:** you search the web for an error's exact wording and find nothing.
**Cause:** the message text was reworded in a release. `TS5096`'s wording differs
between 5.9.3 and 7.0.2, and the 5.9 phrasing is **absent** from the 7.0.2 binary.
**Fix:** search the code. `TS5096` finds every version's discussion of the same
problem.

**Symptom:** a "list of TypeScript error codes" includes things like *"Extract to
constant in enclosing scope"*.
**Cause:** it was scraped from the diagnostic table, which also holds the 242
quick-fix and refactor labels in 90xxx/95xxx.
**Fix:** ignore anything at 90xxx or above; those are menu items.

**Symptom:** your editor reports a problem `tsc` does not.
**Cause:** the code is `Suggestion` category — the 7043–7050 band, or all of
80xxx. The build is structurally incapable of reporting it.
**Fix:** if you want it enforced, find the *Error*-category equivalent and turn
its flag on. For the 7043–7050 band that flag is `noImplicitAny`.

**Symptom:** a hundred `TS2304 Cannot find name` errors appear after a config
change.
**Cause:** an option error changed the program — usually `lib`, `types` or
`include`. The 5xxx line is above the wall and easy to scroll past.
**Fix:** read the first five lines of output, not the last five.

**Symptom:** you fix a 2xxx error and three new ones appear.
**Cause:** normal. The checker stops elaborating past a failure, so fixing one
reveals the next. It is progress, not regression.
**Fix:** `tsc --noEmit` in a loop; only the *trend* matters.

**Symptom:** an error's crucial type is printed as `...`.
**Cause:** error truncation.
**Fix:** `noErrorTruncation: true`, temporarily —
[topic 04](../04-reading-a-typescript-error.md) covers this.

**Symptom:** a 4xxx error on code that compiles fine for everyone else.
**Cause:** you have `declaration: true` and they do not. 4xxx is declaration
emit; the *checking* passed.
**Fix:** the fix is almost always an explicit annotation or an `export` on a type
that is currently local.

## Interview questions

**Why do TypeScript errors have numbers at all?**
Because the message text is not stable and the number is. The code is the key you
search, baseline, and reference in an issue; the sentence around it can be
reworded in any release. This corpus has a measured instance — `TS5096`'s wording
differs between 5.9.3 and 7.0.2, and the older phrasing does not exist in the
newer compiler at all.

**What does the range of a code tell you?**
Most of the cause, before you read the message. 1xxx is the parser, so nothing
else in that file is trustworthy. 5xxx is your `tsconfig`, not your code. 2xxx is
the checker. 7xxx is `noImplicitAny` declining to insert an implicit `any`. 4xxx
and 9xxx are declaration emit, meaning the code checks but the `.d.ts` cannot be
written. The exception is 18xxx, which is an overflow range with no theme.

**Does TypeScript have warnings?**
No. The category enum has a `Warning` value and nothing uses it. Every finding is
either an Error that fails the build or a Suggestion that only ever appears in an
editor. There is no middle setting, which is why the suppression directives and
the strictness flags carry all the weight that a warning level would otherwise
carry.

**What happens to the findings when you turn `noImplicitAny` off?**
They are demoted, not removed. Eight of them have Suggestion-category twins in
the 7043–7050 band, each carrying the extra clause *"but a better type may be
inferred from usage"*. The compiler still computes the finding and still offers
the "infer from usage" quick fix; it simply stops failing the build. So a
codebase with `noImplicitAny: false` is one where every developer's editor is
quietly reporting work that CI can never enforce.

**Which errors should you fix first in a large failing build?**
Parse errors, then option errors, then type errors. Parse errors invalidate every
type error in the same file. Option errors can change which files are in the
program and which `lib` is loaded, so a single `TS5023` or `TS5102` above the wall
is frequently the cause of everything below it. Only then is the 2xxx list worth
reading.

**Why do 90xxx and 95xxx codes exist?**
They are not diagnostics. They are the strings on your editor's quick-fix and
refactor menu — *"Add missing `super()` call"*, *"Convert function to an ES2015
class"* — stored in the same numbered table as the errors because the language
service ships in the same binary. 242 of the table's 2,073 entries are these.

---

← [Topic index](./README.md) · Next → [02 · The shape is wrong](./02-the-shape-is-wrong.md)
