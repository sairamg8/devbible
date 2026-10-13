---
title: "Link map · Python · Part 1 (phases 0–1)"
sidebar_label: "01 · runtime and language core"
sidebar_position: 1
---

# Link map · Python · Part 1 (phases 0–1)

Covers every topic row of `docs/python/syllabus/01-foundations.md` in phase 0 (T00-01 to T00-12, the runtime) and phase 1 (T01-01 to T01-16, the language core). That is 28 rows, and all 28 have a written page of ours.
*read* = the passage that supports the pick was read and the claim matches; *headings only* = the page was fetched and returned 200 and its headings checked, but the supporting passage was not read, so treat it as a strong lead. Third-party links carry a date only where the page shows one (visible text or page metadata). No `#anchors` are given. Where a Beyond-the-docs line is missing, the researcher's searches turned up nothing verifiable and the topic is ours to own; the second-pass verifier's own extra searches could not run (the search budget was used up), so the topics without that line have had only the first pass's searches.

Second pass (2026-10-13): all 60 distinct URLs were re-fetched and return 200 at the canonical address (two Ned Batchelder links redirected from `.html` and now use the canonical form); each third-party pick was checked against its text, and the docs.python.org and PEP picks marked *read* had their supporting passage read.

🔴 **Version note.** Our syllabus targets **Python 3.14** (`docs/python/README.md`). The `docs.python.org/3/` URLs below follow whatever "current" the site serves on 2026-10-13, so a library page may describe a newer release than 3.14. The devguide versions page on that date lists 3.13 in the security phase (end of life October 2029), 3.14 in the bugfix phase (October 2030) and 3.15 in the bugfix phase (first release dated 2026-10-09, end of life October 2031), and `docs.python.org/3/` serves 3.15.0 pages, so the picks below were read on 3.15 docs. Picks written for older versions are flagged in the block: Ned Batchelder's names, Unicode and iteration pieces date from 2012–2014, and the Python Morsels and Trey Hunner articles from 2016–2022; the concepts hold, the version details may not.

---

## Phase 0 — The runtime

### T00-01 · What Python is: CPython, bytecode, the interpreter loop — Master · ✅ written `docs/python/pages/phase-0-runtime/01-what-python-is/01-language-vs-implementation.md`
- **Read this:** [Glossary](https://docs.python.org/3/glossary.html) · docs.python.org · short entries for bytecode ("compiled into bytecode, the internal representation of a Python program in the CPython interpreter") and CPython ("the canonical implementation"), the vocabulary this topic needs (*read*) · covers our angle: **partial** — a glossary, not a walk from source to loop · fetched 2026-10-13
- **Also good:** [dis — Disassembler for Python bytecode](https://docs.python.org/3/library/dis.html) · docs.python.org · states that bytecode is a CPython implementation detail that can be added, removed or changed between versions (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Python behind the scenes #1: how the CPython VM works](https://tenthousandmeters.com/blog/python-behind-the-scenes-1-how-the-cpython-vm-works/) · Victor Skvortsov, 2020-08-31 · source to AST to bytecode, then the giant evaluation loop that runs the instructions; it does not mention `.pyc` files, and it is written for an older release (its disassembly shows `BINARY_ADD`, an opcode newer releases no longer use) · fetched 2026-10-13 (*read*)
- **Our delta:** the language versus its reference implementation, and `__pycache__` as a cache rather than a build product.

### T00-02 · The GIL and free-threaded CPython — Master · ✅ written `docs/python/pages/phase-0-runtime/02-the-gil/01-what-the-gil-is.md`
- **Read this:** [Python support for free threading](https://docs.python.org/3/howto/free-threading-python.html) · docs.python.org · the how-to for the free-threaded build and what changes for Python code (*headings only*) · covers our angle: **partial** — says little about why threaded I/O still works with the GIL · fetched 2026-10-13
- **Also good:** [PEP 779 — Criteria for supported status for free-threaded Python](https://peps.python.org/pep-0779/) · peps.python.org · the criteria behind the move from experimental (phase I, 3.13) to officially supported but optional (phase II, 3.14) (*read*) · fetched 2026-10-13
- **Beyond the docs:** [What is the GIL?](https://pydevtools.com/handbook/explanation/what-is-the-gil/) · Tim Hopper, Python Developer Tooling Handbook, page says last updated 2026-09-10 · blocking I/O releases the GIL so I/O-bound threads help; the default build still has the GIL on every supported version; the free-threaded build is opt-in, for example `python3.14t` · fetched 2026-10-13 (*read*)
- **Our delta:** the gate question: why 100 HTTP calls speed up and 100 checksums do not, and what the free-threaded build changes about that.

### T00-03 · The release model — Understand · ✅ written `docs/python/pages/phase-0-runtime/03-release-model/01-the-annual-cadence.md`
- **Read this:** [Status of Python versions](https://devguide.python.org/versions/) · Python Developer's Guide · table of supported versions with phase and end-of-life dates: 3.13 security (October 2029), 3.14 bugfix (October 2030), 3.15 bugfix (October 2031); the page says dates may be adjusted (*read*) · covers our angle: **partial** — a table, not guidance on reading "added in 3.12" against a deploy target · fetched 2026-10-13
- **Also good:** [PEP 602 — Annual Release Cycle for Python](https://peps.python.org/pep-0602/) · peps.python.org · the original decision and rationale; its support window has since been amended (the PEP text says two years of full support and three of security fixes; the devguide gives the current terms), so check the current text before quoting it · [PEP 745 — Python 3.14 Release Schedule](https://peps.python.org/pep-0745/) · peps.python.org · the 3.14 dates (PEP 602 *read*, PEP 745 *headings only*) · fetched 2026-10-13
- **Our delta:** reading a "versionadded" note against your own deploy target.

### T00-04 · Installing and managing versions — Understand · ✅ written `docs/python/pages/phase-0-runtime/04-installing-and-versions/01-never-the-system-python.md`
- **Read this:** [Installing Python — uv](https://docs.astral.sh/uv/guides/install-python/) · Astral docs · installing interpreters with `uv python install`, requesting a version, and the fact that uv downloads one on demand if none is requested (*read*) · covers our angle: **partial** — the how, not the "never touch the system Python" rule · fetched 2026-10-13
- **Also good:** [How do pyenv and uv compare for Python interpreter management?](https://pydevtools.com/handbook/explanation/how-do-pyenv-and-uv-compare-for-python-interpreter-management/) · Tim Hopper, page says last updated 2026-09-07 · pyenv compiles from source and uses shims, uv downloads prebuilt builds and you run through `uv run` or an activated environment (*read*) · fetched 2026-10-13
- **Beyond the docs:** [“Externally managed environments”: when PEP 668 breaks pip](https://pythonspeed.com/articles/externally-managed-environment-pep-668/) · Itamar Turner-Trauring, last updated 2025-01-22 (created 2023-05-05) · a root `pip install --upgrade pyyaml` replaced the version the OS update manager expected; the case for virtualenvs and not touching the distribution's Python · fetched 2026-10-13 (*read*)
- **Our delta:** the iron rule stated flat, with the broken-package-manager story.

### T00-05 · Virtual environments — Master · ✅ written `docs/python/pages/phase-0-runtime/05-virtual-environments/01-what-a-venv-is-on-disk.md`
- **Read this:** [venv — Creation of virtual environments](https://docs.python.org/3/library/venv.html) · docs.python.org · how a venv is created and the `pyvenv.cfg` file it places in the environment, with a `home` key (*read*) · covers our angle: **partial** — reference, not the "a venv is a config file and a path" framing · fetched 2026-10-13
- **Also good:** [Virtual Environments and Packages](https://docs.python.org/3/tutorial/venv.html) · docs.python.org · the tutorial chapter, with creating and activating (*read*) · fetched 2026-10-13
- **Beyond the docs:** [How virtual environments work](https://snarky.ca/how-virtual-environments-work/) · Brett Cannon, 2023-03-12 · the directory layout, symlinked interpreter, the `pyvenv.cfg` entries, how `site` reads it at startup, and that activation only adjusts `PATH`, `VIRTUAL_ENV` and the prompt · fetched 2026-10-13 (*read*)
- **Our delta:** activation versus `uv run`, and why every project gets its own.

### T00-06 · Running code: `-m`, the REPL, `-c`, shebangs — Understand · ✅ written `docs/python/pages/phase-0-runtime/06-running-code/01-the-launch-modes.md`
- **Read this:** [Command line and environment](https://docs.python.org/3/using/cmdline.html) · docs.python.org · the full option list including `-m` and `-c` (*read*) · covers our angle: **partial** — no worked "module not found" example · fetched 2026-10-13
- **Beyond the docs:** [How not to run a script in Python](https://rednafi.com/python/how-not-to-run-a-script/) · Redowan Delowar, 2022-03-16 · `python src/sub/b.py` puts that file's directory first on `sys.path`, so `from src import a` fails; `python -m src.sub.b` from the project root makes the root the first entry · fetched 2026-10-13 (*read*)
- **Our delta:** the 3.13 REPL rewrite and shebang handling, which that article does not cover.

### T00-07 · Everything is an object — Master · ✅ written `docs/python/pages/phase-0-runtime/07-everything-is-an-object/01-names-and-objects.md`
- **Read this:** [Data model](https://docs.python.org/3/reference/datamodel.html) · docs.python.org · objects, identity, type and value; "The `is` operator compares the identity of two objects" (*read*) · covers our angle: **partial** — precise but dense, with no small-int caching story · fetched 2026-10-13
- **Beyond the docs:** [Facts and myths about Python names and values](https://nedbatchelder.com/text/names) · Ned Batchelder, created 2013-07-06, updated 2014-01-26 · names refer to values, "assignment never copies data", and mutable values change through any of their names; written before 3.14 but the model has not changed · fetched 2026-10-13 (*read*)
- **Our delta:** `is` versus `==` and small-int caching as an implementation detail.

### T00-08 · Imports — Master · ✅ written `docs/python/pages/phase-0-runtime/08-imports/01-modules-and-the-cache.md`
- **Read this:** [The import system](https://docs.python.org/3/reference/import.html) · docs.python.org · finders, `sys.path`, packages and relative imports, in full (*headings only*) · covers our angle: **partial** — complete but long, and it does not mention the `random.py` self-shadowing bug · fetched 2026-10-13
- **Also good:** [Modules](https://docs.python.org/3/tutorial/modules.html) · docs.python.org · the tutorial chapter: the search path and packages; its module-search-path section says the directory of the input script is searched first, so a local file shadows a library module of the same name (*read*) · [What's New In Python 3.13](https://docs.python.org/3/whatsnew/3.13.html) · docs.python.org · from 3.13 the error for a local `random.py` says `consider renaming '/home/me/random.py' since it has the same name as the standard library module named 'random'`, the exact bug in this row (*read*) · fetched 2026-10-13
- **Our delta:** the self-shadowing bug as a story, and what 3.12 and older show instead of that hint. The first pass searched twice; the third-party pages that came up were forum answers and none was verifiable as better than the tutorial.

### T00-09 · `if __name__ == "__main__"` — Understand · ✅ written `docs/python/pages/phase-0-runtime/09-name-main/01-what-name-is.md`
- **Read this:** [`__main__` — Top-level code environment](https://docs.python.org/3/library/__main__.html) · docs.python.org · what `__name__` is in a script versus an import, and the `if __name__ == '__main__'` idiom (*read*) · covers our angle: **partial** — nothing on why multiprocessing needs the guard · fetched 2026-10-13
- **Also good:** [multiprocessing](https://docs.python.org/3/library/multiprocessing.html) · docs.python.org · the programming guidelines, which show the `if __name__ == '__main__'` clause needed for the spawn start method (*read*) · fetched 2026-10-13
- **Our delta:** the Windows and macOS spawn failure, which is the real reason the guard matters.

### T00-10 · Python vs Node for a backend — Know · ✅ written `docs/python/pages/phase-0-runtime/10-python-vs-node/01-the-real-question.md`
- **Read this:** [Alternative Python implementations](https://www.python.org/download/alternatives/) · python.org · lists PyPy, GraalPy, Jython and others, the recognition-level part of this row (*read*) · covers our angle: **partial** — nothing on the Node comparison · fetched 2026-10-13
- **Our delta:** the whole Node comparison. Two searches returned mostly agency and vendor blogs; one lacked any methodology for its benchmark figures and several ignored the free-threaded build, so I left no pick.

### T00-11 · Startup and import cost — Know · ✅ written `docs/python/pages/phase-0-runtime/11-startup-and-import-cost/01-where-the-time-goes.md`
- **Read this:** [PEP 810 — Explicit lazy imports](https://peps.python.org/pep-0810/) · peps.python.org · the `lazy` keyword for Python 3.15; `lazy import` inside a function, class or try block is a SyntaxError (*read*) · covers our angle: **partial** — a proposal text, not a "why CLIs feel slow" walk-through · fetched 2026-10-13
- **Also good:** [What is PEP 810?](https://pydevtools.com/handbook/explanation/what-is-pep-810/) · pydevtools handbook · short explainer: accepted by the Steering Council on 3 November 2025 for 3.15 (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Python lazy imports](https://www.danilchenko.dev/posts/python-lazy-imports/) · Maksim Danilchenko, 2026-07-24 · measures with `python -X importtime`, then a 3.12 CLI importing boto3 goes from 394 ms to 48 ms with the import deferred (one machine, best of 15 runs); `lazy import` is top-level only, and the pre-3.15 workarounds are listed · fetched 2026-10-13 (*read*)
- **Our delta:** 3.15 is not the syllabus target (3.14), so the `lazy` keyword is a 3.15-only feature: the devguide shows 3.15 first released 2026-10-09, but code written for the 3.14 target cannot use it.

### T00-12 · Bytecode inspection with `dis` — When Needed · ✅ written `docs/python/pages/phase-0-runtime/12-dis-bytecode/01-reading-a-disassembly.md`
- **Read this:** [dis — Disassembler for Python bytecode](https://docs.python.org/3/library/dis.html) · docs.python.org · output format, `python -m dis`, and the warning that bytecode changes between versions (*read*) · covers our angle: **partial** — an instruction reference, not a guide to reading one function's output · fetched 2026-10-13
- **Beyond the docs:** [Python behind the scenes #1: how the CPython VM works](https://tenthousandmeters.com/blog/python-behind-the-scenes-1-how-the-cpython-vm-works/) · Victor Skvortsov, 2020-08-31 · takes one small function, shows its bytes and the standard `dis` output, and explains what `LOAD_FAST`, `LOAD_CONST` and `RETURN_VALUE` do on the stack; its opcodes (`BINARY_ADD`) are from an older release, so the instruction names differ on 3.14 · fetched 2026-10-13 (*read*)
- **Our delta:** reading a small function's disassembly on 3.14. The first pass's searches returned only the official page in many language mirrors, and the Real Python reference page returned 403 to the fetch, so it is unverified.

---

## Phase 1 — Language core

### T01-01 · Syntax: indentation, statements and expressions, line continuation — Understand · ✅ written `docs/python/pages/phase-1-language-core/01-syntax-and-indentation/01b-tabs-spaces-and-taberror.md`
- **Read this:** [Lexical analysis](https://docs.python.org/3/reference/lexical_analysis.html) · docs.python.org · the line structure, indentation (tabs replaced by one to eight spaces) and explicit and implicit line joining (*read*) · covers our angle: **partial** — the rules are there, the mixed-tabs failure is not shown · fetched 2026-10-13
- **Our delta:** the mixed-tabs file that will not parse. Two searches gave SEO error-fix pages and mirrors of old language references, so I left no pick.

### T01-02 · Numbers: int, float, Decimal, floor semantics — Master · ✅ written `docs/python/pages/phase-1-language-core/02-numbers/01-int-never-overflows.md`
- **Read this:** [Floating-Point Arithmetic: Issues and Limitations](https://docs.python.org/3/tutorial/floatingpoint.html) · docs.python.org · why decimal fractions are only approximated by binary floating point (*read*) · covers our angle: **partial** — float only, nothing on `//` or `%` · fetched 2026-10-13
- **Also good:** [decimal](https://docs.python.org/3/library/decimal.html) · docs.python.org · the module reference: decimal numbers are represented exactly, unlike 1.1 and 2.2 in binary (*read*) · [High-precision calculations with Decimal](https://testdriven.io/tips/c93b6e81-8db7-4f59-b092-c466e8353769/) · testdriven.io tip, first posted on Twitter 2021-09-26 · a price field as float gives `0.30000000000000004`, as `Decimal` built from strings gives `Decimal('0.3')` (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Why Python's Integer Division Floors](https://python-history.blogspot.com/2010/08/why-pythons-integer-division-floors.html) · Guido van Rossum, 2010-08-24 · flooring keeps `b*q + r = a` with `0 <= r < b` for negative `a`; the `t % 86400` time-of-day example; truncation in C comes from older hardware · fetched 2026-10-13 (*read*)
- **Our delta:** all four sub-points in one page: no overflow, IEEE-754 float, `Decimal` for money, and `-7 // 2 == -4`.

### T01-03 · Strings and f-strings — Master · ✅ written `docs/python/pages/phase-1-language-core/03-strings/01-immutability-and-identity.md`
- **Read this:** [string — Common string operations](https://docs.python.org/3/library/string.html) · docs.python.org · holds the format specification mini-language that f-strings use (*headings only*) · covers our angle: **partial** — the spec grammar only, not immutability or the method vocabulary · fetched 2026-10-13
- **Beyond the docs:** [Python f-strings Are More Powerful Than You Might Think](https://dev.to/martinheinz/python-f-strings-are-more-powerful-than-you-might-think-2oop) · Martin Heinz, DEV Community, 2022-04-04 · worked format-spec examples (centring, leading zeros) and the `=` debugging specifier from 3.8 · fetched 2026-10-13 (*read*)
- **Our delta:** immutability and the split, join, strip vocabulary as a set of habits, which that article does not cover.

### T01-04 · `bytes` vs `str` and encoding — Understand · ✅ written `docs/python/pages/phase-1-language-core/04-bytes-and-encoding/01-two-types-that-never-mix.md`
- **Read this:** [Unicode HOWTO](https://docs.python.org/3/howto/unicode.html) · docs.python.org · text versus bytes, encodings and errors (*headings only*) · covers our angle: **partial** — full background, no worked `latin-1` into JSON failure · fetched 2026-10-13
- **Beyond the docs:** [Pragmatic Unicode, or, How do I stop the pain?](https://nedbatchelder.com/text/unipain) · Ned Batchelder, created 2012-03-10, PyCon 2012 · the Unicode sandwich: bytes on the outside, Unicode on the inside, decode early and encode late; in Python 3 mixing the two fails immediately · fetched 2026-10-13 (*read*) — the talk is from 2012, so its Python 2 sections are historical
- **Our delta:** the real-world `UnicodeDecodeError` and the `"café".encode("latin-1")` gate question.

### T01-05 · Truthiness — Master · ✅ written `docs/python/pages/phase-1-language-core/05-truthiness/01-what-falsy-means.md`
- **Read this:** [Built-in Types — Truth Value Testing](https://docs.python.org/3/builtins/stdtypes.html) · docs.python.org · the list of values that count as false (*read*) · covers our angle: **partial** — nothing on the "no results yet" bug or on `and`/`or` returning operands · fetched 2026-10-13
- **Beyond the docs:** [Truthy, falsy and bool](https://mathspp.com/blog/pydonts/truthy-falsy-and-bool) · Rodrigo Girão Serrão (mathspp; named in the page metadata and linked from the page), 2021-02-09 · lookup order is `__bool__`, then `len()`; empty containers, `0`, `None` and `""` are falsy; do not test for `None` by truthiness · fetched 2026-10-13 (*read*) — it does not explain `and`/`or` returning operands
- **Our delta:** the "no results yet" versus "empty results" bug, operand-returning `and`/`or`, and the walrus.

### T01-06 · Comparisons — Understand · ✅ written `docs/python/pages/phase-1-language-core/06-comparisons/01-the-six-operators.md`
- **Read this:** [Expressions — Comparisons](https://docs.python.org/3/reference/expressions.html) · docs.python.org · `x < y <= z` is equivalent to `x < y and y <= z`, except that `y` is evaluated only once (*read*) · covers our angle: **partial** — `is None` and cross-type rich comparison are elsewhere · fetched 2026-10-13
- **Beyond the docs:** [Python Internals — Exploring Chained Comparison Operators](https://arpitbhayani.me/blogs/chained-operators-python/) · Arpit Bhayani, page metadata 2021-04-28 · `a < b < c` is `(a < b) and (b < c)` with the middle operand evaluated once; the `dis` output shows how the jump gives the short-circuit; the bytecode shown is from an older release (`DUP_TOP`, `ROT_THREE`) · fetched 2026-10-13 (*read*)
- **Our delta:** `is` for `None` only, and what happens when two types decline to compare.

### T01-07 · Assignment and aliasing — Master · ✅ written `docs/python/pages/phase-1-language-core/07-assignment-and-aliasing/01-what-assignment-does.md`
- **Read this:** [Programming FAQ](https://docs.python.org/3/faq/programming.html) · docs.python.org · "arguments are passed by assignment" and why changing list y also changes x (*read*) · covers our angle: **partial** — `copy.copy()` and `copy.deepcopy()` get one line, with no decision guide · fetched 2026-10-13
- **Also good:** [copy — Shallow and deep copy operations](https://docs.python.org/3/library/copy.html) · docs.python.org · the reference for both (*headings only*) · fetched 2026-10-13
- **Beyond the docs:** [Facts and myths about Python names and values](https://nedbatchelder.com/text/names) · Ned Batchelder, created 2013-07-06, updated 2014-01-26 · "Python passes function arguments by assigning to them": mutating an argument shows in the caller, rebinding the parameter does not · fetched 2026-10-13 (*read*)
- **Our delta:** when you need `copy` versus `deepcopy`, which that essay does not cover.

### T01-08 · Control flow, `for`/`else`, looping idioms — Understand · ✅ written `docs/python/pages/phase-1-language-core/08-control-flow/01-the-for-statement.md`
- **Read this:** [More Control Flow Tools](https://docs.python.org/3/tutorial/controlflow.html) · docs.python.org · `for`, `range`, `break`/`continue` and the `else` clause on loops (*read*) · covers our angle: **partial** — little on `enumerate` and `zip` as replacements for index arithmetic · fetched 2026-10-13
- **Also good:** [How to loop with indexes in Python](https://treyhunner.com/2016/04/how-to-loop-with-indexes-in-python/) · Trey Hunner, 2016-04-25 · starts from the C-style `for` loop, shows `range(len(...))` and then why `enumerate` (with `start=`) is the idiomatic replacement (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Loop Like A Native](https://nedbatchelder.com/text/iter) · Ned Batchelder, created 2012-04-24, last updated 2013-03-19, PyCon 2013 · starts from a counter-and-`while` loop and replaces it with direct iteration, `enumerate` for numbering and `zip` for walking two lists together, so the index arithmetic disappears; it does not cover loop `else` · fetched 2026-10-13 (*read*)
- **Our delta:** the widely-misread `else`, read as "no break". The first pass's pick here (a Python Morsels hub page) was an index of lessons and was dropped; the earlier claim that Ned Batchelder's text does not cover `enumerate` or `zip` was wrong.

### T01-09 · Comprehensions — Master · ✅ written `docs/python/pages/phase-1-language-core/09-comprehensions/01-the-four-forms.md`
- **Read this:** [Data Structures — List Comprehensions](https://docs.python.org/3/tutorial/datastructures.html) · docs.python.org · list comprehensions and nested list comprehensions (*read*) · covers our angle: **partial** — no stated line for when to switch to a loop · fetched 2026-10-13
- **Beyond the docs:** [Abusing and overusing list comprehensions in Python](https://treyhunner.com/2019/03/abusing-and-overusing-list-comprehensions-in-python/) · Trey Hunner, 2019-03-26 · complex logic, side-effect-only comprehensions such as `[print(n) for n in range(1, 11)]`, and problems that do not fit are loops; it has no dedicated rule for nested comprehensions · fetched 2026-10-13 (*read*)
- **Our delta:** the honest line where a nested comprehension should have been a loop.

### T01-10 · `match` — structural pattern matching — Understand · ✅ written `docs/python/pages/phase-1-language-core/10-match-pattern-matching/01-what-match-is.md`
- **Read this:** [PEP 636 — Structural Pattern Matching: Tutorial](https://peps.python.org/pep-0636/) · peps.python.org · the tutorial form of the feature (*headings only*) · covers our angle: **partial** — no webhook-payload example · fetched 2026-10-13
- **Also good:** [PEP 634 — Specification](https://peps.python.org/pep-0634/) · peps.python.org · the formal rules (*headings only*) · fetched 2026-10-13
- **Beyond the docs:** [Structural pattern matching tutorial (Pydon't)](https://mathspp.com/blog/pydonts/structural-pattern-matching-tutorial) · Rodrigo Girão Serrão, 2021-03-09 · class patterns with `__match_args__`, guards, dict patterns that ignore extra keys, `**remainder`, and `*tail` on sequences; written for 3.10 · fetched 2026-10-13 (*read*)
- **Our delta:** parsing webhook payloads by shape.

### T01-11 · Exceptions, the working set — Master · ✅ written `docs/python/pages/phase-1-language-core/11-exceptions/01-the-four-clauses.md`
- **Read this:** [Errors and Exceptions](https://docs.python.org/3/tutorial/errors.html) · docs.python.org · `try`/`except`/`else`/`finally`, `raise ... from` and `ExceptionGroup` (*read*) · covers our angle: **partial** — nothing on the bare `except:` that eats `KeyboardInterrupt` as a story · fetched 2026-10-13
- **Also good:** [PEP 654 — Exception Groups and except star](https://peps.python.org/pep-0654/) · peps.python.org · the design for 3.11 groups (*headings only*) · fetched 2026-10-13
- **Beyond the docs:** [Python's try-except blocks](https://www.pythonmorsels.com/how-to-catch-an-exception-in-python/) · Trey Hunner, Python Morsels, 2022-01-11 · wrap only the line that raised, name the specific exception type, and handle it one level up the call stack when the raising function is the wrong place · fetched 2026-10-13 (*read*) — nothing on `else`, `finally` or chaining
- **Our delta:** `raise ... from`, and exception groups at recognition level.

### T01-12 · EAFP vs LBYL — Understand · ✅ written `docs/python/pages/phase-1-language-core/12-eafp-vs-lbyl/01-the-two-names.md`
- **Read this:** [Glossary — EAFP](https://docs.python.org/3/glossary.html) · docs.python.org · the one-paragraph definition of EAFP, with LBYL beside it (*read*) · covers our angle: **partial** — a definition, no design guidance · fetched 2026-10-13
- **Beyond the docs:** [Idiomatic Python: EAFP versus LBYL](https://devblogs.microsoft.com/python/idiomatic-python-eafp-versus-lbyl/) · Brett Cannon, 2016-06-29 · EAFP signals that a key is normally present; keep the `try` narrow and put follow-up work in `else`; LBYL is acceptable when it reads more clearly · fetched 2026-10-13 (*read*)
- **Our delta:** choosing between them per case, including the file-can-disappear race.

### T01-13 · Unpacking — Understand · ✅ written `docs/python/pages/phase-1-language-core/13-unpacking/01-tuple-assignment.md`
- **Read this:** [PEP 3132 — Extended Iterable Unpacking](https://peps.python.org/pep-3132/) · peps.python.org · the `first, *rest` rule and the `a, *b, c = seq` form (*read*) · covers our angle: **partial** — nothing on `*` and `**` in calls · fetched 2026-10-13
- **Beyond the docs:** [Asterisks in Python: what they are and how to use them](https://treyhunner.com/2018/10/asterisks-in-python-what-they-are-and-how-to-use-them/) · Trey Hunner, 2018-10-11 · `*` and `**` in calls, `first, *remaining = fruits`, and the literal forms from 3.5 · fetched 2026-10-13 (*read*) — it does not cover the swap idiom
- **Our delta:** swap without a temp.

### T01-14 · `None` and the "no result" contract — Understand · ✅ written `docs/python/pages/phase-1-language-core/14-none-and-no-result/01-what-none-is.md`
- **Read this:** [Built-in Constants](https://docs.python.org/3/builtins/constants.html) · docs.python.org · what `None` is (*read*) · covers our angle: **partial** — a definition, no return-value contract · fetched 2026-10-13
- **Our delta:** one contract per function: `None` versus empty versus raising. Three searches returned DataCamp translations, a Medium piece and a mailing-list reply; none I could verify as more careful than a one-line rule, so I left no pick.

### T01-15 · PEP 8 and idiom — Understand · ✅ written `docs/python/pages/phase-1-language-core/15-pep8-and-idiom/01-what-pep8-actually-says.md`
- **Read this:** [PEP 8 — Style Guide for Python Code](https://peps.python.org/pep-0008/) · peps.python.org · the style guide itself (*headings only*) · covers our angle: **partial** — no mention of which rules `ruff` enforces · fetched 2026-10-13
- **Beyond the docs:** [What is PEP 8?](https://pydevtools.com/handbook/explanation/what-is-pep-8/) · Tim Hopper, Python Developer Tooling Handbook, page says last updated 2026-09-07 · Ruff enforces PEP 8 through its pycodestyle rules; the naming conventions; a single leading underscore is internal by convention only · fetched 2026-10-13 (*read*)
- **Our delta:** the parts of "pythonic" that are real signal in code review.

### T01-16 · `del`, `pass`, `Ellipsis`, chained assignment — Know · ✅ written `docs/python/pages/phase-1-language-core/16-del-pass-ellipsis/01-del.md`
- **Read this:** [Simple statements](https://docs.python.org/3/reference/simple_stmts.html) · docs.python.org · the `del` and `pass` statements and assignment statements, where one value is assigned to each target list from left to right (*read*) · covers our angle: **partial** — `Ellipsis` is a built-in constant, documented on another page · fetched 2026-10-13
- **Beyond the docs:** [Python Ellipsis (triple dots): What is it, How to Use](https://python.land/python-ellipsis) · Python.Land, Erik van Baaren (per page metadata), 2022-01-01 · placeholder body, NumPy slicing, an end-of-queue marker, and the `[...]` shown for a self-referencing list · fetched 2026-10-13 (*read*)
- **Our delta:** chained-assignment corner cases, such as `i, x[i] = 1, 2`.
