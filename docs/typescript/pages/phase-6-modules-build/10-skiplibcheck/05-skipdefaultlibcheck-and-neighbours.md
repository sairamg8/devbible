---
title: "`skipDefaultLibCheck` and the neighbours in the predicate"
sidebar_label: "05 · skipDefaultLibCheck and neighbours"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TSConfig reference** entry for
> `skipDefaultLibCheck` (quoted verbatim) and, for everything else, the installed
> **TypeScript 5.9.3** build — the option records, the `skipTypeCheckingWorker`
> predicate, the `no-default-lib` pragma handler and the `TS6160` message, with
> `TS6160` cross-checked against the **7.0.2** native binary. **No sandbox, no
> console blocks.**

The predicate from [chunk 01](./01-what-it-actually-skips.md) has five clauses.
One of them is `skipLibCheck`. This chunk is the other four, because knowing what
`skipLibCheck` sits *next to* is most of what tells you what kind of flag it is —
and because one of them, `skipDefaultLibCheck`, is routinely misunderstood in a
way that is worth thirty seconds of your time.

```js
return options.skipLibCheck && sourceFile.isDeclarationFile
  || options.skipDefaultLibCheck && sourceFile.hasNoDefaultLib
  || !ignoreNoCheck && options.noCheck
  || host.isSourceOfProjectReferenceRedirect(sourceFile.fileName)
  || !canIncludeBindAndCheckDiagnostics(sourceFile, options);
```

## `skipDefaultLibCheck` — and the surprise in `hasNoDefaultLib`

Its option record is `skipLibCheck`'s twin:

```js
{
  name: "skipDefaultLibCheck",
  type: "boolean",
  // We need to store these to determine whether `lib` files need to be rechecked
  affectsBuildInfo: true,
  category: Diagnostics.Completeness,
  description: Diagnostics.Skip_type_checking_d_ts_files_that_are_included_with_TypeScript,
  defaultValueDescription: false
}
```

Same category, same single flag, same default. The description says *"Skip type
checking `.d.ts` files that are **included with TypeScript**"*, and the TSConfig
reference says the same thing with a link to the compiler's `src/lib` directory:

> *"Skips type checking of a default lib declaration file. This is only relevant
> when using `skipLibCheck` is not set."*

**But that is not what the predicate tests.** It tests
`sourceFile.hasNoDefaultLib`, and that property is set from a **triple-slash
pragma**, in the parser's pragma handler:

```js
if (arg.arguments["no-default-lib"] === "true") {
  context.hasNoDefaultLib = true;
}
```

> 🔴 **So `skipDefaultLibCheck` does not mean "files that shipped with
> TypeScript". It means "files carrying `/// <reference no-default-lib="true"/>`".**

TypeScript's own `lib.*.d.ts` files carry that directive — which is why the
description is *effectively* true for the normal case. But the test is the
directive, not the origin. Any declaration file you write with that directive at
the top gets the same treatment, and a hypothetical `lib` replacement shipped by
somebody else does too.

[Topic 07 chunk 13](../07-authoring-d-ts-files/13-triple-slash-references.md)
covers `no-default-lib` as one of the four triple-slash forms and its real job —
telling the compiler *"this file replaces the default library, do not include
`lib.d.ts`"*. This is its second, undocumented effect.

### When you would actually use it

Almost never, and the reference is honest about that: *"only relevant when using
`skipLibCheck` is not set"* — because `skipLibCheck` already covers every
declaration file, `lib.*.d.ts` included. The one scenario is:

> You want the strictness of checking `node_modules` declarations
> (`skipLibCheck: false`) but a conflicting global — the classic being a
> redefinition of `Array` from an old polyfill package — makes checking the
> standard library itself produce errors you cannot act on.

That combination — `skipLibCheck: false` plus `skipDefaultLibCheck: true` — is
the flag's entire reason to exist, and it is rare enough that most engineers will
go a career without needing it.

### ⚠️ It is deprecated on the command line

```text
TS6160: [Deprecated] Use '--skipLibCheck' instead. Skip type checking of default
        library declaration files.
```

That message is present in **both** the 5.9.3 table and the 7.0.2 binary, so the
deprecation is current, not historical. It applies to the CLI flag; the compiler
option itself still functions, which is what makes the narrow use above possible.

## `noCheck` — the neighbour that shows what family this is

`noCheck` says *do not type-check anything*, and its presence in the same `||`
chain is the strongest evidence for [chunk 01](./01-what-it-actually-skips.md)'s
claim that `skipLibCheck` is a *do-not-check-this-file* flag rather than a
diagnostic filter.

The three form a scale, and it is a useful one to have in mind:

| Flag | Files not checked |
|---|---|
| `skipDefaultLibCheck` | those carrying `no-default-lib` |
| `skipLibCheck` | **every** declaration file |
| `noCheck` | **every file, including yours** |

⚠️ Note the `ignoreNoCheck` parameter in the predicate. The compiler has a
*second* entry point, `skipTypeCheckingIgnoringNoCheck`, which applies every
clause **except** `noCheck` — used where the build needs to know whether a file
would be checked in principle. `skipLibCheck` has no such escape hatch: it
applies through both.

## Project-reference redirects

`host.isSourceOfProjectReferenceRedirect(sourceFile.fileName)` skips a file that
belongs to a **referenced project** — its own build is responsible for it. This
is the clause that surprises people who remove `skipLibCheck` in a
project-references setup and find some declaration files still unchecked. They
are not being skipped by your flag; they are somebody else's job.

**13 · Project references and `tsc -b`** *(not written yet)* owns that mechanism.

## `canIncludeBindAndCheckDiagnostics` — the JavaScript clause

The final clause is the negation of:

```js
function canIncludeBindAndCheckDiagnostics(sourceFile, options) {
  if (!!sourceFile.checkJsDirective && sourceFile.checkJsDirective.enabled === false) return false;
  if (sourceFile.scriptKind === TS || TSX || External) return true;
  const isJs = sourceFile.scriptKind === JS || JSX;
  const isCheckJs = isJs && isCheckJsEnabledForFile(sourceFile, options);
  …
}
```

Two things worth taking from it:

- **A `// @ts-nocheck` at the top of a file** sets `checkJsDirective.enabled ===
  false` and lands the file in the same *not checked at all* bucket. That is the
  mechanism [phase 10's suppression ladder](../../phase-10-strictness/08-suppression-directives/03-the-suppression-tiers.md)
  places at the file-wide tier.
- **A `.ts`/`.tsx` file always returns `true` here** — it is only JavaScript files
  whose inclusion depends on `checkJs`. Which is the second confirmation that
  nothing in this predicate can exclude an ordinary TypeScript file of yours
  except `noCheck` or an explicit `@ts-nocheck`.

## Gotchas

**Symptom:** `skipDefaultLibCheck` was set and nothing changed.
**Cause:** `skipLibCheck` is probably also on, and it already covers every
declaration file including `lib.*.d.ts`.
**Fix:** Remove the redundant flag. It is only meaningful with
`skipLibCheck: false`.

**Symptom:** `--skipDefaultLibCheck` on the CLI prints a deprecation notice.
**Cause:** `TS6160`, present in both 5.9.3 and 7.0.2.
**Fix:** Use `--skipLibCheck` unless you specifically need the narrow
`skipLibCheck: false` + `skipDefaultLibCheck: true` combination.

**Symptom:** A file you wrote is skipped by `skipDefaultLibCheck` and you did not
expect that.
**Cause:** It carries `/// <reference no-default-lib="true"/>`. The predicate
tests that pragma, not the file's origin.
**Fix:** Remove the directive unless you genuinely intend the file to replace the
default library.

**Symptom:** `skipLibCheck` removed, and some declaration files are still not
checked.
**Cause:** They are sources of a project-reference redirect — the referenced
project owns them.
**Fix:** Check them in that project's build.

**Symptom:** Errors in a conflicting `Array` definition from an old polyfill,
and you want dependency checking on.
**Cause:** The one real use case for `skipDefaultLibCheck`.
**Fix:** `skipLibCheck: false` with `skipDefaultLibCheck: true`. Better still,
remove the polyfill's types.

**Symptom:** A `.ts` file is not being checked and `skipLibCheck` is suspected.
**Cause:** Not possible via this flag. Look for `// @ts-nocheck`, `noCheck`, or
the file not being in the program at all.
**Fix:** `tsc --listFiles` will tell you whether it is even included.

**Symptom:** Someone reads `skipDefaultLibCheck`'s description and concludes it
means "TypeScript's own files, by path".
**Cause:** The description says *"included with TypeScript"*, which is true in
practice but is not the test.
**Fix:** The test is the `no-default-lib` pragma. It matters only in unusual
setups, but it is the accurate statement.

**Symptom:** A build tool sets `noCheck` and someone attributes the missing
errors to `skipLibCheck`.
**Cause:** Adjacent clauses in the same predicate with very different scope.
**Fix:** `noCheck` skips *your* files too. Check for it first — it is far more
consequential.

## Interview questions

**★ What does `skipDefaultLibCheck` do, and how is it different from
`skipLibCheck`?**
It skips checking files that carry `/// <reference no-default-lib="true"/>` —
in practice TypeScript's own `lib.*.d.ts`. `skipLibCheck` skips *every*
declaration file, so it already includes those. `skipDefaultLibCheck` is only
meaningful when `skipLibCheck` is off.

**★ The docs say `skipDefaultLibCheck` covers "files included with TypeScript".
Is that the actual test?**
No. The predicate tests `sourceFile.hasNoDefaultLib`, which is set by the
`no-default-lib` triple-slash pragma. TypeScript's lib files carry it, so the
description is true in practice, but the test is the directive rather than the
file's origin.

**★ When would you ever use `skipDefaultLibCheck`?**
When you want dependency declarations checked (`skipLibCheck: false`) but a
conflicting global — an old polyfill redefining `Array`, say — makes checking the
standard library produce errors you cannot act on. It is rare, and the CLI form
is deprecated in favour of `--skipLibCheck` (`TS6160`).

**★ What does `skipLibCheck` sitting in the same predicate as `noCheck` tell
you?**
That the compiler models it as membership of the "do not check this file" family
rather than as a diagnostic filter. The check never starts, which is why it
behaves nothing like `@ts-ignore` and why it saves time at all.

**Can any clause in that predicate exclude one of your ordinary `.ts` files?**
Only `noCheck`, an explicit `// @ts-nocheck`, or the file being a
project-reference redirect. `canIncludeBindAndCheckDiagnostics` returns `true`
unconditionally for `.ts`/`.tsx`.

**Why does the compiler have two entry points, `skipTypeChecking` and
`skipTypeCheckingIgnoringNoCheck`?**
So the build can ask whether a file *would* be checked ignoring the global
`noCheck` switch. `skipLibCheck` applies through both — there is no equivalent
bypass for it.

**You removed `skipLibCheck` and some `.d.ts` files are still unchecked. Why?**
They are sources of a project-reference redirect. The referenced project is
responsible for checking them, and that clause is independent of your flag.

---

← Prev: [04 · What it does not do](./04-what-it-does-not-do.md) · Next → [06 · Who turns it on for you](./06-who-turns-it-on-for-you.md)
