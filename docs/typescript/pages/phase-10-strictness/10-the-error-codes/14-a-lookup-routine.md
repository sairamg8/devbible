---
title: "A routine for any code you have not seen"
sidebar_label: "14 · A lookup routine"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08. This chunk introduces no new codes — every one it references
> is quoted from the **TypeScript 5.9.3** numbered diagnostic table in the chunk
> that owns it, and the checker-order claims it summarises are read from the
> functions named there. **No sandbox, no console block.**

Thirteen chunks of detail are only useful if there is something to do when the
code is not one of them. There are **2,073 diagnostics** and you have met perhaps
forty.

> 🔴 **The routine is four questions, and the first two do not require knowing the
> code at all.** Most of the value in this topic is not the nine codes — it is that
> the number's *range* and the *specificity of the message* between them narrow
> almost anything.

## The routine

### 1. Is this error's file the problem, or is something above it?

**Read the top of the output first.** A **1xxx** code means the file did not parse
and every type error in it is noise. A **5xxx** code means the configuration is
wrong, which can change which files are in the program and which `lib` is loaded —
manufacturing every error beneath it
([chunk 13](./13-the-suppress-codes-are-gone.md) is a real instance).

📌 **This step costs five seconds and occasionally eliminates the entire output.**

### 2. What does the range say?

| Range | It means | So look at |
|---|---|---|
| 1xxx | the parser | syntax, in this file only |
| 2xxx | the checker | a real type problem |
| 4xxx / 9xxx | declaration emit | your `.d.ts` output, not your code |
| 5xxx | options | `tsconfig.json` |
| 6xxx | mostly help text — but the unused-code family is here | either |
| 7xxx | 🔴 `noImplicitAny` refusing an implicit `any` | a missing type, not a wrong one |
| 8xxx | TypeScript syntax in a `.js` file | the file extension or `allowJs` |
| 17xxx | JSX | `--jsx`, or a tag |
| 18xxx | ⚠️ nothing — an overflow range | read the message |
| 80xxx+ | 🔴 not errors — suggestions and quick-fix labels | nothing; it cannot fail a build |

[Chunk 01](./01-what-a-code-is.md) has the counts and the reasoning.

### 3. Which family is it?

Five families cover the nine codes and most of their relatives. **Each has one
question that resolves it:**

| Family | Codes | The question |
|---|---|---|
| **The shape is wrong** | `2322` `2345` and 15 elaboration codes | *Which nested line is the real one?* → [02](./02-the-shape-is-wrong.md) |
| **The name is wrong** | `2339` `2551` `2304` `7053` | *What did the compiler rule out before saying this?* → [06](./06-the-name-is-wrong.md), [07](./07-cannot-find-name.md), [09](./09-the-index-codes.md) |
| **You have not proved it** | `18046` `18048` and their pairs | *Can I bind this to a `const` and narrow it?* → [10](./10-you-have-not-proved-it.md) |
| **The condition is decided** | `2367` and six siblings | *Is the type lying, or is the branch dead?* → [11](./11-the-condition-is-decided.md) |
| **Out of room** | `2589` `2590` `2321` | *Which single expression is it?* → [12](./12-out-of-room.md) |

### 4. Read the message's own specificity

🔴 **This is the step that generalises to codes you have never seen**, and it is
the single most useful idea in the topic:

> **TypeScript's diagnostics are ordered ladders, and the generic message is
> always the last rung.** Three independent ladders in this topic have that shape —
> property lookup ([chunk 06](./06-the-name-is-wrong.md)), name lookup
> ([chunk 07](./07-cannot-find-name.md)), and element access
> ([chunk 09](./09-the-index-codes.md)). In each, the compiler tries five or six
> specific diagnoses first and falls back to the vague one.

**So the specificity of the message you got is information:**

- **A message naming your fix** — *"Did you mean the static member…"*, *"Try
  changing the 'lib' compiler option to 'es2022'"*, *"Try `npm i --save-dev
  @types/node`"*, *"Did you mean 'typeof x'?"* — **is the answer.** Do it. The
  compiler ran a check to earn that sentence.
- **A related-information line** — *"Did you forget to use 'await'?"*, *"An argument
  for 'options' was not provided"*, *"'x' is declared here"* — **is also a verified
  finding**, not a guess. ⚠️ And it is the thing most often lost, because it prints
  as a separate line with a different file and position, and many log formats drop
  it.
- **The generic message** — bare `TS2339`, bare `TS2304`, *"Object is possibly
  'undefined'"* — means **every specific cause was ruled out.** That is a stronger
  statement than it looks, and it usually means *the type is wrong*, not the code.

## The five sight-reads worth memorising

Not a lookup — these resolve without thinking:

1. 🔴 **Any type printed as `Promise<…>` in an error → a missing `await`.** The
   compiler checked. It fires under `TS2367`, `TS2339` and `TS2801`.
2. 🔴 **The same type name on both sides of a `TS2322` → read your lockfile.**
   `TS2719`; two copies of one declaration
   ([chunk 03](./03-two-types-with-one-name.md)).
3. 🔴 **A 7xxx code → `noImplicitAny`, not a type error.** The value has no type;
   the flag refused to invent one ([chunk 09](./09-the-index-codes.md)).
4. 🔴 **An *anonymous* nullability message → the expression has no name, so you
   cannot narrow it in place.** Bind it to a `const` first
   ([chunk 10](./10-you-have-not-proved-it.md)).
5. 🔴 **`TS2589` → one expression, never project size.** Split the chain into named
   intermediates ([chunk 12](./12-out-of-room.md)).

## Three ways to make the compiler tell you more

**Name the subexpression.** The cheapest error-quality improvement available: it
upgrades anonymous nullability messages to named ones, moves contextual-typing
errors out of a call and onto the callback, and gives `TS2589` a fresh
instantiation budget. ⚠️ **It does nothing for invocation** — `TS2721`–`TS2723`
have no named form.

**Turn truncation off, temporarily.**

```json
{ "compilerOptions": { "noErrorTruncation": true } }
```

Left on it makes every error worse; switched on for one investigation it reveals
what the `...` was hiding.

**Annotate to move the error.** An explicit return type moves a `TS2322` from the
whole function onto the offending `return`. An explicit parameter type moves a
contextual error onto the callback. `satisfies` checks without widening, so the
error lands on the offending property rather than the whole object
([phase 2](../../phase-2-narrowing/10-satisfies/README.md)).

## When to look a code up, and where

**Grep the compiler's own table** rather than searching the web for the sentence —
the wording changes between releases and the number does not. Both files are
already in this repo:

```bash
# code -> message, TypeScript 5.9.3 (the JS build carries the numbered table)
grep -o '_2345", "[^"]*"' sandbox/ts-p0/node_modules/typescript5/lib/typescript.js

# an option's record: its default, its category, and whether `strict` enables it
grep -n -A14 'name: "noUncheckedIndexedAccess"' sandbox/ts-p0/node_modules/typescript5/lib/typescript.js
```

⚠️ **And the limit of that technique**, learned the hard way in
[chunk 13](./13-the-suppress-codes-are-gone.md): **the option table is
authoritative about defaults and categories, not about whether a flag still
works.** Two removed options still advertise `affectsSemanticDiagnostics: true`.
Grep for an option's *consumers*, not its declaration.

## Gotchas

**Symptom:** you fix errors for an hour and the count barely moves.
**Cause:** you started at the bottom of the output. A parse error or an option
error at the top was generating most of them.
**Fix:** step 1, every time.

**Symptom:** you search the exact error text and find nothing relevant.
**Cause:** the wording changed between releases.
**Fix:** search the code. `TS2589` finds every version's discussion of the same
problem.

**Symptom:** a colleague's editor shows a problem yours does not, with identical
settings.
**Cause:** one of you is looking at a `Suggestion`-category code — the 7043–7050
band, or all of 80xxx. CI is structurally unable to report those.
**Fix:** if you want it enforced, find the Error-category equivalent and enable its
flag.

**Symptom:** you take a `Did you mean` suggestion and it is wrong.
**Cause:** only one candidate is ever returned and ties break on declaration
order ([chunk 08](./08-the-spelling-budget.md)).
**Fix:** read the target type. The suggestion is a measurement, not an intent.

**Symptom:** the error is on a line that is plainly correct.
**Cause:** contextual typing, an upstream assertion, or an earlier narrowing. All
three report at a place that is not the mistake.
**Fix:** annotate to move the error, or look upward for the `as` that made the type
lie.

**Symptom:** an important hint never appears in CI.
**Cause:** it is related information — a separate diagnostic with its own
position — and your log formatter drops it.
**Fix:** reproduce in an editor for anything confusing, and learn the sight-reads
above so you do not depend on the hint.

**Symptom:** you reach for `as` to move on.
**Cause:** normal, and it is the thing this whole phase exists to make you notice.
**Fix:** ask which of the two types is wrong. One of them is. **12 · Assertion
discipline** *(not written yet)* is where that becomes a policy rather than a
resolution.

## Interview questions

**Walk me through how you approach an error code you have never seen.**
Four steps. First, check whether something above it is the real cause — a 1xxx
parse error invalidates every type error in its file, and a 5xxx option error can
manufacture the whole wall. Second, use the range: 2xxx is the checker, 7xxx is
`noImplicitAny` refusing an implicit `any`, 4xxx and 9xxx are declaration emit,
5xxx is the config, 80xxx and above cannot fail a build at all. Third, place it in
a family — shape, name, unproven, decided condition, out of room — each of which
has one question that resolves it. Fourth, read how *specific* the message is,
because TypeScript's diagnostics are ladders and the generic message is the last
rung.

**What does it mean that TypeScript's diagnostics are "ladders"?**
That for several common failures the compiler tries a sequence of specific
diagnoses and falls back to a vague one. Property lookup, name lookup and element
access all work this way. The consequence is that a message naming your fix — a
`lib` version, an install command, a static member, `typeof` — is a verified
finding rather than a hint, and the *generic* message means every specific cause
was ruled out. So a bare `TS2339` is a stronger statement than a specific one: it
says the type genuinely lacks the property, which makes the type the thing to
question.

**Which single habit improves error quality most?**
Naming subexpressions. It upgrades anonymous nullability messages to ones that
name the value, makes that value narrowable at all, moves contextual-typing errors
off a call site and onto the callback where the mistake is, and gives `TS2589` a
fresh instantiation budget because the counter resets per expression. The one place
it does nothing is invocation, which has no named diagnostic variant.

**How do you look up what an error code means, reliably?**
Grep the compiler's own numbered diagnostic table rather than searching for the
prose, because message wording changes between releases and codes do not. For an
option, read its record for the default and category — but do not conclude from
the record that the option works, since two removed options in 5.9.3 still
advertise `affectsSemanticDiagnostics: true`. Grep for the option's consumers to
answer that.

**Give three errors where the reported line is not the mistake.**
Contextual typing — a mistake inside an inline callback surfaces as a failure of
the whole call. An upstream `as` — a `TS2367` on a value that came through an
assertion is the assertion being wrong, not the comparison. And narrowing — a
comparison that errors because an earlier branch already excluded the value. In all
three the fix is upstream of the error.

**Of the nine codes in this topic, which one is not what its name suggests?**
`TS7053`. It reads as an indexing error and it is not a type error at all — it is
`noImplicitAny` declining to insert an implicit `any`, and the entire reporting
branch is inside a check on that flag. With the flag off the expression silently
becomes `any` and the program compiles, so the code is a report that a type is
*missing* rather than wrong.

---

← [13 · The suppress codes are gone](./13-the-suppress-codes-are-gone.md) · [Topic index](./README.md) · **End of topic** → [Phase 10 index](../README.md)
