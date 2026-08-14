---
title: "docker cp — and when it is a smell"
sidebar_label: "15 · docker cp"
sidebar_position: 15
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against [docker container cp](https://docs.docker.com/reference/cli/docker/container/cp/)
> and [podman-cp(1)](https://docs.podman.io/en/latest/markdown/podman-cp.1.html).
> **No sandbox** — no console output on this page.

**`docker cp` copies files between the host and a container's filesystem.** It is
genuinely useful for getting evidence out of a container, and a design smell
whenever it is part of how something normally runs.

## The syntax

```bash
docker cp ./local.conf  api:/etc/app/local.conf     # host → container
docker cp api:/app/logs/error.log ./error.log       # container → host
docker cp api:/app/. ./app-snapshot/                # a whole directory
docker cp - api:/app < archive.tar                  # a tar stream in
```

The container side is always `container:path`. Either side may be the source.
It works on **stopped** containers too, which is what makes it valuable for
post-mortems.

## What it is good for

- **Getting evidence out of a dead container** — a crash dump, a log file, a
  half-written output — before you `docker rm` it. This is the strongest use, and
  it works on an exited container when `exec` cannot.
- **Pulling out a build artefact** from a container you ran deliberately.
- **Dropping a debugging tool in**, when the image is minimal and the network is
  restricted.
- **Taking a snapshot of a directory** for comparison.

```bash
# The post-mortem sequence
docker ps -a                                  # find the exited container
docker cp dead-api:/app/logs ./crash-logs/    # rescue the evidence
docker logs dead-api > ./crash-stdout.txt
docker rm dead-api
```

## Why it is a smell in normal operation

If `docker cp` appears in a deploy script, a Makefile target that runs every
time, or a set of written instructions for teammates, something is misplaced:

| What is being copied | Where it belongs instead |
|---|---|
| Application code | In the **image** (`COPY` in the Dockerfile) |
| Configuration | A **mounted file**, or environment variables |
| Data the app writes | A **volume** |
| Build output | A **multi-stage build**, or a volume |
| Secrets | A secret manager, or a mounted file |

The reason is not aesthetic. A file copied in with `docker cp` lives in the
container's writable layer, so it:

- disappears when the container is replaced — every deploy, every `compose up
  --build`,
- is invisible to anyone reading the Dockerfile or Compose file,
- and exists on exactly one container, so a second replica behaves differently.

That last point is the one that turns into an incident: a fix applied by hand to
one container, and a load balancer sending half the traffic to the one without
it.

## Ownership and permissions

`docker cp` preserves permission bits but **not** user names, and the UID it
writes as may not match what the container's process expects — especially with a
non-root `USER` or under rootless Podman's UID mapping.

```bash
docker cp ./file api:/app/file
docker exec -u root api chown appuser:appuser /app/file
```

Expect to fix ownership afterwards more often than not.

## Podman

`podman cp` matches `docker cp`, including the stopped-container behaviour. Under
rootless Podman the UID mapping applies, so a file copied in as your user appears
owned by whatever that maps to inside — check with `podman exec ls -l` rather
than assuming. Phase 11.

## Gotchas

**Symptom:** A file copied in with `docker cp` vanished after a redeploy.
**Cause:** It was in the writable layer, and the container was replaced.
**Fix:** Put it in the image or mount it. `cp` is not a persistence mechanism.

**Symptom:** The application cannot read a file you copied in.
**Cause:** Ownership — the file belongs to a UID the process does not run as.
**Fix:** `docker exec -u root <c> chown …` afterwards, or mount the file instead
so ownership is under your control.

**Symptom:** `docker cp` into a path that is a **volume** appears to work but the
data is not where you expected.
**Cause:** You wrote into the mounted volume, not the image's directory — which
may be exactly right, or exactly wrong, depending on what you meant.
**Fix:** Check `docker inspect --format '{{json .Mounts}}'` first so you know
which side of the mount you are writing to.

**Symptom:** Copying a large directory is slow.
**Cause:** It streams through the engine as a tar archive.
**Fix:** For anything large or repeated, use a volume or a bind mount. `cp` is
for one-off transfers.

## Interview questions

**★ When is `docker cp` the right tool?**
Getting evidence out of a container after a failure — logs, dumps, partial output
— including from a **stopped** container, where `exec` will not work. It is a
diagnostic tool.

**★ Why is `docker cp` a smell in a deploy script?**
Because whatever it copies lives only in that container's writable layer: it
disappears on replacement, is invisible in the Dockerfile and Compose file, and
applies to one replica only. Code belongs in the image, config in a mount or
environment, data on a volume.

**Does `docker cp` work on a stopped container?**
Yes — and that is much of its value. `docker exec` needs a running process;
`docker cp` reads and writes the filesystem directly.

**A file copied in is unreadable by the application. Why?**
Ownership. `cp` preserves permission bits but the UID it writes as often does not
match the non-root user the process runs as — and under rootless Podman the user
namespace remaps it again. Fix with `chown`, or mount the file instead.

---

← Prev: [user, workdir, hostname and add-host](14-user-workdir-hostname.md) · Index: [Phase 1](README.md) · Next → [attach versus logs -f](16-attach-vs-logs.md)
