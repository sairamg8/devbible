---
title: "A venv is a pointer to an installation it does not own, so upgrading, relocating or deleting that installation breaks it — in four distinct ways with four distinct symptoms"
sidebar_label: "6 · When the base moves"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the Python 3.14
> [`venv` docs](https://docs.python.org/3.14/library/venv.html) (`home`, the
> `--upgrade` option), [PEP 405](https://peps.python.org/pep-0405/),
> [`site`](https://docs.python.org/3.14/library/site.html) (how the site-packages
> tail is built from the version), and the
> [uv Python version documentation](https://docs.astral.sh/uv/concepts/python-versions/).
> Version spine: **Python 3.14.7**.

**Every virtual environment contains an absolute path to a Python installation
that some other tool manages: a package manager, a version manager, an installer,
a base image. Nothing in the environment is notified when that installation is
upgraded, moved or removed, and nothing checks at startup. The result is a family
of failures that are trivially fixable once you can tell them apart — and
maddening if you cannot, because two of the four leave you with an interpreter
that starts perfectly and then cannot find anything.**

## The dependency, restated

From [chunk 1](01-what-a-venv-is-on-disk.md): the environment has no standard
library of its own, and `bin/python` is (on POSIX) a symlink into the base
installation. From [chunk 2](02-how-the-interpreter-finds-it.md): `home` in
`pyvenv.cfg` names the base installation's bin directory. From the `site` docs:
the importable `site-packages` path is `sys.prefix` plus a tail that includes
**the running interpreter's version number**, `lib/pythonX.Y[t]/site-packages`.

Those three facts generate all four failure modes.

## Failure 1 — the base was deleted

`pyenv uninstall 3.13.2`, `brew cleanup`, an `apt remove` of an alternative
Python, uninstalling a version from the Windows Add/Remove list.

**Symptom.** The environment's interpreter cannot be executed at all: the symlink
in `bin/` dangles, and every console script's shebang names a file that no longer
exists, so the shell reports the interpreter as missing rather than reporting a
Python error.

**Fix.** Recreate against an installation that still exists. There is nothing to
repair — the bytes the environment depended on are gone.

## Failure 2 — the base moved

Homebrew moving a keg between `Cellar` version directories, a macOS framework
build changing `Versions/3.13` to `Versions/3.14`, a manually built Python
reinstalled under a different prefix, a Docker build stage whose interpreter lives
at a different path from the runtime stage's.

**Symptom.** Identical to failure 1 from the outside — the paths recorded in the
environment point nowhere. The difference is that a working interpreter of
roughly the right version exists somewhere else on the machine, which tempts
people into repairing the symlink by hand.

**Fix.** Recreate. Hand-repairing the symlink leaves `home` and every shebang
still wrong, and the environment then works for `python` and not for tools —
[chunk 5](05-not-relocatable.md)'s confusing half-broken state.

## Failure 3 — the base was upgraded in place, same minor version

3.14.6 replaced by 3.14.7 at the same prefix. A distro point release; a
`brew upgrade` within a minor series; a rebuilt container base image.

**Symptom.** Usually none — this is the benign case. `lib/python3.14/site-packages`
is still the right directory, wheels built for `cp314` are still compatible, and
the environment carries on. Occasionally the executable link or a bundled file is
stale.

**Fix.** This is precisely what `--upgrade` is for: *"Upgrade the environment
directory to use this version of Python, assuming Python has been upgraded
in-place."*

```bash
python3.14 -m venv --upgrade .venv
```

## Failure 4 — the base was upgraded to a new minor version at the same path

The nastiest one. `/usr/bin/python3` was 3.13 and is now 3.14 after a distro
release upgrade; or a version manager repointed a stable path at a newer series.

**Symptom.** The environment's interpreter starts fine — it is a symlink to a path
that still exists and now holds a newer interpreter. But that interpreter is
3.14, so `site` builds the site-packages tail as `lib/python3.14/site-packages`,
while your packages are all sitting in `lib/python3.13/site-packages`. **Every
third-party package disappears from `sys.path` at once**, with no error, no
warning, and an interpreter that reports a healthy `sys.prefix`.

**Diagnosis** takes three commands:

```bash
cat .venv/pyvenv.cfg                                  # version and home as recorded at creation
.venv/bin/python -V                                   # what the interpreter actually is now
.venv/bin/python -c "import sys, sysconfig; print(sys.version_info[:2], sysconfig.get_paths()['purelib'])"
ls .venv/lib                                          # which version directory the packages are in
```

A mismatch between the `lib/pythonX.Y` directory on disk and the version the
interpreter reports is the whole diagnosis.

**Fix.** Recreate. A minor version bump can also invalidate compiled wheels
(`cp313` ABI tags do not load on 3.14), so reinstalling is required regardless.

```bash
.venv/bin/python -m pip freeze > requirements.txt 2>/dev/null || true
rm -rf .venv
python3.14 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

Note the `|| true`: if the environment is broken enough, `pip freeze` will not
run, which is the argument for keeping a requirements file or lockfile committed
rather than generating one at the moment of crisis.

## Prevention, in order of effectiveness

1. **Do not build environments on an interpreter someone else upgrades.** A
   distro's `/usr/bin/python3` is upgraded by the distro on its schedule. This is
   the same argument as
   [`../04-installing-and-versions/01-never-the-system-python.md`](../04-installing-and-versions/01-never-the-system-python.md),
   arriving from a different direction.
2. **Use a managed interpreter that is versioned by path.** `uv python install
   3.14` places interpreters under uv's own directory, keyed by version, so a
   patch upgrade does not overwrite the installation your environment points at.
3. **Commit the source of truth.** `requirements.txt`, `pyproject.toml` +
   `uv.lock`. Recreation must be a one-liner, or people will hand-repair.
4. **Recreate environments after any interpreter change,** deliberately, rather
   than waiting to find out. It costs seconds.
5. **Pin the base image in CI and Docker to a specific patch tag** so that a
   rebuilt image does not silently change the interpreter under a cached layer.

## Gotchas

**Symptom:** after an OS release upgrade, every project's venv reports that none of its dependencies are installed
**Cause:** failure 4 — the system interpreter behind the environments moved to a new minor version, so `site` now looks in a `lib/pythonX.Y` directory that has never had anything installed into it
**Fix:** recreate all of them. This is the failure that turns a distro upgrade into an afternoon, and the reason not to base environments on the system Python

**Symptom:** `pyenv uninstall` of an old patch release breaks environments for projects you were not thinking about
**Cause:** those environments' `home` and symlinks name the exact patch-version prefix that was removed
**Fix:** recreate them. To avoid it, keep old patch releases installed until you have rebuilt the environments that used them, or switch to a workflow where `uv sync` rebuilds environments on demand

**Symptom:** `brew upgrade python@3.14` and afterwards a venv's `python` fails to start
**Cause:** Homebrew relocates the interpreter between Cellar version directories; the symlink target and `home` are stale
**Fix:** recreate. Homebrew's own message often suggests this, and there is no supported in-place repair

**Symptom:** a Docker multi-stage build works locally and fails at runtime with missing modules
**Cause:** the builder stage created the venv against one image's interpreter and the runtime stage has a different one — a different tag, a different variant (`slim` versus full), or a different path
**Fix:** use the *same* base image for both stages, copy the environment to the identical path, and pin the tag to a patch version. [Chunk 11](11-editors-ci-and-docker.md) has the pattern

**Symptom:** a cached CI layer keeps a venv alive across a base-image patch bump, then breaks weeks later
**Cause:** the cache key did not include the interpreter version, so the environment outlived the interpreter it was built against
**Fix:** include the Python version (and ideally the lockfile hash) in the cache key. A cache that can go stale silently is worse than no cache

**Symptom:** someone "fixes" a dangling `.venv/bin/python` symlink by re-pointing it at a working interpreter and reports it working
**Cause:** it does start, and pure-Python packages may still import if the minor version matches
**Fix:** recreate anyway. `home` still names the dead installation, console scripts still name the old path, and if the minor version differs the package directory is wrong. A half-repaired environment fails later, further from the cause

**Symptom:** on Windows, uninstalling a Python version removes environments' ability to start, but the `.venv` directory still contains a `python.exe`
**Cause:** the copied `python.exe` is a stub that still depends on the installation's standard library and DLLs; the copy is not a self-contained interpreter
**Fix:** recreate against an installed interpreter. The Windows copy-instead-of-symlink default does not make the environment independent

**Symptom:** a container image built months ago still runs, but rebuilding the same Dockerfile produces a broken image
**Cause:** an unpinned base tag (`python:3.14`) moved to a new patch release, while some other layer — a copied venv, a wheel cache, a vendored directory — is still from the old one
**Fix:** pin to a specific patch tag and rebuild the environment inside the image rather than carrying it in

## Interview questions

**★ What happens to a virtual environment when the Python it was created from is uninstalled?**
It stops working entirely. The environment has no standard library of its own and
its `bin/python` is a symlink (POSIX) or a stub copy (Windows) that depends on the
base installation. `pyvenv.cfg`'s `home` still names the deleted directory. There
is nothing to repair; the environment must be recreated against an interpreter
that exists.

**★ A distro upgrade moved `/usr/bin/python3` from 3.13 to 3.14. Your venv's interpreter starts, but no dependencies import. Why?**
Because `site` builds the site-packages path from `sys.prefix` plus a tail
containing the *running* interpreter's version. The environment's packages are in
`lib/python3.13/site-packages`; the interpreter is now 3.14 and looks in
`lib/python3.14/site-packages`, which is empty or absent. Nothing errors, because
an empty search path is not an error — you just get `ModuleNotFoundError` for
everything third-party.

**★ When is `python -m venv --upgrade` the right tool?**
Only for an in-place upgrade of the same installation within the same minor
version — the docs say *"assuming Python has been upgraded in-place"*. It
re-points the environment's executables at the current interpreter and rewrites
`pyvenv.cfg`. It does not migrate packages across minor versions and does not
help when the base moved or was removed.

**★ How do you make this class of failure rare?**
Stop building environments on interpreters that other software upgrades. Use
version-managed installations that are addressed by exact version, keep a
lockfile so recreating is a single command, recreate deliberately after any
interpreter change, and pin container base images to patch-level tags so a
rebuild cannot silently change the interpreter behind a cached environment.

**★ Why is "just fix the symlink" the wrong instinct?**
Because the symlink is one of four absolute references. `home` in `pyvenv.cfg`,
every console script's shebang, and any `.pth` file from an editable install are
all still stale, and if the replacement interpreter is a different minor version
the entire `site-packages` directory is now in the wrong place. Repointing the
symlink converts a loud failure into a quiet, deferred one.

---

← Prev: [Venvs are not relocatable](05-not-relocatable.md) · Index: [Virtual environments](README.md) · Next → [uv venv and uv run](07-uv-venv-and-uv-run.md)
