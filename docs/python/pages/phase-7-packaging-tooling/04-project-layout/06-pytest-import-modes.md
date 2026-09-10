---
title: "pytest's default prepend import mode edits sys.path itself — and in a flat layout it will put the repository root there for you if tests/ is a package or a conftest.py sits in the root, whatever command you used"
sidebar_label: "06 · pytest import modes"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 · target **Python 3.14.7** · against pytest *pytest import mechanisms and `sys.path`/`PYTHONPATH`* ([docs.pytest.org](https://docs.pytest.org/en/stable/explanation/pythonpath.html)), pytest *Good Integration Practices* ([docs.pytest.org](https://docs.pytest.org/en/stable/explanation/goodpractices.html)), pytest *Configuration* ([docs.pytest.org](https://docs.pytest.org/en/stable/reference/customize.html)) and the *API reference* confvals ([docs.pytest.org](https://docs.pytest.org/en/stable/reference/reference.html)). pytest's stable docs are the **9.x** line (they document `pytest.toml` as *versionadded 9.0*).
> Documentation-validated — **no sandbox run, no program output**.

**[02](02-sys-path-zero.md) showed that `pytest` and `python -m pytest` differ by one `sys.path` entry. That is only half of it: in its default `prepend` mode, pytest inserts directories into `sys.path` itself, in order to import your test files and `conftest.py` files under a stable name. Which directory it inserts depends on where the nearest directory *without* an `__init__.py` is — and in a flat project, two innocent-looking files, a `tests/__init__.py` or a `conftest.py` in the root, make that directory the repository root. From then on the checkout beats the installed package no matter how pytest was launched. This chunk traces the algorithm, shows the four routes by which the root reaches `sys.path`, and covers `append` and `importlib` as the alternatives.**

## `prepend`, the default

> *"`prepend` (default): The directory path containing each module will be inserted into the beginning of `sys.path` if not already there, and then imported with the `importlib.import_module` function."*

> *"This is the classic mechanism, dating back from the time Python 2 was still supported."*

"The directory path containing each module" is not the test file's directory. pytest first works out which directory to treat as the import root:

> *"determine `basedir`: this is the first "upward" (towards the root) directory not containing an `__init__.py`. If e.g. both `a` and `b` contain an `__init__.py` file then the parent directory of `a` will become the `basedir`."*
> *"perform `sys.path.insert(0, basedir)` to make the test module importable under the fully qualified import name."*
> *"`import a.b.test_module` where the path is determined by converting path separators `/` into "." characters. This means you must follow the convention of having directory and file names map directly to the import names."*

And why it bothers:

> *"The reason for this somewhat evolved importing technique is that in larger projects multiple test modules might import from each other and thus deriving a canonical import name helps to avoid surprises such as a test module getting imported twice."*

### The two cases, verbatim

With `__init__.py` files — *packaged tests*:

> *"pytest will find `foo/bar/tests/test_foo.py` and realize it is part of a package given that there's an `__init__.py` file in the same directory. It will then search upwards until it can find the last directory which still contains an `__init__.py` file in order to find the package root (in this case `foo/`). To load the module, it will insert `root/` to the front of `sys.path` (if not there already) in order to load `test_foo.py` as the module `foo.bar.tests.test_foo`."*

> *"The same logic applies to the `conftest.py` file: it will be imported as `foo.conftest` module."*

Without them — *standalone tests*:

> *"pytest will find `foo/bar/tests/test_foo.py` and realize it is NOT part of a package given that there's no `__init__.py` file in the same directory. It will then add `root/foo/bar/tests` to `sys.path` in order to import `test_foo.py` as the module `test_foo`. The same is done with the `conftest.py` file by adding `root/foo` to `sys.path` to import it as `conftest`."*

> *"For this reason this layout cannot have test modules with the same name, as they all will be imported in the global import namespace."*

The last sentence of the standalone case is the one that matters for layout: **a `conftest.py` gets its own directory inserted too.** A `conftest.py` in the repository root means the repository root is inserted.

## Four routes to the repository root

For a flat project, any one of these puts `./invoice_service/` ahead of site-packages:

| Route | Why the root lands on `sys.path` |
|---|---|
| `python -m pytest` | the interpreter prepends the working directory ([02](02-sys-path-zero.md)) |
| `tests/__init__.py` | `tests/` is a package, so `basedir` is its parent — the root |
| a `conftest.py` in the root | pytest inserts the conftest's own directory to import it as `conftest` |
| `pythonpath = ["."]` in the pytest config | the confval adds it explicitly, relative to `rootdir` |

A flat project avoids the wrong copy only if *none* of the four applies — plain `pytest`, a `tests/` directory with no `__init__.py`, no root `conftest.py`, and no `pythonpath` entry for the root. That is four independent conditions, any of which a well-meaning change can flip. In a src layout all four still happen and none of them matters, because the root contains no package.

```text
invoice-service/                  flat — conftest.py in the root
├── conftest.py                   ← pytest inserts invoice-service/ to import this
├── invoice_service/              ← …so this now wins over site-packages
└── tests/
    └── test_core.py
```

```text
invoice-service/                  src — the same conftest.py, harmless
├── conftest.py                   ← pytest inserts invoice-service/
├── src/
│   └── invoice_service/          ← not in the inserted directory
└── tests/
    └── test_core.py
```

## `append`

> *"`append`: the directory containing each module is appended to the end of `sys.path` if not already there, and imported with `importlib.import_module`."*

> *"This better allows users to run test modules against installed versions of a package even if the package under test has the same import root."*

> *"the tests will run against the installed version of `pkg_under_test` when `--import-mode=append` is used whereas with `prepend`, they would pick up the local version. This kind of confusion is why we advocate for using src-layouts."*

> *"Same as `prepend`, requires test module names to be unique when the test directory tree is not arranged in packages, because the modules will be put in `sys.modules` after importing."*

`append` is a patch for flat projects: pytest's own inserts go to the end, so site-packages is searched first. It does nothing about the interpreter's own entry — `python -m pytest --import-mode=append` still has the working directory at `sys.path[0]`.

## `importlib`

> *"`importlib`: this mode uses more fine control mechanisms provided by `importlib` to import test modules, without changing `sys.path`."*

Advantages, verbatim: *"pytest will not change `sys.path` at all."* · *"Test module names do not need to be unique -- pytest will generate a unique name automatically based on the `rootdir`."*

Disadvantages, verbatim: *"Test modules can't import each other."* · *"Testing utility modules in the tests directories (for example a `tests.helpers` module containing test-related functions/classes) are not importable. The recommendation in this case is to place testing utility modules together with the application/library code, for example `app.testing.helpers`."*

> *"Because Python requires the module to also be available in `sys.modules`, pytest derives a unique name for it based on its relative location from the `rootdir`, and adds the module to `sys.modules`."*

It arrived in pytest 6.0. pytest recommends it for new projects, and has also decided not to make it the default:

> *"For new projects, we recommend to use `importlib` import mode (see which-import-mode for a detailed explanation)."*

> *"Initially we intended to make `importlib` the default in future releases, however it is clear now that it has its own set of drawbacks so the default will remain `prepend` for the foreseeable future."*

```toml
[tool.pytest.ini_options]
addopts = ["--import-mode=importlib"]
testpaths = ["tests"]
```

`importlib` removes pytest's inserts only. The interpreter's own entry still applies, so `python -m pytest --import-mode=importlib` in a flat project still imports the checkout; plain `pytest` or `python -P -m pytest` is needed as well.

## Choosing

| Layout | Import mode | Result |
|---|---|---|
| src | `prepend` (default) | installed copy in every invocation; `tests/__init__.py` optional |
| src | `importlib` | installed copy; unique names not required; helpers must live in the package |
| flat | `prepend` | depends on the four routes above — fragile |
| flat | `append` | installed copy for pytest's own inserts; `python -m` still wins for the checkout |
| flat | `importlib` | installed copy only with plain `pytest` or `-P`, and no `pythonpath` entry for the root |

pytest's own summary of the whole table is one sentence from *Good Integration Practices*: *"Generally, but especially if you use the default import mode `prepend`, it is **strongly** suggested to use a `src` layout."*

## Gotchas

**★ Symptom: a flat project's tests started importing the checkout the day someone added a root `conftest.py`.** Cause: in `prepend` mode pytest inserts the directory of each `conftest.py` it imports — for a root `conftest.py`, the repository root. Fix: move shared fixtures into `tests/conftest.py`, or move the package under `src/`.

```bash
git mv conftest.py tests/conftest.py
```

**★ Symptom: `python -m pytest --import-mode=importlib` still imports the checkout.** Cause: `importlib` stops *pytest* changing `sys.path`; the interpreter still prepends the working directory for `-m`. Fix: drop the `-m`, or add `-P`.

```bash
python -P -m pytest --import-mode=importlib
```

**★ Symptom: after switching to `importlib`, one test module fails to import another.** Cause: *"Test modules can't import each other."* Fix: extract the shared code into the package or a fixture.

```python
# src/invoice_service/testing/builders.py
def build_line_items(count: int) -> list[dict[str, int]]:
    return [{"line": number, "cents": 1000} for number in range(1, count + 1)]
```

**Symptom: a test module is apparently imported twice, and module-level state resets mid-run.** Cause: two different `sys.path` entries let the same file be imported under two names — the case pytest's canonical naming in `prepend` mode exists to avoid, reintroduced by an extra `pythonpath` entry or a manual `sys.path` insert. Fix: remove the extra entry, or use `importlib` mode, which does not touch `sys.path`.

```toml
[tool.pytest.ini_options]
addopts = ["--import-mode=importlib"]
```

**Symptom: a test directory's name is not a valid identifier — `tests/integration-v2/` — and packaged-test imports fail.** Cause: in `prepend` mode with `__init__.py` files, *"directory and file names map directly to the import names"*, and a hyphen is not legal in one. Fix: rename to an identifier.

```bash
git mv tests/integration-v2 tests/integration_v2
```

**Symptom: `--import-mode=append` did not stop the checkout being imported.** Cause: `append` moves only pytest's inserts; `python -m` still puts the working directory first, and a root on `sys.path` from any other route stays where it is. Fix: `append` plus plain `pytest`, or — the actual fix — a src layout.

```bash
pytest --import-mode=append
```

**Symptom: a `tests/__init__.py` was deleted to "fix" the wrong copy, and now two test files collide.** Cause: removing the package makes basenames global again. Fix: keep the packages and move to a src layout, or switch to `importlib`, where *"Test module names do not need to be unique"*.

```toml
[tool.pytest.ini_options]
addopts = ["--import-mode=importlib"]
```

## Interview questions

**★ How does pytest's `prepend` mode decide what to put on `sys.path`?**
For each test file it walks upward to find the first directory that does *not* contain an `__init__.py` — the `basedir` — and inserts that at the front of `sys.path`, then imports the file by the dotted path from there. With no `__init__.py` next to the test, that is the test's own directory and the module is imported as a top-level name. With `__init__.py` all the way up, it is the parent of the top package. `conftest.py` files get the same treatment, which is why a root `conftest.py` inserts the root.

**★ Why does pytest recommend a src layout "especially" with `prepend` mode?**
Because `prepend` inserts directories at the front of `sys.path`, and several ordinary configurations make one of them the repository root: a `tests/__init__.py`, a root `conftest.py`, or a `pythonpath` entry — on top of `python -m` doing it anyway. In a flat project any of those makes the checkout shadow the installation. In a src layout the root has no package in it, so the inserts are harmless.

**What are the trade-offs of `importlib` mode?**
It does not modify `sys.path`, so it cannot be the cause of a wrong-copy import, and test files need not have unique names because pytest derives module names from their location relative to `rootdir`. In exchange, test modules cannot import one another and helper modules inside `tests/` are not importable; pytest suggests moving helpers into the package. pytest recommends it for new projects but has decided to keep `prepend` as the default.

**Why doesn't `--import-mode=importlib` alone make a flat project safe?**
Because it controls only what pytest does. The interpreter's own `sys.path[0]` — the working directory for `python -m` — is set before pytest runs. `python -m pytest --import-mode=importlib` from the root of a flat project still imports the checkout. You also need plain `pytest` or `-P`.

**What does `append` mode change, and who is it for?**
It puts pytest's inserted directories at the end of `sys.path` rather than the front, so installed packages are found first. pytest describes it as letting tests run against installed versions *"even if the package under test has the same import root"* — which is to say, a flat project. It still requires unique names without packages, and it does not remove the working directory `python -m` adds.

**For `tests/unit/test_invoices.py` with no `__init__.py` anywhere, what does `prepend` insert and what is the module called?**
The first directory upward that lacks an `__init__.py` is the test file's own directory, `tests/unit/`, so that is inserted at the front of `sys.path` and the file is imported as the top-level module `test_invoices`. A second `test_invoices.py` in `tests/api/` would be imported under the same top-level name, which is why pytest requires unique basenames in this arrangement. Add `__init__.py` to `tests/` and `tests/unit/`, and the `basedir` becomes the repository root and the name becomes `tests.unit.test_invoices`.

**Why does pytest insert a `conftest.py`'s directory at all?**
Because a `conftest.py` is imported as a module like any other, and in `prepend` mode pytest makes modules importable by putting their `basedir` on `sys.path`. A standalone `conftest.py` is imported as the top-level module `conftest` after its directory is inserted. The side effect is incidental to pytest's purpose and central to this topic: a root `conftest.py` puts the repository root on `sys.path`.

---

← Prev: [05 · Where tests live](05-where-tests-live.md) · [Topic index](README.md) · Next → [06b · rootdir and pythonpath](06b-rootdir-and-pythonpath.md)
