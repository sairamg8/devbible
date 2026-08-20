---
title: "Coverage"
sidebar_label: "05 · Coverage"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the [Jest configuration reference](https://jestjs.io/docs/configuration)
> — `collectCoverage`, `collectCoverageFrom`, `coverageProvider`, `coverageThreshold`,
> `coveragePathIgnorePatterns`, `coverageReporters`, `coverageDirectory`.
> **No sandbox, no console blocks.**

**Coverage measures which lines ran, and nothing else.** It cannot tell you whether an
assertion was made about them. Configure it as a *floor against untested code arriving*,
never as evidence that tested code is correct.

---

## The options

| Option | Default | Note |
|---|---|---|
| `collectCoverage` | `false` | Usually a CLI flag (`--coverage`) rather than a config setting |
| `collectCoverageFrom` | `undefined` | **Globs, not regexes** — unlike the ignore options |
| `coverageProvider` | `"babel"` | or `"v8"` |
| `coveragePathIgnorePatterns` | `["/node_modules/"]` | Regexes |
| `coverageThreshold` | `undefined` | The only option that can fail a build |
| `coverageReporters` | `["clover","json","lcov","text"]` | |
| `coverageDirectory` | `"coverage"` | |

### 🔴 Without `collectCoverageFrom`, the number is a lie

By default Jest reports coverage only for files that **were imported by a test**. A file
nobody imports does not appear at all — so a module with zero tests contributes zero to
the denominator, and the percentage goes *up* as untested files are added.

```js
collectCoverageFrom: [
  'src/**/*.{ts,tsx}',
  '!src/**/*.d.ts',
  '!src/**/*.stories.tsx',
  '!src/main.tsx',
  '!src/**/__mocks__/**',
],
```

**This is the single most important line in the group.** With it, an untouched file shows
0% and drags the average down, which is exactly what you want a threshold to see.

⚠️ **These are globs and the negations use `!`** — the ignore options next to them take
regexes. Mixing the two syntaxes is a standing trap.

---

## `babel` vs `v8`

| | `babel` (default) | `v8` |
|---|---|---|
| How | Instruments the AST before running | Reads V8's own coverage data |
| Speed | Slower — every file is rewritten | Faster, near-zero overhead |
| Accuracy | The reference for branch coverage | Historically weaker on branches, much improved |
| Source maps | Not needed | Needs good maps to attribute lines back to TypeScript |

**Pick `v8` when the suite is large and coverage is slowing CI**, and check that a
transformed file's reported lines still look right — with a transformer that emits poor
source maps, `v8` can attribute lines to the wrong place. Otherwise the default is fine.

---

## `coverageThreshold` — the only option that fails a build

```js
coverageThreshold: {
  global: { statements: 80, branches: 70, functions: 80, lines: 80 },

  // per-glob — hold the important code higher
  './src/lib/pricing/**/*.ts': { statements: 95, branches: 90 },

  // per-file — an exact path, not a glob
  './src/lib/auth.ts': { statements: 100 },
},
```

Three points that decide whether this is useful or hated:

1. **A negative number is a budget, not a percentage.** `statements: -10` means *"at most
   10 uncovered statements"*. Far more stable than a percentage on a small file, where
   adding one line swings the number several points.
2. **Glob keys are subtracted from `global`.** Files matched by a specific key are
   measured against it and **removed from the global pool**, so a high glob threshold does
   not also inflate the global one.
3. 🔴 **Do not ratchet the global threshold to the current number.** It converts every
   unrelated pull request into a coverage negotiation. Set a floor you are content to hold
   for a year, and put the real rigour on the glob keys for code that warrants it.

---

## Reporters

```js
coverageReporters: [
  'text-summary',    // three lines in the CI log
  'lcov',            // for the CI's coverage UI
  ['text', { skipFull: true }],   // options via a tuple
],
```

`text` prints the full table on every run and is noise in CI; `text-summary` is the one
you want there. Keep `lcov` if anything consumes it, drop it if nothing does — it writes
a large HTML tree on every run.

---

## What coverage does not tell you

```ts
test('renders', () => {
  render(<Price value={100} discount={0.2} />);   // 100% coverage of Price
});                                               // and zero assertions
```

**Every line ran. Nothing was checked.** The test would pass if `Price` rendered the
wrong number, an empty string, or nothing at all.

That is why a high global threshold is a weak signal and can be an actively harmful one:
it is satisfiable by rendering things without asserting on them. **Thresholds are a
ratchet against untested files arriving, not a measure of test quality** — the quality
question is what the assertions say, and that belongs to
[the RTL philosophy pages](../../pages/07-rtl-core-philosophy/01-guiding-principle.md).

---

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| Coverage % rises when untested files are added | No `collectCoverageFrom`, so unimported files are invisible | Add the glob list |
| A negation pattern does nothing | Globs use `!`; the neighbouring ignore options use regexes | `'!src/**/*.stories.tsx'` |
| `v8` reports lines in the wrong place | Poor source maps from the transformer | Improve maps, or use `babel` |
| CI slows sharply with `--coverage` | Babel instrumentation on every file | Try `coverageProvider: 'v8'` |
| Threshold fails on a tiny file after one added line | Percentages are volatile on small files | Use a negative budget, e.g. `statements: -5` |
| Global % drops after adding a strict glob threshold | Glob-matched files are removed from the global pool | Expected — retune the global number |
| Every PR becomes a coverage argument | Global threshold ratcheted to the current value | Set a stable floor; put rigour on glob keys |
| `coverage/` committed by accident | It is written on every `--coverage` run | `.gitignore` it |
| 100% coverage, bugs still ship | Coverage counts executed lines, not assertions | Review what is asserted, not the number |

---

## Interview questions

**Q. Why can coverage go up when you add an untested file?**
Without `collectCoverageFrom`, only files imported by a test are measured. An unimported
file is absent from both numerator and denominator, so it cannot lower the average.

**Q. What does `collectCoverageFrom` fix, and what syntax does it use?**
It fixes the denominator by naming every file that *should* be measured. Globs, with `!`
negations — unlike the neighbouring ignore options, which are regexes.

**Q. `babel` vs `v8` provider?**
Babel instruments the AST — slower, and the reference for branch accuracy. V8 reads the
engine's own data — much faster, and dependent on source-map quality to attribute lines
back to TypeScript.

**Q. What does `statements: -10` mean?**
At most ten uncovered statements. A negative value is an absolute budget rather than a
percentage, which is far more stable on small files.

**Q. Global says 80 and a glob key says 95. How do they interact?**
Files matched by the glob are measured at 95 and removed from the global pool, so the
global 80 applies to everything else.

**Q. Why is a high global threshold a weak quality signal?**
Coverage records which lines executed. A test that renders a component and asserts nothing
covers it fully, so the metric is satisfiable without testing anything.

**Q. What is the defensible use of thresholds?**
As a ratchet stopping wholly untested files from arriving, plus high per-glob thresholds
on genuinely critical code. Not as a proxy for suite quality.

**Q. Which reporters in CI?**
`text-summary` for the log and `lcov` if something consumes it. Full `text` is noise, and
the HTML tree costs time on every run.

---

← **Prev:** [04 · Mock state and timers](./04-mock-state-and-timers.md) ·
**Next:** [06 · Workers and projects](./06-workers-and-projects.md)
