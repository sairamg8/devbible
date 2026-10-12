---
title: "Link map · Python · Part 1"
sidebar_label: "01 · Foundations"
sidebar_position: 1
---

# Link map · Python · Part 1 (phases 0–2)

Covers every topic row of `docs/python/syllabus/01-foundations.md`: T00-01 to T00-12 (phase 0, the runtime), T01-01 to T01-16 (phase 1, language core), T02-01 to T02-10 (phase 2, functions). That is 38 rows, numbered in table order. Each is ✅ written: the folder named under the heading exists under `docs/python/pages/`.
*read* = I fetched the page and checked the passage the line claims; *headings only* = fetched, title and section outline checked, body not read through. Third-party links carry a date where the page shows one; none of the third-party pages here shows one.

🔴 **Version note (verified 2026-10-12).** Every docs.python.org/3/ page fetched here is titled "Python 3.15.0 documentation"; in 3.15 the `library/constants`, `library/stdtypes` and `library/exceptions` pages redirect to `/3/builtins/`, and the links below use the new paths. devguide.python.org/versions on 2026-10-12 lists **3.15 in bugfix since 2026-10-09** (PEP 790), 3.14 in bugfix to 2030-10, 3.13 in security. Our syllabus still says 3.14 current and 3.15 landing in Oct 2026, so that wording is now behind. `docs.python.org/3/` itself now serves 3.15.0, so every docs.python.org link below is the 3.15 text; the version-switcher in its corner reaches 3.14.
🔴 **Fetch caveat.** realpython.com answers our fetcher with a Cloudflare 403 on every URL tried, so it is never a "Read this" (it would otherwise be the natural pick for imports, decorators, comprehensions, f-strings, `if __name__`, LEGB). Several blocks say so under *Checked, not chosen*. pythonspeed.com/articles/python-vs-nodejs/ returns 404. Medium and aggregators were not used.
Official pages carry no preference here; where one wins it is because it was the clearest page that I could fetch.

---

## Phase 0 — The runtime

### T00-01 · What Python is: CPython, bytecode, the interpreter loop — Master · ✅ written `docs/python/pages/phase-0-runtime/01-what-python-is/`
- **Read this:** [Using the Python Interpreter](https://docs.python.org/3/tutorial/interpreter.html) · docs.python.org · short and correct on how the `python` command runs source, but it stops before bytecode (*read*) · covers our angle: **partial** — nothing on `.pyc` or the eval loop · fetched 2026-10-12
- **Also good:** [dis — Disassembler for Python bytecode](https://docs.python.org/3/library/dis.html) · docs.python.org · flags bytecode as a CPython implementation detail that can change between versions (*read*) · fetched 2026-10-12
- **Our delta:** source to bytecode to loop, `__pycache__` invalidation, and language vs implementation. No fetchable article covers this end to end.
- *Checked, not chosen:* Real Python's CPython source-code guide (not fetchable — unverified).

### T00-02 · The GIL and free-threaded CPython — Master · ✅ written `docs/python/pages/phase-0-runtime/02-the-gil/`
- **Read this:** [Python support for free threading](https://docs.python.org/3/howto/free-threading-python.html) · docs.python.org · how to build, detect and run the no-GIL interpreter and what changes for your code (*read*) · covers our angle: **partial** — free-threaded half only; does not teach why I/O releases the GIL · fetched 2026-10-12
- **Also good:** [Python Free-Threading Guide](https://py-free-threading.github.io/) · community guide (py-free-threading.github.io) · install, status, porting, and usage examples (Mandelbrot, Monte Carlo, web scraping with asyncio) (*headings only*) · fetched 2026-10-12
- **Also good:** [PEP 779 — Criteria for supported status for free-threaded Python](https://peps.python.org/pep-0779/) · peps.python.org · the criteria for phase II, where the free-threaded build becomes officially supported but still optional, with 3.14 as the target (*read*) · fetched 2026-10-12
- **Our delta:** the GIL basics (bytecode is serialised, I/O and C extensions release it) and the 100 HTTP calls vs 100 checksums gate. Real Python's GIL article was not fetchable.

### T00-03 · Release model — Understand · ✅ written `docs/python/pages/phase-0-runtime/03-release-model/`
- **Read this:** [Status of Python versions](https://devguide.python.org/versions/) · Python devguide · the live table of which release is in bugfix, security or end of life, with dates (*read*) · covers our angle: **partial** — dates, not the "added in 3.12" reading habit · fetched 2026-10-12
- **Also good:** [PEP 602 — Annual Release Cycle for Python](https://peps.python.org/pep-0602/) · peps.python.org · one feature release every twelve months in October, two years of bugfixes then three of security fixes (*read*) · fetched 2026-10-12
- **Our delta:** use the version number against your deploy target, and the pin is now 3.15 as current (see the version note).

### T00-04 · Installing and managing versions — Understand · ✅ written `docs/python/pages/phase-0-runtime/04-installing-and-versions/`
- **Read this:** [Installing and managing Python](https://docs.astral.sh/uv/guides/install-python/) · uv docs · `uv python install`, pinning, and where the builds come from (*read*) · covers our angle: **partial** — uv only; nothing on pyenv or the iron rule · fetched 2026-10-12
- **Also good:** [Externally Managed Environments](https://packaging.python.org/en/latest/specifications/externally-managed-environments/) · Python Packaging User Guide · the specification behind the "externally managed" pip error, and why system packages must be left alone (*read*) · fetched 2026-10-12
- **Our delta:** pyenv, and the `sudo pip` story. Real Python's pyenv primer was not fetchable.

### T00-05 · Virtual environments — Master · ✅ written `docs/python/pages/phase-0-runtime/05-virtual-environments/`
- **Read this:** [venv — Creation of virtual environments](https://docs.python.org/3/library/venv.html) · docs.python.org · says plainly that a venv is a directory with a `pyvenv.cfg` whose `home` key points at the base install and that activation only prepends the env's `bin` to PATH and is optional (*read*) · covers our angle: **partial** — nothing on uv or non-relocatability · fetched 2026-10-12
- **Also good:** [Running commands](https://docs.astral.sh/uv/concepts/projects/run/) · uv docs · `uv run` uses the project environment with no activation step (*read*) · fetched 2026-10-12
- **Our delta:** activation vs `uv run`, non-relocatability.
- *Checked, not chosen:* the tutorial's "Virtual Environments and Packages" chapter, which is a short usage walkthrough; Real Python's primer (not fetchable — unverified).

### T00-06 · Running code: `-m`, REPL, `-c`, shebangs — Understand · ✅ written `docs/python/pages/phase-0-runtime/06-running-code/`
- **Read this:** [Command line and environment](https://docs.python.org/3/using/cmdline.html) · docs.python.org · the authoritative list of `-c`, `-m` and script modes (*read*) · covers our angle: **partial** — a reference, no explanation of the `-m` import-path fix · fetched 2026-10-12
- **Also good:** [What's New In Python 3.13 — A better interactive interpreter](https://docs.python.org/3/whatsnew/3.13.html) · docs.python.org · the new REPL (multiline editing, colour) and its place in 3.13 (*read*) · fetched 2026-10-12
- **Our delta:** why `python -m pkg.mod` fixes "module not found", and shebangs.

### T00-07 · Everything is an object: names, `is` vs `==` — Master · ✅ written `docs/python/pages/phase-0-runtime/07-everything-is-an-object/`
- **Read this:** [Facts and myths about Python names and values](https://nedbatchelder.com/text/names) · Ned Batchelder, 6 July 2013, updated 26 January 2014 · names refer to values and many names can share one, which is why `a = b` copies nothing (*read*) · covers our angle: **partial** — no `id`, small-int caching or `is`/`==` detail · fetched 2026-10-12
- **Also good:** [Data model](https://docs.python.org/3/reference/datamodel.html) · docs.python.org · identity, type and value defined, with `is` and `id()` (*read*) · fetched 2026-10-12
- **Our delta:** interning, immortal objects, NaN comparison.
- *Checked, not chosen:* Real Python's `is` vs `==` article (not fetchable — unverified).

### T00-08 · Imports — Master · ✅ written `docs/python/pages/phase-0-runtime/08-imports/`
- **Read this:** [Modules](https://docs.python.org/3/tutorial/modules.html) · docs.python.org · module search path, `sys.path` and `__pycache__` in beginner-readable order (*read*) · covers our angle: **partial** — relative imports are covered briefly and stdlib shadowing gets one sentence; circular imports are not covered · fetched 2026-10-12
- **Also good:** [The import system](https://docs.python.org/3/reference/import.html) · docs.python.org · the reference for packages, namespace packages and finders (*headings only*) · fetched 2026-10-12
- **Also good:** [The initialization of the sys.path module search path](https://docs.python.org/3/library/sys_path_init.html) · docs.python.org · where each `sys.path` entry comes from, starting with the script's directory or the current directory for `-c`, `-m` and the REPL (*read*) · fetched 2026-10-12
- **Our delta:** the `random.py` self-shadowing bug and circular-import repair. Real Python's import article was not fetchable.

### T00-09 · `if __name__ == "__main__"` — Understand · ✅ written `docs/python/pages/phase-0-runtime/09-name-main/`
- **Read this:** [`__main__` — Top-level code environment](https://docs.python.org/3/library/__main__.html) · docs.python.org · defines the top-level environment and the idiomatic guard (*read*) · covers our angle: **partial** — multiprocessing is not mentioned there · fetched 2026-10-12
- **Also good:** [multiprocessing](https://docs.python.org/3/library/multiprocessing.html) · docs.python.org · the "Safe importing of main module" guideline shows an unguarded `Process` start failing with `RuntimeError` under spawn and forkserver (*read*) · fetched 2026-10-12
- **Our delta:** tying that failure to spawn being the default on Windows and macOS. Real Python's article was not fetchable.

### T00-10 · Python vs Node for a backend; PyPy and GraalPy — Know · ✅ written `docs/python/pages/phase-0-runtime/10-python-vs-node/`
- **Read this:** none found — tried: pythonspeed.com/articles/python-vs-nodejs (404), two searches for neutral comparisons (re-run 2026-10-12: only agency and vendor posts). This topic is ours to own.
- **Also good:** [PyPy](https://pypy.org/) · pypy.org · a JIT-based alternative, compatibility and speed claims in its own words (*read*) · covers: PyPy only · fetched 2026-10-12
- **Also good:** [GraalPy](https://graalpy.org/) · graalpy.org (Oracle) · an embeddable Python 3 runtime on the JVM with a Graal JIT, installable via pyenv (*read*) · covers: GraalPy only · fetched 2026-10-12
- *Checked, not chosen:* graalvm.org/python is a redirect stub to graalpy.org; graalvm.org/python/python-developers/docs returns 404.

### T00-11 · Startup and import cost; lazy imports — Know · ✅ written `docs/python/pages/phase-0-runtime/11-startup-and-import-cost/`
- **Read this:** [PEP 810 — Explicit lazy imports](https://peps.python.org/pep-0810/) · peps.python.org · motivation and semantics straight from the authors; the motivation names command-line tools and startup time (*read*) · covers our angle: **partial** — a spec, not a CLI-startup tutorial · fetched 2026-10-12
- **Also good:** [What's new in Python 3.15](https://docs.python.org/3/whatsnew/3.15.html) · docs.python.org · lists lazy imports as a 3.15 headline feature (*read*) · fetched 2026-10-12
- **Our delta:** 🔴 3.15 is already out, so "lands Oct 2026" should become "added in 3.15"; also `-X importtime` and measuring a CLI.

### T00-12 · Bytecode inspection with `dis` — When Needed · ✅ written `docs/python/pages/phase-0-runtime/12-dis-bytecode/`
- **Read this:** [dis — Disassembler for Python bytecode](https://docs.python.org/3/library/dis.html) · docs.python.org · the full instruction list and the `dis.dis` API (*read*) · covers our angle: **partial** — one short `myfunc` example, not explained line by line · fetched 2026-10-12
- **Our delta:** reading one real line of output.
- *Checked, not chosen:* Real Python's `dis` article (not fetchable — unverified).

---

## Phase 1 — Language core

### T01-01 · Syntax, indentation, line continuation — Understand · ✅ written `docs/python/pages/phase-1-language-core/01-syntax-and-indentation/`
- **Read this:** [Lexical analysis](https://docs.python.org/3/reference/lexical_analysis.html) · docs.python.org · line structure, explicit and implicit joining, and indentation rules, including the `TabError` for mixed tabs and spaces (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** none needed beyond the mixed-tabs example; the page is a reference and dense.

### T01-02 · Numbers: int, float, Decimal, floor division — Master · ✅ written `docs/python/pages/phase-1-language-core/02-numbers/`
- **Read this:** [Floating-Point Arithmetic: Issues and Limitations](https://docs.python.org/3/tutorial/floatingpoint.html) · docs.python.org · why 0.1 has no exact binary form, the root of `0.1 + 0.2` (*read*) · covers our angle: **partial** — floats only · fetched 2026-10-12
- **Also good:** [decimal](https://docs.python.org/3/library/decimal.html) · docs.python.org · quick-start and context rules for money-style arithmetic (*read*) · fetched 2026-10-12
- **Also good:** [An Informal Introduction to Python](https://docs.python.org/3/tutorial/introduction.html) · docs.python.org · `/` always returns float, `//` floors (*read*) · fetched 2026-10-12
- **Our delta:** `-7 // 2 == -4`, `%` sign rules, and the cross-language contrast with Java/JS.

### T01-03 · Strings and f-strings — Master · ✅ written `docs/python/pages/phase-1-language-core/03-strings/`
- **Read this:** [Built-in Types — text sequence type and f-string sections](https://docs.python.org/3/builtins/stdtypes.html) · docs.python.org · every `str` method, plus f-string sections for the `=` debug, conversion and format specifiers (*read*) · covers our angle: **partial** — no money-formatting recipe · fetched 2026-10-12
- **Also good:** [string — Common string operations](https://docs.python.org/3/library/string.html) · docs.python.org · the format-spec mini-language that sits behind `:,.2f`, including the `,` thousands separator (*read*) · fetched 2026-10-12
- **Our delta:** money formatting. Real Python's f-string guide was not fetchable.

### T01-04 · `bytes` vs `str` and encoding — Understand · ✅ written `docs/python/pages/phase-1-language-core/04-bytes-and-encoding/`
- **Read this:** [Pragmatic Unicode](https://nedbatchelder.com/text/unipain) · Ned Batchelder, 10 March 2012 (PyCon 2012 talk; covers Python 2 and 3) · the "Unicode sandwich": bytes outside, text inside, convert at the edges (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Unicode HOWTO](https://docs.python.org/3/howto/unicode.html) · docs.python.org · encode, decode and the `errors=` handlers (*read*) · fetched 2026-10-12
- **Our delta:** 🔴 3.15 makes UTF-8 the default encoding (PEP 686, listed in the 3.15 What's New), so any "locale default" claim on our page needs a version guard.

### T01-05 · Truthiness, `and`/`or`, the walrus — Master · ✅ written `docs/python/pages/phase-1-language-core/05-truthiness/`
- **Read this:** [PEP 572 — Assignment Expressions](https://peps.python.org/pep-0572/) · peps.python.org · the walrus with its scoping rules and rationale (*read*) · covers our angle: **partial** — walrus only · fetched 2026-10-12
- **Also good:** [Built-in Types — Truth Value Testing](https://docs.python.org/3/builtins/stdtypes.html) · docs.python.org · the list of falsy values and the short-circuit `and`/`or`/`not` rules (*read*) · fetched 2026-10-12
- **Our delta:** the `if items:` None-vs-empty bug.
- *Checked, not chosen:* Real Python's boolean and walrus articles (not fetchable — unverified).

### T01-06 · Comparisons — Understand · ✅ written `docs/python/pages/phase-1-language-core/06-comparisons/`
- **Read this:** [Expressions — Comparisons](https://docs.python.org/3/reference/expressions.html) · docs.python.org · chaining, identity tests and mixed-type comparison rules (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** when to use `is`; only `None`.

### T01-07 · Assignment, aliasing, `copy` vs `deepcopy` — Master · ✅ written `docs/python/pages/phase-1-language-core/07-assignment-and-aliasing/`
- **Read this:** [copy — Shallow and deep copy operations](https://docs.python.org/3/library/copy.html) · docs.python.org · the difference between shallow and deep and the recursion caveat (*read*) · covers our angle: **partial** — no mutation-through-a-function story · fetched 2026-10-12
- **Also good:** [Facts and myths about Python names and values](https://nedbatchelder.com/text/names) · Ned Batchelder, 6 July 2013, updated 26 January 2014 · assignment never copies, so aliases see each other's mutation (*read*) · fetched 2026-10-12
- **Our delta:** the function-mutates-your-list case.

### T01-08 · Control flow, `for`/`else`, loop idioms — Understand · ✅ written `docs/python/pages/phase-1-language-core/08-control-flow/`
- **Read this:** [More Control Flow Tools](https://docs.python.org/3/tutorial/controlflow.html) · docs.python.org · includes the "else Clauses on Loops" section and `range` (*read*) · covers our angle: **partial** — no `enumerate`/`zip` section (that is in the looping part of the data-structures chapter) · fetched 2026-10-12
- **Also good:** [Data Structures — looping techniques](https://docs.python.org/3/tutorial/datastructures.html) · docs.python.org · `enumerate`, `zip` and `reversed` as idioms (*read*) · fetched 2026-10-12

### T01-09 · Comprehensions and generator expressions — Master · ✅ written `docs/python/pages/phase-1-language-core/09-comprehensions/`
- **Read this:** [Data Structures — List Comprehensions](https://docs.python.org/3/tutorial/datastructures.html) · docs.python.org · list comps and nested comps with the nested-ordering example; set and dict comprehensions get a few lines (*read*) · covers our angle: **partial** — no generator expressions and nothing on when to stop · fetched 2026-10-12
- **Our delta:** the readability line, and a pointer to 3.15 unpacking in comprehensions (PEP 798, named in the 3.15 notes).
- *Checked, not chosen:* Real Python's comprehension guide (not fetchable — unverified).

### T01-10 · `match` — structural pattern matching — Understand · ✅ written `docs/python/pages/phase-1-language-core/10-match-pattern-matching/`
- **Read this:** [PEP 636 — Structural Pattern Matching: Tutorial](https://peps.python.org/pep-0636/) · peps.python.org · built up from a small example through sequences, mappings, classes and guards (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Compound statements — the match statement](https://docs.python.org/3/reference/compound_stmts.html) · docs.python.org · exact semantics of each pattern kind (*headings only*) · fetched 2026-10-12

### T01-11 · Exceptions, the working set — Master · ✅ written `docs/python/pages/phase-1-language-core/11-exceptions/`
- **Read this:** [Errors and Exceptions](https://docs.python.org/3/tutorial/errors.html) · docs.python.org · `try`/`except`/`else`/`finally`, `raise ... from` and groups in one chapter (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [PEP 654 — Exception Groups and except*](https://peps.python.org/pep-0654/) · peps.python.org · for the recognition-level 3.11 feature (*headings only*) · fetched 2026-10-12
- **Also good:** [Built-in Exceptions](https://docs.python.org/3/builtins/exceptions.html) · docs.python.org · the hierarchy, with `KeyboardInterrupt` under `BaseException` so `except Exception` misses it but bare `except:` does not (*read*) · fetched 2026-10-12

### T01-12 · EAFP vs LBYL — Understand · ✅ written `docs/python/pages/phase-1-language-core/12-eafp-vs-lbyl/`
- **Read this:** [Glossary — EAFP](https://docs.python.org/3/glossary.html) · docs.python.org · short EAFP and LBYL entries; the LBYL one notes the race in multi-threaded code (*read*) · covers our angle: **partial** — definitions, no guidance on when each is right · fetched 2026-10-12
- **Our delta:** the design stance, with the race worked through. Real Python's EAFP article was not fetchable. No anchor given.

### T01-13 · Unpacking — Understand · ✅ written `docs/python/pages/phase-1-language-core/13-unpacking/`
- **Read this:** [PEP 3132 — Extended Iterable Unpacking](https://peps.python.org/pep-3132/) · peps.python.org · the origin of the catch-all starred name, as in `a, *b, c = range(5)` (*read*) · covers our angle: **partial** — star-assignment only, not `*`/`**` in calls · fetched 2026-10-12
- **Also good:** [Data Structures — Tuples and Sequences](https://docs.python.org/3/tutorial/datastructures.html) · docs.python.org · tuple packing and sequence unpacking (*read*) · fetched 2026-10-12
- **Our delta:** swaps and call-site `*`/`**`.

### T01-14 · `None` and the no-result contract — Understand · ✅ written `docs/python/pages/phase-1-language-core/14-none-and-no-result/`
- **Read this:** none found — tried: "python return None vs raise vs empty" searches and the tutorial/FAQ pages. The Built-in Constants page defines `None` only.
- **Also good:** [Built-in Constants](https://docs.python.org/3/builtins/constants.html) · docs.python.org · `None` as the sole `NoneType` instance, used for the absence of a value (*read*) · covers: the definition only · fetched 2026-10-12
- **Also good:** [Tutor: functions: use return or exceptions?](https://mail.python.org/pipermail/tutor/2010-September/078888.html) · Steven D'Aprano on python-tutor, 24 Sep 2010 · return a value when an ordinary value will do, raise for errors, with `str.find` vs `str.index` as the stdlib example (*read*) · covers: **partial** — return-vs-raise only, no `Optional` typing · fetched 2026-10-12

### T01-15 · PEP 8 and idiom — Understand · ✅ written `docs/python/pages/phase-1-language-core/15-pep8-and-idiom/`
- **Read this:** [PEP 8 — Style Guide for Python Code](https://peps.python.org/pep-0008/) · peps.python.org · the canonical naming and layout rules, including "use `def`, not a lambda bound to a name" (*read*) · covers our angle: **partial** — no ruff, no "which rules matter" · fetched 2026-10-12
- **Also good:** [Ruff](https://docs.astral.sh/ruff/) · Astral docs · a Rust linter and formatter that claims drop-in parity with Flake8, isort and Black (*read*) · fetched 2026-10-12
- **Also good:** [PEP 20 — The Zen of Python](https://peps.python.org/pep-0020/) · peps.python.org · the short "pythonic" philosophy (*read*) · fetched 2026-10-12

### T01-16 · `del`, `pass`, `Ellipsis`, chained assignment — Know · ✅ written `docs/python/pages/phase-1-language-core/16-del-pass-ellipsis/`
- **Read this:** [Simple statements](https://docs.python.org/3/reference/simple_stmts.html) · docs.python.org · `del`, `pass` and assignment chains as the language defines them (*read*) · covers our angle: **partial** — `Ellipsis` lives on the constants page · fetched 2026-10-12
- **Also good:** [Built-in Constants](https://docs.python.org/3/builtins/constants.html) · docs.python.org · `Ellipsis`, the same object as the `...` literal (*read*) · fetched 2026-10-12

---

## Phase 2 — Functions, closures and decorators

### T02-01 · `def`, `return`, first-class functions — Understand · ✅ written `docs/python/pages/phase-2-functions/01-def-and-return/`
- **Read this:** [More Control Flow Tools — Defining Functions](https://docs.python.org/3/tutorial/controlflow.html) · docs.python.org · the function sections, including that a function with no `return` gives `None` (*read*) · covers our angle: **partial** — little on passing functions as `key=` · fetched 2026-10-12
- **Also good:** [Functional Programming HOWTO](https://docs.python.org/3/howto/functional.html) · docs.python.org · functions as values, with `sorted(key=...)` and `functools.partial` (*read*) · fetched 2026-10-12

### T02-02 · Parameters in full — Master · ✅ written `docs/python/pages/phase-2-functions/02-parameters-in-full/`
- **Read this:** [Common Gotchas — Mutable Default Arguments](https://docs.python-guide.org/writing/gotchas/) · The Hitchhiker's Guide to Python (undated; an older guide, flag for age) · explains that the default is built once, so a mutable one is shared (*read*) · covers our angle: **partial** — nothing on `/` or keyword-only · fetched 2026-10-12
- **Also good:** [More Control Flow Tools — More on Defining Functions](https://docs.python.org/3/tutorial/controlflow.html) · docs.python.org · defaults, `*args`/`**kwargs`, `/` and `*` markers (*read*) · fetched 2026-10-12
- **Also good:** [PEP 570 — Positional-Only Parameters](https://peps.python.org/pep-0570/) · peps.python.org · why `/` exists (*headings only*) · fetched 2026-10-12
- **Our delta:** designing a signature that survives growth. PEP 3102 (keyword-only) also fetched, not needed.

### T02-03 · Scope and closures — Master · ✅ written `docs/python/pages/phase-2-functions/03-scope-and-closures/`
- **Read this:** [Common Gotchas — Late Binding Closures](https://docs.python-guide.org/writing/gotchas/) · The Hitchhiker's Guide to Python (undated; older) · the loop-closure bug under "Late Binding Closures" (*read*) · covers our angle: **partial** — no LEGB or `nonlocal` · fetched 2026-10-12
- **Also good:** [Execution model](https://docs.python.org/3/reference/executionmodel.html) · docs.python.org · naming and binding rules behind LEGB, including `nonlocal` and `global` (*read*) · fetched 2026-10-12
- **Also good:** [Programming FAQ](https://docs.python.org/3/faq/programming.html) · docs.python.org · its lambda-in-a-loop question shows the same trap: lambdas expected to return 0, 1, 4, 9, 16 (*read*) · fetched 2026-10-12
- **Our delta:** `global`/`nonlocal`. Real Python's LEGB article was not fetchable.

### T02-04 · `lambda` — Understand · ✅ written `docs/python/pages/phase-2-functions/04-lambda/`
- **Read this:** [More Control Flow Tools — Lambda Expressions](https://docs.python.org/3/tutorial/controlflow.html) · docs.python.org · lambda as a small anonymous function, with a `sort(key=...)` example (*read*) · covers our angle: **partial** — no style guidance · fetched 2026-10-12
- **Our delta:** the named-function smell (PEP 8 advises against binding a lambda to a name).

### T02-05 · Decorators — Master · ✅ written `docs/python/pages/phase-2-functions/05-decorators/`
- **Read this:** [PEP 318 — Decorators for Functions and Methods](https://peps.python.org/pep-0318/) · peps.python.org · the origin and exact desugaring of `@` (stacked decorators apply bottom-up), but a 2003 spec, not a tutorial (*read*) · covers our angle: **partial** — no `wraps`, arguments or stacking recipe · fetched 2026-10-12
- **Also good:** [functools](https://docs.python.org/3/library/functools.html) · docs.python.org · `wraps` and `update_wrapper` (*read*) · fetched 2026-10-12
- **Our delta:** `@timed` and `@retry` built by hand. Real Python's decorator primer is the best-known tutorial but was not fetchable, so I could not verify it.

### T02-06 · `functools` — Understand · ✅ written `docs/python/pages/phase-2-functions/06-functools/`
- **Read this:** [functools — Higher-order functions](https://docs.python.org/3/library/functools.html) · docs.python.org · `cache`, `lru_cache`, `partial`, `singledispatch` and `reduce` in one reference (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [PEP 443 — Single-dispatch generic functions](https://peps.python.org/pep-0443/) · peps.python.org · the rationale for `singledispatch` (*headings only*) · fetched 2026-10-12

### T02-07 · Callables, bound methods, `self` — Understand · ✅ written `docs/python/pages/phase-2-functions/07-callables-beyond-functions/`
- **Read this:** [Classes — Method Objects](https://docs.python.org/3/tutorial/classes.html) · docs.python.org · why `x.f()` equals `MyClass.f(x)`, which is what `self` is (*read*) · covers our angle: **partial** — no `__call__` · fetched 2026-10-12
- **Also good:** [Descriptor HowTo Guide](https://docs.python.org/3/howto/descriptor.html) · docs.python.org · how functions become bound methods via non-data descriptors (*read*) · fetched 2026-10-12
- **Our delta:** `__call__` instances as callables.

### T02-08 · Docstrings and `help()` — Understand · ✅ written `docs/python/pages/phase-2-functions/08-docstrings/`
- **Read this:** [PEP 257 — Docstring Conventions](https://peps.python.org/pep-0257/) · peps.python.org · one-line vs multi-line conventions (*read*) · covers our angle: **partial** — no Google/NumPy/Sphinx format comparison · fetched 2026-10-12
- **Also good:** [pydoc](https://docs.python.org/3/library/pydoc.html) · docs.python.org · the tool behind `help()` (*read*) · fetched 2026-10-12

### T02-09 · Annotations at runtime (3.14, PEP 649/749) — Know · ✅ written `docs/python/pages/phase-2-functions/09-annotations-at-runtime/`
- **Read this:** [Annotations Best Practices](https://docs.python.org/3/howto/annotations.html) · docs.python.org · covers the 3.14 change: use `annotationlib.get_annotations()` rather than `__annotations__` (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [PEP 749 — Implementing PEP 649](https://peps.python.org/pep-0749/) · peps.python.org · `from __future__ import annotations` stays until 3.13 reaches end of life, then is deprecated and later removed (*read*) · fetched 2026-10-12
- **Also good:** [annotationlib](https://docs.python.org/3/library/annotationlib.html) · docs.python.org · the new module's API, with `get_annotations()` as the main entry point (*read*) · fetched 2026-10-12

### T02-10 · Recursion and the recursion limit — Know · ✅ written `docs/python/pages/phase-2-functions/10-recursion-and-the-limit/`
- **Read this:** [sys — `setrecursionlimit`](https://docs.python.org/3/library/sys.html) · docs.python.org · the limit protects the C stack; raising it risks a crash (*read*) · covers our angle: **partial** — no tail-call discussion · fetched 2026-10-12
- **Our delta:** no tail-call optimisation, so iterate. Real Python's recursion guide was not fetchable.
