---
title: "[project.scripts] turns a function into a command on PATH by writing an object reference into entry_points.txt, and the two tables people reach for instead — console_scripts and gui_scripts under entry-points — are a MUST-level error precisely because they would be ambiguous"
sidebar_label: "10 · Entry points and scripts"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the PyPA *Entry points specification* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/entry-points/)), the *pyproject.toml specification* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/pyproject-toml/)), and *Writing your pyproject.toml* ([packaging.python.org](https://packaging.python.org/en/latest/guides/writing-pyproject-toml/)).
> Target: **Python 3.14.7**. Documentation-validated — **no sandbox run, no program output**.

**A console script is not a file you write. It is three metadata lines that the installer turns into an executable wrapper, and understanding that inversion explains everything odd about them: why the command exists only after installation, why it vanishes outside the virtual environment, why `python -m yourpkg` and `yourpkg` can behave differently, and why a script that "works when I run the file" fails as an installed command. The same mechanism, under a different group name, is how every plugin system in Python — pytest plugins, PEP 517 build backends, Flask extensions, `console_scripts` themselves — discovers code it has never heard of.**

## `[project.scripts]` — the whole mechanism in one sentence

The packaging guide says exactly what the installed command does:

> *"To install a command as part of your package, declare it in the `[project.scripts]` table... Executing this command will do the equivalent of `import sys; from spam import main_cli; sys.exit(main_cli())`."*

```toml
[project.scripts]
invoice = "invoice_service.cli:main"
```

```python
# src/invoice_service/cli.py
import argparse
import sys


def main() -> int:
    parser = argparse.ArgumentParser(prog="invoice")
    parser.add_argument("--customer", required=True)
    args = parser.parse_args()
    print(f"issuing invoice for {args.customer}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

Four facts follow directly from that quoted equivalence:

1. **The target is imported, not executed as a script.** Module-level code in `cli.py` runs at import time, before your function does. `if __name__ == "__main__":` is false in the wrapper, because the module is imported under its real name.
2. **The return value becomes the exit status.** `sys.exit(main_cli())` — so `return 1` is a failing command, `return None` is success (`sys.exit(None)` exits 0), and a bare `print` with no return is success.
3. **The function takes no arguments.** The wrapper calls it with none; `sys.argv` is how arguments arrive.
4. **An uncaught exception is a traceback, not an error message.** Nothing wraps the call in a handler.

## The object reference grammar

The value is not a free-form string:

> *"The **object reference** points to a Python object. It is either in the form `importable.module`, or `importable.module:object.attr`. Each of the parts delimited by dots and the colon is a valid Python identifier."*

So the colon separates *module path* from *attribute path*, and the attribute path may itself be dotted:

```toml
[project.scripts]
invoice = "invoice_service.cli:main"                 # module:function
invoice-admin = "invoice_service.admin:App.run"      # module:attribute.of.attribute
```

Whitespace around the colon is tolerated:

> *"Within a value, readers must accept and ignore spaces (including multiple consecutive spaces) before or after the colon, between the object reference and the left square bracket."*

⚠️ **The most common error is a dot where a colon belongs.** `"invoice_service.cli.main"` is a valid object reference — it means *import the module `invoice_service.cli.main`* — so it does not fail validation. It fails at run time with a `ModuleNotFoundError` naming a module you never wrote.

### Command names are looser than module names

> *"The name may contain any characters except `=`, but it cannot start or end with any whitespace character, or start with `[`. For new entry points, it is recommended to use only letters, numbers, underscores, dots and dashes (regex `[\w.-]+`)."*

Which is why a hyphenated command name is fine even though a hyphenated identifier is not:

```toml
[project.scripts]
invoice-sync = "invoice_service.sync:main"
```

## What the installer actually creates

> *"Entry points are defined in a file called `entry_points.txt` in the `*.dist-info` directory of the distribution."*

> *"Install tools are expected to set up wrappers for both `console_scripts` and `gui_scripts` in the scripts directory of the install scheme."*

So `[project.scripts]` becomes a `console_scripts` section in `entry_points.txt`, and the installer reads that and writes an executable into the environment's scripts directory (`.venv/bin` on POSIX, `.venv\Scripts` on Windows). Illustrating the intermediate file:

```text
[console_scripts]
invoice = invoice_service.cli:main
```

(the mapping the two quoted sentences define, rendered for clarity — not captured output)

Three consequences that account for most confusion:

- **The command exists per environment.** Installing into a venv puts the wrapper in that venv's scripts directory only. Deactivate and the command is gone — which is correct, not broken.
- **`pip install -e .` still creates it,** because the wrapper is generated from metadata and the metadata exists in an editable install too. But *changing* the entry point requires reinstalling, since the wrapper is a real file.
- **The wrapper hard-codes an interpreter path.** Moving or renaming a virtual environment breaks every console script in it, because the shebang points at an interpreter that is no longer at that path.

## `gui-scripts` and the difference that only exists on Windows

```toml
[project.gui-scripts]
invoice-desktop = "invoice_service.gui:main"
```

On POSIX the distinction is largely nominal. On Windows the installer generates a different launcher — one that does not allocate a console window — so a GUI application declared under `[project.scripts]` opens a stray console behind it, and a console tool declared under `[project.gui-scripts]` has nowhere to print. The specification only requires that installers *"set up wrappers for both"*; the behavioural difference is the launcher's, and it is real enough that getting the table wrong is a visible bug on one platform and invisible on the others.

## `[project.entry-points]` — the plugin mechanism

Arbitrary groups, for code that other packages discover:

```toml
[project.entry-points."invoice_service.exporters"]
csv = "invoice_service.exporters.csv:CsvExporter"
xlsx = "invoice_plugin_xlsx:XlsxExporter"

[project.entry-points."pytest11"]
invoice_fixtures = "invoice_service.testing.fixtures"
```

> *"The key of the table is the name of the entry point and the value is the object reference."*

The group name is quoted in TOML whenever it contains a dot — otherwise `"invoice_service.exporters"` would be parsed as nested tables. Reading them back is stdlib:

```python
from importlib.metadata import entry_points

for ep in entry_points(group="invoice_service.exporters"):
    exporter_cls = ep.load()          # imports the module and resolves the attribute
    print(ep.name, exporter_cls)
```

`ep.load()` is where the import actually happens — which is the point of the whole design. Your host package knows the *group* name and nothing else; the plugin's import path arrives as data from an installed distribution's metadata.

### The one construct the spec forbids

> *"Build back-ends MUST raise an error if the metadata defines a `[project.entry-points.console_scripts]` or `[project.entry-points.gui_scripts]` table, as they would be ambiguous."*

```toml
# 🔴 MUST be an error — two ways to say the same thing
[project.entry-points.console_scripts]
invoice = "invoice_service.cli:main"

# ✅ the only spelling
[project.scripts]
invoice = "invoice_service.cli:main"
```

The ambiguity is that `[project.scripts]` *becomes* the `console_scripts` group, so writing both would leave a backend deciding which wins. Making it a MUST-level error removes the decision.

⚠️ Note the underscore/hyphen asymmetry: the forbidden group names use underscores (`console_scripts`), because that is the historical group name in `entry_points.txt`, while the `[project]` keys use hyphens (`gui-scripts`). Both spellings are correct in their own place.

## `python -m` is a different door to the same house

```python
# src/invoice_service/__main__.py
from invoice_service.cli import main

if __name__ == "__main__":
    raise SystemExit(main())
```

`python -m invoice_service` needs no installation of a wrapper and no scripts directory on `PATH` — it needs only that the package is importable. It is the escape hatch when `PATH` is wrong, when the venv was moved, or when you are inside a container with no shell profile. Shipping both costs four lines and removes a whole class of support question. Deeper treatment of the console-script surface belongs to [06 · Entry points](../06-entry-points/README.md).

## Gotchas

**★ Symptom: `invoice: command not found` immediately after a successful `pip install .`.** Cause: the wrapper was written into an environment whose scripts directory is not on `PATH` — typically a venv you did not activate, or a `pip install --user` on a system where `~/.local/bin` is unlisted. Fix: run it through the environment rather than through `PATH`, and confirm what got installed.

```bash
.venv/bin/invoice --customer acme        # POSIX
python -m invoice_service --customer acme   # works with no scripts dir at all
```

**★ Symptom: `ModuleNotFoundError: No module named 'invoice_service.cli.main'`.** Cause: a dot where the colon belongs. `"invoice_service.cli.main"` is a *valid* object reference meaning "import that module", so nothing rejects it at build time. Fix:

```toml
[project.scripts]
invoice = "invoice_service.cli:main"
```

**★ Symptom: the command runs your module's top-level code but not your function.** Cause: the wrapper *imports* the module, so anything at module scope executes, and your `if __name__ == "__main__":` guard is false because the module is imported under its own name. Fix: put the work in the function named by the entry point, and keep the guard only for direct execution.

```python
def main() -> int:
    run()
    return 0


if __name__ == "__main__":       # only for `python cli.py`
    raise SystemExit(main())
```

**★ Symptom: your command always exits 0, even on failure, and CI never fails.** Cause: the wrapper does `sys.exit(main_cli())`, so a function that prints an error and returns `None` exits successfully. Fix: return a non-zero int, or raise `SystemExit`.

```python
def main() -> int:
    if not config_exists():
        print("no config found", file=sys.stderr)
        return 2
    return 0
```

**★ Symptom: `TypeError: main() takes 1 positional argument but 0 were given`.** Cause: the wrapper calls the target with no arguments — an entry point cannot pass `argv`. Fix: accept nothing and read `sys.argv` inside, keeping an injectable parameter optional for tests.

```python
def main(argv: list[str] | None = None) -> int:
    args = parser.parse_args(argv)      # None → sys.argv[1:]
    return 0
```

**★ Symptom: you renamed the command in `pyproject.toml` and the old one still works.** Cause: the wrapper is a real file created at install time; editing metadata does not delete it, and an editable install does not regenerate it on import. Fix: reinstall, and remove the stale wrapper if it lingers.

```bash
pip install -e . --force-reinstall
```

**★ Symptom: every console script in a virtual environment breaks after you rename or move the project directory.** Cause: the generated wrapper embeds an absolute interpreter path in its shebang, and that path no longer exists. Fix: recreate the environment — a venv is not relocatable, and this is the most common way people discover it.

**★ Symptom: a build fails with an ambiguity error mentioning `console_scripts`.** Cause: `[project.entry-points.console_scripts]`, which backends MUST reject. Fix: `[project.scripts]`, which is the same group under its official key.

**★ Symptom: your GUI application flashes a console window on Windows.** Cause: declared under `[project.scripts]`, so the installer generated a console launcher. Fix: `[project.gui-scripts]`. The change is invisible on Linux and macOS, which is why it survives review.

**★ Symptom: `[project.entry-points.invoice_service.exporters]` creates a group you cannot find.** Cause: unquoted dots in a TOML table header are nesting, so that declares a group named `exporters` inside a table named `invoice_service`. Fix: quote the whole group name.

```toml
[project.entry-points."invoice_service.exporters"]
csv = "invoice_service.exporters.csv:CsvExporter"
```

**★ Symptom: your plugin host discovers nothing, and the plugin is definitely installed.** Cause: almost always a group-name mismatch between what the plugin declares and what the host queries — they are matched as exact strings and nothing warns about an orphan group. Fix: read the metadata directly rather than debugging through the host.

```python
from importlib.metadata import entry_points

print(sorted({ep.group for ep in entry_points()}))   # every group actually installed
```

**★ Symptom: importing your package is slow, and it got slow when you added a plugin system.** Cause: iterating entry points is cheap but `ep.load()` imports the target module — so a host that loads every plugin at import time pays for every plugin's imports. Fix: iterate eagerly, load lazily.

```python
def get_exporter(name: str):
    (ep,) = (e for e in entry_points(group="invoice_service.exporters") if e.name == name)
    return ep.load()          # only the one asked for
```

## Interview questions

**★ What does `[project.scripts]` actually create, and when?**
It creates two things at two different times. At build time the backend writes a `console_scripts` section into `entry_points.txt` inside the distribution's `.dist-info` directory — that is metadata, not an executable. At install time the installer reads that and generates a real executable wrapper in the environment's scripts directory, which the guide describes as doing *"the equivalent of `import sys; from spam import main_cli; sys.exit(main_cli())`"*. So the command is per-environment, exists only after installation, and cannot be changed by editing `pyproject.toml` without reinstalling.

**★ Why is `[project.entry-points.console_scripts]` an error rather than an alias?**
Because `[project.scripts]` already *is* the `console_scripts` group. Allowing both would mean two source-level ways to write one metadata group, and a backend seeing both would have to pick a precedence rule the specification never defined. The spec closes it as a MUST: back-ends *"MUST raise an error if the metadata defines a `[project.entry-points.console_scripts]` or `[project.entry-points.gui_scripts]` table, as they would be ambiguous."* It is a good example of a spec preventing a class of silent disagreement between tools rather than documenting a winner.

**★ Why does module-level code in your CLI module run before your entry-point function?**
Because the wrapper imports the module to reach the attribute. Import executes the module body top to bottom, so a `logging.basicConfig()` call, a database connection, or an expensive constant computation at module scope all happen before your function is entered — and they also happen if the module is imported for any other reason, such as by your test suite. It is also why `if __name__ == "__main__":` does not fire: the module is imported under its real dotted name, not as `__main__`. Anything that must happen only when the command runs belongs inside the function.

**★ How does an entry point make a plugin system work without the host knowing the plugin exists?**
The host agrees on a *group name* and nothing else. Each plugin declares an entry in that group in its own `pyproject.toml`, and at install time the backend writes it into that plugin's `entry_points.txt`. The host then calls `importlib.metadata.entry_points(group=...)`, which scans installed distributions' metadata and returns the matching entries, and `ep.load()` performs the import. So the coupling is a string, resolved through metadata written by a third party — no registry, no configuration file to edit, and no import of the plugin until the host asks for it. That is exactly how pytest finds plugins and how pip finds a PEP 517 backend.

**★ Should you ship a `__main__.py` as well as a console script?**
Yes, in almost every case, because they fail independently. A console script depends on the scripts directory being on `PATH` and on the venv not having been moved, and neither is under your control. `python -m yourpackage` depends only on the package being importable, which is the same condition your library already requires — so it works inside containers with no shell profile, on Windows where `Scripts` may be unlisted, and after a venv rename that broke every wrapper's shebang. The cost is four lines in `__main__.py` that delegate to the same function the entry point names.

**★ Why does `sys.exit(main())` matter more than it looks?**
Because it makes your function's return value the process exit status, and that is the only thing CI and shell scripts look at. A function that prints an error and returns `None` produces a successful process — `sys.exit(None)` exits 0 — so a broken run is indistinguishable from a good one to any caller. The discipline is to return an `int` from the entry-point function always, and to reserve exceptions for genuinely unexpected conditions, where the resulting traceback and non-zero exit are the right outcome.

**★ Why do all console scripts in a virtual environment break when the directory is renamed?**
Because each generated wrapper embeds an absolute path to the interpreter in its shebang line, chosen at install time. Rename the directory and that path no longer resolves, so the kernel cannot start the interpreter and every wrapper fails at once — usually with a "bad interpreter" message that names a path you recognise. There is nothing to repair in the metadata; the fix is to recreate the environment. It is the clearest demonstration that a console script is a real file generated for one specific environment, not a property of your package.

---

← Prev: [09 · authors, classifiers and urls](09-authors-classifiers-and-urls.md) · [Topic index](README.md) · Next → [11 · build-system and choosing a backend](11-build-system-and-choosing-a-backend.md)
