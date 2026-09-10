---
title: "Windows has no shebangs, so a Windows command is an .exe — a small launcher binary with the shebang and a zip of the same wrapper appended — and the console/GUI split that is a no-op everywhere else decides there whether a window appears, whether stdout exists, and whether the shell waits for the exit code"
sidebar_label: "02 · Windows launchers and GUI scripts"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the PyPA *Entry points specification* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/entry-points/)), *Writing your pyproject.toml* ([packaging.python.org](https://packaging.python.org/en/latest/guides/writing-pyproject-toml/)), the Python 3.14 [`sys`](https://docs.python.org/3.14/library/sys.html) and [command line](https://docs.python.org/3.14/using/cmdline.html) documentation, uv's *Configuring projects* ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/config/#entry-points)) and *Tools* ([docs.astral.sh](https://docs.astral.sh/uv/concepts/tools/)), and source at named tags — pypa/installer **1.0.1** [`scripts.py`](https://github.com/pypa/installer/blob/1.0.1/src/installer/scripts.py), pip **26.2.1** vendored distlib [`scripts.py`](https://github.com/pypa/pip/blob/26.2.1/src/pip/_vendor/distlib/scripts.py), [`req_uninstall.py`](https://github.com/pypa/pip/blob/26.2.1/src/pip/_internal/req/req_uninstall.py) and [`utils/misc.py`](https://github.com/pypa/pip/blob/26.2.1/src/pip/_internal/utils/misc.py), uv **0.12.12** [`wheel.rs`](https://github.com/astral-sh/uv/blob/0.12.12/crates/uv-install-wheel/src/wheel.rs).
> Target: **Python 3.14.7** · **uv 0.12.12** · ruff 0.16.6 · pre-commit 4.6.2. Source-validated — **no Windows machine was used; no program output**.

**On POSIX the wrapper is a text file the kernel starts through its shebang. Windows has no shebang mechanism, so every installer writes a `.exe` instead: a prebuilt launcher binary, then the shebang line naming the interpreter, then a zip archive whose `__main__.py` is the same wrapper code POSIX gets. That construction explains Windows' three special behaviours. The launcher comes in two flavours, console and GUI, which is the *only* place `[project.scripts]` and `[project.gui-scripts]` differ. A GUI launcher runs `pythonw`, which has no standard streams, so output and tracebacks vanish. And the command is a real executable that is running while it works — which is why a tool that tries to upgrade itself through its own `.exe` is refused, and why `python -m` is the documented way around it.**

## The file: launcher + shebang + zip

pypa/installer 1.0.1 builds the Windows file in `Script.generate` (`scripts.py`):

```python
stream = io.BytesIO()
with zipfile.ZipFile(stream, "w") as zf:
    zf.writestr("__main__.py", code)
name = f"{self.name}.exe"
data = launcher + shebang + b"\n" + stream.getvalue()
return name, data
```

`code` is the same template POSIX gets ([01](01-what-the-installer-writes.md)); `launcher` is one of eight bundled binaries chosen by section and architecture:

```python
_ALLOWED_LAUNCHERS: Mapping[tuple["ScriptSection", "LauncherKind"], str] = {
    ("console", "win-ia32"): "t32.exe",
    ("console", "win-amd64"): "t64.exe",
    ("console", "win-arm"): "t_arm.exe",
    ("console", "win-arm64"): "t64-arm.exe",
    ("gui", "win-ia32"): "w32.exe",
    ("gui", "win-amd64"): "w64.exe",
    ("gui", "win-arm"): "w_arm.exe",
    ("gui", "win-arm64"): "w64-arm.exe",
}
```

pip reaches the same layout through distlib, which writes `script_bytes = launcher + shebang + zip_data` and credits its launchers to Vinay Sajip's *simple_launcher* project. uv writes its own launcher — `crates/uv-trampoline`, which its README calls *"a fork of posy trampolines"* — through `windows_script_launcher(script, is_gui, python)`. The internals of uv's trampoline are not documented in the sources read for this page.

Two documented facts make the construction work. The shebang is for the launcher, not for Windows — installer's `_build_shebang` skips all quoting in that case with the comment *"The launcher can just use the command as-is."* And Python can execute a zip archive directly: the command-line documentation says the script argument may be *"a zipfile containing a `__main__.py` file"*, in which case *"the `__main__.py` file in that location is executed as the `__main__` module"* ([cmdline](https://docs.python.org/3.14/using/cmdline.html)). So the wrapper's `if __name__ == "__main__":` guard is true inside the archive too.

## Console or GUI: the only platform where it matters

> *"The difference between `console_scripts` and `gui_scripts` only affects Windows systems. `console_scripts` are wrapped in a console executable, so they are attached to a console and can use `sys.stdin`, `sys.stdout` and `sys.stderr` for input and output. `gui_scripts` are wrapped in a GUI executable, so they can be started without a console, but cannot use standard streams unless application code redirects them. Other platforms do not have the same distinction."*
> — [entry points specification](https://packaging.python.org/en/latest/specifications/entry-points/)

uv's documentation states the same from the other side: GUI scripts *"are only different from command-line interfaces on Windows, where they are wrapped by a GUI executable so they can be started without a console. On other platforms, they behave the same."*

The GUI flavour also changes the interpreter. installer swaps `python` for `pythonw` — *"On Windows, when the script section is gui-script, pythonw.exe should be used."* — and uv does the same in `get_script_executable`, falling back to `python` if no `pythonw` exists. The `sys` documentation says what that costs:

> *"Under some conditions `stdin`, `stdout` and `stderr` as well as the original values `__stdin__`, `__stdout__` and `__stderr__` can be `None`. It is usually the case for Windows GUI apps that aren't connected to a console and Python apps started with pythonw."*
> — [sys](https://docs.python.org/3.14/library/sys.html)

And the packaging guide adds the behaviour a script author notices first:

> *"On Windows, scripts packaged this way need a terminal, so if you launch them from within a graphical application, they will make a terminal pop up. To prevent this from happening, use the `[project.gui-scripts]` table instead of `[project.scripts]`."*

> *"In that case, launching your script from the command line will give back control immediately, leaving the script to run in the background."*
> — both [Writing your pyproject.toml](https://packaging.python.org/en/latest/guides/writing-pyproject-toml/)

Put together: a GUI script gets no console window, no standard streams, and no caller waiting for it. That is exactly right for a desktop application launched from a Start-menu shortcut and exactly wrong for anything a script, a scheduler or CI runs.

### Declaring both, for one application

Nothing stops two names pointing at the same function — one for people double-clicking, one for automation and debugging:

```toml
[project.scripts]
invoice-desktop-debug = "invoice_service.gui:main"   # console: tracebacks visible, shell waits

[project.gui-scripts]
invoice-desktop = "invoice_service.gui:main"         # no console window on Windows
```

### Making a GUI entry point survive having no streams

```python
# src/invoice_service/gui.py
import logging
import os
import sys
from pathlib import Path


def _log_path() -> Path:
    base = Path(os.environ.get("LOCALAPPDATA", Path.home()))
    path = base / "invoice-service" / "desktop.log"
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def main() -> int:
    if sys.stdout is None or sys.stderr is None:          # pythonw: no console attached
        log_file = open(_log_path(), "a", encoding="utf-8", buffering=1)
        sys.stdout = log_file
        sys.stderr = log_file
    logging.basicConfig(stream=sys.stderr, level=logging.INFO)
    from invoice_service.desktop import run_app            # the GUI toolkit, imported late
    return run_app()
```

Redirecting both streams before anything else runs means a stray `print`, a `logging` handler and the final traceback all land in a file instead of on `None`.

## `argv[0]` and the `.exe` suffix

Every template strips a Windows suffix before calling your function — pip with `removesuffix('.exe')`, installer and uv with a check for `-script.pyw` or `.exe`. The effect is that `sys.argv[0]` ends in `invoice`, not `invoice.exe`, so `argparse`'s default program name reads the same on every platform.

The `-script.pyw` suffix is a fossil of an older layout, where an installer wrote a `name.exe` launcher *next to* a `name-script.py` or `name-script.pyw` file. pip's uninstaller still cleans up all of it — `_script_names` in `req_uninstall.py` yields `name.exe`, `name.exe.manifest`, and `name-script.py` or `name-script.pyw` on Windows — so an environment that went through old installers can hold wrapper files no modern installer writes.

## A running command cannot upgrade itself

pip refuses to modify pip when it was started through its own launcher on Windows. `protect_pip_from_modification_on_windows` in `utils/misc.py`:

```python
def protect_pip_from_modification_on_windows(modifying_pip: bool) -> None:
    """Protection of pip.exe from modification on Windows

    On Windows, any operation modifying pip should be run as:
        python -m pip ...
    """
```

It checks whether `sys.argv[0]` is `pip`, `pip3` or `pip3.14`-style and, if so, raises *"To modify pip, please run the following command:"* followed by the `python -m pip …` equivalent. The design point generalises: the command's `.exe` is the file an upgrade of the command would replace. Any CLI with a self-update subcommand needs a `python -m` path ([04](04-python-m-and-dunder-main.md)) and should send Windows users to it the same way:

```python
import os
import sys


def upgrade_command() -> int:
    if sys.platform == "win32" and os.path.basename(sys.argv[0]) == "invoice":
        print(
            f"On Windows, upgrade with:\n  {sys.executable} -m invoice_service upgrade",
            file=sys.stderr,
        )
        return 2
    return perform_upgrade()
```

## Legacy Windows scripts and uv

setuptools' old `scripts=` mechanism copied `.bat`, `.cmd` or `.ps1` files into `Scripts` instead of generating launchers. setuptools' own documentation now says *"Console scripts and GUI scripts MUST be specified via entry-points to work properly"* ([development mode](https://setuptools.pypa.io/en/latest/userguide/development_mode.html)). uv runs such files for compatibility — *"Currently only legacy scripts with the `.ps1`, `.cmd`, and `.bat` extensions are supported"* ([running commands](https://docs.astral.sh/uv/concepts/projects/run/)) — which is a reason to read them in old projects, not to write them.

For tool installs, uv's *Tools* page adds one more Windows difference: *"Tool executables are symlinked into the executable directory on Unix and copied on Windows."* pipx says the same: *"On Windows, and on any filesystem that does not support symlinks, it copies the file instead."* A copy of a launcher still names the tool environment's interpreter in its embedded shebang, so it keeps working from the shared directory.

## Gotchas

**★ Symptom: your desktop application opens a black console window behind it on Windows.** Cause: it is declared under `[project.scripts]`, so the installer used the console launcher and `python`. Fix: move it to `[project.gui-scripts]`; nothing changes on Linux or macOS, which is why the mistake survives review.

```toml
[project.gui-scripts]
invoice-desktop = "invoice_service.gui:main"
```

**★ Symptom: the GUI command starts and disappears with no error anywhere.** Cause: under `pythonw` the standard streams can be `None`, so the traceback of whatever failed had nowhere to be written, and any direct `sys.stderr.write` raised on `None`. Fix: redirect the streams to a file as the first thing the entry-point function does, as in `invoice_service.gui.main` above.

```python
if sys.stdout is None or sys.stderr is None:
    log_file = open(_log_path(), "a", encoding="utf-8", buffering=1)
    sys.stdout = log_file
    sys.stderr = log_file
```

**★ Symptom: a Windows batch job or CI step "runs" the GUI command, carries on immediately and always reports success.** Cause: a GUI script *"will give back control immediately, leaving the script to run in the background"* — the caller never waits for it and never sees its exit status. Fix: give automation a console entry to the same function.

```toml
[project.scripts]
invoice-desktop-debug = "invoice_service.gui:main"
```

**★ Symptom: `yourtool self-update` fails on Windows and works everywhere else.** Cause: the command being run is the `.exe` the update must replace — the reason pip's source gives for refusing `pip install --upgrade pip` through `pip.exe`. Fix: route the update through the interpreter, and ship a `__main__.py` so that route exists.

```python
# src/invoice_service/__main__.py
from invoice_service.cli import main

raise SystemExit(main())
```

**Symptom: after uninstalling, `Scripts` still holds `invoice-script.py` and `invoice.exe.manifest`.** Cause: they came from an older installer layout; pip removes them only for the distribution it is uninstalling, by name. Fix: delete leftovers explicitly, or recreate the environment.

```powershell
Remove-Item .venv\Scripts\invoice-script.py, .venv\Scripts\invoice.exe.manifest
```

**Symptom: a GUI script that works on the developer's Linux box shows no console output on a Windows tester's machine, and the tester reports "no logging".** Cause: POSIX has no GUI launcher, so the same entry point there runs under `python` with a terminal attached. Fix: log to a file on every platform, not only when streams are missing, so both machines produce the same evidence.

```python
logging.basicConfig(filename=_log_path(), level=logging.INFO)
```

## Interview questions

**★ Why can't Windows use the same wrapper file that Linux and macOS get?**
Because Windows does not start programs through a `#!` line; a text file cannot name its own interpreter there. So the installer writes an executable instead: a small prebuilt launcher binary, then the shebang line — which the launcher, not the operating system, reads — then a zip archive whose `__main__.py` is the same wrapper code POSIX gets. Python can run a zip with a `__main__.py` directly, so the wrapper executes as `__main__` just as it does on POSIX. pip, pypa/installer and uv all produce this three-part layout, with uv using its own launcher.

**★ What is the practical difference between `[project.scripts]` and `[project.gui-scripts]`?**
On Linux and macOS, none — the specification and uv's docs both say the distinction exists only on Windows. There, a console script gets a console launcher and `python`, so it has standard streams and a caller that waits for it. A GUI script gets a GUI launcher and `pythonw`: no console window pops up, but `sys.stdout` and `sys.stderr` may be `None`, and a shell that starts it gets control back immediately without an exit status. So the choice is between "a window-free desktop launch" and "a command automation can depend on" — and an application can declare both names for one function.

**Why do the wrapper templates strip `.exe` or `-script.pyw` from `sys.argv[0]`?**
So your program sees the command name the user typed. On Windows the process was started through `invoice.exe`, and older layouts ran a separate `invoice-script.pyw`; without the clean-up, anything that derives a name from `argv[0]` — `argparse`'s default `prog`, usage messages, self-references in help — would print the implementation detail. The stripping happens in the wrapper before your function is called, so it is invisible to you on every platform.

**Why does pip refuse to upgrade itself when run as `pip` on Windows, and what does it teach a CLI author?**
pip's source calls it *"Protection of pip.exe from modification on Windows"*: the running command is the executable an upgrade of pip would replace, so pip detects that it was started as `pip`, `pip3` or `pip3.x` and tells the user to run `python -m pip` instead. The lesson is that a command's launcher is a real executable file owned by the installation it belongs to. A CLI that updates itself needs a code path that does not run through that file — `python -m yourpackage` — which is one of the strongest reasons to ship a `__main__.py` beside the console script.

**Where do `print` output and uncaught tracebacks go in a GUI script on Windows?**
Potentially nowhere. The GUI launcher runs `pythonw`, and the `sys` documentation says standard streams *"can be `None"* for *"Windows GUI apps that aren't connected to a console and Python apps started with pythonw"*. Code that writes to `sys.stderr` directly then fails, and the interpreter has no stream to report that failure on. The entry-point function should replace `None` streams with a log file before doing anything else, which makes a GUI command debuggable without a console.

---

← Prev: [01b · entry_points.txt](01b-entry-points-txt.md) · [Topic index](README.md) · Next → [03 · The function contract](03-the-function-contract.md)
