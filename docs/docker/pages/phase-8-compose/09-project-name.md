---
title: "The project name"
sidebar_label: "09 · The project name"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against
> [Specify a project name](https://docs.docker.com/compose/how-tos/project-name/),
> [version and name](https://docs.docker.com/reference/compose-file/version-and-name/),
> [the Compose application model](https://docs.docker.com/compose/intro/compose-application-model/)
> and [the `docker compose` CLI reference](https://docs.docker.com/reference/cli/docker/compose/).
> **No sandbox** — no console output on this page.

**The project name is the namespace, and by default it is the name of the directory
you happen to be sitting in.** That default is fine until it is not: two checkouts
of the same repository share a name, and therefore share containers, networks and
volumes.

"Compose uses a project name to isolate environments from each other."

## What the name namespaces

| Resource | Name |
|---|---|
| Containers | `<project>-<service>-<index>` |
| The default network | `<project>_default` ([page 07](07-networks.md)) |
| Named volumes | `<project>_<volume>` unless `name:` overrides it ([page 08](08-volumes.md)) |
| Labels | `com.docker.compose.project` on everything Compose creates |

It is also what makes teardown coherent: `docker compose down` knows what to remove
because every resource carries the project label. A project is described in the
documentation as "an individual deployment of an application specification on a
platform", and the name is that deployment's identity.

## Where the name comes from

Highest precedence first:

1. The `-p` command line flag
2. The `COMPOSE_PROJECT_NAME` environment variable
3. The top-level `name:` attribute in the Compose file
4. The base name of the project directory containing the Compose file
5. The base name of the current directory if no Compose file is specified

```yaml
name: myapp                 # 3 — in the file

services:
  api:
    build: .
```

```bash
docker compose -p myapp-pr-42 up -d          # 1 — wins over everything
COMPOSE_PROJECT_NAME=myapp-staging docker compose up -d   # 2
```

**Rows 4 and 5 are the ones that surprise.** Clone the same repository twice into
`~/work/myapp` and `~/review/myapp` and both are called `myapp` — the same project,
so the second `up` reconciles the *first* one's containers.

## The naming rules

> "Project names must contain only lowercase letters, decimal digits, dashes, and
> underscores, and must begin with a lowercase letter or decimal digit."

So a directory called `MyApp` or `2024-project` needs an explicit name, and one
called `_scratch` does too. This is the reason a project sometimes fails to start
with a name error on one machine and not another — the directory name differs.

## Running two copies at once

This is the payoff, and it is why the top-level `name:` should usually be
*absent* from a file you intend to run more than once. Per the application model,
"the same `compose.yaml` file can be deployed twice on the same infrastructure,
without changes, by just passing a distinct name".

```bash
docker compose -p feature-a up -d
docker compose -p feature-b up -d
docker compose ls                    # both projects, side by side
```

Each gets its own containers, its own network and its own volumes. What they still
share is **the host's ports** — two projects both publishing `"3000:3000"` collide,
because publishing is a host-level resource that no amount of namespacing changes.
Parameterise the published port, or do not publish at all
([page 10](10-environment-and-interpolation.md) covers the interpolation that makes
`"${API_PORT:-3000}:3000"` work).

The documentation names three cases this serves: multiple copies of one environment
on a development machine, preventing builds interfering with each other on CI
servers, and avoiding conflicts between different projects that happen to use the
same service names on a shared host.

**CI is where it matters most.** A runner executing two pipelines on one host, both
with a service called `db`, will have them fight for the name unless each run gets a
distinct project — the branch name or the pipeline id is the natural choice.

## The name is available inside the file

Whatever name is resolved is "exposed for interpolation and environment variable
resolution as `COMPOSE_PROJECT_NAME`". So a compose file can refer to its own
project:

```yaml
volumes:
  pgdata:
    name: "${COMPOSE_PROJECT_NAME}_pgdata_v2"
```

That is occasionally useful, and mostly a reminder that the value is resolved before
interpolation happens, not after.

## Finding what is running

```bash
docker compose ls               # every Compose project on this host
docker compose -p myapp ps      # one project's containers
docker volume ls --filter label=com.docker.compose.project=myapp
```

`docker compose ls` is the command people do not know exists, and it answers "what
did I leave running" in one line — including projects whose directory you have since
deleted, which are otherwise invisible until you go looking with `docker ps`.

## Podman

Project naming is the compose provider's behaviour, not Podman's, so it follows the
same precedence when `docker-compose` is the provider
([page 15](15-podman-compose.md)). The Podman-side consequence is about *scope*
rather than naming: rootless containers, networks and volumes belong to your user,
so two different Linux users on the same machine cannot collide with each other's
projects even when the names are identical — an isolation Docker's shared daemon
does not give you.

## Gotchas

**Symptom:** Working in a second clone of a repository stopped or recreated the
containers from the first.
**Cause:** Both directories have the same base name, so both resolve to the same
project.
**Fix:** `-p`, `COMPOSE_PROJECT_NAME`, or a top-level `name:` — and if the file is
meant to be run twice, prefer the flag or the environment variable so nothing is
hardcoded.

**Symptom:** `docker compose down` left containers running.
**Cause:** It was run from a directory that resolved to a different project name than
the one that started them.
**Fix:** `docker compose ls` to see the real project names, then `-p <name> down`.

**Symptom:** Compose rejects the project name on one machine and not another.
**Cause:** The directory name has uppercase letters, or starts with something other
than a lowercase letter or digit.
**Fix:** Set an explicit name rather than renaming the directory, so it is the same
everywhere.

**Symptom:** Two CI jobs on one runner interfere despite different project names.
**Cause:** Project names namespace Compose's resources, not the host's ports.
**Fix:** Do not publish fixed ports in CI. Test through the container network, or
interpolate the port from a variable the runner sets.

## Interview questions

**★ What does the project name do, and where does it come from by default?**
It namespaces everything Compose creates — container names, the default network,
named volumes — and labels them so `down` knows what to remove. By default it is the
base name of the directory containing the Compose file, which is why two clones of
one repository silently share a project.

**★ What is the full precedence for setting the project name?**
`-p` on the command line, then `COMPOSE_PROJECT_NAME`, then the top-level `name:` in
the file, then the base name of the project directory, then the base name of the
current directory. The flag and the environment variable are the two that let one
file run several times.

**★ How do you run the same compose file twice on one machine?**
Give each run a distinct project name — `docker compose -p feature-a up -d` and
`-p feature-b`. Each gets its own containers, network and volumes with no change to
the file. The one thing that does not get namespaced is host ports, so either stop
publishing them or make the published port a variable.

**Why might Compose reject a project name?**
Names may contain only lowercase letters, digits, dashes and underscores, and must
begin with a lowercase letter or a digit. A directory called `MyApp` inherits an
invalid name, which is why the same repository can fail on one machine and work on
another.

**How do you find every Compose project running on a host?**
`docker compose ls`. It lists projects rather than containers, which is the right
granularity — and it finds projects whose source directory has been deleted, which
`docker compose ps` from the wrong directory never will.

---

← Prev: [Volumes in Compose](08-volumes.md) · Index: [Phase 8](README.md) · Next → [Environment and interpolation](10-environment-and-interpolation.md)
