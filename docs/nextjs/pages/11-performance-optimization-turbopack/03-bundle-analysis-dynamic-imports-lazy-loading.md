---
title: "Next.js 16 deleted the `size` and `First Load JS` columns from the build output because they were inaccurate — which means every CI bundle-size gate that greps that output is now passing without testing anything at all"
sidebar_label: "03 · Bundle analysis"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js [package bundling guide](https://nextjs.org/docs/app/guides/package-bundling)
> (docs build `version: 16.3.4`, `lastUpdated: 2026-06-01`) and the Next.js
> [version 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
> (`version: 16.3.4`, `lastUpdated: 2026-08-25`).
> Documentation-verified; **no sandbox run, no build executed, no byte counts measured here**.
> Target: **Next.js 16.3.4 · `next experimental-analyze` available in 16.1+ · Turbopack default since 16.0**.

**The most dangerous kind of broken test is one that reports success, and Next.js 16 created a fleet of them in
one release note.** The `size` and `First Load JS` columns were removed from `next build` output as inaccurate
under React Server Components — so every CI job that scraped those columns for a bundle budget now finds
nothing to scrape, compares nothing against the threshold, and goes green forever. This page covers that trap,
why the metrics were withdrawn rather than fixed, and how to rebuild a guard rail that fails loudly when its
input disappears — using `next experimental-analyze --output` as the diagnostic and a tool with a documented
budget format as the assertion. The two analyzers themselves, and how to read what they show you, are
[03b](03b-the-two-analyzers-and-how-to-read-them.md); what to *do* about it is
[03c](03c-fixing-what-the-analyzer-finds.md); deferring code you cannot delete is
[03e](03e-next-dynamic-and-lazy-loading.md).

## Why any of this exists

> *"Bundling is the process of combining your application code and its dependencies into optimized output files
> for the client and server. Smaller bundles load faster, reduce JavaScript execution time, improve Core Web
> Vitals, and lower server cold start times."*
> *"Next.js automatically optimizes bundles by code splitting, tree-shaking, and other techniques. However,
> there are some cases where you may need to optimize your bundles manually."*
> — Next.js package bundling guide

The second sentence is the whole justification for the page. The automatic work is real and it is not
sufficient, because the cases it cannot see are architectural: a library that only exists to turn data into
markup sitting on the wrong side of the client boundary, a barrel file that pulls three hundred modules for one
icon, a Node-only package dragged into a server bundle. None of those are tree-shaking failures. All of them
are visible in an analyzer and invisible in a build log.

## 🔴 The gate that stopped testing anything

Verbatim, from the version 16 upgrade guide:

> *"**Next.js 16** removes the `size` and `First Load JS` metrics from the `next build` output. We found these
> to be inaccurate in server-driven architectures using React Server Components. Both our Turbopack and Webpack
> implementations had issues, and disagreed on how to account for Client Components payload."*
> *"The most effective way to measure actual route performance is through tools such as Chrome Lighthouse or
> Vercel Analytics, which focus on Core Web Vitals and downloaded resource sizes."*

Note what that says and does not say. It does **not** say bundle size stopped mattering. It says the two
numbers Next.js was printing were wrong, that its own two bundlers disagreed about them, and that you should
measure the thing users experience instead.

**Now the failure.** Thousands of repositories have a job shaped like this, written against Next.js 13 or 14:

```bash
#!/usr/bin/env bash
# ci/bundle-budget.sh — 🔴 SILENTLY BROKEN ON NEXT.JS 16
next build | tee build.log

# Pull the "First Load JS shared by all" figure out of the build table.
SHARED_KB=$(grep 'First Load JS shared by all' build.log | grep -oE '[0-9.]+ kB' | grep -oE '[0-9.]+')

if (( $(echo "$SHARED_KB > 250" | bc -l) )); then
  echo "Shared first-load JS ${SHARED_KB} kB exceeds the 250 kB budget"
  exit 1
fi
echo "Bundle budget OK: ${SHARED_KB} kB"
```

On 16, `grep` matches nothing, `SHARED_KB` is the empty string, and `bc` evaluates an empty comparison. Whether
the script then exits 0 or errors depends on your shell flags — and the common case, a script without
`set -euo pipefail`, is the bad one: it prints `Bundle budget OK:` with no number and passes. 🔴 **The gate does
not fail loudly when its input disappears; it congratulates you.** A team can ship a year of regressions behind
a green check.

**The first fix costs one line and is not optional:** make the absence of the metric a failure.

```bash
#!/usr/bin/env bash
set -euo pipefail   # 🔴 an unset variable is now an error, not an empty string

SHARED_KB=$(grep 'First Load JS shared by all' build.log | grep -oE '[0-9.]+' | head -1)
if [[ -z "$SHARED_KB" ]]; then
  echo "FATAL: build output no longer contains First Load JS — this gate is measuring nothing." >&2
  exit 1
fi
```

That converts a silent pass into a loud failure, which is all a shell script can honestly do here. The
*replacement* has to come from somewhere that still produces a number.

## `--output` — the flag that makes a replacement possible

The first-party analyzer is a CLI subcommand, available since 16.1 and built on Turbopack's module graph:

```bash
npx next experimental-analyze
```

On its own it opens an interactive view, which is the wrong shape for CI. The flag that changes that is
`--output`; the UI itself, its filters and its import-chain tracing are
[03b](03b-the-two-analyzers-and-how-to-read-them.md).

> *"If you want to share the analysis with teammates or compare bundle sizes before/after optimizations, you can
> skip the interactive view and save the analysis as a static file with the `--output` flag"*
> *"This command writes the output to `.next/diagnostics/analyze`. You can copy this directory elsewhere to
> compare results"*

```bash
npx next experimental-analyze --output
cp -r .next/diagnostics/analyze ./analyze-before-refactor
```

That `cp` is the documented before/after workflow: snapshot, change something, re-run, compare the two
directories. It is how you prove a refactor did what you claimed rather than asserting it in a PR description.

⚠️ **What I could not confirm: the docs do not document a machine-readable schema for
`.next/diagnostics/analyze`.** The guide describes it as a static file you save, share and copy — it does not
publish field names, a JSON shape, or a stability guarantee for one. **Do not write a CI threshold parser
against guessed keys**; it will break on a patch release and, worse, it will break the way the old gate broke —
by finding nothing and passing.

### A replacement gate that is honest about what it can enforce

Three jobs, and only the third one asserts a number, because only the third one is built on a tool that
documents a budget format:

```yaml
# .github/workflows/bundle.yml
- name: Build
  run: npx next build

- name: Produce the bundle analysis
  run: |
    set -euo pipefail
    npx next experimental-analyze --output
    test -d .next/diagnostics/analyze || {
      echo "FATAL: analyzer produced no output — the gate below is measuring nothing." >&2
      exit 1
    }

- name: Archive it for before/after comparison
  uses: actions/upload-artifact@v4
  with:
    name: bundle-analysis-${{ github.sha }}
    path: .next/diagnostics/analyze

- name: Enforce the actual budget
  # The upgrade guide points here explicitly: "tools such as Chrome Lighthouse
  # or Vercel Analytics, which focus on Core Web Vitals and downloaded resource sizes."
  run: npx @lhci/cli autorun
```

**Why the split.** `next experimental-analyze` is a *diagnostic* — it tells a human where the weight is, and
the artifact makes that reviewable on a PR. The *assertion* belongs to a tool with a documented, versioned
budget file, and the Next.js documentation names which class of tool that is. Conflating the two is what
produced the original broken gate: a number scraped out of a human-readable table was never a contract, and
when the table changed there was nothing to notice.

The guide's own note about the command's stability is in its name: `experimental-analyze`. Treat the CLI
surface as movable and keep the CI step thin enough to fix in one line.

## Gotchas

**★ Symptom: the CI bundle-budget job has been green for months and a route's client JavaScript has visibly
grown.** Cause: the job greps `next build` output for `First Load JS`, and 16 removed that metric — *"We found
these to be inaccurate in server-driven architectures using React Server Components."* With no match, the
budget variable is empty and the comparison is vacuous. Fix: make an empty measurement fatal, then move the
assertion to a tool that still produces one.

```bash
set -euo pipefail
SHARED_KB=$(grep 'First Load JS shared by all' build.log | grep -oE '[0-9.]+' | head -1 || true)
if [[ -z "$SHARED_KB" ]]; then
  echo "FATAL: this gate is measuring nothing — migrate it." >&2
  exit 1
fi
```

**★ Symptom: a CI script parses `.next/diagnostics/analyze` for a size number and breaks after a patch
upgrade.** Cause: the guide documents that directory as a static artifact to *save, share and copy*, not as a
machine-readable API — no schema is published, and the command is named `experimental-analyze`. Fix: archive
the directory as a build artifact for humans to compare, and enforce numeric budgets with a tool that
documents one.

```yaml
- uses: actions/upload-artifact@v4
  with:
    name: bundle-analysis-${{ github.sha }}
    path: .next/diagnostics/analyze
```

**Symptom: a refactor "obviously" reduced the bundle but nobody can show it.** Cause: no before-snapshot was
taken, and the analysis is not retained between runs. Fix: snapshot before you start — the guide's own
workflow.

```bash
npx next experimental-analyze --output
cp -r .next/diagnostics/analyze ./analyze-before-refactor
# ... do the work, re-run, and compare the two directories
```

**★ Symptom: the PR bot that used to comment "first load JS +12 kB" now posts nothing, or posts a zero.**
Cause: same root as the gate — it parses `next build` output for metrics that no longer exist. A bot that
posts nothing is worse than one that errors, because its silence reads as "no change". Fix: make the bot fail
its step when it cannot find a measurement, and repoint it at an artifact that still exists.

```bash
set -euo pipefail
test -d .next/diagnostics/analyze || {
  echo "FATAL: no analysis to comment on." >&2
  exit 1
}
```

**Symptom: someone "fixed" the broken gate by deleting the job.** Cause: it was failing or meaningless and the
fastest route to a green pipeline was removal. Fix: this is a real risk of the loud-failure step above, so pair
it with a replacement in the same PR — the diagnostic artifact plus a budget tool — rather than landing a
failing job and waiting for someone to schedule the work.

## Interview questions

**★ Next.js 16 removed `size` and `First Load JS` from the build output. Why, and what breaks?**
They were removed because they were wrong: *"We found these to be inaccurate in server-driven architectures
using React Server Components. Both our Turbopack and Webpack implementations had issues, and disagreed on how
to account for Client Components payload."* The breakage is not in applications, it is in tooling — any CI
gate, dashboard or PR bot that scraped those columns now finds nothing. The dangerous property is the failure
mode: a missing metric produces an empty variable, an empty comparison and a pass, so the gate goes green
forever instead of erroring. The first thing to do in a codebase you inherit is check whether such a gate
exists and whether it is still measuring anything.

**★ How would you rebuild a bundle-size guard rail on Next.js 16?**
In two pieces, because one tool cannot honestly do both jobs. For diagnosis, `next experimental-analyze
--output` writes to `.next/diagnostics/analyze`; archive that directory per commit so reviewers can compare
before and after, and fail the job if it was not produced. For enforcement, use a tool that publishes a
machine-readable budget format — the upgrade guide itself points at *"tools such as Chrome Lighthouse or Vercel
Analytics"*. What you do not do is write a parser against the analyzer's output directory: no schema is
documented for it, and the command is still called `experimental-analyze`.

**Why is there no single "total bundle size" number to gate on any more?**
Because in a server-driven architecture there is no single bundle. There is a server graph and a client graph,
a module can legitimately appear in both, and what a user actually downloads depends on the route, the
prefetching behaviour and what streams in later. That is exactly the accounting problem Vercel described when
removing the metrics — its own two bundler implementations disagreed. The honest replacements measure either
the *graph* (analyzer, per route and per environment) or the *user experience* (Lighthouse, Core Web Vitals,
real downloaded bytes), and those are different questions with different tools.

**★ A dashboard has shown first-load JS flat since the Next.js 16 upgrade. What do you check first?**
Whether it is measuring anything. Flat is the exact signature of the failure: 16 removed `size` and `First
Load JS` from `next build` output, so a scraper finds no match, reports an empty or zero value, and draws a
straight line. The check is to look at the raw build log for the string the tooling greps for — if it is not
there, the dashboard has been reporting the absence of data as good news. It is worth doing this on any
inherited pipeline before trusting a single number on it, because nothing in the pipeline itself will ever
raise the alarm.

**What is the general lesson from this failure beyond Next.js?**
That a gate scraping human-readable output has no contract. The build table was formatting, not an API, and
when the format changed the scraper degraded to silence rather than to an error. Two habits follow: assert that
the *measurement exists* before comparing it to a threshold, and prefer a tool that publishes a machine-readable
budget file over one whose output you parse. Both are cheap, and both convert this class of failure from
invisible to loud.

---

← [02e · What the compiler surfaces](02e-what-the-compiler-surfaces-in-old-code.md) · [Chapter index](01-explanation.md) · Next → [03b · The two analyzers](03b-the-two-analyzers-and-how-to-read-them.md)
