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
