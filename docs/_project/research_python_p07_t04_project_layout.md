---
name: research-python-p07-t04-project-layout
description: Banked primary-source research for devbible Python Phase 7 topic 04 (Project layout — src vs flat, tests, root files, workspaces, package discovery). Every load-bearing sentence quoted verbatim with its URL. DO NOT RE-DERIVE.
metadata:
  type: research
  track: python
  topic: phase-7 / 04-project-layout
  banked: 2026-09-10
---

# 🔴 DO NOT RE-DERIVE — research bank, Python Phase 7 topic 04 · Project layout

Fetched **2026-09-10** in one pass, for the whole topic. Every chunk of
`docs/python/pages/phase-7-packaging-tooling/04-project-layout/` was written from this
file. A later session revalidating the topic should re-check only the load-bearing
claims listed under **§10 Uncertain**, not re-fetch the whole set.

## Version spine (given as fact by the coordinator; not re-fetched)

- **Python 3.14.7** (released 2026-08-05) ← this topic's pin
- **uv 0.12.12** (2026-09-09)
- **ruff 0.16.6** (2026-09-03)
- **pre-commit 4.6.2** (2026-08-10)

Also observed while fetching (NOT in the spine, cited as documentation state only):
pytest's stable docs document `pytest.toml` and `[tool.pytest]` as
`.. versionadded:: 9.0`, so pytest 9.x is the current stable line. `[tool.pytest.ini_options]`
remains documented as supported "since pytest 6.0" and is what the pages use.

---

## §1 · PyPUG — *src layout vs flat layout*

Source: <https://packaging.python.org/en/latest/discussions/src-layout-vs-flat-layout/>
(raw: `pypa/packaging.python.org/source/discussions/src-layout-vs-flat-layout.rst`)

> *"The "flat layout" refers to organising a project's files in a folder or repository, such that the various configuration files and import packages are all in the top-level directory."*

> *"The "src layout" deviates from the flat layout by moving the code that is intended to be importable (i.e. `import awesome_package`, also known as import packages) into a subdirectory. This subdirectory is typically named `src/`, hence "src layout"."*

Flat diagram (verbatim):

```
.
├── README.md
├── noxfile.py
├── pyproject.toml
├── setup.py
├── awesome_package/
│   ├── __init__.py
│   └── module.py
└── tools/
    ├── generate_awesomeness.py
    └── decrease_world_suck.py
```

Src diagram (verbatim):

```
.
├── README.md
├── noxfile.py
├── pyproject.toml
├── setup.py
├── src/
│    └── awesome_package/
│       ├── __init__.py
│       └── module.py
└── tools/
    ├── generate_awesomeness.py
    └── decrease_world_suck.py
```

The four behaviour differences, verbatim:

> *"The src layout requires installation of the project to be able to run its code, and the flat layout does not."*

> *"This means that the src layout involves an additional step in the development workflow of a project (typically, an editable installation is used for development and a regular installation is used for testing)."*

> *"The src layout helps prevent accidental usage of the in-development copy of the code."*

> *"This is relevant since the Python interpreter includes the current working directory as the first item on the import path. This means that if an import package exists in the current working directory with the same name as an installed import package, the variant from the current working directory will be used. This can lead to subtle misconfiguration of the project's packaging tooling, which could result in files not being included in a distribution."*

> *"The src layout helps avoid this by keeping import packages in a directory separate from the root directory of the project, ensuring that the installed copy is used."*

> *"The src layout helps enforce that an editable installation is only able to import files that were meant to be importable."*

> *"This is especially relevant when the editable installation is implemented using a path configuration file that adds the directory to the import path."*

> *"The flat layout would add the other project files (eg: `README.md`, `tox.ini`) and packaging/tooling configuration files (eg: `setup.py`, `noxfile.py`) on the import path. This would make certain imports work in editable installations but not regular installations."*

Running a CLI from source, verbatim:

> *"Due to the firstly mentioned specialty of the src layout, a command-line interface can not be run directly from the source tree, but requires installation of the package in Development Mode for testing purposes. Since this can be unpractical in some situations, a workaround could be to prepend the package folder to Python's `sys.path` when called via its `__main__.py` file:"*

```python
import os
import sys

if not __package__:
    # Make CLI runnable from source tree with
    #    python src/package
    package_source_path = os.path.dirname(os.path.dirname(__file__))
    sys.path.insert(0, package_source_path)
```

---

## §2 · CPython — `sys.path` and the command line

Source: <https://docs.python.org/3.14/library/sys.html#sys.path>

> *"A list of strings that specifies the search path for modules. Initialized from the environment variable `PYTHONPATH`, plus an installation-dependent default."*

> *"By default, as initialized upon program startup, a potentially unsafe path is prepended to `sys.path` (before the entries inserted as a result of `PYTHONPATH`):"*
> *"`python -m module` command line: prepend the current working directory."*
> *"`python script.py` command line: prepend the script's directory. If it's a symbolic link, resolve symbolic links."*
> *"`python -c code` and `python` (REPL) command lines: prepend an empty string, which means the current working directory."*

> *"To not prepend this potentially unsafe path, use the `-P` command line option or the `PYTHONSAFEPATH` environment variable."*

> *"A program is free to modify this list for its own purposes. Only strings should be added to `sys.path`; all other data types are ignored during import."*

Source: <https://docs.python.org/3.14/using/cmdline.html>

`-P`:
> *"Don't prepend a potentially unsafe path to `sys.path`"* — with the same three bullets, negated.

`PYTHONSAFEPATH`:
> *"If this is set to a non-empty string, don't prepend a potentially unsafe path to `sys.path`: see the `-P` option for details."*

Script file:
> *"If the script name refers directly to a Python file, the directory containing that file is added to the start of `sys.path`, and the file is executed as the `__main__` module."*

`-c`:
> *"If this option is given, the first element of `sys.argv` will be `"-c"` and the current directory will be added to the start of `sys.path` (allowing modules in that directory to be imported as top level modules)."*

`-m`:
> *"As with the `-c` option, the current directory will be added to the start of `sys.path`."*

`-I` (isolated mode):
> *"Run Python in isolated mode. This also implies `-E`, `-P` and `-s` options."*
> *"In isolated mode `sys.path` contains neither the script's directory nor the user's site-packages directory. All `PYTHON*` environment variables are ignored, too."*

---

## §3 · CPython — the import system

Source: <https://docs.python.org/3.14/reference/import.html>

> *"A regular package is typically implemented as a directory containing an `__init__.py` file. When a regular package is imported, this `__init__.py` file is implicitly executed, and the objects it defines are bound to names in the package's namespace."*

> *"A namespace package is a composite of various portions, where each portion contributes a subpackage to the parent package."*

> *"With namespace packages, there is no `parent/__init__.py` file."*

> *"The `__path__` attribute should be a (possibly empty) sequence of strings enumerating the locations where the package's submodules will be found. By definition, if a module has a `__path__` attribute, it is a package."*

> *"The first place checked during import search is `sys.modules`. This mapping serves as a cache of all modules that have been previously imported, including the intermediate paths."*

> *"The path based finder iterates over every entry in the search path"* — using `sys.path` for top-level imports, checking each entry in order until a match is found.

---

## §4 · pytest — test layout (*Good Integration Practices*)

Source: <https://docs.pytest.org/en/stable/explanation/goodpractices.html>
(raw: `pytest-dev/pytest/doc/en/explanation/goodpractices.rst`)

Tests outside application code, verbatim diagram:

```
pyproject.toml
src/
    mypkg/
        __init__.py
        app.py
        view.py
tests/
    test_app.py
    test_view.py
    ...
```

> *"This has the following benefits:"*
> *"Your tests can run against an installed version after executing `pip install .`."*
> *"Your tests can run against the local copy with an editable install after executing `pip install --editable .`."*

> *"For new projects, we recommend to use `importlib` import mode (see which-import-mode for a detailed explanation)."*

> *"Generally, but especially if you use the default import mode `prepend`, it is **strongly** suggested to use a `src` layout. Here, your application root package resides in a sub-directory of your root, i.e. `src/mypkg/` instead of `mypkg`."*

> *"This layout prevents a lot of common pitfalls and has many benefits, which are better explained in this excellent blog post by Ionel Cristian Mărieș."*

Note (no editable install + src layout):
> *"If you do not use an editable install and use the `src` layout as above you need to extend the Python's search path for module files to execute the tests against the local copy directly. You can do it in an ad-hoc manner by setting the `PYTHONPATH` environment variable:"* → `PYTHONPATH=src pytest`, *"or in a permanent manner by using the `pythonpath` configuration variable"*.

Note (no editable install + flat layout):
> *"If you do not use an editable install and do not use the `src` layout (`mypkg` directly in the root directory) you can rely on the fact that Python by default puts the current directory in `sys.path` to import your package and run `python -m pytest` to execute the tests against the local copy directly."*

Tests as part of application code, verbatim diagram:

```
pyproject.toml
[src/]mypkg/
    __init__.py
    app.py
    view.py
    tests/
        __init__.py
        test_app.py
        test_view.py
        ...
```

> *"Inlining test directories into your application package is useful if you have direct relation between tests and application modules and want to distribute them along with your application"*

> *"In this scheme, it is easy to run your tests using the `--pyargs` option"* → `pytest --pyargs mypkg`
> *"`pytest` will discover where `mypkg` is installed and collect tests from there."*
> *"Note that this layout also works in conjunction with the `src` layout mentioned in the previous section."*

> *"You can use namespace packages (PEP420) for your application but pytest will still perform test package name discovery based on the presence of `__init__.py` files. If you use one of the two recommended file system layouts above but leave away the `__init__.py` files from your directories, it should just work. From "inlined tests", however, you will need to use absolute imports for getting at your application code."*

The `basedir` walk, verbatim:
> *"In `prepend` and `append` import-modes, if pytest finds a `"a/b/test_module.py"` test file while recursing into the filesystem it determines the import name as follows:"*
> *"determine `basedir`: this is the first "upward" (towards the root) directory not containing an `__init__.py`. If e.g. both `a` and `b` contain an `__init__.py` file then the parent directory of `a` will become the `basedir`."*
> *"perform `sys.path.insert(0, basedir)` to make the test module importable under the fully qualified import name."*
> *"`import a.b.test_module` where the path is determined by converting path separators `/` into "." characters. This means you must follow the convention of having directory and file names map directly to the import names."*
> *"The reason for this somewhat evolved importing technique is that in larger projects multiple test modules might import from each other and thus deriving a canonical import name helps to avoid surprises such as a test module getting imported twice."*
> *"With `--import-mode=importlib` things are less convoluted because pytest doesn't need to change `sys.path`, making things much less surprising."*

Choosing an import mode, verbatim:
> *"For historical reasons, pytest defaults to the `prepend` import mode instead of the `importlib` import mode we recommend for new projects."*
> *"Since there are no packages to derive a full package name from, `pytest` will import your test files as top-level modules. The test files in the first example (src layout) would be imported as `test_app` and `test_view` top-level modules by adding `tests/` to `sys.path`."*
> *"This results in a drawback compared to the import mode `importlib`: your test files must have **unique names**."*
> *"If you need to have test modules with the same name, as a workaround you might add `__init__.py` files to your `tests` directory and subdirectories, changing them to packages"*
> *"Now pytest will load the modules as `tests.foo.test_view` and `tests.bar.test_view`, allowing you to have modules with the same name. But now this introduces a subtle problem: in order to load the test modules from the `tests` directory, pytest prepends the root of the repository to `sys.path`, which adds the side-effect that now `mypkg` is also importable."*
> *"This is problematic if you are using a tool like tox to test your package in a virtual environment, because you want to test the installed version of your package, not the local code from the repository."*
> *"The `importlib` import mode does not have any of the drawbacks above, because `sys.path` is not changed when importing test modules."*

tox section, verbatim:
> *"It will run tests against the installed package and not against your source code checkout, helping to detect packaging glitches."*

---

## §5 · pytest — import modes and `sys.path`

Source: <https://docs.pytest.org/en/stable/explanation/pythonpath.html>
(raw: `pytest-dev/pytest/doc/en/explanation/pythonpath.rst`)

> *"`prepend` (default): The directory path containing each module will be inserted into the beginning of `sys.path` if not already there, and then imported with the `importlib.import_module` function."*
> *"It is highly recommended to arrange your test modules as packages by adding `__init__.py` files to your directories containing tests. This will make the tests part of a proper Python package, allowing pytest to resolve their full name (for example `tests.core.test_core` for `test_core.py` inside the `tests.core` package)."*
> *"If the test directory tree is not arranged as packages, then each test file needs to have a unique name compared to the other test files, otherwise pytest will raise an error if it finds two tests with the same name."*
> *"This is the classic mechanism, dating back from the time Python 2 was still supported."*

> *"`append`: the directory containing each module is appended to the end of `sys.path` if not already there, and imported with `importlib.import_module`."*
> *"This better allows users to run test modules against installed versions of a package even if the package under test has the same import root."*
> *"the tests will run against the installed version of `pkg_under_test` when `--import-mode=append` is used whereas with `prepend`, they would pick up the local version. This kind of confusion is why we advocate for using src-layouts."*
> *"Same as `prepend`, requires test module names to be unique when the test directory tree is not arranged in packages, because the modules will be put in `sys.modules` after importing."*

> *"`importlib`: this mode uses more fine control mechanisms provided by `importlib` to import test modules, without changing `sys.path`."*
> Advantages: *"pytest will not change `sys.path` at all."* · *"Test module names do not need to be unique -- pytest will generate a unique name automatically based on the `rootdir`."*
> Disadvantages: *"Test modules can't import each other."* · *"Testing utility modules in the tests directories (for example a `tests.helpers` module containing test-related functions/classes) are not importable. The recommendation in this case is to place testing utility modules together with the application/library code, for example `app.testing.helpers`."*
> *"Important: by "test utility modules", we mean functions/classes which are imported by other tests directly; this does not include fixtures, which should be placed in `conftest.py` files, along with the test modules, and are discovered automatically by pytest."*
> *"Because Python requires the module to also be available in `sys.modules`, pytest derives a unique name for it based on its relative location from the `rootdir`, and adds the module to `sys.modules`."*
> `.. versionadded:: 6.0`

> *"Initially we intended to make `importlib` the default in future releases, however it is clear now that it has its own set of drawbacks so the default will remain `prepend` for the foreseeable future."*

> *"By default, pytest will not attempt to resolve namespace packages automatically, but that can be changed via the `consider_namespace_packages` configuration variable."*

Packaged tests, verbatim:
> *"pytest will find `foo/bar/tests/test_foo.py` and realize it is part of a package given that there's an `__init__.py` file in the same directory. It will then search upwards until it can find the last directory which still contains an `__init__.py` file in order to find the package root (in this case `foo/`). To load the module, it will insert `root/` to the front of `sys.path` (if not there already) in order to load `test_foo.py` as the module `foo.bar.tests.test_foo`."*
> *"The same logic applies to the `conftest.py` file: it will be imported as `foo.conftest` module."*

Standalone tests, verbatim:
> *"pytest will find `foo/bar/tests/test_foo.py` and realize it is NOT part of a package given that there's no `__init__.py` file in the same directory. It will then add `root/foo/bar/tests` to `sys.path` in order to import `test_foo.py` as the module `test_foo`. The same is done with the `conftest.py` file by adding `root/foo` to `sys.path` to import it as `conftest`."*
> *"For this reason this layout cannot have test modules with the same name, as they all will be imported in the global import namespace."*

`pytest` vs `python -m pytest`, verbatim:
> *"Running pytest with `pytest [...]` instead of `python -m pytest [...]` yields nearly equivalent behaviour, except that the latter will add the current directory to `sys.path`, which is standard `python` behavior."*

---

## §6 · pytest — `rootdir`, config files, confvals

Source: <https://docs.pytest.org/en/stable/reference/customize.html>

> *"`rootdir` is **NOT** used to modify `sys.path`/`PYTHONPATH` or influence how modules are imported."*

> *"Construct nodeids during collection; each test is assigned a unique nodeid which is rooted at the `rootdir`"*
> *"Is used by plugins as a stable location to store project/test run specific information; for example, the internal cache plugin creates a `.pytest_cache` subdirectory in `rootdir` to store its cross-test run state."*

Finding the rootdir, verbatim:
> *"If `-c` is passed in the command-line, use that as configuration file, and its directory as `rootdir`."*
> *"Determine the common ancestor directory for the specified `args` that are recognised as paths that exist in the file system. If no such paths are found, the common ancestor directory is set to the current working directory."*
> *"Look for `pytest.toml`, `.pytest.toml`, `pytest.ini`, `.pytest.ini`, `pyproject.toml`, `tox.ini`, and `setup.cfg` files in the ancestor directory and upwards. If one is matched, it becomes the `configfile` and its directory becomes the `rootdir`."*
> *"If no configuration file was found, look for `setup.py` upwards from the common ancestor directory to determine the `rootdir`."*
> *"If no `configfile` was found and no configuration argument is passed, use the already determined common ancestor as root directory."*

Config file forms, verbatim:
> `pytest.toml` — *"`.. versionadded:: 9.0`"* · *"`pytest.toml` files take precedence over other files, even when empty."*
> `pyproject.toml` — *"Use `[tool.pytest]` to leverage native TOML types (supported since pytest 9.0)"* · *"Use `[tool.pytest.ini_options]` for INI-style configuration (supported since pytest 6.0)"*
> `setup.cfg` — *"Usage of `setup.cfg` is not recommended unless for very simple use cases."*

Confvals (raw: `doc/en/reference/reference.rst`):

`pythonpath`, type `list[str]`:
> *"Sets list of directories that should be added to the python search path. Directories will be added to the head of `sys.path`. Similar to the `PYTHONPATH` environment variable, the directories will be included in where Python will look for imported modules. Paths are relative to the `rootdir` directory. Directories remain in path for the duration of the test session."*

`consider_namespace_packages`, type `bool`, default `false`:
> *"Controls if pytest should attempt to identify namespace packages when collecting Python modules."*
> *"Set to `True` if the package you are testing is part of a namespace package."*
> *"Only native namespace packages are supported, with no plans to support legacy namespace packages."*
> *"For best results when using `consider_namespace_packages`, pytest needs to be able to import your namespace packages. This is best achieved by installing the packages in your environment, most commonly in "editable" mode."*
> `.. versionadded:: 8.1`

`testpaths`, type `list[str]`:
> *"Sets list of directories that should be searched for tests when no specific directories, files or test ids are given in the command line when executing pytest from the `rootdir` directory."*
> *"Useful when all project tests are in a known location to speed up test collection and to avoid picking up undesired tests by accident."*

---

## §7 · setuptools — package discovery, editable installs, file selection

### 7a · Package discovery
Source: <https://setuptools.pypa.io/en/latest/userguide/package_discovery.html>
(raw: `pypa/setuptools/docs/userguide/package_discovery.rst`)

> *"By default `setuptools` will consider 2 popular project layouts, each one with its own set of advantages and disadvantages as discussed in the following sections."*
> *"Setuptools will automatically scan your project directory looking for these layouts and try to guess the correct values for the `packages` and `py_modules` configuration."*
> *"Automatic discovery will **only** be enabled if you **don't** provide any configuration for `packages` and `py_modules`. If at least one of them is explicitly set, automatic discovery will not take place."*
> *"**Note**: specifying `ext_modules` might also prevent auto-discover from taking place, unless your opt into `pyproject_config`"*

src-layout:
> *"The project should contain a `src` directory under the project root and all modules and packages meant for distribution are placed inside this directory"*
> *"This layout is very handy when you wish to use automatic discovery, since you don't have to worry about other Python files or folders in your project root being distributed by mistake. In some circumstances it can be also less error-prone for testing or when using PEP 420-style packages. On the other hand you cannot rely on the implicit `PYTHONPATH=.` to fire up the Python REPL and play with your package (you will need an editable install to be able to do that)."*

flat-layout (*"also known as "adhoc""*):
> *"The package folder(s) are placed directly under the project root"*
> *"This layout is very practical for using the REPL, but in some situations it can be more error-prone (e.g. during tests or if you have a bunch of folders or Python files hanging around your project root)."*
> *"To avoid confusion, file and folder names that are used by popular tools (or that correspond to well-known conventions, such as distributing documentation alongside the project code) are automatically filtered out in the case of flat-layout"*

`FlatLayoutPackageFinder.DEFAULT_EXCLUDE` (excluded **directories**), as rendered on the page:
`ci`, `bin`, `debian`, `doc`, `docs`, `documentation`, `manpages`, `news`, `newsfragments`, `changelog`, `test`, `tests`, `unit_test`, `unit_tests`, `example`, `examples`, `scripts`, `tools`, `util`, `utils`, `python`, `build`, `dist`, `venv`, `env`, `requirements`, `tasks`, `fabfile`, `site_scons`, `benchmark`, `benchmarks`, `exercise`, `exercises`, `htmlcov`, `[._]*`

`FlatLayoutModuleFinder.DEFAULT_EXCLUDE` (excluded top-level **modules**):
`setup`, `conftest`, `test`, `tests`, `example`, `examples`, `build`, `toxfile`, `noxfile`, `pavement`, `dodo`, `tasks`, `fabfile`, `[Ss][Cc]onstruct`, `conanfile`, `manage`, `benchmark`, `benchmarks`, `exercise`, `exercises`, `[._]*`

> *"If you are using auto-discovery with flat-layout, `setuptools` will refuse to create distribution archives with multiple top-level packages or modules."*
> *"This is done to prevent common errors such as accidentally publishing code not meant for distribution (e.g. maintenance-related scripts)."*
> *"Users that purposefully want to create multi-package distributions are advised to use custom-discovery or the `src-layout`."*

single-module distribution:
> *"A standalone module is placed directly under the project root, instead of inside a package folder"*

Custom discovery:
> *"If the automatic discovery does not work for you (e.g., you want to include in the distribution top-level packages with reserved names such as `tasks`, `example` or `docs`, or you want to exclude nested packages that would be otherwise included), you can use the provided tools for package discovery"*

```toml
[tool.setuptools.packages.find]
where = ["src"]
include = ["pkg*"]  # alternatively: `exclude = ["additional*"]`
namespaces = false
```

> *"When using `tool.setuptools.packages.find` in `pyproject.toml`, setuptools will consider implicit namespaces by default when scanning your project directory. To avoid `pkg.namespace` from being added to your package list you can set `namespaces = false`. This will prevent any folder without an `__init__.py` file from being scanned."*

> *"`include` and `exclude` accept strings representing glob patterns. These patterns should match the **full** name of the Python module (as if it was written in an `import` statement)."*
> *"For example if you have `util` pattern, it will match `util/__init__.py` but not `util/files/__init__.py`."*
> *"The fact that the parent package is matched by the pattern will not dictate if the submodule will be included or excluded from the distribution. You will need to explicitly add a wildcard (e.g. `util*`) if you want the pattern to also match submodules."*

`package-dir` (verbatim TOML):
```toml
[tool.setuptools]
package-dir = {"" = "src"}
```

> *"Although `setuptools` allows developers to create a very complex mapping between directory names and package names, it is better to keep it simple and reflect the desired package hierarchy in the directory structure, preserving the same names."*

### 7b · Controlling files in the distribution
Source: <https://setuptools.pypa.io/en/latest/userguide/miscellaneous.html>
(raw: `pypa/setuptools/docs/userguide/miscellaneous.rst`)

> *"the following files are included in a source distribution by default:"* — pure Python module files implied by `py-modules`/`packages`; C source files in `ext_modules`/`libraries`;
> *"Files that match the following glob patterns: `tests/test*.py`, `test/test*.py`"*;
> scripts; `package-data`/`data-files`; `license_file`; `license-files` —
> *"note that if you don't explicitly set this parameter, `setuptools` will include any files that match the following glob patterns: `LICEN[CS]E*`, `COPYING*`, `NOTICE*`, `AUTHORS**`"*;
> `pyproject.toml`; `setup.cfg`; `setup.py`; *"`README`, `README.txt`, `README.rst` or `README.md`"*; `MANIFEST.in`.

> *"Please note that the list above is guaranteed to work with the last stable version of `setuptools`. The behavior of older versions might differ."*

> *"`setuptools` will attempt to include type information files by default in the distribution (`.pyi` and `py.typed`, as specified in PEP 561), as long as they are contained inside of a package directory"* — `.. versionadded:: v69.0.0`, marked *"**EXPERIMENTAL**"*.

> *"if you need finer control over the files (e.g. you don't want to distribute CI/CD-related files) or you need automatically generated files, you can add a `MANIFEST.in` file at the root of your project, to specify any files that the default file location algorithm doesn't catch."*
> *"This file contains instructions that tell `setuptools` which files exactly should be part of the `sdist` (or not)."*
> *"Please note that `setuptools` supports the `MANIFEST.in`, and not `MANIFEST` (no extension)."*
> *"Commands are processed in the order they appear in the `MANIFEST.in` file."*

MANIFEST.in commands (verbatim table): `include`, `exclude`, `recursive-include`, `recursive-exclude`, `global-include`, `global-exclude`, `graft`, `prune`.

> *"Please note that, when using `include_package_data=True`, only files **inside the package directory** are included in the final `wheel`, by default."*
> *"So for example, if you create a Python project that uses `setuptools-scm` and have a `tests` directory outside of the package folder, the `tests` directory will be present in the `sdist` but not in the `wheel`."*

Footnotes, verbatim:
> *"You can think about the build process as two stages: first the `sdist` will be created and then the `wheel` will be produced from that `sdist`."*
> *"This happens because the `sdist` can contain files that are useful during development or the build process itself, but not in runtime (e.g. tests, docs, examples, etc...). The `wheel`, on the other hand, is a file format that has been optimized and is ready to be unpacked into a running installation of Python or Virtual Environment. Therefore it only contains items that are required during runtime."*

> *"Setuptools automatically creates a few directories to host build artefacts and cache files, such as `build`, `dist`, `*.egg-info`."*

### 7c · Development mode (editable installs)
Source: <https://setuptools.pypa.io/en/latest/userguide/development_mode.html>
(raw: `pypa/setuptools/docs/userguide/development_mode.rst`)

> *"An "editable installation" works very similarly to a regular install with `pip install .`, except that it only installs your package dependencies, metadata and wrappers for console and GUI scripts. Under the hood, setuptools will try to create a special `.pth` file in the target directory (usually `site-packages`) that extends the `PYTHONPATH` or install a custom import hook."*

> *"Please note that, by default an editable install will expose at least all the files that would be available in a regular installation. However, depending on the file and directory organization in your project, it might also expose as a side effect files that would not be normally available. This is allowed so you can iteratively create new Python modules."*

Strict mode:
> *"1. It should allow developers to add new files (or split/rename existing ones) and have them automatically exposed. 2. It should behave as close as possible to a regular installation and help users to detect problems (e.g. new files not being included in the distribution)."*
> *"Unfortunately these expectations are in conflict with each other."*
> `pip install -e . --config-settings editable_mode=strict`
> *"In this mode, new files **won't** be exposed and the editable installs will try to mimic as much as possible the behavior of a regular install. Under the hood, `setuptools` will create a tree of file links in an auxiliary directory (`$your_project_dir/build`) and add it to `PYTHONPATH` via a `.pth` file."*

Limitations, verbatim:
> *"The editable term is used to refer only to Python modules inside the package directories. Non-Python files, external (data) files, executable script files, binary extensions, headers and metadata may be exposed as a snapshot of the version they were at the moment of the installation."*
> *"Adding new dependencies, entry-points or changing your project's metadata require a fresh "editable" re-installation."*
> *"There is no guarantee that files outside the top-level package directory will be accessible after an editable install."*
> *"There is no guarantee that attributes like `__path__` or `__file__` will correspond to the exact location of the original files"*
> *"Support for PEP 420-style implicit namespace packages for projects structured using flat-layout is still **experimental**. If you experience problems, you can try converting your package structure to the src-layout."*
> *"File system entries in the current working directory whose names coincidentally match installed packages may take precedence in Python's import system. Users are encouraged to avoid such scenarios."* — footnote: *"Techniques like the src-layout or tooling-specific options like tox's changedir can be used to prevent such kinds of situations"*
> *"Editable installs are **not a perfect replacement for regular installs** in a test environment. When in doubt, please test your projects as installed via a regular wheel. There are tools in the Python ecosystem, like tox or nox, that can help you with that"*

Mechanisms, verbatim:
> *"A static `.pth` file can be added to one of the directories listed in `site.getsitepackages()` or `site.getusersitepackages()` to extend `sys.path`."*
> *"A directory containing a farm of file links that mimic the project structure and point to the original files can be employed. This directory can then be added to `sys.path` using a static `.pth` file."*
> *"A dynamic `.pth` file can also be used to install an "import finder" (`MetaPathFinder` or `PathEntryFinder`) that will hook into Python's import system machinery."*
> *"`Setuptools` offers **no guarantee** of which technique will be used to perform an editable installation."*

---

## §8 · hatchling — build config and default file selection

Source: <https://hatch.pypa.io/latest/config/build/>

> *"By default, Hatch will respect the first `.gitignore` or `.hgignore` file found in your project's root directory or parent directories."*
> *"include and exclude options to select exactly which files will be shipped in each build, with `exclude` taking precedence. Every entry represents a Git-style glob pattern."*
> *"You can use the `only-include` option to prevent directory traversal starting at the project root and only select specific relative paths to directories or files. Using this option ignores any defined `include` patterns."*
> *"The `packages` option is semantically equivalent to `only-include` (which takes precedence) except that the shipped path will be collapsed to only include the final component."*
> *"You can rewrite relative paths to directories with the `sources` option."*
> *"If no file selection options are provided, then what gets included is determined by each build target."*

```toml
[tool.hatch.build.targets.wheel]
packages = ["src/foo"]
```

Source: <https://hatch.pypa.io/latest/plugins/builder/wheel/> — default file selection heuristic, in order:
1. `<NAME>/__init__.py`
2. `src/<NAME>/__init__.py`
3. `<NAME>.py`
4. `<NAMESPACE>/<NAME>/__init__.py`

> *"If none of these heuristics are satisfied, an error will be raised."*

Source: <https://hatch.pypa.io/latest/plugins/builder/sdist/> — default file selection:
> *"All files that are not ignored by your VCS will be included."*
Always included and not excludable: `/pyproject.toml`, `/hatch.toml`, `/hatch_build.py`, `/.gitignore` or `/.hgignore`, any defined `readme` file, all defined `license-files`.

---

## §9 · uv — build backend and workspaces

### 9a · The uv build backend
Source: <https://docs.astral.sh/uv/concepts/build-backend/>
(raw: `astral-sh/uv/docs/concepts/build-backend.md`)

> *"Python packages are expected to contain one or more Python modules, which are directories containing an `__init__.py`. By default, a single root module is expected at `src/<package_name>/__init__.py`."*
> *"uv normalizes the package name to determine the default module name: the package name is lowercased and dots and dashes are replaced with underscores, e.g., `Foo-Bar` would be converted to `foo_bar`."*
> *"The `src/` directory is the default directory for module discovery."*
> *"These defaults can be changed with the `module-name` and `module-root` settings."*

```toml
[tool.uv.build-backend]
module-name = "FOO"
module-root = ""
```

> *"Namespace package modules are identified by a `.` in the `module-name`."*
> *"Using `namespace = true` disables safety checks. Using an explicit list of module names is strongly recommended outside of legacy projects."*

File inclusion:
> *"To determine which files to include in a source distribution, uv first adds the included files and directories, then removes the excluded files and directories. This means that exclusions always take precedence over inclusions."*
> *"By default, uv excludes `__pycache__`, `*.pyc`, and `*.pyo`."*
> sdist includes: the `pyproject.toml`; *"The module under `tool.uv.build-backend.module-root`"*; *"The files referenced by `project.license-files` and `project.readme`"*; data dirs; `source-include` patterns.
> wheel includes: the module; license-files (into `.dist-info`); the readme (into metadata); data dirs (into `.data`).
> *"There are no specific wheel includes. There must only be one top level module, and all data files must either be under the module root or in the appropriate data directory."*
> *"Includes are anchored, which means that `pyproject.toml` includes only `<root>/pyproject.toml` and not `<root>/bar/pyproject.toml`. To recursively include all files under a directory, use a `/**` suffix, e.g. `src/**`."*
> *"Excludes are not anchored, which means that `__pycache__` excludes all directories named `__pycache__` regardless of its parent directory."*

### 9b · `uv init` layouts
Source: <https://docs.astral.sh/uv/concepts/projects/init/>

> *"Application projects are suitable for web servers, scripts, and command-line interfaces."*
> *"Applications are the default target for `uv init`, but can also be specified with the `--app` flag"*
> *"The source code lives in a `src` directory with a module directory and an `__init__.py` file"*
> *"A library provides functions and objects for other projects to consume. Libraries are intended to be built and distributed, e.g., by uploading them to PyPI."*
> *"Libraries always require a packaged project."*
> *"A `py.typed` marker is included to indicate to consumers that types can be read from the library"*
> 🔴 *"A `src` layout is particularly valuable when developing libraries. It ensures that the library is isolated from any `python` invocations in the project root and that distributed library code is well separated from the rest of the project source."*

### 9c · Workspaces
Source: <https://docs.astral.sh/uv/concepts/projects/workspaces/>

> *"Inspired by the Cargo concept of the same name, a workspace is "a collection of one or more packages, called workspace members, that are managed together.""*
> *"Workspaces organize large codebases by splitting them into multiple packages with common dependencies."*
> *"In a workspace, each package defines its own `pyproject.toml`, but the workspace shares a single lockfile, ensuring that the workspace operates with a consistent set of dependencies."*
> *"As such, `uv lock` operates on the entire workspace at once, while `uv run` and `uv sync` operate on the workspace root by default, though both accept a `--package` argument, allowing you to run a command in a particular workspace member from any workspace directory."*
> *"To create a workspace, add a `tool.uv.workspace` table to a `pyproject.toml`, which will implicitly create a workspace rooted at that package."*
> *"In defining a workspace, you must specify the `members` (required) and `exclude` (optional) keys, which direct the workspace to include or exclude specific directories as members respectively, and accept lists of globs"*
> *"Every directory included by the `members` globs (and not excluded by the `exclude` globs) must contain a `pyproject.toml` file. However, workspace members can be either applications or libraries; both are supported in the workspace context."*
> *"Every workspace needs a root, which is also a workspace member."*
> *"The `workspace = true` key-value pair in the `tool.uv.sources` table indicates the `bird-feeder` dependency should be provided by the workspace, rather than fetched from PyPI or another registry."*
> *"Dependencies between workspace members are editable."*
> *"Any `tool.uv.sources` definitions in the workspace root apply to all members, unless overridden in the `tool.uv.sources` of a specific member."*
> *"If a workspace member provides `tool.uv.sources` for some dependency, it will ignore any `tool.uv.sources` for the same dependency in the workspace root, even if the member's source is limited by a marker that doesn't match the current platform."*

When (not) to use, verbatim:
> *"Workspaces are intended to facilitate the development of multiple interconnected packages within a single repository. As a codebase grows in complexity, it can be helpful to split it into smaller, composable packages, each with their own dependencies and version constraints."*
> *"Workspaces help enforce isolation and separation of concerns. For example, in uv, we have separate packages for the core library and the command-line interface, enabling us to test the core library independently of the CLI, and vice versa."*
> *"A library with a performance-critical subroutine implemented in an extension module (Rust, C++, etc.)."*
> *"A library with a plugin system, where each plugin is a separate workspace package with a dependency on the root."*
> 🔴 *"Workspaces are not suited for cases in which members have conflicting requirements, or desire a separate virtual environment for each member. In this case, path dependencies are often preferable."*
> *"This approach conveys many of the same benefits, but allows for more fine-grained control over dependency resolution and virtual environment management (with the downside that `uv run --package` is no longer available; instead, commands must be run from the relevant package directory)."*
> 🔴 *"Finally, uv's workspaces enforce a single `requires-python` for the entire workspace, taking the intersection of all members' `requires-python` values. If you need to support testing a given member on a Python version that isn't supported by the rest of the workspace, you may need to use `uv pip` to install that member in a separate virtual environment."*
> 🔴 *"As Python does not provide dependency isolation, uv can't ensure that a package uses its declared dependencies and nothing else. For workspaces specifically, uv can't ensure that packages don't import dependencies declared by another workspace member."*

Workspace layout (verbatim):

```text
albatross
├── packages
│   ├── bird-feeder
│   │   ├── pyproject.toml
│   │   └── src
│   │       └── bird_feeder
│   │           ├── __init__.py
│   │           └── foo.py
│   └── seeds
│       ├── pyproject.toml
│       └── src
│           └── seeds
│               ├── __init__.py
│               └── bar.py
├── pyproject.toml
├── README.md
├── uv.lock
└── src
    └── albatross
        └── __init__.py
```

---

## §9d · PyPUG packaging tutorial — the canonical tree

Source: <https://packaging.python.org/en/latest/tutorials/packaging-projects/>

```
packaging_tutorial/
├── LICENSE
├── pyproject.toml
├── README.md
├── src/
│   └── example_package_YOUR_USERNAME_HERE/
│       ├── __init__.py
│       └── example.py
└── tests/
```

> *"tests/ is a placeholder for test files. Leave it empty for now."*
> *"The directory containing the Python files should match the project name. This simplifies the configuration and is more obvious to users who install the package."*
> *"Creating the file `__init__.py` is recommended because the existence of an `__init__.py` file allows users to import the directory as a regular package."*
> *"The `tar.gz` file is a source distribution whereas the `.whl` file is a built distribution. Newer pip versions preferentially install built distributions, but will fall back to source distributions if needed."*

## §9e · Root-file owners

- GitHub Actions, <https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax>:
  > *"You must store workflow files in the `.github/workflows` directory of your repository."*
  > *"Workflow files use YAML syntax, and must have either a `.yml` or `.yaml` file extension."*
- nox, <https://nox.thea.codes/en/stable/config.html>:
  > *"Nox looks for configuration in a file named `noxfile.py` by default."*
  The page does **not** state a project-root requirement verbatim; it documents `--noxfile`
  to point elsewhere. Written on the page as "by convention at the root", not as a rule.

---

## §10 · Uncertain — claims the docs would not settle, and what the pages say instead

1. **Whether `Makefile` has any packaging meaning.** No PyPA/Python document governs it.
   Written as: a convention with no tool contract, and noted that no backend gives it
   special treatment.
2. **What `.gitignore` "should" contain for a Python project.** Not specified anywhere
   normative. Written as: git reads it, no build backend does — except hatchling and
   uv, whose sdist defaults *do* read VCS ignore state (quoted).
3. **nox's noxfile location as a rule.** See §9e — stated as convention, not rule.
4. **The exact `sys.path` entry an editable install adds.** setuptools explicitly says
   there is *no guarantee* which mechanism is used (§7c). Pages never name a specific
   `.pth` filename or path; they quote the "no guarantee" sentence instead.
5. **Whether `python -m pytest`'s cwd entry precedes the `pythonpath` confval entries.**
   Not stated by either doc. Left out; pages say only that both go to the head of
   `sys.path` and that this is why a src layout removes the question.
6. **Any tool error string.** No setuptools/hatchling/pytest/uv error message is quoted
   anywhere in the topic except CPython's own `ModuleNotFoundError: No module named 'x'`,
   which is a language fact. There is no sandbox; nothing was run.

---

## §11 · Gap-fill fetched 2026-09-10 by the writing session (appended; do not re-derive)

### 11a · `uv init` layouts — <https://docs.astral.sh/uv/concepts/projects/init/> (raw `astral-sh/uv/docs/concepts/projects/init.md`, docs pin `uv_build>=0.12.12,<0.13`)

> *"When creating projects, uv supports two basic templates: applications and libraries. By default, uv will create a project for an application. The `--lib` flag can be used to create a project for a library instead."*
> *"In both cases, uv prefers to define a build system and place source files in a dedicated `src/<project_name>/` directory. Defining a build system allows use of various Python packaging features, such as adding command-line entry points, and avoids common points of confusion with the Python import system. Use of a build system can be disabled by using the `--no-package` or `--bare` options."*
> 🔴 *"Prior to v0.12, uv did not define a build system for applications by default."*
> *"If there's already a project in the target directory, i.e., if there's a `pyproject.toml`, uv will exit with an error."*
> *"A build system is defined, so the project will be installed into the environment"*
> App tree: `example-app/{.python-version, README.md, pyproject.toml, src/example_app/__init__.py}`; pyproject has `[project.scripts] example-app = "example_app:main"` and `[build-system] requires = ["uv_build>=0.12.12,<0.13"]`, `build-backend = "uv_build"`.
> Lib tree: same plus `src/example_lib/py.typed`; no `[project.scripts]`.
> *"You can select a different build backend template by using `--build-backend` with `hatchling`, `uv_build`, `flit-core`, `pdm-backend`, `setuptools`, `maturin`, or `scikit-build-core`."*
> *"Using `--build-backend` implies `--package`."*
> Extension tree (maturin): `.python-version, Cargo.toml, README.md, pyproject.toml, src/lib.rs, src/example_ext/{__init__.py,_core.pyi}`.
> *"While defining a build system generally provides a better experience, there are some cases in which it can be easier to omit it and define your Python modules directly in the top-level directory."*
> `--no-package` tree: `.python-version, README.md, main.py, pyproject.toml`. *"It does not include a build system, it is not a package, and will not be installed into the environment"*
> `--bare`: *"uv will skip creating a Python version pin file, a README, and any source directories or files. Additionally, uv will not initialize a version control system (i.e., `git`)."* · *"The `--bare` option can be used with other options like `--lib` or `--build-backend` — in these cases uv will still configure a build system but will not create the expected file structure."*

CLI help (<https://docs.astral.sh/uv/reference/cli/>, confirmed in `crates/uv-cli/src/lib.rs`):
> `--package`: *"Set up the project to be built as a Python package. Defines a `[build-system]` for the project. This is the default behavior."*
> `--no-package`: *"Do not set up the project to be built as a Python package. This option creates the project structure as a flat directory that is not importable as a module and has no `[build-system]` entry. It can be used for applications that are not expected to be distributed as a package."*
> `--app`: *"Applications are packaged by default. Use `--no-package` to create an unpackaged application."*
> `--build-backend`: *"Initialize a build-backend of choice for the project. Implicitly sets `--package`."* — site lists values `uv`, `hatch`, `flit`, `pdm`, `poetry`, `setuptools`, `maturin`, `scikit`.
> `uv run --no-editable`: *"Install any editable dependencies, including the project and any workspace members, as non-editable [env: UV_NO_EDITABLE=]"*

### 11b · uv sync editable — <https://docs.astral.sh/uv/concepts/projects/sync/>
> *"When the environment is synced, uv will install the project (and other workspace members) as editable packages, such that re-syncing is not necessary for changes to be reflected in the environment."*
> *"To opt-out of this behavior, use the `--no-editable` option."*
> *"If the project does not define a build system, it will not be installed."*

### 11c · uv workspaces additions — <https://docs.astral.sh/uv/concepts/projects/workspaces/>
> *"Think: a FastAPI-based web application, alongside a series of libraries that are versioned and maintained as separate Python packages, all in the same Git repository."*
> *"By default, running `uv init` inside an existing package will add the newly created member to the workspace, creating a `tool.uv.workspace` table in the workspace root if it doesn't already exist."*
> *"By default, `uv run` and `uv sync` operates on the workspace root. For example, in the above example, `uv run` and `uv run --package albatross` would be equivalent, while `uv run --package bird-feeder` would run the command in the `bird-feeder` package."*
> *"The `workspace` field can also be set to a path string to resolve a dependency from a different workspace."*
> *"The most common workspace layout can be thought of as a root project with a series of accompanying libraries."*
> Not found on the page: any statement about a root with no `[project]` table ("virtual" root). Left out of the pages.

### 11d · uv build backend additions — <https://docs.astral.sh/uv/concepts/build-backend/>
> *"The uv build backend currently **only supports pure Python code**."*
> *"While the backend supports a number of options for configuring your project structure, when build scripts or a more flexible project layout are required, consider using the hatchling build backend instead."*
> *"The uv build backend follows the same versioning policy as uv. Including an upper bound on the `uv_build` version ensures that your package continues to build correctly as new versions are released."*
> *"The `__init__.py` file is not included in `foo`, since it's the shared namespace module."*
> Multi-root: *"While we do not recommend this structure (i.e., you should use a workspace with multiple packages instead), it is supported by setting `module-name` to a list of names"*
> Stubs: *"The module name for type stub packages must end in `-stubs`, so uv will not normalize the `-` to an underscore."*
> *"Excludes are not anchored ... To anchor a directory, use a `/` prefix, e.g., `/dist` will exclude only `<root>/dist`."*
> *"The source dist excludes are applied to avoid source tree to wheel builds including more files than source tree to source distribution to wheel build."*

### 11e · ruff `src` — <https://docs.astral.sh/ruff/settings/#src> (source `crates/ruff_workspace/src/options.rs`)
> *"The directories to consider when resolving first- vs. third-party imports."*
> *"When omitted, the `src` directory will typically default to including both: 1. The directory containing the nearest `pyproject.toml`, `ruff.toml`, or `.ruff.toml` file (the "project root"). 2. The `"src"` subdirectory of the project root."*
> *"These defaults ensure that Ruff supports both flat layouts and `src` layouts out-of-the-box."*
> *"In this case, the `./lib` directory should be included in the `src` option (e.g., `src = ["lib"]`), such that when resolving imports, `my_package.foo` is considered first-party."*
> *"This field supports globs. For example, if you have a series of Python packages in a `python_modules` directory, `src = ["python_modules/*"]` would expand to incorporate all packages in that directory."*
> Default `[".", "src"]`, type `list[str]`.
> `namespace-packages`: *"Mark the specified directories as namespace packages. For the purpose of module resolution, Ruff will treat those directories and all their subdirectories as if they contained an `__init__.py` file."*

### 11f · coverage.py — <https://coverage.readthedocs.io/en/latest/config.html>, <https://coverage.readthedocs.io/en/latest/source.html>
> `[run] source`: *"A list of packages or directories, the source to measure during execution. If set, `include` is ignored."*
> `[run] source_pkgs`: *"A list of packages, the source to measure during execution. Operates the same as `source`, but only names packages, for resolving ambiguities between packages and directories."* (added 5.3)
> `[run] source_dirs` (added 7.8): *"A list of directories ... only names directories"*
> `[paths]`: *"The entries in this section are lists of file paths that should be considered equivalent when combining data from different machines"* · *"The first value must be an actual file path on the machine where the reporting will happen, so that source code can be found. The other values can be file patterns to match against the paths of collected data"* · *"Remapping will also be done during reporting, but only within the single data file being reported."*
> source.rst: *"Only importable files (ones at the root of the tree, or in directories with a `__init__.py` file) will be considered."*
> *"Modules named as sources may be imported twice, once by coverage.py to find their location, then again by your own code or test suite."*
> No doc example uses a `site-packages` pattern — the pages present `"*/site-packages/"` as an application of the documented pattern mechanism, labelled as such.

### 11g · mypy — <https://mypy.readthedocs.io/en/stable/running_mypy.html#mapping-file-paths-to-modules>
> *"For each file to be checked, mypy will attempt to associate the file (e.g. `project/foo/bar/baz.py`) with a fully qualified module name (e.g. `foo.bar.baz`). The directory the package is in (`project`) is then added to mypy's module search paths."*
> *"For example, suppose you are trying to add the module `foo.bar.baz` which is located at `~/foo-project/src/foo/bar/baz.py`. In this case, you must run `mypy ~/foo-project/src` (or set the `MYPYPATH` to `~/foo-project/src`)."*
> *"`$ MYPYPATH=src mypy --namespace-packages --explicit-package-bases .`"*
> The "found twice under different module names" error string is NOT in these docs — not quoted on any page.

### 11h · CPython 3.13 shadowing message + `-P` version — <https://docs.python.org/3.14/whatsnew/3.13.html>, <https://docs.python.org/3.14/using/cmdline.html>
> *"A common mistake is to write a script with the same name as a standard library module. When this results in errors, we now display a more helpful error message"* — example message: *"AttributeError: module 'random' has no attribute 'randint' (consider renaming '/home/me/random.py' since it has the same name as the standard library module named 'random' and prevents importing that standard library module)"*
> *"Similarly, if a script has the same name as a third-party module that it attempts to import and this results in errors, we also display a more helpful error message"* — *"(consider renaming '/home/me/numpy.py' if it has the same name as a library you intended to import)"*
> `-P`: `.. versionadded:: 3.11`; `PYTHONSAFEPATH`: `.. versionadded:: 3.11`; `-I`: `.. versionadded:: 3.4`, *"Further restrictions may be imposed to prevent the user from injecting malicious code."*

### 11i · hatch additions — <https://hatch.pypa.io/latest/config/build/>, <https://hatch.pypa.io/latest/plugins/builder/wheel/>
> Wheel default selection: *"When the user has not set any file selection options, the project name will be used to determine the package to ship in the following heuristic order:"* 1 `<NAME>/__init__.py` 2 `src/<NAME>/__init__.py` 3 `<NAME>.py` 4 `<NAMESPACE>/<NAME>/__init__.py` · *"If none of these heuristics are satisfied, an error will be raised."* — the page does NOT spell out hyphen→underscore normalisation of `<NAME>`; pages say so.
> `bypass-selection` (default false): *"Whether or not to suppress the error when one has not defined any file selection options and all heuristics have failed to determine what to ship"*
> Wheel versions: `editable` — *"A wheel that only ships `.pth` files or import hooks for real-time development"*
> `artifacts`: *"If you want to include files that are ignored by your VCS, such as those that might be created by build hooks, you can use the `artifacts` option. This option is semantically equivalent to `include`."* · *"Note that artifacts are not affected by the `exclude` option."*
> `force-include`: *"allows you to select specific files or directories from anywhere on the file system that should be included and map them to the desired relative distribution path."*
> `only-packages`: *"If you want to exclude non-artifact files that do not reside within a Python package, set `only-packages` to `true`"*
> `packages = ["src/foo"]` *"is equivalent to"* `only-include = ["src/foo"]` + `sources = ["src"]`.
> `sources` table: `"src/foo" = "bar"` *"would distribute the file `src/foo/file.ext` as `bar/file.ext`."*
> `skip-excluded-dirs` warning: *"if you want to include the file `a/b/c.txt` but your VCS ignores `a/b`, the file `c.txt` will not be seen because its parent directory will not be entered. In such cases you can use the `force-include` option."*

### 11j · more gap-fill (writing session)
> `uv init --no-workspace` (CLI help, `crates/uv-cli/src/lib.rs`): *"Avoid discovering a workspace and create a standalone project. By default, uv searches for workspaces in the current directory or any parent directory."*
> coverage `source.rst`: *"If the source option is specified, only code in those locations will be measured."*
> `uv init --build-backend` values (`crates/uv-configuration/src/project_build_backend.rs`): `uv` (aliases `uv-build`, `uv_build`), `hatch` (alias `hatchling`), `flit` (`flit-core`), `pdm` (`pdm-backend`), `poetry` (`poetry-core`, `poetry_core`), `setuptools`, `maturin`, `scikit` (`scikit-build-core`).
> `uv sync --package` (CLI help): *"Sync for specific packages in the workspace. The workspace's environment (`.venv`) is updated to reflect the subset of dependencies declared by the specified workspace member packages. If any workspace member does not exist, uv will exit with an error."*
> `uv build --package`: *"Build a specific package in the workspace. The workspace will be discovered from the provided source directory, or the current directory if no source directory is provided."*
> `uv run --package`: *"Run the command in a specific package in the workspace."*
