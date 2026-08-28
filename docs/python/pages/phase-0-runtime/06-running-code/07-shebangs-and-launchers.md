---
title: "A shebang is a kernel feature, not a Python one — which is why it does nothing under python script.py, nothing on import, and picks whichever interpreter the caller's PATH resolves"
sidebar_label: "7 · Shebangs"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Linux
> [`execve(2)` manual page](https://man7.org/linux/man-pages/man2/execve.2.html)
> (interpreter scripts and how the interpreter is invoked),
> [PEP 394 — The "python" Command on Unix-Like Systems](https://peps.python.org/pep-0394/)
> (quoted from the PEP source),
> and [`sys.executable`](https://docs.python.org/3.14/library/sys.html#sys.executable).
> Version spine: **Python 3.14.7**.

**`#!/usr/bin/env python3` is not read by Python. It is read by the operating
system kernel, before Python exists, when you execute the file directly. Every
surprising thing about shebang lines follows from that: it does nothing when you
type `python script.py`, it does nothing on import, it does nothing on Windows
(where a launcher emulates it instead), and the interpreter it selects is
whichever one the *caller's* `PATH` resolves — not the one you tested with. This
chunk is the mechanism and the choice of interpreter;
[chunk 7b](07b-when-a-shebang-fails.md) is the four ways the line itself fails,
and [chunk 7c](07c-console-scripts-and-launchers.md) is what pip, uv and zipapp
write into shebangs on your behalf, with Windows in
[chunk 7d](07d-windows-launcher.md).**

## What the kernel actually does

The `execve(2)` manual page is the specification:

> *"An interpreter script is a text file that has execute permission enabled and
> whose first line is of the form: `#!interpreter [optional-arg]`"*

and, on invocation:

> *"interpreter will be invoked with the following arguments:
> `interpreter [optional-arg] path arg...`"*

So for a file `./report` beginning `#!/usr/bin/env python3`, running `./report x`
causes the kernel to execute `/usr/bin/env` with the arguments
`python3 ./report x`. `env` then looks up `python3` on `PATH` and execs it with
`./report x`. Python never sees the shebang line at all — by the time it starts,
the line is just a comment in the file it was told to run.

Three immediate consequences:

- **`python script.py` ignores the shebang entirely.** You named the interpreter
  yourself; the kernel's script handling was never involved. A file with
  `#!/usr/bin/python3.9` runs happily under 3.14 when invoked that way.
- **An imported module's shebang is a comment.** Nothing reads it, ever.
- **`sh script.py` runs it as a shell script** and fails at the first Python
  statement, because you told the shell to interpret it. The shebang is only
  consulted when the *kernel* is asked to execute the file.

## `env python3` versus a hard path

```python
#!/usr/bin/env python3      # ✅ the portable spelling
#!/usr/bin/python3          # ❌ only correct on machines where that path is right
```

`env` performs a `PATH` search. That single indirection buys you four things:

- **Virtual environments work.** With a venv activated, its `bin` is first on
  `PATH`, so `env python3` finds the environment's interpreter. A hard
  `/usr/bin/python3` bypasses the environment entirely and runs the system
  interpreter with none of your dependencies installed.
- **Non-system installs work.** Homebrew (`/opt/homebrew/bin`), pyenv shims,
  `uv python install`, conda and a hand-built `/usr/local/bin/python3` all live
  somewhere other than `/usr/bin`.
- **macOS works.** `/usr/bin/python3` on macOS is Apple's stub, not the Python you
  installed.
- **Containers work.** A `python:3.14-slim` image puts the interpreter at
  `/usr/local/bin/python3`.

PEP 394 says the same thing in its own terms:

> *"For scripts that are only expected to be run in an activated virtual
> environment, shebang lines can be written as `#!/usr/bin/env python`, as this
> instructs the script to respect the active virtual environment."*

The cost of `env` is real and worth stating: **the interpreter is now chosen by
whoever's `PATH` is in effect**, which is a different question from "which
interpreter did the author test with". That is exactly the failure in the gotchas
below about `cron` and `sudo`.

## `python` versus `python3`: what PEP 394 actually recommends

PEP 394 is Active and informational, and its recommendations are addressed to
three audiences. For distributors:

> *"We expect Unix-like software distributions (including systems like macOS and
> Cygwin) to install the `python2` command into the default path whenever a
> version of the Python 2 interpreter is installed, and the same for `python3`
> and the Python 3 interpreter."*
>
> *"If the `python` command is installed, it is expected to invoke either the same
> version of Python as the `python3` command or as the `python2` command."*
>
> *"Distributors may choose to set the behavior of the `python` command as
> follows: `python2`, `python3`, not provide `python` command, allow `python` to
> be configurable by an end user or a system administrator."*

Note the third option. **A system may legitimately ship no `python` at all**, and
several do. That is why `#!/usr/bin/env python` is a real portability risk outside
a virtual environment, and why the PEP tells script publishers to expect it:

> *"Some Linux distributions will not provide a `python` command at all by
> default, but will provide a `python3` command by default."*

For virtual environments the PEP is unambiguous:

> *"When a virtual environment (created by the PEP 405 `venv` package or a similar
> tool such as `virtualenv` or `conda`) is active, the `python` command should
> refer to the virtual environment's interpreter and should always be available."*

And when your program needs to re-invoke Python:

> *"When reinvoking the interpreter from a Python script, querying `sys.executable`
> to avoid hardcoded assumptions regarding the interpreter location remains the
> preferred approach."*

```python
import subprocess, sys

subprocess.run([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
```

`sys.executable` is documented as *"a string giving the absolute path of the
executable binary for the Python interpreter"*, with the caveat that *"if Python
is unable to retrieve the real path to its executable, `sys.executable` will be an
empty string or `None`"* — so a program that must survive a frozen or embedded
build should check it before using it.

The PEP's final piece of advice is the one this whole topic keeps arriving at:

> *"Avoiding shebangs (via the console_scripts Entry Points or similar means) is
> the recommended workaround for this problem."*

That is [chunk 7c](07c-console-scripts-and-launchers.md).

## Gotchas

**★ The script runs under the system Python instead of the virtual environment.**
Something invoked it with `PATH` reset. `cron` runs with a minimal `PATH`
(typically `/usr/bin:/bin`), `sudo` resets it via `secure_path`, and systemd units
start with whatever `Environment=` says. `env python3` faithfully resolves against
*that* `PATH`, not yours. Name the environment's interpreter absolutely in the
crontab or unit file, or install a console script into a directory that is on the
service's path.

**★ A shebang was "fixed" by editing it to the venv's absolute interpreter, and
then the venv moved.**
This is exactly the failure mode of installer-generated console scripts. The
environment cannot be relocated; see
[`../05-virtual-environments/05-not-relocatable.md`](../05-virtual-environments/05-not-relocatable.md).

**★ `#!/usr/bin/env python` works on your laptop and not on the server.**
PEP 394 allows a distribution to *"not provide `python` command"* at all. Use
`python3`, or run inside a virtual environment where the PEP says `python`
*"should always be available"*.

**★ Someone hardcodes `/usr/bin/python3` "for reproducibility".**
It reproduces the *system* interpreter, which is the one that has none of your
dependencies and that the distribution may upgrade under you. Reproducibility
comes from a pinned environment, not from a pinned path — and on macOS
`/usr/bin/python3` is not even a real installation.

**★ A program shells out to `python` and gets the wrong one.**
Use `sys.executable`, which PEP 394 names as *"the preferred approach"* for
reinvoking the interpreter. `subprocess.run(["python", ...])` searches `PATH`
from scratch and can easily land outside the environment the parent is running
in.

**★ `sys.executable` is empty.**
Documented: *"If Python is unable to retrieve the real path to its executable,
`sys.executable` will be an empty string or `None`."* This happens in some
embedded and frozen contexts. Code that re-invokes the interpreter should check
before using it.

**★ Adding a shebang to a module inside a package and expecting `-m` to honour
it.**
`python -m pkg.mod` never touches the file's first line. Shebangs apply to direct
execution of a file by the kernel only.

## Interview questions

**★ Who reads the shebang line, and when?**
The operating system kernel, when the file is executed directly and has the
execute bit set. `execve(2)` defines an interpreter script as *"a text file that
has execute permission enabled and whose first line is of the form
`#!interpreter [optional-arg]`"*, and the interpreter is then invoked as
`interpreter [optional-arg] path arg...`. Python never reads it — under
`python script.py` or on import, the line is just a comment.

**★ Why `#!/usr/bin/env python3` rather than `#!/usr/bin/python3`?**
Because `env` performs a `PATH` search, so the script follows an activated virtual
environment, a pyenv shim, a Homebrew or `uv`-managed install, or a container's
`/usr/local/bin`. A hard path pins you to one machine's layout and, on macOS,
to Apple's stub interpreter. The trade-off is that the interpreter is then chosen
by whoever's `PATH` is in effect — which is why cron and sudo jobs need an
absolute interpreter or a console script instead.

**★ What does PEP 394 say about `python` versus `python3`?**
That `python3` must exist wherever Python 3 is installed, and that `python` — if
it exists at all — must be one of `python2` or `python3`. Distributors are
explicitly permitted to *"not provide `python` command"*. Inside a virtual
environment the PEP requires `python` to refer to the environment's interpreter
and to *"always be available"*, which is why `#!/usr/bin/env python` is a
reasonable shebang for a script that only ever runs in an activated environment
and a poor one for a script that may not.

**★ How do you re-invoke Python from inside a Python program?**
`sys.executable`, which PEP 394 names as the preferred approach precisely to
*"avoid hardcoded assumptions regarding the interpreter location"* — typically
`subprocess.run([sys.executable, "-m", "pip", ...])`. Spawning `"python"` searches
`PATH` afresh and can pick a different interpreter from the one you are running
in, which is how a subprocess ends up installing into the wrong environment.

**★ Why does a cron job run the wrong Python even though the shebang says
`env python3`?**
Because `env` resolves against the `PATH` of the process that executed the script,
and cron's `PATH` is minimal — typically `/usr/bin:/bin`. The shebang is doing
exactly what it says; the environment is different. Name the environment's
interpreter absolutely in the crontab, or set `PATH` in the crontab, or install
the tool as a console script whose shebang is already absolute.

**★ Does a shebang do anything on Windows?**
Not at the kernel level — Windows has no interpreter-script mechanism. What exists
instead is a launcher that reads the line and emulates the behaviour, including
"virtual" commands like `/usr/bin/env python3` so that the same file works on both
platforms. That is [chunk 7d](07d-windows-launcher.md).

---

← Prev: [Prompts from inside a program](06g-prompts-from-inside-a-program.md) · Index: [Running code](README.md) · Next → [When a shebang fails](07b-when-a-shebang-fails.md)

{/* FOOTER */}
