---
title: "Link map · Python · Part 4 (phases 6–7)"
sidebar_label: "04 · typing and packaging"
sidebar_position: 4
---

# Link map · Python · Part 4 (phases 6–7)

Covers every topic row of phase 6 (T06-01 to T06-12, typing, from `docs/python/syllabus/02-data-model.md`) and phase 7 (T07-01 to T07-12, packaging, projects and tooling, from `docs/python/syllabus/03-application.md`). That is 24 rows. ✅ means a written topic directory of ours carries the row (the path is its first chunk file); 🔲 means no page of ours carries it yet. Phase 6 has no pages directory yet, so all 12 rows are 🔲. In phase 7 the first six rows (T07-01 to T07-06) are written; T07-07 to T07-12 are 🔲.
*read* = I read the passage; *headings only* = fetched, page checked, passage not read; *200 only* = the URL returned 200 and I did not read the passage (strong leads, not verified answers). Third-party links carry a date where the page shows one. No heading `#anchors` are given (the one `#/` in the pyright link is that site's page route, not a heading id).

🔴 **Version note.** Our syllabus targets **Python 3.14** (`docs/python/README.md`). Several third-party picks are older: the Adam Johnson posts (2021–2022), the Rednafi posts (2022), the Chris Warrick entry-points post (2014, updated 2017, written for `setup.py`) and the Alex Becker pip post (2019) are kept for the idea, not for current commands. The typing PEP picks cover features from 3.8 to 3.12; none was checked against 3.14 changes to annotation evaluation. Every PEP linked here is marked a historical document on peps.python.org (the living text is the typing specification at typing.python.org and the docs.python.org reference); the PEPs are kept as the rationale. On 2026-10-13 `docs.python.org/3/` renders the 3.15 documentation, so check an entry against the 3.14 selector before quoting it. Every pydevtools handbook page is by Tim Hopper and shows only a "last updated" date (2026-09-07, or 2026-09-14 for the two noted) and no original date; where a date is given below it is that update date. The handbook supplies 13 of the 24 third-party picks, so it leans on one author. Real Python pages returned 403 to the fetch tool, so none is cited. Version numbers of ruff, pre-commit hooks and GitHub Actions in third-party examples drift fast: check them before copying.

---

## Phase 6 — Typing

### T06-01 · The contract: hints don't execute — Master · 🔲 not written
- **Read this:** [PEP 484 – Type Hints](https://peps.python.org/pep-0484/) · python.org · the founding PEP; says the authors have no desire to ever make type hints mandatory, even by convention, and that unannotated functions are treated as the most general type (*read*) · covers our angle: **partial** — a spec, not a teaching page · fetched 2026-10-13
- **Also good:** [typing — Support for type hints](https://docs.python.org/3/library/typing.html) · Python library reference · the module reference and the starting point for every later row (*read* the opening and the NewType, Literal, Final, Self entries) · fetched 2026-10-13
- **Beyond the docs:** [What is PEP 484?](https://pydevtools.com/handbook/explanation/what-is-pep-484/) · pydevtools handbook · says plainly that Python stores annotations but never enforces them, and that annotated and unannotated code coexist, which is the gradual-typing half of the row; Tim Hopper; page shows a 2026-09-07 update date · fetched 2026-10-13 (*read*)
- **Our delta:** "annotate the boundaries first" as a rollout rule.

### T06-02 · The working vocabulary — Master · 🔲 not written
- **Read this:** [PEP 604 – Allow writing union types as X | Y](https://peps.python.org/pep-0604/) · python.org · proposes overloading the pipe operator so `Union[X, Y]` can be written `X | Y`; 3.10 and later (*read* the abstract) · covers our angle: **partial** — one piece of the vocabulary · fetched 2026-10-13
- **Also good:** [PEP 585 – Type Hinting Generics In Standard Collections](https://peps.python.org/pep-0585/) · python.org · removes the duplicated `typing.List` hierarchy so `list[int]` works directly (*read* the abstract) · [Modernizing superseded typing features](https://typing.python.org/en/latest/guides/modernizing.html) · typing.python.org · the old spellings and their modern replacements, including `Union` and `Optional` (*read* that entry) · fetched 2026-10-13
- **Beyond the docs:** [Python type hints: old and new ways to write the same types](https://adamj.eu/tech/2022/10/17/python-type-hints-old-and-new-syntaxes/) · Adam Johnson, 2022-10-17 · side by side `Optional[X]` with `X | None` and `List[int]` with `list[int]`, so old code reads fluently; says the pipe form is preferred since PEP 604 · fetched 2026-10-13 (*read*)
- **Our delta:** return types and the "older code" reading skill in one place.

### T06-03 · Running a checker — Understand · 🔲 not written
- **Read this:** [Using mypy with an existing codebase](https://mypy.readthedocs.io/en/stable/existing_code.html) · mypy docs · many options can be enabled per module, for example `disallow_untyped_defs` once a module is annotated (*read*) · covers our angle: **partial** — mypy only, no pyright comparison · fetched 2026-10-13
- **Also good:** [Pyright configuration](https://microsoft.github.io/pyright/#/configuration) · Microsoft · the `strict` path list and the per-rule settings on the pyright side (*read* the page's `configuration.md` source, which the route renders) · [mypy command line](https://mypy.readthedocs.io/en/stable/command_line.html) · mypy docs · `--strict` enables a defined subset of optional checks (*read* that entry) · fetched 2026-10-13
- **Beyond the docs:** [How to gradually adopt type checking in an existing Python project](https://pydevtools.com/handbook/how-to/how-to-gradually-adopt-type-checking-in-an-existing-python-project/) · pydevtools handbook · a step list: baseline run, `ignore_errors` overrides for legacy modules, strict overrides for new ones, then flip the default; uses mypy and says the same strategy applies to pyright and ty; Tim Hopper; page shows a 2026-09-07 update date · fetched 2026-10-13 (*read*)
- **Our delta:** choosing mypy or pyright and putting it in CI; neither page decides for you.

### T06-04 · `TypedDict`, `Literal`, `Final`, `NewType` — Understand · 🔲 not written
- **Read this:** [TypedDict](https://mypy.readthedocs.io/en/stable/typed_dict.html) · mypy docs · TypedDict gives precise types to dictionaries that represent objects with a fixed schema, which is the "JSON dict you did not model" case (*read* the opening) · covers our angle: **partial** — TypedDict only; Literal, Final and NewType sit on the pages below · fetched 2026-10-13
- **Also good:** [Literal types and Enums](https://mypy.readthedocs.io/en/stable/literal_types.html) · mypy docs · Literal types say an expression equals one specific primitive value; the examples use `Literal[True]` overloads and colour aliases, not our `Literal["r", "w"]` (*read*) · [Final names, methods and classes](https://mypy.readthedocs.io/en/stable/final_attrs.html) · mypy docs · Final names should not be reassigned after initialization (*read* the opening) · [typing — Support for type hints](https://docs.python.org/3/library/typing.html) · Python library reference · NewType: the checker treats the new type as a subclass of the original (*read* that entry) · [PEP 589 – TypedDict](https://peps.python.org/pep-0589/) · python.org · the rationale: `Dict[K, V]` cannot say a value's type depends on its key (*read* the abstract) · [PEP 591 – Adding a final qualifier](https://peps.python.org/pep-0591/) · python.org (*headings only*) · fetched 2026-10-13
- **Beyond the docs:** [TypedDict vs Pydantic](https://www.packetcoders.io/typeddict-vs-pydantic/) · Rick Donato, PacketCoders, 2025-09-12 · shows TypedDict is checked statically only, with bad data accepted silently at runtime; covers TypedDict alone, not Literal, Final or NewType · fetched 2026-10-13 (*read*)
- **Our delta:** `NewType` for ids that stop cross-assigning; no third-party page found for it.

### T06-05 · `Protocol` — Understand · 🔲 not written
- **Read this:** [Protocols and structural subtyping](https://typing.python.org/en/latest/reference/protocols.html) · typing.python.org · the runtime check only verifies that protocol members exist, not that they have the right type (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [PEP 544 – Protocols: Structural subtyping](https://peps.python.org/pep-0544/) · python.org · PEP 484 only specified nominal subtyping; this adds the structural kind (*read* the abstract) · fetched 2026-10-13
- **Beyond the docs:** [Using abc.ABC vs Protocols](https://kraken-static-typing-advice.readthedocs.io/en/latest/advice/using_abc_vs_protocols.html) · Kraken static typing advice · argues that `runtime_checkable` does not do what it looks like and is best avoided, and when an ABC is the better tool; page shows no author or date. The typing reference above gives the milder version: the runtime check is "not completely safe" and `hasattr()` is often better · fetched 2026-10-13 (*read*)
- **Our delta:** "anything with a `.save()`" without touching the classes.

### T06-06 · Generics, modern syntax (PEP 695) — Understand · 🔲 not written
- **Read this:** [PEP 695 – Type Parameter Syntax](https://peps.python.org/pep-0695/) · python.org · an improved syntax for type parameters on classes, functions and type aliases, plus a new `type` statement; 3.12 and later (*read* the abstract) · covers our angle: **partial** — a spec · fetched 2026-10-13
- **Also good:** [Generics](https://typing.python.org/en/latest/reference/generics.html) · typing.python.org · generics reference, starting from the older `TypeVar` and `Generic[T]` spelling (*read* the opening) · fetched 2026-10-13
- **Beyond the docs:** [What is PEP 695?](https://pydevtools.com/handbook/explanation/what-is-pep-695/) · pydevtools handbook · contrasts the old `T = TypeVar("T")`, a module-level variable with no scope, with type parameters scoped to the class or function; Tim Hopper; page shows a 2026-09-07 update date · fetched 2026-10-13 (*read*)
- **Our delta:** reading pre-3.12 `TypeVar` code next to the new form.

### T06-07 · `Callable` and `ParamSpec` — Understand · 🔲 not written
- **Read this:** [PEP 612 – Parameter Specification Variables](https://peps.python.org/pep-0612/) · python.org · `ParamSpec` and `Concatenate` (3.10 and later) (*headings only*) · covers our angle: **partial** — the spec, not the retry decorator · fetched 2026-10-13
- **Also good:** [typing — Support for type hints](https://docs.python.org/3/library/typing.html) · Python library reference · ParamSpec: a specialized type variable for a callable's parameters, declared as `**P` in a type parameter list (*read* that entry) · fetched 2026-10-13
- **Beyond the docs:** [Add typing to decorators](https://drops.mathspp.com/0109-add_typing_to_decorators/tip.html) · Rodrigo Girão Serrão, mathspp drops · a decorator typed with `Callable[P, T]` and `P.args` / `P.kwargs` so the decorated function keeps its signature, in the 3.12 `[T, **P]` spelling; a short tip, the page shows the author and a 2023 site copyright but no post date · fetched 2026-10-13 (*read*)
- **Our delta:** typing the Phase 2 `@retry` so callers keep autocomplete.

### T06-08 · `Any` vs `object`, `cast`, `# type: ignore` — Understand · 🔲 not written
- **Read this:** [Common issues and solutions](https://mypy.readthedocs.io/en/stable/common_issues.html) · mypy docs · where an explicit `cast` is needed and the `assert isinstance` narrowing alternative that removes it (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Error codes](https://mypy.readthedocs.io/en/stable/error_codes.html) · mypy docs · `# type: ignore[code]` silences one error code on a line so other, more serious errors are not hidden (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Python type hints: Use object instead of Any](https://adamj.eu/tech/2021/05/07/python-type-hints-use-object-instead-of-any/) · Adam Johnson, 2021-05-07 · when you mean "could be any type and I do not care", `object` keeps the checks that `Any` switches off · fetched 2026-10-13 (*read*)
- **Our delta:** the "always with an error code" discipline; [Python type hints: how to use typing.cast()](https://adamj.eu/tech/2021/07/06/python-type-hints-how-to-use-typing-cast/) (Adam Johnson, 2021-07-06, *read*) calls casting the preferable escape hatch to an ignore.

### T06-09 · `Self`, `ClassVar`, `overload` — Know · 🔲 not written
- **Read this:** [PEP 673 – Self Type](https://peps.python.org/pep-0673/) · python.org · a simple way to annotate methods that return an instance of their class; 3.11 and later (*read* the abstract) · covers our angle: **partial** — Self only · fetched 2026-10-13
- **Also good:** [More types](https://mypy.readthedocs.io/en/stable/more_types.html) · mypy docs · `@overload` encodes a relationship between arguments and return type that is hard to express normally (*read*) · [Python type hints: vary return type based on an argument](https://adamj.eu/tech/2021/09/06/python-type-hints-how-to-vary-return-type-based-on-an-argument/) · Adam Johnson, 2021-09-06 · expands a bool argument into `Literal[True]` and `Literal[False]` overloads (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Self type in Python](https://rednafi.com/python/self-type/) · Redowan Delowar (Rednafi), 2022-02-28 · shows `Self` fixing classmethods that return subclass instances, and instance methods returning `self`; written before 3.11 shipped, so it mentions `typing_extensions` · fetched 2026-10-13 (*read*)
- **Our delta:** `ClassVar` has no third-party page; the reference entries are [typing.ClassVar](https://docs.python.org/3/library/typing.html) (a variable annotation marking an attribute as a class variable, no runtime effect, *read*) and [Class basics](https://mypy.readthedocs.io/en/stable/class_basics.html) (*read* the `ClassVar[t]` passage).

### T06-10 · Static hints vs runtime validation — Understand · 🔲 not written
- **Read this:** [Pydantic documentation](https://pydantic.dev/docs/validation/latest/get-started/) · Pydantic · the runtime-validation side of the pair (*headings only*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [Python Type Checking](https://testdriven.io/blog/python-type-checking/) · testdriven.io, last updated 2023-12-01 · states static checking does not enforce types while the program runs, then brings in pydantic for data from outside · fetched 2026-10-13 (*read*)
- **Our delta:** "two tools, one worldview", the checker for your code and Pydantic for other people's data.

### T06-11 · Stubs: `.pyi`, typeshed, `py.typed` — Know · 🔲 not written
- **Read this:** [Stub files](https://mypy.readthedocs.io/en/stable/stubs.html) · mypy docs · a stub is a skeleton of a module's public interface; mypy takes stdlib and third-party stubs from typeshed; stubs next to a module win over the `.py` (*read*) · covers our angle: **partial** — little on `py.typed` · fetched 2026-10-13
- **Also good:** [Distributing type information](https://typing.python.org/en/latest/spec/distributing.html) · typing.python.org · the `py.typed` marker: maintainers MUST add it to a package that supports type checking, and it applies recursively (*read*) · [PEP 561](https://peps.python.org/pep-0561/) · python.org · the original rule text, same marker requirement (*read*) · fetched 2026-10-13
- **Beyond the docs:** [What is PEP 561?](https://pydevtools.com/handbook/explanation/what-is-pep-561/) · pydevtools handbook · without the marker, mypy skips a package's inline annotations and every imported value becomes `Any`, which is the "why some imports are Any" answer; Tim Hopper; page shows a 2026-09-07 update date · fetched 2026-10-13 (*read*)
- **Our delta:** what to do about it (install `types-*`, write a local stub, or ignore the import).

### T06-12 · Variance — When Needed · 🔲 not written
- **Read this:** [Generics](https://mypy.readthedocs.io/en/stable/generics.html) · mypy docs · the "Variance of generic types" section: invariant, covariant and contravariant, with `Callable` as contravariant in its arguments (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [Variance of generic types in Python](https://rednafi.com/python/variance-of-generic-types/) · Redowan Delowar (Rednafi), 2022-01-31 · works the example `list[int]` is not a `list[float]` because a list is mutable; the Dog and Animal case follows by the same reasoning · fetched 2026-10-13 (*read*)
- **Our delta:** reading the error message "expected `list[Animal]`, got `list[Dog]`".

---

## Phase 7 — Packaging, projects and tooling

### T07-01 · `pyproject.toml` — Master · ✅ written `docs/python/pages/phase-7-packaging-tooling/01-pyproject-toml/01-the-catch-22-that-killed-setup-py.md`
- **Read this:** [Writing your pyproject.toml](https://packaging.python.org/en/latest/guides/writing-pyproject-toml/) · Python Packaging User Guide · the `[project]` table, `[project.scripts]`, `[project.optional-dependencies]`; dependency groups are not covered (*read*) · covers our angle: **partial** — metadata only; tool tables are not the focus · fetched 2026-10-13
- **Also good:** [PEP 621 – Storing project metadata in pyproject.toml](https://peps.python.org/pep-0621/) · python.org · how to write a project's core metadata in `pyproject.toml` (*read* the abstract) · [PEP 517](https://peps.python.org/pep-0517/) · python.org · the frontend and backend split, with the `build_wheel` and `build_sdist` hooks (*headings only*) · fetched 2026-10-13
- **Beyond the docs:** [Why Should I Choose pyproject.toml over requirements.txt for managing dependencies?](https://pydevtools.com/handbook/explanation/pyproject-vs-requirements/) · pydevtools handbook · says PEP 621 made `setup.py` unnecessary for new projects and that requirements.txt still suits a script that only needs `requests`; Tim Hopper; page shows a 2026-09-07 update date · fetched 2026-10-13 (*read*)
- **Our delta:** the catch-22 history of why `setup.py` could not be read without running it.

### T07-02 · `uv` — Master · ✅ written `docs/python/pages/phase-7-packaging-tooling/02-uv/01-what-uv-is.md`
- **Read this:** [Working on projects](https://docs.astral.sh/uv/guides/projects/) · uv docs · `uv lock` creates the lockfile, `uv sync` updates `.venv`, and every `uv run` checks the lockfile against `pyproject.toml` first (*read*) · covers our angle: **partial** — no `pip` plus `venv` fallback · fetched 2026-10-13
- **Also good:** [uv documentation](https://docs.astral.sh/uv/) · Astral · the index to the rest; opens as "an extremely fast Python package and project manager" (*read* the opening) · [venv — Creation of virtual environments](https://docs.python.org/3/library/venv.html) · Python library reference · the baseline to fall back to: lightweight virtual environments with their own independent set of packages (*read* the opening) · fetched 2026-10-13
- **Our delta:** the pip plus venv baseline next to uv. No good third-party explainer found: the searches returned tutorials, benchmark pages and a vendor comparison, none read in full.

### T07-03 · Dependencies done right — Master · ✅ written `docs/python/pages/phase-7-packaging-tooling/03-dependencies/01-pep-440-the-version-itself.md`
- **Read this:** [Managing dependencies](https://docs.astral.sh/uv/concepts/projects/dependencies/) · uv docs · dependencies, extras and dependency groups in a uv project (*read* the opening) · covers our angle: **partial** — uv's flavor; says little on apps vs libraries · fetched 2026-10-13
- **Also good:** [Dependency Groups](https://packaging.python.org/en/latest/specifications/dependency-groups/) · Python Packaging User Guide · the `[dependency-groups]` spec: a table of user-defined keys, each a list of requirements (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Stop Lying to Your Dependency Resolver](https://mergify.com/blog/stop-lying-to-your-dependency-resolver-the-real-rules-for-python-dependency-management) · Mehdi Abaakouk, Mergify, 2025-12-15 · applications need deterministic versions from a lockfile while libraries need compatibility ranges, the "apps lock, libraries range" split · fetched 2026-10-13 (*read*)
- **Our delta:** our first chunk starts at PEP 440 version syntax; the apps-versus-libraries rule sits later.

### T07-04 · Project layout, the src layout — Understand · ✅ written `docs/python/pages/phase-7-packaging-tooling/04-project-layout/01-flat-and-src-layout.md`
- **Read this:** [src layout vs flat layout](https://packaging.python.org/en/latest/discussions/src-layout-vs-flat-layout/) · Python Packaging User Guide · the working directory comes first on the import path, so a same-named package there shadows the installed copy; the src layout keeps the installed copy in use (*read*) · covers our angle: **partial** — no tests-outside-package or workspaces · fetched 2026-10-13
- **Beyond the docs:** [src layout vs flat layout](https://pydevtools.com/handbook/explanation/src-layout-vs-flat-layout/) · pydevtools handbook · in a flat layout tests run against raw source, so packaging bugs pass locally and surface only for users; Tim Hopper; page shows a 2026-09-07 update date · fetched 2026-10-13 (*read*)
- **Our delta:** the `sys.path` zero walk-through and the wrong-copy bug reproduced.

### T07-05 · `ruff` — Understand · ✅ written `docs/python/pages/phase-7-packaging-tooling/05-ruff/01-what-ruff-replaces.md`
- **Read this:** [Configuring Ruff](https://docs.astral.sh/ruff/configuration/) · Astral · config in `pyproject.toml`, `ruff.toml` or `.ruff.toml`, with `select` and `extend-select` under the lint table (*read*) · covers our angle: **partial** — no CI or pre-commit · fetched 2026-10-13
- **Also good:** [The Ruff Linter](https://docs.astral.sh/ruff/linter/) · Astral (*headings only*) · [The Ruff Formatter](https://docs.astral.sh/ruff/formatter/) · Astral (*headings only*) · fetched 2026-10-13
- **Beyond the docs:** [How to replace Black, isort, flake8, and pyupgrade with Ruff](https://pydevtools.com/handbook/how-to/how-to-replace-black-isort-flake8-pyupgrade-with-ruff/) · pydevtools handbook · swaps the old hooks for the ruff pre-commit hooks and splits CI into a `ruff check` run and a `ruff format --check` run; advises not enabling rules nobody will fix today; Tim Hopper; page shows a 2026-09-07 update date · fetched 2026-10-13 (*read*)
- **Our delta:** check and format as two separate tools.

### T07-06 · Entry points `[project.scripts]` — Understand · ✅ written `docs/python/pages/phase-7-packaging-tooling/06-entry-points/01-what-the-installer-writes.md`
- **Read this:** [Entry points specification](https://packaging.python.org/en/latest/specifications/entry-points/) · Python Packaging User Guide · the format; a `console_scripts` entry point makes the installer create a command-line wrapper for each function (*read*) · covers our angle: **partial** — a spec · fetched 2026-10-13
- **Also good:** [Writing your pyproject.toml](https://packaging.python.org/en/latest/guides/writing-pyproject-toml/) · Python Packaging User Guide · "To install a command as part of your package, declare it in the `[project.scripts]` table" (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Python Apps the Right Way: entry points and scripts](https://chriswarrick.com/blog/2014/09/15/python-apps-the-right-way-entry_points-and-scripts/) · Chris Warrick, 2014-09-15 (updated 2017-08-03) · the `name = module.with:function` form and `gui_scripts`; written for `setup.py`, so translate to `[project.scripts]`; does not cover how the wrapper is built · fetched 2026-10-13 (*read*)
- **Our delta:** what the installer writes and `entry_points.txt`.

### T07-07 · Wheels vs sdists, native extensions — Understand · 🔲 not written
- **Read this:** [Package Formats](https://packaging.python.org/en/latest/discussions/package-formats/) · Python Packaging User Guide · sdist and wheel compared: the two file formats found on an index such as PyPI (*read* the opening) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Binary distribution format](https://packaging.python.org/en/latest/specifications/binary-distribution-format/) · Python Packaging User Guide · the wheel format spec (*read* the opening line only) · fetched 2026-10-13
- **Beyond the docs:** [How pip install works](https://dev.to/alexbecker/how-pip-install-works-323j) · Alex Becker, DEV Community, 2019-03-05 · pip prefers binary wheels, and when it downloads a source distribution it builds a wheel first; 2019, so older pip behavior · fetched 2026-10-13 (*read*)
- **Our delta:** reading the missing-wheel failure for your platform.

### T07-08 · Config and secrets — Understand · 🔲 not written
- **Read this:** [Settings and Environment Variables](https://fastapi.tiangolo.com/advanced/settings/) · FastAPI docs · pydantic-settings, environment variables and a `.env` file (*read*) · covers our angle: **partial** — FastAPI-shaped · fetched 2026-10-13
- **Also good:** [Config — The Twelve-Factor App](https://12factor.net/config) · 12factor.net · "stores config in environment variables" (*read*) · [Pydantic Settings](https://pydantic.dev/docs/validation/latest/concepts/pydantic_settings/) · Pydantic docs (*200 only*) · fetched 2026-10-13
- **Our delta:** `.env` in dev only; no third-party page found that sets that rule, the search results did not support it.

### T07-09 · Single-file scripts, inline metadata (PEP 723) — Know · 🔲 not written
- **Read this:** [Running scripts](https://docs.astral.sh/uv/guides/scripts/) · uv docs · `uv run` for scripts with or without dependencies, and inline script metadata (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Inline script metadata](https://packaging.python.org/en/latest/specifications/inline-script-metadata/) · Python Packaging User Guide · the metadata format embedded in single-file scripts (*read* the opening) · [PEP 723](https://peps.python.org/pep-0723/) · python.org · the rationale for the format (*read* the abstract) · fetched 2026-10-13
- **Beyond the docs:** [What is PEP 723?](https://pydevtools.com/handbook/explanation/what-is-pep-723/) · pydevtools handbook · walks what uv does with the block, starting with parsing the `# /// script` block, then resolving the dependency list and running the script in a cached temporary environment; Tim Hopper; page shows a 2026-09-07 update date · fetched 2026-10-13 (*read*)
- **Our delta:** automation scripts that carry their environment.

### T07-10 · Editable installs, path dependencies, monorepos — Know · 🔲 not written
- **Read this:** [Editable installs](https://pip.pypa.io/en/stable/topics/local-project-installs/) · pip docs · regular installs versus editable installs, which add the development directory to Python's import path instead of copying files (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Using workspaces](https://docs.astral.sh/uv/concepts/projects/workspaces/) · uv docs · a workspace is a collection of members managed together, sharing one lockfile (*read*) · fetched 2026-10-13
- **Beyond the docs:** [What Is an Editable Install?](https://pydevtools.com/handbook/explanation/what-is-an-editable-install/) · pydevtools handbook · an editable install puts a `.pth` file in `site-packages` instead of copying files; a companion how-to on [uv workspaces monorepos](https://pydevtools.com/handbook/how-to/how-to-set-up-a-python-monorepo-with-uv-workspaces/) shows `workspace = true` resolving a sibling locally (*read* both) · Tim Hopper; both show a 2026-09-07 update date · fetched 2026-10-13
- **Our delta:** simple monorepos, not build-system internals.

### T07-11 · `pre-commit` — Know · 🔲 not written
- **Read this:** [pre-commit](https://pre-commit.com/) · pre-commit project site · the framework's own introduction: git hook scripts that catch simple issues before code review (*read* the opening) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [How to set up pre-commit hooks for a Python project](https://pydevtools.com/handbook/how-to/how-to-set-up-pre-commit-hooks-for-a-python-project/) · pydevtools handbook · run it with `uvx pre-commit install` and use the ruff-check then ruff-format hooks in order; Tim Hopper; Tim Hopper; page shows a 2026-09-14 update date · fetched 2026-10-13 (*read*)
- **Our delta:** check the hook `rev` before copying; examples go stale.

### T07-12 · Publishing to PyPI — Know · 🔲 not written
- **Read this:** [Publishing with GitHub Actions CI/CD](https://packaging.python.org/en/latest/guides/publishing-package-distribution-releases-using-github-actions-ci-cd-workflows/) · Python Packaging User Guide · the trusted-publishing workflow; the guide relies on PyPI's Trusted Publishing to connect to GitHub Actions (*read* that section) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Trusted Publishers](https://docs.pypi.org/trusted-publishers/) · PyPI docs · OIDC exchange of short-lived tokens in place of API tokens (*read*) · [Building and publishing a project](https://docs.astral.sh/uv/guides/package/) · uv docs · `uv build` and `uv publish` (*read* the opening) · fetched 2026-10-13
- **Beyond the docs:** [How to Publish to PyPI with Trusted Publishing](https://pydevtools.com/handbook/how-to/how-to-publish-to-pypi-with-trusted-publishing/) · pydevtools handbook · GitHub Actions proves its identity to PyPI with an OIDC token that lives only for the workflow run; page shows a 2026-09-14 update date · fetched 2026-10-13 (*read*)
- **Our delta:** versioning and build backends; check action versions before copying a workflow.
