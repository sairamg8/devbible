---
title: "python vs python3: which name is guaranteed to exist, what to put in a shebang, and why a subprocess should never be spawned by name"
sidebar_label: "9 · python vs python3"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against
> [PEP 394 – The "python" Command on Unix-Like Systems](https://peps.python.org/pep-0394/),
> [Using Python on Unix platforms](https://docs.python.org/3.14/using/unix.html),
> [Using Python on Windows](https://docs.python.org/3.14/using/windows.html) and
> [`sys.executable`](https://docs.python.org/3.14/library/sys.html#sys.executable).
> Version spine: **Python 3.14.7**.

**`python3` is guaranteed wherever Python 3 is installed. `python` is not — a
distributor may point it at Python 3, may not provide it at all, or may make it
configurable. Inside a virtual environment `python` is guaranteed and is the
preferred spelling. Those three sentences are the whole of PEP 394, and getting
them the wrong way round is why a script that runs on your laptop is "command
not found" on a colleague's.**

## Why `python` may not exist while `python3` does

This is PEP 394, and the answer is that distributors are explicitly permitted to
omit it:

> *"We expect Unix-like software distributions (including systems like macOS and
> Cygwin) to install the python2 command into the default path whenever a version
> of the Python 2 interpreter is installed, and the same for python3 and the
> Python 3 interpreter."*

> *"If the python command is installed, it is expected to invoke either the same
> version of Python as the python3 command or as the python2 command.
> Distributors may choose to set the behavior of the python command as follows:
> python2, python3, not provide python command, or allow python to be
> configurable by an end user or a system administrator."*

So `python3` is guaranteed where Python 3 is installed; `python` is a
distributor's choice. Which is why the PEP tells script authors what to expect:

> *"Older Linux distributions will provide a python command that refers to Python
> 2, and will likely not provide a python2 command. Some newer Linux
> distributions will provide a python command that refers to Python 3. Some Linux
> distributions will not provide a python command at all by default, but will
> provide a python3 command by default."*

**But inside a virtual environment, `python` always exists:**

> *"When a virtual environment (created by the PEP 405 venv package or a similar
> tool such as virtualenv or conda) is active, the python command should refer to
> the virtual environment's interpreter and should always be available."*

which produces the PEP's actual recommendation for end users:

> *"While far from being universally available, python remains the preferred
> spelling for explicitly invoking Python, as this is the spelling that virtual
> environments make consistently available across different platforms and Python
> installations."*

The habit that follows, and it is worth making automatic:

| Context | Use |
|---|---|
| A Unix shell, no environment active | `python3` |
| A Windows terminal, no environment active | `py` |
| Inside any activated virtual environment | `python` |
| A shebang for a script run outside environments | `#!/usr/bin/env python3` |
| A shebang for a script only ever run inside one | `#!/usr/bin/env python` |
| Re-invoking the interpreter from Python code | `sys.executable`, never a name |

That last row is PEP 394's advice to script publishers verbatim: *"When
reinvoking the interpreter from a Python script, querying sys.executable to
avoid hardcoded assumptions regarding the interpreter location remains the
preferred approach."*


## Two more rules from PEP 394 that save real time

**Distributors are encouraged to make shebangs *more* specific, not less:**

> *"When packaging third party Python scripts, distributors are encouraged to
> change less specific shebangs to more specific ones. This ensures software is
> used with the latest version of Python available … Changing python3 shebangs
> to python3.8 if the software is built with Python 3.8."*

So a script whose shebang says `python3` in the source repository may say
`python3.12` in the distribution package. Do not be surprised when the installed
copy differs from the file you wrote.

**Avoiding shebangs entirely is the recommended workaround** when you cannot
control the target environment:

> *"Avoiding shebangs (via the console_scripts Entry Points … or similar means) is
> the recommended workaround for this problem."*

A `console_scripts` entry point makes the installer generate a launcher whose
interpreter path is correct *for the environment it was installed into* — which
is why a properly packaged CLI works and a hand-written script with a shebang is
a coin flip. Phase 7 covers entry points; this is the reason they exist.

## Gotchas

**Symptom:** `python: command not found` on a machine where Python is definitely installed
**Cause:** the distributor did not provide the unversioned `python` command, which PEP 394 explicitly permits
**Fix:** `python3` outside an environment, `python` inside one. If you want the short name globally, that is a deliberate choice — `uv python install --default` or the distro's `python-is-python3`-style package — not an assumption

**Symptom:** `#!/usr/bin/env python` in a script that is run outside a virtual environment
**Cause:** `python` may not exist at all on the target system
**Fix:** `#!/usr/bin/env python3` for anything run outside an environment. Reserve the bare `python` shebang for scripts that only ever run inside one, which is precisely the case PEP 394 allows it for

**Symptom:** a script re-invokes Python as a subprocess and gets a different interpreter than the one running it
**Cause:** it spawned `"python"` or `"python3"` by name, so the child was resolved by `PATH` rather than inherited
**Fix:** `subprocess.run([sys.executable, ...])`. PEP 394 names this as the preferred approach and it is the only one that survives every platform and environment combination

**Symptom:** the shebang in the installed copy of your script is not the one you wrote
**Cause:** distributors are encouraged to rewrite shebangs to more specific versions when packaging, and installers rewrite them to point at the target environment
**Fix:** expect it. If the exact interpreter matters, ship a `console_scripts` entry point rather than a script with a shebang

**Symptom:** `#!/usr/bin/env python3` fails on a minimal system
**Cause:** the docs note that *"some Unices may not have the env command"*
**Fix:** hardcode `/usr/bin/python3` for those targets, accepting that you have now hardcoded a path

**Symptom:** the script runs but with the wrong Python, and the shebang looks correct
**Cause:** the shebang is only consulted when the file is executed directly. `python3 script.py` ignores it entirely — the interpreter you named wins
**Fix:** check how it is being invoked before debugging the shebang. This is also why `./script.py` and `python3 script.py` can behave differently

**Symptom:** a Windows machine runs the wrong interpreter for a Unix-style shebang
**Cause:** the launcher honours shebangs, and from 3.13 a `python`-style virtual command prefers an active virtual environment over searching `PATH`
**Fix:** that change is usually what you want. If it is not, name the version explicitly in the shebang or invoke through `py -V:<tag>`

**Symptom:** a cron entry or systemd unit using `python3` runs a different version than your shell does
**Cause:** those contexts have a minimal `PATH` and do not source your shell profile, so version-manager shims and `~/.local/bin` are absent
**Fix:** absolute paths in service definitions — ideally to the project's `.venv/bin/python`, which pins the environment as well as the interpreter

## Interview questions

**★ Why does `python` sometimes not exist on a Linux machine when `python3` does?**
Because PEP 394 only requires distributors to provide `python3` when Python 3 is
installed. The unversioned `python` is explicitly a distributor's choice — it may
point at Python 3, at Python 2 on very old systems, be absent entirely, or be
configurable by the administrator. The one place `python` is guaranteed is
inside an active virtual environment, which the PEP requires to always provide
it, and that is exactly why the PEP still calls `python` the preferred spelling
for explicit invocation.

**★ What shebang line do you put on a script, and why?**
`#!/usr/bin/env python3` if it may be run outside a virtual environment — it
searches `PATH` and asks for the version-qualified name that PEP 394 guarantees
exists. `#!/usr/bin/env python` only if the script is exclusively run inside an
environment, which the PEP allows precisely because environments always provide
`python`. On Windows the launcher honours both forms, so a Unix-style shebang
works unmodified.

**★ A Python program needs to start another Python process. How do you name the interpreter?**
`sys.executable` — never the string `"python"` or `"python3"`. PEP 394 names it
as the preferred approach for exactly this reason: a spawned process resolved by
name goes through `PATH`, which on a machine with a version manager, several
installations and a possibly-unactivated environment is very likely to be a
different interpreter from the one currently running.

**When is a shebang line ignored entirely?**
Whenever the file is not executed directly. `python3 script.py` runs the
interpreter you named and never looks at the first line; only `./script.py` — via
the kernel's exec handling on Unix, or the launcher on Windows — consults it.
That distinction explains a lot of "the shebang is right but the wrong Python
runs" reports.

**Why is a `console_scripts` entry point better than a script with a shebang?**
Because the installer generates the launcher at install time and writes the
interpreter path of the environment it is installing into. The shebang problem —
which name exists, which version it points at, whether `env` is present — is
solved by construction rather than guessed at by the author. PEP 394 names
avoiding shebangs via entry points as the recommended workaround for exactly the
cross-platform mess it spends most of its text describing.

**Your cron job runs a different Python than your terminal. Why?**
Because cron gives the job a minimal environment: your shell profile is not
sourced, so a version manager's shims directory and `~/.local/bin` are not on
`PATH`, and `python3` resolves to whatever the OS provides. The fix is not to
patch `PATH` in the crontab but to name the interpreter absolutely — normally
the project's `.venv/bin/python`, which fixes the environment as well as the
version.

**Is `python` ever the right thing to type?**
Yes, inside an activated virtual environment, where PEP 394 guarantees it exists
and points at that environment's interpreter. That is the PEP's own
recommendation for end users: `python` is the preferred spelling precisely
because environments make it consistent across platforms and installations. It is
the *unqualified, no-environment* use that is unsafe.

---

← Prev: [Platform stories](08-platform-stories.md) · Index: [Installing and versions](README.md) · Next → [Installing applications, not libraries](10-installing-applications.md)
