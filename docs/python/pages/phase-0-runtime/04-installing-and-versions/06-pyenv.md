---
title: "pyenv: a directory of shims at the front of PATH, a compiler running for four minutes, and why that is sometimes exactly what you want"
sidebar_label: "6 · pyenv"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the
> [pyenv README](https://github.com/pyenv/pyenv/blob/master/README.md) and its
> [COMMANDS reference](https://github.com/pyenv/pyenv/blob/master/COMMANDS.md),
> the [uv Python versions](https://docs.astral.sh/uv/concepts/python-versions/)
> documentation for the comparison, and
> [Using Python on Unix platforms](https://docs.python.org/3.14/using/unix.html).
> Version spine: **Python 3.14.7**.

**pyenv predates `uv` by a decade and is still on a very large number of
machines, so you will meet it whether or not you choose it. It solves the same
problem by an entirely different mechanism: instead of resolving an interpreter
per command, it hijacks the command name. A directory of *shims* goes at the
front of your `PATH`, and the executable called `python` in that directory is not
Python — it is a dispatcher that asks pyenv which version you meant. Once you
know that, every strange thing pyenv does becomes predictable.**

## What it is, and what it deliberately is not

The README's own framing:

> *"pyenv lets you easily switch between multiple versions of Python. It's
> simple, unobtrusive, and follows the UNIX tradition of single-purpose tools
> that do one thing well."*

Three explicit non-goals matter for the comparison:

> *"Depend on Python itself. pyenv was made from pure shell scripts. There is no
> bootstrap problem of Python."*

> *"Need to be loaded into your shell. Instead, pyenv's shim approach works by
> adding a directory to your PATH."*

> *"Manage virtualenv. Of course, you can create virtualenv yourself, or
> pyenv-virtualenv to automate the process."*

That last one is the structural difference from `uv`: pyenv manages layer 2 of
[the three-layer model](03-installations-managers-environments.md) and nothing
else. Environments and packages remain your problem, solved with `venv`, `pip`,
`poetry`, or the `pyenv-virtualenv` plugin.

## The shim mechanism, in the README's own words

> *"At a high level, pyenv intercepts Python commands using shim executables
> injected into your PATH, determines which Python version has been specified by
> your application, and passes your commands along to the correct Python
> installation."*

> *"pyenv works by inserting a directory of shims at the front of your PATH:
> `$(pyenv root)/shims:/usr/local/bin:/usr/bin:/bin`. Through a process called
> rehashing, pyenv maintains shims in that directory to match every Python
> command across every installed version of Python—python, pip, and so on."*

> *"Shims are lightweight executables that simply pass your command along to
> pyenv. So with pyenv installed, when you run, say, pip, your operating system
> will do the following: Search your PATH for an executable file named pip. Find
> the pyenv shim named pip at the beginning of your PATH. Run the shim named
> pip, which in turn passes the command along to pyenv."*

Four consequences follow directly, and they are the whole of pyenv's behaviour:

1. **`which python` lies.** It returns the shim. `pyenv which python` returns the
   real executable, and `python -c "import sys; print(sys.executable)"` returns
   it from the other side.
2. **The interception is global.** Every shell, every process that inherits that
   `PATH`, every `python` and `pip` and console script. There is no per-command
   opt-out short of removing the shims directory from `PATH`.
3. **New executables need a rehash.** Install a package that provides a console
   script and the shim for it does not exist yet. `pyenv rehash` creates it.
   (Modern pyenv rehashes automatically after `pyenv install` and `pip install`
   through a shim, but the failure mode — "I installed it, the command is not
   found" — is still the classic pyenv symptom.)
4. **Shims fall through.** The README: *"Shims also fall through to anything
   further on PATH if the corresponding executable is not present in any of the
   selected Python installations."* So a missing tool silently runs a different
   one from elsewhere on the system.

## How pyenv decides which version

Verbatim, because the order is the answer to almost every pyenv question:

> *"When you execute a shim, pyenv determines which Python version to use by
> reading it from the following sources, in this order:
> 1. The PYENV_VERSION environment variable (if specified). You can use the
> pyenv shell command to set this environment variable in your current shell
> session.
> 2. The application-specific .python-version file in the current directory (if
> present). You can modify the current directory's .python-version file with the
> pyenv local command.
> 3. The first .python-version file found (if any) by searching each parent
> directory, until reaching the root of your filesystem.
> 4. The global $(pyenv root)/version file. You can modify this file using the
> pyenv global command. If the global version file is not present, pyenv assumes
> you want to use the "system" Python (see below)."*

Note step 3: unlike uv, pyenv walks **all the way to the filesystem root**. A
stray `.python-version` in your home directory affects every project beneath it.

And the special version name:

> *"A special version name "system" means to use whatever Python is found on PATH
> after the shims PATH entry (in other words, whatever would be run if Pyenv
> shims weren't on PATH). Note that Pyenv considers those installations outside
> its control and does not attempt to inspect or distinguish them in any way."*

The commands that write each of those sources:

```bash
pyenv install 3.14.7      # build and install a version
pyenv versions            # what is installed
pyenv global 3.14.7       # writes $(pyenv root)/version
pyenv local 3.13.15       # writes ./.python-version
pyenv shell 3.12.11       # sets PYENV_VERSION for this shell only
pyenv which python        # the real executable behind the shim
pyenv rehash              # regenerate shims after installing console scripts
```

`pyenv global system 3.13 3.12` activates several at once — the README notes this
is *"required with tools like tox"*, because tox needs `python3.12` and
`python3.13` to both be callable.

## Building from source: the real trade-off

> *"Most Pyenv-provided Python releases are source releases and are built from
> source as part of installation (that's why you need Python build dependencies
> preinstalled). You can pass options to Python's configure and compiler flags to
> customize the build."*

That sentence contains both the cost and the reason to accept it.

**The cost:** a compiler toolchain and a list of `-dev` headers must be present
before `pyenv install` will succeed, and the build takes real time. The failure
mode is a build error deep in a `make` log — usually a missing library — and the
project maintains a "Common build problems" wiki page precisely because this is
the most common support question. uv's documentation makes the same point from
the other side: building optimised interpreters *"requires preinstalled system
dependencies, and creating optimized, performant builds (e.g., with PGO and LTO
enabled) is very slow."*

**The reason:** you get to control the build. Custom `configure` flags, a
specific OpenSSL, `--enable-optimizations`, `--with-lto`, a shared library build
for embedding, `--disable-gil` for a free-threaded interpreter. If you need an
interpreter that matches a particular production build, source is the only way
to get it.

Installations land under `$(pyenv root)/versions`, and the README is blunt about
what a "version" is: *"As far as Pyenv is concerned, version names are simply
directories under `$(pyenv root)/versions`."* You can drop a directory in there
and pyenv will offer it.

## Windows

> *"Pyenv does not officially support Windows and does not work in Windows
> outside the Windows Subsystem for Linux. Moreover, even there, the Pythons it
> installs are not native Windows versions but rather Linux versions running in
> a virtual machine — so you won't get Windows-specific functionality."*

The README points Windows users at the separate `pyenv-win` fork. On Windows the
first-party answer is the Python install manager and the `py` launcher, covered
in [chunk 8](08-platform-stories.md).


How pyenv compares to `uv`, and where `mise`, `asdf` and `conda` fit, is
[the next chunk](07-choosing-a-version-manager.md).

## Gotchas

**Symptom:** `which python` shows a pyenv shim and you cannot tell which version it will run
**Cause:** the shim is a dispatcher, not an interpreter. Its path is the same regardless of the selected version
**Fix:** `pyenv which python` for pyenv's answer, `pyenv version` for the selected version and *why* (it names the source), and `python -c "import sys; print(sys.executable)"` from the other side

**Symptom:** you installed a package with a console script and the command is not found
**Cause:** no shim exists for the new executable yet
**Fix:** `pyenv rehash`. If it happens repeatedly, check that you are installing through a shimmed `pip` rather than an absolute path that bypasses pyenv

**Symptom:** a command runs a completely different program than expected
**Cause:** shim fall-through — the executable is not present in any selected Python installation, so the shim passes it to whatever is further along `PATH`
**Fix:** check `pyenv which <command>`; if it resolves outside `$(pyenv root)/versions`, that is fall-through and the tool is not installed where you think

**Symptom:** every project on the machine suddenly uses the wrong version
**Cause:** a `.python-version` file somewhere above them. pyenv searches parent directories all the way to the filesystem root, so one in `$HOME` catches everything
**Fix:** `pyenv version` prints the selected version and its source. Delete the stray file, or set an explicit `pyenv local` per project

**Symptom:** `pyenv install` fails partway through with a compiler error
**Cause:** missing build dependencies — headers for OpenSSL, readline, sqlite, libffi, bz2, and so on. pyenv builds from source and does not vendor them
**Fix:** install the documented build dependencies for your OS first. The project's "Common build problems" wiki page exists for exactly this and lists the package sets

**Symptom:** the interpreter built fine but `import ssl` or `import sqlite3` fails
**Cause:** the header package was missing at *build* time, so the module was silently skipped. The build succeeded; the interpreter is incomplete
**Fix:** install the missing `-dev` package and rebuild that version with `pyenv install --force`. This is the single most common pyenv support issue and it does not announce itself at build time

**Symptom:** `pyenv global` was set and a cron job or systemd unit still uses the system Python
**Cause:** those contexts do not source your shell profile, so the shims directory is not on their `PATH`
**Fix:** use absolute paths to the interpreter in service definitions. Relying on a shell-configured `PATH` for a non-interactive process is the underlying mistake

**Symptom:** Homebrew misbehaves after installing pyenv on macOS
**Cause:** Homebrew's own scripts pick up the shimmed `python`, which is not the interpreter Homebrew built against. The pyenv README ships an alias that strips the shims directory from `PATH` for `brew` specifically
**Fix:** use that alias, or run `brew` with a clean `PATH`. It is a general pattern: anything that expects the *system* interpreter must not see the shims

**Symptom:** removing a Python version orphaned several virtual environments
**Cause:** a venv records the absolute path of the interpreter it was built from, under `$(pyenv root)/versions`. Uninstalling the version deletes that directory
**Fix:** recreate the environments. pyenv does not track which environments depend on which version, because managing environments is explicitly not its job

**Symptom:** a version appears in `pyenv versions` that pyenv never installed
**Cause:** *"As far as Pyenv is concerned, version names are simply directories under `$(pyenv root)/versions`"* — anything placed there is offered
**Fix:** useful when you want to register an externally built interpreter; confusing when a half-finished install left a directory behind. Remove the directory to remove the version

**Symptom:** `tox` cannot find the interpreters it needs even though they are installed
**Cause:** only the selected version's executables have working shims. tox needs `python3.12` and `python3.13` to be simultaneously callable
**Fix:** activate several at once — `pyenv global system 3.13 3.12` — which the README notes is exactly why multiple activation exists

## Interview questions

**★ How does pyenv actually make `python` mean a different version?**
It puts a directory of shims at the front of `PATH`. The file called `python` in
that directory is not an interpreter; it is a small executable that hands the
command to pyenv, which reads the selected version — from `PYENV_VERSION`, a
`.python-version` in the current directory, a `.python-version` in any parent up
to the filesystem root, or the global version file — and re-dispatches to the
real binary under `$(pyenv root)/versions`. That is why `which python` shows a
path that is identical no matter which version is active.

**★ Someone's pyenv-built Python cannot `import ssl`. What happened?**
The OpenSSL development headers were missing when pyenv compiled that version,
so the `_ssl` extension module was skipped. The build still reports success,
which is why this is so confusing — the interpreter is complete except for the
modules whose dependencies were absent. The fix is to install the build
dependencies for the platform and rebuild that version with
`pyenv install --force`.

**★ In what order does pyenv decide which version to use?**
`PYENV_VERSION` in the environment first, then a `.python-version` in the current
directory, then the first `.python-version` found by walking parent directories
all the way to the filesystem root, then the global version file at
`$(pyenv root)/version`. If none of those exist, it falls back to the special
name `system`. `pyenv version` prints both the answer and which of those sources
produced it, which makes it the first command to run on any "wrong version"
report.

**Why does `pyenv rehash` exist?**
Because the shims directory has to contain a file for every executable name any
installed Python provides, and installing a package that ships a console script
creates a new name. Until pyenv writes a shim for it, `PATH` lookup finds
nothing and the command appears not to exist. Rehashing regenerates the
directory.

**What does the pyenv version name `system` mean?**
Whatever Python would run if the shims directory were not on `PATH` — the first
one found further along. The README stresses that pyenv treats those
installations as outside its control and does not inspect or distinguish them,
so on a Mac with an Apple Python and two Homebrew Pythons, all three are just
"system" and whichever comes first wins.

**What is shim fall-through and when does it bite?**
If the command you typed is not present in any *selected* Python installation,
the shim passes it along to whatever is further on `PATH` instead of failing.
That is deliberate — it lets non-Python tools keep working — but it means a
missing tool silently runs a different copy from somewhere else, which is a
confusing failure when the two copies are different versions of the same
program.

**Why does pyenv need a compiler when uv does not?**
Because pyenv installs source releases and builds them locally, which is also
what gives you control over `configure` and compiler flags. uv ships pre-built
portable distributions, so it needs nothing but is limited to the builds Astral
publishes. The trade is build control and fidelity against setup cost and speed.

---

← Prev: [uv's resolution order and variants](05-uv-resolution-and-variants.md) · Index: [Installing and versions](README.md) · Next → [Choosing a version manager](07-choosing-a-version-manager.md)
