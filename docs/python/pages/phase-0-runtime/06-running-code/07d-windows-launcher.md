---
title: "Windows has no kernel shebang support, so a launcher emulates it — and in 3.14 that launcher changed identity: py.exe is deprecated and the Python Install Manager supersedes it"
sidebar_label: "7d · Windows: py and PyManager"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14
> [Using Python on Windows](https://docs.python.org/3.14/using/windows.html) —
> the "Python install manager" sections (basic use, listing and installing
> runtimes, shebang lines) and the deprecation notice on "Python launcher for
> Windows" — plus the Python 3.14
> [tutorial appendix](https://docs.python.org/3.14/tutorial/appendix.html)
> (`.pyw`) and
> [`zipapp`](https://docs.python.org/3.14/library/zipapp.html) (the launcher and
> archive shebangs).
> Version spine: **Python 3.14.7**.

**Windows does not have the kernel feature that makes `#!` work. What it has
instead is a launcher that reads the line itself and emulates the behaviour,
including a set of "virtual" commands so that `#!/usr/bin/env python3` — a path
that does not exist on Windows — still selects the right interpreter. In 3.14 that
launcher was superseded: the documentation for `py.exe`, the launcher introduced
in 3.3, now carries a deprecation notice, and the Python Install Manager takes
over the `py` command with a different version-selection syntax and the ability to
install runtimes on demand. Anything you know about `py -3.11` still mostly works,
for a documented compatibility reason rather than by accident.**

## The change, quoted

> *"To obtain Python from the CPython team, use the Python Install Manager. This is
> a standalone tool that makes Python available as global commands on your Windows
> machine, integrates with the system, and supports updates over time."*

> *"Once you have installed the Python Install Manager, the global `python` command
> can be used from any terminal to launch your current latest version of Python."*

And on the old launcher's documentation page:

> *"Deprecated since version 3.14: The launcher and this documentation have been
> superseded by the Python Install Manager described above. This is preserved
> temporarily for historical interest."*

The full Windows installer is on the same path — *"This installer is deprecated
since 3.14 and will not be produced for Python 3.16 or later"* — so this is a
change of default distribution channel, not just a change of launcher.

## Selecting a version

```
py                    launches the default runtime
py -V:3.14 ...        launches a specific runtime
py -V:3-arm64 ...     a specific runtime on a specific platform
py -3.14 ...          the compatibility spelling (see below)
py list               list installed runtimes
py install 3.14       install a runtime
py help               the full command list
```

> *"To launch a specific runtime, the `py` command accepts a `-V:<TAG>` option.
> This option must be specified before any others. The tag is part or all of the
> identifier for the runtime; for those from the CPython team, it looks like the
> version, potentially with the platform. **For compatibility, the `V:` may be
> omitted in cases where the tag refers to an official release and starts with
> `3`.**"*

That last sentence is why every `py -3.12` in existing documentation and scripts
keeps working. It is a compatibility affordance for CPython releases specifically,
not the general syntax — a runtime from another distributor needs the full
`-V:Company\Tag` form:

> *"Runtimes from other distributors may require the company to be included as
> well. It should be separated from the tag by a slash (either `/` or `\`), and
> may be shortened to any prefix of its full value."*

Installation is on demand, with a documented cut-off:

> *"When no runtimes are installed, any launch command will try to install the
> requested version and launch it. However, after any version is installed, only
> the `py exec ...` and `pymanager exec ...` commands will install if the requested
> version is absent. Other forms of commands will display an error and direct you
> to use `py install` first."*

## Shebang emulation

This is the part that matters for cross-platform scripts:

> *"If the first line of a script file starts with `#!`, it is known as a "shebang"
> line. Linux and other Unix like operating systems have native support for such
> lines and they are commonly used on such systems to indicate how a script should
> be executed. The `python` and `py` commands allow the same facilities to be used
> with Python scripts on Windows."*

> *"To allow shebang lines in Python scripts to be portable between Unix and
> Windows, a number of 'virtual' commands are supported to specify which
> interpreter to use. The supported virtual commands are: `/usr/bin/env <ALIAS>`,
> `/usr/bin/env -S <ALIAS>`, `/usr/bin/<ALIAS>`, `/usr/local/bin/<ALIAS>`,
> `<ALIAS>`"*

So the portable line you already write is the one the launcher understands:

```python
#!/usr/bin/env python3
```

> *"For example, if the first line of your script starts with `#! /usr/bin/python`
> the default Python or an active virtual environment will be located and used. As
> many Python scripts written to work on Unix will already have this line, you
> should find these scripts can be used by the launcher without modification. If
> you are writing a new script on Windows which you hope will be useful on Unix,
> you should use one of the shebang lines starting with `/usr`."*

`<ALIAS>` is not limited to `python`:

> *"Any of the above virtual commands can have `<ALIAS>` replaced by an alias from
> an installed runtime. That is, any command generated in the global aliases
> directory (which you may have added to your `PATH` environment variable) can be
> used in a shebang, even if it is not on your `PATH`. This allows the use of
> shebangs like `/usr/bin/python3.12` to select a particular runtime. If no
> runtimes are installed, or if automatic installation is enabled, the requested
> runtime will be installed if necessary."*

And there are two behaviours that are Windows-only and worth knowing before they
surprise you:

> *"The `/usr/bin/env` form of shebang line will also search the `PATH` environment
> variable for unrecognized commands. This corresponds to the behaviour of the Unix
> `env` program, which performs the same search, but prefers launching known Python
> commands. A warning may be displayed when searching for arbitrary executables,
> and this search may be disabled by the `shebang_can_run_anything` configuration
> option."*

> *"Shebang lines that do not match any of patterns are treated as Windows
> executable paths that are absolute or relative to the directory containing the
> script file. This is a convenience for Windows-only scripts, such as those
> generated by an installer, since the behavior is not compatible with Unix-style
> shells. These paths may be quoted, and may include multiple arguments, after
> which the path to the script and any additional arguments will be appended. This
> functionality may be disabled by the `shebang_can_run_anything` configuration
> option."*

Read that second one carefully. **On Windows a shebang can name an arbitrary
executable with arguments**, which is a genuinely different security posture from
POSIX, where the kernel execs exactly what the line names and applies no `PATH`
search of its own beyond what `env` does. `shebang_can_run_anything` is the switch,
and it is worth knowing it exists before you run a downloaded `.py` file by
double-clicking it.

Custom mappings are configurable:

> *"Since version 26.3 of the Python install manager, custom shebang templates may
> be added to your configuration file. Add the `shebang_templates` object with one
> member for each template (the string to match) and the command to use when the
> template is matched. Most commands should be `py -V:<tag>` (or `pyw`) to launch
> one of your installed runtimes. The `py -3.<version>` form is also allowed, as is
> a plain `py` to launch the default. No other arguments are supported."*

```json
{
    "shebang_templates": {
        "/usr/bin/python": "py",
        "/usr/bin/my_custom_python": "py -V:MyCustomPython/3"
    }
}
```

## Virtual environments and the default runtime

> *"If you are running in an active virtual environment, have not requested a
> particular version, and there is no shebang line, the default runtime will be
> that virtual environment. In this scenario, the `python` command was likely
> already overridden and none of these checks occurred. However, this behaviour
> ensures that the `py` command can be used interchangeably."*

That is the resolution order in one paragraph: an explicit `-V:` tag wins, then a
shebang line, then the active virtual environment, then the configured default
(overridable with `PYTHON_MANAGER_DEFAULT`).

## `.pyw` and GUI scripts

> *"On Windows systems, there is no notion of an "executable mode". The Python
> installer automatically associates `.py` files with `python.exe` so that a
> double-click on a Python file will run it as a script. The extension can also be
> `.pyw`, in that case, the console window that normally appears is suppressed."*

The same distinction exists in the wheel specification, where a script beginning
`#!pythonw` *"indicates a GUI script instead of a console script"*. If a GUI
program flashes a console window on launch, the extension or the entry-point kind
is the thing to change — not the code.

## Gotchas

**★ A tutorial says `py -3.11` and someone insists that is obsolete.**
It is not. The documentation explicitly preserves it: *"For compatibility, the
`V:` may be omitted in cases where the tag refers to an official release and
starts with `3`."* The full `-V:` form is required for non-CPython distributors
and for platform-qualified tags like `3-arm64`.

**★ `-V:` placed after another argument is ignored or misparsed.**
Documented: *"This option must be specified before any others."* `py script.py
-V:3.13` does not select a runtime — it passes `-V:3.13` to your script.

**★ `py` installed a missing runtime once and then stopped doing it.**
Documented behaviour: automatic install happens *"when no runtimes are
installed"*; afterwards only `py exec` and `pymanager exec` install on demand, and
other forms *"display an error and direct you to use `py install` first"*.

**★ A `#!/usr/bin/env python3` script works on Windows and a colleague concludes
Windows supports shebangs.**
It does not, at the OS level. The `py`/`python` launcher reads and emulates the
line, and only for the documented set of virtual commands. A shebang has no effect
on a file executed by any other mechanism on Windows.

**★ A shebang naming a Windows path silently runs an arbitrary program.**
Documented: lines that match none of the virtual patterns *"are treated as Windows
executable paths"*, may be quoted, and *"may include multiple arguments"*. That is
a real difference from POSIX behaviour. `shebang_can_run_anything` disables it, and
it is worth disabling on a machine where `.py` files arrive from elsewhere.

**★ CRLF line endings break the shebang on Linux but not on Windows.**
The Windows launcher parses the line itself and tolerates its own platform's line
endings; the Linux kernel does not
([chunk 7b](07b-when-a-shebang-fails.md)). So a file authored on Windows can work
locally and fail the moment it reaches CI.

**★ A GUI program flashes a console window every time it starts.**
It is being run by `python.exe` rather than `pythonw.exe`. Rename to `.pyw`, or
declare the entry point as a GUI script so the installer writes the `#!pythonw`
form.

**★ `py` and `python` disagree about which interpreter runs.**
Inside an active virtual environment, `python` has already been overridden by the
environment's `Scripts` directory, while `py` applies its own resolution order —
which, per the documentation, also ends at the active environment when nothing
else selects a version. The place they diverge is when a shebang line is present,
since only `py` and the launcher-aware `python` consult it.

**★ Automation written against `py.exe` internals.**
The launcher's documentation is *"preserved temporarily for historical
interest"*. Anything depending on its INI files, its `PY_PYTHON` environment
variable or its exact diagnostics is depending on a deprecated component; the
Install Manager has its own configuration file and `PYTHON_MANAGER_DEFAULT`.

## Interview questions

**★ Does a shebang do anything on Windows?**
Not at the OS level — Windows has no interpreter-script mechanism in the kernel.
The `py` and `python` commands installed by the Python Install Manager read the
line themselves and emulate it, supporting a documented set of "virtual" commands
(`/usr/bin/env <ALIAS>`, `/usr/bin/env -S <ALIAS>`, `/usr/bin/<ALIAS>`,
`/usr/local/bin/<ALIAS>`, `<ALIAS>`) so that the same file works on both
platforms. Outside those commands, a Windows shebang is interpreted as an
executable path.

**★ What changed for the Windows launcher in 3.14?**
`py.exe`, the Python launcher for Windows introduced in 3.3, is deprecated: its
documentation states it has *"been superseded by the Python Install Manager"* and
is *"preserved temporarily for historical interest"*. The full installer is
deprecated on the same schedule and *"will not be produced for Python 3.16 or
later"*. The Install Manager provides `py`, `python` and `pymanager`, adds
`py list` and `py install`, and uses `-V:<TAG>` for version selection.

**★ How do you select a specific Python version on Windows now?**
`py -V:3.14`, with the tag optionally qualified by platform (`-V:3-arm64`) or by
distributor (`-V:Company\Tag`). The option *"must be specified before any
others"*. `py -3.14` still works because the docs preserve the shorter form for
official CPython releases whose tag starts with `3`.

**★ Why is a Windows shebang a security consideration in a way a POSIX one is
not?**
Because a line that matches none of the virtual commands is *"treated as Windows
executable paths that are absolute or relative to the directory containing the
script file"*, may be quoted, and *"may include multiple arguments"*. A downloaded
`.py` file can therefore name an arbitrary program to run. The documented control
is the `shebang_can_run_anything` configuration option; the POSIX kernel offers
no equivalent capability to begin with.

**★ What is the resolution order when you type `py script.py`?**
An explicit `-V:` tag if present, then the script's shebang line if it has one,
then the active virtual environment, then the configured default runtime
(`PYTHON_MANAGER_DEFAULT` or the configuration file). The docs state the
virtual-environment case directly: with no requested version and no shebang,
*"the default runtime will be that virtual environment"*.

**★ What is `.pyw` for?**
Suppressing the console window. The tutorial notes that *"on Windows systems, there is no
notion of an 'executable mode'"* and that `.py` files are associated with
`python.exe`, while *"the extension can also be `.pyw`, in that case, the console
window that normally appears is suppressed"*. The packaging equivalent is the
`#!pythonw` shebang the wheel specification reserves for GUI scripts.

---

← Prev: [Generated shebangs](07c-console-scripts-and-launchers.md) · Index: [Running code](README.md) · Next → [`uv run` and inline script metadata](08-uv-run-and-inline-metadata.md)

{/* FOOTER */}
