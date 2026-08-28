---
title: "Platform stories: Apple's Python belongs to Xcode, Windows has no system Python at all, and the reason `python` may not exist while `python3` does"
sidebar_label: "8 · Platform stories"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14 setup documentation —
> [Using Python on Unix platforms](https://docs.python.org/3.14/using/unix.html),
> [Using Python on macOS](https://docs.python.org/3.14/using/mac.html) and
> [Using Python on Windows](https://docs.python.org/3.14/using/windows.html) —
> and [PEP 394 – The "python" Command on Unix-Like Systems](https://peps.python.org/pep-0394/).
> Version spine: **Python 3.14.7**.

**Every platform has a different answer to "where does Python come from", and
each answer produces a different class of confusion. On Linux the interpreter is
an OS dependency you must not touch. On macOS there is an Apple-owned Python
that exists for Xcode's benefit and a completely separate one you install. On
Windows there is no system Python at all, and since 3.14 the first-party answer
is a dedicated install manager. Underneath all three sits one small question
that generates a surprising amount of pain: whether the command `python` exists
at all.**

## Linux: the interpreter is part of the operating system

> *"Python comes preinstalled on most Linux distributions, and is available as a
> package on all others."*

That preinstalled interpreter is `/usr/bin/python3`, and — as
[chunk 1](01-never-the-system-python.md) covers at length — it is a dependency
of the distribution's own tooling, marked externally managed, and not yours to
install into. Your options in ascending order of independence:

1. **Use the distro's Python for distro things** and nothing else.
2. **Add the distro's newer Python packages** where the distribution provides
   them side by side (`python3.13`, `python3.14` as separate packages on several
   distributions), which gives you a supported build without touching
   `/usr/bin/python3`.
3. **Install your own** with `uv` or `pyenv`.
4. **Build from source**, which the docs cover — and which carries the warning
   already quoted in [chunk 3](03-installations-managers-environments.md): use
   `make altinstall`, never `make install`, because the latter *"can overwrite or
   masquerade the python3 binary."*

The recommended shebang for a script that must work anywhere on Unix:

> *"put an appropriate Shebang line at the top of the script. A good choice is
> usually `#!/usr/bin/env python3` which searches for the Python interpreter in
> the whole PATH. However, some Unices may not have the env command, so you may
> need to hardcode /usr/bin/python3 as the interpreter path."*

## macOS: two Pythons, one of which is not yours

The note that resolves most macOS confusion, verbatim:

> *"Recent versions of macOS include a python3 command in /usr/bin/python3 that
> links to a usually older and incomplete version of Python provided by and for
> use by the Apple development tools, Xcode or the Command Line Tools for Xcode.
> You should never modify or attempt to delete this installation, as it is
> Apple-controlled and is used by Apple-provided or third-party software. If you
> choose to install a newer Python version from python.org, you will have two
> different but functional Python installations on your computer that can
> co-exist. The default installer options should ensure that its python3 will be
> used instead of the system python3."*

Three words in there do the work: **older**, **incomplete**, and **never
modify**. Apple's `/usr/bin/python3` is not a general-purpose Python; it exists
so that Apple's own tooling has an interpreter, and it may be a version well
behind current.

The python.org installer produces something structurally different:

- a `Python 3.14` folder in `/Applications` containing IDLE and Python Launcher;
- a framework at `/Library/Frameworks/Python.framework` holding the executable
  and libraries, added to your shell path by the installer;
- symlinks in `/usr/local/bin/`.

Current installers ship a *"universal2 binary build of Python which runs natively
on all Macs (Apple Silicon and Intel)"*. One post-install step matters and is
easy to skip: double-clicking `Install Certificates.command`, which downloads and
installs SSL root certificates for that interpreter. Without it, HTTPS from that
Python fails in a way that looks like a network problem.

Also note, from the release model: installers are produced *"for current Python
versions (other than those in security status)"* — so once a version goes
security-only there is no more macOS installer for it.

The documented alternatives are Homebrew, MacPorts, ActivePython and Anaconda,
with a caveat attached:

> *"Note that distributions might not include the latest versions of Python or
> other libraries, and are not maintained or supported by the core Python team."*

Homebrew deserves one specific warning: it upgrades Python as a *dependency* of
other formulae. Installing something unrelated can move `python3` from 3.13 to
3.14 underneath you, orphaning every virtual environment built on the old one.
That is not a bug; it is what a package manager does. It is also a strong
argument for keeping your development interpreters under a version manager and
letting Homebrew's Python serve only Homebrew.

## Windows: there is no system Python, and 3.14 changed the tooling

> *"Unlike most Unix systems and services, Windows does not include a system
> supported installation of Python. Instead, Python can be obtained from a number
> of distributors, including directly from the CPython team."*

The first-party route is now the **Python install manager**:

> *"To obtain Python from the CPython team, use the Python Install Manager. This
> is a standalone tool that makes Python available as global commands on your
> Windows machine, integrates with the system, and supports updates over time.
> You can download the Python Install Manager from python.org/downloads or
> through the Microsoft Store app."*

After installing it, three commands exist: `python`, `py` and `pymanager`. The
model is that `python` runs your current default runtime and `py` selects among
them:

> *"Once you have installed the Python install manager, the global python command
> can be used from any terminal to launch your current latest version of Python.
> This version may change over time as you add or remove different versions, and
> the py list command will show which is current."*

```powershell
py list                  # installed runtimes and which is default
py install 3.14          # add a runtime
py install 3.14t         # ...the free-threaded build
py install 3.14-embed --target=<directory>   # an embeddable distribution
py -V:Astral/CPython3.13.1                   # run a specific registered runtime by tag
py install --refresh     # regenerate global shortcuts for installed packages
```

There is one behavioural rule that catches everyone once:

> *"When no runtimes are installed, any launch command will try to install the
> requested version and launch it. However, after any version is installed, only
> the py exec … and pymanager exec … commands will install if the requested
> version is absent. Other forms of commands will display an error and direct you
> to use py install first."*

### The Store stub

Typing `python` on a fresh Windows install opens the Microsoft Store rather than
an interpreter. That is an **app execution alias** — a zero-byte stub the OS
ships so that the command is not simply "not found". The documentation's
troubleshooting table treats it as a configuration problem with a specific
remedy:

> *"python gives me a "command not found" error or opens the Store app when I
> type it in my terminal … Click Start, open "Manage app execution aliases", and
> check that the aliases for "Python (default)" are enabled … Ensure your PATH
> variable contains the entry for
> %UserProfile%\AppData\Local\Microsoft\WindowsApps."*

### Shebang lines do work on Windows

The launcher reads shebang lines, which is why a script written for Unix
generally runs unmodified:

> *"As many Python scripts written to work on Unix will already have this line,
> you should find these scripts can be used by the launcher without
> modification. If you are writing a new script on Windows which you hope will be
> useful on Unix, you should use one of the shebang lines starting with /usr."*

with a 3.13 refinement that matters inside environments:

> *"Changed in version 3.13: Virtual commands referencing python now prefer an
> active virtual environment rather than searching PATH. This handles cases where
> the shebang specifies /usr/bin/env python3 but python3.exe is not present in
> the active environment."*

Underneath all three platforms sits the naming question — whether the command
`python` exists at all, and what to write in a shebang. That is
[the next chunk](09-python-vs-python3.md).

## Gotchas

**Symptom:** on macOS, `python3` is an old version and nothing you install changes it
**Cause:** you are getting Apple's `/usr/bin/python3`, which exists for Xcode and is described in the docs as *"usually older and incomplete"*
**Fix:** install your own interpreter and make sure it precedes `/usr/bin` on `PATH`. Never modify or delete Apple's — the docs say so explicitly, and OS tooling depends on it

**Symptom:** after installing Python from python.org on macOS, HTTPS requests fail with a certificate error
**Cause:** the `Install Certificates.command` post-install step was skipped, so that interpreter has no SSL root certificates
**Fix:** run it from `/Applications/Python 3.14/`. It opens a terminal, installs `certifi` and completes the install

**Symptom:** every virtual environment on a Mac broke after installing an unrelated Homebrew formula
**Cause:** Homebrew upgraded Python as a dependency; the environments point at the old interpreter path, which is gone
**Fix:** recreate the environments, and keep development interpreters under a version manager so Homebrew's Python only ever serves Homebrew

**Symptom:** there is no macOS installer for the version you need
**Cause:** installers are produced *"for current Python versions (other than those in security status)"* — a security-mode version gets source-only releases
**Fix:** use a redistributor's build (`uv`, Homebrew, a distro) or build from source. And treat it as a signal: you are on a version past its bugfix phase

**Symptom:** typing `python` on Windows opens the Microsoft Store
**Cause:** the app execution alias stub is enabled and no real interpreter is registered for that alias
**Fix:** install the Python install manager, then check "Manage app execution aliases" as the troubleshooting table directs, and confirm `%UserProfile%\AppData\Local\Microsoft\WindowsApps` is on `PATH`

**Symptom:** on Windows, `python` and `py` launch different runtimes
**Cause:** the docs list two causes — a leftover Python installation that put itself on `PATH`, or a `python.exe` alias not set to "Python (default)"
**Fix:** remove or modify the old installs to disable their `PATH` entries, and set the alias to "Python (default)". `py list` shows what the manager considers current

**Symptom:** on Windows, `py` reports "can't open file" for commands that used to work
**Cause:** the legacy launcher is installed and takes priority over the Python install manager
**Fix:** the documented remedy — uninstall "Python launcher" from Installed apps

**Symptom:** a pre-release runtime is being chosen ahead of a stable one on Windows
**Cause:** *"Prerelease and experimental installs that are not managed by the Python install manager may be chosen ahead of stable releases"*
**Fix:** configure the default tag or `PYTHON_MANAGER_DEFAULT`, or uninstall the pre-release and reinstall it through `py install` so the manager tracks it

**Symptom:** a package installed with pip on Windows has no working command
**Cause:** the install manager creates global shortcuts at install time and does not add them for packages installed afterwards
**Fix:** `py install --refresh` regenerates them — or use `python -m <tool>`, which the docs recommend and which works everywhere

**Symptom:** `py` says the requested version is absent and refuses to install it
**Cause:** automatic install on launch only happens when *no* runtimes are installed at all; after that only `py exec` and `pymanager exec` will install a missing version
**Fix:** run `py install <version>` explicitly, which is what the error directs you to

**Symptom:** a Linux script that worked for years broke after a distribution upgrade
**Cause:** the distribution moved `/usr/bin/python3` to a newer minor version and rebuilt its own packages; anything installed by hand did not come with it
**Fix:** stop depending on the system interpreter for your own code — the third and fourth options at the top of this page exist for this

**Symptom:** you built Python from source on a shared machine and other people's tooling broke
**Cause:** `make install` overwrote or masqueraded `python3`
**Fix:** `make altinstall`, which installs only the versioned name. If it is already done, restore the previous `python3` and rebuild properly

## Interview questions

**★ What is `/usr/bin/python3` on macOS and what should you do with it?**
It is Apple's Python, shipped with Xcode or the Command Line Tools for Xcode's
own use. The documentation calls it "usually older and incomplete" and says you
should never modify or attempt to delete it, because Apple-provided and
third-party software depend on it. You install your own — from python.org, or
via `uv`, `pyenv` or Homebrew — and the two coexist; the python.org installer's
defaults ensure its `python3` is found first.

**★ Windows has no system Python. What is the first-party way to install one now?**
The Python install manager, available from python.org or the Microsoft Store,
which provides the `python`, `py` and `pymanager` commands and handles installing
and updating runtimes over time. `py list` shows what is installed and which is
current, `py install 3.14` adds a runtime, and specific runtimes can be selected
by tag with `py -V:<tag>`. Before it, typing `python` on a fresh Windows machine
opens the Store, because the OS ships an app execution alias stub for that name.

**★ Where does the Microsoft Store stub come from, and how do you fix it?**
It is an app execution alias — a stub the OS installs so `python` is not simply
"command not found", which instead opens the Store listing. The documented fix is
to install a real Python, then open "Manage app execution aliases" and confirm
the "Python (default)" aliases are enabled, toggling them off and on if the shell
has cached the old resolution, and to ensure the `WindowsApps` directory is on
`PATH`.

**Why is Homebrew's Python a poor choice for project development on macOS?**
Because Homebrew upgrades it as a dependency of unrelated formulae. Installing
some other tool can move `python3` to a new minor version, which orphans every
virtual environment built on the old path. That is correct behaviour for a
package manager and a bad property for a development interpreter, so the usual
arrangement is to let Homebrew's Python serve Homebrew and keep project
interpreters under `uv` or `pyenv`.

**What is the difference between the Python that a distribution ships and one you install yourself?**
Ownership and lifecycle. The distribution's interpreter is a dependency of the
OS, patched on the distribution's schedule, marked externally managed, and
replaced wholesale on a system upgrade. One you install yourself has a version
you chose, a lifecycle you control, no `EXTERNALLY-MANAGED` marker, and no OS
tooling depending on it. For anything you are building, the second is the only
sane choice — the first exists to keep the operating system working.

**What does the python.org macOS installer actually put on the machine?**
An application folder under `/Applications` with IDLE and Python Launcher, a
framework at `/Library/Frameworks/Python.framework` containing the executable and
libraries, and symlinks in `/usr/local/bin`. Recent installers are universal2
builds that run natively on both Apple Silicon and Intel. The step people miss is
`Install Certificates.command`, without which that interpreter has no SSL root
certificates and every HTTPS call fails.

**Why does Windows's story differ so much from Unix's?**
Because Windows ships no system Python at all, so there is no OS-owned
interpreter to protect and no `EXTERNALLY-MANAGED` problem in the same form.
What replaces it is a discovery problem: several distributors, a registry of
installed runtimes, app execution aliases, and a launcher whose job is to pick
among them. That is why the first-party tooling is an *install manager* rather
than a single installer.

---

← Prev: [Choosing a version manager](07-choosing-a-version-manager.md) · Index: [Installing and versions](README.md) · Next → [`python` vs `python3`](09-python-vs-python3.md)
