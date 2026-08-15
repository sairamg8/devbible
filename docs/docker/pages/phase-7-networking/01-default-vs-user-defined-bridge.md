---
title: "The default bridge vs a user-defined bridge"
sidebar_label: "01 · Default vs user-defined bridge"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [Docker — bridge network driver](https://docs.docker.com/engine/network/drivers/bridge/),
> [Docker — networking overview](https://docs.docker.com/engine/network/),
> [docker network create](https://docs.docker.com/reference/cli/docker/network/create/) and
> [Podman — podman-network-create](https://docs.podman.io/en/latest/markdown/podman-network-create.1.html).
> **No sandbox** — no console output on this page.

**Two containers started with plain `docker run` can reach each other by IP and
not by name. Two containers on a network you created can reach each other by
name.** That single difference is why every Compose project works out of the box
and why the same services started by hand do not — and Docker's own
documentation is unusually blunt about which one you should be using.

## The two bridges

Every Docker install has a network called `bridge`, backed by a host interface
conventionally named `docker0`. **A container that names no network joins it.**

A *user-defined* bridge is one you create:

```bash
docker network create appnet
docker run -d --name db  --network appnet postgres:17
docker run -d --name api --network appnet myapi:1.4
```

Both are the `bridge` driver. Both give containers a private subnet, an IP each,
and NAT to the outside world. What separates them is what the engine does *for*
the containers on them.

## The four differences that matter

Docker's reference lists them, and the first is the one you feel daily.

**1. DNS resolution by container name.**

> *"User-defined bridges provide automatic DNS resolution between containers"*

On a user-defined network, an embedded DNS server resolves **container names and
network aliases** to their current IPs. `api` connecting to `db:5432` works, and
keeps working when `db` restarts with a different address.

On the default bridge, containers *"can only access each other by IP addresses
unless using the legacy `--link` option"*. IPs are assigned at start, change
between runs, and hard-coding them is how a working stack breaks on the next
reboot.

**2. Isolation.**

> *"User-defined bridges provide better isolation"*

Everything that names no network lands on the default bridge together — the
container you started to try something out, the database you forgot about, and
today's service, all able to reach each other. A user-defined network scopes
communication to the containers actually attached to it, which is the beginning
of segmentation: a `frontend` network and a `backend` network, with the database
only on the second.

**3. Attach and detach while running.**

> *"Containers can be attached and detached from user-defined networks on the
> fly"*

```bash
docker network connect othernet api
docker network disconnect othernet api
```

On the default bridge, changing a container's networking *"requires stopping and
recreating it with different network options"*. Page 06 uses this for the
one-container-on-two-networks pattern.

**4. Per-network configuration.**

> *"Each user-defined network creates a configurable bridge"*

Subnet, gateway, IPv6, MTU and driver options are set per network at creation
time. Changing the default bridge means editing the daemon configuration and
**restarting the Docker daemon**, which takes every container on the host with
it.

## What the documentation says to do

> *"The default `bridge` network is considered a legacy detail of Docker and is
> not recommended for production use."*

That is about as direct as reference documentation gets. **Create a network.
Always.** It is one command, and every property above improves.

`--link`, the old way of getting name resolution on the default bridge, is
legacy in the same breath: it injects environment variables and `/etc/hosts`
entries into the linked container, does not survive a restart of the target, and
is superseded by user-defined networks in every respect.

## Why Compose seems to have none of these problems

Because **Compose creates a user-defined bridge network per project and attaches
every service to it**, named `<project>_default`. Service names become DNS names
on it automatically.

```yaml
services:
  api:
    image: myapi:1.4
    environment:
      DATABASE_URL: postgres://user:pass@db:5432/app   # "db" is the service name
  db:
    image: postgres:17
```

No `network` key, no `--link`, and `db` resolves. When someone reports that
"Docker networking is confusing but Compose just works", this is the entire
mechanism — and it is why translating a Compose file back into `docker run`
commands breaks connectivity unless you remember to create the network first.

## Podman

Podman does the same thing with different defaults and a different
implementation, and one of those differences is a real gotcha:

| | Docker | Podman |
|---|---|---|
| Default network for a container that names none | `bridge` — **no name resolution** | `podman` — **DNS by name is available** via `aardvark-dns` |
| Creating one | `docker network create appnet` | `podman network create appnet` |
| Backend | libnetwork | **netavark** + **aardvark-dns** (page 12) |
| Rootless | ports and NAT via the daemon | a user-space stack — `pasta` (page 08) |

⚠️ **Podman's default network resolves names in situations where Docker's does
not**, so a command that works under Podman can fail under Docker for a reason
that has nothing to do with your application. The habit that is right on both:
**create a network and name it.**

Podman also has the concept of a **pod** — containers sharing one network
namespace, reaching each other on `localhost` — which is closer to Kubernetes
than to Docker and is collected in Phase 11.

## Inspecting what you actually have

```bash
docker network ls
docker network inspect appnet
docker inspect api --format '{{json .NetworkSettings.Networks}}'
```

`network inspect` lists the containers attached, with their IPs and aliases —
the first thing to look at when "the API cannot reach the database", because the
most common answer is that **they are not on the same network at all.** Page 11
turns that into a procedure.

## Gotchas

**Symptom:** `getaddrinfo ENOTFOUND db` from a container started with
`docker run`.
**Cause:** Both containers are on the default bridge, which has no name
resolution.
**Fix:** `docker network create appnet` and start both with
`--network appnet`. Do not reach for `--link`; it is legacy.

**Symptom:** It worked yesterday and today the API connects to the wrong thing,
or to nothing.
**Cause:** A hard-coded container IP. Addresses are assigned at start and are not
stable.
**Fix:** Use the container name on a user-defined network. If you truly need a
fixed address, set the subnet on the network and assign `--ip` deliberately
(page 13).

**Symptom:** A container you forgot about can reach your database.
**Cause:** Both are on the default bridge, which everything joins by default.
**Fix:** Put services on named networks scoped to what should talk to what —
the database on a `backend` network the frontend is not attached to.

**Symptom:** The same `podman run` commands fail when translated to `docker
run`.
**Cause:** Podman's default network provides name resolution and Docker's does
not.
**Fix:** Create and name a network explicitly. It is correct on both engines and
removes the difference entirely.

## Interview questions

**★ What does a user-defined bridge give you that the default bridge does
not?**
Automatic DNS resolution between containers by name — the default bridge has
none, and containers can only reach each other by IP unless you use the legacy
`--link`. Plus better isolation, since everything that names no network shares
the default bridge; the ability to attach and detach a running container; and
per-network configuration of subnet, gateway and IPv6 without restarting the
daemon.

**★ Why does Compose "just work" when the same containers started by hand do
not?**
Because Compose creates a user-defined bridge per project and attaches every
service to it, so service names are DNS names automatically. Hand-run containers
land on the default bridge, where there is no name resolution — so the identical
configuration fails on a hostname lookup.

**★ Is the default bridge ever the right choice?**
Docker's documentation calls it *"a legacy detail of Docker … not recommended
for production use"*, and there is no property on which it wins. Creating a
network costs one command and improves DNS, isolation, runtime attachment and
configurability at once.

**Why is hard-coding a container's IP address a bug even when it works?**
Because addresses are assigned at container start from the network's pool and
are not stable across restarts or recreation. The container name on a
user-defined network resolves to the current address every time, which is what
DNS is for.

**How is Podman different here?**
Its default network already provides name resolution, through `aardvark-dns`
rather than Docker's embedded DNS, so a command can work under Podman and fail
under Docker. Podman also has pods, where containers share a network namespace
and reach each other on `localhost`. The portable habit on both engines is to
create a named network.

---

← Index: [Phase 7](README.md) · Next → **Service discovery** *(not written yet)*
