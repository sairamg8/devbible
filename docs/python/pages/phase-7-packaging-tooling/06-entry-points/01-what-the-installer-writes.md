---
title: "An installer turns one console_scripts line into a real file in the environment's scripts directory — a shebang frozen to that environment's interpreter, then a few lines that import your module and pass your function's return value to sys.exit — so the command exists only after installation, only in that environment, and only while that interpreter path stays valid"
sidebar_label: "01 · What the installer writes"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the PyPA *Entry points specification* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/entry-points/)), the *pyproject.toml specification* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/pyproject-toml/)), and installer source read at named tags — pip **26.2.1** [`operations/install/wheel.py`](https://github.com/pypa/pip/blob/26.2.1/src/pip/_internal/operations/install/wheel.py) with its vendored distlib 0.4.2 [`scripts.py`](https://github.com/pypa/pip/blob/26.2.1/src/pip/_vendor/distlib/scripts.py), pypa/installer **1.0.1** [`scripts.py`](https://github.com/pypa/installer/blob/1.0.1/src/installer/scripts.py), uv **0.12.12** [`uv-install-wheel/src/wheel.rs`](https://github.com/astral-sh/uv/blob/0.12.12/crates/uv-install-wheel/src/wheel.rs) and [`uv-build-backend/src/metadata.rs`](https://github.com/astral-sh/uv/blob/0.12.12/crates/uv-build-backend/src/metadata.rs), the uv [CHANGELOG](https://github.com/astral-sh/uv/blob/0.12.12/CHANGELOG.md) and [CLI reference](https://docs.astral.sh/uv/reference/cli/).
> Target: **Python 3.14.7** · **uv 0.12.12** · ruff 0.16.6 · pre-commit 4.6.2. Source-validated — **no sandbox run; the templates below are quoted from source, not captured from an install**.

**Nothing in your project is executable until an installer makes it so. The build backend writes a `console_scripts` section into `entry_points.txt` inside the wheel's `.dist-info` directory; at install time the installer reads that section and writes one real file per command into the environment's scripts directory. That file is small and completely predictable — its first line names the interpreter of the environment it was installed into, by absolute path, and its body imports your module and calls `sys.exit(your_function())`. Every "the command works on my machine" mystery is a property of that file: it is per-environment, it exists only after installation, it cannot follow a moved environment, and it lands in a directory the installer is explicitly not responsible for putting on `PATH`.**

## From one line of TOML to a file on disk

Topic 01 covers declaring the command ([entry points and console scripts](../01-pyproject-toml/10-entry-points-and-console-scripts.md)). The same declaration, through its two lifecycle stages:

```toml
# pyproject.toml
[project.scripts]
invoice = "invoice_service.cli:main"
```

**Build time.** The backend translates `[project.scripts]` into the `console_scripts` group — the pyproject specification says so directly:

> *"The `[project.scripts]` table corresponds to the `console_scripts` group in the entry points specification. The key of the table is the name of the entry point and the value is the object reference."*
> — [pyproject.toml specification](https://packaging.python.org/en/latest/specifications/pyproject-toml/)

and writes it to a metadata file:

> *"Entry points are defined in a file called `entry_points.txt` in the `*.dist-info` directory of the distribution."*
> — [entry points specification](https://packaging.python.org/en/latest/specifications/entry-points/)

**Install time.** The installer reads two groups — and only two — and generates files from them:

> *"Install tools are expected to set up wrappers for both `console_scripts` and `gui_scripts` in the scripts directory of the install scheme. They are not responsible for putting this directory in the `PATH` environment variable which defines where command-line tools are found."*
> — [entry points specification](https://packaging.python.org/en/latest/specifications/entry-points/)

Every other group in `entry_points.txt` — `pytest11`, `flake8.extension`, your own `invoice_service.exporters` — produces no file at all. It is data that sits in the `.dist-info` directory until some program asks for it at run time (**05** *(not written yet)*).

## The wrapper, as each installer writes it

The specification describes the wrapper in three lines:

> *"For instance, the entry point `mycmd = mymod:main` would create a command `mycmd` launching a script like this:"*

```python
import sys
from mymod import main
sys.exit(main())
```

Real installers add a shebang, a guard and some Windows bookkeeping. These are the templates, verbatim from source.

**pip 26.2.1** — `src/pip/_internal/operations/install/wheel.py`, lines 417–425:

```python
class PipScriptMaker(ScriptMaker):
    # Override distlib's default script template with one that
    # doesn't import `re` module, allowing scripts to load faster.
    script_template = textwrap.dedent("""\
        import sys
        from %(module)s import %(import_name)s
        if __name__ == '__main__':
            sys.argv[0] = sys.argv[0].removesuffix('.exe')
            sys.exit(%(func)s())
""")
```

**pypa/installer 1.0.1** — the reference library other tools embed, `src/installer/scripts.py`, lines 35–43:

```python
_SCRIPT_TEMPLATE = """\
# -*- coding: utf-8 -*-
import re
import sys
from {module} import {import_name}
if __name__ == "__main__":
    sys.argv[0] = re.sub(r"(-script\\.pyw|\\.exe)?$", "", sys.argv[0])
    sys.exit({func_path}())
"""
```

**uv 0.12.12** — `crates/uv-install-wheel/src/wheel.rs`, the `get_script_launcher` function (lines 28–53), whose doc comment reads *"Script template slightly modified: removed `import re`, allowing scripts that never import `re` to load faster."*:

```python
{shebang}
# -*- coding: utf-8 -*-
import sys
from {module} import {import_name}
if __name__ == "__main__":
    if sys.argv[0].endswith("-script.pyw"):
        sys.argv[0] = sys.argv[0][:-11]
    elif sys.argv[0].endswith(".exe"):
        sys.argv[0] = sys.argv[0][:-4]
    sys.exit({function}())
```

The placeholders fill in the same way in all three. For `invoice_service.cli:main`, *module* is `invoice_service.cli`, *import_name* is `main`, and the called expression is `main`. For a dotted attribute path the import takes only the first segment — installer's code is `import_name=self.attr.split(".")[0]`, uv's `import_name()` splits on the first dot — so `invoice_service.admin:App.run` imports `App` and calls `App.run()`.

| | pip 26.2.1 | installer 1.0.1 | uv 0.12.12 |
|---|---|---|---|
| imports `re` | no — removed *"allowing scripts to load faster"* | yes | no — removed in uv 0.5.19 |
| import of your module | before the guard | before the guard | before the guard |
| `argv[0]` clean-up | strips `.exe` | strips `-script.pyw` or `.exe` | strips `-script.pyw` or `.exe` |
| exit | `sys.exit(func())` | `sys.exit(func())` | `sys.exit(func())` |

Distlib's own template — the one pip overrides — puts the `from … import` *inside* the `if __name__ == '__main__':` block (vendored `scripts.py`, lines 44–50). None of the three templates above does, so importing a wrapper file as a module still imports your code; it just does not call it.

## Line by line: what runs when you type `invoice`

1. **The kernel reads the shebang** and starts the interpreter it names, passing the wrapper's path. That interpreter is the environment's own `python`, so `sys.prefix` is the environment and its `site-packages` is on `sys.path` — no activation involved.
2. **Python runs the wrapper as a script.** The command-line documentation states the consequence: *"If the script name refers directly to a Python file, the directory containing that file is added to the start of `sys.path`, and the file is executed as the `__main__` module"* ([cmdline](https://docs.python.org/3.14/using/cmdline.html)). So `sys.path[0]` is the scripts directory — `.venv/bin` — not your working directory. **04** *(not written yet)* is why that difference matters.
3. **`from invoice_service.cli import main`** imports your package, its `__init__.py`, the `cli` module and everything they import at module level. All of it runs before `main` does; **11** *(not written yet)* is what that costs.
4. **The guard is true** because the wrapper is `__main__`.
5. **`argv[0]` loses a Windows suffix**, so help text says `invoice`, not `invoice.exe` ([02](02-windows-launchers-and-gui-scripts.md)).
6. **`sys.exit(main())`** — whatever `main` returns becomes the process exit status. That contract is [03](03-the-function-contract.md).

## The shebang: an absolute path, or a `/bin/sh` trampoline

pip embeds the interpreter of the *target* environment, not the one running pip — lines 645–649 carry the comment *"Embed the target environment's interpreter in console-script launchers rather than the one running pip"*. The path is absolute, and it is written in one of two forms.

**Simple:** `#!` followed by the interpreter path, when the line is short enough and has no space in it. installer 1.0.1 (lines 125–130) and uv (`format_shebang`, lines 109–140) both use a 127-byte ceiling on every POSIX platform; pip's vendored distlib allows 512 on macOS and 127 elsewhere.

**Trampoline:** when the path is too long or contains a space, the file starts with `#!/bin/sh` and a second line that is valid as both shell and Python. The line uv writes, from `format_shebang`:

```rust
return format!("#!/bin/sh\n'''exec' {executable} \"$0\" \"$@\"\n' '''");
```

To `sh`, `'''exec'` is an empty string glued to `exec`, so the line is `exec <interpreter> "$0" "$@"` — re-run this file under Python with the original arguments. To Python, the same two lines are a triple-quoted string literal that does nothing. Distlib describes it as *"a contrived shebang which allows the script to run either under Python or sh, using suitable quoting"*. uv also uses this form for every wrapper in a relocatable environment, with the interpreter path computed from the script's own directory at run time.

Two operational facts follow. A trampoline wrapper **needs `/bin/sh` at run time**, which a minimal or distroless image may not have. And a simple wrapper **needs the interpreter at exactly the recorded path**, which a moved environment no longer has.

`uv venv --relocatable` exists for the second case:

> *"A relocatable virtual environment can be moved around and redistributed without invalidating its associated entrypoint and activation scripts."*

> *"Note that this can only be guaranteed for standard `console_scripts` and `gui_scripts`. Other scripts may be adjusted if they ship with a generic `#!python[w]` shebang, and binaries are left as-is."*
> — both [uv CLI reference](https://docs.astral.sh/uv/reference/cli/)

⚠️ uv's changelog lists *"Use relocatable virtual environments by default"* (0.9.30) and *"Make project environments relocatable under preview"* (0.11.24) under **preview features** only. Without preview, an environment is not relocatable unless you ask.

## Where the file lands, and who puts that on `PATH`

The *scripts directory of the install scheme* — `.venv/bin` on POSIX, `.venv\Scripts` on Windows, `~/.local/bin` for `pip install --user` on Linux. The specification puts `PATH` outside the installer's job, and pip's response is a warning rather than a change. From `message_about_scripts_not_on_PATH` (lines 120–168):

```python
msg_lines.append(
    f"The {start_text} installed in '{parent_dir}' which is not on PATH."
)
```

followed by *"Consider adding {} to PATH or, if you prefer to suppress this warning, use --no-warn-script-location."* pip deliberately skips the warning for the directory holding `sys.executable` — *"This covers the case of venv invocations without activating the venv"* — so installing into an unactivated venv prints nothing, and the command is still not on your `PATH`.

The wrapper is recorded in the distribution's `RECORD` like any other installed file — uv writes every wrapper through `write_file_recorded`, which appends a sha256 entry — and pip's uninstaller also removes scripts by entry-point name. Uninstalling removes the command; reinstalling rewrites it.

## Validation happens at install, not at build

uv's build backend checks command *names* and group names but not the object reference: `metadata.rs` line 943 is a `TODO(konsti): Validate that the object references are valid Python identifiers.` The installers are stricter about scripts, because a wrapper has to call something:

- **pip** raises `MissingCallableSuffix`: *"Invalid script entry point: {entry_point} - A callable suffix is required."*
- **uv** requires a colon in its `console_scripts` regex and fails with *"invalid console script: '{value}'"* (`script.rs`, lines 34–37).
- **installer** matches `(:\s*(?P<attrs>[\w.]+))` and asserts the attribute exists.

So `invoice = "invoice_service.cli.main"` — a dot where the colon belongs — can produce a wheel with uv_build and then fail when anyone installs it. The specification requires the callable for scripts: *"The object reference points to a function which will be called with no arguments when this command is run."* Whether hatchling or setuptools catch it at build time was not established here; do not rely on the backend.

Names are checked too. pip refuses a script name that *"would be installed outside the scripts directory"*; uv added the same check in 0.11.15, banned names like `python3` in 0.11.17, and in 0.12.0 began rejecting case variants such as `Python` because *"On case-insensitive filesystems, including common macOS and Windows setups, these entry points could overwrite the virtual environment's interpreter."* uv's changelog is blunt about it: *"You cannot opt out of these checks."*

## Gotchas

**★ Symptom: installation fails with *"Invalid script entry point: … A callable suffix is required"* (pip) or *"invalid console script"* (uv).** Cause: the `[project.scripts]` value has no colon, so it names a module, not a function — valid as an object reference, invalid for a script, and not caught by uv_build. Fix: separate module and function with a colon.

```toml
[project.scripts]
invoice = "invoice_service.cli:main"
```

**★ Symptom: every command in a virtual environment fails at once after the project directory was renamed or copied to another path.** Cause: each wrapper's shebang is an absolute interpreter path chosen at install time. Fix: recreate the environment, or create it relocatable if moving it is part of the workflow.

```bash
rm -rf .venv && uv sync --locked
uv venv --relocatable        # only if the environment itself must move
```

**★ Symptom: a command works in one image and fails in a slimmer one, although the environment was copied byte-for-byte.** Cause: the wrapper is the `#!/bin/sh` trampoline — the interpreter path was longer than 127 bytes, contained a space, or the environment is relocatable — and the slim image has no `/bin/sh`. Fix: start the program through the interpreter instead of the wrapper.

```dockerfile
ENTRYPOINT ["/app/.venv/bin/python", "-m", "invoice_service"]
```

**★ Symptom: `invoice: command not found`, although `.venv/bin/invoice` exists.** Cause: the scripts directory is not on `PATH`, and the specification makes that the user's job, not the installer's; pip does not even warn for an unactivated venv. Fix: run it through the environment.

```bash
uv run invoice --customer acme
.venv/bin/invoice --customer acme
```

**Symptom: `pip install --user` prints *"The script invoice is installed in '…/.local/bin' which is not on PATH."*** Cause: exactly what it says — the user scheme's scripts directory is missing from `PATH`. Fix: add it in your shell profile; suppressing the warning with `--no-warn-script-location` fixes nothing.

```bash
export PATH="$HOME/.local/bin:$PATH"
```

**Symptom: uv refuses to install a wheel whose command is named `python`, `Python` or `python3.14`.** Cause: since uv 0.12.0, reserved interpreter names are rejected case-insensitively, with no opt-out. Fix: rename the command and rebuild the wheel.

```toml
[project.scripts]
invoice-python = "invoice_service.shell:main"
```

**Symptom: your `[project.entry-points."invoice_service.exporters"]` entries never appear in `.venv/bin`.** Cause: installers write files for `console_scripts` and `gui_scripts` only; every other group is metadata read at run time. Fix: a command belongs in `[project.scripts]`.

```toml
[project.scripts]
invoice-export = "invoice_service.exporters.cli:main"
```

**Symptom: an environment variable you added to the wrapper file by hand is gone after the next install.** Cause: the wrapper is regenerated on every install — pip sets `clobber = True` (*"Ensure old scripts are overwritten"*) and uv writes it atomically. Fix: put the behaviour in your code, where it survives.

```python
import os


def main() -> int:
    os.environ.setdefault("INVOICE_ENV", "production")
    return run()
```

## Interview questions

**★ What exactly exists on disk after installing a package with `invoice = "invoice_service.cli:main"`?**
Two things, written at two different times. Inside the wheel, the build backend wrote a `console_scripts` section into `entry_points.txt` in the `.dist-info` directory — metadata, not an executable. At install time the installer read that section and wrote an executable file named `invoice` into the environment's scripts directory: a shebang naming that environment's interpreter by absolute path, then an import of `main` from `invoice_service.cli` and `sys.exit(main())`. The file is recorded in the distribution's `RECORD`, so uninstalling removes it. Nothing about it is shared between environments.

**★ Why does a console script not need the virtual environment to be activated?**
Because the shebang already names the environment's interpreter. Activation only prepends the scripts directory to `PATH` so you can type the command's short name; the wrapper itself starts the right Python regardless, and that Python's `sys.prefix` and `site-packages` belong to the environment. So `.venv/bin/invoice` works from any shell, activated or not — and a wrapper copied to another machine does not, because the path it names is not there.

**★ Why does moving a virtual environment break its commands, and what does `--relocatable` change?**
The installer writes the interpreter's absolute path into each wrapper at install time. Move the directory and every shebang points at a path that no longer exists. uv's `--relocatable` environments write the wrapper in the `/bin/sh` trampoline form with a path computed from the script's own location at run time, so the environment can move — but uv guarantees this only for `console_scripts` and `gui_scripts`, not for arbitrary scripts or binaries, and it is not the default outside preview.

**What decides whether a wrapper starts with `#!/path/to/python` or `#!/bin/sh`?**
Length, spaces and relocatability. If the interpreter path fits the shebang limit (127 bytes in installer and uv; distlib allows 512 on macOS) and contains no space, the simple form is used. Otherwise the file starts with `#!/bin/sh` and a line that `sh` reads as `exec <interpreter> "$0" "$@"` and Python reads as a string literal. uv also uses the trampoline for every relocatable environment. The practical consequence is a run-time dependency on `/bin/sh` that appears or disappears with the length of a directory name.

**Why did pip and uv remove `import re` from their templates?**
Speed. Both sources say so: pip's template exists to be *"one that doesn't import `re` module, allowing scripts to load faster"*, and uv's comment says the same about *"scripts that never import `re`"*. The wrapper runs on every invocation of every command, so an import your program might never need is paid on each run. pypa/installer 1.0.1 still imports `re`. It is a small, measurable example of the general rule **11** *(not written yet)* is about: anything imported before your function starts is start-up cost.

**Who is responsible for putting the scripts directory on `PATH`?**
Not the installer — the specification says install tools *"are not responsible for putting this directory in the `PATH` environment variable"*. pip warns when it installs into a directory that is not on `PATH`, except the directory holding its own interpreter. Tool installers go further: `uv tool update-shell` and `pipx ensurepath` edit shell configuration because putting commands on `PATH` is their whole purpose (**08** *(not written yet)*). For a project environment the answer is activation or `uv run`.

**Why can a wheel with a broken script entry build successfully?**
Because the backend and the installer validate different things. uv_build checks that script names are well-formed and forbids `[project.entry-points.console_scripts]`, but its source carries a TODO to validate object references, so `module.function` without a colon passes. The installer must generate a call, so it requires the callable part — pip raises `MissingCallableSuffix`, uv reports an invalid console script. Catch it in CI by installing the built wheel into a clean environment and running the command (**12** *(not written yet)*).

---

← [Topic index](README.md) · Next → [02 · Windows launchers and GUI scripts](02-windows-launchers-and-gui-scripts.md)
