---
title: "A production uv image is two stages: the builder syncs dependencies before the source and the project after it, and the runtime stage copies the environment to the identical path and runs it with no uv, no activation and — with `--no-editable` — no source tree"
sidebar_label: "02f · A complete multi-stage Dockerfile"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — *Using uv in Docker*
> ([docs.astral.sh](https://docs.astral.sh/uv/guides/integration/docker/)), *Locking and syncing*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/sync/)), *Python versions*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/python-versions/)) and the environment variable
> reference ([docs.astral.sh](https://docs.astral.sh/uv/reference/environment/)).
> Version spine: **uv 0.12.12** (2026-09-09) · Python 3.14.7 · ruff 0.16.6 · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings**.

**[02e](02e-uv-inside-a-container-image.md) explained the pieces: the dependency-only layer, the two
environment variables, and `PATH` instead of activation. This page assembles them into the Dockerfile
you actually ship and covers the decisions that only appear once there are two stages. The builder
installs dependencies before the source is copied and the project after; the runtime stage copies the
environment to the *same absolute path*, because an environment's shebangs and `pyvenv.cfg` are
absolute; and the runtime stage carries neither uv nor, if you install non-editably, your source tree.
Four small files decide whether that works — the `.dockerignore`, the `COPY --from` line, the lock
flag, and the dev-group flag — and each has a failure that looks like something else.**


## A complete Dockerfile, assembled from the documented pieces

```dockerfile
# syntax=docker/dockerfile:1
FROM python:3.14-slim AS builder

# pinned uv — both binaries; the tag IS the version pin (01c)
COPY --from=ghcr.io/astral-sh/uv:0.12.12 /uv /uvx /bin/

ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PROJECT_ENVIRONMENT=/app/.venv

WORKDIR /app

# 1 · dependencies only — this layer ignores your source tree entirely
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-install-project --no-dev

# 2 · now the source, then install the project itself
COPY . /app
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev

FROM python:3.14-slim AS runtime
WORKDIR /app
COPY --from=builder /app /app
# no uv here; the shebangs and PATH are enough
ENV PATH="/app/.venv/bin:$PATH"
CMD ["gunicorn", "myapp.wsgi:application", "--bind", "0.0.0.0:8000"]
```

Four things in that file are decisions, not boilerplate:

- **`--no-dev` on both syncs.** The dev group is synced by default
  ([02c](02c-uv-sync-makes-the-environment-match.md)); without this the image ships pytest.
- **`--locked` on both syncs.** A stale lockfile fails the build rather than being silently
  installed ([02d](02d-frozen-and-locked-in-ci.md)).
- **`UV_PROJECT_ENVIRONMENT=/app/.venv`** — *"Specifies the path to the directory to use for a
  project virtual environment"* ([environment
  variables](https://docs.astral.sh/uv/reference/environment/)) — makes the environment path
  explicit rather than implied by the working directory, so the second stage's `COPY` and the
  `PATH` line cannot drift apart.
- **The same absolute path in both stages.** Environments are not relocatable
  ([02b](02b-activation-and-discovery.md)); copying `/app` to `/app` keeps every shebang valid. If
  the paths must differ, create the environment with `--relocatable`.

Also available for the interpreter itself:

> `ENV UV_PYTHON_CACHE_DIR` *"can be used in combination with a cache mount"*
> — [using uv in Docker](https://docs.astral.sh/uv/guides/integration/docker/)

## `.dockerignore` — keep the host's environment out of the image

> *"It is best practice to add `.venv` to a [`.dockerignore` file](https://docs.docker.com/build/concepts/context/#dockerignore-files)
> in your repository to prevent it from being included in image builds. The project virtual environment
> is dependent on your local platform and should be created from scratch in the image."*
> — [using uv in Docker](https://docs.astral.sh/uv/guides/integration/docker/)

The mechanism behind *"dependent on your local platform"*: a local `.venv` contains a link to your
laptop's interpreter and wheels built for your laptop's operating system and architecture. The
builder's `COPY . /app` would copy that directory on top of the `/app/.venv` the first sync just built.

```text
# .dockerignore
.venv
__pycache__/
.git
```

## `--no-editable` — a runtime stage without the source tree

The Dockerfile above copies all of `/app` into the runtime stage because the project was installed
*editable* — which is uv's default for syncs ([02c](02c-uv-sync-makes-the-environment-match.md)) — and an
editable install points back at the source. uv's guide offers the alternative:

> *"`uv sync` and `uv run` both accept a `--no-editable` flag, which instructs uv to install the project
> in non-editable mode, removing any dependency on the source code."*
> — [using uv in Docker](https://docs.astral.sh/uv/guides/integration/docker/)

With that, the runtime stage can *"copy the environment, but not the source code"*:

```dockerfile
# builder, final sync
COPY . /app
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev --no-editable

FROM python:3.14-slim AS runtime
COPY --from=builder /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"
CMD ["gunicorn", "myapp.wsgi:application", "--bind", "0.0.0.0:8000"]
```

The trade is explicit: the runtime image is smaller and contains no tests, fixtures or notebooks that
happened to be in the repository, and in exchange anything the application reads *from the source
tree at runtime* — a data file that is not packaged, a template directory outside the package — is no
longer there. Packaging those files properly is the fix; topic **07 · Wheels vs sdists** *(not written
yet)* covers what lands in a built distribution.

## Pinning uv by digest, where tags are not enough

The `COPY --from=ghcr.io/astral-sh/uv:0.12.12` line pins a *tag*. uv's guide adds one more level for
environments that need it:

> *"Pinning a specific SHA256 is considered best practice in environments that require reproducible
> builds as tags can be moved across different commit SHAs."*
> — [using uv in Docker](https://docs.astral.sh/uv/guides/integration/docker/)

```dockerfile
# pseudo-code: substitute the digest you resolved and reviewed for this tag
COPY --from=ghcr.io/astral-sh/uv:0.12.12@sha256:<digest-you-verified> /uv /uvx /bin/
```

Keep the tag beside the digest: the digest is what is enforced, the tag is what a human reads in review.


## Gotchas

**★ Symptom: an environment copied between build stages has a `python` that does not work.**
Cause: `pyvenv.cfg` and every shebang hold absolute paths, and the stages used different
directories. Fix: use the identical path in both stages, or build the environment relocatable.

```dockerfile
COPY --from=builder /app /app        # same path — nothing to rewrite
```

**★ Symptom: the final image is far larger than expected.**
Cause: usually two things at once — the dev group was installed, and uv plus its cache were left in
the final stage. Fix: `--no-dev`, and a runtime stage that copies only the environment and the
source it needs.

```dockerfile
FROM python:3.14-slim AS runtime
COPY --from=builder /app /app
ENV PATH="/app/.venv/bin:$PATH"
```

**★ Symptom: `uv` in the container tries to download a Python interpreter during the build.**
Cause: uv *"will automatically download Python versions when needed"*
([Python versions](https://docs.astral.sh/uv/concepts/python-versions/)), and the base image's
interpreter did not satisfy the request in `.python-version` / `requires-python`. Fix: either match
the base image to the pin, or forbid downloads so the mismatch fails loudly instead of being
papered over.

```dockerfile
ENV UV_PYTHON_DOWNLOADS=never
```

**★ Symptom: `uvx` is not found inside the image, though `uv` is.**
Cause: the documented `COPY --from` line copies two binaries and yours copied one. Fix: copy both
([01c](01c-installing-and-pinning-uv.md)).

```dockerfile
COPY --from=ghcr.io/astral-sh/uv:0.12.12 /uv /uvx /bin/
```

**★ Symptom: the image builds, but `python` inside `/app/.venv` points at an interpreter that does not exist in the container.**
Cause: no `.dockerignore`, so `COPY . /app` copied your laptop's `.venv` over the one the builder
created — an environment uv's guide calls *"dependent on your local platform"*. Fix:

```text
# .dockerignore
.venv
```

**★ Symptom: a runtime stage that copies only `/app/.venv` fails with `ModuleNotFoundError` for your own package.**
Cause: the project was installed editable — uv's default — so the environment points at source that
the runtime stage never received. Fix: install non-editably in the builder's final sync.

```dockerfile
RUN uv sync --locked --no-dev --no-editable
```

**Symptom: two builds of the same commit, weeks apart, contain different uv binaries.**
Cause: a tag, even a version tag, can be re-pointed; the guide notes that *"tags can be moved across
different commit SHAs."* Fix: pin the digest as well as the tag where reproducibility is a requirement.

```dockerfile
# pseudo-code: the digest is the one you verified for 0.12.12
COPY --from=ghcr.io/astral-sh/uv:0.12.12@sha256:<digest-you-verified> /uv /uvx /bin/
```


## Interview questions

**★ Why does the final stage of a good uv Dockerfile contain no uv at all?**
Because uv is a build-time tool. Once the environment exists, running the application needs only
the interpreter and the installed scripts, and installed scripts carry their interpreter in the
shebang — so uv's own guidance is a `PATH` line rather than an activation:
`ENV PATH="/app/.venv/bin:$PATH"`. Dropping uv from the runtime stage makes the image smaller,
removes a binary from the runtime attack surface, and removes any temptation for something in
production to resolve or install a package. The trade-off is that you cannot use `uv run` in the
container, which mostly matters for debugging — and a shell in the container with `PATH` set gets
you the same interpreter anyway.

**★ Why is `--locked` the right flag in a Dockerfile, given that the image build is not CI?**
Because an image build is the last place you want a silent re-resolution. uv locks automatically by
default, so a `pyproject.toml` that has drifted from `uv.lock` would produce an image containing a
dependency set nobody reviewed — and unlike a CI job, the image is the artefact you ship, so the
discrepancy travels to production. uv's own published layer uses `--locked` for exactly this reason.
The documented exception is a workspace's initial sync, where the guide says to *"use `--frozen`
instead of `--locked`"*; that is a narrow, named case and not a general licence.

**★ Why add `.venv` to `.dockerignore` when the Dockerfile builds its own environment anyway?**
Because the build's own environment is created *before* the source is copied, and a naive
`COPY . /app` then copies the host's `.venv` on top of it. uv's guide gives the reason the host copy is
worthless in the image: *"The project virtual environment is dependent on your local platform and
should be created from scratch in the image."* A macOS laptop's environment links to a macOS
interpreter and holds macOS wheels; in a Linux container it is not an environment at all. The failure is
also nasty to diagnose, because the image builds successfully and breaks only when something runs. The
`.dockerignore` line prevents it and also shrinks the build context sent to the daemon.

**When would you install the project non-editably in an image, and what do you give up?**
When the runtime stage should contain the environment and nothing else. uv installs the project
editable by default, which is right for development and wrong for an image that wants to leave the
source behind — an editable install is a pointer back to the source tree. `--no-editable` *"instructs uv
to install the project in non-editable mode, removing any dependency on the source code"*, so the
runtime stage can copy `/app/.venv` alone. You give up anything the application loads from the
repository at runtime rather than from its installed package: unpackaged data files, templates outside
the package directory, a config file read by relative path. Those surface as missing-file errors in
production, so the non-editable image is also a test that your packaging is complete.


Whether to allow uv to download an interpreter during an image build is really a question about
uv's Python management, so it is answered in [05](05-uv-python.md).

---

← Prev: [02e · uv in a container image](02e-uv-inside-a-container-image.md) · [Topic index](README.md) · Next → [03 · uv.lock](03-the-lockfile.md)
