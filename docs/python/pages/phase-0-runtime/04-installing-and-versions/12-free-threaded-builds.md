---
title: "Installing a free-threaded build: a second interpreter beside the first, a t on the end of every name, and two runtime checks that answer different questions"
sidebar_label: "12 · Free-threaded builds"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against
> [Python support for free threading](https://docs.python.org/3.14/howto/free-threading-python.html),
> [Using Python on macOS §5.5.1](https://docs.python.org/3.14/using/mac.html),
> [Using Python on Windows §4.1.12 and §4.11.6](https://docs.python.org/3.14/using/windows.html),
> the [uv Python versions](https://docs.astral.sh/uv/concepts/python-versions/)
> documentation, [PEP 703](https://peps.python.org/pep-0703/) and
> [PEP 779](https://peps.python.org/pep-0779/).
> Version spine: **Python 3.14.7**; the free-threaded build is officially
> supported (PEP 703 phase II) and is **not** the default.

**A free-threaded interpreter is not a mode you switch on. It is a separately
compiled build of the same CPython version, installed alongside the ordinary
one, with its own executable name, its own `site-packages`, and its own ABI tag.
Everything about installing it follows from that: you install both, you keep
both, packages must be installed into each separately, and a wheel built for one
does not apply to the other. Where the *release model* puts this build is
[03 · The release model, chunk 3](../03-release-model/03-feature-freeze.md); this
chunk is how you get one onto a machine.**

## The naming convention: `t`

The free-threaded build appends `t` — to the executable, the version tag and the
ABI tag:

| | GIL build | Free-threaded build |
|---|---|---|
| Executable (Unix) | `python3.14` | `python3.14t` |
| Executable (Windows) | `python3.14.exe` | `python3.14t.exe` |
| Windows launcher tag | `py -V:3.14` | `py -V:3.14t` |
| uv request | `3.14`, `3.14+gil` | `3.14t`, `3.14+freethreaded` |
| Wheel ABI tag | `cp314` | `cp314t` |

Once you have seen `t` in one of those places you can predict the rest.

## macOS

> *"The python.org Python for macOS installer package can optionally install an
> additional build of Python 3.14 that supports PEP 703, the free-threading
> feature (running with the global interpreter lock disabled)."*

It is not installed by default, and the docs state exactly why:

> *"The free-threaded mode is working and continues to be improved, but there is
> some additional overhead in single-threaded workloads compared to the regular
> build. Additionally, third-party packages, in particular ones with an extension
> module, may not be ready for use in a free-threaded build, and will re-enable
> the GIL. Therefore, the support for free-threading is not installed by
> default."*

You enable it under **Customize** on the Installation Type step. What you get:

> *"If the box next to the Free-threaded Python package name is checked, a
> separate PythonT.framework will also be installed alongside the normal
> Python.framework in /Library/Frameworks. This configuration allows a
> free-threaded Python 3.14 build to co-exist on your system with a traditional
> (GIL only) Python 3.14 build with minimal risk while installing or testing.
> This installation layout may change in future releases."*

Three documented cautions worth carrying:

- The command-line tools package installs `/usr/local/bin/python3.14t` and
  `python3.14t-config`, and since `/usr/local/bin` is normally on `PATH`,
  *"in most cases no changes to your PATH environment variables should be
  needed"*.
- *"the Shell profile updater package and the Update Shell Profile.command … do
  not support the free-threaded package."*
- **The two builds do not share packages:** *"The free-threaded build and the
  traditional build have separate search paths and separate site-packages
  directories so, by default, if you need a package available in both builds, it
  may need to be installed in both."*

## Windows

With the Python install manager, it is a tag:

> *"Pre-built distributions of the free-threaded build are available by installing
> tags with the t suffix."*

```powershell
py install 3.14t
py install 3.14t-arm64
py install 3.14t-32
```

> *"This will install and register as normal. If you have no other runtimes
> installed, then python will launch this one. Otherwise, you will need to use
> py -V:3.14t … or, if you have added the global aliases directory to your PATH
> environment variable, the python3.14t.exe commands."*

The traditional installer (documented for 3.13 and still described in the
Windows page) offers it as a checkbox — *"The second page of options includes the
'Download free-threaded binaries' checkbox"* — installing `python3.13t.exe`
alongside the main install and registering it under the tag `3.13t`. That page
carries a warning about launcher resolution that is very easy to trip over:

> *"Note that the launcher will interpret py.exe -3 (or a python3 shebang) as
> "the latest 3.x install", which will prefer the free-threaded binaries over the
> regular ones, while py.exe -3.13 will not."*

So a bare `py -3`, or a Unix-style `python3` shebang, can select the
free-threaded build without anyone asking. Command-line installs use
`Include_freethreaded=1`. Free-threaded NuGet packages exist too, named
`python-freethreaded`, `pythonx86-freethreaded` and `pythonarm64-freethreaded`,
and the docs note these *"contain both the python3.13t.exe and python.exe entry
points, both of which run free threaded"* — an image where the plain `python`
name is free-threaded.

## Linux and other platforms

The HOWTO does not promise official binaries here:

> *"Starting with Python 3.13, the official macOS and Windows installers
> optionally support installing free-threaded Python binaries. The installers are
> available at https://www.python.org/downloads/. For information on other
> platforms, see the Installing a Free-Threaded Python, a community-maintained
> installation guide for installing free-threaded Python."*

Which leaves three practical routes on Linux:

**1 · `uv`**, which ships free-threaded distributions:

```bash
uv python install 3.14t              # or 3.14+freethreaded
uv run --python 3.14t app.py
uv run --python 3.14+gil app.py      # explicitly demand the GIL build
```

**2 · Your distribution**, if it packages one. Several do, under a name of their
own choosing; check your package manager rather than assuming a name — this is a
detail I would verify against your distribution's own package list rather than
trust from memory.

**3 · Build it**, which is the documented fallback and is what `pyenv` would do
for you:

> *"When building CPython from source, the --disable-gil configure option should
> be used to build a free-threaded Python interpreter."*

Confirming that you are actually running free-threaded — and what the separate
ABI means for packages — is [the next chunk](13-confirming-free-threading.md).

## Gotchas

**Symptom:** you installed the free-threaded build and `python3.14` is still the GIL build
**Cause:** correct and intended — the two coexist, with distinct names. The free-threaded executable is `python3.14t`
**Fix:** use the `t` name deliberately, or select it through your version manager (`3.14t`, `3.14+freethreaded`)

**Symptom:** on Windows, `py -3` started running a free-threaded interpreter
**Cause:** the launcher reads `-3` and a `python3` shebang as "the latest 3.x install", and prefers free-threaded binaries; `py -3.13` does not
**Fix:** name the version, or the tag: `py -3.13`, `py -V:3.14`. This is documented behaviour, not a bug

**Symptom:** a package is installed but the free-threaded interpreter cannot import it
**Cause:** the two builds have separate search paths and separate `site-packages`
**Fix:** install it into both, and expect to maintain two environments if you are testing both builds

**Symptom:** on macOS the shell profile updater did not add the free-threaded interpreter
**Cause:** documented — the profile updater and `Update Shell Profile.command` do not support the free-threaded package
**Fix:** rely on `/usr/local/bin/python3.14t`, which the command-line tools package links and which is normally already on `PATH`

**Symptom:** a Windows container image runs free-threaded under the plain name `python`
**Cause:** the free-threaded NuGet packages ship *both* `python3.13t.exe` and `python.exe`, and the docs note both of them run free threaded
**Fix:** check which package the image was built from before assuming `python` means the GIL build

**Symptom:** no free-threaded binaries for your Linux distribution
**Cause:** the official installers only cover macOS and Windows; the HOWTO points at a community-maintained guide for everything else
**Fix:** `uv python install 3.14t`, a distribution package if one exists, or a source build with `--disable-gil`

**Symptom:** a source build produced a GIL-enabled interpreter despite the intent
**Cause:** `--disable-gil` was not passed to `configure`; there is no runtime switch that turns a GIL build into a free-threaded one
**Fix:** rebuild with the flag. The two builds are compiled differently; this cannot be fixed after the fact

## Interview questions

**★ How do you install a free-threaded Python, and what do you get?**
On macOS and Windows the official installers offer it as an option — a Customize
checkbox on macOS producing a separate `PythonT.framework`, and a `t`-suffixed
tag such as `py install 3.14t` with the Windows install manager. On Linux there
are no official binaries, so you use `uv python install 3.14t`, a distribution
package if one exists, or a source build with `--disable-gil`. What you get is a
*second* interpreter alongside the ordinary one, named `python3.14t`, with its
own `site-packages` and its own ABI tag.

**★ On Windows, why might `py -3` pick the free-threaded interpreter?**
Because the launcher interprets `-3` — and a `python3` shebang — as "the latest
3.x install", and that resolution prefers free-threaded binaries over regular
ones. `py -3.13` does not. It is documented behaviour, and it is the reason to
name a version or a full tag in anything that matters rather than relying on the
bare major version.

**Why is the free-threaded build not installed by default?**
The macOS documentation gives both reasons directly: there is additional
overhead in single-threaded workloads compared with the regular build, and
third-party packages — particularly those with extension modules — may not be
ready and will re-enable the GIL. PEP 779 puts numbers on the first: roughly 10%
slower single-threaded (about 3% on macOS) and 15–20% higher memory use. It is
supported, not free.

**Two builds, two `site-packages` — what does that mean for a development machine?**
That testing both builds means maintaining two environments and installing into
each. The macOS docs say so directly. In practice that means two `.venv`
directories, or a version manager request per environment, and a CI matrix with a
`3.14t` entry alongside `3.14` rather than a flag on one job.

**Can you turn an existing Python into a free-threaded one?**
No. It is a compile-time configuration — `--disable-gil` at `configure` time —
not a runtime switch. The reverse direction does exist in a limited sense: a
free-threaded build can be run *with* the GIL enabled via `PYTHON_GIL=1` or
`-X gil=1`, but a GIL build cannot be persuaded to run without it.

**How does the `t` suffix propagate through the toolchain?**
Consistently, which is the useful part: the executable is `python3.14t`, the
Windows launcher tag is `3.14t`, uv's request forms are `3.14t` and
`3.14+freethreaded` (with `3.14+gil` for the opposite), and the wheel ABI tag is
`cp314t`. Seeing `t` in any one of those tells you what to expect in the others.

---

← Prev: [Tool environments and pipx](11-tool-environments-and-pipx.md) · Index: [Installing and versions](README.md) · Next → [Confirming free-threading](13-confirming-free-threading.md)
