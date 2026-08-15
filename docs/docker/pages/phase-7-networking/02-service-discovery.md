---
title: "Service discovery"
sidebar_label: "02 · Service discovery"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [Docker — networking overview (DNS services)](https://docs.docker.com/engine/network/),
> [Docker — bridge network driver](https://docs.docker.com/engine/network/drivers/bridge/),
> [docker network connect](https://docs.docker.com/reference/cli/docker/network/connect/) and
> [Podman — podman-network-create](https://docs.podman.io/en/latest/markdown/podman-network-create.1.html).
> **No sandbox** — no console output on this page.

**On a user-defined network, one container reaches another by name, on the
container's own port, with nothing published.** Not the host's IP. Not a
published port. Not `localhost`. The name of the container, and the port the
process is actually listening on — and understanding why is what makes the whole
phase click.

## The mechanism

Docker runs an **embedded DNS server** for containers on user-defined networks.
From the reference:

> *"The embedded DNS server address is `127.0.0.11`"*

Every container on such a network gets a `/etc/resolv.conf` pointing at that
address inside its own network namespace. The resolver answers for container
names and network aliases on the networks the asking container is attached to,
and

> *"forwards external DNS lookups to the DNS servers configured on the host"*

so `api.github.com` still resolves normally. One resolver, two behaviours: local
names answered locally, everything else forwarded.

⚠️ **`127.0.0.11` is inside the container's namespace**, not something you can
reach from the host or from a container on a different network. Seeing it in
`/etc/resolv.conf` is the quickest confirmation that a container is on a
user-defined network at all — on the default bridge, containers instead
*"receive a copy of"* the host's `/etc/resolv.conf` and have no name resolution
between them.

## The port is the container's port

This is the half that trips people up more than the name.

```yaml
services:
  api:
    image: myapi:1.4
    ports:
      - "8080:3000"          # host 8080 → container 3000
    environment:
      DATABASE_URL: postgres://user:pass@db:5432/app
  db:
    image: postgres:17       # no "ports:" at all
```

- The browser reaches the API at `localhost:8080` — the **published** port.
- The API reaches the database at `db:5432` — the **container's** port.
- Postgres publishes nothing, and is reachable by every service on the network
  and by nothing outside the host.

> *"containers can communicate with each other using container IP addresses or
> container names"* — with no port publishing involved.

**Publishing is for traffic from outside the host. It has nothing to do with
container-to-container traffic.** If you have ever added `ports: - "5432:5432"`
to a database service to "let the API reach it", that line did not help the API
— it exposed your database to the host's network, and the API was already able
to connect.

The mirror-image mistake is just as common: using the *published* port between
containers — `db:15432` because the host maps 15432 → 5432. Inside the network
the mapping does not exist; only 5432 does.

## What names resolve

| Name | Resolves on a user-defined network |
|---|---|
| **Container name** (`--name db`) | ✅ |
| **Network alias** (`--network-alias primary`) | ✅ |
| **Compose service name** (`db`) | ✅ — Compose sets it as an alias |
| **Container ID**, short or long | ✅ |
| **Hostname** set with `--hostname` | ⚠️ only inside the container itself |
| A container on a *different* network | ❌ |
| A container on the **default** bridge | ❌ — no resolution there at all |

**Aliases** are the useful one people forget. A container can answer to several
names, and several containers can share one alias — in which case the resolver
returns all their addresses, giving crude round-robin:

```bash
docker network create appnet
docker run -d --name db1 --network appnet --network-alias db postgres:17
docker run -d --name db2 --network appnet --network-alias db postgres:17
docker network connect --alias legacy-db appnet api
```

That last form — `network connect --alias` — is how you add an alias to an
already-running container, which matters during a rename: point the old name at
the new container and nothing has to be redeployed at once.

⚠️ **Round-robin DNS is not load balancing.** Clients cache, connection pools
hold one address for their lifetime, and there is no health awareness — an
unhealthy container keeps being returned. It is fine for "two replicas of a
stateless thing"; it is not a substitute for a proxy.

## Aliases in Compose

```yaml
services:
  db:
    image: postgres:17
    networks:
      backend:
        aliases:
          - primary-db
          - postgres          # the name an old config file expects

networks:
  backend:
```

`db`, `primary-db` and `postgres` now all resolve to the same container. This is
the clean way to keep a legacy hostname working while renaming a service.

## When resolution fails, in order of likelihood

1. **They are not on the same network.** The single most common cause.
   `docker network inspect <net>` lists what is actually attached.
2. **The name is wrong.** Compose resolves the **service** name, not the
   container name — which by default is `<project>_<service>_1` or similar. Both
   work, but only one is the one you meant.
3. **They are on the default bridge**, where there is no resolution.
4. **The service is not listening on the interface you think.** A process bound
   to `127.0.0.1` inside the container is unreachable from any other container,
   even with perfect DNS — page 03.
5. **The target container is not running.** DNS answers only for running
   containers; a crashed database is an `ENOTFOUND`, not a connection refused,
   which sends people to the wrong page of the manual.

```bash
docker network inspect appnet --format '{{range .Containers}}{{.Name}} {{.IPv4Address}}{{"\n"}}{{end}}'
docker exec -it api getent hosts db      # ask from inside the container
docker exec -it api cat /etc/resolv.conf
```

**Always ask from inside the container.** A lookup performed on the host proves
nothing about what the container's resolver will do; page 11 makes a procedure
of it.

## Custom DNS, when you need it

```bash
docker run --dns 10.0.0.53 --dns-search corp.example.com --dns-opt ndots:2 myapp
```

The reference lists all three: `--dns` for server addresses, `--dns-search` for
search domains applied to unqualified names, `--dns-opt` for resolver options.
Container-name resolution still works — these change what happens to the
*forwarded* lookups, which is what you want when a container has to resolve
internal corporate hostnames.

## Podman

Name resolution is provided by **`aardvark-dns`** rather than an embedded server
in the engine, and it is enabled by default on a network you **create**
(`podman network create` carries a `--disable-dns` flag precisely because DNS is
otherwise on). ⚠️ **The default `podman` network is the exception** — its
documentation states it *"does not support dns resolution because of backwards
compatibility with Docker"*, so the rule matches Docker's exactly: the default
network has no names. Aliases work the same way (`--network-alias`), and
`podman network inspect` reports the same information.

The extra concept is the **pod**: containers in a pod share one network
namespace, so they reach each other on `localhost` and cannot each bind the same
port. That is a genuinely different model from "two containers on a network" and
it is collected in Phase 11. Page 12 covers `netavark` and `aardvark-dns` in
detail, including which error message comes from which component.

## Gotchas

**Symptom:** `ENOTFOUND db` even though the database container is running.
**Cause:** They are on different networks — or one of them is on the default
bridge.
**Fix:** `docker network inspect` both, and attach them to the same
user-defined network. This is the first thing to check, every time.

**Symptom:** Connecting to `db:15432` because the host maps 15432 → 5432.
**Cause:** The host port mapping does not exist inside the network.
**Fix:** Use the container's own port, 5432. Published ports are for traffic
from outside the host.

**Symptom:** Someone added `ports: - "5432:5432"` to the database "so the API
can reach it", and now the database is reachable from the office network.
**Cause:** Publishing has nothing to do with container-to-container traffic; the
API could already connect.
**Fix:** Remove the mapping. If a human needs access, bind it to loopback —
`127.0.0.1:5432:5432` (page 04).

**Symptom:** Two containers share an alias and traffic all lands on one of them.
**Cause:** Round-robin DNS with client-side caching and long-lived connection
pools.
**Fix:** Put a proxy in front if you need real balancing. DNS aliases distribute
*lookups*, not connections.

## Interview questions

**★ How does one container find another?**
By name, resolved by the embedded DNS server at `127.0.0.11` inside the
container's network namespace, which answers for container names and network
aliases on the user-defined networks that container is attached to and forwards
everything else to the host's DNS. On the default bridge there is no such
resolution — containers can only reach each other by IP.

**★ Which port do you connect to, and does the target need to publish it?**
The container's own port, and no. Publishing maps a host port to a container
port for traffic arriving from outside the host; containers on the same network
talk directly to the container port. A database with no `ports:` entry is
reachable by every service on its network and by nothing outside the host, which
is exactly the right posture.

**★ Someone adds `ports: "5432:5432"` to a database service so the API can
reach it. What do you say?**
That it does not help and it does harm. The API reaches `db:5432` over the
shared network regardless; the mapping only exposes the database on the host's
interfaces. If a human needs a psql session, bind it to loopback with
`127.0.0.1:5432:5432` so it is not reachable from the network.

**What are network aliases for?**
Additional DNS names for a container on a network — a legacy hostname kept alive
during a rename, or a role name like `primary-db` that is independent of the
container's own. `docker network connect --alias` adds one to a running
container. Several containers may share an alias, in which case the resolver
returns all their addresses.

**Is that shared alias load balancing?**
No. It distributes DNS answers, not connections: clients cache, connection pools
pin one address for their lifetime, and there is no health checking, so an
unhealthy container keeps being handed out. Use a proxy when you need real
balancing.

**Where do you look first when name resolution fails?**
`docker network inspect` on the network, to confirm both containers are actually
attached — that is the usual answer. Then `getent hosts <name>` and
`cat /etc/resolv.conf` from *inside* the container, because a lookup on the host
proves nothing about the container's resolver.

---

← Prev: [The default bridge vs a user-defined bridge](01-default-vs-user-defined-bridge.md) · Index: [Phase 7](README.md) · Next → [`localhost` inside a container is the container](03-localhost-is-the-container.md)
