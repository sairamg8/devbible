---
title: "name is the only field the spec forbids from being computed, and the reason is that PyPI, your lockfile and your dependency strings all compare it after normalising away case, dots, hyphens and underscores"
sidebar_label: "03 · name and normalization"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the PyPA *pyproject.toml specification* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/pyproject-toml/)), the PyPA *Package name normalization* specification ([packaging.python.org](https://packaging.python.org/en/latest/specifications/name-normalization/)), *Core metadata specifications* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/core-metadata/)), and PEP 621 ([peps.python.org](https://peps.python.org/pep-0621/)).
> Target: **Python 3.14.7**. Documentation-validated — **no sandbox run, no program output**.

**`Flask`, `flask`, `FLASK`, `fl.ask` and `fl_ask` are the same package as far as PyPI, pip, uv and every lockfile are concerned, because all of them normalise to `fl-ask`. That single rule explains a family of confusions: why `pip install my_pkg` installs `my-pkg`, why your wheel filename looks nothing like your `name`, why you cannot register `Django-Rest-Framework` when `djangorestframework` exists, and why the distribution name has no required relationship to the name you `import`. `name` is also the one `[project]` key the specification will not let a backend compute — PEP 621 requires it to be static — and knowing why is the difference between understanding the metadata model and memorising it.**

## The two rules, verbatim

**What counts as a valid name.** The name-normalization specification gives the regex directly:

```
^([A-Z0-9]|[A-Z0-9][A-Z0-9._-]*[A-Z0-9])\Z
```

matched case-insensitively. Read it as: starts and ends with a letter or digit; in between, letters, digits, `.`, `-`, `_` in any combination; one character is enough. So `x` is valid, `-x` is not, `x-` is not, and `my..pkg` is — surprisingly — valid, because runs are permitted.

**How two names are compared.**

> *"The name should be lowercased with all runs of the characters `.`, `-`, or `_` replaced with a single `-` character."*

The specification hands you the implementation:

```python
import re

def normalize(name):
    return re.sub(r"[-_.]+", "-", name).lower()
```

> *"This means that the following names are all equivalent:"* — the spec then lists `friendly-bard`, `Friendly-Bard`, `friendly.bard`, `friendly_bard` and further variants.

Note `[-_.]+` — the `+` is why `my...pkg`, `my---pkg` and `my-_.pkg` all collapse to `my-pkg`. Normalisation is not a character-for-character substitution; it collapses *runs*.

And in `[project]` itself:

> *"The name of the project. Tools SHOULD normalize this name, as soon as it is read for internal consistency."*

## What follows from a normalised comparison

```toml
[project]
name = "Invoice-Service"
```

- **PyPI registration is checked against `invoice-service`.** If `invoice_service` or `Invoice.Service` is taken, your name is taken. This is deliberate — it is a typosquatting and confusion defence, not an inconvenience.
- **`pip install Invoice_Service` works** and installs the same thing, because pip normalises before asking the index.
- **A dependency string in someone else's `pyproject.toml` may spell it any of those ways** and still resolve to you. `dependencies = ["Invoice.Service>=0.4"]` is a correct reference to your package.
- **`importlib.metadata.version("invoice_service")` finds it**, because the stdlib normalises too.

### Where the name is *not* normalised: what you type in `import`

Nothing in the metadata specification connects the distribution name to the import name. They are separate namespaces that happen to agree most of the time.

```toml
[project]
name = "beautifulsoup4"     # what you pip install
```

```python
import bs4                  # what you import
```

The classic set: `pyyaml` → `yaml`, `pillow` → `PIL`, `python-dateutil` → `dateutil`, `scikit-learn` → `sklearn`, `attrs` → `attr` *and* `attrs`. One distribution may provide several import names, or none (a distribution can install only a console script), or the same import name as another distribution — which is how two packages can silently overwrite each other's files.

⚠️ Backends impose their own default, and it is a *default*, not a rule. Flit documents its convention:

> *"The name your package will have on PyPI. This field is required. For Flit, this name, with any hyphens replaced by underscores, is also the default value of the import name."*

> *"Flit looks for the source of the package by its import name. The source may be located either in the directory that holds the `pyproject.toml` file, or in a `src/` subdirectory."*

So under flit-core, `name = "invoice-service"` looks for `invoice_service/` or `src/invoice_service/`. Under hatchling or setuptools the discovery rules differ. This is a backend question, not a spec question.

⚠️ **PEP 794 changes the guessing game, but not yet.** It is *Accepted*, introduces core metadata **2.5**, and adds `import-names` / `import-namespaces` to `[project]` so a distribution can *declare* what it provides on import. Its abstract:

> *"This PEP proposes extending the core metadata specification for Python packaging to include two new, repeatable fields named `Import-Name` and `Import-Namespace` to record the import names that a project provides once installed."*

Both keys already appear in the current spec's list of fields that may be `dynamic`. Whether your backend fills them is a per-backend question I did not verify; do not rely on the field being present in metadata you consume.

## Why `name` must be static

PEP 621 requires it:

> *"Tools MUST require users to statically define this field"*

and the current specification closes the other door:

> *"A build back-end MUST raise an error if the metadata specifies `name` in `dynamic`."*

The core metadata spec agrees from the other side — `Name` is one of the fields that *"may not be specified"* in the `Dynamic` field, along with `Version` and `Metadata-Version`.

The mechanism behind the rule: `name` is the key everything else is filed under. A resolver reading an index page, a lockfile entry, a `.dist-info` directory name, a `RECORD` file, an installed-package database — all of them are keyed by name before any build happens. A name that could only be learned by running the backend would make the identity of a package depend on building it, which reintroduces the exact circularity `pyproject.toml` was created to break. See **[01 · The catch-22](01-the-catch-22-that-killed-setup-py.md)**.

## Naming decisions that are cheap now and expensive later

- **Pick the hyphenated form for `name` and the underscore form for the package directory.** `name = "invoice-service"`, `src/invoice_service/`. Hyphens are illegal in Python identifiers, so this is the only pairing that reads naturally in both places.
- **Do not put your organisation in the name unless you mean it.** `acme-invoice-service` is a different package from `invoice-service` and renaming after publication means publishing a new project and a shim.
- **Avoid a name whose normalised form collides with a well-known package.** `Requests-Toolbelt` normalises to `requests-toolbelt`, which exists. Check by normalising by hand and querying `https://pypi.org/project/<normalised>/`.
- **A leading digit is legal.** `2to3` matches the regex. Your import name cannot start with a digit, so plan the mismatch deliberately.
- **Names are case-preserving in the file and case-insensitive everywhere else.** PyPI displays what you wrote; nothing compares it. Choose the display form you want and stop treating case as meaningful.

## Gotchas

**★ Symptom: the index refuses to register your project, saying the name is too close to one that already exists — and the existing name looks different to you.** Cause: the comparison is on normalised names, so `Invoice_Service` and `invoice-service` are the same name. I am not quoting the index's message text here, because I did not verify it; the mechanism is the specification's own equivalence rule. Fix: normalise your candidate yourself before you commit to it:

```python
import re
print(re.sub(r"[-_.]+", "-", "Invoice_Service").lower())   # the string PyPI will compare
```

**★ Symptom: `pip install my_package` works, but `importlib.metadata.version("my_package")` and your CI's package list disagree on the spelling.** Cause: different layers print the *stored* name and the *normalised* name. Fix: never compare package names with `==` in your own tooling; normalise both sides first.

```python
import re
def same_project(a: str, b: str) -> bool:
    n = lambda s: re.sub(r"[-_.]+", "-", s).lower()
    return n(a) == n(b)
```

**★ Symptom: your project name and your import name diverge, and users file bugs saying "there is no module named invoice-service".** Cause: nothing in packaging links them, and a hyphen cannot appear in an identifier. Fix: say it in `description` and at the top of the README, because there is no metadata field that will say it for you until PEP 794's `import-names` is populated by your backend:

```toml
[project]
name = "invoice-service"
description = "Invoice issuing and reconciliation. Import as `invoice_service`."
```

**★ Symptom: `pip install .` errors that the project has no `name`, but you wrote one.** Cause: it is in the wrong table — `name` under `[tool.poetry]`, `[tool.hatch]` or at the top level of the file is not `[project] name`. Fix: it belongs in `[project]`, and only there:

```toml
[project]
name = "invoice-service"
version = "0.1.0"
```

**★ Symptom: a build backend errors on `dynamic = ["name"]` and the message is unhelpfully generic.** Cause: this is a MUST-level error — *"A build back-end MUST raise an error if the metadata specifies `name` in `dynamic`."* Fix: there is no dynamic-name mechanism to switch to; hard-code the name. If you are generating projects from a template, the template writes the name, not the build.

**★ Symptom: two distributions installed together, and importing one gets the other's code.** Cause: distribution names are unique on the index, but *import* names are not registered anywhere — two projects may both install a top-level `utils` package, and the second install overwrites files from the first. Fix: never publish a distribution whose top-level import name is generic. Nest under your own package:

```
src/invoice_service/utils.py        ✅ import invoice_service.utils
src/utils.py                        🔴 import utils — collides with the world
```

**★ Symptom: your wheel filename does not match your `name`.** Cause: wheel and sdist filenames use an escaped form of the name rather than the raw string. The name-normalization page I verified against does **not** state the filename escaping rule, so I am not quoting one here: treat the filename as generated by the backend and never parse it to recover the name. Fix: read the name from metadata, not from a filename:

```python
from importlib.metadata import distribution
print(distribution("invoice-service").metadata["Name"])
```

## Interview questions

**★ Are `flask`, `Flask` and `fl_ask` three packages or one?**
One, as far as every tool that matters is concerned. The name-normalization specification lowercases the name and replaces every run of `.`, `-` or `_` with a single `-`, so all three normalise to the same string and the index treats them as the same project. The name you write in `[project] name` is preserved for display, but no comparison anywhere uses it verbatim. That is why you cannot register a package whose only difference from an existing one is punctuation or case.

**★ Why does the normalisation regex use `[-_.]+` rather than `[-_.]`?**
Because a *run* of separators must collapse to one. Without the `+`, `my__pkg` would normalise to `my--pkg` and `my_pkg` to `my-pkg`, and the two would compare unequal — leaving an obvious typosquatting hole where `my__pkg` and `my_pkg` are different projects with indistinguishable names. Collapsing runs makes any amount of punctuation between two alphanumerics equivalent to exactly one hyphen.

**★ Why must `name` be static when `version` may be dynamic?**
Because `name` is the identity a package is filed under before any build occurs. Index pages, lockfile entries, `.dist-info` directory names and the installed-package database are all keyed by name, so a name that required running the backend would make a package's identity depend on building it — the circularity `pyproject.toml` exists to break. `version` is different: by the time a version matters you already have the artifact in hand, so a backend can compute it from a git tag or a module attribute without any consumer needing to build anything to find out what the package *is*.

**★ Is there any way to know a package's import name from its metadata?**
Historically no — the distribution name and the import name were unrelated by specification, which is why `pyyaml` gives you `yaml` and `beautifulsoup4` gives you `bs4`, and why the only reliable source was the README. PEP 794 is Accepted and adds `Import-Name` and `Import-Namespace` core metadata fields, with `import-names` and `import-namespaces` keys in `[project]`, introducing core metadata 2.5 to carry them. Until your backend and your consumers all support that, the practical answer is still "read the documentation", and defensive code should use `importlib.metadata.packages_distributions()` rather than guessing.

**★ A colleague writes `dependencies = ["Pillow>=11"]` and another writes `dependencies = ["pillow>=11"]`. Is one wrong?**
Neither is wrong and both resolve to the same project, because the dependency specifier's name is normalised before it is looked up. What *is* worth standardising is the spelling within one repository, because human diffs and grep are not normalisation-aware: a lockfile audit that greps for `pillow` misses `Pillow`. Pick the lowercase normalised form as a convention and let the tooling's case-insensitivity be a safety net rather than a style.

**★ What is the risk in a distribution that installs a top-level module with a common name?**
Wheels install files into `site-packages` by path, and nothing arbitrates between two distributions that both want `utils.py`. Whichever installs second wins, the first is now subtly broken, and the failure is an `AttributeError` in code that used to work rather than an install error. The distribution *name* is unique because the index enforces it; the *import* namespace has no registry at all. The mitigation is entirely on the author: one top-level package named after your project, everything nested inside it.

---

← Prev: [02 · The frontend/backend split](02-pep-517-the-frontend-backend-split.md) · [Topic index](README.md) · Next → [04 · version and requires-python](04-version-and-requires-python.md)
