---
title: "`skipLibCheck` as a performance lever"
sidebar_label: "08 · `skipLibCheck` as a lever"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript 5.9.3 compiler source read from disk**
> (`sandbox/ts-p0`) — the option descriptions for `skipLibCheck` and
> `skipDefaultLibCheck`, **the predicate that decides whether a file is checked**
> (`typescript.js` ~22820) and the `tsc --init` defaults object are all quoted from
> it — and against the `tsconfig` reference. ⚠️ **The *correctness* trade is
> [phase 7 · 01 · chunk 03](../phase-7-server/01-tsconfig-for-a-node-service/03-target-lib-and-types.md)'s**,
> **that it is not a suppression mechanism is
> [phase 10 · 08 · chunk 03](../phase-10-strictness/08-suppression-directives/03-the-suppression-tiers.md)'s**,
> and **the general rule is phase 6 · 10's** — this page owns only the **performance**
> question those three forward here. **No timing figure is ours. No console block.**

## What it does, in the compiler's own words

> `skipLibCheck` · *"Skip type checking **all** `.d.ts` files."*
> `skipDefaultLibCheck` · *"Skip type checking `.d.ts` files that are included with
> TypeScript."*

🔴 **The word doing the work is "all".** `skipLibCheck` is not a `node_modules`
setting — **it skips your own declaration files too**, including anything you emit
and re-consume. `skipDefaultLibCheck` is the narrow one, limited to the `lib.*.d.ts`
files that ship with the compiler.

## 🔴 The predicate, read from the source

The compiler decides whether to check a file with a single boolean, and it is worth
seeing because it settles several arguments at once (`typescript.js` ~22820,
lightly wrapped):

```js
return options.skipLibCheck && sourceFile.isDeclarationFile
  || options.skipDefaultLibCheck && sourceFile.hasNoDefaultLib
  || !ignoreNoCheck && options.noCheck
  || host.isSourceOfProjectReferenceRedirect(sourceFile.fileName)
  || !canIncludeBindAndCheckDiagnostics(sourceFile, options);
```

Three things fall straight out:

1. 🔴 **`skipLibCheck` is gated on nothing but `isDeclarationFile`.** No path check,
   no `node_modules` special case. **Any declaration file, yours included** — which
   is exactly what the description's "all" means, stated as code.
2. 🔴 **It sits in an OR chain with four other reasons a file goes unchecked** — and
   one of them is **`isSourceOfProjectReferenceRedirect`**. So **project references
   skip checking through the same predicate.** That is worth knowing when you combine
   the two as speed levers ([topic 01 · chunk 04](./01-type-checking-in-ci/04-making-it-fast-enough.md)):
   they are not independent knobs, they are entries in one list.
3. **`noCheck` is in the same chain**, so "skip checking" is a family of settings
   rather than one flag — and any of them can be the reason a file you believed was
   covered is not.

## 🔴 What it saves is a property of your dependencies, not your code

This is the part that decides whether the lever is worth anything **for you**:

> **The `.d.ts` files in `node_modules` are frequently larger than your entire
> source tree.** So the saving scales with **what you install**, not with what you
> write.

Which produces a counter-intuitive pair:

| Project | Saving |
|---|---|
| **Small app, many heavy typed dependencies** | 🔴 **large** — most of the program is declarations |
| **Large app, few dependencies** | ⚪ **small** — your own code dominates, and it is not `.d.ts` |

⚠️ **So a figure quoted from someone else's project tells you nothing about yours.**
📌 **Measure it the same way as anything else in this phase:
`--extendedDiagnostics` with it on and off, warm, on one machine**
([topic 06](./06-diagnosing-a-slow-compile/01-measure-before-you-guess.md)). It is
one of the easiest levers to measure honestly, because it is a single boolean.

## 🔴 It is already on in a new project

The `tsc --init` defaults object in 5.9.3 is short, and this is all of it:

```js
strict: true,
esModuleInterop: true,
forceConsistentCasingInFileNames: true,
skipLibCheck: true
```

**Four settings, and `skipLibCheck` is one of them.** 📌 **So on most codebases the
real question is not "should we enable it?" but "should we turn it off?"** — and
that reframing matters, because turning it off is a change to *defend*, whereas
leaving a default in place usually is not.

⚠️ **It also means many teams have it on without a decision having been made**,
which is worth knowing before someone reports it as a discovery.

## What you give up, precisely

**The boundary, stated as narrowly as it can be:**

> 🔴 **It helps when *their* `.d.ts` fails to compile internally. It does nothing
> when their types are wrong *about* the API.**

So the errors it hides are the ones **inside** declaration files: two versions of a
library in the tree declaring conflicting globals, a `.d.ts` requiring a newer `lib`
than you target, a package whose own types do not compile.

⚠️ **And the thing it is most often blamed for, it cannot do.** It **cannot** silence
an error at your call site — your code is checked against those declarations either
way ([phase 10 · 08 · chunk 03](../phase-10-strictness/08-suppression-directives/03-the-suppression-tiers.md)).
**It is not a suppression mechanism**, and it keeps being proposed as a fix for
errors it has no reach over.

📌 **Which makes the trade unusually clean for a performance lever:** you are giving
up the internal consistency of other people's declaration files — a class of error
you cannot fix anyway, in code you do not own — in exchange for a saving you can
measure in one command.

## Gotchas

**Symptom:** `skipLibCheck` was enabled and an error at a call site did not go away.
**Cause:** it skips checking *inside* `.d.ts` files; your call sites are checked
regardless.
**Fix:** 🔴 it is not a suppression mechanism and cannot become one. Read the error
as being about your code.

**Symptom:** it was enabled for speed and the build barely changed.
**Cause:** your source dominates the program — the saving scales with your
*dependencies*.
**Fix:** measure rather than assume, and look elsewhere. ⚠️ A number from another
project predicts nothing about yours.

**Symptom:** a declaration file you wrote stopped being checked.
**Cause:** "all `.d.ts` files" includes yours — the predicate tests only
`isDeclarationFile`.
**Fix:** if you hand-author declarations, that is a real loss. 📌 Check them in a
separate configuration, or accept it knowingly.

**Symptom:** enabling project references *and* `skipLibCheck` produced a smaller
combined win than expected.
**Cause:** they are entries in the same skip predicate, so their effects overlap
rather than stack.
**Fix:** measure the combination, not each in isolation.

**Symptom:** a duplicate-identifier error from two versions of a library appears
after turning it off.
**Cause:** exactly what it was hiding — an error *inside* declarations.
**Fix:** deduplicate the dependency. 📌 This is the most common thing it conceals,
and it is a real problem worth seeing at least once.

**Symptom:** someone proposes enabling it as a fix for a wrong third-party type.
**Cause:** confusing "their types do not compile" with "their types are wrong".
**Fix:** ⚠️ it only helps with the first. A wrong-but-valid declaration is untouched
by it, and that is phase 6 · 10's boundary.

**Symptom:** a team debates enabling it and it is already on.
**Cause:** `tsc --init` sets it.
**Fix:** check the effective config first — `--showConfig`
([topic 01 · chunk 02](./01-type-checking-in-ci/02-what-the-gate-guarantees.md)).
The live question is usually whether to turn it *off*.

## Interview questions

**What does `skipLibCheck` actually skip?**
Type checking inside all `.d.ts` files — the compiler's predicate is gated on
nothing but `isDeclarationFile`, with no path or `node_modules` special case. So it
includes declaration files you wrote yourself, which the option's own description
signals with the word "all".

**How much does it save?**
That depends on your dependencies rather than your code, because the declarations in
`node_modules` are often larger than the source tree. A small app with many heavily
typed dependencies can save a lot; a large app with few dependencies saves little.
It is one boolean, so it is one of the easiest levers to measure honestly — and a
figure from someone else's project predicts nothing.

**What does it cost you?**
The internal consistency of declaration files: conflicting globals from two versions
of a library, a `.d.ts` needing a newer `lib` than you target, a package whose own
types do not compile. Precisely: it helps when *their* declarations fail to compile
internally, and does nothing when their types are simply wrong about the API.

**Can it hide an error in your own code?**
No, and this is the persistent misconception. Your call sites are checked against
those declarations either way, so it cannot affect assignability in your code. It is
not a suppression mechanism, and it keeps being proposed as a fix for errors it has
no reach over.

**Is it on by default?**
It is in the four-setting `tsc --init` defaults, alongside `strict`,
`esModuleInterop` and `forceConsistentCasingInFileNames`. So most projects have it
without anyone having decided, and the live question is usually whether to turn it
off — which is a change that needs defending, rather than a default that does not.

**Does it stack with project references?**
Not cleanly. Both appear in the same predicate that decides whether a file gets
checked — `isSourceOfProjectReferenceRedirect` is another branch of the same OR — so
their effects overlap rather than add. Measure the combination you actually intend
to ship.

---

← [07 · Editor performance](./07-editor-performance.md) · [Phase 12 index](./README.md)
