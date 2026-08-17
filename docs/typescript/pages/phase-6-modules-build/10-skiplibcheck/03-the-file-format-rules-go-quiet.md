---
title: "The `.d.ts` file-format rules go quiet"
sidebar_label: "03 · The file-format rules go quiet"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — 🔴 **this chunk is not in any documentation.** Every claim
> below is read out of the installed **TypeScript 5.9.3** build: the early return
> in `checkSourceFileWorker`, the `checkGrammarSourceFile` /
> `checkGrammarStatementInAmbientContext` call sites, and the ungated
> `getSyntacticDiagnosticsForFile`. Diagnostic codes and their message text come
> from the compiler's own numbered table. **No sandbox, no console blocks.**

[Topic 07 chunk 01](../07-authoring-d-ts-files/01-what-a-declaration-file-is.md) defines what
a `.d.ts` file *is* — not by prose, but by the six diagnostics that fire when you
break the format. Ambient context has rules: no statements, no initialisers, no
function bodies, top-level declarations need `declare` or `export`.

This chunk is about an interaction nobody documents:

> 🔴 **`skipLibCheck: true` switches those rules off for `.d.ts` files.**

Not "makes the errors less severe". They are never computed.

## Why — the exact line

From [chunk 01](./01-what-it-actually-skips.md), one of the six gated call sites
is the checker's own walk of the file. Here it is:

```js
function checkSourceFileWorker(node) {
  const links = getNodeLinks(node);
  if (!(links.flags & 1 /* TypeChecked */)) {
    if (skipTypeChecking(node, compilerOptions, host)) {
      return;                       // ← 🔴 returns HERE
    }
    checkGrammarSourceFile(node);   // ← never reached
    …
  }
}
```

**`checkGrammarSourceFile` is called *after* the skip check.** And it is the
entry point for the ambient-context rules:

```js
function checkGrammarSourceFile(node) {
  return !!(node.flags & 33554432 /* Ambient */)
    && checkGrammarTopLevelElementsForRequiredDeclareModifier(node);
}
```

Every one of the format diagnostics is raised by a `checkGrammar*` function
inside the checker, reached only through that walk. None of them is a *parser*
diagnostic:

| Code | Message | Raised by |
|---|---|---|
| **1036** | *"Statements are not allowed in ambient contexts."* | `checkGrammarStatementInAmbientContext` |
| **1038** | *"A 'declare' modifier cannot be used in an already ambient context."* | the modifier grammar check |
| **1039** | *"Initializers are not allowed in ambient contexts."* | the initialiser grammar check |
| **1046** | *"Top-level declarations in .d.ts files must start with either a 'declare' or 'export' modifier."* | `checkGrammarTopLevelElementForRequiredDeclareModifier` |
| **1183** | *"An implementation cannot be declared in ambient contexts."* | `checkGrammarStatementInAmbientContext` and the accessor check |

🔴 **All five are downstream of the early return.** In a program with
`skipLibCheck: true`, a `.d.ts` file can contain a statement, an initialiser, or
a function body, and the compiler will say nothing.

## What that means in practice

The rules do **not** disappear from the language. They disappear for *declaration
files in a program that has the flag on*. Two consequences, and the pair of them
is the whole point:

- ✅ **Inside your `.ts` files, `declare` blocks are still policed.** Your `.ts`
  file is not a declaration file, so it is checked normally, and writing
  `declare const x = 3;` still gets you `TS1039`. The rules are alive.
- 🔴 **Inside a `.d.ts`, they are not.** The file that exists *specifically* to be
  an ambient declaration is the one where the ambient-declaration rules are not
  enforced.

That asymmetry is genuinely surprising, and it explains a class of report that
otherwise makes no sense: *"my `.d.ts` compiled fine locally and failed on their
machine."* It did not compile fine. It was not compiled.

## But syntax still fails — the line this draws

[Chunk 01](./01-what-it-actually-skips.md) established that
`getSyntacticDiagnosticsForFile` returns `sourceFile.parseDiagnostics` with no
skip check. So the boundary is precise and worth memorising:

| Kind of problem in a `.d.ts` | Reported with `skipLibCheck: true`? |
|---|---|
| Unbalanced brace, unterminated string, stray token | ✅ **yes** — parser |
| `export type` with a missing `=` | ✅ **yes** — parser |
| `TS1036`/`1038`/`1039`/`1046`/`1183` — ambient format | ❌ **no** — checker grammar |
| `TS2664`/`2665` — `declare module` targets nothing | ❌ no — checker |
| Any type error inside the declarations | ❌ no — checker |

> **The rule of thumb: if the parser could reject it, you are still protected. If
> the parser accepted it and the checker was going to object, you are not.**

⚠️ **That boundary is finer than "syntax versus semantics" as most people use
those words.** `TS1046` reads like a syntax error, is numbered in the 1000s
alongside real syntax errors, and is called a *grammar* error by the compiler —
and it is still a checker diagnostic, so it is skipped. The number range is not
the guide; where it is raised is.

## Why the compiler does it this way

This is not an oversight, and it helps to see why. The grammar checks live in the
checker because several of them need binding information — knowing whether the
enclosing context is ambient, whether a name is already declared, whether a
modifier is redundant given its container. They were never parser rules. And the
skip is deliberately *whole-file*: the design goal of `skipLibCheck` is that the
checker does not walk declaration files at all, which is where the time saving
comes from. Filtering diagnostics afterwards would cost exactly what the flag
exists to avoid.

So the behaviour is coherent. It is just undocumented, and it means the flag's
blast radius is larger than its one-line description implies.

## What to do about it

The mitigation is the same as [chunk 02](./02-it-skips-your-declarations-too.md)'s
and for the same reason — **check your own declaration files in a build where the
flag is off.** Specifically:

- A hand-authored `.d.ts` must be validated at least once with
  `skipLibCheck: false`, or its format is unverified.
- 🔴 **If you are following [topic 07](../07-authoring-d-ts-files/README.md) to
  write declarations by hand, do it in a project where the flag is off**, or the
  entire diagnostic vocabulary that topic teaches you to read is unavailable.
- `--noEmit` with the flag off, run once in CI over the repo, is enough to catch
  a malformed declaration file even if you do not want it in the normal loop.

## Gotchas

**Symptom:** A hand-written `.d.ts` contains a plain statement and no error
appears.
**Cause:** `TS1036` is a checker grammar diagnostic, raised after the
`skipTypeChecking` early return.
**Fix:** Validate declaration files with `skipLibCheck: false` at least once.

**Symptom:** A `.d.ts` was accepted locally and a colleague's build rejects it.
**Cause:** Their config does not have the flag, or does not have it for that
project. Yours skipped the file entirely.
**Fix:** Compare `skipLibCheck` before comparing TypeScript versions — it is far
more often the answer.

**Symptom:** `declare const x = 3;` errors in a `.ts` file but not in a `.d.ts`.
**Cause:** The gate is per source file. Your `.ts` is not a declaration file, so
`TS1039` fires there and nowhere else.
**Fix:** Nothing broken — but it is the clearest demonstration that the rules
still exist and are simply not being applied where you assumed.

**Symptom:** A generated `.d.ts` from a code generator has an initialiser in it
and nothing complains.
**Cause:** Same skip. Generated declarations are declaration files.
**Fix:** Add a `skipLibCheck: false` check over generated output — generators are
exactly where malformed declarations come from.

**Symptom:** Someone concludes `.d.ts` files are "not really checked by
TypeScript at all".
**Cause:** Over-generalising from this behaviour.
**Fix:** They are fully checked by default. The flag turns it off, and the flag
is opt-in — even if `tsc --init` opts you in ([chunk 06](./06-who-turns-it-on-for-you.md)).

**Symptom:** A truly corrupt `.d.ts` (half a file, cut off mid-declaration) does
fail the build even with the flag on, which seems to contradict all of the above.
**Cause:** It does not parse, and parse diagnostics are ungated.
**Fix:** Consistent with the table above — the parser is still on duty.

**Symptom:** An editor shows a squiggle in a `.d.ts` that the command-line build
does not report.
**Cause:** The editor may be using a different project (or an inferred one) with
different options, and the language service's own paths are gated separately.
**Fix:** Compare the effective config the editor is using —
`tsc --showConfig` against what the editor reports.

**Symptom:** A code review asks "should `.d.ts` files be linted then?"
**Cause:** A reasonable reaction to losing the compiler's checks on them.
**Fix:** It is a real option, but the cheaper fix is one `skipLibCheck: false`
build. The compiler's checks are better than a linter's for this specific class.

## Interview questions

**★ With `skipLibCheck: true`, will TypeScript still tell you a `.d.ts` file is
malformed?**
Only if it fails to *parse*. The ambient-context format rules — `TS1036`,
`TS1038`, `TS1039`, `TS1046`, `TS1183` — are checker grammar diagnostics raised
downstream of the skip, so a `.d.ts` containing a statement or an initialiser is
accepted silently.

**★ Why do the ambient-format errors get skipped when they look like syntax
errors?**
Because they are raised by `checkGrammar*` functions inside the checker, not by
the parser — several of them need binding context to decide. Their low diagnostic
numbers make them look syntactic, but the number range is not what decides
whether the skip covers them.

**★ Where in the compiler can you see this?**
`checkSourceFileWorker` calls `skipTypeChecking` and returns before
`checkGrammarSourceFile`. Everything the grammar checks would have reported is
therefore never computed.

**★ Do the ambient rules still apply inside a `declare` block in a `.ts` file?**
Yes. The skip is per source file and keys on `isDeclarationFile`, which is false
for a `.ts`. So the rules are alive — they are just not applied in the file type
that exists to hold ambient declarations.

**What should a team writing `.d.ts` files by hand do about this?**
Validate them at least once with `skipLibCheck: false` — a `--noEmit` pass in CI
is enough. Otherwise the entire diagnostic vocabulary for the file format is
unavailable to them.

**Is this documented?**
No. The TSConfig reference describes the flag as skipping type checking of
declaration files, which is true; that this also disables the file-format grammar
rules follows from where those rules are implemented, not from anything written
down.

**Given all this, why is the behaviour still defensible?**
Because the flag's whole purpose is that the checker does not walk declaration
files. Computing the grammar diagnostics anyway and filtering them afterwards
would cost the time the flag exists to save. It is coherent — just larger in
scope than its description suggests.

---

← Prev: [02 · It skips your declarations too](./02-it-skips-your-declarations-too.md) · Next → [04 · What it does not do](./04-what-it-does-not-do.md)
