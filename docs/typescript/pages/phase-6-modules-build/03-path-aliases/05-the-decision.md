---
title: "The decision"
sidebar_label: "05 · The decision"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook**, *Modules — Reference*
> (the `paths` section's purpose statement and its `"imports"` recommendation)
> and *Modules — Choosing Compiler Options* (the library recipe's `rootDir`
> rationale, quoted verbatim). **No sandbox, no console block.**

Four chunks of mechanism. This one is about whether to have aliases at all.

## What aliases are actually for

The honest list is short:

1. **Avoiding `../../../..`** — the reason everyone gives.
2. **Making a move refactor cheap** — a file that moves does not break every
   importer.
3. **Marking a boundary** — `#domain/*` reads differently from `../../domain`,
   and that difference can be deliberate architecture.

And the honest counter-arguments, which are rarely made:

- **Deep relative paths are a symptom.** `../../../../shared/util.js` is telling
  you the directory structure is too deep or the module is in the wrong place.
  An alias silences the signal without addressing it.
- **Modern editors handle the refactor.** Moving a file updates its importers
  automatically, which removes most of reason 2.
- **Reason 3 is real** and is the one that survives scrutiny. A prefix that says
  "this is a boundary you are crossing" is worth something — but that is an
  argument for a *few* aliases marking *real* boundaries, not for aliasing every
  top-level directory.

📌 **The strongest form of the case for aliases is architectural, not
ergonomic.** If you are adding one to avoid typing `../..`, you are buying a
runtime problem with a formatting preference.

## The decision, by project type

| Project | Answer |
|---|---|
| **Published library** | 🔴 **No convenience aliases.** `"imports"` if you need internal ones |
| **Bundled app** | Aliases are fine — the bundler resolves them and nothing ships |
| **`tsc`-built Node service** | `"imports"`, not `paths` |
| **Monorepo package** | `"imports"` inside a package; workspaces or project references across them |
| **Type-only workaround** | `paths` is correct and safe — see below |

### The library rule, and why it is absolute

A published `.d.ts` containing `@app/db` is broken for every consumer. They have
no `tsconfig.json` of yours, so the specifier resolves to nothing and they get
`TS2307` in a file they cannot edit.

The handbook makes the adjacent point about `rootDir` in its library recipe, and
it is the same class of mistake:

> `rootDir: "src"` and `outDir: "dist"` — it's *necessary* for libraries that
> publish their input files. Otherwise, extension substitution will cause the
> library's consumers to load the library's `.ts` files instead of `.d.ts` files.

🔴 **The pattern to generalise: anything in a published artefact that depends on
your build configuration is a bug.** Aliases, source-relative layouts, `paths`
into `node_modules` — all of them work locally and none of them travel.

### The type-only workaround stays legitimate

From [chunk 01](./01-what-paths-does.md), and worth restating because it is the
one case that survives every other rule here:

```jsonc
"paths": {
  "broken-pkg/subpath": ["./node_modules/broken-pkg/dist/subpath.d.ts"]
}
```

This aliases a **type** lookup for a specifier the runtime already resolves. The
emitted `require("broken-pkg/subpath")` is untouched. `TS2792` suggests it. It is
a stopgap for someone else's `package.json`, and it should carry a comment naming
the upstream issue so the next person knows when it can be deleted.

## The monorepo case

This is where aliases are most tempting, because `../../packages/shared/src` is
genuinely awful, and where they are most expensive, because a monorepo has the
most consumers of each package.

The three real options, in increasing order of machinery:

1. **Workspaces.** Each package is a real package with a real name;
   `import { x } from "@org/shared"` resolves through `node_modules` symlinks
   like any dependency. No aliases at all. **This is the answer most of the
   time.**
2. **`"imports"` per package**, for a package's own internals. Composes fine with
   workspaces.
3. **Project references and `tsc -b`**, when you need the compiler to understand
   build order — **Phase 6 · 13** *(not written yet, lane D)*.

⚠️ **The pattern to avoid is `paths` pointing at another package's `src`.** It
works, it is fast, and it means every package is compiled against another
package's *source* rather than its *published interface* — so the boundary you
created by splitting the packages does not exist. It also makes the editor and
the build disagree the moment one package is built and another is not, which is
the array-form problem from [chunk 01](./01-what-paths-does.md) at scale.

## If you already have aliases everywhere

The order that keeps each step diagnosable:

**1. Find out what currently resolves them.** A bundler? A rewrite step? A
loader? Nothing? "Nothing" is common and means you have a latent bug rather than
a design.

**2. Run the built artefact**, if you are not already. It converts "latent" into
"known".

**3. Decide the target** from the table above — usually `"imports"` for a service
and "leave them" for a bundled app.

**4. Migrate mechanically.** `@app/` → `#app/`, add extensions, set `rootDir`.
It is a find-and-replace and one config line.

**5. Delete `baseUrl`** while you are there, and make any remaining `paths` values
relative to `tsconfig.json` ([chunk 02](./02-baseurl.md)).

📌 Step 1 is the one people skip, and it is the only one that tells you whether
you have a problem.

## Gotchas

**"We have always had aliases and nothing has broken" may mean nothing has been
run.** *Symptom:* confidence. *Cause:* a `tsc --noEmit` CI and a bundled deploy
can both hide it. *Fix:* find out what resolves them; the answer is sometimes
"nothing, and this code path has not shipped yet".

**Adding one alias to a library is not a small change.** *Symptom:* consumer
`TS2307`s after a release. *Cause:* the specifier travelled into the published
`.d.ts`. *Fix:* revert and use `"imports"`. There is no partial version of this
rule.

**`paths` into another package's `src` erases the boundary you created.**
*Symptom:* a change in one package breaks another's types without a version
bump. *Cause:* you are compiling against source, not the published interface.
*Fix:* workspaces.

**An alias added "just for tests" ends up in production code.** *Symptom:*
`#test-utils` imported from a source file. *Cause:* nothing prevents it. *Fix:*
scope test-only mappings to the test config, and expect them to leak anyway.

**Removing aliases late is much more expensive than not adding them.**
*Symptom:* a multi-day refactor. *Cause:* the question "who resolves this?" was
never asked when the first one was added. *Fix:* ask it then.

**A `paths` stopgap for a broken package becomes permanent.** *Symptom:* an entry
pointing into `node_modules` years later. *Cause:* it works. *Fix:* a comment
with the upstream issue link, which is the only thing that makes it removable.

**Deleting `baseUrl` and keeping `paths` values unchanged repoints everything.**
*Symptom:* aliases resolve to the wrong place, or `TS5090`. *Cause:* the values
were relative to `baseUrl`. *Fix:* the two edits are one change — see
[chunk 02](./02-baseurl.md).

## Interview questions

**Should a project use path aliases?**
It depends on what resolves them. In a bundled app they are free, because the
bundler eliminates them. In a `tsc`-built service they are a latent runtime bug
unless something implements the mapping, and `package.json` `"imports"` does the
same job with no machinery. In a published library the answer is no.

**Why is the library rule absolute?**
Because a published `.d.ts` containing `@app/db` refers to a mapping that exists
only in your `tsconfig.json`, which consumers do not have. Every consumer gets
`TS2307` in a file they cannot edit. It is the same class of mistake as
publishing `.ts` files without `rootDir`/`outDir` — anything in a published
artefact that depends on your build configuration is a bug.

**What is the strongest argument *for* aliases?**
Architectural rather than ergonomic: a prefix that marks a boundary being
crossed. `#domain/*` says something `../../domain` does not. That argues for a
small number of aliases naming real boundaries — not for aliasing every top-level
directory to avoid typing `../..`.

**In a monorepo, when would you use `paths` to point at another package's
source?**
Ideally never. It compiles each package against another's *source* rather than
its published interface, so the boundary that justified splitting the packages
stops existing, and the editor and build diverge as soon as one package is built
and another is not. Workspaces give you the same import ergonomics through real
package resolution.

**Is there any use of `paths` that survives all these rules?**
Yes — aliasing a *type* lookup for a specifier the runtime already resolves, such
as pointing at a `.d.ts` inside `node_modules` for a package whose `"exports"`
omits a `types` condition. The emitted `require` is untouched, so there is no
runtime risk, and `TS2792` suggests it directly.

**How would you audit an existing codebase's aliases?**
Start by finding out what currently resolves them — a bundler, a rewrite step, a
loader, or nothing. Then run the built artefact, which converts a latent problem
into a known one. Only then decide the target, because the migration is easy and
the diagnosis is the part people skip.

**Why is `../../../../shared/util.js` an argument against itself?**
Because it is a symptom of structure, not of syntax. A path that deep says either
the tree is too deep or the module is in the wrong place. Aliasing it silences a
useful signal — which is fine if you have decided the structure is correct, and
avoidance if you have not looked.

---

← [04 · `package.json` `"imports"`](./04-subpath-imports.md) · Back to [the topic index](./README.md) · Next topic → **04 · `lib`, `target` and the ambient environment** *(not written yet)*
