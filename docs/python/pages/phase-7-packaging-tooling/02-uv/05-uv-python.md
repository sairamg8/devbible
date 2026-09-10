---
title: "uv installs interpreters as well as packages, prefers its own managed builds over system ones, and will silently download a Python it does not have — three defaults worth understanding before a build agent surprises you"
sidebar_label: "05 · uv python"
sidebar_position: 18
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — *Python versions*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/python-versions/)), the environment variable
> reference ([docs.astral.sh](https://docs.astral.sh/uv/reference/environment/)), *Working on
> projects* ([docs.astral.sh](https://docs.astral.sh/uv/guides/projects/)) and the uv documentation
> home ([docs.astral.sh](https://docs.astral.sh/uv/)).
> Version spine: **uv 0.12.12** (2026-09-09) · **Python 3.14.7** · ruff 0.16.6 · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings**.

**The claim on uv's front page is that it replaces `pyenv`, and mechanically it does something quite
different from pyenv: instead of building CPython from source and interposing shim executables on
your `PATH`, uv downloads a pre-built distribution from the `python-build-standalone` project and
selects the interpreter per command. Nothing is intercepted; there is no shim to be stale. Three
defaults follow from that design and each one can surprise you. uv *prefers* its own managed
interpreters over the system's. uv will *download* an interpreter it does not have, without asking.
And the interpreters it installs are portable builds with documented behaviour quirks that a distro
Python does not have.**

## The commands

> *"uv bundles a list of downloadable CPython and PyPy distributions for macOS, Linux, and Windows."*
> — [Python versions](https://docs.astral.sh/uv/concepts/python-versions/)

| Command | What it does |
|---|---|
| `uv python install 3.14` | install a managed interpreter |
| `uv python list` | list installed and available versions |
| `uv python find` | print the interpreter uv would use here |
| `uv python pin 3.14` | write `.python-version` |
| `uv python upgrade` | move managed versions to the latest patch |
| `uv python dir` | print where managed interpreters live |

`uv python find` is the diagnostic to reach for first whenever the wrong Python is being used — it
answers the question directly instead of making you infer it from `PATH`.

Where the executables go:

> *"uv installs Python executables into your `PATH` by default, e.g., on Unix `uv python install
> 3.12` will install a Python executable into `~/.local/bin`"*
> — [Python versions](https://docs.astral.sh/uv/concepts/python-versions/)

and a bare `python` / `python3` is opt-in and experimental:

> *"To install `python` and `python3` executables, include the experimental `--default` option:
> `$ uv python install 3.12 --default`"*
> — [Python versions](https://docs.astral.sh/uv/concepts/python-versions/)

⚠️ uv's own word is *"experimental"*, on a pre-1.0 tool. Taking over the meaning of `python` on a
machine is exactly the kind of change to make deliberately and to leave out of shared images.

## 🔴 Discovery order, and the preference that decides ties

> Managed Python installations in the `UV_PYTHON_INSTALL_DIR` are checked first, followed by *"A
> Python interpreter on the `PATH`"* and Windows registry entries.
> — [Python versions](https://docs.astral.sh/uv/concepts/python-versions/)

Ties are broken by the `python-preference` setting, whose values are documented as:

> `only-managed`: *"Only use managed Python installations; never use system Python installations."*

> *"By default, the `python-preference` is set to `managed` which prefers managed Python
> installations over system Python installations. However, system Python installations are still
> preferred over downloading a managed Python version."*

> `system`: *"Prefer system Python installations over managed Python installations."*

> `only-system`: *"Only use system Python installations; never use managed Python installations."*
> — all [Python versions](https://docs.astral.sh/uv/concepts/python-versions/)

Read the default carefully, because it has two clauses that pull in opposite directions: **an
already-installed managed interpreter beats a system one, but a system interpreter beats
downloading.** So uv is not greedy about downloading — it only fetches when nothing available
satisfies the request.

## 🔴 uv downloads interpreters without asking

> *"By default, uv will automatically download Python versions when needed."*
> — [Python versions](https://docs.astral.sh/uv/concepts/python-versions/)

On a laptop this is the single nicest thing uv does: `uv sync` on a project pinned to 3.14 simply
works on a machine that has never had 3.14. In three other places it is a problem:

- **An image build**, where it means the base image's interpreter did not match and you now have two
  Pythons in the layer.
- **An air-gapped or egress-restricted runner**, where the download fails late, inside a sync, with
  the error attributed to the wrong phase.
- **A compliance context**, where an unreviewed binary arriving from the internet mid-build is not
  acceptable regardless of whether it works.

The switch is one variable:

> `UV_PYTHON_DOWNLOADS`: *"Equivalent to the `python-downloads` setting and, when disabled, the
> `--no-python-downloads` option. Whether uv should allow Python downloads."*
> — [environment variables](https://docs.astral.sh/uv/reference/environment/)

```dockerfile
ENV UV_PYTHON_DOWNLOADS=never     # fail loudly instead of growing a second interpreter
```

## What uv actually installs — and the quirks that come with it

> *"uv instead uses pre-built distributions from the Astral `python-build-standalone` project"*
> ([github.com/astral-sh/python-build-standalone](https://github.com/astral-sh/python-build-standalone))

> *"These distributions have some behavior quirks, generally as a consequence of portability; see the
> `python-build-standalone` quirks documentation for details"*
> ([gregoryszorc.com](https://gregoryszorc.com/docs/python-build-standalone/main/quirks.html))
> — both [Python versions](https://docs.astral.sh/uv/concepts/python-versions/)

This is the honest caveat in uv's Python management and the docs do not hide it. A
`python-build-standalone` interpreter is built to run on *any* machine of its platform, which means
it links and locates things differently from a distribution's Python. uv links the quirks document
rather than enumerating the quirks, and **this page will not enumerate them either** — read the
linked page for the specifics on the platform you care about. What matters here is knowing the
category exists: if something works with `/usr/bin/python3` and fails with a uv-managed interpreter,
that is a known kind of problem and the quirks document is where to look, not a uv bug report.

`python-preference = "only-system"` is the escape hatch when a project genuinely needs the
distribution's interpreter.

Moving between versions — `uv python upgrade` for patches, and the two files that select a version
in the first place — is [05b](05b-python-version-vs-requires-python.md).

## How this compares with pyenv

uv's front page claims to replace `pyenv` among others. The mechanisms differ, and the difference is
the reason to care:

- **uv** downloads a pre-built distribution and selects an interpreter per invocation, keeping
  managed builds in `UV_PYTHON_INSTALL_DIR`. Nothing intercepts `python`, unless you opt into the
  experimental `--default`.
- **pyenv**, by contrast, works through shim executables placed on `PATH`. ⚠️ I did not re-verify
  pyenv's internals against pyenv's own documentation for this page, so treat that sentence as
  context rather than a citation — the uv side is what is quoted here.

The practical consequence of uv's design is that "which Python is this?" has a direct answer
(`uv python find`) rather than an inferred one, and that a project's interpreter is a property of
the project rather than of your shell's current state.

## Gotchas

**★ Symptom: `uv sync` downloaded a Python interpreter on a build agent and nobody expected it.**
Cause: *"By default, uv will automatically download Python versions when needed"* — the agent's
interpreter did not satisfy the project's request. Fix: forbid downloads so the mismatch fails
loudly, then fix the actual mismatch.

```bash
export UV_PYTHON_DOWNLOADS=never
uv python find            # now the error tells you what was requested and what exists
```

**★ Symptom: a package works with the system Python and fails under uv's managed one.**
Cause: uv installs `python-build-standalone` builds, which *"have some behavior quirks, generally as
a consequence of portability."* Fix: read the quirks document for your platform; if the project
genuinely needs the distribution interpreter, say so in configuration rather than by accident.

```toml
[tool.uv]
python-preference = "only-system"
```

**★ Symptom: `python --version` on your machine changed after a uv command.**
Cause: `uv python install --default` installs bare `python` and `python3` executables into
`~/.local/bin`, and uv labels the option *"experimental"*. Fix: install without `--default` and use
the versioned names, or `uv run`, which does not depend on `PATH` at all.

```bash
uv python install 3.14        # no --default
uv run python -V              # the project's interpreter, whatever PATH says
```

**★ Symptom: CI is slower than expected because it re-downloads an interpreter every run.**
Cause: managed interpreters live outside the workspace, in `UV_PYTHON_INSTALL_DIR`, and the job caches
only the workspace. Fix: cache that directory too, or install the interpreter in the base image.

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.local/share/uv/python
    key: uv-python-3.14-${{ runner.os }}
```

(⚠️ confirm the real path on your runner with `uv python dir` rather than trusting a written one —
uv's docs describe the variable, not a guaranteed default.)

**★ Symptom: your editor and `uv run` disagree about the Python version.**
Cause: the editor resolved a `python` from `PATH`; uv resolved the project's interpreter. Fix: ask uv
and configure the answer.

```bash
uv python find
```

**★ Symptom: `uv python install` succeeded and the version still is not used.**
Cause: installing a version is not selecting one. Selection comes from `.python-version`,
`requires-python`, or an explicit `--python` ([05b](05b-python-version-vs-requires-python.md)). Fix:
pin it.

```bash
uv python pin 3.14
```

**★ Symptom: a locked-down environment must not fetch binaries, and `only-system` still is not enough.**
Cause: `python-preference` decides *which* interpreter is preferred; downloading is governed
separately. Fix: set both, so neither preference nor availability can trigger a fetch.

```toml
[tool.uv]
python-preference = "only-system"
python-downloads = "never"
```

## Interview questions

**★ How does uv's Python management differ mechanically from pyenv's, and why does the difference matter?**
uv downloads *pre-built* distributions — it *"uses pre-built distributions from the Astral
`python-build-standalone` project"* — and selects an interpreter per command, with managed builds
living in `UV_PYTHON_INSTALL_DIR`. Nothing is interposed on `PATH` unless you opt into the
experimental `--default`. pyenv works through shims on `PATH`; I have not re-verified pyenv's
internals here, so I would hold that loosely, but the uv side is what matters for the answer. Two
consequences follow from uv's design. First, "which Python is this?" has a direct answer —
`uv python find` — rather than one you infer from shell state, which removes an entire class of
confusion. Second, because the builds are pre-made rather than compiled on your machine, installation
is fast and requires no toolchain — and in exchange you inherit the portability quirks uv explicitly
warns about.

**★ uv will download an interpreter without asking. When is that wrong, and how do you stop it?**
It is exactly right on a developer machine — a fresh clone of a project pinned to 3.14 just works,
with no separate provisioning step — and wrong in three places. In an image build it means the base
image's interpreter did not match, and instead of failing you now ship two Pythons. On an
egress-restricted runner it fails late and inside a sync, so the error is attributed to the wrong
phase. In a regulated environment an unreviewed binary arriving mid-build may be unacceptable
regardless of correctness. The switch is `UV_PYTHON_DOWNLOADS` /
`--no-python-downloads` — *"whether uv should allow Python downloads"* — and setting it to `never` in
CI turns a silent fetch into an explicit failure naming what was requested.

**★ Explain uv's default `python-preference` precisely.**
It is `managed`, and the documentation defines it in two clauses that must be read together: it
*"prefers managed Python installations over system Python installations. However, system Python
installations are still preferred over downloading a managed Python version."* So the order is:
already-installed managed interpreter, then system interpreter, then download. That is a
deliberately conservative arrangement — uv prefers what it controls when it already has it, but it
will not fetch from the network when something on the machine already satisfies the request. The
other three values are absolutes: `only-managed` *"never use[s] system Python installations"*,
`only-system` *"never use[s] managed Python installations"*, and `system` merely flips the
preference. `only-system` is the one to reach for when a project depends on the distribution's build.

**★ What are `python-build-standalone` quirks, and how should a page like this handle them?**
They are behavioural differences that come from building an interpreter to run on any machine of its
platform rather than on the machine that built it — uv describes them as *"behavior quirks, generally
as a consequence of portability"* and links to a dedicated quirks document rather than listing them.
The right way to handle them is exactly that: name the category, link the source, and do not
paraphrase a list that changes per platform and per release. What a working developer needs is the
recognition step — if something works under `/usr/bin/python3` and fails under a uv-managed
interpreter, that is a *known kind* of problem with a known place to look, and `python-preference =
"only-system"` is the escape hatch if the project genuinely requires the distribution's build.

**A colleague sets `UV_PYTHON_DOWNLOADS=never` in a Dockerfile. Is that reasonable?**
Usually yes, and often better than the default. uv *"will automatically download Python versions when
needed"*, which in an image build is a surprise rather than a convenience: it means the base image's
interpreter was not the one the project asked for, and instead of failing, the build quietly grew a
second Python — larger image, two interpreters to patch, and a mismatch nobody was told about. Setting
it to `never` turns that into an explicit failure, at which point you fix either the base image tag or
`.python-version`. The one case where it is wrong is an image deliberately built *without* a system
Python, where uv's managed interpreter is the entire point; there you want downloads allowed and the
version pinned instead.

---

← Prev: [04d · uv run as a process](04d-uv-run-as-a-process.md) · [Topic index](README.md) · Next → [05b · .python-version vs requires-python](05b-python-version-vs-requires-python.md)
