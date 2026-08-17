---
title: "Type checking in CI"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **`tsconfig` reference** for `noEmit`,
> `isolatedModules`, `incremental` and `skipLibCheck`, the **TypeScript handbook**,
> and the **esbuild**, **swc** and **Vite** documentation for what each tool states
> it does. ⚠️ **No timing figure on these pages is ours** — there is no sandbox for
> a build pipeline, so where a number matters it is quoted with its source named.
> **No console block.**

:::info 🚧 This topic is mid-write — 3 chunks
Chunks **01–03 are written**. The rest are not, and references to them are deliberately
**plain text rather than links** so the build stays green. Resume point:
`devbible/progress_typescript_part_b.md` in the memory store.
:::

The syllabus row asks for *"`tsc --noEmit` as a required gate, and why a
transpile-only build cannot replace it."* The second half is the load-bearing part,
and it is not a matter of tooling preference:

> 🔴 **A transpiler cannot type-check, and not because the feature is missing.** It
> processes one file at a time; type checking needs the whole program. **The speed
> and the blindness are the same design decision** — so replacing `tsc` with a
> faster tool is not buying the same check faster, it is buying a different and
> smaller job.

## The chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | [The green build that proves nothing](./01-the-green-build-that-proves-nothing.md) | The seven-step sequence in which **every tool works correctly and nothing type-checks** — and why `isolatedModules` makes the fast tool *safe* rather than *thorough* |
| 02 | [What the gate guarantees](./02-what-the-gate-guarantees.md) | 🔴 A green run is compatible with **an entire directory never having been looked at** — the four things it does not claim, the files quietly outside the program, ⚠️ that **`exclude` is not a firewall**, the multi-config hole, and the four compiler flags that tell you what was actually checked |
| 03 | [Where the gate goes](./03-where-the-gate-goes.md) | The four positions and why **pre-commit is the wrong one** (a whole-program check cannot be scoped to staged files, and `--no-verify` makes it optional) — plus 🔴 **the merge queue case: a type error is the classic semantic merge conflict**, which is why `main` breaks when no individual PR was wrong |
| 04 | **Making it fast enough to be required** *(not written yet)* | `incremental`, `.tsbuildinfo`, project references — and which levers trade guarantee for speed |
| 05 | **When the gate fails** *(not written yet)* | Blocking vs advisory, and turning the check on when the error count is already large |

## Phase gate

You are done with this topic when you can point at the exact step in your pipeline
that runs a whole-program type check, say **what it does and does not cover**, and
explain to someone proposing to remove it why the fast tool is not an alternative.

The tell that it has not landed: *"we don't need `tsc`, the build would fail."*

## Where this connects

- **← [Phase 0 · 10 · Checking vs transpiling](../../phase-0-how-typescript-runs/10-checking-vs-transpiling.md)**
  — the mechanism this topic is the operational consequence of. **Read it first if
  the one-file-versus-whole-program distinction is not already solid.**
- **← [Phase 0 · 09 · Language server vs build](../../phase-0-how-typescript-runs/09-language-server-vs-build.md)**
  — the four ways the editor and CI disagree, which is why an editor cannot be the
  gate.
- **← [Phase 0 · 04 · Strip-only and erasable syntax](../../phase-0-how-typescript-runs/04-strip-only-and-erasable-syntax.md)**
  — the same bargain at runtime.
- **← [Phase 10 · 11 · chunk 10 · Adoption and the CI cost](../../phase-10-strictness/11-typescript-eslint/10-adoption-and-ci-cost.md)**
  — ⚠️ **already argues the two-type-checks arithmetic in full.** Chunk 03 links it
  rather than restating it.
- **→ 03 · Build pipelines** *(not written yet)* — the tool-by-tool comparison.
  **This topic owns the argument that a gate must exist; that one owns who does
  what.**
- **→ 09 · Caching TypeScript in CI and Docker** *(not written yet)* — `.tsbuildinfo`
  and layer caching in depth; chunk 04 takes only what makes the gate affordable.

---

← [Phase 12 index](../README.md) · Start → [01 · The green build that proves nothing](./01-the-green-build-that-proves-nothing.md)
