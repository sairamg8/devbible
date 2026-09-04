---
title: "The 16.3.4 documentation says two different things about what the React Compiler costs your build, the newer of the two is the blunter one, and the experimental Rust port's headline numbers only hold if Babel leaves the pipeline entirely"
sidebar_label: "02b · What it costs"
sidebar_position: 110
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js [`reactCompiler` config reference](https://nextjs.org/docs/app/api-reference/config/next-config-js/reactCompiler)
> (docs build `version: 16.3.4`, `lastUpdated: 2026-02-11`) and the Next.js
> [version 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
> (`version: 16.3.4`, `lastUpdated: 2026-08-25`). The `experimental.turbopackRustReactCompiler`
> block carries forward a correction verified **2026-09-03** and is marked as such where it appears.
> Documentation-verified; **no timings, no sandbox run — every figure on this page is quoted, not measured**.
> Target: **Next.js 16.3.4 · React Compiler stable since Next.js 16**.

**Enabling `reactCompiler` makes your build slower. Both Next.js documentation pages agree on that direction
and disagree on the adjective, neither gives a number, and the page carrying the harsher warning is the one
that was reviewed most recently.** That is the whole decision: you are trading build time for client update
performance, with no published exchange rate. This page puts both statements side by side with their
`lastUpdated` dates, explains why they are actually consistent once you notice they are measuring against
different baselines, and then covers the experimental Rust port — a separate flag with a separate status, whose
much-quoted speedup is conditional on something most codebases have not done. What the compiler *is* and how to
enable it is [02](02-react-compiler-retiring-manual-usememo-usecallback.md).

## 🔴 Two doc statements, and they do not agree

Both sentences are in the **16.3.4 documentation right now**. A reader who has seen only one of them will argue
confidently from it, which is why this table matters more than either quote alone.

| Source | `lastUpdated` | What it says |
|---|---|---|
| `reactCompiler` API reference | **2026-02-11** | *"the impact is small and localized"* |
| Version 16 upgrade guide | **2026-08-25** | *"Expect compile times … to be higher"* |

Both in full, so neither can be quoted out of shape:

> *"This avoids compiling everything and keeps the performance cost minimal. You may still see slightly slower
> builds compared to the default Rust-based compiler, but the impact is small and localized."*
> — `reactCompiler` reference, `lastUpdated: 2026-02-11`

> *"**Good to know:** Expect compile times in development and during builds to be higher when enabling this
> option as the React Compiler relies on Babel."*
> — version 16 upgrade guide, `lastUpdated: 2026-08-25`

⚠️ **The intuitive reconciliation is that the blunt warning is the older text, written before the SWC
pre-filter existed. Check the dates: it is the newer one.** The upgrade guide was reviewed more than six months
after the API reference. Whatever the internal history, you cannot dismiss the warning as stale — the more
recently touched page is the one that carries it.

### Why both are true

They are measuring against different baselines, and each page states its baseline if you read the full
sentence rather than the fragment:

- **Against no compiler at all** you have added a Babel pass that was not there. Slower, unambiguously. That is
  the upgrade guide's framing, and it is the comparison a team actually faces when deciding whether to flip the
  flag.
- **Against running `babel-plugin-react-compiler` yourself with no pre-filter**, Next.js runs it on a fraction
  of your files. Much less slow. That is the API reference's framing — note that its sentence says *"compared
  to the default Rust-based compiler"* and still concedes *"slightly slower"*. Even the optimistic page does
  not claim parity.

Both are true simultaneously. Neither tells you what your CI will do.

### 🔴 There is no number, anywhere

Neither the `reactCompiler` reference nor the upgrade guide states a percentage, a multiplier or a range for
the compiler's build cost. **If someone quotes one, they measured their own repo or invented it.** The absence
is not an oversight — it is the same fact as the flag shipping off by default: *"we continue gathering build
performance data across different application types."* Vercel does not have a single number either, because
there isn't one; the cost is a function of what fraction of a codebase contains JSX or Hooks, and that varies
enormously between a content site and a design tool.

The only defensible figure is one from your own pipeline, which means the flag has to land alone:

```bash
# Land the flag by itself so the build-time delta has exactly one cause.
git switch -c chore/enable-react-compiler
# next.config.ts:  reactCompiler: true
# package.json:    -D babel-plugin-react-compiler
git commit -am "chore: enable React Compiler (build-time delta measurement)"
```

Two things make that measurement worth anything. **Compare like with like on the cache:** Turbopack persists
compiler artefacts to disk, so a cold build and a warm build are different experiments and mixing them
produces a meaningless delta. And **do not bundle the flag into a feature PR** — a build that got 40 seconds
slower in a commit that also added three routes tells you nothing, and it is the single most common way teams
end up unable to say what the compiler cost them.

## The experimental Rust port is a different feature

> ⚠️ **React Compiler — two different things, verified 2026-09-03**
>
> This book sometimes writes "stable React Compiler" and "Rust React Compiler" as if they were one feature.
> They are not, and only the first is stable.
>
> | | Flag | Status |
> |---|---|---|
> | **React Compiler** | `reactCompiler: true` | **Stable.** This is the one that retires manual `useMemo`/`useCallback`. |
> | **Rust port of it** | `experimental.turbopackRustReactCompiler` | 🔴 **Experimental.** Runs inside Turbopack instead of Babel-in-Node. |
>
> **The Rust port's gain is conditional, which is the part worth teaching.** On a large app (v0) it cut
> time-to-ready-page by **34% cold / 46% warm** — but those figures assume Babel is **fully out of the
> pipeline**. Keep Babel for other transforms and the gain shrinks, because you are still paying to generate
> and reparse code.
>
> That makes it a clean worked example of measuring before adopting: the flag alone does not deliver the
> number, the *absence of Babel* does.

**Why the conditional is the whole story.** The Rust port's premise is that the compiler stops being a Babel
plugin and becomes a Turbopack transform, so the second pipeline disappears. If your project still has a
`.babelrc` for anything else — a decorator transform, a styled-components plugin, an old preset nobody has
audited — Babel still runs, Next.js still parses and regenerates those files a second time, and you have
removed one occupant of a pass you are still paying for. The saving that was measured is the saving from
*deleting the pass*, not from swapping which plugin sits in it.

🔴 **Do not enable it because of the numbers.** Enable it, if at all, because you have already got Babel out of
your project and want to confirm the remaining gap. Then measure. The flag is experimental, the numbers came
from one large application, and the corpus records them with their condition attached for exactly this reason.
Note also that the experimental flag table in the
[Turbopack API reference](https://nextjs.org/docs/app/api-reference/turbopack) does not list
`turbopackRustReactCompiler` at all — treat "experimental" as the accurate status and the 2026-09-03 note as
the provenance.

The audit that has to come first is a one-liner, and it is the highest-value thing on this page for an
upgraded codebase:

```bash
# Anything here means Babel is running additively to SWC on every matching file.
ls -a .babelrc .babelrc.js .babelrc.json babel.config.js babel.config.json 2>/dev/null
```

If that finds something you do not need, deleting it is very likely a bigger build-time win than the React
Compiler is a loss. The mechanism — *"SWC is always used for Next.js's internal transforms and downleveling"*
regardless of the Babel config — and the `turbopackUseBuiltinBabel` escape hatch are on
[01b · Configuring the compile pipeline](01b-configuring-the-turbopack-compile-pipeline.md).

## Gotchas

**★ Symptom: CI build time jumped noticeably the day the compiler was enabled, and nobody can say by how
much.** Cause: you added a Babel pass to every file containing JSX or Hooks, and there is no before-figure to
subtract. Fix: the measurement has to be taken *before* the flag lands, and the flag has to be landable alone —
its own branch, its own build, nothing else in the diff, cold compared to cold and warm compared to warm.

```bash
git switch -c chore/enable-react-compiler   # nothing else in this branch
git commit -am "chore: enable React Compiler (build-time delta measurement)"
```

**★ Symptom: the build got much slower than the "small and localized" promise suggested.** Cause: one of two
things. Either you already had a Babel config for something else — so under Turbopack in 16+ Babel was
*already* running additively to SWC and the compiler is one more plugin in a pass you were paying for anyway —
or the pre-filter is doing little because the repo is overwhelmingly JSX. Fix: audit for a stray Babel config
before you blame the compiler.

```bash
ls -a .babelrc .babelrc.js .babelrc.json babel.config.js babel.config.json 2>/dev/null
# Found one you do not need? Delete it. Need it, but not the auto-detection?
```

```ts
// next.config.ts — stop Turbopack auto-detecting a Babel config
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: { turbopackUseBuiltinBabel: false },
}

export default nextConfig
```

**★ Symptom: someone quotes a build-slowdown percentage for the React Compiler in a design review.** Cause:
invention, or a figure from a different codebase presented as general. Fix: neither Next.js page contains a
number — check the source before the number enters a decision, and replace it with a measurement of your own
build.

**★ Symptom: `experimental.turbopackRustReactCompiler` was enabled expecting the 34% / 46% improvement and the
build barely moved.** Cause: Babel is still in the pipeline for something else, so the duplicate parse-and-
regenerate cost the port exists to remove is still being paid. Fix: get Babel out first, then re-measure; the
port replaces the compiler's *use* of Babel, not your project's.

```bash
# 1. Find out whether Babel is still running at all.
ls -a .babelrc .babelrc.js .babelrc.json babel.config.js babel.config.json 2>/dev/null
# 2. Only once that prints nothing does the port's premise hold for your app.
```

**★ Symptom: a colleague says "the React Compiler is experimental" and points at a config key to prove it.**
Cause: they are pointing at `experimental.turbopackRustReactCompiler`, the Rust port, not at `reactCompiler`.
Fix: settle the argument on the key, not the name — the stable one is top-level, the experimental one is under
`experimental` and says so in its path.

```ts
const nextConfig: NextConfig = {
  reactCompiler: true,                                        // stable since 16
  experimental: { turbopackRustReactCompiler: true },         // 🔴 experimental, different feature
}
```

**Symptom: dev-server startup and hot updates feel slower after enabling the compiler, even though only the
build was expected to change.** Cause: the upgrade guide's warning is explicit that both are affected —
*"Expect compile times in development and during builds to be higher."* The Babel pass runs in the dev pipeline
too. Fix: if the dev loop is the priority and the app's client tree is small, this is a legitimate reason to
run the compiler only where it pays — annotation mode, on [02c](02c-annotation-mode-and-the-two-directives.md).

**Symptom: build timings from before and after the flag differ wildly between runs, so the delta is unusable.**
Cause: Turbopack's filesystem cache persists compiler artefacts between runs, so the second build of any
configuration is not comparable to the first. Fix: decide which experiment you are running and keep it
consistent — either compare two cold builds or two warm ones, and say which in the report. The cache flags and
their defaults are on
[01b · Configuring the compile pipeline](01b-configuring-the-turbopack-compile-pipeline.md).

## Interview questions

**★ The `reactCompiler` docs say the build impact is "small and localized" and the upgrade guide says to expect
compile times to be higher. Which one is current?**
Both are, in 16.3.4. The instinct is to call the blunt warning the stale one, but the dates say otherwise: the
API reference carrying "small and localized" was last updated 2026-02-11, the upgrade guide carrying "expect
compile times … to be higher" was last updated 2026-08-25. They are not really contradictory — they measure
against different baselines. Against no compiler, you added a Babel pass and builds get slower. Against running
the Babel plugin unfiltered, the SWC pre-filter makes the cost much smaller. The right answer is that neither
document gives a number, so the only usable figure is one measured on your own build.

**★ Why is the React Compiler not enabled by default in Next.js 16 if the flag is stable?**
Because those are two different claims. The compiler reached 1.0 and Next.js promoted `reactCompiler` from
`experimental` to stable, so the *output* is trusted. What is not settled is the *build cost*: the option is
*"not enabled by default as we continue gathering build performance data across different application types."*
The compiler runs as a Babel plugin, Babel is far slower than the Rust pipeline it is bolted onto, and the cost
depends heavily on what fraction of a given codebase is JSX. Vercel would rather collect that distribution than
impose it.

**★ What is `experimental.turbopackRustReactCompiler` and how does it relate to `reactCompiler`?**
It is a Rust port of the same compiler that runs inside Turbopack instead of as a Babel plugin in Node. It is
experimental; `reactCompiler` is stable. The point of the port is to delete the second pipeline rather than
make it faster. The measured gain on a large application was 34% cold and 46% warm on time-to-ready-page — with
the crucial condition that Babel is *fully* out of the build. If you keep a Babel config for anything else, you
still pay to generate and reparse code and the gain shrinks. It is the cleanest example in this chapter of a
number that is real and still not transferable.

**★ You are asked to justify enabling the React Compiler on a large codebase. What do you actually present?**
Two measurements and one scoping argument. Measurement one: the build-time delta from a branch containing
nothing but the flag and the plugin, cold-to-cold and warm-to-warm. Measurement two: a client-side profile of
the routes you claim will benefit — the interactive ones — before and after, because the compiler's target is
update performance and a route with no re-renders cannot improve. The scoping argument is which fraction of the
codebase the SWC pre-filter will actually hand to Babel, since that determines the cost side of the trade. What
you do not present is a percentage from a blog post; there is no published figure for this.

**Why does deleting an old `.babelrc` sometimes matter more than the compiler flag itself?**
Because since Next.js 16, Turbopack detects a Babel config and runs Babel automatically, while SWC still runs
for internal transforms and downleveling. Under webpack the config *replaced* SWC and you paid for one
pipeline; under Turbopack it is additive and you pay for two. So a forgotten config from years ago is charging
every matching file a full parse and regenerate for a transform nobody needs. Removing it can be the largest
single build-time win available in an upgraded project — and it is also the precondition for the Rust port's
numbers to mean anything.

---

← [02 · React Compiler](02-react-compiler-retiring-manual-usememo-usecallback.md) · [Chapter index](01-explanation.md) · Next → [02c · Annotation mode and the two directives](02c-annotation-mode-and-the-two-directives.md)
