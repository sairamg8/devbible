---
name: version-coverage-python
description: python · applies up to CPython 3.14 (3.14.7), floor 3.10 · no LTS — supported lines 3.10–3.14 + 3.15rc2 compared · 272 changes: 111 covered, 31 partial, 53 missing, 5 contradicted, 72 planned · ruff currency bug found
metadata:
  type: project
---
# Python (CPython + uv, ruff, pre-commit) — version coverage vs LTS (2026-09-24)

Unit `python` = everything under `docs/python/` (`pages/` phases 0, 1, 2, 3 (topics 01–09, 08–09
partial), 7 (topics 01–06), and `syllabus/`). Read-only audit — nothing under
`/mnt/Storage/Backup/Knowledge/devbible` was changed. No sandbox: every claim below is a grep over the
corpus or a primary source fetched this session.

## 1 · Upstream release lines

Fetched 2026-09-24. **CPython has no LTS concept.** Its support policy is PEP 602's annual cadence as
amended in 3.13: one feature release each October; **two years of bugfix releases, then three years of
source-only security releases** (five years total). Lines released before 3.13 got 18 months of bugfix
and 3½ years of security. Source: devguide.python.org/versions ("Status key") and What's New 3.13
("Release schedule changes"). The audit therefore compares every **supported branch** (bugfix +
security) plus the prerelease 3.15, in place of LTS lines.

### Supported lines today

| Line | Status (devguide) | First release | Bugfix ended / ends | EOL | Latest patch (date) | Schedule PEP |
|---|---|---|---|---|---|---|
| **3.14** | **bugfix — latest stable, the devbible pin** | 2025-10-07 | 2027-10-01 | 2030-10 (eol.date: 2030-10-31) | **3.14.7** (2026-08-05) | PEP 745 |
| **3.13** | bugfix (**goes security-only 2026-10-01 — one week from today**) | 2024-10-07 | 2026-10-01 | 2029-10 (2029-10-31) | 3.13.15 (2026-08-05) | PEP 719 |
| **3.12** | security | 2023-10-02 | 2025-04-02 | 2028-10 (2028-10-31) | 3.12.14 (2026-08-12) | PEP 693 |
| **3.11** | security | 2022-10-24 | 2024-04-01 | 2027-10 (2027-10-31) | 3.11.16 (2026-08-12) | PEP 664 |
| **3.10** | security — **oldest supported; EOL this October** | 2021-10-04 | 2023-04-05 | **2026-10** (2026-10-31) | 3.10.21 (2026-08-12) | PEP 619 |

python.org's release API dates 3.10.21 / 3.11.16 / 3.12.14 to 2026-08-12; endoflife.date gives
2026-08-13 for 3.10.21 and 3.11.16 (a publish-vs-announce day). Neither changes any row below.

### Out of support (context for the floor)

| Line | EOL | Last patch |
|---|---|---|
| 3.9 | 2025-10-31 | 3.9.25 (2025-10-31) |
| 3.8 | 2024-10-07 | 3.8.20 |
| 3.7 | 2023-06-27 | 3.7.17 |

### Latest stable, and next

| Release | Kind | Date | State on 2026-09-24 |
|---|---|---|---|
| **3.14.7** | latest stable patch | 2026-08-05 | GA; next 3.14 bugfix due roughly every two months |
| **3.15.0** | next feature release | **scheduled 2026-10-01** (PEP 790, "Expected") | **not GA** — prerelease; b1 2026-05-07 (feature freeze), rc1 2026-08-04, **rc2 2026-09-01**; What's New 3.15 still marked draft. EOL 2031-10 |
| 3.16.0 | feature release after that | 2027-10-06 (PEP 826) | `main` branch, status "feature" |

### Tools pinned by the unit (policy `latest`, none has an LTS)

| Tool | Pin (`src/data/pins.js`) | Latest today | Drift | Notes |
|---|---|---|---|---|
| uv | 0.12.12 (2026-09-09) | **0.12.18** (2026-09-22) | patch ×6 | 0.12.13–0.12.18: `uv pip install/sync --check` + `--output-format json` (0.12.18), index-supplied hash verification (0.12.16), resumable downloads and exit-code classification 1 vs 2 (0.12.14), GraalPy 3.13 (0.12.13). |
| ruff | 0.16.6 (2026-09-03) | **0.16.8** (2026-09-16) | patch ×2 | 0.16.7–0.16.8 are almost all 3.15 readiness: `__lazy_modules__`, TC001–TC003 prefer `lazy` imports on 3.15+, `re.prefixmatch`, `frozendict` generics, PEP 728 / `TypeForm`; `UP040` fix now always unsafe; new `extend-banned-api`. |
| pre-commit | 4.6.2 (2026-08-10) | 4.6.2 | none | 4.6.0 (2026-04-21) added `hook-impl` without `--hook-dir` for git 2.54+ hooks. |
| sortedcontainers | 2.4.0 | 2.4.0 (2021-05-16) | none | unchanged since 2021. |

**Pin check:** `pins.js` → `python { source eol:python, policy latest, pin 3.14 }` is correct: 3.14 is
the newest GA line and 3.15.0 is not released. `static/currency.json` (generated 2026-09-24) records
ruff `latest: "0.4.10"`, drift `none` — **wrong**: GitHub releases and PyPI both give 0.16.8. Cause
(read, not run): `scripts/currency.mjs:134` reads only the first page of `/repos/astral-sh/ruff/tags?per_page=100`;
GitHub orders tag names so that ruff's old `v0.4.10 … v0.0.231` tags fill all 100 slots, and the
unprefixed `0.5.0`+ tags never arrive. The checker has therefore been blind to ruff drift (§5).

### Sources (all fetched 2026-09-24)

- `https://endoflife.date/api/python.json` — cycles, `support` (bugfix end), EOL, latest patch per line.
- `https://devguide.python.org/versions/` — branch status (bugfix / security / prerelease / feature), first release, EOL, the status key (2-year bugfix since 3.13).
- `https://peps.python.org/api/release-cycle.json` — same table as JSON (3.16 = PEP 826, 2027-10-06).
- `https://peps.python.org/pep-0790/` — 3.15 schedule: b1 2026-05-07, rc1 2026-08-04, rc2 2026-09-01, final expected 2026-10-01.
- `https://www.python.org/api/v2/downloads/release/?is_published=true` — patch release dates (3.14.7, 3.13.15, 3.12.14, 3.11.16, 3.10.21, 3.15.0rc2).
- `https://docs.python.org/3.15/whatsnew/{3.10,3.11,3.12,3.13,3.14,3.15}.html` — the per-release change lists behind §2b and §3 (3.15 page served as "3.15.0rc2 Documentation").
- `https://api.github.com/repos/{astral-sh/uv,astral-sh/ruff,pre-commit/pre-commit}/releases` and `https://pypi.org/pypi/{uv,ruff,pre-commit,sortedcontainers}/json` — tool versions and release notes.
- `endoflife.date/api/{uv,ruff,pre-commit}.json` — **404** (not tracked there); GitHub/PyPI used instead.

## 2 · Content baseline — "applies up to"

### 2a · Version spines (measured)

840 `.md` files under `docs/python`; **835 carry a `> Verified:` / `> Target:` / `> Version spine:` line**
(1,429 spine lines). The 5 without one: the 4 `syllabus/` parts and `pages/README.md`.

| Version string in spine lines | Occurrences |
|---|---|
| `Python 3.14` / `CPython 3.14` (minor only) | 553 + 272 |
| `Python 3.14.7` / `CPython 3.14.7` (patch) | 394 + 24 |
| `Python 3.15` | 2 — `phase-0-runtime/11-startup-and-import-cost/03-lazy-imports.md:13` (Target 3.15, final due 2026-10-01) and `phase-7-packaging-tooling/06-entry-points/11-import-time-cost.md:9` (cites PEP 810) |
| `Python 3.13` / `3.7` / `3.6` | 1 each — all *citations* of older What's New pages inside a 3.14 spine (`phase-3-collections/03-dict/02-insertion-order-is-a-guarantee.md:9`, `phase-7-packaging-tooling/04-project-layout/02-sys-path-zero.md:9`) |
| `uv 0.12.12` | 149 |
| `ruff 0.16.6` | 136 (+1 `ruff 0.15.22`: the *from* side of the upgrade worked example, `05-ruff/14-upgrading-ruff.md:15`) |
| `pre-commit 4.6.2` | 91 |

Per file: every page whose spine names a CPython version names **3.14** (617 of them also the patch
3.14.7). 29 files have a spine that names no CPython version — the 4 syllabus parts, `pages/README.md`,
two Node-side pages in `10-python-vs-node`, and 22 PyPA-spec / uv-concept pages in
`phase-7-packaging-tooling/03-dependencies`. `Verified:` dates: 188 × 2026-08, 645 × 2026-09.

Body-text version-delta markers (`3.x+`, `since 3.x`, `added in 3.x`, `(3.x)`, `before 3.x`, `3.x-only`):
3.8 ×36 · 3.9 ×21 · **3.10 ×51 · 3.11 ×78 · 3.12 ×89 · 3.13 ×79 · 3.14 ×215** · 3.15 ×34. The pages
mark what arrived when, back to the oldest supported line.

Worked-project floors in Phase 7: `requires-python = ">=3.12"` ×43, `">=3.14"` ×11, `">=3.13"` ×10,
`">=3.11"` / `">=3.10"` / `">=3.9"` ×7 each; ruff `target-version = "py312"` ×7; Docker base
`python:3.14-slim` ×12, `python:3.14.7-slim` ×6.

### 2b · Feature probes (headline features per line, grep over `docs/python`)

| Line | Headline features taught | Headline features absent | Verdict |
|---|---|---|---|
| **3.10** | `match` (PEP 634) — a whole topic, `phase-1-language-core/10-match-pattern-matching/` (5 files); `zip(strict=True)` (PEP 618) — `08-control-flow/02-enumerate-and-zip.md`; `X \| Y` unions (PEP 604); `ParamSpec` (PEP 612) — `phase-2-functions/05-decorators/02-…wraps.md`; `TypeGuard` (PEP 647) — `02-numbers/04d-booleans-and-the-type-system.md`; `EncodingWarning` / `encoding="locale"` (PEP 597) — `04-bytes-and-encoding/03-the-default-encoding.md`; `bisect` `key=` — `07-heapq-and-bisect/07b-the-key-parameter.md`; `pairwise`, `bit_count` | `TypeAlias` (PEP 613), PEP 626 line numbers | **fully applies** |
| **3.11** | `ExceptionGroup` / `except*` (PEP 654) — 31 files, 360 lines; `add_note` (PEP 678); `tomllib` (PEP 680) as the version-guard example; `-P` / `PYTHONSAFEPATH` — `06-running-code/01-the-launch-modes.md:109`; Faster CPython / PEP 659 — `01-what-python-is/06-runtime-optimisation.md`; PEP 657 carets — `11-exceptions/09-traceback-objects.md:74` | `Self`, `LiteralString`, `NotRequired`, `dataclass_transform` (typing — Phase 6, unwritten); `TaskGroup` / `asyncio.timeout` (Phase 8, unwritten) | **applies**; the absent rows are PLANNED phases |
| **3.12** | PEP 701 f-strings — `03-strings/03-f-strings.md:110`; PEP 709 inlining — `09-comprehensions/04b-what-inlining-changed.md`; PEP 683 immortal objects — `07-everything-is-an-object/04b-immortal-objects.md`; `itertools.batched`; PEP 692 `Unpack` kwargs — `02-parameters-in-full/02-variadic-args-and-kwargs.md:108`; PEP 684 (mention) | PEP 695 generics taught only as a class-scope corner (`09-comprehensions/03c-…class-body-trap.md:190`); `@override` (PEP 698); PEP 669 `sys.monitoring`; PEP 688 buffer protocol; `sum()` Neumaier | **applies**; typing half is PLANNED |
| **3.13** | New REPL — `06-running-code/06-the-repl.md` … `06g` (7 files); free-threaded build (PEP 703) — 80 files; JIT (PEP 744); `copy.replace` — `02-tuple/08-named-records.md:146`; `warnings.deprecated` (PEP 702) — `03-release-model/05-the-deprecation-policy.md:158`; `os.process_cpu_count`; PEP 667 `locals()` | PEP 594 dead-battery removals; PEP 696 type-parameter defaults; docstring dedent (taught the pre-3.13 way, §3 13.09); `__static_attributes__` | **applies** |
| **3.14** | PEP 649/749 — `phase-2-functions/09-annotations-at-runtime/` (whole topic); t-strings (PEP 750) — `03-strings/04-t-strings.md`; PEP 758 — `11-exceptions/05-catching-specific-types.md:84`; PEP 765 — `11-exceptions/03e-…finally.md`; PEP 768 `pdb -p` — `06-running-code/06f-dropping-into-a-repl.md:179`; PEP 779 — `02-the-gil/06-free-threading.md`; tail-call interpreter; `forkserver` default — `10-python-vs-node/03-python-model.md:131`; `int()` without `__trunc__` — `02-numbers/12-…precision-loss.md:61`; `heapq` max-heap API — `07-heapq-and-bisect/04-max-heaps.md`; `float.from_number`; `-X importtime=2`; `context_aware_warnings` — `11-exceptions/11b-warnings.md:111` | Zstandard (PEP 784, one line); asyncio introspection; `Path.copy`/`move`; `uuid7`; `functools.Placeholder`; `UnionType` is `Union`; `get_event_loop()` raising | **applies — the build target** |
| **3.15** (rc2, GA 2026-10-01) | Lazy imports (PEP 810) — `11-startup-and-import-cost/03-lazy-imports.md` (Target 3.15); UTF-8 default (PEP 686) — `04-bytes-and-encoding/03-the-default-encoding.md:170`; `sentinel()` (PEP 661) — forward note, `05j-designing-the-failure-channel/README.md:87`; `__package__` removal quoted | `frozendict` (PEP 814 — page says there is none, §2c); unpacking in comprehensions (PEP 798); `profiling` / Tachyon (PEP 799); `.start` files (PEP 829); TypedDict `closed`/`extra_items`, `TypeForm`; `re.prefixmatch` | **previewed, not covered** |

### 2c · Stale claims (false today, or false within a week)

Grep: `latest|current|newest|recent|upcoming|will be|not yet|experimental|preview|LTS|lands|due|scheduled|future`
on the same line as a version string, outside spine lines — 199 candidate lines, each read.

**False today**

| # | File:line | Claim (≤15 words) | Why it is false |
|---|---|---|---|
| S1 | `docs/python/README.md:44` | "Not started — the syllabus comes first, the explanation pages follow" | 835 explanation files exist across phases 0, 1, 2, 3 and 7. |
| S2 | `docs/python/pages/README.md:22` | Phase 1 "In flight — 15 of 16 … Only 12 · EAFP vs LBYL remains" | Phase 1 README line 23 says "CLOSED — 16 of 16"; 12 · EAFP has 76 files. |
| S3 | `docs/python/pages/README.md:24,28` | Phase 3 and Phase 7 "Planned" | Phase 3 has 197 files (7–9 of 12 topics), Phase 7 has 159 (6 of 12). |
| S4 | `docs/python/pages/phase-3-collections/README.md:40-41` | 08 `copy` vs `deepcopy` and 09 Iteration idioms "*(not written yet)*" | 08 has 13 chunks, 09 has 3 (mid-write, row owed per commit `d92af5b65`). |
| S5 | `docs/python/pages/phase-0-runtime/06-running-code/03-m-packages-and-main-py.md:79` | `python -m json.tool < data.json    # pretty-print JSON` | 3.14 What's New: `python -m json` "is now preferred to python -m json.tool, which is soft deprecated". |
| S6 | `static/currency.json` (outside the unit, feeds its badges) | ruff `"latest": "0.4.10"`, drift `none` | Latest is 0.16.8 (2026-09-16); tag-page bug, §1. |

**True for the 3.14 target, false from 3.15.0 (2026-10-01) — already superseded upstream**

| # | File:line | Claim | Why |
|---|---|---|---|
| S7 | `phase-1-language-core/07-assignment-and-aliasing/10b-read-only-views-and-boundaries.md:17,62` | "Python has no `frozendict`, deliberately" / "Why there is no `frozendict`" (cites rejected PEP 416) | PEP 814 (Status **Final**, Python 3.15) adds builtin `frozendict`; the "deliberately" rationale is reversed. |
| S8 | `phase-1-language-core/06-comparisons/07b-mappings-and-sets.md:215` | "use a `frozendict` from a library, since the standard library has none" | Same — builtin from 3.15. |
| S9 | `docs/python/README.md:27` and `syllabus/01-foundations.md:25` | "3.13 (3.13.15) in bugfix; 3.10–3.12 security-only" / "3.13 in bugfix" | 3.13 bugfix ends 2026-10-01 (endoflife.date) — last binary 3.13.16 on 2026-10-06 (PEP 719); 3.10 EOL 2026-10. |
| S10 | `docs/python/README.md:28`, `phase-0-runtime/03-release-model/README.md:19` | "RC1 shipped 4 Aug 2026" as the latest 3.15 milestone | True but superseded: **rc2 shipped 2026-09-01** (PEP 790, python.org). |
| S11 | `phase-0-runtime/11-startup-and-import-cost/03-lazy-imports.md:167` | "3.15 is not released as of this writing" | Expires 2026-10-01. |
| S12 | pin `3.14.7` in 418 spine lines | patch spine | 3.14.8 is scheduled 2026-10-06 (PEP 745) — patch drift only; `devbible-currency` says no re-read for a patch. |

**Checked and still true** (not listed above): Node 26 "shipped May 2026" and Node 24 LTS
(`10-python-vs-node/01-the-real-question.md:120-121`; endoflife.date nodejs: 26 released 2026-05-05,
LTS from 2026-10-28); PyPy "currently support python 3.11 and 2.7" (`08-alternatives.md:37`; pypy.org
today); `uv python install --default` "experimental" (`04-uv.md:74`; uv docs still say experimental);
3.13.16 on 2026-10-06 (`02-the-support-window.md:20`; PEP 719); `__package__` removed in 3.15
(`08-imports/05-relative-imports.md:139`; the 3.15 data model says "removed in version 3.15");
the generational cycle collector (`01-what-python-is/05-the-interpreter-loop.md:124`) — correct for
3.14.5+ because 3.14.0–3.14.4's incremental GC was reverted (§3 row 14.25).

**Verdict: Content applies up to CPython 3.14 (3.14.7) (floor 3.10).** Every one of 835 spines
names 3.14, and every 3.14 headline feature a backend developer writes against (deferred annotations,
t-strings, PEP 758/765, free-threading phase II, `forkserver`, `int()`/`__trunc__`) has a teaching page;
3.15 appears only as forward notes. The floor is 3.10 because the language pages mark 3.11–3.14
deltas explicitly (78 / 89 / 79 / 215 markers) and lean on 3.10 syntax (`match`, `zip(strict=)`,
`X | Y`) as the baseline, while the Phase 7 worked project assumes `requires-python >= 3.12`.

## 3 · The delta table

Every teachable change from 3.10 (oldest supported line) through 3.14 (latest stable), then 3.15
(feature-frozen since b1, rc2 shipped, GA 2026-10-01), then the pinned tools as far as Phase 7 teaches
them. Grep: case-insensitive ERE over `docs/python/{pages,syllabus,README.md}`, at least two terms per
row; a hit was opened and read before a row was graded COVERED.

**Sources** (all fetched 2026-09-24): **W10…W15** = `https://docs.python.org/3.15/whatsnew/3.1N.html`,
cited by section name; **PEP n** = `https://peps.python.org/pep-0n/`; **uv-rel / ruff-rel / pc-rel** =
the GitHub releases pages of astral-sh/uv, astral-sh/ruff, pre-commit/pre-commit.

**Syllabus anchors for PLANNED**: `S1` = `syllabus/01-foundations.md`, `S2` = `syllabus/02-data-model.md`,
`S3` = `syllabus/03-application.md`, `S4` = `syllabus/04-production.md` (line numbers as read today).
Unwritten phases: 3 topics 10–12 (S2:31–33), 4 (S2:49–63), 5 (S2:79–88), 6 (S2:104–115), 7 topics
07–12 (S3:30–35), 8 (S3:50–62), 9 (S3:78–91), 10 (S3:106–118), 11 (S3:145–161), 12 (S4:23–34), 13 (S4:49–60).

**Left out on purpose** (not teachable to this track's reader, per `README.md` scope and S4:17–18):
C API, build/configure flags and bytecode opcodes; IDLE, tkinter, turtle, curses; platform tiers
(iOS/Android/WASI/Emscripten) and BSD/Bluetooth socket constants; niche modules (wave, mailbox,
imaplib, calendar, ctypes internals, dbm); pure performance numbers; Unicode-database bumps;
import-hook *authoring* APIs (`importlib.abc` finder/loader methods); `unittest.TestCase` method
additions (the syllabus teaches pytest; unittest is read-only legacy, S4:17–18); `statistics`
additions (data science is out of scope, `README.md:18-20`).

Row ids are `<minor>.<nn>`; §4 and the returned `gaps` use them.

### 3.10 (released 2021-10-04 · security-only · EOL 2026-10)

| # | Since | Change | Kind | Status | Evidence | Source |
|---|---|---|---|---|---|---|
| 10.01 | 3.10 | Structural pattern matching `match`/`case` (PEP 634–636) | new | **COVERED** | `phase-1-language-core/10-match-pattern-matching/01-what-match-is.md:26`; sequence/mapping/class patterns `02-…patterns.md:25,75,114`; guards/OR/AS `03-guards-or-and-as.md:25` | W10 PEP 634 |
| 10.02 | 3.10 | Parenthesised context managers `with (a as x, b as y):` | new | **COVERED** | `01-syntax-and-indentation/01e-line-joining-and-semicolons.md:72` ("Since 3.10 the parenthesised `with`…") | W10 Parenthesized context managers |
| 10.03 | 3.10 | `zip(strict=True)` (PEP 618) | new | **COVERED** | `08-control-flow/02-enumerate-and-zip.md:114` | W10 PEP 618 |
| 10.04 | 3.10 | `X \| Y` union syntax (PEP 604), also accepted by `isinstance` | new | **COVERED** | `12-eafp-vs-lbyl/05j-designing-the-failure-channel/04-the-bill-every-caller-pays.md:47`; the `isinstance(x, int \| str)` form is not shown (grep `isinstance\([^)]*\|` → 0) — full vocabulary is S2:105 | W10 PEP 604 |
| 10.05 | 3.10 | `typing.ParamSpec` for signature-preserving decorators (PEP 612) | new | **COVERED** | `phase-2-functions/05-decorators/02-metadata-preservation-with-functools-wraps.md:96` | W10 PEP 612 |
| 10.06 | 3.10 | `typing.Concatenate` (PEP 612, second half) | new | **PLANNED** | grep `Concatenate` → 26 files, all the English verb; S2:110 (`Callable` signatures, `ParamSpec`) | W10 PEP 612 |
| 10.07 | 3.10 | `typing.TypeAlias` explicit aliases (PEP 613) | new | **PLANNED** | grep `TypeAlias\b`, `PEP 613`, `explicit type alias` → 0; S2:109 (`type Alias = …` and the pre-3.12 spelling) | W10 PEP 613 |
| 10.08 | 3.10 | `typing.TypeGuard` (PEP 647) | new | **COVERED** | `02-numbers/04d-booleans-and-the-type-system.md:103` | W10 PEP 647 |
| 10.09 | 3.10 | `EncodingWarning`, `encoding="locale"`, `-X warn_default_encoding` (PEP 597) | new | **COVERED** | `04-bytes-and-encoding/03-the-default-encoding.md:32` | W10 Optional EncodingWarning |
| 10.10 | 3.10 | Better `SyntaxError`/`IndentationError` messages (`'(' was never closed`, `expected an indented block after…`) | new | **COVERED** | `01-syntax-and-indentation/01g-syntax-errors-and-messages.md:78-84` (message table) | W10 Better error messages |
| 10.11 | 3.10 | PEP 626 precise line numbers (`co_lines`, `f_lineno` guarantees; `co_lnotab` deprecated) | new | **MISSING** | grep `PEP 626`, `co_lines\|f_lineno`, `co_lnotab` → 0 | W10 PEP 626 |
| 10.12 | 3.10 | `int.bit_count()` | new | **COVERED** | `02-numbers/01b-bitwise-operations.md:109` | W10 Other Language Changes |
| 10.13 | 3.10 | Dict views gain `.mapping` (a `MappingProxyType`) | new | **COVERED** | `phase-3-collections/03-dict/05-the-three-views.md:87` | W10 Other Language Changes |
| 10.14 | 3.10 | Builtins `aiter()` / `anext()` | new | **PLANNED** | grep `aiter\(\|anext\(` → 0; S3:57 (`async for`, async generators) | W10 Other Language Changes |
| 10.15 | 3.10 | `staticmethod`/`classmethod` inherit `__name__`/`__doc__`…, gain `__wrapped__`; static methods callable as plain functions | new | **PLANNED** | grep `staticmethod` → decorator usages only; S2:52 | W10 Other Language Changes |
| 10.16 | 3.10 | NaN hashes by object identity (no more hash 0 → quadratic sets) | default | **COVERED** | `phase-3-collections/04-set-and-frozenset/01c-what-constant-time-does-not-promise.md:237-240` | W10 Other Language Changes |
| 10.17 | 3.10 | Builtins taking ints reject `__int__`-only objects (need `__index__`) | default | **COVERED** | `phase-3-collections/05-slicing/10b-integer-keys-and-return-types.md:159`; `09-iteration-idioms/02-…position.md:27` | W10 Other Language Changes |
| 10.18 | 3.10 | Walrus allowed unparenthesised in set literals/comprehensions and sequence indexes | new | **PARTIAL** | `05-truthiness/05b-walrus-rules-and-scope.md:28-36` gives PEP 572's position table but not the 3.10 relaxations (grep `\{.*:=`, `unparenthes` → only that table) | W10 Other Language Changes |
| 10.19 | 3.10 | `@dataclass(slots=True)`, `kw_only=True`, `KW_ONLY` | new | **COVERED** | `phase-3-collections/02-tuple/08d-when-a-dataclass-beats-a-tuple.md:130-132` (`KW_ONLY` marker itself not shown; dataclasses in full = S2:53) | W10 dataclasses |
| 10.20 | 3.10 | `itertools.pairwise` | new | **COVERED** | `08-control-flow/02b-zip-idioms-and-neighbours.md:2` | W10 itertools |
| 10.21 | 3.10 | `bisect` functions take `key=` | new | **COVERED** | `phase-3-collections/07-heapq-and-bisect/07b-the-key-parameter.md:2` | W10 bisect |
| 10.22 | 3.10 | `contextlib.aclosing`, `AsyncContextDecorator`, async `nullcontext` | new | **PLANNED** | grep `aclosing` → 0; `nullcontext` taught sync-only (`12-eafp-vs-lbyl/06za-…`); S2:86, S3:57 | W10 contextlib |
| 10.23 | 3.10 | `inspect.get_annotations()` | new | **COVERED** | `phase-2-functions/09-annotations-at-runtime/02-annotationlib-and-runtime-reflection.md:18` (positioned as the 3.10 tool, superseded by `annotationlib`) | W10 inspect |
| 10.24 | 3.10 | `importlib.metadata`: `entry_points(group=…)` selection, `EntryPoints`, `packages_distributions()` | new | **COVERED** | `phase-7-packaging-tooling/06-entry-points/05-reading-entry-points-at-runtime.md:250`; `phase-0-runtime/08-imports/03b-diagnosing-and-preventing-shadowing.md:107` | W10 importlib.metadata |
| 10.25 | 3.10 | `sys.orig_argv`, `sys.stdlib_module_names` | new | **COVERED** | `09-name-main/01d-sys-argv-and-a-testable-main.md:57`; `08-imports/03b-…shadowing.md:89` | W10 sys |
| 10.26 | 3.10 | `types.NoneType`, `EllipsisType`, `NotImplementedType` restored | new | **PARTIAL** | only inside quoted `copy.py` source, `phase-3-collections/08-copy-and-deepcopy/01b-atomic-types-and-identity.md:24`; not taught as the spelling for `isinstance`/annotations | W10 types |
| 10.27 | 3.10 | `socket.timeout` becomes an alias of `TimeoutError` | default | **PLANNED** | grep `socket\.timeout` → 0 (`TimeoutError` itself taught, `11-exceptions/05b-choosing-the-exception-type.md`); S3:110 (timeouts on every HTTP call) | W10 socket |
| 10.28 | 3.10 | `traceback.format_exception(exc)` / `print_exception(exc)` accept the exception alone | new | **COVERED** | `11-exceptions/09-traceback-objects.md:85-86` | W10 traceback |
| 10.29 | 3.10 | `isinstance()` on a non-`@runtime_checkable` data-only `Protocol` raises `TypeError` | default | **COVERED** | `12-eafp-vs-lbyl/04c-protocols-and-structural-checks.md:22` (runtime_checkable as the only runtime path) | W10 typing |
| 10.30 | 3.10 | `distutils` deprecated (PEP 632) — removed in 3.12 (row 12.20) | deprecated | **PARTIAL** | `phase-7-packaging-tooling/01-pyproject-toml/01-the-catch-22-that-killed-setup-py.md:56`, `02-pep-517-the-frontend-backend-split.md:30` — historical only; grep `PEP 632`, `distutils.*(removed\|3\.12)` → 0 | W10 distutils, PEP 632 |
| 10.31 | 3.10 | OpenSSL ≥ 1.1.1 required (PEP 644); `ssl` defaults: TLS 1.2 minimum, no non-PFS ciphers | security | **MISSING** | grep `PEP 644\|OpenSSL 1\.1\.1`, `TLS 1\.2\|minimum_version` → 0 (3 unrelated `OpenSSL` hits in build pages) | W10 ssl, PEP 644 |
| 10.32 | 3.10 | `urllib.parse.parse_qs`/`parse_qsl` accept only `&` as separator (was `;` too) | security | **MISSING** | `05-truthiness/02c-tri-states-and-the-api-boundary.md:159` teaches `parse_qs` dropping blanks only; grep `parse_qs.*separator`, `separator=` → 0 | W10 urllib.parse |
| 10.33 | 3.10 | asyncio high-level API drops the `loop=` parameter | removed | **PLANNED** | grep `loop=` → 0; S3:54 (asyncio model) | W10 Removed |
| 10.34 | 3.10 | Numeric literal followed by a keyword (`0in x`) deprecated → `SyntaxWarning` (3.12) | deprecated | **COVERED** | `01-syntax-and-indentation/01c-whitespace-and-tooling.md:41-54` | W10 Deprecated |
| 10.35 | 3.10 | `threading` camelCase aliases deprecated (`currentThread`, `setDaemon`, `isSet`, `notifyAll`…) | deprecated | **PLANNED** | grep `currentThread\|setDaemon\|isSet\(\|notifyAll`, `current_thread` → 0; S3:51 (threads) | W10 Deprecated |
| 10.36 | 3.10 | `Path.hardlink_to()`; `Path.link_to()` deprecated (removed 3.12) | new/deprecated | **PLANNED** | grep `hardlink_to`, `link_to` → 0; S3:106 (`pathlib`) | W10 pathlib |
| 10.37 | 3.10 | `os.path.realpath(strict=True)` | new | **PLANNED** | only use is `12-eafp-vs-lbyl/06zg-…md:161` without `strict`; S3:116 (`os` where pathlib ends) | W10 os.path |

*§3 continues in [python-02.md](python-02.md) (3.11 onward).*
