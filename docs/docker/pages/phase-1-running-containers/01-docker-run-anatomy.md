---
title: "The anatomy of docker run"
sidebar_label: "01 · docker run anatomy"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [docker container run](https://docs.docker.com/reference/cli/docker/container/run/),
> [docker run — runtime options](https://docs.docker.com/engine/containers/run/) and
> [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html).
> **No sandbox** — no console output on this page.

**`run` is `create` plus `start` in one command, and its argument order is
load-bearing.** Getting the shape into muscle memory removes an entire class of
"why did it ignore my flag" confusion.

## The shape

```
docker run [OPTIONS] IMAGE [COMMAND] [ARG...]
           ▲          ▲     ▲
           │          │     └── passed to the process INSIDE the container
           │          └──────── what to run
           └─────────────────── flags for the ENGINE
```

The rule that follows, and it is the one people trip on:

> **Everything before the image name is for Docker. Everything after it is for
> the process inside.**

```bash
# -e is Docker's: it sets an environment variable
docker run -e LOG_LEVEL=debug myapp

# --verbose is the APPLICATION's: Docker passes it straight through
docker run myapp --verbose

# Both, and the order is not optional
docker run -e LOG_LEVEL=debug myapp --verbose
```

Write `docker run myapp -e LOG_LEVEL=debug` and Docker hands
`-e LOG_LEVEL=debug` to your program as command-line arguments. There is no
error, no warning — the variable is simply never set, and you debug the wrong
thing for twenty minutes.

## What `run` actually does

It is a composite. Each step can be observed and each can fail differently:

| Step | Equivalent command | Fails when |
|---|---|---|
| 1. Resolve the image | `docker pull` if not local | Image missing, auth, rate limit, wrong platform |
| 2. Create the container | `docker create` | Bad flag, port conflict, missing volume |
| 3. Start it | `docker start` | The entrypoint does not exist or is not executable |
| 4. Attach (unless `-d`) | `docker attach` | — |

Splitting them is a genuine debugging technique: `docker create` then
`docker start` tells you which half is failing, and lets you inspect the
configured container before anything runs.

## The flags you will actually type

| Flag | Effect |
|---|---|
| `-d`, `--detach` | Run in the background and print the container ID |
| `--rm` | Remove the container **and its anonymous volumes** when it exits |
| `--name` | A stable name instead of a random one |
| `-p`, `--publish` | Publish a container port to the host |
| `-e`, `--env` / `--env-file` | Set environment variables |
| `-it` | Interactive with a TTY — for shells |
| `-v` / `--mount` | Volumes and bind mounts (Phase 6) |
| `--network` | Which network to join (Phase 7) |
| `--entrypoint` | Override the image's entrypoint |
| `-w`, `--workdir` | Working directory inside |
| `-u`, `--user` | UID/GID to run as |
| `--restart` | Restart policy |

The four you will type most: `-d`, `--rm`, `--name`, `-p`.

## Two idioms worth memorising

**The throwaway shell** — inspect an image without leaving anything behind:

```bash
docker run --rm -it alpine sh
docker run --rm -it --entrypoint sh myorg/api:1.4.2
```

The second form is for images whose entrypoint is a binary; without
`--entrypoint` you would be passing `sh` as an *argument* to that binary. Page 11
covers this properly.

**The long-lived service** — named, detached, restarting, published:

```bash
docker run -d --name api \
  --restart=unless-stopped \
  -p 127.0.0.1:8080:3000 \
  --env-file ./api.env \
  myorg/api:1.4.2
```

Note `127.0.0.1:8080` rather than `8080`. Binding to a specific interface is the
difference between "reachable from my laptop" and "reachable from the internet";
page 05 makes the case.

## Podman

`podman run` takes the same flags for everything on this page. The differences
appear at the edges — privileged ports rootless, restart policies without a
daemon — and are covered where they arise (Phase 7 and Phase 11). For the anatomy
itself, `alias docker=podman` genuinely works.

## Gotchas

**Symptom:** A flag after the image name is "ignored".
**Cause:** It was not ignored; it was passed to your application as an argument.
**Fix:** Move it before the image name. Everything after the image belongs to the
process inside.

**Symptom:** `docker run` on an existing container name fails with a conflict.
**Cause:** `run` always creates a **new** container. The old one still exists,
possibly stopped.
**Fix:** `docker start <name>` to restart the existing one, or `docker rm` it
first. `--rm` avoids accumulating them in the first place.

**Symptom:** Disk fills with stopped containers nobody remembers creating.
**Cause:** Every `docker run` without `--rm` leaves a container behind after it
exits.
**Fix:** `--rm` for anything one-shot. `docker ps -a` to see the accumulation,
`docker container prune` to clear it. Page 13.

**Symptom:** `docker run --rm -d` and the container's data vanished with it.
**Cause:** `--rm` also removes **anonymous volumes** the container created.
**Fix:** Use a **named** volume for anything that must survive. Anonymous volumes
and `--rm` are a deliberate pairing for throwaway work. Phase 6.

## Interview questions

**★ What does `docker run` do that `docker start` does not?**
`run` resolves the image, **creates a new container** from it, and starts it.
`start` starts a container that already exists, keeping the writable layer and
the configuration it was created with. `run` twice gives you two containers.

**★ Why does `docker run myapp -e FOO=bar` not set an environment variable?**
Because everything after the image name is passed to the process inside the
container. Docker never sees the flag; your application receives `-e` and
`FOO=bar` as arguments.

**★ What does `--rm` remove?**
The container and its **anonymous** volumes, when the process exits. Named
volumes and bind mounts are untouched, which is exactly why durable data belongs
on a named volume.

**How would you debug a container that fails immediately on start?**
Split `run` into `create` and `start`: if `create` succeeds and `start` fails,
the problem is the entrypoint or the image's process, not the flags. Then check
`docker logs`, and the exit code — page 09 maps the common ones.

**Why publish to `127.0.0.1:8080` instead of `8080`?**
`-p 8080:3000` binds all interfaces, so the port is reachable from the network
and, on many setups, past the host firewall. `-p 127.0.0.1:8080:3000` binds
loopback only. For a database or an admin port, that difference is the whole
security posture.

---

← Index: [Phase 1](README.md) · Next → [Foreground, detached and cleanup](02-detached-and-cleanup.md)
