---
title: "Python's packaging caught up in about two years and the deployment shapes were always the same — N processes behind a proxy, on both sides"
sidebar_label: "6 · Packaging and deployment"
sidebar_position: 10
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the [uv documentation](https://docs.astral.sh/uv/), the Python
> Packaging Authority's [Python Packaging User
> Guide](https://packaging.python.org/), [PEP 621](https://peps.python.org/pep-0621/)
> (`pyproject.toml` metadata), [PEP 751](https://peps.python.org/pep-0751/) (the lock file
> format), the [npm CLI docs](https://docs.npmjs.com/cli/), and the
> [Gunicorn](https://docs.gunicorn.org/) and [Uvicorn](https://www.uvicorn.org/) docs.
> Targets: **Python 3.14.7** · **Node.js 24 LTS**.

**"Node's packaging is better" was true for a long time and is the most out-of-date claim
in this comparison. `npm install` produced a lockfile and a reproducible tree in 2017,
while Python had `pip freeze`, no standard lock format, and a virtual-environment ritual
everyone got wrong. That gap closed: `pyproject.toml` standardised metadata,
`uv` made resolution and installation fast enough that the ritual stopped mattering, and
PEP 751 gave the ecosystem a real lock file standard. Deployment, meanwhile, was never
different at all — both languages run N processes behind a reverse proxy, and the
supposedly damning "Python needs Gunicorn to use all your cores" is exactly what
`cluster` or four Node containers are doing.**

## Dependency management, side by side

| | Python (2026) | Node |
|---|---|---|
| Manifest | `pyproject.toml` (PEP 621) | `package.json` |
| Lockfile | `uv.lock`, or `pylock.toml` (PEP 751) | `package-lock.json` / `pnpm-lock.yaml` |
| Install | `uv sync` | `npm ci` / `pnpm install --frozen-lockfile` |
| Where deps live | a `.venv/` of installed packages | a `node_modules/` tree |
| Resolution | **flat** — one version of each package | **nested** — multiple versions can coexist |
| Run a tool without installing | `uvx ruff` | `npx eslint` |
| Add a dependency | `uv add httpx` | `npm install httpx` |
| Dev-only dependency | `uv add --dev pytest` | `npm install -D vitest` |
| Version pinning of the runtime itself | `requires-python`, and `uv python pin` | `engines`, `.nvmrc`, `volta` |

The rows line up almost exactly, which is the point. Two differences are real:

**Flat versus nested resolution.** Python installs one version of each package into the
environment, so a genuine conflict is a hard error you must resolve. npm nests, so two
versions coexist happily. Python's model produces more up-front friction and far fewer
"which copy of this library is my object an instance of" bugs at runtime.

**The environment is a directory of installed packages, not a directory of source.**
`node_modules` holds the packages' source; a `.venv` holds installed distributions plus
the scripts and the interpreter symlink. That is why moving or renaming a venv breaks its
console scripts (their shebangs are absolute) and moving `node_modules` mostly does not.

## The uv change, stated precisely

Before drawing conclusions from any Python packaging complaint, check its date. The
sequence that closed the gap:

- `pyproject.toml` (PEP 518/621) replaced `setup.py` as the metadata format, so tools stopped
  needing to execute code to learn a package's dependencies.
- Wheels became universal, so installing stopped meaning compiling.
- `uv` unified the workflow — environment creation, resolution, installation, tool running
  and Python version management — behind a single fast binary.

```bash
uv init myservice && cd myservice
uv add fastapi uvicorn
uv add --dev pytest ruff mypy
uv run pytest                 # creates/syncs the venv, then runs — no activation
uv sync --frozen              # CI: install exactly the lockfile, fail if it is stale
```

The `uv run` line is the one that changes how the language feels: **there is no activation
step**, and the environment is guaranteed to match the lockfile before your command runs.
That removes the single most common Python-onboarding failure — code run against the wrong
interpreter. See [05 · Virtual environments](../05-virtual-environments/README.md) for what
a venv actually is, and [04 · Installing and versions](../04-installing-and-versions/README.md)
for managing interpreters.

What has *not* changed: Python still has more than one blessed tool (`uv`, Poetry, PDM,
pip + venv), where Node's npm is the default that ships with the runtime. That is a real
remaining advantage for Node — not of capability, but of there being one obvious answer.

## Deployment: the same architecture, twice

```text
Python                                 Node
──────                                 ────
        nginx / ALB                            nginx / ALB
             │                                      │
   ┌────┬────┼────┬────┐                  ┌────┬────┼────┬────┐
   w1   w2   w3   w4   …                  p1   p2   p3   p4   …
   (gunicorn -k uvicorn.workers …          (4 containers, or cluster.fork())
    or N uvicorn processes,
    or N containers)
```

Both run one process per core. Both put a reverse proxy in front. Both rely on a
supervisor to restart a dead worker. The Python command is longer, which is the entire
difference people are describing when they call this a disadvantage.

```bash
# Python: an ASGI app, four workers
uvicorn app.main:app --workers 4 --host 0.0.0.0 --port 8000
gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w 4 --bind 0.0.0.0:8000

# Node: four processes, usually four containers
node server.js        # ×4, behind the load balancer
```

Two Python-specific details worth knowing, because they are where real incidents come
from:

1. **Workers × connection-pool size is your real database connection count.** Four workers
   each holding a pool of 20 is 80 connections from one container, and Postgres's default
   `max_connections` is 100. Node has the identical arithmetic and the identical incident;
   it is just less often written down.
2. **A synchronous worker serves one request at a time.** `gunicorn -w 4` with the default
   sync worker gives you exactly four concurrent requests. With `UvicornWorker` (async) or
   `gthread`, each worker handles many. Choosing the wrong worker class is a common and
   very confusing performance bug.

## Container images

```dockerfile
# Python — multi-stage, uv, no build tools in the final image
FROM python:3.14-slim AS build
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY . .
RUN uv sync --frozen --no-dev

FROM python:3.14-slim
WORKDIR /app
COPY --from=build /app /app
ENV PATH="/app/.venv/bin:$PATH"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0"]
```

```dockerfile
# Node — the same shape
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .

FROM node:24-slim
WORKDIR /app
COPY --from=build /app /app
CMD ["node", "server.js"]
```

Node images are typically smaller, mostly because Python's ML-adjacent dependencies are
enormous — a `torch` install is measured in gigabytes. For a plain web service the
difference is modest and both benefit from the same techniques: multi-stage builds, a
`slim` base, and copying the lockfile before the source so the dependency layer caches.

## Gotchas

### `pip install` into the system Python
**Symptom.** A broken `apt`, or a service that works locally and not in the container.
**Cause.** Installing into the interpreter the operating system depends on. Modern Python
refuses by default (PEP 668's `externally-managed-environment`), and `--break-system-packages`
is named the way it is on purpose.
**Fix.** Always a venv, and let `uv` manage it:

```bash
uv venv && uv sync           # or just `uv run <cmd>`, which does both
```

There is no Node equivalent of this failure, because npm installs into `./node_modules` by
default rather than into a system location. It is a genuine Python-specific footgun and
worth conceding.

### `uv sync` without `--frozen` in CI
**Symptom.** CI passes with a dependency version that is not the one in the lockfile.
**Cause.** Plain `uv sync` will update the lockfile if the manifest has drifted.
**Fix.** `uv sync --frozen` in CI, which fails rather than re-resolving — the exact
counterpart of `npm ci` versus `npm install`. Using `npm install` in CI is the same
mistake and just as common.

### A moved or renamed virtual environment
**Symptom.** `bad interpreter: No such file or directory` from a console script after
renaming the project directory.
**Cause.** The scripts in `.venv/bin/` have absolute shebangs pointing at the venv's
interpreter.
**Fix.** Recreate it — venvs are disposable by design:

```bash
rm -rf .venv && uv sync
```

Never commit a venv, and never copy one between machines. `node_modules` is more forgiving
here but should equally never be committed.

### Workers times pool size exceeding `max_connections`
**Symptom.** `FATAL: sorry, too many clients already` under load, from a service that is
nowhere near CPU-bound.
**Cause.** Each worker process has its own connection pool. Four workers × 20 connections
× three replicas is 240 connections.
**Fix.** Size the pool with the worker count in mind, and put a pooler in front:

```python
# 4 workers × 5 = 20 per container, which is a number you can reason about
engine = create_async_engine(url, pool_size=5, max_overflow=2)
```

PgBouncer in transaction mode is the standard answer once replica count is dynamic. Node
services need exactly the same discipline.

### The wrong Gunicorn worker class
**Symptom.** An async FastAPI app that handles four concurrent requests.
**Cause.** `gunicorn app:app -w 4` with the default **sync** worker, which serves one
request per worker and does not understand ASGI at all.
**Fix.** Name the worker class explicitly:

```bash
gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w 4
```

For a purely synchronous WSGI app, `-k gthread --threads 8` is the counterpart. Node has
no equivalent mistake available, which is a fair point in its favour: fewer knobs, fewer
wrong settings.

### Assuming a Python packaging complaint is current
**Symptom.** An architecture document citing `setup.py`, `pip freeze`, or "Python has no
lockfile".
**Cause.** Material written before 2024.
**Fix.** Check the date on any Python packaging claim. `pyproject.toml`, `uv.lock` and PEP
751 are the current state; `setup.py` is legacy and `pip freeze` was never a lockfile —
it records what happens to be installed, with no hashes and no resolution metadata.

## Interview questions

**Q. Is Python's packaging still worse than Node's?**
A. Much less than it was, and the specific complaints are usually dated.
`pyproject.toml` standardised the manifest, wheels removed compilation from installs, and
`uv` gave the ecosystem one fast tool covering environments, resolution, locking, tool
running and interpreter versions. PEP 751 standardised the lock file format. What Node
still has is *one* obvious tool that ships with the runtime; Python has several good ones,
which is a smaller but real advantage.

**Q. `uv sync` versus `npm ci` — what is the equivalence?**
A. Both install exactly what the lockfile says and fail rather than re-resolve — `uv sync
--frozen` is the precise counterpart. The loose forms, `uv sync` and `npm install`, may
update the lockfile, which is what you want locally and never want in CI.

**Q. How do you deploy a Python web service, and how is that different from Node?**
A. It is not meaningfully different. N processes, one per core, behind a reverse proxy,
each restarted by a supervisor — `gunicorn` with `UvicornWorker`, or N `uvicorn`
processes, or N containers. Node does the same thing with `cluster` or, more commonly, N
containers. Anyone framing Gunicorn as evidence of a Python limitation is describing the
standard Node deployment too.

**Q. What is the most common capacity mistake in either?**
A. Multiplying connection pools by worker count by replica count and exceeding the
database's `max_connections`. Four workers with a pool of 20 across three replicas is 240
connections against a default limit of 100. Size the per-worker pool deliberately, and put
PgBouncer in front once replicas scale automatically.

**Q. Why does Python need a virtual environment when Node does not?**
A. Because Python installs packages into an interpreter's `site-packages`, which is a
shared location, whereas npm installs into `./node_modules` next to the project by
default. The venv gives Python the per-project isolation Node gets for free. `uv run`
hides the ceremony, but the underlying model still differs, and installing into the system
interpreter is still the classic way to break a Linux machine's package manager.

**Q. Flat versus nested dependency resolution — which would you rather debug?**
A. Flat. Python's one-version-per-package rule turns a conflict into an error at install
time, which is annoying but explicit. npm's nesting resolves it silently by installing
both, and then you get runtime bugs where an object fails an `instanceof` check against a
class from the other copy. I will take the loud failure.

**Q. What actually goes in a production Python image that would surprise a Node
developer?**
A. That the interpreter and the environment are separate concerns — you copy a `.venv`
built in an earlier stage and put its `bin` on `PATH`, rather than shipping a source tree.
And that image size is dominated by dependencies rather than the runtime: a plain FastAPI
image is comparable to a Node one, while anything with `torch` in it is orders of
magnitude larger.

---

← Prev: [Ecosystem shapes](05-ecosystems.md) · Index: [Python vs Node](README.md) · Next → [Performance, honestly](07-performance.md)

{/* FOOTER */}
