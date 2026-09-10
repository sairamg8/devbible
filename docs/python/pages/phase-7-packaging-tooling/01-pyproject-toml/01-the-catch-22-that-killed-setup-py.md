---
title: "setup.py was executable, so no tool could read your dependencies without running your project first — pyproject.toml exists to break that catch-22, and everything modern in Python packaging is downstream of it"
sidebar_label: "01 · The catch-22"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against PEP 518 — *Specifying Minimum Build System Requirements for Python Projects* ([peps.python.org](https://peps.python.org/pep-0518/)), PEP 517 — *A build-system independent format for source trees* ([peps.python.org](https://peps.python.org/pep-0517/)), PEP 621 — *Storing project metadata in pyproject.toml* ([peps.python.org](https://peps.python.org/pep-0621/)), and the PyPA *pyproject.toml specification* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/pyproject-toml/)).
> Target: **Python 3.14.7**. Documentation-validated — **no sandbox run, no program output**.

**For twenty years the file that described a Python project was a Python program. To find out what `requests` depended on, `pip` had to execute `setup.py` — and `setup.py` could not run until its own build dependencies were installed, which were declared inside the file that could not run. PEP 518 names this exactly: a catch-22. `pyproject.toml` is the answer, and it is a deliberately boring one: static, declarative TOML in the project root that any tool can read with a parser instead of an interpreter. Every convenience you get from `uv`, `ruff`, `hatch`, dependency resolvers and lockfiles is a consequence of that one change, and understanding *why* the change was necessary is what stops you writing 2015-era packaging in 2026.**

## The problem, stated by the PEP that fixed it

`setup.py` was a script. Its entire contract with the outside world was *"run me with a Python interpreter and I will call `setuptools.setup()` with some keyword arguments."* Metadata was not data; it was the *side effect* of executing arbitrary code.

That is fine as long as executing the code is free. It is not, because the code has dependencies:

```python
# setup.py — the shape that created the problem
from setuptools import setup
import numpy                      # 🔴 imported at module scope, before anything is installed

setup(
    name="fastmath",
    version="0.3.1",
    include_dirs=[numpy.get_include()],
    install_requires=["numpy>=1.26"],
)
```

To learn that this project needs `numpy`, a tool must import this module. Importing this module needs `numpy`. PEP 518 states the bind without hedging:

> *"You can't execute a `setup.py` file without knowing its dependencies, but currently there is no standard way to know what those dependencies are in an automated fashion without executing the `setup.py` file where that information is stored."*

And then names it:

> *"It's a catch-22 of a file not being runnable without knowing its own contents which can't be known programmatically unless you run the file."*

### `setup_requires` was the workaround, and it had the same hole

setuptools offered `setup_requires=[...]` — a keyword telling setuptools to fetch build dependencies before doing the real work. It failed for the same structural reason:

> *"No tooling (besides setuptools itself) can access this information without executing the `setup.py`, but `setup.py` can't be executed without having these items installed."*

`setup_requires` was **inside** the file. Only setuptools could read it, and only by running the file. It moved the circle by one step; it did not break it.

## What "executable metadata" cost in practice

The catch-22 is the headline, but the consequences are what you actually hit:

- **Arbitrary code execution on install.** `pip install some-package` from an sdist ran that package's author's Python on your machine, as you, before you had reviewed anything. There was no read-only mode.
- **Metadata that varied by machine.** A `setup.py` could branch on `sys.platform`, `os.environ`, the presence of a compiler, or the current time. The dependency list on the maintainer's laptop and the dependency list on your CI runner were not required to agree.
- **No resolver could work ahead.** A dependency solver wants to read metadata for many candidate versions cheaply. If reading metadata means downloading an sdist, creating an environment and running code, the resolver's search space collapses to whatever it can afford to execute.
- **`pip` had to *be* the build system.** PEP 517 lists this as the third of distutils/setuptools' three serious problems: *"(c) it's very difficult to use anything else, because distutils/setuptools provide the standard interface for installing packages expected by both users and installation tools like `pip`."*

## PEP 518's answer: one file, in TOML, that is data

PEP 518 introduced `pyproject.toml` with exactly one job at first — declaring what is needed to *build* the project, in a form readable without executing anything:

```toml
[build-system]
requires = ["setuptools", "wheel"]
```

> *"This key must have a value of a list of strings representing PEP 508 dependencies required to execute the build system (currently that means what dependencies are required to execute a `setup.py` file)."*

Note the parenthetical. PEP 518 did not abolish `setup.py`; it put a static label on the outside of the box saying what you need installed before you open it. Abolishing `setup.py` came next, in PEP 517.

### Why TOML and not JSON, YAML or INI

This gets asked in interviews because it looks arbitrary. It is not — PEP 518 justifies it in one sentence:

> *"This format was chosen as it is human-usable (unlike JSON), it is flexible enough (unlike configparser), stems from a standard (also unlike configparser), and it is not overly complex (unlike YAML)."*

Four rejections, four different reasons: JSON has no comments and hostile syntax for humans; `configparser` (i.e. `setup.cfg`) has no real types, no nesting and no specification outside CPython's own implementation; YAML is large enough that implementations disagree with each other. TOML has a versioned spec, a type system, and one obvious way to write a table.

⚠️ **`setup.cfg` was the near miss.** It was declarative, and it was already there. It lost because `configparser` has no arrays, no nested tables and no booleans — everything is a string that each tool re-parses its own way. That is why `[tool.*]` in TOML could become a shared namespace and `setup.cfg` never did.

## The three tables, and only three

The current specification is explicit about the file's shape:

> *"`pyproject.toml` is a configuration file used by packaging tools, as well as other tools such as linters, type checkers, etc. There are three possible TOML tables in this file."*

| Table | Standardised by | Owns | Read by |
|---|---|---|---|
| `[build-system]` | PEP 518 + PEP 517 | how to build this project | build frontends — `pip`, `build`, `uv` |
| `[project]` | PEP 621 | the project's core metadata | build backends, then every installer downstream |
| `[tool.*]` | PEP 518 | everything else, per tool | that one tool and nobody else |

Anything not in those three tables does not belong in the file. The rule is not a convention — PEP 621 forbids widening `[project]`:

> *"No tools may add fields to this table which are not defined by this PEP or subsequent PEPs. For tools wishing to store their own settings in `pyproject.toml`, they may use the `[tool]` table as defined in PEP 518."*

That sentence is the reason `[tool.ruff]` exists rather than `[project.ruff]`, and it is why a typo like `[project.scrips]` is a *silent* problem in some backends and a hard error in others — the key is simply not one the spec knows.

## PEP 621: metadata becomes data too

PEP 518 made *build requirements* declarative. The project's own metadata — name, version, dependencies, author, license — was still keyword arguments inside a function call, and each build tool that wanted to replace setuptools (flit, poetry, pdm) invented its own table for it. PEP 621 standardised the answer:

> *"This PEP specifies how to write a project's core metadata in a `pyproject.toml` file for packaging-related tools to consume."*

with the two goals stated as:

> *"Provide a tool-agnostic way of specifying metadata for ease of learning and transitioning between build back-ends"*

> *"Allow for more code sharing between build back-ends for the 'boring parts' of a project's metadata"*

The second is the load-bearing one. `[project]` is not there to make your file prettier; it is there so that changing from setuptools to hatchling is an edit to `[build-system]` and not a rewrite of your metadata.

## What a complete modern file looks like

Nothing here is executable. Every value is a literal a TOML parser can hand you:

```toml
[build-system]
requires = ["hatchling >= 1.26"]
build-backend = "hatchling.build"

[project]
name = "invoice-service"
version = "0.4.2"
description = "Issues, stores and reconciles customer invoices."
readme = "README.md"
requires-python = ">=3.12"
license = "MIT"
authors = [{ name = "Priya Raman", email = "priya@example.com" }]
classifiers = ["Programming Language :: Python :: 3.14"]
dependencies = [
    "httpx>=0.28",
    "pydantic>=2.9",
    "sqlalchemy>=2.0",
]

[project.optional-dependencies]
postgres = ["psycopg[binary]>=3.2"]

[project.scripts]
invoice = "invoice_service.cli:main"

[project.urls]
Homepage = "https://example.com/invoice-service"
Source = "https://github.com/example/invoice-service"

[dependency-groups]
dev = ["pytest>=8.3", "ruff>=0.16"]

[tool.ruff]
line-length = 100

[tool.pytest.ini_options]
testpaths = ["tests"]
```

A resolver can read `dependencies` and `requires-python` from this without a Python interpreter present at all. That is the whole point, and it is why wheels — which carry this metadata pre-computed in a `.dist-info` directory — became the normal way to install anything.

## The one thing pyproject.toml did *not* fix

It did not make the *build* declarative. A backend still runs Python code to produce a wheel; PEP 517 just standardised how it is invoked and made the frontend install its dependencies first. Your project's *metadata* is data; your project's *build* is still a program, deliberately, because compiling a C extension cannot be expressed as TOML. See **[02 · The frontend/backend split](02-pep-517-the-frontend-backend-split.md)** for the interface that boundary is drawn on.

## Gotchas

**★ A `pyproject.toml` with only `[tool.ruff]` in it does not make your directory a Python project.** Linters, formatters and type checkers read `[tool.*]` and never look at `[project]`. A repository with a `pyproject.toml` containing nothing but tool config is *configured* but not *installable* — `pip install .` in it falls through to the legacy path, and if there is no `setup.py` either, there is nothing for a backend to build. The fix is to add the two tables that make it a distribution:

```toml
[build-system]
requires = ["hatchling >= 1.26"]
build-backend = "hatchling.build"

[project]
name = "invoice-service"
version = "0.1.0"
```

**★ Adding `[build-system]` to an old project changes the build even if you change nothing else.** Before, `pip` ran your `setup.py` in the ambient environment, so imports at the top of `setup.py` resolved against whatever happened to be installed. After, `pip` builds in an isolated environment containing only what `requires` lists — pip's own reference is explicit that it *"will install build-time Python dependencies in a temporary directory."* An import your `setup.py` relied on and never declared now fails. The fix is to declare it, not to disable isolation:

```toml
[build-system]
requires = ["setuptools >= 77.0.3", "numpy >= 1.26", "Cython >= 3.0"]
build-backend = "setuptools.build_meta"
```

**★ `[build-system] requires` is not your project's dependencies, and putting runtime dependencies there installs them nowhere.** `requires` is what must exist for the *build* to run; `[project] dependencies` is what must exist for the *installed package* to run. They overlap only for things like `numpy` in a compiled extension, which is genuinely needed at both times and must be listed in both places.

**★ TOML strings are not Python strings, and `\` bites on Windows paths.** A basic TOML string processes backslash escapes, so `path = "C:\Users\build"` is either an error or wrong. Use a literal string (single quotes), which processes nothing:

```toml
[tool.mypy]
cache_dir = 'C:\Users\build\.mypy_cache'
```

**★ TOML has no `None`, and an empty string is not "unset".** `description = ""` publishes an empty summary; omitting the key entirely leaves the field absent from the metadata. These are different outcomes on PyPI. If you do not have a value, delete the key.

**★ A duplicated table is a parse error, not a merge.** Writing `[project.optional-dependencies]` twice in one file — easy when the file is long and you add a section at the bottom — fails TOML parsing before any packaging tool sees it. Python's own `tomllib` raises `TOMLDecodeError` on the second definition. Keep one table per header and put the keys together.

**★ The file must be in the project root, next to the directory you are building from.** Build frontends look for `pyproject.toml` in the directory they are pointed at. A `pyproject.toml` inside `src/` is invisible to `pip install .` run from the repository root, and the failure looks like "this project has no build system" rather than "your file is in the wrong place".

## Interview questions

**★ Why did Python packaging need a new file at all, rather than a new keyword in `setup.py`?**
Because the problem was not which keywords `setup.py` supported — it was that reading any of them required executing the file. A new keyword is still inside the code, so a tool still needs an interpreter, an environment, and the file's own dependencies installed before it can learn anything. PEP 518 describes this as a catch-22: the file is not runnable without knowing its contents, and its contents cannot be known without running it. The only way out is a second file that is *data*, sitting outside the code, readable by a parser. That is why `pyproject.toml` had to be a new file and had to be a non-executable format.

**★ What actually goes wrong if metadata is computed at build time on the developer's machine?**
The metadata stops being a property of the project and becomes a property of the machine that built it. A `setup.py` that writes `install_requires=["pywin32"] if sys.platform == "win32" else []` produces a wheel whose dependency list is correct for exactly one platform, and there is nothing in the artifact recording that it was conditional. The declarative replacement is an environment marker inside a static string — `"pywin32; sys_platform == 'win32'"` — which ships the *condition* rather than the *result*, so the installer evaluates it on the target machine instead of the build machine.

**★ Why was TOML chosen over YAML, given that YAML is more widely used in CI config?**
PEP 518 rejects YAML for exactly one reason, stated in the PEP: it is *"overly complex."* Complexity here is not aesthetic — YAML's specification is large enough that different implementations disagree on edge cases (the classic being unquoted scalars that parse as booleans or dates). A packaging file is read by pip, uv, hatch, poetry, ruff, mypy and pytest, in at least two languages; a format where those readers could disagree about what the file says would be worse than no standard. TOML's smaller grammar makes cross-implementation agreement cheap.

**★ `pyproject.toml` exists, so is `setup.py` dead?**
No, and conflating the two is the common error. `pyproject.toml` replaced `setup.py` as a *metadata* file. It did not replace it as a *build script*, because a build genuinely can need to run code — compile C, generate a parser, embed a git hash. What changed is that `setup.py` is no longer the interface: a backend is, and `setup.py` is one backend's input file. setuptools' own documentation still describes adding *"a simple `setup.py` script … (while keeping the configuration in `pyproject.toml`)"* for compatibility with tools that do not support PEP 517 or PEP 660. See **[14 · What still needs setup.py](14-what-still-needs-setup-py.md)**.

**★ Which of the three tables is standardised by whom, and why does the distinction matter?**
`[build-system]` comes from PEP 518 (the `requires` key) and PEP 517 (the `build-backend` key), and is read by *frontends* — pip, `build`, uv. `[project]` comes from PEP 621 and is read by *backends*, which turn it into core metadata inside the built distribution. `[tool.*]` comes from PEP 518 and is read by whichever tool owns the subtable. The distinction matters because it tells you who to blame: a bad `[build-system]` is a frontend failure before your code is touched, a bad `[project]` is a backend failure during the build, and a bad `[tool.x]` is only ever tool `x`'s problem and cannot break an install.

**★ Why can't a tool add its own key to `[project]` if it would be useful?**
PEP 621 forbids it outright — *"No tools may add fields to this table which are not defined by this PEP or subsequent PEPs."* The reason is that `[project]` maps onto core metadata, which is a published, versioned wire format read by installers that have never heard of your tool. An unknown key in `[project]` is not extensibility; it is metadata that some backends will silently drop and others will reject, with no way for a reader to tell which happened. `[tool]` is the extension point precisely because nothing downstream interprets it.

---

← Prev: [Topic index](README.md) · Next → [02 · The frontend/backend split](02-pep-517-the-frontend-backend-split.md)
