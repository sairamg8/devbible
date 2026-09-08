---
title: "The Adjacent Toolchain in 2026: Linting, Formatting, Testing, Package Managers and the Rust Rewrite Everywhere"
sidebar_label: "The Adjacent Toolchain"
sidebar_position: 6
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-07. **Every version and publish date below was fetched from registry.npmjs.org on that date.** No performance claim is made and none is quoted — this page reports what exists, who ships it and how recently, not which is faster. Target dependency spine: **Vite 8.2.2 · TypeScript 7.0.2 · Vitest 5.0.0**.
> ⚠️ Scope: this is a **landscape** page. Each tool's own semantics belong to its track — `docs/eslint-oxlint/`, `docs/playwright/`, `docs/typescript/`, `docs/nodejs/` — and are not restated here.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ The Adjacent Toolchain in 2026

The bundler is one seat at a table of six. A 2026 frontend project also picks a **linter**, a
**formatter**, a **test runner**, a **package manager**, a **monorepo task runner** and a **type
checker** — and in the last three years every one of those seats acquired a Rust or Go challenger to
its incumbent. This page is the map, not the manual.

---

## 1. Under-The-Hood Mechanics

### The six seats, as of 2026-09-07

| Seat | Incumbent | Challenger | Status |
|---|---|---|---|
| Bundler | `webpack` **5.110.3** | `vite` **8.2.2** · `@rspack/core` **2.2.2** | fragmented into two lineages |
| Linter | `eslint` **10.10.0** | `oxlint` **1.81.0** · `@biomejs/biome` **2.5.12** | incumbent healthy, challengers real |
| Formatter | `prettier` **3.9.6** | `@biomejs/biome` **2.5.12** | Biome does both seats at once |
| Test runner | `jest` · `vitest` **5.0.0** | — | Vitest is the Vite-native answer |
| Package manager | `npm` · `pnpm` **12.3.4** | — | pnpm via corepack is the workspace default |
| Type checker | `typescript` **7.0.2** | — | TS 7 is the Go port; no alternative needed |
| Monorepo tasks | `turbo` **2.10.12** · `nx` **23.2.0** | — | orthogonal to all of the above |

Publish dates, same fetch: prettier 2026-07-21 · eslint 2026-09-04 · oxlint 2026-09-01 · biome
2026-09-03 · vitest 2026-09-03 · pnpm 2026-09-04 · playwright **1.63.0** 2026-09-04 · nx 2026-09-02
· turbo 2026-08-25 · typescript 2026-07-08.

🔴 **Read that column before believing any "X is dead" claim.** Every tool in the table shipped
within the last two months, prettier included.

### The pattern, and its one exception

Five of the six seats followed the same arc: a JavaScript-implemented incumbent, a native-language
challenger, and **no clean winner** — because the incumbent's value was never speed. ESLint's value
is its rule ecosystem and its custom-rule API; prettier's is that the argument about formatting is
over. A faster tool does not inherit either automatically.

**The exception is TypeScript**, and it is the interesting one. `typescript@7.0.2` **is** the native
port — the same project, the same team, the same semantics, reimplemented. There is no "challenger"
seat because the incumbent moved into it. That is the outcome the other five seats did not get, and
it is worth understanding why: TypeScript's value *is* the checker, so porting the checker preserved
everything. ESLint's value is a plugin ecosystem written in JavaScript against a JavaScript AST API,
which a Rust rewrite cannot carry across.

### Where the seats interact with Vite

- **Vitest** shares Vite's config and transform pipeline. That is its whole thesis: one config, one
  resolver, one set of plugins. ⚠️ It also means tests run through the **dev** shape of
  `import.meta.env`, so build-time-only defects are invisible to them — see
  [chunk 1a](../07-env-variables-and-modes/01a-build-time-vs-runtime-config.md).
- **TypeScript** is *not* in Vite's pipeline at all. Vite 8 strips types with Oxc and never checks
  them; `tsc --noEmit` is a separate step, and in a large project it is usually the longest one.
- **Linters and formatters** are entirely orthogonal to the bundler. Nothing about choosing Vite
  implies anything about choosing oxlint.
- **Package managers** interact through `node_modules` layout. pnpm's strict, symlinked layout
  exposes undeclared dependencies that npm's flattened one hid — usually a good thing, occasionally
  a migration.

### The honest state of the linter seat

Three live options, and they are not interchangeable:

- **ESLint 10** — the rule ecosystem, custom rules, type-aware linting through
  `typescript-eslint`. Nothing else has the coverage.
- **oxlint** — Rust, very fast, a growing subset of ESLint's rules. Commonly run *alongside* ESLint
  rather than instead of it: oxlint on every save, ESLint's type-aware rules in CI.
- **Biome** — Rust, and takes the **formatter** seat too, which is its real differentiator. Adopting
  it is a decision about two tools, not one.

⚠️ **Biome has 25 file-mentions across this corpus and no version pin**, which is exactly the
condition this project's currency tooling exists to prevent. Recorded here as a known gap rather
than quietly written around.

---

## 2. Real-World Engineering Scenario

**Six tools, one "modernisation", and the two that mattered.**

A team scheduled a quarter to "modernise the toolchain": Vite, Biome, Vitest, pnpm, Turborepo,
TypeScript 7. Six migrations, one quarter, one plan.

What the profile showed when someone finally ran it:

- `tsc --noEmit` — **11 minutes** of a 19-minute CI run.
- webpack build — 5 minutes.
- ESLint — 2 minutes.
- everything else — 1 minute.

**TypeScript 7 alone addressed the single largest number in the profile**, and it is the cheapest
migration on the list — the same project, the same semantics, no ecosystem to replace. The bundler
change addressed the second. The other four addressed the last three minutes between them and
carried the most disruption: Biome meant re-formatting the entire repository in one commit and
losing ESLint rules the team relied on; pnpm exposed four undeclared dependencies; Turborepo
required re-modelling the task graph.

They did TypeScript and the bundler that quarter, and left the rest as separately-costed proposals.
Two of the four were never made, which is the correct outcome for a change whose justification was
"it is the modern choice".

The transferable habit is unglamorous: **profile, then sort by (impact ÷ disruption), then do one at
a time.** A bundled "modernisation" is six migrations sharing one rollback plan, and the first one
that goes wrong contaminates the evidence for all six.

---

## 3. Production-Grade Code Example

```bash
# Establishing the six seats in an unfamiliar repository. One minute.
for p in webpack vite @rspack/core eslint prettier @biomejs/biome oxlint \
         jest vitest typescript pnpm turbo nx playwright; do
  printf '%-22s %s\n' "$p" "$(npm ls "$p" --depth=0 2>/dev/null | grep -oE "$p@[0-9.]+" | head -1)"
done

# Is the incumbent actually stale, or does it just feel old?
npm view eslint time.modified prettier time.modified webpack time.modified
```

```bash
# The profile that decides the order. Run BEFORE any migration plan.
time npx tsc --noEmit          # very often the largest single number
time npx eslint .
time npx vite build            # or: npx webpack --mode production
time npx vitest run
# Then sort by (time saved ÷ disruption caused). Do ONE.
```

```json
// package.json — the 2026 shape of the adjacent toolchain.
// packageManager + corepack is how the package manager stops being per-machine.
{
  "packageManager": "pnpm@12.3.4",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "e2e": "playwright test",
    "typecheck": "tsc --noEmit",
    "lint": "oxlint . && eslint .",
    "format": "prettier --write ."
  }
}
```

```yaml
# CI — run the slow, independent checks in PARALLEL rather than migrating tools
# to make a serial pipeline faster. Frequently the cheapest win on this page.
jobs:
  typecheck: { steps: [{ run: pnpm typecheck }] }   # the 11-minute one, alone
  lint:      { steps: [{ run: pnpm lint }] }
  test:      { steps: [{ run: pnpm test }] }
  build:     { steps: [{ run: pnpm build }] }
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Bundling six migrations into one "modernisation"

Six migrations sharing one rollback plan. The first failure contaminates the evidence for all six,
and nobody can say afterwards which change delivered which effect.

### ⚠️ Pitfall 2 — Assuming the bundler is the bottleneck

`tsc --noEmit` is frequently the largest number in a CI profile, and no bundler runs it. Vite does
not type-check at all, by design.

### ⚠️ Pitfall 3 — Treating Biome as a linter decision

It takes the **formatter** seat too. Adopting it means a repository-wide reformat and, usually,
losing ESLint rules that have no Biome equivalent. That is a two-tool decision presented as one.

### ⚠️ Pitfall 4 — Reading "X is dead" without checking

prettier `3.9.6` shipped 2026-07-21; eslint `10.10.0` on 2026-09-04; webpack `5.110.3` on
2026-09-01. `npm view <pkg> time.modified` settles it in three seconds.

### ⚠️ Pitfall 5 — Expecting Vitest to catch build-time defects

It shares Vite's **dev** transform, so `import.meta.env` is a real object in tests and statically
substituted in the build. A dynamic-key bug is invisible to the entire suite by construction.

### ⚠️ Pitfall 6 — Migrating to pnpm without expecting to fix dependencies

Its strict symlinked layout stops undeclared dependencies resolving. Those packages were always
broken; npm's flattened `node_modules` was hiding it. Budget the fixes rather than treating them as
pnpm bugs.

---

## Gotchas

**★ Symptom: a "modernisation" quarter delivers a faster dev server and an unchanged CI time.** Cause: the profile was never run, and the largest number was `tsc`. Fix: profile first, sort by impact over disruption, migrate one tool at a time so each change's effect is attributable.

**★ Symptom: a Biome adoption produces a 40,000-line reformatting commit.** Cause: it is a formatter as well as a linter, so adopting it re-formats everything. Fix: expected, not a bug — do the reformat as its own commit, add it to `.git-blame-ignore-revs`, and decide the formatter question deliberately rather than as a side effect.

**★ Symptom: switching to oxlint loses rules the team relied on.** Cause: it implements a growing subset of ESLint's rules, and type-aware rules in particular need type information ESLint gets from `typescript-eslint`. Fix: run both — oxlint on save for speed, ESLint in CI for coverage. This is a common arrangement, not a failure to commit.

**★ Symptom: pnpm breaks imports that worked under npm.** Cause: strict symlinked `node_modules` stops undeclared transitive dependencies resolving. Fix: declare them. The packages were always broken; npm's flattening hid it. Treat the list as a bug backlog you were handed, not as a pnpm defect.

**★ Symptom: the whole test suite passes and the production bundle is still wrong.** Cause: Vitest runs through Vite's dev transform, so it exercises the object form of `import.meta.env`, not the substituted form. Fix: assert against `dist/` in CI — this class of defect is only observable in the artefact.

**★ Symptom: `tsc` and Vite disagree about whether the code compiles.** Cause: they answer different questions. Vite 8 strips types with Oxc and never checks them; `tsc` checks and never emits your bundle. Fix: run both. A build that succeeds is not evidence the types are sound, and this surprises people arriving from webpack + `ts-loader`, which did check.

**★ Symptom: CI is slow and every tool has already been "modernised".** Cause: a serial pipeline. Fix: typecheck, lint, test and build are independent — run them as parallel jobs. This is frequently a larger win than any tool migration and costs one afternoon of YAML.

**★ Symptom: the package manager differs between developers and CI.** Cause: nothing pins it. Fix: `"packageManager": "pnpm@12.3.4"` plus corepack, so the version is a repository fact rather than a per-machine one. It is one line and it removes an entire category of "works on my machine".

**★ Symptom: a tool in this corpus is taught with no version pin.** Cause: it was added to pages without a `src/data/pins.js` entry, so the currency checker cannot see drift in it. Fix: **Biome has 25 file-mentions and no pin today** — that is the live example. A library that is taught must be pinned in the same change.

---

## Interview questions

**★ Everything got a Rust rewrite. Did any of the incumbents actually lose?**
Only one seat resolved cleanly, and it is not the one people expect: **TypeScript**, where the
incumbent *became* the challenger — `typescript@7.0.2` is the native port by the same team with the
same semantics, so there is no competing tool to evaluate. Everywhere else the incumbent's value was
never speed. ESLint's value is its rule ecosystem and its JavaScript custom-rule API, which a Rust
rewrite structurally cannot carry across; prettier's value is that the formatting argument is over,
and being faster at ending an argument is worth little. So the honest answer is: the bundler seat
fragmented, the linter and formatter seats gained credible alternatives without displacement, and
the type checker seat was won by the thing already sitting in it.

**★ Your CI takes nineteen minutes. Which tool do you migrate first?**
None, until you have the profile — and when you have it, the answer is frequently "not a tool". If
`tsc --noEmit` is eleven of the nineteen minutes, then TypeScript 7 addresses the largest number and
is also the *cheapest* migration on the list, since it is the same project with the same semantics.
If the jobs are running serially, splitting typecheck, lint, test and build into parallel CI jobs
may beat every migration for an afternoon of YAML. The general shape of the answer matters more than
the specific one: **sort by impact ÷ disruption and do one at a time**, because a bundled
modernisation is six migrations sharing one rollback plan.

**★ Why is adopting Biome a bigger decision than adopting oxlint?**
Because Biome takes two seats. oxlint is a linter you can run *alongside* ESLint — fast feedback on
save, ESLint's type-aware rules in CI — and adopting it commits you to nothing. Biome is a linter
**and a formatter**, so adopting it means a repository-wide reformat in one commit, a
`.git-blame-ignore-revs` entry, and a decision about every prettier configuration the team had
opinions about. It may well be the right call — one tool instead of two is genuinely simpler — but
it is a two-tool migration wearing one tool's name, and proposals routinely cost it as one.

**★ Why doesn't Vite type-check, and what follows from that?**
Because type-checking is not a bundling concern and it is slow. Vite 8 strips types with Oxc, which
is a syntactic transform requiring no type information, so `vite build` succeeding tells you nothing
about type soundness. Three things follow. `tsc --noEmit` must be a separate, mandatory step —
usually the longest one. It parallelises with the build, since neither needs the other. And teams
arriving from webpack with `ts-loader` get a genuine surprise, because that setup *did* fail the
build on a type error, and the safety they are used to now lives in a step somebody has to remember
to wire up.

**★ What breaks when you move to pnpm, and is that pnpm's fault?**
Imports of packages you never declared. npm's flattened `node_modules` makes every transitive
dependency resolvable from every module, so a missing `dependencies` entry has no symptom; pnpm's
strict symlinked layout only exposes what you declared, and those imports stop resolving. It is not
pnpm's fault — the packages were always broken, and the same code would fail under Yarn PnP or in
any consumer with a different tree. The right framing for a migration plan is that pnpm hands you a
pre-existing bug backlog on day one, which is worth budgeting for and is genuinely a benefit,
provided nobody has promised it would be a drop-in.

**★ What is the risk of a fast linter running on save?**
That it becomes the definition of "the code is fine". oxlint implements a growing subset of ESLint's
rules, and the ones most likely to be missing are the **type-aware** ones — which are also the ones
that catch real defects rather than style. If the fast linter is the only one a developer sees, the
slow one becomes a CI surprise, and the team's mental model of "clean" quietly narrows to the fast
subset. Running both is fine and common; what matters is that the fast one is understood as a subset
rather than as the standard.

---

← [Loaders → Plugins](02b-loaders-become-plugins.md) · [Vite overview](../../README.md) · Next → [What microservices mean to a build](../18-microservices-architecture/01-what-microservices-mean-to-a-vite-build.md)
