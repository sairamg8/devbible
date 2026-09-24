---
name: version-coverage-python-02
description: python version coverage §3 part 2 — the 3.11 and 3.12 delta rows (continues python.md)
metadata:
  type: project
---
# Python version coverage — §3 continued (3.11, 3.12)

Continues [python.md](python.md) §3. Same columns, sources (W11 = What's New 3.11, W12 = What's New
3.12) and syllabus anchors (`S1`–`S4`). Paths are relative to `docs/python/pages/` unless they start
with `syllabus/`.

### 3.11 (released 2022-10-24 · security-only · EOL 2027-10)

| # | Since | Change | Kind | Status | Evidence | Source |
|---|---|---|---|---|---|---|
| 11.01 | 3.11 | `ExceptionGroup` / `BaseExceptionGroup` and `except*` (PEP 654) | new | **COVERED** | `phase-1-language-core/11-exceptions/08-exception-groups.md`, `08b-split-subgroup-and-subclasses.md:23`, `08c-except-star-semantics.md:22`; 31 files use it | W11 PEP 654 |
| 11.02 | 3.11 | `BaseException.add_note()` / `__notes__` (PEP 678) | new | **COVERED** | `11-exceptions/06b-exception-chaining.md:131` | W11 PEP 678 |
| 11.03 | 3.11 | `tomllib` in the stdlib (PEP 680) | new | **COVERED** | `phase-0-runtime/03-release-model/04-version-directives-and-guards.md:114-116` (the `tomllib`/`tomli` guard); `pyproject.toml` parsing itself is Phase 7 | W11 New Modules |
| 11.04 | 3.11 | Fine-grained error locations in tracebacks (PEP 657) | new | **COVERED** | `11-exceptions/09-traceback-objects.md:72-74` | W11 PEP 657 |
| 11.05 | 3.11 | `-P` / `PYTHONSAFEPATH`: do not prepend the script dir / cwd to `sys.path` | new/security | **COVERED** | `phase-0-runtime/06-running-code/01-the-launch-modes.md:109-116,190` | W11 Other Language Changes |
| 11.06 | 3.11 | Faster CPython: specialising adaptive interpreter (PEP 659), zero-cost `try` | new | **COVERED** | `phase-0-runtime/01-what-python-is/06-runtime-optimisation.md:28` | W11 Faster CPython |
| 11.07 | 3.11 | int↔str conversion limit, 4300 digits (CVE-2020-10735; also 3.10.7) | security | **COVERED** | `phase-1-language-core/02-numbers/02-the-int-str-conversion-limit.md`, `02b-configuring-and-avoiding-the-limit.md` | W11 Other CPython Implementation Changes |
| 11.08 | 3.11 | Starred expressions in `for` targets' iterable (`for x in *a, *b:`) | new | **COVERED** | `13-unpacking/03-star-args-and-literals.md:151,202` | W11 Other Language Changes |
| 11.09 | 3.11 | Format-spec `z` option coerces `-0.0` to `0.0` (PEP 682) | new | **COVERED** | `02-numbers/06f-printing-negative-zero.md:22` | W11 Other Language Changes |
| 11.10 | 3.11 | `object.__getstate__()` default; copy/pickle keep slots of builtin subclasses | new | **COVERED** | `phase-3-collections/08-copy-and-deepcopy/04-the-reduce-protocol.md:47` ("Since 3.11 `object` has a default one"); `06-slots-classes.md` | W11 Other Language Changes |
| 11.11 | 3.11 | `with` on a non-context-manager raises `TypeError` (was `AttributeError`) | default | **PLANNED** | grep `does not support the context manager protocol` → 0; S2:85 (context managers) | W11 Other Language Changes |
| 11.12 | 3.11 | Async comprehensions allowed inside comprehensions in `async def` | new | **PLANNED** | grep `async comprehension`, `async for.*\]` → 0; S3:57 | W11 Other Language Changes |
| 11.13 | 3.11 | `--help-env`, `--help-xoptions`, `--help-all` | new | **MISSING** | grep `--help-env\|--help-xoptions\|--help-all` → 0; the options page `phase-0-runtime/06-running-code/05-options-worth-knowing.md` does not list them | W11 Other CPython Implementation Changes |
| 11.14 | 3.11 | Windows `py` launcher `-V:<company>/<tag>` (PEP 514) | new | **COVERED** | `phase-0-runtime/06-running-code/07d-windows-launcher.md:53-54` | W11 Windows py.exe launcher |
| 11.15 | 3.11 | Variadic generics `TypeVarTuple`, starred subscripts (PEP 646) | new | **PLANNED** | only the starred-subscript side, `phase-3-collections/02-tuple/04-tuples-as-keys.md:86`; grep `TypeVarTuple` → 0; S2:109 | W11 PEP 646 |
| 11.16 | 3.11 | `TypedDict` `Required` / `NotRequired` (PEP 655) | new | **PLANNED** | grep `NotRequired\|Required\[`, `PEP 655` → 0; S2:107 | W11 PEP 655 |
| 11.17 | 3.11 | `typing.Self` (PEP 673) | new | **PLANNED** | grep `-> ?Self\b\|typing\.Self`, `PEP 673` → 0; S2:112 | W11 PEP 673 |
| 11.18 | 3.11 | `typing.LiteralString` (PEP 675) — SQL-injection-safe string APIs | new/security | **MISSING** | grep `LiteralString`, `PEP 675` → 0; no syllabus row names it (S2:107 lists `Literal`, not `LiteralString`) | W11 PEP 675 |
| 11.19 | 3.11 | `@typing.dataclass_transform` (PEP 681) | new | **PLANNED** | grep `dataclass_transform`, `PEP 681` → 0; S2:58 (Pydantic vs dataclasses), S2:109 | W11 PEP 681 |
| 11.20 | 3.11 | `typing.assert_never` / `Never`, `reveal_type`, `assert_type` | new | **PARTIAL** | `assert_never` taught: `12-eafp-vs-lbyl/05j-designing-the-failure-channel/10-exhaustiveness-and-assert-never.md:2`; grep `reveal_type\|assert_type` → 0 (S2:106 checker workflow) | W11 typing |
| 11.21 | 3.11 | Generic `TypedDict` / `NamedTuple` | new | **COVERED** | `phase-3-collections/02-tuple/08b-typing-namedtuple.md:66` (`class Page[T](NamedTuple)`) | W11 typing |
| 11.22 | 3.11 | PEP 563 (`from __future__ import annotations`) put on hold | default | **COVERED** | `phase-2-functions/09-annotations-at-runtime/01-deferred-evaluation-and-the-annotate-protocol.md:21` (3.7–3.13 stringification era) | W11 PEP 563 may not be the future |
| 11.23 | 3.11 | `asyncio.TaskGroup` — structured concurrency, preferred over `gather` | new | **PLANNED** | mentioned for its `ExceptionGroup` (`11-exceptions/13b-losing-it-across-a-boundary.md:43`, `phase-0-runtime/10-python-vs-node/03b-mixing-models.md:177`); taught in S3:55 | W11 asyncio |
| 11.24 | 3.11 | `asyncio.timeout()` context manager (over `wait_for`) | new | **PLANNED** | grep `asyncio\.timeout(`, `wait_for` → 0 (only `asyncio.TimeoutError is TimeoutError`, `11-exceptions/05b-choosing-the-exception-type.md:118`); S3:55 | W11 asyncio |
| 11.25 | 3.11 | `asyncio.Runner`; `asyncio.Barrier` | new | **PLANNED** | grep `asyncio\.Runner`, `Runner\(` → 0; S3:54 | W11 asyncio |
| 11.26 | 3.11 | `contextlib.chdir()` | new | **PARTIAL** | named only inside a docs quote, `12-eafp-vs-lbyl/06v-one-yield-and-one-use.md:126`; not taught (and not parallel-safe — unsaid); S2:86 | W11 contextlib |
| 11.27 | 3.11 | `dataclasses` rejects any unhashable default (was only list/dict/set) | default | **COVERED** | `phase-3-collections/02-tuple/08b-typing-namedtuple.md:194`; `06-collections-module/02b-defaultdict-in-production.md:187` | W11 dataclasses |
| 11.28 | 3.11 | `datetime.UTC` alias; `fromisoformat()` parses most ISO 8601 | new | **PLANNED** | used in code only (`phase-0-runtime/08-imports/01b-reload-and-monkeypatching.md:31`; `07b-the-key-parameter.md:110`); S3:109 (datetime, ISO parsing) | W11 datetime |
| 11.29 | 3.11 | `enum.StrEnum` | new | **COVERED** | `phase-3-collections/03-dict/11-dicts-and-json.md:44`; `06-comparisons/05b-text-sequences-time-and-enums.md` | W11 enum |
| 11.30 | 3.11 | `Enum.__format__` = `__str__`; mixin enums (`IntEnum`) format as their value (`ReprEnum`) | default | **COVERED** | `03-strings/03d-the-format-protocol.md:114` | W11 enum |
| 11.31 | 3.11 | `enum` `verify()`/`EnumCheck`, `member()`/`nonmember()`, `global_enum`, `Flag` iteration/`len`, `FlagBoundary` | new | **MISSING** | grep `ReprEnum\|verify\(\|nonmember\|global_enum`, `FlagBoundary` → 0; enums have no syllabus row | W11 enum |
| 11.32 | 3.11 | `functools.singledispatch` `register()` accepts `X \| Y` / `Union[...]` annotations | new | **CONTRADICTED** | `phase-2-functions/06-functools/03-singledispatch-and-reduce.md:153` files `Union[int, str]` beside `list[str]` as unregistrable and prescribes stacking `register(int)`/`register(float)` — the pre-3.11 answer; 3.14 functools docs: "Changed in version 3.11" to accept `typing.Union` | W11 functools; docs.python.org/3.14/library/functools.html |
| 11.33 | 3.11 | `hashlib.file_digest()` | new | **MISSING** | grep `file_digest` → 0; `hashlib` appears in 24 files, never with it | W11 hashlib |
| 11.34 | 3.11 | `logging.getLevelNamesMapping()` | new | **PLANNED** | grep `getLevelNamesMapping`, `getLevelName` → 0; S4:49 | W11 logging |
| 11.35 | 3.11 | `math.cbrt`, `math.exp2`; `math.pow(0.0, -inf)` returns `inf` | new/default | **COVERED** | `02-numbers/14d-powers-roots-and-logs.md:17,149` | W11 math |
| 11.36 | 3.11 | `operator.call()` | new | **MISSING** | grep `operator\.call` → 0 (`operator.` in 49 files, never `call`); S2:31 plans only `itemgetter`/`attrgetter` | W11 operator |
| 11.37 | 3.11 | `re` atomic groups `(?>…)` and possessive quantifiers `*+ ++ ?+` | new | **MISSING** | grep `atomic group\|possessive\|\(\?>` → 0; **no syllabus row covers `re` at all** (grep syllabus `regex\|regular expression` → 0) | W11 re |
| 11.38 | 3.11 | `re`: global inline flags (`(?i)`) only at the start of a pattern | removed | **MISSING** | grep `inline flag`, `\(\?i\)` → 0; no `re` topic | W11 Porting |
| 11.39 | 3.11 | `sys.exception()`; `sys.exc_info()` derived from the value | new | **COVERED** | `11-exceptions/09-traceback-objects.md`; `11-exceptions/01-the-four-clauses.md:170` | W11 sys |
| 11.40 | 3.11 | `locale.getencoding()` | new | **COVERED** | `04-bytes-and-encoding/03-the-default-encoding.md:20,30` | W11 locale |
| 11.41 | 3.11 | `warnings.catch_warnings(action=…, category=…)` takes `simplefilter` args | new | **PARTIAL** | `catch_warnings` taught only as `record=True` + `simplefilter` (`11-exceptions/11b-warnings.md:103-104`; `12-eafp-vs-lbyl/06u-catch-warnings-and-the-test-runner.md:82`) | W11 warnings |
| 11.42 | 3.11 | `random.sample()` population must be a sequence (sets refused) | removed | **COVERED** | `phase-3-collections/04-set-and-frozenset/01b-what-the-table-costs-you.md:173-175`; `06-iteration-order.md:152` | W11 Porting |
| 11.43 | 3.11 | `open()` no longer accepts the `'U'` mode | removed | **PLANNED** | grep `'U'`-mode terms → 0; S3:107 (files, newline handling) | W11 Porting |
| 11.44 | 3.11 | `@asyncio.coroutine` (generator coroutines) removed | removed | **PLANNED** | grep `asyncio\.coroutine`, `@coroutine` → 0; S2:88 (the plumbing asyncio grew out of) | W11 Removed |
| 11.45 | 3.11 | Octal escapes > `\377` deprecated → `SyntaxWarning` (3.12) | deprecated | **MISSING** | grep `octal escape` (1 unrelated git hit), `\\477\|0o377` → 0; strings pages do not cover escape warnings | W11 Deprecated |
| 11.46 | 3.11 | `int()` delegating to `__trunc__` deprecated (removed 3.14, row 14.18) | deprecated | **COVERED** | `02-numbers/12-conversions-and-precision-loss.md:61` | W11 Deprecated |
| 11.47 | 3.11 | PEP 594: 19 "dead battery" modules deprecated (`cgi`, `crypt`, `telnetlib`, `pipes`, `imghdr`…); removed 3.13 | deprecated | **MISSING** | grep `PEP 594`, `dead batter\|telnetlib\|imghdr\|crypt\b` → 0 | W11 Deprecated, PEP 594 |
| 11.48 | 3.11 | `lib2to3` / `2to3` deprecated (removed 3.13) | deprecated | **MISSING** | grep `lib2to3` → 0; `2to3` only as a package-name example (`phase-7-…/01-pyproject-toml/03-the-project-name-and-normalization.md:105`) | W11 Deprecated |
| 11.49 | 3.11 | `typing.Text` deprecated; `TypedDict` keyword-argument syntax deprecated (removed 3.13) | deprecated | **PLANNED** | grep `typing\.Text`, `TypedDict\(.*=` → 0; S2:107 | W11 Deprecated |
| 11.50 | 3.11 | `locale.getdefaultlocale()` deprecated (un-deprecated again in 3.15, row 15.33) | deprecated | **PARTIAL** | replacement APIs taught (`04-bytes-and-encoding/03-the-default-encoding.md:129`); grep `getdefaultlocale` → 0 | W11 Deprecated; W15 locale |
| 11.51 | 3.11 | `importlib.resources.files()` as the API; legacy `read_text`/`open_text` deprecated (un-deprecated 3.13) | deprecated | **COVERED** | `phase-0-runtime/09-name-main/01b-what-belongs-in-the-guard.md:184-187` (`from importlib.resources import files`) | W11 Deprecated; W13 importlib |
| 11.52 | 3.11 | `inspect.getargspec()` / `formatargspec()` removed → `inspect.signature()` | removed | **COVERED** | `inspect.signature` taught (`phase-2-functions/02-parameters-in-full/04-signature-design-and-evolution.md`, 22 hits in 5 files); the removed names appear nowhere (grep → 0), which is right | W11 Removed |
| 11.53 | 3.11 | `sqlite3`: `serialize`/`deserialize`, `blobopen`, `setlimit`, `sqlite_errorcode`/`sqlite_errorname` | new | **PLANNED** | grep `blobopen\|sqlite_errorname` → 0; S3:114 | W11 sqlite3 |
| 11.54 | 3.11 | Python-to-Python calls are inlined: **most calls consume no C stack**, so pure-Python recursion can go deeper under `setrecursionlimit` | default | **CONTRADICTED** | `phase-2-functions/10-recursion-and-the-limit/01-recursion-error-and-the-c-stack.md:42-45` teaches that each Python call runs `_PyEval_EvalFrameDefault` on the C stack and "consumes significant C stack space" — the pre-3.11 model; W11 says most calls "now consume no C stack space" | W11 Faster CPython → Inlined Python function calls |

### 3.12 (released 2023-10-02 · security-only · EOL 2028-10)

| # | Since | Change | Kind | Status | Evidence | Source |
|---|---|---|---|---|---|---|
| 12.01 | 3.12 | Type-parameter syntax `def f[T](…)`, `class C[T]:` (PEP 695) | new | **PLANNED** | used once (`phase-3-collections/02-tuple/08b-typing-namedtuple.md:66`) and its class-scope rule explained (`09-comprehensions/03c-fixing-the-class-body-trap.md:190`); taught in S2:109 | W12 PEP 695 |
| 12.02 | 3.12 | `type X = …` statement / `TypeAliasType` (PEP 695) | new | **PLANNED** | `03c-fixing-the-class-body-trap.md:195` shows `type Alias = Nested` for scoping only; grep `TypeAliasType`, `type statement` → 0; S2:109 | W12 PEP 695 |
| 12.03 | 3.12 | f-strings in the grammar: quote reuse, nesting, multi-line expressions, comments, backslashes (PEP 701) | new | **COVERED** | `phase-1-language-core/03-strings/03-f-strings.md:110` ("What PEP 701 changed in 3.12") | W12 PEP 701 |
| 12.04 | 3.12 | Per-interpreter GIL (PEP 684) | new | **COVERED** | `phase-0-runtime/02-the-gil/01-what-the-gil-is.md:257` | W12 PEP 684 |
| 12.05 | 3.12 | `sys.monitoring` low-impact monitoring (PEP 669) — what coverage/profilers now use | new | **MISSING** | grep `PEP 669`, `sys\.monitoring` → 0; tracing is shown only via `sys.settrace` (`09-comprehensions/04b-what-inlining-changed.md:175`) | W12 PEP 669 |
| 12.06 | 3.12 | Buffer protocol from Python: `__buffer__`, `collections.abc.Buffer` (PEP 688) | new | **PLANNED** | grep `PEP 688`, `__buffer__\|collections\.abc\.Buffer` → 0; S2:33 (`array`, `memoryview`) | W12 PEP 688 |
| 12.07 | 3.12 | Comprehension inlining (PEP 709): no frame, `locals()` and tracing differences | new | **COVERED** | `phase-1-language-core/09-comprehensions/04b-what-inlining-changed.md:26` | W12 PEP 709 |
| 12.08 | 3.12 | Error hints: `NameError` "Did you forget to import 'sys'?", `self.x` suggestion, `import x from y`, `ImportError` name suggestions | new | **MISSING** | grep `Did you forget to import`, `Did you mean: .self` → 0; `01-syntax-and-indentation/01g-syntax-errors-and-messages.md` covers syntax errors only | W12 Improved Error Messages |
| 12.09 | 3.12 | `**kwargs: Unpack[TypedDict]` (PEP 692) | new | **COVERED** | `phase-2-functions/02-parameters-in-full/02-variadic-args-and-kwargs.md:108-122` | W12 PEP 692 |
| 12.10 | 3.12 | `@typing.override` (PEP 698) | new | **PLANNED** | grep `@override`, `typing\.override\|PEP 698` → 0; S2:112 (class-typing kit) | W12 PEP 698 |
| 12.11 | 3.12 | Invalid escape sequences (`"\d"`) raise `SyntaxWarning` (was `DeprecationWarning`); future `SyntaxError` | deprecated | **PARTIAL** | named in a list only, `11-exceptions/03f-finding-and-fixing-finally-jumps.md:180`; the raw-string advice at `01-syntax-and-indentation/01e-line-joining-and-semicolons.md:184` does not mention the warning; strings pages silent | W12 Other Language Changes |
| 12.12 | 3.12 | Immortal objects (PEP 683) | new | **COVERED** | `phase-0-runtime/07-everything-is-an-object/04b-immortal-objects.md:131` | W12 Summary (PEP 683) |
| 12.13 | 3.12 | `slice` objects are hashable | new | **COVERED** | `phase-3-collections/05-slicing/04-slice-objects.md:21,122` | W12 Other Language Changes |
| 12.14 | 3.12 | `sum()` of floats uses Neumaier compensated summation | default | **COVERED** | `02-numbers/05d-accurate-float-arithmetic.md:2,16` | W12 Other Language Changes |
| 12.15 | 3.12 | `tarfile` / `shutil.unpack_archive` extraction `filter=`; `'data'` becomes default in 3.14 (path-traversal defence) | security | **MISSING** | grep `extraction filter\|filter=.data.` → 0; `tarfile` named only as a `-m` target / module list | W12 Other Language Changes; docs.python.org/3.14/library/tarfile.html ("Changed in version 3.14: The filter parameter now defaults to 'data'") |
| 12.16 | 3.12 | `-X perf` / `PYTHONPERFSUPPORT` Linux perf support | new | **COVERED** | `phase-0-runtime/06-running-code/05-options-worth-knowing.md:197` | W12 Other Language Changes |
| 12.17 | 3.12 | `itertools.batched()` | new | **COVERED** | `phase-3-collections/05-slicing/07c-islice-in-practice.md`; `08-control-flow/02b-zip-idioms-and-neighbours.md:2` | W12 itertools |
| 12.18 | 3.12 | `math.sumprod()`, `math.nextafter(…, steps=)` | new | **COVERED** | `02-numbers/14f-aggregation-and-the-rest.md:20`; `02-numbers/05c-the-float-number-line.md:66` | W12 math |
| 12.19 | 3.12 | `sys.last_exc` (`last_type`/`last_value`/`last_traceback` deprecated) | new | **COVERED** | `phase-0-runtime/06-running-code/06f-dropping-into-a-repl.md:65-77` | W12 sys |
| 12.20 | 3.12 | `distutils` removed (PEP 632) — setuptools still ships it | removed | **PARTIAL** | as row 10.30: historical mentions only; grep `distutils.*(removed\|3\.12)` → 0 | W12 Removed |
| 12.21 | 3.12 | `venv` / `ensurepip` no longer pre-install `setuptools` | removed | **COVERED** | `phase-0-runtime/05-virtual-environments/07-uv-venv-and-uv-run.md:34`; `phase-7-packaging-tooling/03-dependencies/18-uv-lock-vs-pip-freeze-vs-pip-compile.md:187` | W12 Summary (gh-95299) |
| 12.22 | 3.12 | `imp` removed → `importlib` | removed | **COVERED** | replacements taught: `importlib.reload` (`phase-0-runtime/08-imports/01b-reload-and-monkeypatching.md:2`), `importlib.util.find_spec` (`05-virtual-environments/08-system-site-packages.md:68`); `imp` appears nowhere | W12 Removed |
| 12.23 | 3.12 | `asyncore`, `asynchat`, `smtpd` removed | removed | **PLANNED** | grep `asyncore\|asynchat` → 0; S3:54 (asyncio is the model) | W12 Removed |
| 12.24 | 3.12 | `ssl.wrap_socket()` and `ssl.match_hostname()` removed (no SNI / hostname check — CWE-295) | removed/security | **MISSING** | grep `wrap_socket`, `match_hostname` → 0; no syllabus row covers `ssl` | W12 Removed (ssl) |
| 12.25 | 3.12 | asyncio `eager_task_factory`; `asyncio.run(loop_factory=…)` | new | **PLANNED** | grep `eager_task_factory`, `loop_factory` → 0; S3:54-55 | W12 asyncio |
| 12.26 | 3.12 | asyncio child watchers deprecated; `get_event_loop()` warns when it would create a loop | deprecated | **PLANNED** | grep `get_event_loop` → 0; S3:54 | W12 Deprecated |
| 12.27 | 3.12 | `csv.QUOTE_NOTNULL`, `csv.QUOTE_STRINGS` | new | **PLANNED** | grep → 0; S3:115 | W12 csv |
| 12.28 | 3.12 | `pathlib`: `Path.walk()`, `relative_to(walk_up=)`, subclassable `Path`, `glob(case_sensitive=)`; `os.path.splitroot`, `isjunction` | new | **PLANNED** | grep `Path\.walk\|walk_up\|case_sensitive`, `splitroot\|isjunction` → 0; S3:106 | W12 pathlib, os.path |
| 12.29 | 3.12 | `shutil.rmtree(onexc=)`; `onerror` deprecated | deprecated | **PLANNED** | grep `onexc` → 0; S3:116 | W12 shutil |
| 12.30 | 3.12 | `sqlite3` CLI (`python -m sqlite3`); `Connection.autocommit` (PEP 249 transactions) | new | **PLANNED** | grep `python -m sqlite3`, `autocommit` → 0; S3:114 | W12 sqlite3 |
| 12.31 | 3.12 | `sqlite3` default adapters/converters deprecated | deprecated | **COVERED** | `02-numbers/12c-silent-loss-and-boundaries.md:89,175-177` | W12 Deprecated |
| 12.32 | 3.12 | `sqlite3` named placeholders with a *sequence* deprecated (→ `ProgrammingError` in 3.14) | deprecated | **PARTIAL** | `phase-3-collections/02-tuple/05c-when-a-library-requires-the-tuple.md:103` quotes "a `dict` if named placeholders are used"; the deprecation and the 3.14 error are not stated | W12 Deprecated; W14 Removed (sqlite3) |
| 12.33 | 3.12 | Recursion limit counts Python code only; C recursion guarded separately; stack-overflow protection | default | **PARTIAL** | `phase-2-functions/10-recursion-and-the-limit/01-recursion-error-and-the-c-stack.md:111` frames `setrecursionlimit` purely as C-stack protection; the 3.12 split is not taught (see 11.54) | W12 sys; W12 Summary |
| 12.34 | 3.12 | `tempfile.NamedTemporaryFile(delete_on_close=)` | new | **PLANNED** | grep `delete_on_close` → 0; S3:116 | W12 tempfile |
| 12.35 | 3.12 | `isinstance` against runtime-checkable protocols uses `getattr_static`; members frozen at class creation | default | **COVERED** | `12-eafp-vs-lbyl/04c-protocols-and-structural-checks.md:49-53` | W12 typing |
| 12.36 | 3.12 | `datetime.utcnow()` / `utcfromtimestamp()` deprecated → aware `now(tz=UTC)` | deprecated | **PLANNED** | grep `utcnow`, `utcfromtimestamp` → 0 (no page uses them — good); S3:109 | W12 Deprecated |
| 12.37 | 3.12 | `os.fork()` in a multithreaded process warns; default start method to change in 3.14 | deprecated | **COVERED** | `phase-0-runtime/09-name-main/04c-fork-threads-and-executors.md:32,99` | W12 Deprecated |
| 12.38 | 3.12 | `~` on `bool` deprecated (error in 3.16) | deprecated | **COVERED** | `02-numbers/04-bool-is-an-int.md:205-208` | W12 Deprecated |
| 12.39 | 3.12 | `typing.Hashable`/`typing.Sized` aliases and `ByteString` deprecated | deprecated | **PLANNED** | grep `typing\.Hashable\|typing\.Sized`, `ByteString` → 0; S2:105 | W12 Deprecated |
| 12.40 | 3.12 | Three-argument `generator.throw(typ, val, tb)` deprecated | deprecated | **PLANNED** | grep → 0; S2:88 (`send`/`throw`/`close`) | W12 Deprecated |
| 12.41 | 3.12 | Setting `__package__` / `__cached__` deprecated (ignored from 3.15) | deprecated | **COVERED** | `phase-0-runtime/08-imports/01c-module-attributes-and-specs.md:34`; `05-relative-imports.md:139` | W12 Deprecated; W15 |
| 12.42 | 3.12 | `itertools` iterators: copy/deepcopy/pickle deprecated (removed 3.14) | deprecated | **COVERED** | `phase-3-collections/05-slicing/07d-islice-lifetimes.md:25,81` | W12 Deprecated; W14 Removed |
| 12.43 | 3.12 | `functools.cached_property` no longer locks — the getter can run twice under a thread race | default | **MISSING** | `cached_property` named for memoisation (`phase-3-collections/02-tuple/04b-the-cost-of-a-flat-key.md:168`); grep `cached_property.*(thread\|race\|lock)` → 0; the functools topic (`phase-2-functions/06-functools/`) is silent | W12 Porting |
| 12.44 | 3.12 | `random.randrange()` rejects non-integers with `TypeError` | removed | **MISSING** | grep `randrange\(10\.0`, `randrange.*TypeError` → 0; `random` has no syllabus row | W12 Porting |

### 3.13 (released 2024-10-07 · bugfix until 2026-10-01, then security · EOL 2029-10)

W13 = What's New 3.13.

| # | Since | Change | Kind | Status | Evidence | Source |
|---|---|---|---|---|---|---|
| 13.01 | 3.13 | New interactive REPL (PyREPL): multiline editing, block history, F1/F2/F3, `exit` without parens; `PYTHON_BASIC_REPL` | new | **COVERED** | `phase-0-runtime/06-running-code/06-the-repl.md:48` ("The 3.13 feature list"); `06b-repl-colour-history-and-fallback.md:22` | W13 A better interactive interpreter |
| 13.02 | 3.13 | Coloured tracebacks; `PYTHON_COLORS` / `NO_COLOR` / `FORCE_COLOR` | new | **COVERED** | `06-running-code/06b-repl-colour-history-and-fallback.md:45-48` | W13 Improved error messages |
| 13.03 | 3.13 | `PYTHON_HISTORY` | new | **COVERED** | `06b-repl-colour-history-and-fallback.md:152-158` | W13 Other Language Changes |
| 13.04 | 3.13 | "consider renaming '…/random.py'" hint when a script shadows a stdlib/third-party module | new | **COVERED** | `phase-0-runtime/08-imports/03-shadowing-the-stdlib.md:62,100-104` | W13 Improved error messages |
| 13.05 | 3.13 | Keyword-argument suggestion: `split() got an unexpected keyword argument 'max_split'. Did you mean 'maxsplit'?` | new | **MISSING** | grep `unexpected keyword argument.*Did you mean`, `max_split` → 0 | W13 Improved error messages |
| 13.06 | 3.13 | Free-threaded build, experimental (PEP 703): `python3.13t`, `PYTHON_GIL` / `-X gil`, `sys._is_gil_enabled()` | new | **COVERED** | `phase-0-runtime/02-the-gil/06-free-threading.md:44`; `03-release-model/03-feature-freeze.md:194`; `phase-3-collections/03-dict/10-dict-across-threads.md:38` | W13 Free-threaded CPython |
| 13.07 | 3.13 | Experimental JIT (PEP 744), build-time `--enable-experimental-jit` | new | **COVERED** | `phase-0-runtime/01-what-python-is/06-runtime-optimisation.md:118-129` | W13 An experimental JIT |
| 13.08 | 3.13 | `locals()` semantics defined (PEP 667): snapshots in optimised scopes, write-through `f_locals` | default | **COVERED** | `phase-1-language-core/09-comprehensions/04b-what-inlining-changed.md:73,99` | W13 Defined mutation semantics for locals() |
| 13.09 | 3.13 | The compiler strips common leading whitespace from docstrings (`__doc__` is dedented) | default | **CONTRADICTED** | `phase-2-functions/08-docstrings/02-help-inspect-getdoc-and-doctest.md:59`: "`obj.__doc__` preserves the indentation of the Python source file" — true only before 3.13 | W13 Other Language Changes |
| 13.10 | 3.13 | `__static_attributes__`, `__firstlineno__` on classes | new | **PLANNED** | grep → 0; S2:49 (class anatomy) | W13 Other Language Changes |
| 13.11 | 3.13 | `PythonFinalizationError` (blocked operations during shutdown) | new | **PARTIAL** | appears only in the hierarchy tree, `11-exceptions/04-the-exception-hierarchy.md:95` | W13 Other Language Changes |
| 13.12 | 3.13 | `str.replace(count=…)` as a keyword | new | **COVERED** | `03-strings/02b-replacing-case-and-classification.md:31` | W13 Other Language Changes |
| 13.13 | 3.13 | Annotation scopes in classes may contain lambdas/comprehensions; class-scope comprehensions are not inlined | default | **COVERED** | `09-comprehensions/03b-the-class-body-trap.md:30`; `03c-fixing-the-class-body-trap.md:190` | W13 Other Language Changes |
| 13.14 | 3.13 | `copy.replace()` and `__replace__` | new | **COVERED** | `phase-3-collections/02-tuple/08-named-records.md:146`; `08-copy-and-deepcopy/README.md:12` (owns `copy.replace`), `04c-what-a-copy-runs-unexpectedly.md:291` | W13 copy |
| 13.15 | 3.13 | `queue.Queue.shutdown()` / `queue.ShutDown` (and `asyncio.Queue.shutdown`) | new | **PARTIAL** | `queue.Queue` taught with the `None`-sentinel drain, `phase-3-collections/06-collections-module/04c-deque-iteration-and-threads.md:115-119`; grep `\.shutdown\(\)\|ShutDown` → 0 (S3:51 owns queues) | W13 queue, asyncio |
| 13.16 | 3.13 | asyncio: `as_completed()` async-iterable; `TaskGroup` cancellation fixes; `Server.close_clients()` | new | **PLANNED** | S3:52, S3:55 | W13 asyncio |
| 13.17 | 3.13 | `itertools.batched(strict=True)` | new | **COVERED** | `phase-3-collections/05-slicing/07c-islice-in-practice.md:164` | W13 itertools |
| 13.18 | 3.13 | `math.fma()` | new | **COVERED** | `02-numbers/05d-accurate-float-arithmetic.md:115`; `14f-aggregation-and-the-rest.md:61` | W13 math |
| 13.19 | 3.13 | `os.process_cpu_count()`, `-X cpu_count` / `PYTHON_CPU_COUNT`; executors and `compileall` size pools by it | new | **COVERED** | `phase-0-runtime/06-running-code/05-options-worth-knowing.md:191,227`; `10-python-vs-node/02b-node-parallelism.md:173` | W13 os, concurrent.futures |
| 13.20 | 3.13 | `pathlib`: `Path.from_uri()`, `full_match()`, `glob(recurse_symlinks=)`, `"**"` now yields files too | new/default | **PLANNED** | grep `from_uri`, `full_match\|recurse_symlinks` → 0; S3:106 | W13 pathlib; W13 Porting |
| 13.21 | 3.13 | `re.error` renamed `re.PatternError`; `maxsplit`/`count`/`flags` positional args deprecated | new/deprecated | **MISSING** | grep `PatternError`, `re\.error`, `re\.sub\(.*count` → 0; no `re` topic in any syllabus part | W13 re, New Deprecations |
| 13.22 | 3.13 | `sqlite3` `ResourceWarning` for an unclosed `Connection`; positional `connect()` args deprecated | new/deprecated | **PLANNED** | S3:114 | W13 sqlite3, New Deprecations |
| 13.23 | 3.13 | `ssl.create_default_context()` adds `VERIFY_X509_STRICT` + `VERIFY_X509_PARTIAL_CHAIN` | security | **MISSING** | grep `VERIFY_X509_STRICT`, `create_default_context` → 0; no `ssl`/TLS row | W13 ssl |
| 13.24 | 3.13 | `typing.TypeIs` (PEP 742) | new | **COVERED** | `02-numbers/04d-booleans-and-the-type-system.md:109,201` | W13 typing |
| 13.25 | 3.13 | `typing.ReadOnly` for `TypedDict` items (PEP 705) | new | **PLANNED** | one-sentence mention, `07-assignment-and-aliasing/05b-dont-touch-mine.md:98`; S2:107 | W13 typing |
| 13.26 | 3.13 | Type-parameter defaults (PEP 696); `get_protocol_members`, `is_protocol`, `NoDefault` | new | **PLANNED** | grep `PEP 696`, `TypeVar.*default=`, `get_protocol_members` → 0; S2:108-109 | W13 typing |
| 13.27 | 3.13 | `warnings.deprecated()` decorator (PEP 702) | new | **COVERED** | `phase-0-runtime/03-release-model/05-the-deprecation-policy.md:158,173` | W13 warnings |
| 13.28 | 3.13 | `venv` writes a `.gitignore` by default (`--without-scm-ignore-files`) | new | **COVERED** | `phase-0-runtime/05-virtual-environments/09-where-the-venv-lives.md:80-83` | W13 venv |
| 13.29 | 3.13 | `dis` shows logical jump labels; `-O` / `show_offsets` | default | **COVERED** | `phase-0-runtime/12-dis-bytecode/01-reading-a-disassembly.md:141,151` | W13 dis |
| 13.30 | 3.13 | `pdb`: `post_mortem()` takes exception objects; `breakpoint()` stops immediately | new | **COVERED** | `phase-0-runtime/06-running-code/06f-dropping-into-a-repl.md:86-92` | W13 pdb |
| 13.31 | 3.13 | `array` `'w'` type code; `'u'` deprecated (removal 3.16) | new/deprecated | **COVERED** | `phase-3-collections/01-list-internals/12-memory-list-tuple-array.md:99-100,171` | W13 array |
| 13.32 | 3.13 | `sys._is_interned()` | new | **PARTIAL** | interning taught (`03-strings/01b-building-and-interning.md`; `02-tuple/01b-thread-safety-and-identity.md:125`), the 3.13 probe absent (grep `_is_interned` → 0) | W13 sys |
| 13.33 | 3.13 | PEP 594 removals: `cgi`, `cgitb`, `crypt`, `telnetlib`, `pipes`, `imghdr`, `nntplib`, `audioop`, `uu`, … | removed | **MISSING** | grep `PEP 594`, module names → 0 (8 false hits on the English "pipes") | W13 Removed Modules |
| 13.34 | 3.13 | `2to3` / `lib2to3`, `tkinter.tix`, `typing.io`/`typing.re` removed | removed | **MISSING** | grep `lib2to3` → 0; `2to3` only as a name example | W13 Removed |
| 13.35 | 3.13 | Chained `classmethod` descriptors (wrapping `property`) removed | removed | **PLANNED** | grep `classmethod.*property` → 0; S2:52, S2:62 | W13 builtins |
| 13.36 | 3.13 | `typing.NamedTuple("P", x=int)` keyword syntax deprecated (removed 3.15) | deprecated | **COVERED** | `phase-3-collections/02-tuple/08b-typing-namedtuple.md:81,152-153`; `08c-namedtuple-restrictions.md:233` | W13 New Deprecations |
| 13.37 | 3.13 | `typing.AnyStr` deprecated (removal 3.18); `no_type_check_decorator` deprecated | deprecated | **PLANNED** | grep `AnyStr` → 0; S2:109 | W13 New Deprecations |
| 13.38 | 3.13 | PEP 602 amended: **two** years of bugfix from 3.13 on | default | **COVERED** | `phase-0-runtime/03-release-model/02-the-support-window.md:258` | W13 Release schedule changes |
| 13.39 | 3.13 | `argparse` `deprecated=` for options/subcommands | new | **PLANNED** | grep `deprecated=True` → 0; S4:56 | W13 argparse |

### 3.14 (released 2025-10-07 · bugfix · latest stable 3.14.7 · EOL 2030-10) — the build target

W14 = What's New 3.14.

| # | Since | Change | Kind | Status | Evidence | Source |
|---|---|---|---|---|---|---|
| 14.01 | 3.14 | Deferred evaluation of annotations (PEP 649/749): `__annotate__`, forward refs without quotes | new | **COVERED** | `phase-2-functions/09-annotations-at-runtime/01-deferred-evaluation-and-the-annotate-protocol.md:24`; `phase-0-runtime/08-imports/06c-type-checking-imports.md:114` | W14 PEP 649 & PEP 749 |
| 14.02 | 3.14 | `annotationlib` (`get_annotations`, `Format.VALUE/FORWARDREF/STRING`) | new | **COVERED** | `phase-2-functions/09-annotations-at-runtime/02-annotationlib-and-runtime-reflection.md:14,35` | W14 New modules |
| 14.03 | 3.14 | `from __future__ import annotations` deprecated (removal after 3.13's EOL, 2029) | deprecated | **PARTIAL** | pages say drop it on 3.14 (`phase-0-runtime/10-python-vs-node/04-typing.md:133-139`) and that it "remains supported" (`09-annotations-at-runtime/01-…protocol.md:108`); the deprecation itself is never stated (grep `deprecat.*__future__` → 0) | W14 Porting → from __future__ import annotations |
| 14.04 | 3.14 | Template strings `t"…"` → `string.templatelib.Template` (PEP 750) | new | **COVERED** | `phase-1-language-core/03-strings/04-t-strings.md:26,41` | W14 PEP 750 |
| 14.05 | 3.14 | `except A, B:` without parentheses when there is no `as` (PEP 758) | new | **COVERED** | `11-exceptions/05-catching-specific-types.md:84-87` | W14 PEP 758 |
| 14.06 | 3.14 | `SyntaxWarning` for `return`/`break`/`continue` leaving a `finally` (PEP 765) | new | **COVERED** | `11-exceptions/03e-return-break-continue-in-finally.md:27`; `03f-finding-and-fixing-finally-jumps.md` | W14 PEP 765 |
| 14.07 | 3.14 | Safe external debugger interface (PEP 768): `python -m pdb -p PID`, `sys.remote_exec()` | new | **COVERED** | `phase-0-runtime/06-running-code/06f-dropping-into-a-repl.md:179`; `06g-prompts-from-inside-a-program.md:2` | W14 PEP 768; W14 pdb |
| 14.08 | 3.14 | Tail-call interpreter (build option) | new | **COVERED** | `phase-0-runtime/01-what-python-is/06-runtime-optimisation.md:86` | W14 A new type of interpreter |
| 14.09 | 3.14 | Free-threaded build officially supported, phase II (PEP 779); ~5–10 % single-thread penalty | new | **COVERED** | `phase-0-runtime/02-the-gil/06-free-threading.md:21,153`; `04-installing-and-versions/12-free-threaded-builds.md` | W14 Free-threaded mode improvements; PEP 779 |
| 14.10 | 3.14 | Experimental JIT in official Windows/macOS binaries (`PYTHON_JIT=1`) | new | **COVERED** | `01-what-python-is/06-runtime-optimisation.md:118-127,190` | W14 Binary releases for the experimental JIT |
| 14.11 | 3.14 | Multiple interpreters in the stdlib: `concurrent.interpreters`, `InterpreterPoolExecutor` (PEP 734) | new | **PLANNED** | framed in `phase-0-runtime/10-python-vs-node/03-python-model.md:156,235`; S3:62 | W14 PEP 734; W14 concurrent.futures |
| 14.12 | 3.14 | Error messages: keyword typos ("Did you mean 'while'?"), `elif` after `else`, incompatible string prefixes, `as` targets | new | **COVERED** | `01-syntax-and-indentation/01g-syntax-errors-and-messages.md:86-96,182` | W14 Improved error messages |
| 14.13 | 3.14 | "cannot use 'dict' as a set element (unhashable type…)" / "…as a dict key" messages | new | **COVERED** | `phase-3-collections/04-set-and-frozenset/01b-what-the-table-costs-you.md:65,139`; `02-the-membership-test-in-a-loop.md:114` | W14 Improved error messages |
| 14.14 | 3.14 | REPL syntax highlighting and `import` auto-completion | new | **COVERED** | `phase-0-runtime/06-running-code/06-the-repl.md:127` ("What 3.14 added on top") | W14 Default interactive shell |
| 14.15 | 3.14 | Concurrent-safe warnings: `-X context_aware_warnings`, `thread_inherit_context` | new | **COVERED** | `11-exceptions/11b-warnings.md:111,157` | W14 Concurrent safe warnings control |
| 14.16 | 3.14 | `multiprocessing` / `ProcessPoolExecutor` default start method `forkserver` on Linux (not macOS/Windows) | default | **COVERED** | `phase-0-runtime/09-name-main/04-multiprocessing-and-the-guard.md:25-34`; `10-python-vs-node/03-python-model.md:131` | W14 multiprocessing; W14 Porting |
| 14.17 | 3.14 | `int()` no longer falls back to `__trunc__` | removed | **COVERED** | `02-numbers/12-conversions-and-precision-loss.md:61,84` | W14 Built-ins |
| 14.18 | 3.14 | `NotImplemented` in a boolean context raises `TypeError` | removed | **COVERED** | `05-truthiness/01c-what-if-x-costs.md:118` | W14 Built-ins |
| 14.19 | 3.14 | `float.from_number()`, `complex.from_number()`, `Decimal.from_number()`, `Fraction.from_number()` | new | **COVERED** | `02-numbers/12-conversions-and-precision-loss.md:138`; `10h-decimal-and-the-other-numeric-types.md:101,164`; `11b-inspecting-and-constructing.md:61` | W14 Built-ins; decimal; fractions |
| 14.20 | 3.14 | `decimal.IEEEContext()` | new | **COVERED** | `02-numbers/10b-contexts-precision-and-signals.md:217-221` | W14 decimal |
| 14.21 | 3.14 | Mixed real/complex arithmetic per C99; `complex(complex, complex)` deprecated | default/deprecated | **COVERED** | `02-numbers/13-complex-and-the-numeric-tower.md:68,108` | W14 Other language changes; New deprecations |
| 14.22 | 3.14 | Grouping (`,` / `_`) allowed in the fractional part of float format specs | new | **PARTIAL** | `03-strings/03c-the-format-spec-mini-language.md:28-37` gives the pre-3.14 grammar (`precision: "." digit+`, no `precision_with_grouping`); 3.14 `string` docs: "Support the grouping option for the fractional part" | W14 Built-ins; docs.python.org/3.14/library/string.html |
| 14.23 | 3.14 | `map(…, strict=True)` | new | **PLANNED** | named in the in-progress topic's target line only, `phase-3-collections/09-iteration-idioms/README.md:10`; S2:30 | W14 Built-ins |
| 14.24 | 3.14 | `super` objects copyable and picklable | new | **COVERED** | `phase-3-collections/08-copy-and-deepcopy/01b-atomic-types-and-identity.md:29` | W14 Built-ins |
| 14.25 | 3.14 | `-X importtime=2` marks already-loaded modules `cached` | new | **COVERED** | `phase-0-runtime/06-running-code/05-options-worth-knowing.md:14,81` | W14 Command line and environment |
| 14.26 | 3.14 | `python -c` dedents its argument | new | **MISSING** | `phase-0-runtime/06-running-code/04-c-and-stdin.md` silent; grep `-c .*indent`, `dedent` (only `textwrap.dedent`) → 0 | W14 Command line and environment |
| 14.27 | 3.14 | Incremental GC in 3.14.0–3.14.4, **reverted to generational in 3.14.5**; `gc.collect(1)` semantics changed then restored | default | **PARTIAL** | `phase-0-runtime/01-what-python-is/05-the-interpreter-loop.md:124-127` describes the generational collector — correct for 3.14.7 — but never mentions the 3.14.0–3.14.4 episode a pinned older 3.14 image still has (grep `incremental`, `young and old` → 0) | W14 Garbage collection; W15 gc |
| 14.28 | 3.14 | `functools.partial` is a **method descriptor** (3.13 warned with `FutureWarning`) | default | **CONTRADICTED** | `phase-2-functions/06-functools/01-partial-and-freezing-callables.md:101,154`: "partial is NOT a descriptor; self will not be passed!" — on 3.14 `self` *is* passed (after the partial's own args); W14 Porting: "functools.partial is now a method descriptor" | W14 Porting; W13 Porting |
| 14.29 | 3.14 | `functools.Placeholder` for positional slots in `partial`; `reduce(initial=)` keyword | new | **MISSING** | grep `Placeholder` in `phase-2-functions/06-functools/` → 0 (24 files hit, all SQL placeholders); `reduce\(.*initial=` → 0 | W14 functools |
| 14.30 | 3.14 | `heapq` max-heap API: `heapify_max`, `heappush_max`, `heappop_max`, … | new | **COVERED** | `phase-3-collections/07-heapq-and-bisect/04-max-heaps.md:13` | W14 heapq |
| 14.31 | 3.14 | `python -m json` preferred; `python -m json.tool` soft-deprecated; serialisation errors carry notes | new/deprecated | **CONTRADICTED** | `phase-0-runtime/06-running-code/03-m-packages-and-main-py.md:79` teaches `python -m json.tool` as the pretty-printer (§2c S5) | W14 json |
| 14.32 | 3.14 | `pathlib.Path.copy()`, `copy_into()`, `move()`, `move_into()`; `Path.info` | new | **PLANNED** | grep `Path\.copy\|\.copy_into\|\.move\(\|move_into` → 0; S3:106 | W14 pathlib |
| 14.33 | 3.14 | `pickle` default protocol 5; failures normalised to `PicklingError` | default | **PARTIAL** | protocol 5 noted in passing, `phase-3-collections/08-copy-and-deepcopy/04-the-reduce-protocol.md:196`; `PicklingError` change absent; S3:117 owns pickle | W14 pickle; W14 Porting |
| 14.34 | 3.14 | `uuid.uuid7()` (time-ordered, RFC 9562), `uuid6`/`uuid8`, `NIL`/`MAX` | new | **MISSING** | grep `uuid7` → 0; only `uuid4` in examples (`phase-3-collections/03-dict/11-dicts-and-json.md:64`); no syllabus row for ids/keys | W14 uuid |
| 14.35 | 3.14 | `typing.Union` and `types.UnionType` are one type: `repr` "int \| str", no caching, `isinstance(x, Union)` | default | **PLANNED** | grep `UnionType` → 0; S2:105 | W14 typing |
| 14.36 | 3.14 | asyncio: `get_event_loop()` raises `RuntimeError` when no loop; policy system deprecated (removal 3.16); `create_task(**kwargs)`; child watchers removed | removed/deprecated | **PLANNED** | grep `get_event_loop` → 0; S3:54 | W14 Removed (asyncio); New deprecations |
| 14.37 | 3.14 | asyncio introspection: `python -m asyncio ps` / `pstree`, `capture_call_graph()` | new | **PLANNED** | grep `asyncio ps\|pstree\|capture_call_graph` → 0; S3:58 (common asyncio bugs) | W14 Asyncio introspection capabilities |
| 14.38 | 3.14 | `concurrent.futures`: `Executor.map(buffersize=)`, `ProcessPoolExecutor.terminate_workers()`/`kill_workers()` | new | **PLANNED** | S3:52 | W14 concurrent.futures |
| 14.39 | 3.14 | Zstandard: new `compression` package, `compression.zstd` (PEP 784) | new | **PARTIAL** | one sentence, `phase-0-runtime/10-python-vs-node/05-ecosystems.md:74-75`; grep `compression\.zstd` → 0 | W14 PEP 784 |
| 14.40 | 3.14 | `datetime.date.strptime()` / `time.strptime()` | new | **PLANNED** | S3:109 | W14 datetime |
| 14.41 | 3.14 | `argparse` `suggest_on_error=`, coloured help | new | **PLANNED** | S4:56 | W14 argparse |
| 14.42 | 3.14 | `operator.is_none()` / `is_not_none()` | new | **MISSING** | grep `is_none` → 0 (`operator.is_` only, `06-comparisons/01b-consistency-and-dispatch.md:78`) | W14 operator |
| 14.43 | 3.14 | `os.reload_environ()` | new | **PLANNED** | grep → 0; S3:31 (config from environment) | W14 os |
| 14.44 | 3.14 | `re`: `\z` synonym for `\Z`; `\B` matches the empty string | new/default | **MISSING** | grep `\\z` → only `\Z` in patterns (`02-numbers/10k-json-and-the-wire-format.md:160`); no `re` topic | W14 re |
| 14.45 | 3.14 | `logging.handlers.QueueListener` is a context manager | new | **PLANNED** | S4:49 | W14 logging.handlers |
| 14.46 | 3.14 | `codecs.open()` deprecated → `open()` | deprecated | **PLANNED** | no page uses `codecs.open` (grep → 0 — right); S3:107 | W14 New deprecations |
| 14.47 | 3.14 | `os.popen()` / `os.spawn*` soft-deprecated → `subprocess` | deprecated | **PLANNED** | no page uses them (grep `os\.popen` → 0); S3:116 | W14 New deprecations |
| 14.48 | 3.14 | `sys._is_immortal()` | new | **COVERED** | `06-comparisons/04c-the-syntaxwarning-and-lifetimes.md:161` (as a debugging-only probe) | W14 sys |
| 14.49 | 3.14 | PGP signatures discontinued for CPython releases — verify with Sigstore (PEP 761) | security | **MISSING** | grep `PGP\|gpg`, `[Ss]igstore` → 0; `phase-0-runtime/04-installing-and-versions/` never covers verifying a download | W14 Summary (PEP 761); W14 Discontinuation of PGP signatures |

*§3 continues in [python-03.md](python-03.md) (3.15 and the tools).*
