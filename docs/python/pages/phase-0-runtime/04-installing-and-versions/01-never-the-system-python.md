---
title: "Never install into the system Python: the OS package manager owns those files, and PEP 668 now stops you with an error whose suggested workaround is named after the damage it does"
sidebar_label: "1 · Never the system Python"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against
> [PEP 668 – Marking Python base environments as "externally managed"](https://peps.python.org/pep-0668/),
> its packaging.python.org mirror
> [Externally Managed Environments](https://packaging.python.org/en/latest/specifications/externally-managed-environments/),
> the [pip `install` reference](https://pip.pypa.io/en/stable/cli/pip_install/)
> and pip's own `ExternallyManagedEnvironment` implementation in
> [`src/pip/_internal/exceptions.py`](https://github.com/pypa/pip/blob/25.2/src/pip/_internal/exceptions.py).
> Version spine: **Python 3.14.7**; PEP 668 behaviour is standard in current pip.

**On a Linux machine, `/usr/bin/python3` is not a general-purpose tool that
happens to be installed. It is a *dependency of the operating system*, and its
`site-packages` directory is owned, file by file, by `apt` or `dnf`. Installing a
package into it with `pip` puts an unmanaged file into a managed directory;
upgrading one *replaces* a file the OS package manager still believes it owns;
and because parts of that OS tooling are themselves written in Python and import
from that same directory, the tool you would use to fix the damage can be the
thing you broke. This is not a hypothetical, and PEP 668 says so in as many
words.**

## Why the system Python is different

PEP 668's motivation section is unusually direct about what is at stake:

> *"The python3 executable available to the users of the distro and the python3
> executable available as a dependency for other software in the distro are
> typically the same binary. This means that if an end user installs a Python
> package using a tool like pip outside the context of a virtual environment,
> that package is visible to Python-language software shipped by the distro. If
> the newly-installed package (or one of its dependencies) is a newer,
> backwards-incompatible version of a package that was installed through the
> distro, it may break software shipped by the distro."*

> *"This may pose a critical problem for the integrity of distros, which often
> have package-management tools that are themselves written in Python. For
> example, it's possible to unintentionally break Fedora's dnf command with a
> pip install command, making it hard to recover."*

Note the mechanism carefully: the danger is not that you added something. It is
that adding something can *shadow or replace* a version another program depends
on. And the PEP names both routes in:

> *"This applies both to system-wide installs (sudo pip install) as well as user
> home directory installs (pip install --user), since packages in either
> location show up on the sys.path of /usr/bin/python3."*

That second clause surprises people who thought `--user` was the safe option. It
is not safe; it is merely *quieter*. A package in `~/.local/lib/python3.x/`
is on the default interpreter's `sys.path`, so it shadows the distro's copy for
every program that runs as you — including, on many systems, distro tooling.

### Why `sudo pip` is worse than `pip --user`

There is a second, sharper failure specific to installing as root:

> *"There is a worse problem with system-wide installs: if you attempt to recover
> from this situation with sudo pip uninstall, you may end up removing packages
> that are shipped by the system's package manager. In fact, this can even happen
> if you simply upgrade a package - pip will try to remove the old version of the
> package, as shipped by the OS. At this point it may not be possible to recover
> the system to a consistent state using just the software remaining on the
> system."*

That is the whole case in one paragraph. `pip install --upgrade` is
*install-new-then-delete-old*, and the "old" it deletes may be a file `dpkg` or
`rpm` still has in its database. The package manager now believes a file exists
that does not. You have created a divergence that neither tool can see.

## The mechanism that now stops you

PEP 668 defines a marker file and two checks. The specification:

> *"Before a Python-specific package installer (that is, a tool such as pip - not
> an external tool such as apt) installs a package into a certain Python
> context, it should make the following checks by default: Is it running outside
> of a virtual environment? It can determine this by whether sys.prefix ==
> sys.base_prefix … Is there an EXTERNALLY-MANAGED file in the directory
> identified by sysconfig.get_path("stdlib", sysconfig.get_default_scheme())?"*

> *"If both of these conditions are true, the installer should exit with an error
> message indicating that package installation into this Python interpreter's
> directory are disabled outside of a virtual environment."*

Two consequences fall straight out of that:

- **A virtual environment is exempt**, and not by special-casing: inside a venv
  `sys.prefix` differs from `sys.base_prefix`, so the first condition is false
  and the check never reaches the marker file. This is the same mechanism a venv
  uses for everything else, and **05 · Virtual environments** *(not written
  yet)* covers it.
- **The marker marks the interpreter, not a directory.** The PEP puts it in the
  stdlib directory deliberately, *"which marks the interpreter / installation as
  a whole, not a particular location on sys.path"* — because otherwise
  `pip install --user`, which writes elsewhere, would slip past it.

You can see the marker yourself:

```bash
python3 -c "import sysconfig; print(sysconfig.get_path('stdlib', sysconfig.get_default_scheme()))"
# then look for an EXTERNALLY-MANAGED file in that directory
```

It is an INI file. The PEP specifies that installers read a human-readable
message out of it and print that message as part of the error, with the Debian
example given in the PEP itself:

```ini
[externally-managed]
Error=To install Python packages system-wide, try apt install
 python3-xyz, where xyz is the package you are trying to
 install.
 If you wish to install a non-Debian-packaged Python package,
 create a virtual environment using python3 -m venv path/to/venv.
 Then use path/to/venv/bin/python and path/to/venv/bin/pip. Make
 sure you have python3-full installed.
 If you wish to install a non-Debian packaged Python application,
 it may be easiest to use pipx install xyz, which will manage a
 virtual environment for you. Make sure you have pipx installed.
```

So the long error you get on Debian or Ubuntu is not pip's invention — it is
text your *distributor* wrote and shipped, and it is telling you what that
distributor wants you to do instead.

## The error, and what pip is actually saying

pip raises `ExternallyManagedEnvironment`, whose diagnostic reference string is
`externally-managed-environment` — that is where the `error:
externally-managed-environment` heading comes from. Its message is
*"This environment is externally managed"*, and where the distributor supplied
no message of their own, pip substitutes its own default:

> *"The Python environment under \{sys.prefix\} is managed externally, and may not
> be manipulated by the user. Please use specific tooling from the distributor
> of the Python installation to interact with this environment instead."*

The note pip attaches beneath is the load-bearing sentence:

> *"If you believe this is a mistake, please contact your Python installation or
> OS distribution provider. You can override this, at the risk of breaking your
> Python installation or OS, by passing --break-system-packages."*

The flag's name is not accidental. PEP 668 requires it:

> *"The installer should have a way for the user to override these rules, such as
> a command-line flag --break-system-packages. This option should not be enabled
> by default and should carry some connotation that its use is risky."*

pip's own option documentation is one line: *"Allow pip to modify an
EXTERNALLY-MANAGED Python installation"*, with the environment variable
`PIP_BREAK_SYSTEM_PACKAGES`. That environment variable is worth knowing about
mostly so you can recognise it in someone else's Dockerfile or CI config, where
it silently disables the protection for every subsequent `pip` invocation.

The four correct answers to that error — and the one wrong one — are
[the next chunk](02-responding-to-pep-668.md). This one is about why the error
exists at all.

## Gotchas

**Symptom:** `error: externally-managed-environment` and a long message about `apt install python3-xyz`
**Cause:** you are running `pip` against a distro interpreter that ships an `EXTERNALLY-MANAGED` marker, outside a virtual environment. The long text was written by your distributor and read out of that file by pip
**Fix:** read the distributor's message — it names the distro's own preferred route — then pick one of the responses in [chunk 2](02-responding-to-pep-668.md)

**Symptom:** `pip install --user` was recommended as the "safe" alternative and things still broke
**Cause:** PEP 668 is explicit that `--user` installs land on `/usr/bin/python3`'s `sys.path` too, so they shadow distro packages for everything you run
**Fix:** a virtual environment, not `--user`. `--user` solves a permissions problem, not an isolation problem

**Symptom:** `sudo pip install --upgrade <pkg>` left the system in a state `apt` cannot repair
**Cause:** an upgrade removes the old version first, and the old version was a distro-owned file. The package database now disagrees with the filesystem
**Fix:** `apt install --reinstall` / `dnf reinstall` the affected distro packages to put the owned files back. Prevention is the only real cure here

**Symptom:** `pip` inside an activated venv still wrote to the system interpreter
**Cause:** you ran `sudo pip`, and `sudo` reset the environment — including `PATH` and `VIRTUAL_ENV` — so the `pip` that ran was `/usr/bin/pip`
**Fix:** `sudo` and virtual environments do not mix. If you needed root, you were installing in the wrong place

**Symptom:** a colleague's machine works and yours does not, with identical commands
**Cause:** different distributors make different choices. Not every interpreter is marked; the PEP is explicit that an upstream-compiled interpreter is unmarked by default, and distributors have each chosen differently over time
**Fix:** stop reasoning about "the system Python" as one thing. Check `sys.prefix` and look for the marker file on the machine in front of you

**Symptom:** an internal script that used to run under `/usr/bin/python3` broke after an OS upgrade
**Cause:** the distro moved to a newer minor version of Python and rebuilt its own packages; anything you had added by hand did not come along
**Fix:** this is the strongest argument for never depending on the system interpreter for your own code. Ship your own interpreter, or at minimum your own venv, so an OS upgrade cannot reach it

**Symptom:** `PIP_BREAK_SYSTEM_PACKAGES` is set in a Dockerfile or CI config and nobody noticed
**Cause:** every pip option has an environment-variable form, so the protection can be disabled once, globally, with no flag visible at any call site
**Fix:** grep for it whenever a machine or image shows system-level installs that "should not have worked". It is the environment variable equivalent of a flag named after breaking your system

**Symptom:** the marker file is missing on a machine you expected it on, so `pip` happily installs system-wide
**Cause:** PEP 668 is opt-in for distributors — *"by default, the Python interpreter compiled from upstream sources will not be so marked"* — and single-application container images are explicitly allowed to omit it
**Fix:** absence of the marker is not permission. The reasons not to install into an OS-managed interpreter are unchanged; the guard rail is just not there

## Interview questions

**★ What does `error: externally-managed-environment` actually mean?**
That pip found an `EXTERNALLY-MANAGED` marker file in the interpreter's standard
library directory *and* determined it was not running inside a virtual
environment, so under PEP 668 it refused to modify a `site-packages` that the
operating system's package manager owns. It is not pip being difficult: the long
explanatory text underneath is read out of that marker file and was written by
whoever packaged your Python.

**★ Why is `sudo pip install` specifically dangerous, more so than `pip install --user`?**
Both put packages onto `/usr/bin/python3`'s `sys.path`, so both can shadow a
version the distro's own Python-language tooling depends on — PEP 668 gives
breaking Fedora's `dnf` as the example. But a root install adds a second
failure: pip's upgrade path removes the old version first, and that file may be
owned by `dpkg` or `rpm`. The package database and the filesystem then disagree,
and the PEP says it may not be possible to recover a consistent state using only
the software left on the machine.

**★ How does PEP 668 decide whether to block an install?**
Two checks, both of which must be true. First, is this outside a virtual
environment — determined by whether `sys.prefix == sys.base_prefix`. Second, is
there an `EXTERNALLY-MANAGED` file in the directory given by
`sysconfig.get_path("stdlib", sysconfig.get_default_scheme())`. The marker lives
in the stdlib directory on purpose, so that it marks the interpreter as a whole
rather than one `sys.path` entry — otherwise `pip install --user`, which writes
somewhere else entirely, would evade it.

**Why is a virtual environment exempt from the check?**
Because inside a venv `sys.prefix` points at the environment and
`sys.base_prefix` points at the interpreter it was built from, so the first
condition — "running outside a virtual environment" — is false and the marker is
never consulted. It is not a special case in pip; it falls out of the same
prefix redirection that makes venvs work at all.

**Why is the flag called `--break-system-packages` rather than something neutral like `--force`?**
Because PEP 668 requires the override to exist *and* requires that it "carry
some connotation that its use is risky". The name is doing deliberate work: it
is meant to be uncomfortable to type and obvious in a code review. pip's note
says the same thing in prose — you can override this "at the risk of breaking
your Python installation or OS".

**Is every Python interpreter marked as externally managed?**
No, and that is by design. PEP 668 is opt-in for distributors: an interpreter
you compile from upstream sources, or one installed by a version manager into
your home directory, is unmarked, so pip will install into it without complaint.
That is correct — nothing else owns those files. The marker appears on
interpreters where an OS package manager is the owner.

**What does the marker file contain, and why does it matter?**
It is an INI file with an `[externally-managed]` section and an `Error` key —
optionally localised with `Error-<lang>` keys — whose value the installer prints
as part of its error. That is why the message you see on Debian talks about
`apt`, `python3-full` and `pipx` specifically: it is distributor-authored advice
delivered through a standardised channel, not a generic pip string.

---

← Index: [Installing and versions](README.md) · Next → [Responding to PEP 668](02-responding-to-pep-668.md)
