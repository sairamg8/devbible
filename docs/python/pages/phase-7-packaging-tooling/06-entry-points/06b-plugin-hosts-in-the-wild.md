---
title: "pytest, flake8 and pipx each read entry points differently — pytest autoloads every pytest11 module and gives you three ways to stop it, flake8 treats the entry-point name as an error-code prefix and silently deactivates duplicates, and pipx reads a pipx.run group so the command name need not match the package — and each choice is a lesson for your own host"
sidebar_label: "06b · Plugin hosts in the wild"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against pytest **9.1.1** — *Writing plugins* and *How to install and use plugins* ([docs.pytest.org](https://docs.pytest.org/en/stable/how-to/writing_plugins.html); raw [`writing_plugins.rst`](https://github.com/pytest-dev/pytest/blob/9.1.1/doc/en/how-to/writing_plugins.rst) and [`plugins.rst`](https://github.com/pytest-dev/pytest/blob/9.1.1/doc/en/how-to/plugins.rst)) and its [`pyproject.toml`](https://github.com/pytest-dev/pytest/blob/9.1.1/pyproject.toml); flake8 **7.3.0** — *Registering a plugin* ([flake8.pycqa.org](https://flake8.pycqa.org/en/latest/plugin-development/registering-plugins.html)), [`plugins/finder.py`](https://github.com/PyCQA/flake8/blob/7.3.0/src/flake8/plugins/finder.py) and [`setup.cfg`](https://github.com/PyCQA/flake8/blob/7.3.0/setup.cfg); pipx **1.17.2** — *Making packages compatible* ([pipx.pypa.io](https://pipx.pypa.io/stable/explanation/making-packages-compatible/)); *Creating and packaging command-line tools* ([packaging.python.org](https://packaging.python.org/en/latest/guides/creating-command-line-tools/)).
> Target: **Python 3.14.7** · uv 0.12.12 · ruff 0.16.6 · pre-commit 4.6.2. Documentation- and source-validated — **no sandbox run, no program output**.

**The mechanism in [06](06-plugin-discovery-patterns.md) is a string match; the hosts people actually use layer policy on top of it, and the policies differ in instructive ways. pytest loads every module registered in `pytest11` on every run, so installing a package is enough to change how your tests execute — and pytest provides a deny-list, an allow-list mode and a global off switch for exactly that reason. flake8 gives the entry-point *name* a meaning — it is the error-code prefix the plugin reports — so two plugins that pick the same prefix collide, and the documentation warns the loser is deactivated without warning. pipx uses a group of its own, `pipx.run`, to fix a naming problem rather than to load plugins. Reading how each host behaves is the fastest way to decide what yours should do.**

## pytest: autoload everything in `pytest11`

> *"pytest looks up the ``pytest11`` entrypoint to discover its plugins, thus you can make your plugin available by defining it in your ``pyproject.toml`` file."*
> — [Writing plugins](https://docs.pytest.org/en/stable/how-to/writing_plugins.html)

The documentation's example registers a *module*, not an attribute — pytest collects hooks from the whole module:

```toml
[project]
name = "myproject"
classifiers = [
    "Framework :: Pytest",
]

[project.entry-points.pytest11]
myproject = "myproject.pluginmodule"
```

`pytest11` has no dot, so this header needs no quoting — unlike any group name of your own that follows the specification's `prefix.name` convention.

Discovery is unconditional. From *How to install and use plugins*: *"If a plugin is installed, ``pytest`` automatically finds and integrates it, there is no need to activate it."* The documented start-up order shows where entry points sit among the other plugin sources:

> *"``pytest`` loads plugin modules at tool startup in the following way:"*
>
> 1. *"by scanning the command line for the ``-p no:name`` option and blocking that plugin from being loaded (even builtin plugins can be blocked this way). This happens before normal command-line parsing."*
> 2. *"by loading all builtin plugins."*
> 3. *"by scanning the command line for the ``-p name`` option and loading the specified plugin. This happens before normal command-line parsing."*
> 4. *"by loading all plugins registered through installed third-party package entry points, unless the PYTEST_DISABLE_PLUGIN_AUTOLOAD environment variable is set."*
> 5. *"by loading all plugins specified through the PYTEST_PLUGINS environment variable."*
>
> — [Writing plugins → Plugin discovery order at tool startup](https://docs.pytest.org/en/stable/how-to/writing_plugins.html)

Then local `conftest.py` files. The controls, all from the same two pages:

```bash
pytest --trace-config                              # show activated plugins and their names
pytest -p no:NAME                                  # block one plugin by name, builtins included
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTEST_PLUGINS=myproject.pluginmodule pytest   # allow-list by module
pytest --disable-plugin-autoload -p NAME           # the same as a flag, since pytest 8.4
```

The documentation describes `-p` as loading *"(or disables with ``-p no:<name>``) a plugin by name or entry point"*, and `PYTEST_PLUGINS` as *"a comma-separated list of Python modules that are imported and registered as plugins"* — so the two take different kinds of name, and neither is necessarily the distribution name. `--trace-config` shows *"activated plugins and their names"*; run it first. For a permanent setting the documentation shows `addopts` in the configuration file, and for one environment only it points to `PYTEST_ADDOPTS`.

**The lesson for your own host:** pytest can afford to autoload because it ships the escape hatches with it. The deny-list handles one bad plugin; the autoload switch plus an explicit list turns the host into an allow-list for CI, where an unexpected package in the environment should not change results.

## flake8: the name is the error code

flake8 reads two groups:

> *"|Flake8| presently looks at two groups: ``flake8.extension`` … ``flake8.report``"*

and gives the entry-point name a job. A checker registered as `X101` reports code `X101`; registered as `X1`, it owns every code starting with `X1`:

> *"In this case as well as the following case, your entry-point name acts as a prefix to the error codes produced by your plugin."*

Which makes the name a shared, global resource — and the documentation says what happens when two plugins claim one:

> *"|Flake8| requires each entry point to be unique amongst all plugins installed in the users environment. Selecting an entry point that is already used can cause plugins to be deactivated without warning!"*
> — [Registering a plugin](https://flake8.pycqa.org/en/latest/plugin-development/registering-plugins.html)

flake8 also eats its own cooking. Its `setup.cfg` at 7.3.0 registers the built-in checkers through the same groups a third-party plugin uses:

```ini
[options.entry_points]
console_scripts =
    flake8 = flake8.main.cli:main
flake8.extension =
    F = flake8.plugins.pyflakes:FlakesChecker
    E = flake8.plugins.pycodestyle:pycodestyle_logical
    W = flake8.plugins.pycodestyle:pycodestyle_physical
flake8.report =
    default = flake8.formatting.default:Default
    pylint = flake8.formatting.default:Pylint
    quiet-filename = flake8.formatting.default:FilenameOnly
    quiet-nothing = flake8.formatting.default:Nothing
```

So `F`, `E` and `W` are entry-point names like any other, and a plugin that registered `E` would be competing with pycodestyle for the prefix. The finder, `plugins/finder.py`, shows two defensive decisions worth copying:

```python
def _find_importlib_plugins() -> Generator[Plugin]:
    # some misconfigured pythons (RHEL) have things on `sys.path` twice
    seen = set()
    for dist in importlib.metadata.distributions():
        # assigned to prevent continual reparsing
        eps = dist.entry_points

        # perf: skip parsing `.metadata` (slow) if no entry points match
        if not any(ep.group in FLAKE8_GROUPS for ep in eps):
            continue

        # assigned to prevent continual reparsing
        meta = dist.metadata

        if meta["name"] in seen:
            continue
        else:
            seen.add(meta["name"])
```

It deduplicates distributions by name because the same distribution can be visible twice, and it reads a distribution's full metadata only after its entry points prove relevant — the same principle as iterate-cheaply, load-lazily, applied one level down. The same function also refuses known-obsolete plugins with a warning, from a `BANNED_PLUGINS` table.

**The lessons:** a name that carries meaning — here an error-code prefix — needs collision detection, not first-come-first-served; and a host that walks every distribution should skip the expensive work for the ones that are not its plugins.

## pipx: a group that fixes a naming mismatch

`pipx run PACKAGE` has to guess which command to run, and its guess is the package name:

> *"When a user runs ``pipx run PACKAGE``, pipx looks for a console script matching the package name. If the package name and script name differ, the user has to write ``pipx run --spec PACKAGE SCRIPT``, which is less convenient."*

> *"Package authors can declare a ``pipx.run`` entry point group to tell pipx which function to invoke for ``pipx run``. This entry point takes priority over console scripts when present."*

> *"The build package uses this pattern so that ``pipx run build`` works even though build's console script is named ``pyproject-build``."*
> — all three [Making packages compatible](https://pipx.pypa.io/stable/explanation/making-packages-compatible/)

The packaging guide adds that the entry's name *"must match the package name"*:

```toml
[project.scripts]
invoice = "invoice_service.cli:main"

[project.entry-points."pipx.run"]
invoice-service = "invoice_service.cli:main"
```

Now `pipx install invoice-service` exposes `invoice`, and `pipx run invoice-service` runs the same function without `--spec`. This is a group read by a *tool*, not a plugin host — the same mechanism used to attach a small piece of configuration to a distribution. uv's `uvx` solves the same mismatch from the caller's side with `--from` (**08** *(not written yet)*); the sources read for this page show no `pipx.run`-style group in uv.

## Side by side

| Host | Group(s) | What the name means | Duplicate names | When plugins load | Off switch |
|---|---|---|---|---|---|
| pytest 9.1.1 | `pytest11` | the plugin's registered name | not covered here | every run, at start-up | `-p no:NAME`, `PYTEST_DISABLE_PLUGIN_AUTOLOAD`, `--disable-plugin-autoload` |
| flake8 7.3.0 | `flake8.extension`, `flake8.report` | error-code prefix / formatter name | *"can cause plugins to be deactivated without warning"* | every run | documentation read here names none beyond not installing |
| pipx 1.17.2 | `pipx.run` | the package name | — | `pipx run` only | — |
| your host ([06](06-plugin-discovery-patterns.md)) | `yourpkg.something` | yours to define | refuse and name both distributions | on demand | an allow- and deny-list |

## Gotchas

**★ Symptom: tests pass locally and fail in CI — or the reverse — with no code change.** Cause: pytest autoloads every installed `pytest11` plugin, and the two environments have different packages installed. Fix: pin plugins in the dev group, and make CI an explicit allow-list.

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTEST_PLUGINS=myproject.pluginmodule uv run pytest
```

**★ Symptom: a newly installed flake8 plugin's codes never appear, or an existing plugin's codes vanish after installing another one.** Cause: both registered the same entry-point name, and flake8 warns that this *"can cause plugins to be deactivated without warning"*. Fix: check which distributions claim which names, and choose a unique prefix for your own plugin.

```python
from importlib.metadata import entry_points

for ep in entry_points(group="flake8.extension"):
    print(ep.name, ep.value, ep.dist.name if ep.dist else "?")
```

**Symptom: `pytest -p no:myplugin` has no effect.** Cause: `-p no:` takes the plugin's name as pytest registered it, which is not necessarily the distribution name you installed. Fix: read the real name first.

```bash
pytest --trace-config
```

**Symptom: a pytest plugin under development loads from the editable install, but a newly added hook module is ignored.** Cause: the `pytest11` entry names a module, and its value was recorded when the plugin was installed; adding a second module means adding a second entry, which means reinstalling (**09** *(not written yet)*). Fix:

```bash
uv sync --reinstall-package myproject
```

**Symptom: `pipx run invoice-service` fails to find a command.** Cause: the package's only console script is `invoice`, and `pipx run` looks for one matching the package name. Fix: declare a `pipx.run` entry named after the package, or tell users the long form.

```toml
[project.entry-points."pipx.run"]
invoice-service = "invoice_service.cli:main"
```

**Symptom: a flake8 plugin registered as `E` changes the behaviour of built-in pycodestyle checks.** Cause: `E` is already flake8's own entry-point name for pycodestyle's logical-line checker, and names are the collision key. Fix: never reuse `F`, `E` or `W`; pick a prefix nobody ships.

```ini
flake8.extension =
    INV1 = flake8_invoice:InvoiceChecker
```

## Interview questions

**★ Why does pytest provide `PYTEST_DISABLE_PLUGIN_AUTOLOAD`, and when should you use it?**
Because pytest loads every installed `pytest11` plugin on every run without any opt-in — *"there is no need to activate it"* — so the set of installed packages silently becomes part of your test configuration. Disabling autoload and listing plugins explicitly with `PYTEST_PLUGINS` or `-p` makes the configuration explicit. It belongs in CI, where an extra package pulled in transitively should not change results, and in debugging, to rule plugins out.

**★ What does an entry-point *name* mean in flake8, and what does that teach about designing a host?**
It is the error-code prefix the checker owns — `X101` for one code, `X1` for a family. Giving the name meaning makes it a global resource shared by every installed plugin, and flake8's documentation admits that reusing one *"can cause plugins to be deactivated without warning"*. A host that attaches meaning to names needs to detect collisions and report both distributions, rather than letting installation order decide.

**Why do flake8's own built-in checks appear as entry points?**
Because flake8 registers pyflakes and pycodestyle through the same `flake8.extension` group that third-party plugins use — `F`, `E` and `W` in its own `setup.cfg`. That keeps one code path for built-in and external checks, and it means built-ins can be listed, selected and reported like any plugin. The cost is that built-in prefixes are ordinary names a careless plugin could collide with.

**What problem does the `pipx.run` group solve?**
The mismatch between a package name and its command name. `pipx run PACKAGE` looks for a console script named after the package, so a package whose command has a different name — `build` ships `pyproject-build` — would force users to write `pipx run --spec PACKAGE SCRIPT`. A `pipx.run` entry named after the package tells pipx which function to call, and pipx gives it priority over console scripts. It shows entry points used as per-distribution configuration for a tool, not only as plugin registration.

**Why does flake8 deduplicate distributions itself, when `importlib.metadata.entry_points()` already deduplicates?**
Because flake8 iterates `importlib.metadata.distributions()` directly — it needs each distribution's metadata alongside its entry points — and `distributions()` does not deduplicate; only the module-level `entry_points()` does. Its source comment names the cause: *"some misconfigured pythons (RHEL) have things on `sys.path` twice"*. A host that walks distributions itself inherits that duty.

---

← Prev: [06 · Plugin discovery patterns](06-plugin-discovery-patterns.md) · [Topic index](README.md) · Next → **07 · `uv run` and the project's own command** *(not written yet)*
