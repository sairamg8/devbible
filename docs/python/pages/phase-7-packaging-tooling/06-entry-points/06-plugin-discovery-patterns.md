---
title: "A plugin system built on entry points couples the host and its plugins through one string — the group name — so the host's real job is to own that name, define the interface, load lazily, survive bad plugins, resolve duplicate names on purpose, and give users a way to switch autoloading off"
sidebar_label: "06 · Plugin discovery patterns"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against *Creating and discovering plugins* ([packaging.python.org](https://packaging.python.org/en/latest/guides/creating-and-discovering-plugins/)), the PyPA *Entry points specification* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/entry-points/)), the *pyproject.toml specification* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/pyproject-toml/)), uv's *Configuring projects → Plugin entry points* ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/config/#plugin-entry-points)), uv **0.12.12** [`uv-build-backend/src/metadata.rs`](https://github.com/astral-sh/uv/blob/0.12.12/crates/uv-build-backend/src/metadata.rs), and the Python 3.14 [`importlib.metadata`](https://docs.python.org/3.14/library/importlib.metadata.html) documentation and **v3.14.7** source.
> Target: **Python 3.14.7** · **uv 0.12.12** · ruff 0.16.6 · pre-commit 4.6.2. Documentation-validated — **no sandbox run, no program output**. The design recommendations here are this page's, and are labelled as such.

**The Python Packaging User Guide lists three ways for an application to find plugins it has never heard of: a naming convention, a namespace package, and package metadata. The first two work by importing things and seeing what is there; the third works by reading `entry_points.txt` and importing only what is asked for. Metadata is the one the big hosts use — pytest, flake8 and pipx among them — because it decouples *finding* from *importing*. But the mechanism only supplies a string match. Everything that makes a plugin system robust is the host's responsibility: choosing a group name nobody else will use, defining what a plugin must be, loading lazily, containing failures, deciding what two plugins with one name mean, and letting a user turn autoloading off when an installed package misbehaves.**

## The three approaches, from the guide

> *"There are three major approaches to doing automatic plugin discovery: Using naming convention. Using namespace packages. Using package metadata."*
> — [Creating and discovering plugins](https://packaging.python.org/en/latest/guides/creating-and-discovering-plugins/)

**Naming convention.** Scan every top-level module and import the ones with the right prefix — the guide's example, verbatim:

```python
import importlib
import pkgutil

discovered_plugins = {
    name: importlib.import_module(name)
    for finder, name, ispkg
    in pkgutil.iter_modules()
    if name.startswith('flask_')
}
```

Discovery *is* importing, so every matching module is imported whether it is used or not, and anything that happens to match the prefix is treated as a plugin.

**Namespace package.** Plugins install modules into a shared namespace such as `myapp.plugins`, and the host iterates it with `pkgutil.iter_modules(ns_pkg.__path__, ns_pkg.__name__ + ".")`. The guide attaches a warning to the obvious variant:

> *"it's not recommended to make your project's main top-level package (`myapp` in this case) a namespace package for the purpose of plugins, as one bad plugin could cause the entire namespace to break which would in turn make your project unimportable."*

**Package metadata.** Each plugin declares an entry in a group; the host reads the group:

```toml
# the plugin's pyproject.toml
[project.entry-points."invoice_service.exporters"]
xlsx = "invoice_plugin_xlsx:XlsxExporter"
```

```python
# the host
from importlib.metadata import entry_points

discovered = entry_points(group="invoice_service.exporters")   # imports nothing
```

> *"By specifying them, a package announces that it contains a specific kind of plugin. Another package supporting this kind of plugin can use the metadata to discover that plugin."*

| | Naming convention | Namespace package | Entry points |
|---|---|---|---|
| Discovery imports plugins | yes, all matches | yes, all members | no — only on `load()` |
| Plugin chooses its import name | no — prefix required | no — must live in the namespace | yes |
| A broken plugin can break the host import | yes | yes (worst if the host's own package is the namespace) | only when loaded, and catchable |
| One distribution can register many plugins | one module each | one module each | any number, any groups |
| Needs installed metadata | no | no | yes — a checkout that was never installed has none |

## Owning the group name

The specification sets the syntax and a convention for avoiding collisions:

> *"The consumer typically defines the expected interface. To avoid clashes, consumers defining a new group should use names starting with a PyPI name owned by the consumer project, followed by `.`. Group names must be one or more groups of letters, numbers and underscores, separated by dots (regex `^\w+(\.\w+)*$`)."*
> — [entry points specification](https://packaging.python.org/en/latest/specifications/entry-points/)

Two consequences people trip on. The regex has no hyphen, so a group cannot be `invoice-service.exporters` even though the distribution is `invoice-service` — use the import name. uv's build backend enforces it with *"Entrypoint groups must consist of letters and numbers separated by dots, invalid group: {0}"*. And the dots are part of one name, so in TOML the group must be quoted, because the pyproject specification says *"Users MUST NOT create nested sub-tables but instead keep the entry point groups to only one level deep"* — `[project.entry-points.invoice_service.exporters]` unquoted is exactly such a nested table ([topic 01](../01-pyproject-toml/10-entry-points-and-console-scripts.md)).

uv's documentation gives the same advice in weaker form: *"The `group` key can be an arbitrary value, it does not need to include the package name or "plugins". However, it is recommended to namespace the key by the package name to avoid collisions with other packages."*

## Defining what a plugin is

The specification leaves the interface to the host — *"The consumer typically defines the expected interface."* A host that states it in code gets checkable errors instead of `AttributeError` three calls deep. The pattern this page recommends:

```python
# src/invoice_service/exporters/api.py
from typing import Protocol, runtime_checkable

API_VERSION = 1


@runtime_checkable
class Exporter(Protocol):
    api_version: int
    file_suffix: str

    def export(self, invoices: list[dict], destination: str) -> None: ...
```

```python
# src/invoice_service/exporters/registry.py
import logging
from importlib.metadata import EntryPoint, entry_points

from invoice_service.exporters.api import API_VERSION, Exporter

GROUP = "invoice_service.exporters"
log = logging.getLogger(__name__)


class PluginError(Exception):
    pass


def _entries() -> dict[str, list[EntryPoint]]:
    by_name: dict[str, list[EntryPoint]] = {}
    for ep in entry_points(group=GROUP):
        by_name.setdefault(ep.name, []).append(ep)
    return by_name


def names() -> list[str]:
    return sorted(_entries())


def load(name: str) -> Exporter:
    candidates = _entries().get(name, [])
    if not candidates:
        raise PluginError(f"no exporter named {name!r}; installed: {', '.join(names()) or 'none'}")
    if len(candidates) > 1:
        owners = ", ".join(ep.dist.name if ep.dist else "?" for ep in candidates)
        raise PluginError(f"exporter {name!r} is provided by several packages: {owners}")
    (ep,) = candidates
    try:
        factory = ep.load()
        exporter = factory()
    except Exception as exc:
        owner = ep.dist.name if ep.dist else "unknown"
        raise PluginError(f"exporter {name!r} from {owner} failed to load: {exc}") from exc
    if not isinstance(exporter, Exporter) or exporter.api_version != API_VERSION:
        raise PluginError(f"exporter {name!r} ({ep.value}) does not implement API v{API_VERSION}")
    return exporter
```

What each piece answers:

- **Duplicates.** The specification hands the decision to the host — *"If different distributions provide the same name, the consumer decides how to handle such conflicts"* — and `EntryPoints[name]` would silently pick the first. Refusing, and naming both distributions, turns a silent choice into an actionable error.
- **Failures.** `load()` raises whatever importing the plugin raises; wrapping it attributes the failure to a distribution the user can uninstall.
- **Interface drift.** A `runtime_checkable` protocol checks only that attributes exist, not their signatures, so the explicit `api_version` carries the compatibility promise. A breaking change can also move to a new group name (`invoice_service.exporters_v2`), which leaves old plugins invisible rather than broken.
- **Cost.** `names()` imports nothing, so help text and shell completion stay fast however many plugins are installed.

## Autoloading is running installed code

A host that loads every entry point in its group at start-up — pytest does, for `pytest11` — gives every installed distribution that registers in the group a way to run code inside the host's process. That is the feature, and it is also why one broken or hostile package can stop every run. pytest's answer is an off switch: plugins can be blocked by name with `-p no:NAME`, and autoloading turned off with `PYTEST_DISABLE_PLUGIN_AUTOLOAD` or, since pytest 8.4, `--disable-plugin-autoload` ([06b](06b-plugin-hosts-in-the-wild.md)). A host of your own should offer the same pair — an allow-list and a deny-list:

```python
import os

DISABLED = {n for n in os.environ.get("INVOICE_DISABLE_EXPORTERS", "").split(",") if n}


def names() -> list[str]:
    return sorted(n for n in _entries() if n not in DISABLED)
```

## Testing discovery without publishing a plugin

`EntryPoint` has a public constructor — the source's own docstring builds one with `EntryPoint(name=None, group=None, value='package.module:attr [extra1, extra2]')` — so a unit test can replace the host's lookup:

```python
# tests/test_registry.py
from importlib.metadata import EntryPoint, EntryPoints

from invoice_service.exporters import registry


class CsvExporter:
    api_version = 1
    file_suffix = ".csv"

    def export(self, invoices, destination):
        pass


def test_loads_a_declared_exporter(monkeypatch):
    fake = EntryPoints([EntryPoint(name="csv", value="tests.test_registry:CsvExporter",
                                   group=registry.GROUP)])
    monkeypatch.setattr(registry, "entry_points", lambda group: fake.select(group=group))
    assert registry.load("csv").file_suffix == ".csv"
```

For an end-to-end test, install a tiny real plugin into the test environment — a path dependency in the `dev` group — so its `entry_points.txt` exists. Its metadata is written at install time, so changing the plugin's entry points needs a reinstall (**09** *(not written yet)*).

```toml
[dependency-groups]
dev = ["invoice-plugin-example"]

[tool.uv.sources]
invoice-plugin-example = { path = "tests/plugins/example", editable = true }
```

## Gotchas

**★ Symptom: the plugin is installed, the host finds nothing, and nothing warns.** Cause: the group names do not match exactly — a typo, a hyphen instead of an underscore, or an unquoted TOML header that created nested tables instead of one dotted group. Fix: list the groups that actually exist, then quote the header.

```python
from importlib.metadata import entry_points

print(sorted(g for g in entry_points().groups if g.startswith("invoice")))
```

```toml
[project.entry-points."invoice_service.exporters"]
xlsx = "invoice_plugin_xlsx:XlsxExporter"
```

**★ Symptom: `uv build` fails with *"Entrypoint groups must consist of letters and numbers separated by dots, invalid group: invoice-service.exporters"*.** Cause: the specification's group regex `^\w+(\.\w+)*$` has no hyphen, and uv_build enforces it. Fix: build the group from the import name.

```toml
[project.entry-points."invoice_service.exporters"]
```

**★ Symptom: which of two installed plugins handles `--format xlsx` changes between machines.** Cause: two distributions register the same name and the host indexes `EntryPoints[name]`, which returns the first match. Fix: detect duplicates and refuse, as `registry.load` does above.

```python
if len(candidates) > 1:
    raise PluginError(f"exporter {name!r} is provided by several packages: {owners}")
```

**★ Symptom: after `pip install` of an unrelated package, the host crashes on start-up.** Cause: the host autoloads its group and that package registered a plugin that fails to import. Fix: load lazily where you can, contain failures where you cannot, and give users a switch.

```bash
INVOICE_DISABLE_EXPORTERS=xlsx invoice export --format csv
```

**Symptom: a naming-convention host is slow to start and imports modules that are not plugins.** Cause: `pkgutil.iter_modules()` plus `import_module` imports every match, and a prefix cannot tell a plugin from a module that merely shares it. Fix: move to an entry-point group, keeping the prefix scan only as a deprecated fallback.

```python
for ep in entry_points(group="invoice_service.exporters"):
    register(ep.name, ep)          # the import waits for ep.load()
```

**Symptom: one third-party plugin makes `import invoice_service` fail entirely.** Cause: the host's own top-level package was made a namespace package for plugins, which the guide warns lets *"one bad plugin … cause the entire namespace to break"*. Fix: a dedicated namespace sub-package — or, better, an entry-point group.

**Symptom: a plugin that worked with the last host release fails with `AttributeError` inside the host.** Cause: the host changed the interface and nothing checked compatibility at load time. Fix: carry an explicit API version and check it in `load`, or move breaking changes to a new group.

```python
if exporter.api_version != API_VERSION:
    raise PluginError(f"exporter {name!r} targets API v{exporter.api_version}")
```

**Symptom: a plugin under development is edited to add a second exporter, and the host never sees it.** Cause: `entry_points.txt` was written when the plugin was installed, and an editable install makes code live, not metadata. Fix: reinstall the plugin (**09** *(not written yet)*).

```bash
uv sync --reinstall-package invoice-plugin-example
```

## Interview questions

**★ What are the three ways to discover plugins, and why did entry points win?**
A naming convention (import every top-level module with a prefix), a namespace package (import every module installed under a shared package), and package metadata (read an entry-point group). The first two discover by importing, so every candidate costs an import and a broken one can break discovery. Entry points separate finding from importing: the host reads strings from installed metadata, shows or validates them, and imports only the plugin it needs. They also let one distribution register any number of plugins in any number of groups, under any import name.

**★ What should a host do when a plugin fails to load?**
Contain it and attribute it. `EntryPoint.load()` raises whatever importing the plugin raises, so a host that loads plugins in a bare loop lets any installed package take the whole application down. Wrap each `load()`, report the plugin name and `ep.dist.name` — the distribution the user can uninstall — and decide by policy whether a failure is fatal, a warning, or skipped. Loading lazily limits the blast radius to runs that actually use the broken plugin.

**Why must a group name start with a PyPI name you own, and why can't it contain a hyphen?**
The prefix is the specification's clash-avoidance convention: groups share one flat namespace across every installed distribution, and a PyPI name is the one identifier you are guaranteed to own. The hyphen is excluded by the grammar itself — *"letters, numbers and underscores, separated by dots"* — so a distribution named `invoice-service` has to use its import name, `invoice_service`, as the prefix. uv's build backend rejects a hyphenated group outright.

**Two installed packages register a plugin with the same name. What happens?**
Whatever the host decides — the specification says *"the consumer decides how to handle such conflicts"*. `importlib.metadata` returns both entry points; `EntryPoints[name]` returns the first in `sys.path` order, which is an accident of installation, not a policy. A robust host detects the duplicate and either refuses with both distribution names, or namespaces plugin names so collisions cannot happen.

**Why is autoloading plugins a risk, and how do real hosts mitigate it?**
Because installing a distribution that registers in the group is enough for its code to run inside the host process on every start — there is no opt-in step. A plugin that fails to import, or that does something expensive or hostile at import time, affects every run. pytest mitigates it with a deny-list (`-p no:NAME`) and a global off switch (`PYTEST_DISABLE_PLUGIN_AUTOLOAD`, and `--disable-plugin-autoload` since 8.4). A host of your own should offer both.

**How do you test plugin discovery without publishing a plugin?**
At the unit level, construct `EntryPoint` objects — the constructor is public — wrap them in `EntryPoints`, and substitute them for the host's lookup, so the test controls exactly which entries exist. At the integration level, install a small real plugin into the test environment as a path dependency, which creates genuine `entry_points.txt` metadata; remember that editing that plugin's entry points needs a reinstall, because metadata is written at install time.

---

← Prev: [05 · Reading entry points at runtime](05-reading-entry-points-at-runtime.md) · [Topic index](README.md) · Next → [06b · Plugin hosts in the wild](06b-plugin-hosts-in-the-wild.md)
