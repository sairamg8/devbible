---
title: "Why the editor and the build disagree"
sidebar_label: "04 · Editor versus build"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — the `disableSolutionSearching` and
> `disableReferencedProjectLoad` option records and their descriptions, and the
> language service's use of `isSourceOfProjectReferenceRedirect`, are read out of
> the installed **TypeScript 5.9.3** build. The `declarationMap` behaviour is the
> **TSConfig reference**'s. **No sandbox, no console blocks.**

*"It works in my editor and fails in CI"* is the defining monorepo complaint. It
is almost never a bug in either one. It is the two of them answering
[chunk 01](./01-the-question-and-the-compilers-answer.md)'s question differently,
and there are exactly four ways that happens.

## The four causes

### 1. 🔴 They are looking at different `tsconfig.json` files

The editor picks a project per **open file**, by walking up from that file to the
nearest config. Your CI runs one specific config, or `tsc -b` over a solution
file.

So editing `packages/shared/src/index.ts` puts you in `shared`'s project, with
`shared`'s options. If `shared` sets `strict: false` and the root config that CI
runs sets `strict: true`, the two genuinely disagree about your file — and both
are right about the question they were asked.

**The check:**

```bash
tsc --showConfig -p packages/shared        # what the editor most likely uses
tsc --showConfig -p tsconfig.json          # what CI uses
```

📌 This one has nothing to do with monorepo type sharing specifically. It is
simply far more likely in a repo with many configs, which is what a monorepo is.

### 2. One of them is on the source route and the other is not

From [chunk 03](./03-the-source-route.md): if you use project references, the
default prefers **source**. If your CI job sets
`disableSourceOfProjectReferenceRedirect: true` — or is a plain `tsc -p` that
resolves `@org/shared` through `node_modules` to `dist` — then:

> **The editor is checking against `shared/src`, and CI is checking against
> `shared/dist`.**

They will agree exactly as long as `dist` is current, and diverge the moment it
is not. ⚠️ **This is the cause that produces the most confusing symptom**,
because the disagreement is intermittent and correlates with nothing the
developer did.

### 3. `dist` is stale for one of them and not the other

The degenerate case of #2 — both on the built route, but the editor's language
service has an older or newer view of `dist` than the process CI ran. The
language service caches aggressively and watches the filesystem; a build that
happened outside its watch, or a restart, changes what it sees.

**This is why "restart the TS server" works so often**, and why it is such an
unsatisfying answer: it is not fixing anything, it is discarding a cache that had
diverged from disk.

### 4. The editor loaded a different set of projects

Two options exist purely for this, and their descriptions are the clearest
statement that the editor's project graph is a thing you can configure:

| Option | Description | Default |
|---|---|---|
| `disableSolutionSearching` | *"Opt a project out of multi-project reference checking when editing."* | `false` |
| `disableReferencedProjectLoad` | *"Reduce the number of projects loaded automatically by TypeScript."* | `false` |

Both are `isTSConfigOnly` and both exist because, in a large solution, the editor
loading every referenced project is expensive. 🔴 **But each is a deliberate
reduction in what the editor knows**, so enabling either is *choosing* to make
the editor's answer less complete than the build's.

⚠️ **If your monorepo sets `disableReferencedProjectLoad: true` for performance,
editor-versus-build divergence is expected behaviour, not a bug.** That is worth
writing down somewhere people will find it, because it will be rediscovered
otherwise.

## The diagnosis, in order

```bash
# 1. Are they even the same config?
tsc --showConfig -p <the config CI runs> > /tmp-scratch/ci.json
tsc --showConfig -p <the nearest config to the file> > /tmp-scratch/editor.json
diff /tmp-scratch/ci.json /tmp-scratch/editor.json

# 2. Which route is each on?
#    look for: references, composite, disableSourceOfProjectReferenceRedirect
grep -l 'disableSourceOfProjectReferenceRedirect' packages/*/tsconfig*.json tsconfig*.json

# 3. Is dist current?
#    (compare the newest source against the newest declaration)
find packages/shared/src -name '*.ts'  -newer packages/shared/dist/index.d.ts | head
```

🔴 **Step 3 first if the divergence is intermittent**, and step 1 first if it is
consistent. That single distinction saves most of the time this problem usually
costs.

📌 Most editors can also report the project a file belongs to and the file list
it loaded — in VS Code, the TypeScript server's own "open TS server log" and
"TypeScript: Go to Project Configuration". Use them before theorising.

## Making them agree on purpose

The goal is not "the editor should match CI". It is that **any difference is
deliberate and documented**. Three arrangements that achieve it:

**A. One route everywhere.** Project references throughout, no
`disableSourceOfProjectReferenceRedirect` anywhere. Editor and build both use
source, always agree, and the built-route benefits are bought back by a separate
CI job that emits declarations ([chunk 06](./06-choosing.md)).

**B. Built route everywhere, with a watch build.** `tsc -b --watch` over the
solution keeps `dist` current, so the editor and CI see the same declarations.
Costs a running process; removes staleness as a category.

**C. Deliberate split, written down.** Source in the editor, declarations in CI —
which is the arrangement most large monorepos converge on — with a note in the
contributing guide saying so, and a CI job that fails loudly rather than a
developer discovering it in a pull request.

⚠️ **The arrangement to avoid is the accidental one**, where nobody chose and the
two differ because of a flag somebody added for speed.

## `declarationMap`, again

On any built-route configuration, `declarationMap: true` is what makes the
editor's *navigation* agree with reality even when its *checking* is against
declarations. Without it, the two disagree in a way that is not a type error but
still wastes time daily —
[chunk 02](./02-the-built-declaration-route.md) makes the fuller case.

## Gotchas

**Symptom:** An error appears in CI and not in the editor, consistently.
**Cause:** Different configs — the editor picked the nearest one to the file.
**Fix:** `tsc --showConfig` on both and diff. Start here when it is consistent.

**Symptom:** The same, but intermittently.
**Cause:** Staleness — one side is looking at a `dist` the other has moved past.
**Fix:** Check whether any source is newer than the declarations. Start here when
it is intermittent.

**Symptom:** "Restart the TS server" fixes it and nobody knows why.
**Cause:** The language service's cache had diverged from disk.
**Fix:** It is a symptom of the built route without a watch build, not a fix.

**Symptom:** The editor does not see a change in a referenced project at all.
**Cause:** `disableReferencedProjectLoad: true` — the project was never loaded.
**Fix:** Expected given that setting. Document it, or accept the load cost.

**Symptom:** Rename-symbol works within a package and not across packages.
**Cause:** The editor is on the built route — it sees a declaration, not source.
**Fix:** Source route, or accept it. Chunk 03 names this as the source route's
strongest argument.

**Symptom:** CI passes and a developer sees errors locally.
**Cause:** Same four causes, other direction — often CI is on the built route
with a stale `dist` that happens to still satisfy it.
**Fix:** The direction of the divergence does not change the diagnosis.

**Symptom:** A team adds `disableSolutionSearching` for speed and cross-package
errors stop appearing while editing.
**Cause:** That is precisely what the option does.
**Fix:** A trade, not a bug. Write it down where it will be found.

**Symptom:** Two developers disagree about whether an error exists.
**Cause:** Different files open, therefore different projects loaded.
**Fix:** Compare what project each editor reports for the file before comparing
anything else.

## Interview questions

**★ Why do the editor and the build disagree in a monorepo?**
Four causes: different `tsconfig.json` files (the editor picks the nearest to the
open file), one side on the source route and the other on the built route, a
stale `dist` that one has seen and the other has not, and a different set of
projects loaded — which two options exist specifically to reduce.

**★ How do you tell those causes apart quickly?**
By whether the divergence is consistent or intermittent. Consistent points at
different configs — `tsc --showConfig` on both and diff. Intermittent points at
staleness — check whether any source is newer than the declarations.

**★ Why does restarting the TypeScript server so often "fix" it?**
Because it discards a language-service cache that had diverged from what is on
disk. It resolves the symptom and tells you the real problem is a built route
without a watch build keeping `dist` current.

**★ What do `disableSolutionSearching` and `disableReferencedProjectLoad` do, and
what do they cost?**
They reduce how much of the project graph the editor loads — the first opts a
project out of multi-project reference checking while editing, the second reduces
projects loaded automatically. Both make the editor's answer deliberately less
complete than the build's, so divergence becomes expected behaviour.

**What is the actual goal — should the editor always match CI?**
No. The goal is that any difference is deliberate and written down. Most large
monorepos land on source in the editor and declarations in CI; that is fine as a
choice and painful as an accident.

**Why does rename-across-packages work on one route and not the other?**
On the source route both packages are in one program, so the editor can rewrite
the real code. On the built route the editor sees a generated declaration and has
no source behind it to change.

**What single option most improves the built route's editor experience?**
`declarationMap: true`. It makes navigation land on the real source even though
checking is against declarations.

---

← Prev: [03 · The source route](./03-the-source-route.md) · Next → [05 · The failure catalogue](./05-the-failure-catalogue.md)
