---
title: "Installing Python and managing versions: never into the system interpreter, and the difference between an installation, a version manager and an environment"
sidebar_label: "04 · Installing and versions"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against
> [PEP 668 – Marking Python base environments as "externally managed"](https://peps.python.org/pep-0668/),
> [PEP 394 – The "python" Command on Unix-Like Systems](https://peps.python.org/pep-0394/),
> the Python 3.14 setup docs for
> [Unix](https://docs.python.org/3.14/using/unix.html),
> [macOS](https://docs.python.org/3.14/using/mac.html) and
> [Windows](https://docs.python.org/3.14/using/windows.html),
> the [uv documentation](https://docs.astral.sh/uv/concepts/python-versions/),
> the [pyenv README](https://github.com/pyenv/pyenv), and the
> [official `python` Docker image documentation](https://hub.docker.com/_/python).
> Version spine: **Python 3.14.7**.

**There is one rule on this page that matters more than everything else
combined: do not install packages into the Python that came with your operating
system. Since PEP 668 the interpreter will usually stop you, with an error
message — `error: externally-managed-environment` — that most people work around
by pasting the flag it suggests, which is named `--break-system-packages`
precisely so that pasting it feels wrong. Everything else here is the
constructive half: how to get an interpreter you actually own, on each platform,
with each of the tools people currently use.**

The confusion this topic exists to clear up is that three different things all
get called "installing Python", and mixing them up is why a machine ends up with
six interpreters and no idea which one `pip` just wrote to:

1. **An installation** — a compiled interpreter plus its standard library,
   sitting in a directory somewhere.
2. **A version manager** — a tool that fetches, tracks and selects between
   several installations.
3. **An environment** — a lightweight redirection layer that decides which
   installation a project uses and where *its* packages live.

Only the third of these is covered by
[05 · Virtual environments](../05-virtual-environments/README.md). The first two are this topic.

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Never the system Python](01-never-the-system-python.md)** | Why the OS owns `/usr/bin/python3`; PEP 668 and the `EXTERNALLY-MANAGED` marker; the exact error text; why `sudo pip` is worse than `pip --user`; what `--break-system-packages` really means |
| 2 | **[Responding to PEP 668](02-responding-to-pep-668.md)** | The four correct answers to the error and the one wrong one; recovering a machine where somebody already chose the wrong one |
| 3 | **[Installations, managers, environments](03-installations-managers-environments.md)** | The three-layer model; where each layer lives on disk; what `which python` is really answering; the failure mode at each boundary |
| 4 | **[`uv`](04-uv.md)** | `uv python install`, `uv python pin`, `.python-version`, `uv run` fetching an interpreter on demand, standalone builds, `requires-python` |
| 5 | **[uv's resolution order and variants](05-uv-resolution-and-variants.md)** | Discovery and preference rules, patch upgrades and the minor-version symlink, pre-releases, free-threaded selection, the Windows registry |
| 6 | **[`pyenv`](06-pyenv.md)** | Shims and how they intercept `python`; the version-resolution order; building from source and what it costs; why `import ssl` fails |
| 7 | **[Choosing a version manager](07-choosing-a-version-manager.md)** | uv against pyenv on the two axes that decide it; where `mise`, `asdf` and `conda` belong; what breaks when two shim managers coexist |
| 8 | **[Platform stories](08-platform-stories.md)** | python.org installers; Apple's `/usr/bin/python3` and Homebrew; Linux distro Pythons; the Windows install manager, the `py` launcher and the Store stub |
| 9 | **[`python` vs `python3`](09-python-vs-python3.md)** | PEP 394: which name is guaranteed, what to put in a shebang, and why a subprocess must be spawned with `sys.executable` |
| 10 | **[Installing applications, not libraries](10-installing-applications.md)** | `uvx` and `uv tool install`; why a CLI is not a dependency; the caching rule; which tools *do* belong in the project |
| 11 | **[Tool environments and pipx](11-tool-environments-and-pipx.md)** | Which interpreter a tool is bound to; why uv refuses to overwrite pipx's executables; when `uv run` is the right answer instead |
| 12 | **[Free-threaded builds](12-free-threaded-builds.md)** | Installing a `3.14t` interpreter on each platform, the `t` naming convention, and why it is a second interpreter rather than a mode |
| 13 | **[Confirming free-threading](13-confirming-free-threading.md)** | The two runtime checks and what each answers; the three ways the GIL comes back on; the `cp314t` ABI tag |
| 14 | **[Docker base images](14-docker-base-images.md)** | `-slim` vs `alpine` vs the default; the musl wheel problem in full; pinning; and how this choice feeds Phase 7 packaging |

## The short version, for someone who just wants the answer

Install `uv`. Then:

```bash
uv python install 3.14        # get an interpreter you own
uv init myproject && cd myproject
uv add httpx                  # creates .venv, resolves, locks, installs
uv run app.py                 # runs inside that environment
```

You have not touched the system Python, you have a pinned interpreter version
recorded in `.python-version`, and you have an environment per project. If you
work on a team that uses `pyenv`, or on a machine where `uv` is not an option,
[chunk 6](06-pyenv.md) covers the equivalent moves.

## Phase gate contribution

After this topic you can explain what `error: externally-managed-environment`
means and give three correct responses to it that are not
`--break-system-packages`; say which of the interpreters on a given machine
`pip` would install into and why; and choose a Docker base image with a reason
attached rather than a habit.

## Where this connects

- **[03 · The release model](../03-release-model/README.md)** decided *which*
  version. This topic is how you get it.
- **[05 · Virtual environments](../05-virtual-environments/README.md)** is the layer directly above
  this one, and the reason most of the advice here works.
- **Phase 7 — Packaging** turns the interpreter choice into `requires-python`, a
  lockfile and a reproducible build.

---

← Prev: [The release model](../03-release-model/README.md) · Index: [Phase 0 — The runtime](../README.md) · Next → [Never the system Python](01-never-the-system-python.md)
