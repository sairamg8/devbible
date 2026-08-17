---
title: "Which of your tools actually reach in"
sidebar_label: "01 · Which tools reach in"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript 7 release notes** and the published
> package's `exports` map — ⚠️ **which is already read from disk, with console
> output, in [phase 0 · 07](../../phase-0-how-typescript-runs/07-typescript-7-native-compiler.md)**;
> that page owns the package internals, the measured speed and the shape of the new
> surface, and none of it is repeated here. Tool-side claims are attributed to each
> tool's own documentation. **No sandbox run of our own, no console block.**

[Phase 0 · 07](../../phase-0-how-typescript-runs/07-typescript-7-native-compiler.md)
establishes the fact: **the language did not change, the tool did**, and the root
`ts.*` export is gone in favour of an explicitly `unstable/` surface. This topic is
the operational question that follows — **which parts of *your* pipeline care, and
how do you find out before the upgrade rather than during it?**

## 🔴 The one distinction that sorts your whole toolchain

Every tool that touches TypeScript does one of two things, and only the second is at
risk:

| | What it does | Exposure |
|---|---|---|
| **Runs the compiler** | shells out to `tsc`, or spawns it | ✅ **none** — the CLI is the stable interface |
| 🔴 **Imports the compiler** | `import ts from 'typescript'` and calls into it | ⚠️ **this is the migration** |

**Most of your pipeline is the first kind**, which is why the upgrade is usually far
smaller than it sounds. Your `typecheck` script, your CI job, a bundler plugin that
spawns `tsc` for declarations — all of them talk to a command-line interface that
has not moved.

📌 **So the audit is not "what uses TypeScript" — nearly everything does. It is
"what *imports* it".** That is a much shorter list, and it is discoverable.

## The tools that import it, by what they need it for

Grouped by *why* they reach in, because that predicts how hard each one is to
replace:

| Why | Typical tools | Note |
|---|---|---|
| **Parse to an AST** | linters' TypeScript parsers, codemods, `ts-morph` | 🔴 the largest group, and the deepest reach |
| **Build a `Program` for type information** | type-aware lint rules, type-testing tools, API extractors | ⚠️ needs the checker, not just the AST |
| **Transform during compilation** | custom transformers, some test-runner transforms | needs the transformer API specifically |
| **Read declarations** | documentation generators, `.d.ts` bundlers | often only needs the AST |

🔴 **The one people forget is the type-aware linter.** It builds a `Program` to
answer the questions [phase 10 · 11](../../phase-10-strictness/11-typescript-eslint/README.md)
is about — so **the rules that cost you a second type-check are the rules that make
your linter a compiler-API consumer.** If you run type-aware linting, your linter is
in the at-risk column, and it is usually the most load-bearing entry there.

⚠️ **Test-runner transforms split across both columns**, and which one you have is a
configuration detail rather than a choice of tool: a transform that only strips
types may use esbuild or swc and never touch the compiler, while one that
type-checks imports it. **Check yours rather than assuming from the tool's name.**

## How to find them, in order of effort

1. **Read `package.json` first.** Anything declaring `typescript` as a
   **`peerDependency`** is telling you plainly that it expects to load your copy —
   that is the single strongest signal, and it is one file to read per dependency.
2. **List who depends on typescript** in the installed tree — your package manager
   can print the dependents of a package, and the list is usually short enough to
   read.
3. **Check each candidate's documentation for a supported version range**, and
   whether it has said anything about 7. ⚠️ **Absence of a statement is the common
   case and is itself the finding** — it means nobody has tested it.
4. **Only then**, if something is unclear, look at whether it imports the package
   root.

📌 **Steps 1 and 2 answer it for most projects in ten minutes.** The audit's value
is that it converts *"can we upgrade?"* — unanswerable — into a list of three or
four named packages, each with an owner and a version range.

## What the audit typically finds

- **A handful of at-risk packages, not a wall.** Usually the linter's parser, maybe
  a codemod or documentation generator, occasionally one custom transformer written
  by someone who has left.
- 🔴 **The custom transformer is the one with no upstream to wait for.** Every other
  entry has a maintainer who will eventually publish support; yours does not. **Find
  it early, because it is the only item on the list whose schedule is yours.**
- **Transitive dependents you did not know you had** — a tool that pulls in an API
  consumer of its own. This is why reading `package.json` beats reasoning about what
  you installed on purpose.

## Gotchas

**Symptom:** the upgrade is described as risky and nobody can say what would break.
**Cause:** "what uses TypeScript" was asked instead of "what imports it".
**Fix:** 🔴 sort by the two columns. Running `tsc` is not exposure; importing it is,
and the second list is short.

**Symptom:** a tool works after the upgrade and then fails on a specific file.
**Cause:** it reaches into the API for a construct it only meets sometimes.
**Fix:** ⚠️ an API consumer that starts is not an API consumer that works — the
failure surfaces on input, not on load. Run it over the whole codebase before
concluding anything.

**Symptom:** the linter breaks and it was not on the audit list.
**Cause:** type-aware rules make it a `Program` consumer, which is easy to overlook
because it is configured as a linter.
**Fix:** if you run type-aware linting, the linter is in the at-risk column. It is
often the most load-bearing entry.

**Symptom:** a documentation generator or `.d.ts` bundler was missed.
**Cause:** it runs at release time, not in CI, so it is not in anybody's mental
model of the pipeline.
**Fix:** audit the release path too. 📌 It is the path where a failure is discovered
at the worst moment.

**Symptom:** the test transform was assumed safe because the runner is fast.
**Cause:** fast usually means esbuild or swc, but the transform is configurable and
some type-check.
**Fix:** check the actual configuration. ⚠️ And note the corollary from
[topic 01](../01-type-checking-in-ci/README.md): if it is the fast kind, it is not
checking your tests either.

**Symptom:** a package has no statement about TypeScript 7 support.
**Cause:** nobody has tested it.
**Fix:** treat silence as a finding rather than as reassurance. It moves the item
onto your list, not off it.

## Interview questions

**How do you scope a TypeScript 7 upgrade for a real project?**
By splitting the toolchain into things that *run* the compiler and things that
*import* it. The CLI has not moved, so everything in the first column — the
typecheck script, CI, plugins that spawn `tsc` — is unaffected. The migration is
entirely in the second column, and that list is usually three or four packages.

**Which tools import the compiler API?**
Anything that needs an AST or type information of its own: linters' TypeScript
parsers, codemods and `ts-morph`, type-aware lint rules and type-testing tools that
build a `Program`, custom transformers, and some documentation generators and
`.d.ts` bundlers. The one most often forgotten is the type-aware linter, because it
is configured as a linter rather than as a compiler consumer.

**What is the fastest way to produce the list?**
Read `package.json` for anything declaring `typescript` as a peer dependency — that
is a package stating it will load your copy — and ask the package manager which
installed packages depend on it. Between them those two steps answer it for most
projects, and they surface transitive dependents you would not have thought of.

**A dependency says nothing about TypeScript 7. What does that mean?**
That nobody has tested it. Silence is a finding, not reassurance, and it puts the
package on the list rather than taking it off. The only entry with no upstream to
wait for is a transformer your own team wrote, which is why it is worth identifying
first — it is the one whose schedule you control and therefore own.

**Why is "it starts up fine" weak evidence for an API consumer?**
Because these tools fail on *input*, not on load. A tool that reaches into the API
for a construct it only meets in some files will run happily until it meets one, so
the check is running it across the whole codebase rather than confirming it boots.

---

[Topic index](./README.md) · Next → [02 · What `unstable/` actually promises](./02-what-unstable-promises.md)
