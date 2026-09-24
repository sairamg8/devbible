---
name: devbible-css-blink-crosscheck
description: 2026-08-31 — the CSS corpus now has a SECOND engine. harness.mjs takes ENGINE=firefox|blink, all 12 scripts ran on both, and the diff is recorded. PAUSED mid-pass; 4 pages still to annotate. Open before any CSS measurement work.
metadata:
  type: progress
---

# CSS — the Gecko/Blink cross-check · PAUSED 2026-08-31

**Stopped on the user's word** (*"Wait enough for now"*) with everything committed and
`git status` clean for `docs/css` and `sandbox/css`.

## Why this happened at all

Chasing a "Firefox 153.0.3 → 154.0.1 major drift on 48 pages" alarm from the new currency
tool. The alarm was **wrong** (see [[devbible-currency-system-build]]) — but the question
*"why Firefox?"* had a real answer: **Firefox was the only browser on the machine**, logged
as **open question 1** in `docs/css/README.md` on 2026-08-13 and never answered.

🔴 **Microsoft Edge 152.0.4191.53 is installed** at `/usr/bin/microsoft-edge`. Blink was
reachable the whole time. The open question was closed by the environment, not by a decision.

## What is done — commits `a8e682b1`, `eb523bec`, `22feb749`

| | |
|---|---|
| `sandbox/css/harness.mjs` | takes `ENGINE=firefox\|blink`. **All 12 committed scripts run unchanged on either** — the engine is a harness variable, never a second corpus of measurement code |
| `sandbox/css/tmp/{gecko,blink}/` | both full runs, 12 files each, committed as evidence |
| `docs/css/README.md` | the engine table, the five-group difference table, and **open question 1 closed** |
| `docs/css/pages/phase-0-how-css-runs/10-baseline-and-shipping.md` | the Blink block added; *"One engine on this machine"* → *"Two engines, still not cross-browser"* |

## 🔴 Two harness bugs, both worth remembering

1. **One shared `.ffprof` profile.** A batch run inherited the previous run's lock.
   Profiles are now **per-process** (`.profiles/<engine>-<pid>`, removed on close), and the
   committed `.ffprof` is left alone — it had been getting dirtied into every `git status`.
2. 🔴 **`/usr/bin/firefox` is a shell wrapper for the SNAP at `/snap/bin/firefox`.** The
   confined process is not ours to signal, so Puppeteer's teardown throws `kill EACCES`
   **every time, on Gecko only, and always AFTER the measurement is printed**. Unhandled, it
   made **10 of 12 scripts "fail" with complete, correct output on disk** — the worst kind
   of failure, one that discards good data and looks like a broken harness. Now tolerated,
   and only for that exact error. **This is not the Claude sandbox** — it fails identically
   outside it.

## What the cross-check found

**Four scripts agree completely**: `ex09` selector matching · `ex11` cascade order ·
`ex12` inheritance and computed values · `ex08` what DevTools shows.
**Every conclusion the other eight draw held on both engines.** Only values differed:

| # | Difference | Gecko | Blink |
|---|---|---|---|
| 1 | `:is()` with an invalid argument | keeps `:is(.d, ::nonsense)` | reports `:is(.d)` |
| 2 | UA `button` padding | `1px 4px` | `1px 6px` |
| 3 | Generic font serialisation | `serif`, `sans-serif` | `"Times New Roman"`, `Arial` |
| 4 | `border` longhand order in CSSOM | grouped **by side** | grouped **by property** |
| 5 | 🔴 Feature support | `scroll-driven-animations`, `calc-size`, `interpolate-size`, `text-wrap-pretty`, `text-size-adjust` all **false** | all **true** |

🔴 **Group 5 is the prize.** All five are *Limited availability* in `web-features`. Gecko
flags **2** features as "works here but is not Baseline"; Blink flags **6**. The syllabus
already argued *"one engine's `CSS.supports` is not a shipping decision"* — it can now
**demonstrate** it, in the engine most developers actually test in.

Timings differed without changing a conclusion (Gecko FCP floor 17ms, Blink 28ms; a normal
sheet blocks ~630ms in both). `:has()` costs more than a pre-computed class in both — but
**8× in Gecko and ~150× in Blink**, so the ratio is engine-specific and no page states one.

## 🔴 NEXT — four pages still to annotate, in this order

1. `phase-0-how-css-runs/09-supports-feature-queries.md` — same group-5 data, plus
   `text-size-adjust` (false/true) from `ex07`
2. `phase-0-how-css-runs/06-user-agent-stylesheets.md` — the `1px 4px` vs `1px 6px` button
   padding and the generic-font serialisation, from `ex04`
3. `phase-1-selectors/05-is-and-where.md` — the `:is()` invalid-argument difference, from
   `ex02`. **The most citable finding on this list** — it is CSS semantics, not a default
4. `phase-1-selectors/06-has.md` — say the `:has()` cost ratio is engine-specific

Then `phase-0-how-css-runs/05-css-fails-silently.md` (error recovery) and
`01-what-css-is.md` (border longhand order) if the CSSOM order is actually asserted there.

⚠️ **Scope:** `docs/css/` only. **23 React pages also name Firefox** and belong to the React
session — do not touch them. A Python file is over the cap (`02-numbers/06-nan-inf…`, 336
lines); that is the Python lane's, flagged by the hook, deliberately left.

Related: [[devbible-currency-system-build]] · [[devbible-css-syllabus]] ·
[[devbible-no-new-sandbox-scripts]] · [[devbible-locks]]
