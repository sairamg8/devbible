---
title: "What Compose is"
sidebar_label: "01 · What Compose is"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the [Docker Compose overview](https://docs.docker.com/compose/),
> [the Compose application model](https://docs.docker.com/compose/intro/compose-application-model/),
> [Compose file — version and name](https://docs.docker.com/reference/compose-file/version-and-name/),
> [the `docker compose` CLI reference](https://docs.docker.com/reference/cli/docker/compose/),
> [`podman-compose(1)`](https://docs.podman.io/en/latest/markdown/podman-compose.1.html) and the
> [Compose v5.4.0 release](https://github.com/docker/compose/releases) (3 Aug 2026).
> **No sandbox** — no console output on this page.

**Compose is two things that are easy to confuse: a file format that describes a
set of containers, networks and volumes, and a CLI that makes reality match that
description.** The file is declarative. The CLI is a reconciler, not a script
runner.

Almost every misunderstanding in this phase comes from reading `docker compose up`
as "run my containers" instead of "make the running state equal the file".

## The problem it solves

By the end of Phase 1 you could run a container. By the end of Phase 3 you could
build a good image. Neither taught you how to run **five** containers that have to
find each other, and the honest answer people reach for first is a shell script:

```bash
docker network create myapp_default
docker volume create myapp_pgdata

docker run -d --name myapp-db \
  --network myapp_default \
  -v myapp_pgdata:/var/lib/postgresql/data \
  -e POSTGRES_PASSWORD=dev \
  --health-cmd 'pg_isready -U postgres' --health-interval 5s \
  postgres:18

docker run -d --name myapp-api \
  --network myapp_default \
  -e DATABASE_URL=postgres://postgres:dev@myapp-db:5432/app \
  -p 3000:3000 \
  --restart unless-stopped \
  myapp/api:dev
```

That script has four defects, and they are the four things Compose fixes:

1. **It is not idempotent.** Running it twice fails on `network create` and on the
   container name, because a name is unique across stopped containers too
   ([Phase 1, page 02](../phase-1-running-containers/02-detached-and-cleanup.md)).
   You end up writing `|| true` everywhere, and then you cannot tell a real error
   from an expected one.
2. **It has no down.** Tearing the stack back down is a second script that has to
   stay in sync with the first, and the day it drifts you leak a volume.
3. **It encodes ordering as sequence.** The database line is above the API line, so
   the database "starts first" — but starting is not the same as being ready, and
   the API crashes anyway
   ([page 05](05-depends-on.md) is about exactly this).
4. **Nothing owns the resources.** `myapp_default` and `myapp_pgdata` are named by
   convention. Nothing knows they belong together, so nothing can clean them up.

The Compose equivalent describes the *end state* and lets the tool work out the
verbs:

```yaml
services:
  db:
    image: postgres:18
    environment:
      POSTGRES_PASSWORD: dev
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s

  api:
    image: myapp/api:dev
    environment:
      DATABASE_URL: postgres://postgres:dev@db:5432/app
    ports:
      - "3000:3000"
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy

volumes:
  pgdata:
```

`docker compose up -d` brings that up. `docker compose down` takes it away.
Running `up` again when it is already up does **nothing** — and that last property
is the one worth internalising.

## Half one: the file

The Compose file is governed by the **Compose Specification**, which the
documentation describes as helping to define configuration for "Docker
application's services, networks, volumes, and more". Five top-level abstractions
carry almost all of it:

| Element | What it describes |
|---|---|
| `services` | The computing components. A service is "an abstract concept implemented on platforms by running the same container image, and configuration, one or more times" |
| `networks` | The communication layer — "an IP route between containers within services connected together" |
| `volumes` | Persistent storage that services "store and share persistent data into" |
| `configs` | Runtime configuration mounted into the container as a file |
| `secrets` | A specialised config for sensitive data, with different handling |

Note the wording on `services`: **a service is not a container.** It is a
description that may be realised as one container or several. That distinction is
what makes `--scale` even expressible, and it is why the containers Compose
creates have generated names rather than the name you wrote.

**The filename.** Compose looks for `compose.yaml` first — the documentation calls
it the preferred and canonical name — then `compose.yml`, then the legacy
`docker-compose.yaml` and `docker-compose.yml`. "If both files exist, Compose
prefers the canonical `compose.yaml`." Use `compose.yaml` in new work; the
hyphenated names exist for backward compatibility only.

## Half two: the CLI

`docker compose` is a **plugin of the Docker CLI**, not a separate program. That is
the visible difference between the modern tool and the original Python one: a
space instead of a hyphen. The surface is large — `up`, `down`, `ps`, `logs`,
`exec`, `run`, `build`, `pull`, `push`, `config`, `cp`, `top`, `stats`, `wait`,
`watch`, `ls`, `volumes` and more — but the whole phase is really about a handful
of them, and [page 14](14-day-to-day-commands.md) is the working set.

The important claim is what the CLI *does*, not what it offers. Compose
**reconciles**: it inspects what exists for this project, compares it to the file,
and creates, recreates or removes to close the gap. v5.4.0 (3 Aug 2026) is
literally a release about improving that — it introduced a new way to reconcile
resources such as volumes and networks.

Three consequences follow, and they are the reason `up` behaves in ways a script
never would:

- **`up` on an unchanged stack does nothing.** No restart, no downtime, no output
  beyond "up-to-date".
- **`up` after editing one service recreates only that service.** The others are
  left running. This is why the edit-and-`up` loop is fast.
- **`up` after deleting a service from the file removes its container.** The file
  is the source of truth for what should exist, so removing a line is a
  destructive edit.

## The project is the boundary

Every Compose invocation runs in a **project**, described in the documentation as
"an individual deployment of an application specification on a platform". The
project name is the namespace: containers, the default network and named volumes
are all prefixed with it, and it is what makes the resources a *set* instead of
five unrelated objects.

It is also what lets the same file run twice on one machine — "the same
`compose.yaml` file can be deployed twice on the same infrastructure, without
changes, by just passing a distinct name". [Page 09](09-project-name.md) is the
full treatment, including the collision two checkouts hit by default.

## What Compose is not

Being clear about this saves an argument in every design review:

- **Not an orchestrator.** One host, one engine. No scheduling across machines, no
  rescheduling on node failure, no rolling deploy with health gating, no service
  mesh. `--scale` exists ([page 17](17-scale-and-limits.md)) and its limits are
  real.
- **Not a replacement for Kubernetes**, and not a stepping stone to it either —
  the models differ enough that a Compose file is a starting point for a
  conversation, not a conversion.
- **Not a build system.** `build:` delegates to the same builder `docker build`
  uses, with the same cache and the same Dockerfile semantics
  ([Phase 3](../phase-3-dockerfile/README.md)). Compose adds no build features of
  its own beyond passing arguments.
- **Not a secret manager.** `environment` and `env_file` are convenience; the
  values are visible to anyone who can run `inspect`
  ([Phase 1, page 06](../phase-1-running-containers/06-environment.md)).
- **Not production, by default** — but not *disqualified* from it either. A single
  VM running a Compose stack under systemd is a completely respectable deployment
  for a great many applications. The production posture is **Phase 10 · Running in
  production** *(not written yet)*.

## Podman

🔴 **This is the largest engine divergence in the phase, and it is worth knowing
on page one.** Podman does not implement Compose natively. Per the Podman
documentation, "`podman compose` is a thin wrapper around an external compose
provider such as docker-compose or podman-compose". It sets up the environment so
that the external tool talks to Podman, then hands over.

Two details that decide which behaviour you actually get:

- **The default providers are `docker-compose` and `podman-compose`, and
  `docker-compose` takes precedence if installed** — "since it is the original
  implementation of the Compose specification". So `podman compose` on two
  machines with different packages installed can behave differently.
- **It warns.** "By default, `podman compose` will emit a warning saying that it
  executes an external command." That warning is telling you something true.

Override the choice with `compose_providers` in `containers.conf(5)` or the
`PODMAN_COMPOSE_PROVIDER` environment variable. [Page 15](15-podman-compose.md)
covers where the two providers diverge in practice.

## Gotchas

**Symptom:** `docker compose up` prints nothing but "up-to-date" and your code
change is not live.
**Cause:** Compose reconciled and found nothing to change. The image did not
change, so the container did not need recreating.
**Fix:** `docker compose up -d --build` when the source changed and you use
`build:`. Reaching for `restart` instead is the common wrong answer — a restart
reuses the same image and cannot pick up a rebuild.

**Symptom:** A service you deleted from `compose.yaml` is still running.
**Cause:** You ran `docker compose up` naming specific services, or the container
belongs to a different project name than the one Compose resolved.
**Fix:** `docker compose ps` to see what the project actually owns, then plain
`docker compose up -d` with no service arguments so reconciliation covers the
whole file.

**Symptom:** `docker-compose: command not found`, but `docker compose version`
works.
**Cause:** The hyphenated command is the original standalone tool. The current
tool is a Docker CLI plugin invoked with a space.
**Fix:** Use `docker compose`. Do not install the old standalone binary to make a
script work — fix the script, because the two are not interchangeable in
behaviour.

**Symptom:** The same `compose.yaml` behaves differently under Podman than under
Docker.
**Cause:** `podman compose` delegates to whichever external provider is installed,
and `docker-compose` wins over `podman-compose` when both are present.
**Fix:** Pin the provider with `PODMAN_COMPOSE_PROVIDER` or `compose_providers` in
`containers.conf`, and state in your README which one the project expects.

## Interview questions

**★ What is Docker Compose?**
Two halves. A file format — the Compose Specification — that declares services,
networks, volumes, configs and secrets for one application; and a Docker CLI
plugin that reconciles the running state of a project to that file. The
declarative half is the point: you describe the end state, and the CLI works out
whether to create, recreate or remove.

**★ How is `docker compose up` different from a shell script of `docker run`
commands?**
It is idempotent and it has a matching teardown. `up` on an unchanged stack does
nothing; `up` after one edit recreates only the affected service; `down` removes
everything the project owns because the project name ties the resources together.
A script has to encode all of that by hand, and drifts from its own teardown
script the first time somebody adds a volume.

**★ Is Compose an orchestrator?**
No. It manages containers on a single host with a single engine. There is no
scheduling across nodes, no rescheduling on failure, and no health-gated rolling
deploy. `--scale` starts more replicas of a service on the same machine, which is
useful for testing and is not horizontal scaling in any operational sense. A
Compose stack on one VM is still a perfectly reasonable deployment for many
applications — it is just not an orchestrator.

**What is the difference between `docker-compose` and `docker compose`?**
The hyphenated form is the original standalone implementation; the space-separated
form is the current Docker CLI plugin. Prefer `docker compose`, and treat a script
that hard-codes the hyphenated name as needing an update rather than a
compatibility shim.

**Which filename should a new project use?**
`compose.yaml`. It is the canonical name, and Compose prefers it when more than
one candidate is present. `compose.yml`, `docker-compose.yaml` and
`docker-compose.yml` still work for backward compatibility.

**Does Podman support Compose files?**
Yes, but not natively — `podman compose` is a thin wrapper that shells out to an
external provider, defaulting to `docker-compose` if it is installed and
`podman-compose` otherwise, and it warns that it is doing so. Which provider is
installed changes the behaviour you get, so pin it deliberately rather than
relying on what happens to be on the machine.

---

← Index: [Phase 8](README.md) · Next → [compose.yaml and the Compose Specification](02-compose-yaml-and-the-spec/README.md)
