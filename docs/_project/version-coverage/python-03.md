---
name: version-coverage-python-03
description: python version coverage §3 part 3 (3.15 rc rows, uv/ruff/pre-commit rows) plus §4 summary and §5 hand-off
metadata:
  type: project
---
# Python version coverage — §3 continued (3.15, tools), §4, §5

Continues [python.md](python.md) and [python-02.md](python-02.md). Paths relative to
`docs/python/pages/` unless they start with `syllabus/`.

### 3.15 (feature-frozen 2026-05-07 · rc2 2026-09-01 · GA scheduled 2026-10-01)

W15 = What's New 3.15 (served as "3.15.0rc2 Documentation", marked draft). **3.15 is not GA today**, so
no 3.15 row is graded CONTRADICTED: a page that states 3.14 behaviour which 3.15 changes is graded
PARTIAL ("older shape") and listed in §5 under *expires 2026-10-01*.

| # | Since | Change | Kind | Status | Evidence | Source |
|---|---|---|---|---|---|---|
| 15.01 | 3.15 | Explicit lazy imports: `lazy import` / `lazy from` soft keyword, `__lazy_modules__`, `-X lazy_imports`, `sys.set_lazy_imports*` (PEP 810) | new | **COVERED** | `phase-0-runtime/11-startup-and-import-cost/03-lazy-imports.md:24,47,100` (Target 3.15); `phase-7-packaging-tooling/06-entry-points/11-import-time-cost.md:131` | W15 PEP 810 |
| 15.02 | 3.15 | Builtin `frozendict` (PEP 814, Final) | new | **PARTIAL** | taught in its 3.14 shape — "Python has no `frozendict`, deliberately", `phase-1-language-core/07-assignment-and-aliasing/10b-read-only-views-and-boundaries.md:17,62`; `06-comparisons/07b-mappings-and-sets.md:215` — both false from 3.15.0 | W15 PEP 814; PEP 814 (Status Final) |
| 15.03 | 3.15 | Builtin `sentinel` type (PEP 661, Final) | new | **PARTIAL** | forward note only, `12-eafp-vs-lbyl/05j-designing-the-failure-channel/README.md:87` ("until PEP 661 lands `sentinel()` in 3.15") | W15 PEP 661 |
| 15.04 | 3.15 | UTF-8 is the default encoding (PEP 686); `PYTHONUTF8=0` / `-X utf8=0` to opt out | default | **COVERED** | `phase-1-language-core/04-bytes-and-encoding/03-the-default-encoding.md:2,24,170` | W15 Other language changes; PEP 686 |
| 15.05 | 3.15 | Unpacking in comprehensions: `[*L for L in lists]`, `{**d for d in dicts}` (PEP 798) | new | **MISSING** | grep `\[\*[a-zA-Z_]+ for `, `PEP 798`, `unpacking in comprehension` → 0; the comprehensions topic (`phase-1-language-core/09-comprehensions/`) exists | W15 PEP 798 |
| 15.06 | 3.15 | `profiling` package: `profiling.tracing` (was `cProfile`), `profiling.sampling` "Tachyon"; `profile` deprecated (PEP 799) | new/deprecated | **PLANNED** | grep `profiling\.sampling\|Tachyon` → 0; `cProfile` shown in `phase-0-runtime/10-python-vs-node/07-performance.md:130`; S4:52 | W15 PEP 799 |
| 15.07 | 3.15 | `.start` files (`pkg.mod:callable`) replace executable `import` lines in `.pth`, which are silently deprecated (PEP 829) | new/deprecated | **MISSING** | `phase-0-runtime/06-running-code/06e-sitecustomize-and-usercustomize.md:57-72` teaches `.pth` executable lines with no mention of PEP 829; grep `\.start file`, `PEP 829` → 0 | W15 PEP 829 |
| 15.08 | 3.15 | Frame pointers on by default (PEP 831) — native profilers/eBPF unwind Python | new | **MISSING** | grep `frame pointer`, `PEP 831` → 0 | W15 PEP 831 |
| 15.09 | 3.15 | `AttributeError` hints: `Did you mean '.inner.area'`, cross-language names (`.push` → `.append`, `put` → `d[k] = v`), `delattr` suggestions | new | **MISSING** | grep `toUpperCase\|Did you mean .\.append`, `Did you mean .\.inner` → 0 | W15 Improved error messages |
| 15.10 | 3.15 | `bytearray.take_bytes()` (zero-copy hand-off) | new | **MISSING** | grep `take_bytes` → 0 | W15 Other language changes |
| 15.11 | 3.15 | Unary `+` in `match` literal patterns | new | **MISSING** | grep `case \+` → 0; `10-match-pattern-matching/` exists | W15 Other language changes |
| 15.12 | 3.15 | `-W` / `PYTHONWARNINGS` accept `/regex/` for message and module | new | **PARTIAL** | `-W`/`PYTHONWARNINGS` taught with literal fields, `11-exceptions/11b-warnings.md:95,151` | W15 Other language changes |
| 15.13 | 3.15 | `__cached__` no longer set; `__package__` removed from the import system | removed | **COVERED** | `phase-0-runtime/08-imports/01c-module-attributes-and-specs.md:34` (prefer `__spec__.cached`); `05-relative-imports.md:139`; `05b-running-a-module.md:176` | W15 Other language changes; 3.15 data model ("removed in version 3.15") |
| 15.14 | 3.15 | Per-module import locks taken parent-first (fixes a package/submodule import deadlock) | default | **MISSING** | grep `import lock`, `_ModuleLock` → 0; `08-imports/06-circular-imports.md` is silent on threaded imports | W15 Other language changes |
| 15.15 | 3.15 | Non-empty `__slots__` allowed on `tuple` subclasses (incl. `namedtuple` classes) | new | **MISSING** | grep `nonempty __slots__\|not supported for subtype` → 0; `phase-3-collections/02-tuple/08c-namedtuple-restrictions.md:198` covers only `typing.NamedTuple`'s own refusal | W15 Other language changes |
| 15.16 | 3.15 | `math.integer` module (PEP 791); `math.isnormal`, `issubnormal`, `fmax`, `fmin`, `signbit` | new | **PARTIAL** | `02-numbers/05c-the-float-number-line.md:120-122,192` — "There is no `math.isnormal` … in 3.14" (true, version-marked; 3.15 adds them) | W15 math, math.integer |
| 15.17 | 3.15 | `collections.Counter` `^` / `^=` (symmetric difference) | new | **MISSING** | grep `Counter.*\^`, `__xor__` (only set ABC lists) → 0; `phase-3-collections/06-collections-module/03c-counter-multiset-math.md:13` teaches "the five binary operators" | W15 collections |
| 15.18 | 3.15 | `asyncio.TaskGroup.cancel()` | new | **PLANNED** | S3:55 | W15 asyncio |
| 15.19 | 3.15 | `ContextDecorator` / `@contextmanager` as decorator keeps the context open across a decorated **generator or coroutine** | default | **PARTIAL** | `12-eafp-vs-lbyl/06w-the-decorator-form.md:22,110-112` teaches the 3.14 gotcha (the CM exits when the generator object is built) — correct today, obsolete from 3.15.0 | W15 contextlib |
| 15.20 | 3.15 | `json.load(s)(array_hook=)` | new | **PLANNED** | grep `array_hook` → 0 (`object_pairs_hook` taught, `phase-3-collections/03-dict/11-dicts-and-json.md:111`); S3:108 | W15 json |
| 15.21 | 3.15 | `re.prefixmatch()`; `re.match()` soft-deprecated | new/deprecated | **MISSING** | grep `prefixmatch` → 0; no `re` topic | W15 re; W15 Soft deprecations |
| 15.22 | 3.15 | Typing: `TypedDict(closed=…, extra_items=…)` (PEP 728), `TypeForm` (PEP 747), `@disjoint_base` (PEP 800) | new | **PLANNED** | grep `extra_items\|closed=`, `TypeForm`, `disjoint_base` → 0; S2:107, S2:109 | W15 typing |
| 15.23 | 3.15 | `threading.serialize_iterator`, `synchronized_iterator()`, `concurrent_tee()` | new | **PLANNED** | grep → 0 (`tee` taught single-threaded, `phase-3-collections/05-slicing/07d-islice-lifetimes.md:151`); S3:51 | W15 threading |
| 15.24 | 3.15 | `tomllib` parses TOML 1.1 (multi-line inline tables, trailing commas, `\xHH`, optional seconds) | new | **MISSING** | grep `TOML 1\.1` → 0; `tomllib` appears only as the version-guard example (`phase-0-runtime/03-release-model/04-version-directives-and-guards.md:114`). Caution for the writer: `pyproject.toml` must stay TOML 1.0 for other tools | W15 tomllib |
| 15.25 | 3.15 | `sqlite3.connect()` keyword-only after `database`; `create_function`/`create_aggregate` positional-only | removed | **PLANNED** | S3:114 | W15 Porting |
| 15.26 | 3.15 | `base64`: `padded=`, `wrapcol=`, `canonical=`; `urlsafe_b64decode` no longer requires padding | new/default | **MISSING** | grep `urlsafe_b64decode`, `padded=` → 0; `base64` has no syllabus row (JWTs are base64url, S3:85) | W15 base64; W15 Porting |
| 15.27 | 3.15 | Stdlib `__version__` / `version` / `VERSION` attributes deprecated (removal 3.20) → `sys.version_info` | deprecated | **MISSING** | stdlib cases not covered; `__version__` discussed only for third-party packages (`phase-0-runtime/08-imports/04-packages-and-init.md:270`) | W15 New deprecations |
| 15.28 | 3.15 | `-b` / `-bb` deprecated (no-ops in 3.17) | deprecated | **PARTIAL** | `phase-1-language-core/04-bytes-and-encoding/01-two-types-that-never-mix.md:51` recommends `-b`/`-bb` for test suites — fine on 3.14, deprecated from 3.15 | W15 New deprecations |
| 15.29 | 3.15 | `argparse` `suggest_on_error` on by default; `dest` inferred from a single-dash long option | default | **PLANNED** | S4:56 | W15 argparse; W15 Porting |
| 15.30 | 3.15 | `os.makedirs(parent_mode=)`, `Path.mkdir(parent_mode=)` | new | **PLANNED** | grep `parent_mode` → 0; S3:116 | W15 os, pathlib |
| 15.31 | 3.15 | `venv` creates real `platlib` dirs on POSIX (no `lib64 → lib` symlink) | default | **MISSING** | grep `lib64` → 0; `phase-0-runtime/05-virtual-environments/01-what-a-venv-is-on-disk.md` describes the layout without it | W15 venv |
| 15.32 | 3.15 | `importlib.metadata.metadata()` raises `MetadataNotFound` for a dist-info without `METADATA` | default | **MISSING** | grep `MetadataNotFound` → 0; `metadata()` taught at `phase-7-packaging-tooling/01-pyproject-toml/13-dynamic-metadata.md:237` | W15 importlib.metadata |
| 15.33 | 3.15 | `locale.getdefaultlocale()` un-deprecated | default | **PARTIAL** | see 11.50 | W15 locale |
| 15.34 | 3.15 | Stable ABI for free-threaded builds (`abi3t`, PEP 803) | new | **PARTIAL** | `phase-0-runtime/03-release-model/03-feature-freeze.md:214,269` teaches `abi3` as the escape from per-version wheels; nothing says it excluded free-threaded builds until 3.15 (grep `abi3t\|PEP 803` → 0); S3:30 (wheels) | W15 PEP 803 |
| 15.35 | 3.15 | REPL: coloured tab completion (`PYTHON_BASIC_COMPLETER`), attribute completion in `from … import` | new | **MISSING** | grep `PYTHON_BASIC_COMPLETER`, `fancycompleter` → 0; `phase-0-runtime/06-running-code/06-the-repl.md:127` stops at 3.14 | W15 Default interactive shell |
| 15.36 | 3.15 | `unicodedata.iter_graphemes()` and grapheme-break properties (Unicode 17) | new | **PARTIAL** | pages state the 3.14 fact "no grapheme segmentation": `phase-3-collections/05-slicing/02b-strides-and-reversal.md:169`, `11b-batching.md:122,231` | W15 unicodedata |
| 15.37 | 3.15 | JIT substantially upgraded; Windows x64 binaries use the tail-calling interpreter | default | **MISSING** | `01-what-python-is/06-runtime-optimisation.md:86,118` stop at 3.14 | W15 Summary; Upgraded experimental JIT |
| 15.38 | 3.15 | `datetime.strptime()` with `%d` but no year raises `ValueError` | removed | **PLANNED** | S3:109 | W15 Removed (datetime) |
| 15.39 | 3.15 | Removed: `NamedTuple` keyword syntax, zero-field `TypedDict("TD")`, `no_type_check_decorator` | removed | **COVERED** | `phase-3-collections/02-tuple/08b-typing-namedtuple.md:81,153` ("will be disallowed in 3.15") — the TypedDict/decorator halves are S2:107 | W15 Removed (typing) |

### Tools — only as far as Phase 7 teaches them (pins: uv 0.12.12, ruff 0.16.6, pre-commit 4.6.2)

Everything below shipped **after** the pins (patch releases), so none of it can be expected in the
pages yet; the rows say where each would land at the next bump. `devbible-currency` classes these as
patch drift (no re-read); they are listed so the next *minor* bump does not miss them.

| # | Since | Change | Kind | Status | Evidence | Source |
|---|---|---|---|---|---|---|
| T.01 | uv 0.12.14 | Exit codes classified: `1` for expected failures, `2` for operational/internal failures | default | **MISSING** | grep `exit code 2\|exit status 2` → 0; CI page `phase-7-packaging-tooling/02-uv/02d-frozen-and-locked-in-ci.md` predates it | uv-rel 0.12.14 |
| T.02 | uv 0.12.16 | Downloads verified against index-supplied hashes; hashes allowed in `build-constraint-dependencies` | security | **MISSING** | grep `index-supplied hash\|hashes supplied by`, `build-constraint` → 0; beside `03-dependencies/19-hashes-and-hash-checking-mode.md` | uv-rel 0.12.16 |
| T.03 | uv 0.12.18 | `uv pip install/sync --check` (report without changing) and `--output-format json` | new | **MISSING** | grep `pip (install\|sync) --check` → 0 (`--output-format json` appears only for ruff, `05-ruff/05b-controlling-fixes.md:185`); beside `02-uv/06c-uv-pip.md` | uv-rel 0.12.18 |
| T.04 | uv 0.12.18 | `uv add` / `remove` / `version` restore `pyproject.toml`, script and lock files when they fail or are interrupted | default | **MISSING** | beside `02-uv/04-add-and-remove.md`; grep `restore.*lock` → 0 | uv-rel 0.12.18 |
| T.05 | uv 0.12.14–0.12.17 | Preview churn: `uv export --batch`, `minimum-libc-version`, `pylock.toml` filename/size validation, `uv check` scope | new (preview) | **PARTIAL** | `02-uv/03c-exporting-the-lockfile.md:132-171` and `01c-installing-and-pinning-uv.md:140-144` track preview changes through **0.12.11** only | uv-rel 0.12.14, 0.12.16, 0.12.17 |
| T.06 | ruff 0.16.8 | `TC001`–`TC003` prefer `lazy` imports over `if TYPE_CHECKING:` when `target-version` ≥ py315 | default | **MISSING** | grep `TC00[1-3]` → 0; the pattern it replaces is taught at `phase-0-runtime/08-imports/06c-type-checking-imports.md:19` | ruff-rel 0.16.8 |
| T.07 | ruff 0.16.8 | `UP040` fix is always unsafe; `UP035` stops recommending `ByteString` and `no_type_check_decorator` | default | **MISSING** | grep `UP040` → 0; beside `05-ruff/05b-controlling-fixes.md` | ruff-rel 0.16.7, 0.16.8 |
| T.08 | ruff 0.16.8 | `lint.flake8-tidy-imports.extend-banned-api` | new | **PARTIAL** | `banned-api` taught, `05-ruff/01-what-ruff-replaces.md:211`; the `extend-` form is post-pin | ruff-rel 0.16.8 |
| T.09 | ruff 0.16.7–0.16.8 | 3.15 awareness: `__lazy_modules__`, `frozendict`/`slice` generics, `re.prefixmatch`, PEP 728 keywords, `TypeForm`, no `__cached__` | new | **PARTIAL** | `05-ruff/09-target-version.md:39` notes 0.16.6 already accepts `py315`; what that target means semantically is post-pin | ruff-rel 0.16.7, 0.16.8 |
| T.10 | pre-commit 4.6.0 | `pre-commit hook-impl` without `--hook-dir` (git 2.54+ config-based hooks) | new | **PLANNED** | grep `hook-impl\|--hook-dir`, `core\.hooksPath` → 0; S3:34 (topic 11 `pre-commit`, unwritten) | pc-rel v4.6.0 |

## 4 · Summary by release line

272 rows. Python has no LTS, so the "lines" are the five supported branches plus the 3.15 prerelease
and the pinned tools. "Written-scope coverage" leaves PLANNED rows out (their phase is unwritten).

| Line | Status today | Rows | COVERED | PARTIAL | MISSING | CONTRADICTED | PLANNED | Written-scope coverage | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| **3.10** | security, EOL 2026-10 | 37 | 21 | 3 | 3 | 0 | 10 | 21 / 27 = 78 % | Complete for everything its written phases own; the 3 gaps are PEP 626, the TLS defaults and `parse_qs`'s `&`-only separator. |
| **3.11** | security, EOL 2027-10 | 54 | 23 | 4 | 10 | **2** | 15 | 23 / 39 = 59 % | Headline features taught (exception groups, notes, `-P`, specialising interpreter); **2 wrong** (`singledispatch` unions, C-stack recursion) and `re`/`enum`/`LiteralString`/PEP 594 missing. |
| **3.12** | security, EOL 2028-10 | 44 | 19 | 4 | 6 | 0 | 15 | 19 / 29 = 66 % | f-strings, inlining, immortals, `batched`, `sum()` all taught; missing error hints, `sys.monitoring`, tar filters, `ssl` removals, `cached_property` locking. |
| **3.13** | bugfix → security 2026-10-01, EOL 2029-10 | 39 | 21 | 3 | 5 | **1** | 9 | 21 / 30 = 70 % | REPL, free-threading, JIT, `locals()`, `copy.replace`, `.gitignore` all taught; **1 wrong** (docstring dedent); PEP 594 removals and `ssl` strict verify missing. |
| **3.14** | **bugfix — latest stable, the target** | 49 | 23 | 5 | 6 | **2** | 13 | 23 / 36 = 64 % | Every headline feature taught; **2 wrong** (`partial` as a method descriptor, `json.tool`); missing `-c` dedent, `Placeholder`, `uuid7`, Sigstore, `\z`, `is_none`. |
| **3.15** (rc2) | prerelease, GA 2026-10-01 | 39 | 4 | 9 | 17 | 0 | 9 | 4 / 30 = 13 % | Only lazy imports, UTF-8 default, `__cached__`/`__package__` and the `NamedTuple` removal are taught; 9 pages state 3.14 facts that 3.15 reverses (frozendict, `ContextDecorator`, `isnormal`, graphemes, `-b`…). |
| Tools (uv / ruff / pre-commit) | pins 0.12.12 / 0.16.6 / 4.6.2 → 0.12.18 / 0.16.8 / 4.6.2 | 10 | 0 | 3 | 6 | 0 | 1 | 0 / 9 | All post-pin patch features; nothing wrong, nothing expected yet. |
| **Total** | | **272** | **111** | **31** | **53** | **5** | **72** | 111 / 200 = 56 % (142 / 200 = 71 % with PARTIAL) | |

One line: **complete for 3.10's written scope; 2 wrong + 10 missing from 3.11, 6 missing from 3.12,
1 wrong + 5 missing from 3.13, 2 wrong + 6 missing from 3.14; 3.15 is previewed, not covered.**

## 5 · Hand-off to the owning lane

Owners: the `python` lane (`devbible/LOCKS.md:56`, resume file `progress_python_pages.md`) for phases 0–3, and `python · phase 7` (`LOCKS.md:57`, `CURSOR-PYTHON-PHASE7.md`) for the Phase 7 and tool rows. Every
"beside" path below was checked with `ls` on 2026-09-24. Tiers are the corpus's four.

### 5a · CONTRADICTED — a live page teaching the wrong thing (fix first)

| # | Page:line | What it says | What is true (source) | Fix | Tier |
|---|---|---|---|---|---|
| 14.28 | `phase-2-functions/06-functools/01-partial-and-freezing-callables.md:101,154` | "partial is NOT a descriptor; self will not be passed!" | Since 3.14 `functools.partial` **is** a method descriptor; 3.13 warned with `FutureWarning` (W14/W13 Porting). `partial(request, "GET")` in a class body now receives `self` *after* `"GET"` — silently wrong arguments, not a missing `self`. | Rewrite the gotcha: on 3.14 the class-body `partial` binds `self` in the wrong slot; `partialmethod` is still the answer; `staticmethod(partial(…))` restores the old behaviour. | Understand |
| 11.54 | `phase-2-functions/10-recursion-and-the-limit/01-recursion-error-and-the-c-stack.md:42-45,111` | every Python call runs `_PyEval_EvalFrameDefault` and "consumes significant C stack space" | Since 3.11 most Python-to-Python calls "consume no C stack space" (W11 Inlined Python function calls); since 3.12 the limit counts Python frames only and C recursion is guarded separately (W12). The `sys` docs still warn a too-high limit can crash. | Replace the mechanism section with the 3.11/3.12 model; keep "iterate, don't raise the limit". | Know |
| 11.32 | `phase-2-functions/06-functools/03-singledispatch-and-reduce.md:153-168` | files `Union[int, str]` with `list[str]` as unregistrable; stack `register(int)`/`register(float)` | Since 3.11 `register` accepts `int \| float` / `Union[…]` annotations (functools docs, "Changed in version 3.11"). Subscripted generics like `list[str]` are still refused. | Split the gotcha: generics refused, unions accepted since 3.11; show `def _(val: int \| float)`. | Understand |
| 13.09 | `phase-2-functions/08-docstrings/02-help-inspect-getdoc-and-doctest.md:59` | "`obj.__doc__` preserves the indentation of the Python source file" | Since 3.13 the compiler strips common leading whitespace from docstrings (W13 Other Language Changes). | Say `__doc__` is already dedented on 3.13+; `getdoc()` still adds MRO lookup and `cleandoc` of the first line. | Understand |
| 14.31 | `phase-0-runtime/06-running-code/03-m-packages-and-main-py.md:79` | `python -m json.tool < data.json    # pretty-print JSON` | 3.14: `python -m json` is preferred and `json.tool` is soft-deprecated (W14 json). | Change the example to `python -m json`. | Understand |

### 5b · MISSING, by version — tier and where each would sit

| # | Change | Tier | Sits beside (ls-verified) |
|---|---|---|---|
| 10.11 | PEP 626 line numbers (`co_lines`, `co_lnotab` gone in 3.15) | When Needed | `phase-0-runtime/12-dis-bytecode/01-reading-a-disassembly.md` |
| 10.31 | TLS defaults (OpenSSL ≥ 1.1.1, TLS 1.2 minimum) | Know | no TLS page — see 5e; nearest `phase-0-runtime/04-installing-and-versions/08-platform-stories.md` |
| 10.32 | `parse_qs` splits on `&` only | Know | `phase-1-language-core/05-truthiness/02c-tri-states-and-the-api-boundary.md` |
| 11.13 | `--help-env` / `--help-xoptions` / `--help-all` | When Needed | `phase-0-runtime/06-running-code/05-options-worth-knowing.md` |
| 11.18 | `typing.LiteralString` for injection-safe APIs | Understand | `phase-1-language-core/03-strings/04-t-strings.md` |
| 11.31 | `enum` `verify`/`member`/`nonmember`/`global_enum`, `Flag` iteration | When Needed | `phase-1-language-core/06-comparisons/05b-text-sequences-time-and-enums.md` |
| 11.33 | `hashlib.file_digest()` | Know | `phase-3-collections/02-tuple/03b-what-a-hash-value-is-not.md` |
| 11.36 | `operator.call()` | When Needed | `phase-1-language-core/06-comparisons/01b-consistency-and-dispatch.md` |
| 11.37 | `re` atomic groups, possessive quantifiers | Understand | no `re` page — see 5e; nearest `phase-1-language-core/03-strings/02-the-method-vocabulary.md` |
| 11.38 | `re` inline flags only at the start | Understand | same as 11.37 |
| 11.45 | Octal escapes > `\377` warn | Know | `phase-1-language-core/01-syntax-and-indentation/01e-line-joining-and-semicolons.md` (raw-string advice, :184) |
| 11.47 | PEP 594 dead batteries deprecated | Know | `phase-0-runtime/03-release-model/05-the-deprecation-policy.md` |
| 11.48 | `lib2to3` / `2to3` deprecated | When Needed | `phase-0-runtime/03-release-model/05-the-deprecation-policy.md` |
| 12.05 | `sys.monitoring` (PEP 669) | When Needed | `phase-1-language-core/09-comprehensions/04b-what-inlining-changed.md` (the `settrace` gotcha) |
| 12.08 | `NameError` "Did you forget to import", `self.x`, `ImportError` name hints | Know | `phase-0-runtime/08-imports/02d-diagnosing-import-failures.md` |
| 12.15 | `tarfile` extraction filters, `'data'` default in 3.14 | Know | no archive page — add to S3:116 (tempfile/shutil/os) when written |
| 12.24 | `ssl.wrap_socket` / `match_hostname` removed | Know | see 5e |
| 12.43 | `cached_property` no longer locks | Know | `phase-2-functions/06-functools/02-lru-cache-and-unbounded-cache.md` |
| 12.44 | `random.randrange` rejects non-integers | When Needed | `phase-1-language-core/02-numbers/12-conversions-and-precision-loss.md` |
| 13.05 | Keyword-argument "Did you mean" | Know | `phase-2-functions/02-parameters-in-full/03-positional-only-and-keyword-only.md` |
| 13.21 | `re.PatternError`; positional `maxsplit`/`count`/`flags` deprecated | Understand | see 5e (`re`) |
| 13.23 | `ssl` default context: `VERIFY_X509_STRICT` | Know | see 5e (TLS) |
| 13.33 | PEP 594 modules removed | Know | `phase-0-runtime/03-release-model/05-the-deprecation-policy.md` |
| 13.34 | `2to3`, `tkinter.tix`, `typing.io`/`typing.re` removed | When Needed | same |
| 14.26 | `python -c` dedents its argument | Know | `phase-0-runtime/06-running-code/04-c-and-stdin.md` |
| 14.29 | `functools.Placeholder`; `reduce(initial=)` | Understand | `phase-2-functions/06-functools/01-partial-and-freezing-callables.md` |
| 14.34 | `uuid.uuid7()` time-ordered ids | Understand | `phase-3-collections/03-dict/11-dicts-and-json.md` (uses `uuid4`); primary home is S3:151 (create → insert) |
| 14.42 | `operator.is_none` / `is_not_none` | When Needed | `phase-1-language-core/14-none-and-no-result/01-what-none-is.md` |
| 14.44 | `re` `\z`, `\B` on empty input | Understand | see 5e (`re`) |
| 14.49 | PGP dropped; verify CPython downloads with Sigstore (PEP 761) | Know | `phase-0-runtime/04-installing-and-versions/08-platform-stories.md` |
| 15.05 | Unpacking in comprehensions (PEP 798) | Understand | `phase-1-language-core/09-comprehensions/02b-multiple-clauses.md` |
| 15.07 | `.start` files; `.pth` import lines deprecated (PEP 829) | Know | `phase-0-runtime/06-running-code/06e-sitecustomize-and-usercustomize.md` |
| 15.08 | Frame pointers by default (PEP 831) | When Needed | `phase-0-runtime/01-what-python-is/06-runtime-optimisation.md` |
| 15.09 | `AttributeError` nested / cross-language hints | Know | `phase-1-language-core/01-syntax-and-indentation/01g-syntax-errors-and-messages.md` |
| 15.10 | `bytearray.take_bytes()` | When Needed | `phase-1-language-core/04-bytes-and-encoding/01-two-types-that-never-mix.md` |
| 15.11 | Unary `+` in `match` literals | When Needed | `phase-1-language-core/10-match-pattern-matching/01b-capture-versus-value-patterns.md` |
| 15.14 | Parent-first import locks | When Needed | `phase-0-runtime/08-imports/06-circular-imports.md` |
| 15.15 | Non-empty `__slots__` on tuple subclasses | When Needed | `phase-3-collections/02-tuple/08c-namedtuple-restrictions.md` |
| 15.17 | `Counter` `^` | Know | `phase-3-collections/06-collections-module/03c-counter-multiset-math.md` |
| 15.21 | `re.prefixmatch()`; `re.match` soft-deprecated | Understand | see 5e (`re`) |
| 15.24 | `tomllib` TOML 1.1 | When Needed | `phase-7-packaging-tooling/01-pyproject-toml/01-the-catch-22-that-killed-setup-py.md` (TOML strings gotcha) |
| 15.26 | `base64` padding/`padded=` changes | When Needed | `phase-1-language-core/04-bytes-and-encoding/02-encode-and-decode.md` |
| 15.27 | Stdlib `__version__` attributes deprecated | When Needed | `phase-0-runtime/08-imports/04-packages-and-init.md` |
| 15.31 | `venv` real `platlib` dirs (no `lib64` symlink) | When Needed | `phase-0-runtime/05-virtual-environments/01-what-a-venv-is-on-disk.md` |
| 15.32 | `importlib.metadata` `MetadataNotFound` | When Needed | `phase-7-packaging-tooling/01-pyproject-toml/13-dynamic-metadata.md` |
| 15.35 | REPL coloured completion, `from … import` attribute completion | When Needed | `phase-0-runtime/06-running-code/06-the-repl.md` |
| 15.37 | JIT upgrade; Windows x64 tail-calling interpreter | When Needed | `phase-0-runtime/01-what-python-is/06-runtime-optimisation.md` |
| T.01 | uv exit codes 1 vs 2 | Know | `phase-7-packaging-tooling/02-uv/02d-frozen-and-locked-in-ci.md` |
| T.02 | uv verifies index-supplied hashes | Know | `phase-7-packaging-tooling/03-dependencies/19-hashes-and-hash-checking-mode.md` |
| T.03 | `uv pip install/sync --check`, JSON output | When Needed | `phase-7-packaging-tooling/02-uv/06c-uv-pip.md` |
| T.04 | uv restores files when `add`/`remove`/`version` fail | When Needed | `phase-7-packaging-tooling/02-uv/04-add-and-remove.md` |
| T.06 | ruff `TC001`–`TC003` prefer `lazy` imports on py315 | Know | `phase-0-runtime/08-imports/06c-type-checking-imports.md` |
| T.07 | ruff `UP040` fix always unsafe | When Needed | `phase-7-packaging-tooling/05-ruff/05b-controlling-fixes.md` |

### 5c · PARTIAL worth finishing while the page is open

10.18 walrus 3.10 relaxations (`05-truthiness/05b-walrus-rules-and-scope.md:28`) · 10.26 `types.NoneType`
as a spelling · 10.30/12.20 say `distutils` left the stdlib in 3.12 (`01-pyproject-toml/01-…setup-py.md:56`) ·
11.20 `reveal_type`/`assert_type` · 11.26 `contextlib.chdir` (not parallel-safe) · 11.41
`catch_warnings(action=…)` · 11.50 `getdefaultlocale` deprecated then un-deprecated in 3.15 · 12.11
invalid-escape `SyntaxWarning` · 12.32 `sqlite3` named placeholders + sequence → `ProgrammingError`
(3.14) · 12.33 the 3.12 recursion-limit split (pairs with 11.54) · 13.11 `PythonFinalizationError` ·
13.15 `queue.Queue.shutdown()` beside the `None` sentinel · 13.32 `sys._is_interned()` · 14.03
`from __future__ import annotations` is deprecated · 14.22 3.14 `precision_with_grouping` grammar
(`03-strings/03c-the-format-spec-mini-language.md:28-37`) · 14.27 the 3.14.0–3.14.4 incremental-GC
window · 14.33 `PicklingError` normalisation · 14.39 `compression.zstd` · T.05/T.08/T.09 at the next
uv/ruff minor bump.

### 5d · Expires 2026-10-01 (3.15.0 GA) — update these pages on release day

`07-assignment-and-aliasing/10b-read-only-views-and-boundaries.md:17,62` and
`06-comparisons/07b-mappings-and-sets.md:215` (no `frozendict` → builtin, PEP 814) ·
`12-eafp-vs-lbyl/06w-the-decorator-form.md:22,110` (decorated generators now stay inside the context) ·
`02-numbers/05c-the-float-number-line.md:120-122,192` (`math.isnormal`/`issubnormal` exist) ·
`phase-3-collections/05-slicing/02b-strides-and-reversal.md:169`, `11b-batching.md:122,231`
(`unicodedata.iter_graphemes`) · `04-bytes-and-encoding/01-two-types-that-never-mix.md:51` (`-b`/`-bb`
deprecated) · `12-eafp-vs-lbyl/05j-designing-the-failure-channel/README.md:87` (`sentinel()` landed) ·
`11-startup-and-import-cost/03-lazy-imports.md:13,167` (Target 3.15 is released) ·
`04-bytes-and-encoding/03-the-default-encoding.md:170` (UTF-8 is now the default) ·
`docs/python/README.md:26-28`, `syllabus/01-foundations.md:25`, `03-release-model/README.md:19`,
`03-release-model/02-the-support-window.md` (3.15 current, 3.13 security-only, 3.10 EOL) — and the
3.14.7 spine meets 3.14.8 on 2026-10-06 (PEP 745; patch drift only).

### 5e · Syllabus gaps the delta exposed (propose to the user; not added)

- **No `re` topic anywhere** (grep all four syllabus parts for `regex|regular expression` → 0), yet 8 `re`
  rows land in 3.11–3.15 and pages already use `\Z`. A Phase 1 or Phase 10 row — *Understand*.
- **No TLS / `ssl` row**: 10.31, 12.24, 13.23 have nowhere to go; S3:110 (HTTP clients) or S4:55
  (security hygiene) could carry "verify on, default context, never `wrap_socket`" — *Know*.
- **No id-design row**: `uuid7` (14.34) belongs with S3:151 (create → 201, keys) — *Understand*.
- **No `enum` row** though enums appear in 6 pages; 11.29–11.31 live in a comparisons page — *Know*.
- Archive extraction safety (12.15) fits S3:116 — *Know*.

### 5f · Pin and currency corrections (report only — nothing edited)

- `src/data/pins.js` python `pin: '3.14'` — **correct** until 3.15.0 ships on 2026-10-01; bump the
  minor then (the corpus has 835 spines on 3.14; `devbible-currency` decides re-read scope).
- `uv` pin 0.12.12 → 0.12.18 and `ruff` 0.16.6 → 0.16.8 are patch drift — no re-read needed.
- **`static/currency.json` ruff `latest: "0.4.10"` is wrong** (§1): `scripts/currency.mjs:134` reads one
  page of `/tags`, which ruff's old `v0.x` tags fill. Fix the script to use `/releases/latest` (or page
  through `/tags`) for `gh:` sources — otherwise ruff drift stays invisible.

### 5g · Non-version defects found in passing

- `phase-2-functions/10-recursion-and-the-limit/01-recursion-error-and-the-c-stack.md:108`:
  "`RecursionError` inherits directly from `Exception` (specifically `BuiltinException`)" — the 3.14
  exceptions reference says it "is derived from `RuntimeError`".
- Status boards out of date (§2c S1–S4): `docs/python/README.md:44`, `pages/README.md:22-34`,
  `pages/phase-3-collections/README.md:40-41`.
