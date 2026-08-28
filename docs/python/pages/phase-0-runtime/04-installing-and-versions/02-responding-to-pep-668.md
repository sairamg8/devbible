---
title: "Responding to the externally-managed error: four correct answers, one wrong one, and how to recover a machine where somebody already picked the wrong one"
sidebar_label: "2 · Responding to PEP 668"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against
> [PEP 668](https://peps.python.org/pep-0668/) and its packaging.python.org
> mirror [Externally Managed Environments](https://packaging.python.org/en/latest/specifications/externally-managed-environments/),
> the [`venv` module docs](https://docs.python.org/3.14/library/venv.html),
> the [uv documentation](https://docs.astral.sh/uv/concepts/python-versions/) and
> [uv tools](https://docs.astral.sh/uv/concepts/tools/).
> Version spine: **Python 3.14.7**.

**Nearly everyone who meets `error: externally-managed-environment` for the
first time resolves it by copying the flag out of the error message. That works,
and it is the only option on the list that can leave the machine worse than it
started. There are four responses that do not, and which one is right depends
entirely on a question you have to answer first: are you installing a *library*
for your own project, an *application* you want on your PATH, or something that
genuinely has to be visible to software the distribution shipped?**

## The correct responses, in order

When you see `error: externally-managed-environment`, there are four right
answers and one wrong one.

**1 · You want a library for a project → make a virtual environment.**

```bash
python3 -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install httpx
```

or, without activating anything:

```bash
uv venv
uv pip install httpx
```

On Debian and Ubuntu, `python3 -m venv` may itself fail until you install
`python3-venv` (or `python3-full`, which the distro's own error message
recommends) — the distro splits the standard library into several packages.

**2 · You want a command-line application written in Python → install it as an
application, in its own environment.**

```bash
uv tool install ruff            # or: pipx install ruff
uvx ruff check .                # or: pipx run ruff check .
```

[Chunk 10](10-installing-applications.md) covers why this is a different problem
from installing a library.

**3 · You want the package to be visible to distro-shipped software → use the
distro's package.**

```bash
sudo apt install python3-requests      # Debian / Ubuntu
sudo dnf install python3-requests      # Fedora / RHEL
```

This is the case PEP 668 explicitly preserves — a Sphinx or Ansible extension
that must be importable by the distro's copy of the base tool. The distro
package is built against the distro's Python and tracked by the package manager,
so nothing diverges.

**4 · You do not want the system interpreter at all → install your own.**

```bash
uv python install 3.14
uv run --python 3.14 app.py
```

An interpreter under your own home directory has no `EXTERNALLY-MANAGED` marker,
because — as the PEP notes — *"by default, the Python interpreter compiled from
upstream sources will not be so marked"*. The check does not fire, because there
is nothing to protect.

**5 · The wrong answer: `--break-system-packages` on a machine you care about.**
There is exactly one place it is defensible — a throwaway, single-application
container image that is rebuilt from scratch and never `apt upgrade`d in place,
which is precisely the scenario PEP 668 anticipates when it says a distributor
*"may choose not to ship an EXTERNALLY-MANAGED file"* for single-application
container images. Even there, a virtual environment inside the image costs you
one line and removes the question entirely.

## If you already did it

The order that recovers the most state:

1. **Stop.** Do not run `sudo pip uninstall` — that is the operation the PEP
   warns removes distro-owned files.
2. **Find out what pip put there.** `pip list --user` and
   `python3 -m pip list --format=freeze` against the system interpreter, and
   compare against what the OS package manager thinks it owns
   (`dpkg -S` / `rpm -qf` on the specific files).
3. **Remove the *user* installs first**, since `~/.local` is entirely yours:
   `pip uninstall --user <pkg>`, or in the worst case delete
   `~/.local/lib/python3.x/site-packages` wholesale. Nothing the OS owns lives
   there.
4. **Let the package manager repair its own files** rather than pip:
   `sudo apt install --reinstall python3-<pkg>` or
   `sudo dnf reinstall python3-<pkg>` restores files pip replaced.
5. **Then set up the thing you actually wanted** — a venv or your own
   interpreter — so the next attempt does not repeat it.


## Gotchas

**Symptom:** `python3 -m venv .venv` fails on Debian or Ubuntu with a message about `ensurepip`
**Cause:** the distro splits the standard library across packages, and `venv`'s bootstrap lives in a separate one
**Fix:** `sudo apt install python3-venv` (or `python3-full`, which the distro's own PEP 668 message recommends), or sidestep it entirely with `uv venv`, which does not depend on the distro's `ensurepip`

**Symptom:** a Dockerfile installs packages with `pip` at the system level and it works fine
**Cause:** either the image ships no marker file — PEP 668 allows distributors to omit it for single-application container images — or someone set `PIP_BREAK_SYSTEM_PACKAGES=1`
**Fix:** it is defensible in a throwaway image, but check which of the two it is before assuming the protection is intact. In a base image you also update in place, keep the marker and use a venv

**Symptom:** the venv picks up a package you never installed in it
**Cause:** the venv was created with `--system-site-packages`, or `PYTHONPATH` points outside it
**Fix:** create venvs with the default (isolated) behaviour, and print `sys.path` when something appears from nowhere

**Symptom:** you installed the distro package `python3-requests` and your venv still cannot import it
**Cause:** correct and expected — a distro package installs into the *system* interpreter's `site-packages`, which an isolated venv does not see
**Fix:** decide which side of the boundary the code lives on. Distro packages are for extending distro-shipped software; venv installs are for your project. Wanting both at once usually means the design is wrong

**Symptom:** `--break-system-packages` "fixed" it, and months later an OS upgrade fails
**Cause:** the divergence between the package database and the filesystem is silent until something tries to reconcile it — which is usually a distribution upgrade
**Fix:** run the recovery sequence above now rather than during the upgrade window, and remove whatever automation is passing that flag

**Symptom:** `pipx`/`uv tool` installed the application but the command is not found
**Cause:** the tool directory is not on `PATH`. Both tools install executables into a directory they expect you to add
**Fix:** `pipx ensurepath`, or for uv, `uv tool update-shell` / `uv python update-shell` depending on which executables are missing. Then start a new shell — `PATH` changes do not reach an already-running one

**Symptom:** the same `pip install` works on macOS and fails on Ubuntu
**Cause:** distributors made different choices about shipping the marker, and Apple's `/usr/bin/python3` is a different kind of thing again — it exists for Xcode's benefit and the docs say never to modify it
**Fix:** treat "which interpreter, owned by whom" as the first question on any machine. [Chunk 8](08-platform-stories.md) walks through each platform

**Symptom:** a CI job passes locally and fails in the container with the externally-managed error
**Cause:** your laptop's `python3` is a version-manager install with no marker; the container's is the distro's
**Fix:** make the CI environment explicit — create a venv or use `uv run` — rather than relying on whichever interpreter happens to be first on `PATH`

## Interview questions

**★ You hit `error: externally-managed-environment` on a colleague's machine. Walk me through what you do.**
First I ask what they are installing. If it is a library for a project, a
virtual environment — `python3 -m venv .venv` or `uv venv` — and install into
that. If it is a command-line application, `pipx install` or `uv tool install`,
which gives it a private environment and puts only the executable on `PATH`. If
it genuinely needs to be importable by software the distro shipped, the distro's
own `python3-<name>` package, which is the case PEP 668 deliberately preserves.
And if they simply do not want the OS interpreter involved at all, install one
of their own with `uv python install`. What I would not do is pass
`--break-system-packages` on a machine anyone depends on.

**★ How do you recover a system where someone already ran `sudo pip install --upgrade`?**
Carefully, and not with pip. `sudo pip uninstall` is the operation that removes
distro-owned files, so it is the one thing to avoid. I would inventory what pip
put there, delete the user-level installs first because `~/.local` is entirely
mine to clear, then let the OS package manager repair its own files with
`apt install --reinstall` or `dnf reinstall` for the affected packages. Only
then set up the venv or private interpreter that should have been used
originally.

**Why does installing the distro's `python3-requests` not make it importable from your venv?**
Because an isolated virtual environment deliberately does not see the base
interpreter's `site-packages`. The distro package installs into the system
interpreter, for the benefit of system software. If you need the library in your
project, install it into the project's environment; if you need it visible to a
distro-shipped tool, the distro package is right and the venv is irrelevant.
Trying to satisfy both from one installation is what PEP 668 exists to prevent.

**When is `--break-system-packages` acceptable?**
In a throwaway, single-application container image that is rebuilt rather than
updated in place — which is precisely the scenario PEP 668 anticipates when it
allows distributors of such images to omit the marker file. Even there I would
use a virtual environment inside the image instead, because it costs one line
and makes the isolation explicit to whoever reads the Dockerfile next.

**What is `python3-full` on Debian, and why does the error message mention it?**
Debian splits the Python standard library across several packages, so the base
`python3` does not necessarily include `venv`'s bootstrap, `tkinter`, or the
development headers. `python3-full` pulls in the pieces an end user expects. The
distributor put that advice into the `EXTERNALLY-MANAGED` file precisely because
the most common next step after the error — creating a virtual environment —
fails on a minimal install until that package is present.

**A teammate says "we don't need any of this, we just use Docker". Is the rule different there?**
The reasoning is the same, the stakes are lower. In an image that is rebuilt
from scratch every deploy there is no long-lived OS state to corrupt, so a
system-level install cannot rot in the way it does on a workstation. But you
still get shadowing between what the base image's package manager installed and
what pip installed, and you still lose the ability to say precisely what is in
the image. A venv in the image, or a `uv`-managed interpreter, removes the
question for one line of Dockerfile.

---

← Prev: [Never the system Python](01-never-the-system-python.md) · Index: [Installing and versions](README.md) · Next → [Installations, managers, environments](03-installations-managers-environments.md)
