---
title: "What `skipLibCheck` actually skips"
sidebar_label: "01 · What it actually skips"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TSConfig reference** entry for `skipLibCheck`
> (quoted verbatim below) and — for everything the reference does not say — the
> compiler's own **option record and `skipTypeCheckingWorker` predicate** in the
> installed **TypeScript 5.9.3** build, with the description string cross-checked
> against the **7.0.2** native binary. **No sandbox, no console blocks.**

Almost every `tsconfig.json` you will ever open has this line in it. Very few of
the people who wrote it could tell you what it turns off, and the documentation's
one-line summary — *"Skips type checking of all declaration files (`*.d.ts`)"* —
is true but leaves out the two things that actually matter: **which** declaration
files, and **which** kinds of error.

Both answers are in the compiler, in one predicate, and neither is what most
people assume.

## The option record

```js
{
  name: "skipLibCheck",
  type: "boolean",
  // We need to store these to determine whether `lib` files need to be rechecked
  affectsBuildInfo: true,
  category: Diagnostics.Completeness,
  description: Diagnostics.Skip_type_checking_all_d_ts_files,
  defaultValueDescription: false
}
```

Three things are worth reading off that record before anything else.

**It has no `affectsSemanticDiagnostics` and no `affectsEmit`.** Compare it with
`esModuleInterop`, which carries both — [topic 09 chunk 02](../09-esmoduleinterop-and-default-imports/02-the-two-flags.md)
is built on that one line. `skipLibCheck` changes **nothing in the output**. Your
emitted JavaScript and your emitted `.d.ts` files are byte-identical with it on
or off. It is purely a decision about how much work the checker does.

🔴 **Its category is `Completeness`.** That is not a throwaway label — it is the
`tsc --help` grouping, and `skipLibCheck` is one of only two options in it (the
other is `skipDefaultLibCheck`, [chunk 05](./05-skipdefaultlibcheck-and-neighbours.md)).
It is not filed under `Type_Checking`, and it is emphatically not filed under
`Backwards_Compatibility`, which is where the compiler keeps
`suppressImplicitAnyIndexErrors` and the rest of the genuine suppression flags —
a point [phase 10 makes about the suppression ladder](../../phase-10-strictness/08-suppression-directives/03-the-suppression-tiers.md).
The compiler's own taxonomy says: *this flag is about how complete the check is,
not about hiding errors you would otherwise have to fix.*

**Its documented default is `false`.** An unconfigured program checks every
`.d.ts` in the program, including the several megabytes of them in
`node_modules`. ⚠️ The TSConfig reference says something different — *"Default:
`true` (as of TypeScript 5.4)"* — and that conflict is real, worth resolving, and
resolved in [chunk 06](./06-who-turns-it-on-for-you.md). The short version: the
compiler default is `false`; what changed is the config `tsc --init` writes.

## The gate — one predicate, six call sites

Everything this flag does happens in a single function:

```js
function skipTypeCheckingWorker(sourceFile, options, host, ignoreNoCheck) {
  return options.skipLibCheck && sourceFile.isDeclarationFile
    || options.skipDefaultLibCheck && sourceFile.hasNoDefaultLib
    || !ignoreNoCheck && options.noCheck
    || host.isSourceOfProjectReferenceRedirect(sourceFile.fileName)
    || !canIncludeBindAndCheckDiagnostics(sourceFile, options);
}
```

Read the first clause carefully, because it is the whole topic:

> 🔴 **`options.skipLibCheck && sourceFile.isDeclarationFile`**

**There is no mention of `node_modules`.** No path test, no "is this a
dependency", no "did I write this". The only question asked is whether the file
is a declaration file — and a declaration file is any file the compiler parsed as
one, wherever it came from. [Chunk 02](./02-it-skips-your-declarations-too.md) is
entirely about the consequences of that, because they are not small.

The second thing to notice is the **company this clause keeps**. It sits in the
same `||` chain as `noCheck` (the compiler's "do not type-check anything" flag)
and `isSourceOfProjectReferenceRedirect` (a file that belongs to a referenced
project and is therefore somebody else's job). The compiler does not model
`skipLibCheck` as a diagnostic filter that runs after checking. It models it as
membership of the *"do not check this file at all"* family — the check never
starts.

That distinction is why the flag behaves so unlike a suppression directive, and
it is the reason the whole of [chunk 04](./04-what-it-does-not-do.md) exists.

### Where the predicate is consulted

`skipTypeChecking` is called from exactly six places in 5.9.3, and the list is
the precise definition of "what stops happening":

| Call site | What it gates |
|---|---|
| `getProgramDiagnostics` | program-level diagnostics attributed to the file |
| `getBindAndCheckDiagnosticsForFileNoCache` | bind + check diagnostics — the semantic errors |
| `checkSourceFileWorker` | 🔴 the checker's own walk of the file. It returns **before** `checkGrammarSourceFile` |
| `checkSourceFileNodesWorker` | the same walk, for the editor's partial-file checking |
| `getSuggestionDiagnostics` | the editor's suggestion (grey squiggle) pass |

And the sixth is in the language service — `getRegionSemanticDiagnostics`, the
editor's viewport-limited check, which bails on the same predicate.

🔴 **The third row is the one nobody expects**, and it has a chunk of its own:
because `checkSourceFileWorker` returns before calling `checkGrammarSourceFile`,
`skipLibCheck: true` also silences the **grammar rules that define what a `.d.ts`
file is allowed to contain**. [Chunk 03](./03-the-file-format-rules-go-quiet.md)
proves that and shows exactly which diagnostics go quiet.

## What is *not* gated — and this is the useful half

`getSyntacticDiagnosticsForFile` has **no** `skipTypeChecking` call:

```js
function getSyntacticDiagnosticsForFile(sourceFile) {
  if (isSourceFileJS(sourceFile)) { … }
  return sourceFile.parseDiagnostics;
}
```

It returns the parser's diagnostics directly. So:

> ✅ **A `.d.ts` that does not parse still fails the build, `skipLibCheck` or
> not.** Unbalanced braces, a stray character, an unterminated string — the
> parser produced an error and nothing filters it out.

That is a genuinely useful guarantee and it is worth holding onto, because it
draws the line for you: **`skipLibCheck` trades away meaning, never syntax.** A
dependency that ships a corrupt file is still caught. A dependency that ships a
well-formed file making a false claim is not.

`getDeclarationDiagnosticsForFile` is not gated either, but for a different
reason — it early-returns `emptyArray` for any file where `isDeclarationFile` is
true, because declaration-emit errors are about the `.ts` files you are emitting
*from*. `skipLibCheck` has nothing to do with them, which matters when someone
proposes it as a fix for the `TS4053` family that
[topic 07 chunk 08](../07-authoring-d-ts-files/08-when-declaration-emit-fails.md) covers.

## So the honest one-line summary

Not *"it skips checking node_modules"*. It is:

> **For every file in the program that is a declaration file, the checker does
> not run. Parsing still does.**

Everything else in this topic is a consequence of those two sentences.

## Gotchas

**Symptom:** `skipLibCheck: true` was set to speed up the build and a `.d.ts` in
`node_modules` still produces an error.
**Cause:** It is a *syntax* error. `getSyntacticDiagnosticsForFile` is not gated
by the predicate — the parser's diagnostics always survive.
**Fix:** The dependency ships a broken file. This flag cannot help; report it
upstream or patch the file.

**Symptom:** Someone claims the flag "skips `node_modules`".
**Cause:** The near-universal mental model, and the only case anyone tests.
**Fix:** The test is `sourceFile.isDeclarationFile`, with no path component at
all. Chunk 02.

**Symptom:** Enabling the flag was expected to change the emitted output.
**Cause:** Its option record has neither `affectsEmit` nor
`affectsSemanticDiagnostics`.
**Fix:** Nothing to fix — the emit is identical. If the output changed, something
else in the config changed with it.

**Symptom:** The flag was added to make an error in application code go away and
nothing happened.
**Cause:** The gate is per source file, and your `.ts` file is not a declaration
file.
**Fix:** The error is yours. Chunk 04 lists what the flag genuinely cannot
affect.

**Symptom:** A reviewer files `skipLibCheck` alongside `@ts-ignore` in a
"suppression audit".
**Cause:** Both make errors disappear, so they look like the same category.
**Fix:** The compiler files it under `Completeness`, not
`Backwards_Compatibility`, and it cannot suppress a single diagnostic in code you
wrote. Different mechanism, different audit.

**Symptom:** The editor stops offering a suggestion inside a `.d.ts` after the
flag is set.
**Cause:** `getSuggestionDiagnostics` bails on the same predicate.
**Fix:** Expected. The editor's suggestion pass is one of the six gated call
sites.

**Symptom:** `skipLibCheck` is set and a declaration file in a **referenced
project** still is not checked when the flag is removed.
**Cause:** A different clause of the same predicate —
`isSourceOfProjectReferenceRedirect`. That file is the referenced project's
responsibility.
**Fix:** Build the referenced project. Project references are
**13 · Project references and `tsc -b`** *(not written yet)*.

**Symptom:** Turning the flag off produces thousands of errors from
`node_modules` and none of them are in your code.
**Cause:** Correct behaviour — you asked the compiler to check every declaration
file in the program, including transitive ones.
**Fix:** This is the trade the flag exists for. Chunk 08 covers how to get the
useful part of that check without the noise.

## Interview questions

**★ What does `skipLibCheck` actually skip?**
Type checking of every file in the program for which `isDeclarationFile` is true.
The compiler's predicate is literally `options.skipLibCheck &&
sourceFile.isDeclarationFile` — there is no path test, so it is not "skip
`node_modules`". Parsing is unaffected, so a `.d.ts` that does not parse still
fails.

**★ Does `skipLibCheck` change the emitted JavaScript?**
No. Its option record carries `affectsBuildInfo` only — no `affectsEmit`, no
`affectsSemanticDiagnostics`. The output is byte-identical either way; the only
thing that changes is how much checking happened to produce it.

**★ Is `skipLibCheck` a suppression flag?**
No, and the compiler agrees: it sits in `category: Completeness`, not
`Backwards_Compatibility` where the real suppression options live. It cannot
silence any diagnostic in a file you wrote, and it does not filter errors — the
check never starts for those files.

**★ What kind of error in a dependency will `skipLibCheck` never hide?**
A syntax error. `getSyntacticDiagnosticsForFile` returns `parseDiagnostics`
without consulting the skip predicate, so a malformed declaration file fails
regardless.

**Where in the compiler does the flag take effect?**
`skipTypeCheckingWorker`, consulted from six places: program diagnostics,
bind-and-check diagnostics, the checker's file walk (twice — whole file and
node-range), and the editor's suggestion pass, plus the language service's
region-diagnostics path.

**What else is in the same predicate, and why does that matter?**
`noCheck`, `skipDefaultLibCheck`, project-reference redirects, and
`canIncludeBindAndCheckDiagnostics`. It matters because it shows the compiler
treats "skip lib check" as *do not check this file*, not as *check it and hide
the results* — which is why it behaves nothing like `@ts-ignore`.

**What is the default, and why do sources disagree?**
The compiler's default is `false`. The TSConfig reference says `true` as of 5.4,
which describes the config `tsc --init` generates rather than the compiler's
behaviour when the option is absent. Chunk 06.

---

← [Topic index](./README.md) · Next → [02 · It skips your declarations too](./02-it-skips-your-declarations-too.md)
