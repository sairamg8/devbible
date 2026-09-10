---
title: "Before a backend can build a wheel it has to decide which directories are your packages, and setuptools answers by guessing from the layout — a guess that has a reserved-names list, refuses two top-level packages in a flat tree, and switches itself off the moment you configure anything"
sidebar_label: "07 · setuptools package discovery"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 · target **Python 3.14.7** · against setuptools *Package Discovery and Namespace Packages* ([setuptools.pypa.io](https://setuptools.pypa.io/en/latest/userguide/package_discovery.html)) and setuptools *Controlling files in the distribution* ([setuptools.pypa.io](https://setuptools.pypa.io/en/latest/userguide/miscellaneous.html)). The file-list page notes it is *"guaranteed to work with the last stable version of `setuptools`"*.
> Documentation-validated — **no sandbox run, no program output**; no setuptools error message is quoted.

**The layout is an input to the build, not just to imports. A backend building a wheel must first answer "which directories are import packages, and which are tooling, docs and scripts that happen to contain `.py` files?" setuptools answers by recognising the two layouts and guessing: under `src/`, everything is a package; in a flat tree, everything is a package *except* a long list of reserved names — and if the guess still finds more than one top-level package, it refuses to build rather than risk shipping your maintenance scripts. Every rule in that paragraph has a failure mode, and all of them disappear or shrink under a src layout. hatchling and the uv backend answer the same question differently; they are [08](08-hatchling-and-uv-build-discovery.md).**

## Automatic discovery

> *"By default `setuptools` will consider 2 popular project layouts, each one with its own set of advantages and disadvantages as discussed in the following sections."*

> *"Setuptools will automatically scan your project directory looking for these layouts and try to guess the correct values for the `packages` and `py_modules` configuration."*

The rule that decides whether the guess happens at all:

> *"Automatic discovery will **only** be enabled if you **don't** provide any configuration for `packages` and `py_modules`. If at least one of them is explicitly set, automatic discovery will not take place."*

> *"**Note**: specifying `ext_modules` might also prevent auto-discover from taking place, unless your opt into `pyproject_config`"*

### src-layout

> *"The project should contain a `src` directory under the project root and all modules and packages meant for distribution are placed inside this directory"*

> *"This layout is very handy when you wish to use automatic discovery, since you don't have to worry about other Python files or folders in your project root being distributed by mistake. In some circumstances it can be also less error-prone for testing or when using PEP 420-style packages."*

A src project with `setuptools` needs no `[tool.setuptools]` table at all:

```toml
[build-system]
requires = ["setuptools >= 77.0.3"]
build-backend = "setuptools.build_meta"

[project]
name = "invoice-service"
version = "0.6.0"
requires-python = ">=3.12"
```

### flat-layout

Also, per the docs, *"also known as "adhoc""*:

> *"The package folder(s) are placed directly under the project root"*

> *"To avoid confusion, file and folder names that are used by popular tools (or that correspond to well-known conventions, such as distributing documentation alongside the project code) are automatically filtered out in the case of flat-layout"*

The filters, as the page renders them (`FlatLayoutPackageFinder.DEFAULT_EXCLUDE` and `FlatLayoutModuleFinder.DEFAULT_EXCLUDE`).

**Directories** never treated as packages in a flat layout: `ci`, `bin`, `debian`, `doc`, `docs`, `documentation`, `manpages`, `news`, `newsfragments`, `changelog`, `test`, `tests`, `unit_test`, `unit_tests`, `example`, `examples`, `scripts`, `tools`, `util`, `utils`, `python`, `build`, `dist`, `venv`, `env`, `requirements`, `tasks`, `fabfile`, `site_scons`, `benchmark`, `benchmarks`, `exercise`, `exercises`, `htmlcov`, and anything matching `[._]*`.

**Top-level modules** never treated as distributable in a flat layout: `setup`, `conftest`, `test`, `tests`, `example`, `examples`, `build`, `toxfile`, `noxfile`, `pavement`, `dodo`, `tasks`, `fabfile`, `[Ss][Cc]onstruct`, `conanfile`, `manage`, `benchmark`, `benchmarks`, `exercise`, `exercises`, and anything matching `[._]*`.

Note `manage` — a Django project's `manage.py` — and `python`, which catches a directory some projects use to hold their Python bindings.

Then the safety net:

> *"If you are using auto-discovery with flat-layout, `setuptools` will refuse to create distribution archives with multiple top-level packages or modules."*
> *"This is done to prevent common errors such as accidentally publishing code not meant for distribution (e.g. maintenance-related scripts)."*
> *"Users that purposefully want to create multi-package distributions are advised to use custom-discovery or the `src-layout`."*

### single-module distribution

> *"A standalone module is placed directly under the project root, instead of inside a package folder"*

A project that is one `invoice_service.py` file next to `pyproject.toml` is discovered as a single module.

## Worked example: why a flat build refuses

```text
invoice-service/
├── pyproject.toml
├── noxfile.py              filtered: `noxfile` is on the module list
├── conftest.py             filtered: `conftest`
├── seed_data.py            🔴 NOT filtered — a second top-level module
├── invoice_service/
│   └── __init__.py         the package you meant
├── tools/
│   └── __init__.py         filtered: `tools` is on the directory list
└── devtools/
    └── __init__.py         🔴 NOT filtered — a second top-level package
```

After filtering, discovery still sees `invoice_service`, `devtools` and `seed_data`. That is more than one top-level name, so setuptools refuses to build. The refusal is the feature working: without it, `devtools` and `seed_data` would install into every user's site-packages as top-level names. The fixes, in order of preference:

```text
invoice-service/            move to src: only src/ is scanned
├── src/invoice_service/
├── devtools/               ignored — outside src/
└── seed_data.py            ignored — outside src/
```

```toml
# or stay flat and say exactly what ships
[tool.setuptools.packages.find]
include = ["invoice_service*"]
```

## Custom discovery

> *"If the automatic discovery does not work for you (e.g., you want to include in the distribution top-level packages with reserved names such as `tasks`, `example` or `docs`, or you want to exclude nested packages that would be otherwise included), you can use the provided tools for package discovery"*

```toml
[tool.setuptools.packages.find]
where = ["src"]
include = ["pkg*"]  # alternatively: `exclude = ["additional*"]`
namespaces = false
```

Each key has a rule that bites:

**`include` / `exclude` match full dotted names.**

> *"`include` and `exclude` accept strings representing glob patterns. These patterns should match the **full** name of the Python module (as if it was written in an `import` statement)."*
> *"For example if you have `util` pattern, it will match `util/__init__.py` but not `util/files/__init__.py`."*
> *"The fact that the parent package is matched by the pattern will not dictate if the submodule will be included or excluded from the distribution. You will need to explicitly add a wildcard (e.g. `util*`) if you want the pattern to also match submodules."*

That is the configuration that lost the `pdf` subpackage in [03](03-the-wrong-copy-bug.md).

**`namespaces` defaults to on in `pyproject.toml`.**

> *"When using `tool.setuptools.packages.find` in `pyproject.toml`, setuptools will consider implicit namespaces by default when scanning your project directory. To avoid `pkg.namespace` from being added to your package list you can set `namespaces = false`. This will prevent any folder without an `__init__.py` file from being scanned."*

So a directory with no `__init__.py` under `where` is a candidate package unless you turn this off. [09](09-namespace-packages-and-the-missing-init.md) is the layout consequence.

**`package-dir` remaps directories to package names.**

```toml
[tool.setuptools]
package-dir = {"" = "src"}
```

> *"Although `setuptools` allows developers to create a very complex mapping between directory names and package names, it is better to keep it simple and reflect the desired package hierarchy in the directory structure, preserving the same names."*

With auto-discovery recognising a src layout, `package-dir = {"" = "src"}` is redundant; it survives in older projects that predate auto-discovery.

## Build artefacts in the root

> *"Setuptools automatically creates a few directories to host build artefacts and cache files, such as `build`, `dist`, `*.egg-info`."*

`build` and `dist` are on the flat-layout exclusion list, so they are not mistaken for packages. They are still directories full of copies of your code inside the project root, which is one more reason for your import package not to live there.

## Gotchas

**★ Symptom: setuptools refuses to build a flat project, citing more than one top-level package or module.** Cause: after the reserved-name filter, auto-discovery still found a second name — a `devtools/` package or a `seed_data.py` in the root. Fix: move the package under `src/`, or declare exactly what ships.

```toml
[tool.setuptools.packages.find]
include = ["invoice_service*"]
```

**★ Symptom: a flat project whose package is named `benchmarks`, `tasks`, `examples` or `utils` does not get that package into its build.** Cause: those names are on the flat-layout exclusion list, so auto-discovery filters out the very package you meant to ship. Fix: include it by name through custom discovery, or move to a src layout where the list does not apply.

```toml
[tool.setuptools.packages.find]
include = ["benchmarks*"]
```

**★ Symptom: adding one explicit setting made every subpackage disappear from the wheel.** Cause: *"If at least one of them is explicitly set, automatic discovery will not take place."* A `packages = ["invoice_service"]` added for any reason is now the complete list. Fix: use `packages.find` so subpackages are discovered, not listed.

```toml
[tool.setuptools.packages.find]
where = ["src"]
```

**Symptom: a directory of scratch scripts under `src/` ends up in the wheel as a top-level name.** Cause: with `packages.find` in `pyproject.toml`, *"setuptools will consider implicit namespaces by default"*, so a folder without `__init__.py` is scanned. Fix: turn namespace scanning off, and keep scratch code out of `src/`.

```toml
[tool.setuptools.packages.find]
where = ["src"]
namespaces = false
```

**Symptom: a project with C extensions stopped discovering its Python packages.** Cause: *"specifying `ext_modules` might also prevent auto-discover from taking place"*. Fix: declare discovery explicitly alongside the extensions.

```toml
[tool.setuptools.packages.find]
where = ["src"]
```

**Symptom: `exclude = ["invoice_service.tests"]` still ships `invoice_service.tests.fixtures`.** Cause: patterns match full names, and the parent matching *"will not dictate"* what happens to submodules. Fix: add the wildcard.

```toml
[tool.setuptools.packages.find]
where = ["src"]
exclude = ["invoice_service.tests*"]
```

**Symptom: an inherited `package-dir` mapping confuses editors, type checkers and editable installs.** Cause: a mapping between directory names and package names that differ; every tool that locates source by path has to reproduce it. Fix: follow setuptools' advice — make the directory tree mirror the package names, and drop the mapping.

```text
src/invoice_service/__init__.py     # the directory name IS the package name
```

## Interview questions

**★ How does setuptools decide what to package when you configure nothing?**
It recognises the layout. If there is a `src/` directory, everything importable under it is a candidate. Otherwise it treats the root as a flat layout, filters out a documented list of conventional directory and module names — `tests`, `docs`, `tools`, `scripts`, `noxfile`, `conftest`, `setup` and many more — and, if more than one top-level package or module remains, refuses to build. All of this is skipped the moment `packages` or `py_modules` is configured.

**★ Why does setuptools refuse to build a flat project with two top-level packages?**
Because in a flat root, a second top-level name is far more often a maintenance script or a helper package than something you mean to install into every user's site-packages. The documentation says the refusal is there *"to prevent common errors such as accidentally publishing code not meant for distribution"*. Projects that genuinely ship several top-level packages are directed to custom discovery or the src layout, where the question of what counts as distributable is answered by location.

**Why do `include` patterns need a trailing wildcard?**
Because they match full dotted module names, and matching a parent package says nothing about its children. `invoice_service` matches only the top-level package; `invoice_service*` matches it and every subpackage. Forgetting the wildcard drops every subpackage silently, which is invisible to a flat-layout test run.

**What does `namespaces = false` do, and why isn't it the default?**
It stops `packages.find` scanning directories that have no `__init__.py`, so only regular packages are discovered. In `pyproject.toml` the default is to consider implicit namespace packages, because PEP 420 packages are legitimate and a scanner that ignored them would silently drop real code. The cost is that stray directories under `where` can be picked up; turning it off is right when you know you have no namespace packages.

**Do you still need `package-dir = {"" = "src"}`?**
Not for a standard src layout — auto-discovery recognises `src/` on its own. The mapping is a legacy from before automatic discovery, and setuptools itself advises keeping the directory structure identical to the package hierarchy rather than relying on mappings.

**What changes when a setuptools project adds `ext_modules`?**
Automatic discovery may stop happening: the documentation notes that *"specifying `ext_modules` might also prevent auto-discover from taking place"* unless the project opts into pyproject-based configuration. A project that relied on discovery can therefore lose its pure-Python packages from the build on the day it adds its first extension. Declaring `[tool.setuptools.packages.find]` explicitly removes the dependency on that behaviour.

---

← Prev: [06b · rootdir and pythonpath](06b-rootdir-and-pythonpath.md) · [Topic index](README.md) · Next → [08 · hatchling and uv_build discovery](08-hatchling-and-uv-build-discovery.md)
