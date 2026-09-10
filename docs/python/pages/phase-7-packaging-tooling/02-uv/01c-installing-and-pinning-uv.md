---
title: "How you install uv decides whether you can update it, and because uv is pre-1.0 and ships weekly the version has to be pinned in every place a human is not watching"
sidebar_label: "01c · Installing and pinning uv"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — *Installation*
> ([docs.astral.sh](https://docs.astral.sh/uv/getting-started/installation/)), the uv CLI
> reference ([docs.astral.sh](https://docs.astral.sh/uv/reference/cli/)), *Using uv in Docker*
> ([docs.astral.sh](https://docs.astral.sh/uv/guides/integration/docker/)), and the release list
> ([github.com](https://github.com/astral-sh/uv/releases)).
> Version spine: **uv 0.12.12** (2026-09-09) · Python 3.14.7 · ruff 0.16.6 · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings** — the one speed number quoted here is
> uv's own published claim, attributed as such.

**There are eight documented ways to install uv and they are not interchangeable: pick the
standalone installer and `uv self update` works, pick Homebrew or pip and uv disables its own
updater on purpose. That is not a bug, it is uv refusing to fight your package manager, and it
is the first thing to check when `uv self update` will not run. The larger point is that uv is
`0.x` software shipping roughly weekly — ten releases in the five weeks before this page was
written — with new flags appearing in patch releases and new behaviour appearing behind
`--preview`. So the version has to be pinned in CI, in your Dockerfile and in pre-commit, and
you have to know that the command for "which uv is this" is `uv self version`, because
`uv version` means something else entirely.**

## The standalone installer, and the version-pinned form of it

> `curl -LsSf https://astral.sh/uv/install.sh | sh`

> `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"`
> — both [installation](https://docs.astral.sh/uv/getting-started/installation/)

The install directory is documented as `~/.local/bin/`. The same page documents a
version-pinned URL, and this is the form to use anywhere the result must be reproducible:

```bash
# pinned — the URL carries the version
curl -LsSf https://astral.sh/uv/0.12.12/install.sh | sh
```

That single URL difference is the whole reproducibility story for a CI runner that installs uv
by script. The unpinned form fetches whatever is current at the moment the job runs, which for
a weekly-releasing `0.x` tool means your pipeline's behaviour can change without any commit.

The other documented routes, verbatim from the installation page:

| Route | Command | `uv self update` |
|---|---|---|
| Standalone installer | `curl -LsSf https://astral.sh/uv/install.sh \| sh` | works |
| PyPI via pipx | `pipx install uv` | 🔴 disabled |
| PyPI via pip | `pip install uv` | 🔴 disabled |
| Homebrew | `brew install uv` | 🔴 disabled |
| MacPorts | `sudo port install uv` | 🔴 disabled |
| WinGet | `winget install --id=astral-sh.uv -e` | 🔴 disabled |
| Scoop | `scoop install main/uv` | 🔴 disabled |
| Cargo | `cargo install --locked uv` | 🔴 disabled |

The rule behind that last column is one sentence:

> *"When another installation method is used, self-updates are disabled."*
> — [installation](https://docs.astral.sh/uv/getting-started/installation/)

This is the right design — a binary that overwrote a Homebrew-managed file would leave
Homebrew's manifest lying — but it means "uv cannot update itself" is a *statement about how
you installed it*, not a fault. Update it the way you installed it.

## 🔴 `uv version` is not "what version of uv is this"

Two different commands, and the confusable one is the one people reach for:

| Command | Reference description |
|---|---|
| `uv version` | *"Read or update the project's version"* |
| `uv self version` | *"Display the installed uv version"* |
| `uv self update` | *"Update the uv executable to the latest available release"* |

— all three from the [uv CLI reference](https://docs.astral.sh/uv/reference/cli/).

`uv version` operates on **your project's** version — the `version` field in
`pyproject.toml` — and it can *write* it (it carries `--bump` and `--dry-run`). Run it in a
directory with no `pyproject.toml` and it has no project to read. Run it in a release script
expecting uv's own version and you will either print your application's version or mutate it.

```bash
uv self version        # ✅ the tool's version — use this in CI diagnostics
uv version             # ⚠️ your project's version, and it can change it
uv version --short     # your project's version, bare
```

## Pinning uv in the three places that matter

**1 · CI.** Install a named version, then assert it, so a drifting runner image fails loudly
instead of silently changing your resolution:

```yaml
# .github/workflows/ci.yml — fragment
- name: Install uv 0.12.12
  run: curl -LsSf https://astral.sh/uv/0.12.12/install.sh | sh
- name: Confirm the version we think we have
  run: |
    echo "$HOME/.local/bin" >> "$GITHUB_PATH"
    uv self version
- name: Install from the lockfile, refusing to re-resolve
  run: uv sync --locked
```

**2 · Docker.** uv publishes its binary as a container image, so you do not install it at all —
you copy it out of a tagged image:

> `COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/`

> *"It is best practice to pin to a specific uv version, e.g., with:"* `ghcr.io/astral-sh/uv:0.12.12`
> — both [using uv in Docker](https://docs.astral.sh/uv/guides/integration/docker/)

```dockerfile
# Do this — the tag is the pin
COPY --from=ghcr.io/astral-sh/uv:0.12.12 /uv /uvx /bin/
```

Two binaries are copied, not one: `uv` and `uvx`. `uvx` is the tool runner —
[07](07-uvx-and-tools.md) — and forgetting it in the `COPY` is why `uvx: not found` appears in
an image that clearly has uv.

**3 · pre-commit.** The hook's `rev` is the pin, and it is a git tag on Astral's hook
repository. Pin it to the same version as CI, or the formatter that runs on your machine is not
the one that runs in the pipeline. The mechanics of `rev`, `pre-commit autoupdate` and the
`pre-commit` pin itself (**4.6.2**) belong to topic **11 · pre-commit** *(not written yet)*; the
rule that matters here is that uv's version is one more thing that must agree across all three
places.

## 🔴 uv is pre-1.0 and ships weekly — write that into your process

The releases page shows **0.12.3 on 2026-08-07 and 0.12.12 on 2026-09-09** — ten releases in
roughly five weeks
([github.com/astral-sh/uv/releases](https://github.com/astral-sh/uv/releases)). Three practical
effects, and every page in this topic names version boundaries because of them:

- **Flags land mid-minor.** `--no-locked` and `--no-frozen` did not exist before **0.12.9**,
  whose notes read *"Add `--no-locked` and `--no-frozen` to disable lock modes enabled by
  `UV_LOCKED` and `UV_FROZEN`"*. A script using them on 0.12.8 fails with an
  unrecognised-argument error, which reads like a typo rather than a version problem.
- **Features ship behind `--preview` and change on purpose.** 0.12.11's notes include *"Warn
  when `pylock.toml` artifact hash tables are empty, which will be rejected in a future uv
  release"* — an explicit promise of a future behaviour change. Anything marked *preview* in
  this topic is not something to build a pipeline on without a pinned uv.
- **Platform coverage moves too.** 0.12.7 (2026-08-27) added *"Support Linux `s390x`,
  `ppc64le`, and `loongarch64` targets for cross-platform dependency resolution"* — a
  *resolution* capability, which means the set of platforms your lockfile can describe is
  itself version-dependent.

**The speed claim, attributed.** uv's documentation home states *"10-100x faster than `pip`."*
([docs.astral.sh/uv](https://docs.astral.sh/uv/)) — that is **uv's own published claim**, not a
measurement made here or anywhere in this corpus, and no page in this topic reports a timing.
The documented mechanisms behind it are [01d](01d-the-cache-and-the-speed-claim.md).

## Shell completion is opt-in

```bash
echo 'eval "$(uv generate-shell-completion bash)"' >> ~/.bashrc
```

uv also owns three directories *outside* your project — the cache, managed interpreters and
installed tools — which is where a build agent's disk actually goes. That, and what to prune,
is [01d](01d-the-cache-and-the-speed-claim.md).

## Gotchas

**★ Symptom: `uv self update` refuses to run.**
Cause: you installed uv through a package manager, and *"when another installation method is
used, self-updates are disabled."* Fix: update through the same channel you installed with, or
switch to the standalone installer deliberately.

```bash
brew upgrade uv                  # if you installed with Homebrew
pipx upgrade uv                  # if you installed with pipx
curl -LsSf https://astral.sh/uv/0.12.12/install.sh | sh   # or move to the pinned installer
```

**★ Symptom: a release script printed your application's version where you expected uv's — or bumped it.**
Cause: `uv version` is *"Read or update the project's version"*; the tool's own version is
`uv self version`. Fix: use the self-scoped command, and never put a bare `uv version` in a
script that is not deliberately editing your project version.

```bash
uv self version
```

**★ Symptom: CI produced a different resolution this week with no commits to `pyproject.toml`.**
Cause: an unpinned installer URL fetched a newer uv, and a `0.x` resolver is allowed to change.
Fix: pin the installer URL and assert the version, so an upgrade is a commit rather than a
surprise.

```bash
curl -LsSf https://astral.sh/uv/0.12.12/install.sh | sh
uv self version
uv sync --locked          # and refuse to re-resolve at all — see 02d
```

**★ Symptom: `uvx: command not found` in a container that definitely has uv.**
Cause: the documented `COPY --from` line copies two binaries, and yours copied one. Fix: copy
both.

```dockerfile
COPY --from=ghcr.io/astral-sh/uv:0.12.12 /uv /uvx /bin/
```

**★ Symptom: `uv` works interactively and is not found in a CI step or a cron job.**
Cause: the standalone installer places the binary in `~/.local/bin/`, which your login shell
has on `PATH` and a non-interactive shell may not. Fix: add it explicitly in the job rather
than relying on shell rc files.

```yaml
- run: echo "$HOME/.local/bin" >> "$GITHUB_PATH"
```

**★ Symptom: a flag from the docs errors as unrecognised on your machine.**
Cause: uv adds flags in patch releases — `--no-locked` and `--no-frozen` arrived in **0.12.9** —
and the docs site describes the current release, not yours. Fix: print your version and compare
before assuming a typo.

```bash
uv self version
```

## Interview questions

**★ Why does uv disable `uv self update` when it was installed by Homebrew or pip, and what should you do instead?**
Because a self-update would overwrite a file another package manager believes it owns, leaving
that manager's manifest describing a version that is no longer on disk — after which
`brew upgrade` or `pip list` reports fiction. uv states the rule plainly: *"When another
installation method is used, self-updates are disabled."* The correct response is to update
through the channel you installed with (`brew upgrade uv`, `pipx upgrade uv`), or to make a
deliberate switch to the standalone installer, which is the only method that owns the binary
outright. The failure mode worth naming is the intermediate state: installing via Homebrew,
then also running the standalone installer, leaves two `uv` binaries on `PATH` and the answer to
"which uv am I running" becomes a `PATH` ordering question.

**★ What is the difference between `uv version` and `uv self version`, and why is the distinction dangerous rather than merely confusing?**
`uv version` is *"Read or update the project's version"* — it reads, and can write, the `version`
field of the `pyproject.toml` it finds. `uv self version` is *"Display the installed uv
version"*. The danger is that the intuitive command is the destructive one: a release pipeline
written by analogy with `node --version` or `python --version` reaches for `uv version`, and
because it accepts `--bump`, a careless invocation edits your project metadata rather than
reporting a tool version. It also fails in a way that misleads — outside a project there is no
version to read, so the error looks like a broken uv installation rather than a wrong command.

**★ You are asked to make a build reproducible. Which uv versions have to be pinned, and where?**
All of them, and there are more places than people expect: the CI runner (pin the installer
URL, `https://astral.sh/uv/0.12.12/install.sh`, and assert with `uv self version`), the
container image (pin the tag in `COPY --from=ghcr.io/astral-sh/uv:0.12.12`, since uv's docs say
it is *"best practice to pin to a specific uv version"*), and the pre-commit hook `rev`.
Additionally the *interpreter* has to be pinned (`.python-version` plus `requires-python`) and
the dependency set has to be pinned (`uv.lock`, installed with `--locked`). Pinning uv alone is
not reproducibility, and pinning dependencies alone is not either, because a `0.x` resolver is
part of the input: uv 0.12.7 added resolution support for new Linux targets, which means the set
of platforms a lockfile can even describe depends on which uv wrote it.

**Why is an unpinned `curl | sh` in CI worse than an unpinned dependency range?**
Because an unpinned dependency range is still recorded — `uv.lock` captures the exact version
that was chosen, and the diff is reviewable. An unpinned installer produces no artefact at all:
nothing in the repository records which uv ran, so when the pipeline behaves differently there
is no evidence of the change and no way to bisect it. The fix costs one path segment in a URL,
and the diagnostic — `uv self version` printed in the log — costs one line.

**uv publishes an official container image. Why copy the binary out of it instead of using it as your base image?**
Because uv is a build-time tool and your runtime does not need it. Copying `/uv /uvx /bin/` out
of a pinned tag gives you the exact version you tested with, in whatever base image your
platform actually requires — a distro image with the right glibc, a hardened base, a
company-standard base — and keeps that decision independent of Astral's release cadence. It
also means the final stage of a multi-stage build can omit uv entirely: the environment is
already installed, and putting `/app/.venv/bin` at the front of `PATH` (uv's own documented
alternative to activation) runs it with no tool present. Using uv's image as the base couples
your runtime OS to a tool you only needed for thirty seconds.

**Why does this topic keep naming uv patch versions?**
Because uv is `0.x`, ships roughly weekly (0.12.3 on 2026-08-07 through 0.12.12 on 2026-09-09),
adds flags in patch releases, and puts genuinely new behaviour behind `--preview` with explicit
notice that it will change — 0.12.11's notes warn that empty `pylock.toml` hash tables *"will be
rejected in a future uv release"*. A page that reads as if uv were stable is a page that will
quietly go wrong, and the reader following it will not know which sentence expired. Naming the
boundary — "this landed in 0.12.9" — turns a silent failure into a legible one.

---

← Prev: [01b · The project uv sees](01b-the-project-uv-sees.md) · [Topic index](README.md) · Next → [01d · The cache and the speed claim](01d-the-cache-and-the-speed-claim.md)
