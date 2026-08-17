---
title: "The question, and the compiler's own answer"
sidebar_label: "01 · The question"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — the `disableSourceOfProjectReferenceRedirect` option record
> and its description, the `skipTypeCheckingWorker` clause, and the `outputDts`
> substitution in the emitter's reference resolution are all read out of the
> installed **TypeScript 5.9.3** build. The `composite` and `declarationMap`
> records are from the same table; the project-references concept is the
> **TSConfig reference**'s. **No sandbox, no console blocks.**

A monorepo with `packages/ui` importing `packages/shared` has exactly one
interesting question, and everything else follows from how you answer it:

> 🔴 **When `ui` is type-checked, is `shared` represented by its `.ts` source or
> by its built `.d.ts`?**

Both work. They produce **different type-checking behaviour, different failure
modes, and — most visibly — different answers in your editor than in CI**. Almost
every "it works in VS Code and fails in the build" report in a monorepo is this
question, answered inconsistently.

## The two routes, stated plainly

| | **Source** | **Built `.d.ts`** |
|---|---|---|
| What `ui` checks against | `shared/src/**/*.ts` | `shared/dist/**/*.d.ts` |
| Needs a build first? | ❌ no | ✅ yes |
| Sees a change immediately | ✅ yes | ❌ only after rebuild |
| Enforces the package boundary | ❌ no — internals are visible | ✅ yes — only the public surface |
| Catches declaration-emit failures | ❌ no | ✅ yes |
| Go-to-definition lands on | the real source | the `.d.ts`, unless `declarationMap` |

⚠️ **Neither column is "the right answer".** The trade is *immediacy* against
*fidelity to what you would publish*, and a large monorepo usually wants both at
different moments — which is precisely why the tooling is confusing.

## 🔴 The compiler already has an opinion

This is the finding that organises the whole topic, and it is not in the
handbook's prose. There is a compiler option:

```js
{
  name: "disableSourceOfProjectReferenceRedirect",
  type: "boolean",
  isTSConfigOnly: true,
  category: Diagnostics.Projects,
  description: Diagnostics
    .Disable_preferring_source_files_instead_of_declaration_files_when_referencing_composite_projects,
  defaultValueDescription: false
}
```

Read the description slowly:

> *"**Disable preferring source files instead of declaration files** when
> referencing composite projects."*

🔴 **An option to *disable* preferring source files means preferring source files
is the default.** When you use project references, TypeScript does **not** check
against the referenced project's `.d.ts` — it redirects to the **source**, and it
does so without being asked.

That mechanism has a name inside the compiler — the **source-of-project-reference
redirect** — and you have already met it. [Topic 10 chunk 01](../10-skiplibcheck/01-what-it-actually-skips.md)
found it as a clause in the skip predicate:

```js
|| host.isSourceOfProjectReferenceRedirect(sourceFile.fileName)
```

which is why a file belonging to a referenced project is not type-checked by
*your* project: it is somebody else's responsibility, and the compiler knows
which files those are.

## But the *emit* still points at the built declarations

The other half, from the emitter's reference resolution:

```js
const referenceRedirect = host.isSourceOfProjectReferenceRedirect(importedFileName)
  ? host.getRedirectFromSourceFile(importedFileName)?.outputDts
  : undefined;
```

🔴 **So the compiler checks against source and emits references to
`outputDts`.** Your `ui` package is verified against `shared`'s real code, and
the declaration file `ui` emits refers to `shared`'s *built* declaration — which
is what a published consumer would need.

That is a genuinely good design: you get the immediacy of source during
development, and the artefact you emit still describes the boundary correctly.

⚠️ **It also means the two halves can disagree.** If `shared/dist` is stale, the
check passed against new source while the emitted reference points at old
declarations. Nothing reports it, because each half individually did its job.
[Chunk 05](./05-the-failure-catalogue.md) is that failure and its siblings.

## Why you might turn the preference off

`disableSourceOfProjectReferenceRedirect: true` makes the compiler use the built
`.d.ts` after all. Three real reasons:

1. **To check what consumers actually get.** The declaration file is the
   published interface; checking against source means a declaration-emit failure
   or an accidentally-widened type is invisible until publish.
2. **Speed on a very large graph.** A `.d.ts` is smaller and already resolved
   than the source that produced it.
3. **To make the boundary real.** Against source, `ui` can reach anything in
   `shared/src` that resolution allows. Against `.d.ts`, it sees only what was
   exported and emitted.

📌 **The honest configuration is often both** — source in the dev loop, built
declarations in the CI job that also runs the checks from
[topic 11 chunk 08](../11-publishing-a-typed-package/08-wiring-the-checks-in.md).
[Chunk 06](./06-choosing.md) makes that concrete.

## What this topic does *not* cover

Two boundaries, drawn deliberately:

- **Project references themselves** — `composite`, `references`, build ordering,
  `tsc -b` — are [13 · Project references and `tsc -b`](../13-project-references/README.md).
  This topic uses them; that topic explains them.
- **Why not to point `paths` at another package's `src`** is already argued in
  [topic 03 chunk 05](../03-path-aliases/05-the-decision.md), which settles that
  **workspaces are the answer most of the time** and that a `paths`-to-`src`
  alias means *"every package is compiled against another package's source
  rather than its published interface — so the boundary you created by splitting
  the packages does not exist."*

🔴 **This topic is about the type-sharing consequence of that choice**, not about
re-arguing it. Where the two overlap, that page owns the alias question and this
one owns what your types then mean.

## Gotchas

**Symptom:** The editor sees a change in `shared` immediately and the build does
not.
**Cause:** The editor is checking against source; the build is checking against a
stale `dist`.
**Fix:** Make both use the same route. Chunk 04.

**Symptom:** Project references were added and a referenced package's files
stopped being type-checked by the consumer.
**Cause:** `isSourceOfProjectReferenceRedirect` — those files belong to the
referenced project.
**Fix:** Correct behaviour. Build that project; its own check covers them.

**Symptom:** A type error only appears after publishing.
**Cause:** Everything was checked against source, so the emitted `.d.ts` was
never the thing under test.
**Fix:** `disableSourceOfProjectReferenceRedirect: true` in a CI configuration,
or the checks from topic 11.

**Symptom:** `ui` imports something from deep inside `shared/src` that was never
exported.
**Cause:** Source-route checking does not enforce the package boundary.
**Fix:** Built-declaration route, or `exports` on the internal package — the
boundary has to be enforced by something.

**Symptom:** Go-to-definition lands in a `.d.ts` instead of the real code.
**Cause:** The built-declaration route without `declarationMap`.
**Fix:** `declarationMap: true` — chunk 04.

**Symptom:** Someone concludes the redirect is a bug because "it should use the
declarations".
**Cause:** The default genuinely prefers source, and it is undocumented in prose.
**Fix:** It is deliberate, and the option to turn it off is named after exactly
that preference.

**Symptom:** A monorepo has both `paths` aliases and project references and
behaves unpredictably.
**Cause:** Two mechanisms answering the same question differently.
**Fix:** Pick one. Topic 03 chunk 05 argues for workspaces; this topic assumes
you did.

## Interview questions

**★ In a monorepo, what is the one question that determines everything else about
type sharing?**
Whether a consuming package is type-checked against the producing package's
**source** or its **built `.d.ts`**. The trade is immediacy against fidelity to
what you would publish, and answering it inconsistently is what makes the editor
and the build disagree.

**★ What does TypeScript do by default with project references?**
It **prefers source files over declaration files** — the source-of-project-
reference redirect. You can tell from the option that turns it off:
`disableSourceOfProjectReferenceRedirect`, described as *"Disable preferring
source files instead of declaration files when referencing composite
projects."*

**★ If it checks against source, what does it emit?**
References to the referenced project's `outputDts` — the built declaration file.
So the check has development-time immediacy while the emitted artefact still
describes the published boundary. The two halves can disagree if `dist` is
stale.

**★ Why is a referenced project's file not type-checked by the consuming
project?**
Because `isSourceOfProjectReferenceRedirect` is a clause in the compiler's skip
predicate — the same one `skipLibCheck` lives in. Those files are the referenced
project's responsibility, and its own build checks them.

**Name three reasons to check against built declarations instead of source.**
To verify what consumers actually receive, to make the package boundary real
(source-route checking can reach unexported internals), and speed on a large
graph, since a `.d.ts` is smaller and already resolved.

**Why does the source route fail to catch some bugs until publish?**
Because the declaration file is never the thing under test. A declaration-emit
failure or an accidentally widened inferred type does not exist yet at check
time.

**What does this topic deliberately leave to others?**
Project references themselves — `composite`, `references`, `tsc -b` — belong to
topic 13, and whether to use `paths` aliases at all is settled in topic 03
chunk 05. This topic owns what your types mean once that choice is made.

---

← [Topic index](./README.md) · Next → [02 · The built-declaration route](./02-the-built-declaration-route.md)
