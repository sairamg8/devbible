---
title: "user, workdir, hostname and add-host"
sidebar_label: "14 · user, workdir, hostname"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against [docker container run](https://docs.docker.com/reference/cli/docker/container/run/),
> [Dockerfile USER](https://docs.docker.com/reference/dockerfile/#user),
> [Dockerfile WORKDIR](https://docs.docker.com/reference/dockerfile/#workdir) and
> [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html).
> **No sandbox** — no console output on this page.

**Four small flags that override image defaults at run time.** None is
complicated; each solves a specific recurring annoyance, and `--user` in
particular is the one you will reach for constantly.

## `--user` / `-u`

Runs the process as a different user, overriding the image's `USER`.

```bash
docker run -u 1000:1000 myimage          # UID:GID - the reliable form
docker run -u node myimage               # by name, if it exists in the image
docker exec -u root api apk add curl     # root for one debugging command
docker run -u $(id -u):$(id -g) -v $PWD:/app myimage   # own files as yourself
```

Three things worth knowing:

- **Numeric IDs always work; names may not.** The name must exist in the
  container's `/etc/passwd`. A UID that has no entry there is fine — the process
  runs, and tools that look up the name simply report the number.
- **It does not change file ownership.** Files already in the image keep their
  owners, so a process switched to UID 1000 may not be able to write where the
  image expected root to write.
- **The `$(id -u):$(id -g)` form is the standard fix** for bind mounts in
  development on Linux: files created inside the container end up owned by you
  rather than by root. Phase 6.

## `--workdir` / `-w`

Sets the working directory for the process, overriding the image's `WORKDIR`.

```bash
docker run -w /app myimage npm test
docker run -w /tmp --rm -it alpine pwd
```

The directory is **created if it does not exist**, which is convenient and
occasionally hides a typo — a mistyped path silently gives you an empty
directory rather than an error.

## `--hostname` / `-h`

Sets the container's hostname (the UTS namespace, Phase 0 page 02). By default
the engine uses the container ID, which makes logs unreadable.

```bash
docker run -h api-01 myimage
```

⚠️ **The hostname is not a DNS name for other containers.** Setting `--hostname
api-01` does not let another container resolve `api-01`. Container-to-container
DNS uses the **container name** or the Compose **service name**, on a
user-defined network. Phase 7.

Prefer logging a service name you control over depending on the hostname; it
survives moving to an orchestrator, where hostnames are generated.

## `--add-host`

Adds an entry to the container's `/etc/hosts`.

```bash
docker run --add-host db.internal:10.0.0.5 myimage
docker run --add-host host.docker.internal:host-gateway myimage
```

The second form is the useful one on **Linux**, where
`host.docker.internal` does not exist by default: `host-gateway` is a special
value that resolves to the host. On Docker Desktop (macOS/Windows) the name is
already provided. Podman's equivalent is `host.containers.internal`.

Use it for reaching a service that runs on the host during development, or for
pinning a name to an IP without touching DNS. It is a development tool — in
production, use real DNS or the container network.

## Podman

All four flags exist and behave the same. Two differences:

- `--user` interacts with the **user namespace**: under rootless Podman, UID 1000
  inside is not UID 1000 on the host. `--userns=keep-id` is usually what you
  actually want for bind mounts. Phase 6 and Phase 11.
- The host-gateway name is **`host.containers.internal`**, and Podman generally
  provides it without needing `--add-host`.

## Gotchas

**Symptom:** `--user 1000` and the container cannot write to its own working
directory.
**Cause:** The directory is owned by root in the image, and you switched to a
user without write access.
**Fix:** `chown` the directory in the Dockerfile to the UID that will run, or
mount a volume with the right ownership. Overriding the user at run time does not
retroactively change the image's file ownership.

**Symptom:** `docker run -u myuser` fails with "unable to find user".
**Cause:** The name does not exist in the image's `/etc/passwd`.
**Fix:** Use the numeric UID. It always works, even when the name is absent.

**Symptom:** Another container cannot resolve the hostname you set with `-h`.
**Cause:** `--hostname` sets the container's own hostname only; it publishes
nothing to DNS.
**Fix:** Use the container name on a user-defined network, or a Compose service
name. Phase 7.

**Symptom:** `host.docker.internal` does not resolve on a Linux host.
**Cause:** It is provided by Docker Desktop, not by Docker Engine on Linux.
**Fix:** `--add-host host.docker.internal:host-gateway`, or under Podman use
`host.containers.internal`.

## Interview questions

**★ How do you avoid root-owned files when bind-mounting your source directory
in development?**
Run as your own UID and GID: `-u $(id -u):$(id -g)`. Under rootless Podman,
`--userns=keep-id` achieves the same thing by mapping your host UID into the
container.

**★ Does `--hostname` make a container resolvable by that name?**
No. It sets the container's own hostname in its UTS namespace. Other containers
resolve each other by container name or Compose service name on a user-defined
network.

**How do you reach a service running on the host from inside a container on
Linux?**
`--add-host host.docker.internal:host-gateway`, then use that name. Docker
Desktop provides the name already; Podman's equivalent is
`host.containers.internal`.

**Why prefer a numeric UID over a username with `--user`?**
The username has to exist in the container's `/etc/passwd`; a UID never has to.
Numeric IDs work in every image, including minimal ones with no user database.

---

← Prev: [Reclaiming disk space](13-reclaiming-disk.md) · Index: [Phase 1](README.md) · Next → [docker cp](15-docker-cp.md)
