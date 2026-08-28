---
title: "uv's resolution order: what it searches, what it prefers, and the two rules that will hand you a release candidate or a free-threaded build without being asked"
sidebar_label: "5 · uv resolution and variants"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the uv documentation —
> [Python versions](https://docs.astral.sh/uv/concepts/python-versions/) —
> and [PEP 514](https://peps.python.org/pep-0514/) for Windows registry
> registration. The uv page cited was last updated 2026-07-25.
> Version spine: **Python 3.14.7**; 3.15 at release candidate.

**uv's convenience comes from resolving an interpreter automatically, and every
automatic resolution is a rule you did not write. Four of those rules produce
outcomes people do not expect: a system interpreter is preferred over a fresh
download; among system interpreters the *first* compatible one wins rather than
the newest; a pre-release is used when nothing else matches; and from Python 3.14
onward a free-threaded interpreter can be selected without anyone asking for
one.**

## Discovery: what uv looks at, and in what order

> *"When searching for a Python version, the following locations are checked:
> Managed Python installations in the UV_PYTHON_INSTALL_DIR. A Python
> interpreter on the PATH as python, python3, or python3.x on macOS and Linux,
> or python.exe on Windows. On Windows, the Python interpreters in the Windows
> registry and Microsoft Store Python interpreters (see py --list-paths) that
> match the requested version."*

with a preference rule that differs between the two kinds:

> *"When searching for a managed Python version, uv will prefer newer versions
> first. When searching for a system Python version, uv will use the first
> compatible version — not the newest version."*

The default preference is `managed`, which the docs describe as preferring uv's
own installations over system ones, though *"system Python installations are
still preferred over downloading a managed Python version"*. You can force
either side:

```bash
uv python list --managed-python      # only uv's own
uv python list --no-managed-python   # only the system's
```

and set it permanently with the `python-preference` setting
(`managed`, `only-managed`, `system`, `only-system`). Automatic downloads are
controlled separately by `python-downloads` (`automatic` or `manual`) or
`--no-python-downloads`.

Two commands answer "what did it pick and why":

```bash
uv python list            # installed and available
uv python list --all-versions --all-platforms
uv python find            # the path uv would use here
uv python find '>=3.11'   # ...for a given request
uv python find --system   # ignoring virtual environments
```

By default `uv python find` includes virtual environments, and *"If a .venv
directory is found in the working directory or any of the parent directories or
the VIRTUAL_ENV environment variable is set, it will take precedence over any
Python executables on the PATH."*

## Upgrades, and the symlink that makes them transparent

```bash
uv python upgrade 3.12    # to the latest supported patch
uv python upgrade         # every installed version
```

Only patch upgrades: *"uv does not allow transparently upgrading across minor
Python versions, e.g., 3.12 to 3.13, because changing minor versions can affect
dependency resolution."*

The mechanism is a minor-version directory that is a symlink (or a Windows
junction) to the current patch version, so existing environments follow along:

> *"Virtual environments using the Python version will be automatically upgraded
> to the new patch version. If a virtual environment was created with an
> explicitly requested patch version, e.g., uv venv -p 3.10.8, it will not be
> transparently upgraded to a new version."*

with one warning attached that explains an otherwise baffling failure:

> *"If this link is resolved by another tool, e.g., by canonicalizing the Python
> interpreter path, and used to create a virtual environment, it will not be
> automatically upgraded."*

## Pre-releases and free-threaded builds

Pre-releases are opt-in by omission rather than by flag:

> *"Python pre-releases will not be selected by default. Python pre-releases will
> be used if there is no other available installation matching the request. For
> example, if only a pre-release version is available it will be used but
> otherwise a stable release version will be used."*

So `uv python install 3.15` today, with 3.15 still at release candidate, gives
you the candidate — because nothing else matches. That is convenient and it is
also how a pre-release ends up somewhere it should not.

Free-threaded selection changed with 3.14 and the two rules are different:

> *"For Python 3.13, free-threaded Python versions will not be selected by
> default. Free-threaded Python versions will only be selected when explicitly
> requested, e.g., with 3.13t or 3.13+freethreaded."*

> *"For Python 3.14+, uv will allow use of free-threaded Python 3.14+
> interpreters without explicit selection. The GIL-enabled build of Python will
> still be preferred, e.g., when performing an installation with uv python
> install 3.14. However, e.g., if a free-threaded interpreter comes before a
> GIL-enabled build on the PATH, it will be used."*

Read the second one twice. On 3.14 and later, a free-threaded interpreter that
happens to be earlier on `PATH` will be selected without you asking. If a
project must not run free-threaded, say so with the `+gil` variant. [Chunk
12](12-free-threaded-builds.md) covers the build itself.

## On Windows

uv registers its installations in the registry per PEP 514, so the `py` launcher
can see them:

```powershell
uv python install 3.13.1
py -V:Astral/CPython3.13.1
```

and it removes those entries — plus any broken ones — on uninstall.


## Gotchas

**Symptom:** uv picked a system Python you did not expect instead of downloading one
**Cause:** the default preference prefers managed installations but still prefers an existing system installation over a fresh download. And for system interpreters uv takes the *first compatible* one on `PATH`, not the newest
**Fix:** `uv python find` to see what it chose; `--managed-python` or `python-preference = "only-managed"` to remove system interpreters from consideration entirely

**Symptom:** a release candidate ended up in a development environment
**Cause:** pre-releases are used when nothing else matches the request. Asking for a version that has not had a final release yet resolves to its candidate
**Fix:** request a version that exists as a final release, or assert `sys.version_info.releaselevel == "final"` at startup for anything that matters

**Symptom:** on 3.14, a free-threaded interpreter was selected without anyone asking for it
**Cause:** from 3.14 uv permits free-threaded interpreters without explicit selection; if one precedes the GIL-enabled build on `PATH`, it wins
**Fix:** request `3.14+gil` explicitly where the GIL build is required, and assert `sys._is_gil_enabled()` at startup if the difference matters to you

**Symptom:** a virtual environment did not follow a patch upgrade
**Cause:** either it was created from an explicitly requested patch version, which uv deliberately does not upgrade, or another tool canonicalised the interpreter path and stored the resolved patch directory rather than the minor-version link
**Fix:** recreate the environment. When creating environments from other tooling, point at the minor-version path rather than a resolved absolute one

**Symptom:** `uv python upgrade 3.12` will not move you to 3.13
**Cause:** deliberate — *"uv does not allow transparently upgrading across minor Python versions … because changing minor versions can affect dependency resolution"*
**Fix:** a minor upgrade is a project decision, not a maintenance command. Install the new minor version, change the pin, re-resolve the lockfile, run the tests

**Symptom:** `uv python find` disagrees with `which python`
**Cause:** they answer different questions — uv includes virtual environments and its own managed installations, the shell only searches `PATH`
**Fix:** trust `uv python find` for what uv will do and `sys.executable` for what is actually running; `uv python find --system` when you want to exclude environments

**Symptom:** a `.venv` in a parent directory hijacked the interpreter selection
**Cause:** by default `uv python find` includes virtual environments, and a `.venv` in the working directory *or any parent*, or a set `VIRTUAL_ENV`, takes precedence over `PATH`
**Fix:** check for a stray `.venv` above your project, and unset `VIRTUAL_ENV` if a previous activation is leaking into a different project's shell

**Symptom:** upgrading an old uv installation quietly changed which Python patch version projects resolve to
**Cause:** the available version list is frozen per uv release, so a new uv exposes newer patch releases and the "latest patch of 3.14" request now resolves differently
**Fix:** this is usually what you want, but it means uv's own version is part of your build inputs. Pin uv in CI and upgrade it deliberately

**Symptom:** on Windows, `py` cannot see an interpreter uv installed
**Cause:** the registry entry is missing or stale — uv registers managed installations per PEP 514, and removes entries on uninstall
**Fix:** reinstall the version with uv so the registration is rewritten, then confirm with `py --list-paths`

**Symptom:** an x86_64 interpreter is running on an arm64 machine and everything is slow
**Cause:** both macOS and Windows can run x86_64 binaries under emulation, and uv can use either. The docs note a Python interpreter *"needs packages for its architecture, either all x86_64 or all aarch64"*
**Fix:** check `platform.machine()` inside the interpreter, not on the shell, and request an interpreter of the right architecture explicitly

## Interview questions

**★ uv chose an interpreter you did not expect. How do you find out why?**
`uv python find` prints the path it would use for the current context, and
`uv python list` shows everything it can see. Then check the inputs in order: a
`--python` flag, a `.venv` in this directory or a parent (or `VIRTUAL_ENV`), a
`.python-version` file up to the project boundary, the user configuration
directory, and `requires-python`. If it picked a system interpreter, remember
that uv prefers an existing system install over a fresh download and takes the
*first compatible* one on `PATH` rather than the newest.

**★ Will uv give you a pre-release without being asked?**
Only if nothing else matches the request. The rule is that pre-releases are not
selected by default but are used when there is no stable version satisfying the
request — so asking for a version whose final release has not happened yet gets
you its release candidate. That is convenient during a beta window and a hazard
in a shared configuration file, which is why anything that matters should assert
`sys.version_info.releaselevel` at startup.

**★ What changed about free-threaded selection between 3.13 and 3.14 in uv?**
On 3.13, a free-threaded interpreter is only ever selected when explicitly
requested with `3.13t` or `3.13+freethreaded`. From 3.14, uv allows free-threaded
interpreters without explicit selection — the GIL-enabled build is still
preferred for installs, but a free-threaded interpreter earlier on `PATH` will be
used. If a project must be on the GIL build, request the `+gil` variant rather
than relying on the default.

**How do patch upgrades reach an existing virtual environment?**
Through a directory named for the minor version — for example
`cpython-3.12-macos-aarch64-none` — which is a symlink or junction to the current
patch directory. Environments referencing the minor-version path follow the
upgrade automatically. Two things break that: creating the environment from an
explicitly requested patch version, which uv deliberately does not upgrade, and
another tool canonicalising the path so the environment records the resolved
patch directory instead of the link.

**Why will uv upgrade 3.12.4 to 3.12.11 but not 3.12 to 3.13?**
Because a patch upgrade is compatibility-preserving by CPython's own policy,
while a minor upgrade can change dependency resolution — the uv docs give
exactly that reason. So patch upgrades are a maintenance operation that
environments follow automatically, and minor upgrades are a project decision
requiring a new pin, a re-resolved lockfile and a test run.

**What are the four `python-preference` values and when would you change the default?**
`managed` (the default) prefers uv's own installations but still prefers an
existing system installation over downloading a new one; `only-managed` ignores
system interpreters entirely; `system` prefers system installations; and
`only-system` never uses managed ones. I would set `only-managed` on CI and
developer machines where reproducibility matters more than reuse, and
`only-system` in a container that already ships exactly the interpreter I intend
to use.

**How does uv find interpreters on Windows that it did not install?**
It checks its own install directory, then `python.exe` on `PATH`, then
interpreters registered in the Windows registry and Microsoft Store Pythons that
match the request — the same set `py --list-paths` reports. And its own managed
installations are registered into that registry per PEP 514, so they appear to
the `py` launcher as `Astral/CPython3.13.1` style tags.

---

← Prev: [`uv`](04-uv.md) · Index: [Installing and versions](README.md) · Next → [`pyenv`](06-pyenv.md)
