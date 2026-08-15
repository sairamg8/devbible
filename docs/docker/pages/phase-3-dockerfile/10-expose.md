---
title: "EXPOSE publishes nothing"
sidebar_label: "10 · EXPOSE"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the [Dockerfile reference — EXPOSE](https://docs.docker.com/reference/dockerfile/#expose),
> [docker container run — publish](https://docs.docker.com/reference/cli/docker/container/run/) and
> [Docker — networking overview](https://docs.docker.com/engine/network/).
> **No sandbox** — no console output on this page.

**`EXPOSE` is documentation.** It records which port the image intends to listen
on. It opens nothing, maps nothing, and its absence prevents nothing.

## What it does and does not do

```dockerfile
EXPOSE 3000
EXPOSE 3000/tcp 53/udp
```

**Does:**

- Record the port in the image config's `ExposedPorts`
  ([Phase 2, page 07](../phase-2-images-and-registries/07-image-config.md)).
- Tell a human reading the Dockerfile which port the service uses.
- Give `docker run -P` (capital P) the list of ports to publish to **random**
  host ports.

**Does not:**

- Publish anything.
- Open a firewall.
- Restrict anything — a container listening on a port you never `EXPOSE`d is
  perfectly reachable from other containers on the same network.

## The two ways a port becomes reachable

| Who is connecting | What is needed |
|---|---|
| **Another container** on the same user-defined network | **Nothing.** Container-to-container traffic needs no publishing at all |
| **The host, or the outside world** | `-p` at run time, or `ports:` in Compose |

This is the point people miss for months: your API reaches `postgres:5432`
without any `EXPOSE` and without any `-p`, because they share a network
([Phase 1, page 05](../phase-1-running-containers/05-publishing-ports.md)).
Publishing is only for traffic entering from outside the container network.

## Why keep it, then

Three modest but real reasons:

1. **Documentation that travels with the image.** `docker image inspect` tells a
   stranger which port to publish without reading your Dockerfile or your README.
2. **`-P` works.** `docker run -P` publishes every exposed port to a random host
   port — occasionally handy for throwaway testing.
3. **Tooling reads it.** Some platforms and Compose-adjacent tools use it as a
   default hint.

It costs one line and misleads nobody who knows what it means. Keep it, and make
sure it matches the port the application actually binds.

## `-p` versus `-P`

```bash
docker run -p 8080:3000 myimage      # explicit: host 8080 → container 3000
docker run -P myimage                # every EXPOSEd port → a random host port
docker port <container>              # what actually got mapped
```

`-P` is unpredictable by design, so it is a testing convenience, never a
deployment strategy.

## Podman

Identical: `EXPOSE` is metadata, `-p` publishes, `-P` publishes exposed ports to
random host ports. The rootless privileged-port restriction applies to `-p`, not
to `EXPOSE` — because `EXPOSE` does nothing to restrict.

## Gotchas

**Symptom:** `EXPOSE 3000` is in the Dockerfile and the port is unreachable from
the host.
**Cause:** `EXPOSE` publishes nothing.
**Fix:** `-p 3000:3000`, or `ports:` in Compose.

**Symptom:** A port not listed in `EXPOSE` is reachable from another container.
**Cause:** `EXPOSE` restricts nothing. Containers on the same network reach any
port the process is listening on.
**Fix:** Nothing to fix — but if a port must not be reachable, that is a network
segmentation question (Phase 7), not an `EXPOSE` one.

**Symptom:** `docker run -P` published a port you did not expect.
**Cause:** It publishes every port the image exposes, including ones inherited
from the base image.
**Fix:** Use explicit `-p`. Check inherited ports with
`docker image inspect --format '{{json .Config.ExposedPorts}}'`.

**Symptom:** The exposed port and the port the app binds have drifted apart.
**Cause:** `EXPOSE` is not checked against reality by anything.
**Fix:** Treat it as documentation that needs maintaining. A stale `EXPOSE` is
worse than none, because it is believed.

## Interview questions

**★ What does `EXPOSE` do?**
Records the intended port in the image config. It publishes nothing and restricts
nothing. Only `-p`/`-P` at run time, or `ports:` in Compose, makes a port
reachable from the host.

**★ Do two containers need `EXPOSE` to talk to each other?**
No. On a shared user-defined network they reach each other by name on the
container port, with no `EXPOSE` and no publishing. Publishing is for traffic
from outside the container network.

**★ If it does nothing, why write it?**
It documents the port in the image itself, so `docker image inspect` answers
"which port?" without the Dockerfile; it makes `docker run -P` work; and some
tooling reads it as a hint. One line, no harm — provided it stays accurate.

**What is the difference between `-p` and `-P`?**
`-p` maps a specific host port to a specific container port. `-P` publishes every
`EXPOSE`d port to randomly chosen host ports — useful for throwaway testing,
never for deployment.

---

← Prev: [USER](09-user.md) · Index: [Phase 3](README.md) · Next → [HEALTHCHECK](11-healthcheck.md)
