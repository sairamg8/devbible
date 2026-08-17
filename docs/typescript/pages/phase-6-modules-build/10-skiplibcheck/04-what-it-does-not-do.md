---
title: "What `skipLibCheck` does *not* do"
sidebar_label: "04 · What it does not do"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TSConfig reference** entry for `skipLibCheck`
> — including its explicit advice about two copies of a library's types, quoted
> verbatim — and the compiler's `skipTypeCheckingWorker` predicate and option
> record in the installed **TypeScript 5.9.3** build. **No sandbox, no console
> blocks.**

`skipLibCheck` is the most-proposed wrong answer in TypeScript. It gets suggested
for errors it cannot possibly affect, and it gets blamed for behaviour it has
nothing to do with. This chunk is the negative space: everything the flag leaves
exactly as it was.

The reason it works as a wrong answer is that it is *cheap to try*. One line, and
the person suggesting it has a story that sounds plausible — "the error mentions
`node_modules`, so skip checking `node_modules`". When it does not help, the
usual next move is to add more flags.

## 1. It does not suppress a single error in your own code

The predicate is per source file and tests `isDeclarationFile`. Your `.ts` files
are not declaration files, so **not one diagnostic in code you wrote is affected**.

This is settled and cross-referenced elsewhere in the corpus:
[phase 10's suppression ladder](../../phase-10-strictness/08-suppression-directives/03-the-suppression-tiers.md)
places it **outside** the ladder entirely — it is not a wider `@ts-ignore`, it is
a different mechanism — and
[phase 10 topic 05](../../phase-10-strictness/05-exactoptionalpropertytypes/04-living-with-it.md)
records it being proposed as a fix for `exactOptionalPropertyTypes` errors, which
it cannot touch.

The compiler's own taxonomy agrees: `category: Completeness`, not
`Backwards_Compatibility` where the real suppression options live
([chunk 01](./01-what-it-actually-skips.md)).

## 2. 🔴 It does not change assignability at your call sites

This is the distinction that matters most, and the one that is hardest to see.

There are two completely different things that can be wrong with a dependency's
types:

| | What is wrong | Does `skipLibCheck` help? |
|---|---|---|
| **A** | Their `.d.ts` **does not compile internally** — it references a type that does not exist, two of their declarations conflict, they used syntax your TypeScript version does not support | ✅ **yes.** The file is not checked, so the internal contradiction is never reported |
| **B** | Their `.d.ts` compiles fine but is **wrong about the API** — it says a function returns `string` and it returns `string \| undefined` | ❌ **no.** The declaration is loaded and used exactly as written. Your call site is checked against it and passes, and the wrongness surfaces at runtime |

> 🔴 **`skipLibCheck` helps when *their* `.d.ts` fails to compile internally, and
> does nothing when their types are wrong *about* the API.**

That sentence is the lane's settled line —
[topic 08 chunk 05](../08-typing-an-untyped-dependency/05-when-the-shipped-types-are-wrong.md)
committed to it, and it is the reason topic 08 has a whole chunk on what to do in
case **B** (augmentation, `paths`, or asserting at the boundary). If your problem
is B, this flag is not merely unhelpful — it is *irrelevant*, and reaching for it
means the diagnosis has not happened yet.

## 3. It does not change the emitted output

No `affectsEmit` on the option record. Your `.js` and your `.d.ts` are
byte-identical with the flag on or off. If output changed when someone added the
line, something else changed with it.

## 4. It does not stop declaration files from being loaded, resolved or used

Every `.d.ts` in the program is still:

- **found** — resolution is untouched, so `types`, `typeRoots`, `exports` and
  `typesVersions` behave identically;
- **parsed** — and parse errors are still reported
  ([chunk 03](./03-the-file-format-rules-go-quiet.md));
- **bound and used** — the types it declares are what your code is checked
  against.

⚠️ **So it saves less time than people expect.** The parse and the bind still
happen for the whole `node_modules` declaration surface; only the *check* of
those files is skipped. That is why it is a meaningful speed-up and not a
transformative one, and why the performance question belongs to
**phase 12 · Tooling, performance and testing** *(not written yet)* rather than
here.

## 5. It does not fix the two-copies-of-a-library problem

This is the case the TSConfig reference calls out by name, and its wording is
unusually direct:

> *"A common case where you might think to use `skipLibCheck` is when there are
> two copies of a library's types installed – often an older edition in
> `node_modules`, and a newer edition that a dependency installed. However, this
> is a symptom of a problem in your repository which is better solved by fixing
> your dependencies, rather than by suppressing the symptoms with
> `skipLibCheck`."*

Two copies of `@types/react` is the canonical instance. The flag makes the
*error* go away because the conflicting declarations are no longer compared. It
does not make the duplicate go away — you still have two versions of a type in
your program, and the parts of your code that touch each of them are checked
against **different, incompatible definitions**. What you have bought is a build
that no longer tells you.

The real fixes are dependency-level: a resolution override
(`resolutions`/`overrides`), deduplication, or aligning the versions.

## 6. It does not affect declaration *emit* errors

`getDeclarationDiagnosticsForFile` returns `emptyArray` for any file where
`isDeclarationFile` is true, and computes diagnostics from the `.ts` file being
emitted from otherwise. So the `TS4053`-family "private name" errors and `TS2742`
"cannot be named" from
[topic 07 chunk 08](../07-authoring-d-ts-files/08-when-declaration-emit-fails.md) are
untouched. `skipLibCheck` cannot make a failing declaration emit succeed.

## 7. It does not check less than you asked in the *other* direction

Worth stating because the flag's name suggests a scope it does not have:
`skipLibCheck` skips **all** declaration files, not "library" ones in any sense
of that word ([chunk 02](./02-it-skips-your-declarations-too.md)). There is no
setting for "skip only `node_modules`". If you want your own declarations
checked, you need a separate build, not a narrower flag.

## The diagnosis to run before reaching for it

```bash
# Where does the error actually point?
#   a .d.ts under node_modules      → case A, the flag may genuinely help
#   a .d.ts you wrote               → the flag hides YOUR bug (chunk 02)
#   one of your .ts files           → the flag cannot help at all
tsc --noEmit --pretty false 2>&1 | cut -d'(' -f1 | sort | uniq -c | sort -rn | head
```

🔴 **If the paths are your own `.ts` files, stop.** No amount of `skipLibCheck`
will change one of them, and adding it while chasing something else is how it
ends up in a config with nobody able to say why.

## Gotchas

**Symptom:** `skipLibCheck` was added to fix an error in application code and
nothing changed.
**Cause:** The gate is per file; your `.ts` is not a declaration file.
**Fix:** Fix the error. This flag is a different mechanism entirely.

**Symptom:** A dependency's types are wrong about a return type, and the flag
does not help.
**Cause:** Case **B** — the declaration compiles fine, it is just false.
**Fix:** Augmentation, a `paths` redirect, or asserting at the boundary —
[topic 08 chunk 05](../08-typing-an-untyped-dependency/05-when-the-shipped-types-are-wrong.md).

**Symptom:** Two copies of `@types/react`; the flag makes the error vanish.
**Cause:** The conflicting declarations are no longer compared.
**Fix:** The duplicate is still there and different files are checked against
different definitions. Deduplicate or pin — the reference says so explicitly.

**Symptom:** Turning the flag on saved much less build time than expected.
**Cause:** Parse and bind still happen for every declaration file; only the check
is skipped.
**Fix:** Realistic expectations. The performance analysis belongs to phase 12.

**Symptom:** A runtime crash despite green types, and the flag is suspected.
**Cause:** Almost certainly unrelated — the flag never changes what your code is
checked *against*, only whether the declarations are checked among themselves.
**Fix:** Look for case **B**, or for interop
([topic 09](../09-esmoduleinterop-and-default-imports/README.md)).

**Symptom:** Someone proposes it to fix `TS4053`/`TS2742` on declaration emit.
**Cause:** Both involve `.d.ts` files, so they look related.
**Fix:** Declaration-emit diagnostics come from the `.ts` being emitted. Topic 07
chunk 08 has the actual fixes.

**Symptom:** A config has `skipLibCheck` and nobody knows which error it was
added for.
**Cause:** The usual outcome of trying it speculatively — it is cheap to add and
never reviewed.
**Fix:** Remove it and see what breaks. That is a cheap experiment and it is the
only way to find out.

**Symptom:** It is listed in a "suppressions we should pay down" ticket next to
`@ts-ignore` counts.
**Cause:** Reasonable-looking grouping; both make errors disappear.
**Fix:** Track it separately — it is a completeness trade about other people's
files, and paying it down means a second build config, not editing code.

**Symptom:** Someone wants "`skipLibCheck` but only for `node_modules`".
**Cause:** A sensible wish; the flag's name implies it already.
**Fix:** No such option exists. A second config with the flag off, scoped to your
own declarations, is the available answer — [chunk 08](./08-choosing-it.md).

## Interview questions

**★ When does `skipLibCheck` genuinely help, and when is it irrelevant?**
It helps when a dependency's `.d.ts` fails to compile internally — a contradiction
or a syntax level your compiler does not support — because that file is no longer
checked. It is irrelevant when the declaration compiles fine but is *wrong about
the API*, because the declaration is still loaded and your call sites are still
checked against it.

**★ Two copies of `@types/react` cause an error and `skipLibCheck` makes it go
away. Is that a fix?**
No. The TSConfig reference calls this out by name: the duplicate is a repository
problem, and the flag suppresses the symptom. You still have two incompatible
definitions in the program with different files checked against each.

**★ Can `skipLibCheck` suppress an error in code you wrote?**
No. The predicate keys on `isDeclarationFile`, so it never applies to a `.ts`
file. It is not a wider `@ts-ignore` and the compiler does not file it with the
suppression options.

**★ Why does it save less build time than people expect?**
Because declaration files are still resolved, parsed and bound — only the type
*check* of them is skipped. The saving is real but bounded.

**Does it change the emitted JavaScript or `.d.ts`?**
No. The option record has no `affectsEmit`; output is byte-identical.

**Does it help with `TS4053` on declaration emit?**
No. Declaration-emit diagnostics are computed from the `.ts` file being emitted;
the declaration-diagnostics path returns early for `.d.ts` files anyway.

**Is there a way to skip only `node_modules` declarations?**
No — the flag is all declaration files. Getting your own checked requires a
second build configuration, not a narrower flag.

**What should you do before adding it?**
Look at where the errors actually point. If they are in your own `.ts` files the
flag cannot help; if they are in a `.d.ts` you wrote, it hides your own bug.

---

← Prev: [03 · The file-format rules go quiet](./03-the-file-format-rules-go-quiet.md) · Next → [05 · `skipDefaultLibCheck` and the neighbours](./05-skipdefaultlibcheck-and-neighbours.md)
