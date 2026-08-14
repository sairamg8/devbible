---
title: "Foreground, detached and cleanup"
sidebar_label: "02 · Detached and cleanup"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [docker container run](https://docs.docker.com/reference/cli/docker/container/run/),
> [docker container ls](https://docs.docker.com/reference/cli/docker/container/ls/) and
> [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html).
> **No sandbox** — no console output on this page.

**A container runs in the foreground by default, tied to your terminal. `-d`
detaches it. `--rm` deletes it when it exits. `--name` gives it an identity you
can type.** Four small decisions that determine whether your machine stays
comprehensible after a week.

## Foreground: the default

Without `-d`, the CLI attaches to the container's output and stays in front of
you. Your terminal is occupied and, for most images, `Ctrl-C` sends `SIGINT` to
the process and stops it.

This is right for:

- one-shot commands (`docker run --rm alpine date`)
- interactive shells (`docker run --rm -it alpine sh`)
- watching a service start for the first time, when you want the logs immediately

## Detached: `-d`

`-d` starts the container in the background and prints its ID. The container
outlives your terminal, your SSH session and your logout.

```bash
docker run -d --name api myorg/api:1.4.2
docker logs -f api        # the output you would have seen in the foreground
```

**Detached is not "quiet"** — the output still exists; you just fetch it with
`logs` instead of watching it live. If a detached container exits immediately,
`docker logs <name>` is the first thing to run, not the last.

## `--rm`: delete on exit

Without it, every container you run persists after exiting, holding its writable
layer and its entry in `docker ps -a` forever. A month of experiments becomes
hundreds of dead containers and gigabytes of layers.

```bash
docker run --rm alpine echo hello       # gone the moment it finishes
docker run --rm -it alpine sh           # the throwaway shell
```

Two things `--rm` does that catch people:

- It removes **anonymous volumes** the container created. Named volumes and bind
  mounts survive.
- It applies on exit, however that happens — including a crash. There is no
  corpse left to inspect, which is a real cost when you are debugging.

> **The rule of thumb:** `--rm` for anything you are running *now* to see
> something. No `--rm` for anything you might need to autopsy, and a named
> volume for anything whose data matters.

## `--name`: an identity

Without `--name`, the engine generates something like `dazzling_hopper`. It works
until you have four containers and cannot remember which is which.

```bash
docker run -d --name api myorg/api:1.4.2
docker logs api ; docker exec -it api sh ; docker stop api
```

Names are **unique among existing containers**, including stopped ones — which
is the source of "the name is already in use" when you thought you had removed
it. `docker ps -a | grep api` finds the corpse; `docker rm api` clears it.

Under Compose, names are generated from the project and service name and you
rarely set them by hand — one more reason Compose is calmer than raw `run`.

## Seeing what exists

```bash
docker ps                 # running only
docker ps -a              # every container, including exited
docker ps -s              # add the writable-layer size
docker ps --filter status=exited --filter name=api
docker ps -q              # IDs only, for scripting
```

`docker ps` showing nothing while your app is unreachable means the container
**exited** — `docker ps -a` will show it, with its exit code. That two-command
sequence is the start of most container triage.

## Cleaning up

```bash
docker rm api                        # one, must be stopped
docker rm -f api                     # stop and remove in one step
docker container prune               # every stopped container
docker rm $(docker ps -aq)           # scripted equivalent
```

⚠️ `docker rm -f` sends `SIGKILL` immediately rather than the polite `SIGTERM`
first. For a database, that is an unclean shutdown. Prefer `docker stop` and then
`docker rm` for anything with state — page 08 explains the two signals.

## Podman

Identical for everything here. One difference worth knowing early: because there
is no daemon, a detached rootless container is still tied to your **user
session** unless lingering is enabled — `loginctl enable-linger $USER`. `-d`
survives your terminal; it does not automatically survive a reboot. Phase 11.

## Gotchas

**Symptom:** `docker run -d` returns an ID, but `docker ps` shows nothing.
**Cause:** The container started and exited immediately.
**Fix:** `docker ps -a` to see it and its exit code, then `docker logs <id>`.
The commonest cause is a foreground process that had nothing to do — page 07.

**Symptom:** "The container name is already in use" after you removed it.
**Cause:** A *stopped* container still holds the name.
**Fix:** `docker ps -a` to find it, `docker rm` to release the name. `--rm`
prevents the situation entirely for throwaway runs.

**Symptom:** `Ctrl-C` kills a container you only wanted to stop watching.
**Cause:** In the foreground, `Ctrl-C` signals the container's process.
**Fix:** Run detached and use `docker logs -f`, which you can leave freely. The
detach key sequence exists too — page 16.

**Symptom:** Disk space is gone and `docker ps` looks empty.
**Cause:** Stopped containers, their writable layers, dangling images and build
cache.
**Fix:** `docker system df` to see the split, then the specific prune. Page 13,
including the flag that also deletes volumes.

## Interview questions

**★ What is the difference between running a container in the foreground and
detached?**
Foreground attaches your terminal to the container's output and, for most
images, forwards `Ctrl-C` to the process. `-d` starts it in the background and
prints the ID; the output is still there, retrieved with `docker logs`.

**★ What does `--rm` do, and when should you not use it?**
It removes the container and its anonymous volumes on exit. Do not use it when
you may need to inspect the container after a failure — it removes the evidence
along with the container.

**★ A container was started detached and is not reachable. What are your first
two commands?**
`docker ps -a` to see whether it is running or exited and with what code, then
`docker logs <name>`. If it exited immediately, the answer is almost always in
those two outputs.

**Why does a container name conflict persist after the container stopped?**
Names are unique across all existing containers, not just running ones. A
stopped container still owns its name until it is removed.

**Is `docker rm -f` safe for a database container?**
No — it sends `SIGKILL` with no grace period, so the process cannot flush or
close cleanly. Use `docker stop` (which sends `SIGTERM` first) and then
`docker rm`.

---

← Prev: [The anatomy of docker run](01-docker-run-anatomy.md) · Index: [Phase 1](README.md) · Next → [ps, inspect, logs, stats](03-ps-inspect-logs-stats.md)
