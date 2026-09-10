---
title: "A uv Dockerfile is four decisions — copy the binary out of a pinned image, install dependencies without the project, set two environment variables, and put `.venv/bin` on `PATH` instead of activating anything"
sidebar_label: "02e · uv in a container image"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — *Using uv in Docker*
> ([docs.astral.sh](https://docs.astral.sh/uv/guides/integration/docker/)), *Locking and syncing*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/sync/)), *Caching*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/cache/)) and the environment variable
> reference ([docs.astral.sh](https://docs.astral.sh/uv/reference/environment/)).
> Version spine: **uv 0.12.12** (2026-09-09) · Python 3.14.7 · ruff 0.16.6 · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings**.

**Everything awkward about Python in a container comes from one mismatch: Docker caches layers by
their inputs, and a naive Dockerfile makes your dependency install depend on your source code, so
every one-character edit reinstalls the world. uv's answer is a flag whose entire reason for
existing is that mismatch — `--no-install-project` installs your dependencies *without* your
project, so that layer survives every source change. Around it sit three more decisions that are
each one line and each fix a real symptom: copy uv out of a version-pinned image rather than
installing it, set `UV_LINK_MODE=copy` because the cache mount is a different filesystem, and put
`/app/.venv/bin` at the front of `PATH` so the runtime stage needs no uv and no activation at
all.**

## The layering flag, and why it is the whole game

> *"`uv sync --no-install-project` will install the dependencies of the project but not the project
> itself. Since the project changes frequently, but its dependencies are generally static, this can
> be a big time saver."*
> — [using uv in Docker](https://docs.astral.sh/uv/guides/integration/docker/)

That sentence is a statement about *change frequency*, which is exactly what Docker layer caching
rewards. Split the install at the boundary where the inputs change at different rates:

1. Dependencies — inputs are `pyproject.toml` and `uv.lock`, which change rarely.
2. The project itself — input is your whole source tree, which changes constantly.

uv's published layer for step 1, verbatim:

```dockerfile
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-install-project
```

Three ideas are stacked in it:

- **`--mount=type=cache`** gives the layer a persistent uv cache across builds without baking it
  into the image. The caching docs' *"same file system"* requirement
  ([01d](01d-the-cache-and-the-speed-claim.md)) is violated by construction here, which is why
  `UV_LINK_MODE=copy` belongs in the same file.
- **The bind mounts** make `uv.lock` and `pyproject.toml` readable *without a `COPY`*, so those
  files never become part of a layer and the cache key stays tight.
- **`--no-install-project`** stops uv installing your package, which is the point.

For a workspace the exclusion is wider, and the lock-mode advice inverts:

> *"Use the `--no-install-workspace` flag which excludes the project and any workspace members."*

> *"Use `--frozen` instead of `--locked` during the initial sync"*
> — both [using uv in Docker](https://docs.astral.sh/uv/guides/integration/docker/)

## The two environment variables

> *"Changing the `UV_LINK_MODE` silences warnings about not being able to link files since the
> cache and sync target are on separate file systems."*
> — [using uv in Docker](https://docs.astral.sh/uv/guides/integration/docker/)

> *"To enable bytecode compilation, use the `--compile-bytecode` flag"*
> — [using uv in Docker](https://docs.astral.sh/uv/guides/integration/docker/)

```dockerfile
ENV UV_LINK_MODE=copy
ENV UV_COMPILE_BYTECODE=1
```

The environment reference describes the second as *"If set, uv will compile Python source files to
bytecode after installation."* It moves work from the first request a container serves to the
moment the image is built — which is what you want for an image and usually not what you want on a
laptop, where you would be paying the compile cost on every sync.

## `PATH` instead of activation

> *"you can either activate the project virtual environment by placing its binary directory at the
> front of the path:"* `ENV PATH="/app/.venv/bin:$PATH"`
> — [using uv in Docker](https://docs.astral.sh/uv/guides/integration/docker/)

This works because installed console scripts carry the interpreter in their shebang
([02b](02b-activation-and-discovery.md)), so nothing has to be "activated" — activation is a shell
function, and a Dockerfile's `ENTRYPOINT` is often not a shell at all. The consequence worth
exploiting: **the runtime stage does not need uv.**

## Where the Dockerfile comes together

These three pieces — the dependency-only layer, the two variables, and `PATH` — are assembled into a
complete multi-stage Dockerfile, with a runtime stage that contains no uv at all, in
[02f](02f-a-complete-multi-stage-dockerfile.md). That page also covers `.dockerignore`, non-editable
installs for a source-free runtime image, and pinning uv by digest.


## Gotchas

**★ Symptom: your Docker build re-installs every dependency whenever any source file changes.**
Cause: the `COPY . .` runs before the `uv sync`, so the dependency layer's cache key includes your
source tree. Fix: install dependencies without the project first, and read the lockfile via bind
mounts so it is not copied.

```dockerfile
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-install-project --no-dev
COPY . /app
RUN uv sync --locked --no-dev
```

**★ Symptom: every build logs warnings about being unable to link files.**
Cause: the cache mount and `/app/.venv` are on different filesystems, so hardlinking is
impossible. Fix: the one line uv's own guide prescribes.

```dockerfile
ENV UV_LINK_MODE=copy
```

**★ Symptom: the image runs, but the first request to each new container is noticeably slow.**
Cause: no bytecode was compiled at build time, so every module is compiled on first import inside
the container — repeatedly, once per fresh container. Fix: compile at build time.

```dockerfile
ENV UV_COMPILE_BYTECODE=1
```

**★ Symptom: `CMD ["gunicorn", ...]` fails with "executable file not found" although the environment exists.**
Cause: nothing put the environment's `bin` directory on `PATH`, and `CMD` in exec form does not run
a shell, so activation was never even possible. Fix: uv's documented `PATH` line.

```dockerfile
ENV PATH="/app/.venv/bin:$PATH"
```

**★ Symptom: a workspace image fails on its first sync and `--locked` makes the message worse.**
Cause: the workspace members are not installable yet, and uv's guide gives the opposite advice for
this one step: *"Use `--frozen` instead of `--locked` during the initial sync"*, with
`--no-install-workspace`. Fix:

```dockerfile
RUN uv sync --frozen --no-install-workspace --no-dev
```

**★ Symptom: the cache mount makes no difference; each build downloads everything again.**
Cause: the mount target does not match the cache directory uv is actually using — a different
`HOME`, a `UV_CACHE_DIR` set elsewhere, or a non-root user. Fix: state both explicitly so they
cannot disagree.

```dockerfile
ENV UV_CACHE_DIR=/opt/uv-cache
RUN --mount=type=cache,target=/opt/uv-cache uv sync --locked --no-dev
```

## Interview questions

**★ Explain `--no-install-project` to someone who has never optimised a Docker build.**
Docker caches layers by their inputs. If `uv sync` runs after `COPY . .`, every source edit changes
that layer's inputs, so the slowest step in the build — installing every dependency — repeats for a
one-character change. `--no-install-project` splits the work along the line where change frequency
differs, which uv states plainly: it *"will install the dependencies of the project but not the
project itself. Since the project changes frequently, but its dependencies are generally static,
this can be a big time saver."* So you sync dependencies from `pyproject.toml` and `uv.lock` alone
— bind-mounted, so not even copied into a layer — then `COPY` the source and sync again to install
the project. The second sync is cheap because everything it needs is already present.

**★ Why does uv's Docker guide set `UV_LINK_MODE=copy`, and what breaks if you leave it out?**
Because uv installs by linking out of its cache rather than copying, and the cache in a Docker
build is a mount — a different filesystem from the image's own layers, so hardlinks are impossible.
uv's caching page states the requirement (*"It is important for performance for the cache directory
to be located on the same file system as the Python environment uv is operating on"*) and the Docker
guide names the observable consequence: changing the link mode *"silences warnings about not being
able to link files since the cache and sync target are on separate file systems."* Nothing *breaks*
if you leave it out — uv falls back to copying and warns — but you get warning noise on every build
and lose the ability to notice a genuine linking problem in the log. It is one line to make the
build honest about what it is doing.

**★ Would you activate the virtual environment, put it on `PATH`, or use `uv run` in a container?**
`PATH`. Activation is a shell function, so it does not persist between `RUN` instructions and
cannot apply to an exec-form `ENTRYPOINT` — it is structurally the wrong tool for a Dockerfile.
`uv run` works and is the right answer if uv is present for other reasons, but it keeps a
build-time tool in the runtime image and adds a process to the tree. `ENV PATH="/app/.venv/bin:$PATH"`
is uv's own documented option, costs one line, and works because of the shebang mechanism CPython
documents. There is one caveat to remember: an environment moved to a different absolute path
between stages will have broken shebangs, so either copy it to the identical path or create it with
`--relocatable`.

---

← Prev: [02d · --frozen and --locked in CI](02d-frozen-and-locked-in-ci.md) · [Topic index](README.md) · Next → [02f · A complete multi-stage Dockerfile](02f-a-complete-multi-stage-dockerfile.md)
