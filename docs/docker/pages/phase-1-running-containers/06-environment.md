---
title: "Environment variables"
sidebar_label: "06 · Environment variables"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [docker container run — env](https://docs.docker.com/reference/cli/docker/container/run/),
> [Dockerfile ENV](https://docs.docker.com/reference/dockerfile/#env) and
> [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html).
> **No sandbox** — no console output on this page.

**Environment variables are how a container is configured at run time, and they
are the mechanism behind "build once, run anywhere".** The same image reaches
dev, staging and production; only the environment differs.

## Three places they come from

| Source | Set at | Baked into the image? |
|---|---|---|
| `ENV` in the Dockerfile | Build time | **Yes** — visible in `docker history` |
| `-e` / `--env` on `run` | Run time | No |
| `--env-file` on `run` | Run time | No |

**Run time wins.** A `-e` on the command line overrides the image's `ENV` of the
same name. The image supplies defaults; the run supplies the truth.

```bash
docker run -e NODE_ENV=production -e LOG_LEVEL=warn myorg/api:1.4.2
docker run --env-file ./api.env myorg/api:1.4.2
docker run -e API_KEY myorg/api:1.4.2      # pass through from YOUR shell
```

That third form is worth knowing: `-e NAME` with no `=value` copies the value
from the shell that ran the command. Handy, and easy to misread as an empty
value.

## The `--env-file` format is not a shell script

This trips people constantly. The file is parsed by the engine, not sourced by
a shell:

```bash
# api.env
NODE_ENV=production
DATABASE_URL=postgres://db:5432/app
LOG_LEVEL=warn
```

- **No `export`.**
- **No quotes to strip.** `NAME="value"` sets the value to `"value"` — the
  quotation marks are part of it. This is the mistake that produces a connection
  string nothing can parse.
- **No variable expansion.** `URL=$HOST/api` is a literal dollar sign and the
  word `HOST`.
- **No inline comments.** A `#` starts a comment only at the beginning of a line.
- Blank lines and `#` comment lines are fine.

Compose's `.env` file behaves differently again — it does interpolation into the
Compose file itself. Phase 8 untangles the three mechanisms, which is genuinely
one of the more confusing corners of the whole toolchain.

## What the environment is not for

**Secrets.** An environment variable is visible to anything that can inspect the
container:

```bash
docker inspect --format '{{json .Config.Env}}' api     # the whole environment
docker exec api env                                    # same, from inside
```

It also appears in `/proc/<pid>/environ`, in crash dumps, and frequently in logs
when a framework prints its configuration on startup. For development, `.env` is
a reasonable convenience. For production, use a secret manager, a mounted file,
or your orchestrator's secret mechanism — Phase 9 and Phase 10.

And a build-time reminder from the other end: **`ARG` values are visible in
`docker history`.** A secret passed as a build argument is in the image
permanently. Phase 3.

## The twelve-factor habit

The reason this topic sits in the Master tier is that it decides whether your
image is portable:

> **The image is identical across environments. The environment supplies the
> configuration.**

Anything that differs between dev and production — database URL, log level,
feature flags, external endpoints — is an environment variable, not a file baked
into the image and not a separate image per environment. The moment you build
`myapp:production` and `myapp:staging` as different images, you have lost the
guarantee that what you tested is what you shipped.

## Podman

Identical: `-e`, `--env`, `--env-file` all behave the same way. Podman
additionally has `--env-host` to pass the host's entire environment into the
container, which is occasionally useful in scripts and is a large foot-gun in
anything else.

## Gotchas

**Symptom:** `DATABASE_URL="postgres://…"` from an env file produces a connection
error mentioning the quotes.
**Cause:** `--env-file` does not strip quotes; they became part of the value.
**Fix:** Remove the quotes. Values with spaces are fine unquoted — the parser
reads to end of line.

**Symptom:** A variable is empty inside the container although it is set in your
shell.
**Cause:** The container does not inherit your shell's environment. Only what
you pass in exists.
**Fix:** Pass it explicitly — `-e NAME` to forward the current value, or
`-e NAME=value`.

**Symptom:** `docker run -e FOO=bar myimage` and `FOO` is not set.
**Cause:** Almost always flag order — the `-e` ended up after the image name and
was passed to the application as an argument.
**Fix:** Flags before the image name. Page 01.

**Symptom:** An API key leaked into a log aggregator.
**Cause:** A framework printed its configuration at startup, and the key was in
the environment.
**Fix:** Mount secrets as files and read them at startup, or use a secret
manager. Treat the environment as observable, because it is.

## Interview questions

**★ Where can a container's environment variables come from, and which wins?**
The image's `ENV` (baked at build time), `-e`/`--env` at run time, and
`--env-file`. Run-time values override the image's, so `ENV` is for defaults and
the run supplies the actual configuration.

**★ Why are environment variables a poor place for secrets?**
They are readable by anyone who can inspect the container — `docker inspect`,
`docker exec env`, `/proc/<pid>/environ` — and they routinely end up in logs and
crash dumps when a framework prints its configuration. Use mounted files or a
secret manager.

**★ What is the difference between `--env-file` and sourcing a shell script?**
`--env-file` is parsed by the engine: no `export`, no quote stripping, no
variable expansion, no inline comments. `NAME="value"` includes the quotes in the
value, which is the classic bug.

**How do you keep one image working across dev, staging and production?**
Build once and configure with environment variables. Environment-specific
*images* break the guarantee that the artefact you tested is the one you shipped.

**How do you pass a variable from your shell without repeating its value?**
`-e NAME` with no `=` copies the current value from the calling shell. Useful,
and easy to mistake for setting it empty.

---

← Prev: [Publishing ports](05-publishing-ports.md) · Index: [Phase 1](README.md) · Next → [The container lifecycle](07-lifecycle.md)
