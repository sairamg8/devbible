---
title: "entry_points.txt is the contract between the build and every consumer — a case-sensitive INI file with = as the only delimiter, one section per group — so read it from the built wheel rather than from pyproject.toml, parse it with importlib.metadata rather than a plain ConfigParser, and never rely on the extras syntax it still permits"
sidebar_label: "01b · entry_points.txt"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the PyPA *Entry points specification* — *File format* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/entry-points/#file-format)) — and the *pyproject.toml specification* — `dynamic` ([packaging.python.org](https://packaging.python.org/en/latest/specifications/pyproject-toml/)); pipx **1.17.2** *Making packages compatible* ([pipx.pypa.io](https://pipx.pypa.io/stable/explanation/making-packages-compatible/)); source at named tags — uv **0.12.12** [`uv-build-backend/src/metadata.rs`](https://github.com/astral-sh/uv/blob/0.12.12/crates/uv-build-backend/src/metadata.rs) and [`uv-install-wheel/src/script.rs`](https://github.com/astral-sh/uv/blob/0.12.12/crates/uv-install-wheel/src/script.rs), pypa/installer **1.0.1** [`utils.py`](https://github.com/pypa/installer/blob/1.0.1/src/installer/utils.py), CPython **v3.14.7** [`importlib/metadata/__init__.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/importlib/metadata/__init__.py); the uv [CHANGELOG](https://github.com/astral-sh/uv/blob/0.12.12/changelogs/0.11.x.md).
> Target: **Python 3.14.7** · **uv 0.12.12** · ruff 0.16.6 · pre-commit 4.6.2. Documentation- and source-validated — **no sandbox run, no program output; the one INI sample below is the specification's own**.

**Between `pyproject.toml` and the wrapper on disk sits one small file, `entry_points.txt`, in the `.dist-info` directory of the wheel and then of the installed distribution. It is what installers read to write wrappers ([01](01-what-the-installer-writes.md)), what `importlib.metadata` reads for every plugin host ([05](05-reading-entry-points-at-runtime.md)), and the only thing that is the same whether the project was declared in `pyproject.toml`, `setup.cfg` or `setup.py`. Its format is deliberately narrow: INI as `configparser` reads it, except that names are case-sensitive and only `=` may separate a name from its value. Most trouble with it comes from treating it as wider than that — parsing it with a default `ConfigParser`, writing it by hand with `:`, trusting `pyproject.toml` to be the whole story when the specification now lets a backend add entries, or leaning on the extras syntax that installers are allowed to ignore.**

## The format, from the specification

> *"The file contents are in INI format, as read by Python's `configparser` module. However, configparser treats names as case-insensitive by default, whereas entry point names are case sensitive."*

> *"The entry points file must always use `=` to delimit names from values (whereas configparser also allows using `:`)."*

> *"The sections of the config file represent entry point groups, the names are names, and the values encode both the object reference and the optional extras. If extras are used, they are a comma-separated list inside square brackets."*

> *"Within a value, readers must accept and ignore spaces (including multiple consecutive spaces) before or after the colon, between the object reference and the left square bracket, between the extra names and the square brackets and colons delimiting them, and after the right square bracket. … For tools writing the file, it is recommended only to insert a space between the object reference and the left square bracket."*
> — all four [entry points specification](https://packaging.python.org/en/latest/specifications/entry-points/)

The specification's own example:

```ini
[console_scripts]
foo = foomod:main
# One which depends on extras:
foobar = foomod:main_bar [bar,baz]

# pytest plugins refer to a module, so there is no ':obj'
[pytest11]
nbval = nbval.plugin
```

And its advice for anyone parsing the file directly:

```python
import configparser

class CaseSensitiveConfigParser(configparser.ConfigParser):
    optionxform = staticmethod(str)
```

The installers follow it to the letter. pypa/installer 1.0.1 parses with `ConfigParser(delimiters="=")` and `optionxform = str` (`utils.py`, `parse_entrypoints`). uv's installer sets `case_sensitive = true` and `delimiters = vec!['=']` with the comment *"Per the Entry Points specification, `entry_points.txt` is a case-sensitive INI file that only uses `=` as the field delimiter"* (`script.rs`, lines 88–100), and its test suite includes `test_rejects_non_equals_entry_point_delimiters`, which feeds it `script: package.module:main` and expects an error — the change listed in uv 0.11.16 as *"Restrict delimiters in entry point parsing"*.

## How each declaration becomes the same file

`pyproject.toml` maps table by table: `[project.scripts]` becomes `[console_scripts]`, `[project.gui-scripts]` becomes `[gui_scripts]`, and each `[project.entry-points."group"]` becomes `[group]` ([topic 01](../01-pyproject-toml/10-entry-points-and-console-scripts.md)). uv's build backend does this in `to_entry_points` (`metadata.rs`, lines 874–900): console scripts first, then GUI scripts, then every other group, each written as a `[group]` header followed by one `name = object_reference` line per entry.

Older projects declare the same thing in setuptools' formats, and the file that comes out is identical. pipx's documentation shows all three side by side:

```ini
# setup.cfg
[options.entry_points]
console_scripts =
    foo = my_package.some_module:main_func
    bar = other_module:some_func
gui_scripts =
    baz = my_package_gui:start_func
```

```python
# setup.py
setup(
    # other arguments here...
    entry_points={
        "console_scripts": [
            "foo = my_package.some_module:main_func",
            "bar = other_module:some_func",
        ],
        "gui_scripts": [
            "baz = my_package_gui:start_func",
        ],
    },
)
```

So when you need to know what a distribution *really* declares — whatever it was written in — read `entry_points.txt`, not the source configuration.

## `pyproject.toml` is not always the whole story

The `dynamic` rules in the pyproject specification now name `scripts`, `gui-scripts` and `entry-points` among the keys that *"MAY be specified statically and listed in `dynamic` simultaneously"*, and say what a backend may then do:

> *"A build back-end MAY only append entries to the value; it MUST NOT remove, reorder, or modify any statically-specified entries. For tables (such as `optional-dependencies` or `entry-points`) this means a back-end MAY add new keys and MAY append to the values of existing keys (in the case of a list), but MUST NOT change or remove the entries given statically."*
> — [pyproject.toml specification — `dynamic`](https://packaging.python.org/en/latest/specifications/pyproject-toml/)

With a backend or plugin that uses this, the built wheel can declare commands that `pyproject.toml` does not show. uv's own backend declines the whole mechanism — its errors include *"Dynamic metadata is not supported"* — so with `uv_build` what you wrote is what you get. The dependable answer for any backend is the file in the wheel:

```python
# tools/wheel_entry_points.py — what a built wheel declares, without installing it
import configparser
import sys
import zipfile


class CaseSensitiveConfigParser(configparser.ConfigParser):
    optionxform = staticmethod(str)


def main(argv: list[str] | None = None) -> int:
    wheel_path = (argv or sys.argv[1:])[0]
    with zipfile.ZipFile(wheel_path) as wheel:
        names = [n for n in wheel.namelist() if n.endswith(".dist-info/entry_points.txt")]
        if not names:
            print("no entry_points.txt: this wheel declares no entry points")
            return 0
        parser = CaseSensitiveConfigParser(delimiters=("=",), interpolation=None)
        parser.read_string(wheel.read(names[0]).decode("utf-8"))
    for group in parser.sections():
        for name, value in parser.items(group):
            print(f"[{group}] {name} = {value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

`interpolation=None` stops `configparser` from treating a `%` in a value as a substitution; the specification does not mention interpolation, so turning it off is the conservative reading.

## Extras: allowed in the grammar, unreliable in practice

> *"Using extras for an entry point is no longer recommended. Consumers should support parsing them from existing distributions, but may then ignore them. New publishing tools need not support specifying extras. The functionality of handling extras was tied to setuptools' model of managing 'egg' packages, but newer tools such as pip and virtualenv use a different model."*
> — [entry points specification](https://packaging.python.org/en/latest/specifications/entry-points/)

"May then ignore them" is what happens, differently per tool. uv's installer, when it knows which extras were requested, *skips* a script whose extras are not all among them (`script.rs`, lines 39–49: the script is dropped when its extras are not a subset). pypa/installer's regex accepts an `[extras]` suffix and generates the wrapper regardless. `importlib.metadata` exposes them as `EntryPoint.extras` and does nothing else with them. A command that exists or not depending on the installer is worse than one that always exists and explains what is missing:

```python
import sys


def export_main() -> int:
    try:
        import openpyxl  # noqa: F401 — provided by the `xlsx` extra
    except ModuleNotFoundError:
        print("invoice-export needs the xlsx extra: uv tool install 'invoice-service[xlsx]'",
              file=sys.stderr)
        return 2
    from invoice_service.export import export_all
    return export_all()
```

## Names the build backend will and will not write

uv's backend validates names at build time, more strictly for scripts than for other groups (`metadata.rs`, lines 902–948). A script name must satisfy *"Script entry point name `{0}` must include a non-dot character and consist only of letters, numbers, dots, underscores and dashes"* — an error. Any other group only gets a warning: *"Entrypoint names should consist of letters, numbers, dots, underscores and dashes; non-compliant name: {name}"*. And the object reference itself carries a `TODO(konsti): Validate that the object references are valid Python identifiers.` — not checked at build time at all ([01](01-what-the-installer-writes.md)).

## Gotchas

**★ Symptom: your own code that reads `entry_points.txt` finds `MyPlugin` registered as `myplugin`.** Cause: a default `ConfigParser` lower-cases option names, and entry-point names are case-sensitive. Fix: use `importlib.metadata`, or the specification's case-sensitive parser.

```python
from importlib.metadata import entry_points

names = entry_points(group="invoice_service.exporters").names
```

**★ Symptom: uv refuses to install an old or hand-built wheel with an *"entry_points.txt is invalid"* error.** Cause: the file uses `name: value`, which `configparser` would accept but the specification forbids; uv enforces `=` only since 0.11.16. Fix: rebuild the wheel with a current backend, which writes `name = value`.

```bash
uv build --no-sources
```

**★ Symptom: a command declared with extras is present when one tool installs the wheel and missing when uv installs the same wheel.** Cause: extras on entry points are *"no longer recommended"* and consumers *"may then ignore them"* — uv skips scripts whose extras were not requested. Fix: remove the extras from the entry point and check for the optional dependency inside the function, as `export_main` does.

```toml
[project.scripts]
invoice-export = "invoice_service.cli:export_main"
```

**Symptom: the installed package has a command that appears nowhere in `pyproject.toml`.** Cause: the key is listed in `dynamic` and the backend appended entries, which the specification allows. Fix: read the wheel's `entry_points.txt` to see what is really declared.

```bash
uv build && python3 tools/wheel_entry_points.py dist/invoice_service-1.4.0-py3-none-any.whl
```

**Symptom: `uv build` fails with *"Script entry point name `invoice tool` must include a non-dot character and consist only of letters, numbers, dots, underscores and dashes"*.** Cause: a space (or `+`, `@`, a lone `.`) in a `[project.scripts]` key; uv_build rejects it for scripts, where the name becomes a file. Fix:

```toml
[project.scripts]
invoice-tool = "invoice_service.tool:main"
```

**Symptom: a plugin group's odd entry name builds fine with uv but a warning scrolls past.** Cause: for non-script groups uv_build only warns about names outside `[\w.-]`. Fix: stay inside the specification's recommended characters so no consumer has to cope with the name.

## Interview questions

**★ What is `entry_points.txt`, and why is it the thing to inspect rather than `pyproject.toml`?**
It is the file in a distribution's `.dist-info` directory that holds every entry point, one INI section per group. Installers read its `console_scripts` and `gui_scripts` sections to write wrappers, and `importlib.metadata` reads all of it for plugin hosts. It is the common output of `pyproject.toml`, `setup.cfg` and `setup.py` declarations, and under the current `dynamic` rules a backend may append entries that the source configuration never lists — so the built or installed file is the authoritative answer to "what does this distribution declare".

**★ Why does the specification insist on `=` and case-sensitive names when `configparser` does neither by default?**
Because entry-point names are identifiers that consumers match exactly — a command name becomes a file name, a plugin name is looked up by string — and `configparser`'s defaults would lower-case them and accept `:` as a second delimiter, which also appears inside every object reference. The specification therefore defines the file as INI *as `configparser` reads it*, minus those two behaviours, and gives the case-sensitive subclass to use. uv and pypa/installer both configure their parsers exactly that way, and uv rejects a `:` delimiter outright.

**Why are extras on entry points discouraged, and what should a CLI do instead?**
The specification says the feature was tied to setuptools' egg model and lets consumers ignore extras entirely, so behaviour depends on the tool: uv drops a script whose extras were not requested, pypa/installer writes it anyway, `importlib.metadata` merely reports them. A command whose existence depends on the installer is a support problem. Declare the command unconditionally and check for the optional dependency when it runs, with an error message that names the extra to install.

**What does a build backend validate about entry points?**
With uv's backend: that groups match the specification's grammar, that script names use only letters, digits, dots, underscores and dashes (an error), that other names ideally do too (a warning), and that `console_scripts` and `gui_scripts` are not declared under `[project.entry-points]`. It does not validate object references — its source carries a TODO for that — so a missing colon or a nonexistent function is found by the installer or by the first run, not by the build.

---

← Prev: [01 · What the installer writes](01-what-the-installer-writes.md) · [Topic index](README.md) · Next → [02 · Windows launchers and GUI scripts](02-windows-launchers-and-gui-scripts.md)
