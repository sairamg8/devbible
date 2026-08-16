---
title: "Networks in Compose"
sidebar_label: "07 · Networks"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against
> [Compose networking](https://docs.docker.com/compose/how-tos/networking/),
> [the top-level `networks` element](https://docs.docker.com/reference/compose-file/networks/)
> and [the `services` element](https://docs.docker.com/reference/compose-file/services/).
> **No sandbox** — no console output on this page.

**Compose gives you a working private network for free, and that single fact is
most of why people use it.** "By default, Compose sets up a single network for your
app. Each container for a service joins the default network and is both reachable
by other containers on that network, and discoverable by its service name."

No `links`, no IP addresses, no `/etc/hosts` editing, no published ports. Write
`postgres://db:5432/app` and it works.

## The default network

You do not declare it. Compose creates it, names it `<project-name>_default`, and
uses the bridge driver. Run `docker compose up` in a directory called `myapp` and
you get a network called `myapp_default`. "Services without an explicit `networks`
declaration are connected by Compose to this `default` network."

The project name is what namespaces it, which is why two checkouts of the same
project collide unless you set one ([page 09](09-project-name.md)).

## Service discovery, and the port that is not the published one

Containers reach each other "using the service name directly. No IP addresses or
manual configuration is needed" — an internal DNS server registers each service
name.

🔴 **The distinction that causes the most wasted time:** "The `HOST_PORT` and
`CONTAINER_PORT` serve different purposes." Given

```yaml
services:
  db:
    image: postgres:18
    ports:
      - "8001:5432"
```

- From your **laptop**: `localhost:8001`.
- From the **api container**: `db:5432` — the *container* port, and the published
  mapping is irrelevant to it.

"Networked service-to-service communication uses the `CONTAINER_PORT`." An API
configured with `DATABASE_URL=postgres://…@db:8001/app` fails, and the error looks
like a networking problem when it is a reading-the-file problem.

**And the corollary that shortens most compose files: you do not need `ports:` at
all for services to talk to each other.** Publishing exists for traffic entering
from outside — a browser, a `psql` on your laptop, a webhook. Every published port
is a hole in the host, bound to `0.0.0.0` by default
([page 04](04-services-block/02-how-it-is-wired.md)).

Two more facts from Phase 1 that apply unchanged: `localhost` inside a container is
the container itself, and `EXPOSE` publishes nothing and restricts nothing
([Phase 1, page 05](../phase-1-running-containers/05-publishing-ports.md),
[Phase 3, page 10](../phase-3-dockerfile/10-expose.md)).

## Names survive recreation, addresses do not

Worth knowing because it explains why the DNS approach is not merely convenient but
necessary:

> "the old container is removed and the new one joins the network under a different
> IP address but the same name"

Every `up` that changes a service gives that service a **new IP**. Anything that
cached an address is now wrong. Anything that uses the name is fine. This is why
"just hardcode the container IP" fails on the second deploy rather than the first.

## Declaring your own networks

```yaml
services:
  proxy:
    image: nginx:1.29
    networks: [frontend]
  api:
    build: .
    networks: [frontend, backend]
  db:
    image: postgres:18
    networks: [backend]

networks:
  frontend:
  backend:
    internal: true
```

This is the standard segmentation, and it is worth doing even in development:
**`proxy` cannot reach `db` at all.** The API is the only service on both networks,
so it is the only path between them. A misconfigured proxy cannot be pointed at the
database, and a compromised one has nothing to talk to.

`internal: true` creates an "externally isolated" network — no outbound route. A
database that never needs to reach the internet is a good candidate, and it turns
"the database container started making outbound connections" from an incident into
an impossibility.

| Key | What it does |
|---|---|
| `name` | Sets the network name **as-is**, without project scoping |
| `driver` | The network driver. Compose errors if it is unavailable on the platform |
| `driver_opts` | Driver-specific options |
| `attachable` | Lets standalone containers attach alongside the services |
| `internal` | Externally isolated — no outbound route |
| `enable_ipv4` / `enable_ipv6` | Control address assignment |
| `ipam` | Custom subnets, ranges, gateways |
| `labels` | Metadata, reverse-DNS notation to avoid conflicts |
| `external` | The network is not Compose's to manage — see below |

## `external` networks

> "If set to `true`, `external` specifies that this network's lifecycle is
> maintained outside of that of the application. Compose doesn't attempt to create
> these networks, and returns an error if one doesn't exist."

```yaml
networks:
  shared:
    external: true
    name: infra_shared
```

Two real uses: joining a network created by another Compose project (so a shared
proxy or a shared database can serve several stacks), and joining one an operator
manages. The safety property matters as much as the capability — `docker compose
down` will not remove it, because Compose did not create it.

The error when it does not exist is a *good* error: it fails at `up` rather than
silently creating an empty network with the wrong name.

## Aliases and `links`

```yaml
services:
  db:
    image: postgres:18
    networks:
      backend:
        aliases:
          - database
          - postgres
```

The service is then reachable as `db`, `database` or `postgres` on that network —
useful when an inherited application has a hostname baked into a config file you
would rather not edit.

`links` also "allow you to define extra aliases by which a service is reachable from
another service", and the documentation is clear that "they are not required for
basic service-to-service communication". Treat `links` as legacy: it predates
user-defined networks, and there is no reason to reach for it in new work.

## Podman

Service-name DNS in a compose stack is the provider's doing on top of Podman's
network stack, which is `netavark` plus `aardvark-dns` rather than Docker's
built-in resolver. Names resolve the same way in normal use; the difference shows
up in error messages, which come from a different component than you may be used
to.

Two Podman-side facts that bite in a compose stack, both established earlier:

- **Rootless networking** goes through `pasta`, so source IPs in your logs may not
  be what you expect.
- **Privileged ports** are unavailable to an ordinary user, so `"80:80"` on a proxy
  service fails where `"8080:80"` succeeds.

The depth belongs to [Phase 7 · Networking](../phase-7-networking/README.md) and
[Phase 11 · Podman in depth](../phase-11-podman-in-depth/README.md).

## Gotchas

**Symptom:** The API cannot reach the database, and the port in the connection
string is the published one.
**Cause:** Service-to-service traffic uses the **container** port; the published
`HOST_PORT` only exists for the host.
**Fix:** `db:5432`, not `db:8001`. Check with `docker compose config` what the
service actually received.

**Symptom:** `ECONNREFUSED 127.0.0.1:5432` from inside the API container.
**Cause:** `localhost` inside a container is that container. The database is a
different container.
**Fix:** Use the service name. This is the single most common container networking
bug and it has nothing to do with Compose.

**Symptom:** Two projects' services can see each other, or one project's `down`
broke another's networking.
**Cause:** A shared network was declared in both files instead of being declared in
one and referenced as `external: true` in the other.
**Fix:** One owner creates it; everyone else marks it `external: true` with an
explicit `name`.

**Symptom:** A service works until it is recreated, then intermittently fails.
**Cause:** Something cached an IP address. A recreated container "joins the network
under a different IP address but the same name".
**Fix:** Resolve by name every time. Do not cache addresses, and do not pin them in
configuration.

## Interview questions

**★ How do two services in a Compose file find each other?**
Compose creates a default bridge network per project — `<project-name>_default` —
and every service joins it. An internal DNS server registers each service name, so
one service reaches another by name with no IP addresses, no `links` and no
published ports.

**★ A service publishes `"8001:5432"`. What port does another service connect
to?**
`5432` — the container port. The published host port exists only for traffic
arriving from the host. Using `8001` from inside the network is the classic
misconfiguration, and it presents as a connection failure that looks like a
networking bug.

**★ How do you stop the frontend proxy from being able to reach the database?**
Declare two networks and put each service only on the ones it needs — proxy on
`frontend`, db on `backend`, API on both. The API becomes the only path between
them. Adding `internal: true` to the backend network also removes its outbound
route, so the database cannot initiate connections to the internet.

**What does `external: true` on a network mean?**
That the network's lifecycle is managed outside this application. Compose will not
create it and errors if it is missing, and `down` will not remove it. It is how
several Compose projects share one network, and how you join a network an operator
created.

**Why is it wrong to configure a service with another container's IP address?**
Because recreating a container gives it a new address under the same name — the
documentation says exactly that. Names are stable across recreation; addresses are
not. It fails on the second `up`, not the first, which is what makes it a
frustrating bug.

**What is `links` for, and should you use it?**
It defines extra aliases by which one service can reach another. The documentation
notes it is not required for basic service-to-service communication. It predates
user-defined networks and there is no reason to use it in new work — `aliases`
under a network does the same job more clearly.

---

← Prev: [Healthchecks in Compose](06-healthchecks/README.md) · Index: [Phase 8](README.md) · Next → [Volumes in Compose](08-volumes.md)
