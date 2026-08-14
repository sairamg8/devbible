---
title: "Publishing ports"
sidebar_label: "05 · Publishing ports"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [docker container run — publish](https://docs.docker.com/reference/cli/docker/container/run/),
> [Docker — published ports](https://docs.docker.com/engine/network/#published-ports),
> [Docker — packet filtering and firewalls](https://docs.docker.com/engine/network/packet-filtering-firewalls/)
> and [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html).
> **No sandbox** — no console output on this page.

**Publishing maps a port on the host to a port in the container's network
namespace.** Without it, the container's port exists but nothing outside the
container's network can reach it.

## The syntax, read right to left

```
-p [HOST_IP:][HOST_PORT:]CONTAINER_PORT[/PROTOCOL]
```

The **container port is always last**. That is the only piece of the syntax worth
memorising, because it disambiguates every form:

| Form | Meaning |
|---|---|
| `-p 8080:3000` | Host **8080** → container **3000**, on **all** host interfaces |
| `-p 3000:3000` | Same port both sides — convenient, and hides which is which |
| `-p 127.0.0.1:8080:3000` | Host **loopback only**, port 8080 → container 3000 |
| `-p 3000` | Container 3000 → a **random** high host port |
| `-p 8080:3000/udp` | UDP instead of TCP |
| `-P` | Publish every `EXPOSE`d port to random host ports |

```bash
docker run -d -p 127.0.0.1:8080:3000 --name api myorg/api:1.4.2
docker port api            # what actually got mapped
```

## The security default nobody mentions

**`-p 8080:3000` binds `0.0.0.0` — every interface on the host.**

On a laptop behind a router that is merely untidy. On a cloud VM with a public
IP it means the port is reachable from the internet, and:

> ⚠️ **Docker's published ports bypass `ufw`.** Docker's own documentation is
> explicit: traffic to and from a container with published ports "gets diverted
> before it goes through the ufw firewall settings", because Docker routes
> container traffic in the **`nat` table** — so packets are diverted before
> reaching the `INPUT` and `OUTPUT` chains `ufw` uses, "effectively ignoring your
> firewall configuration".

`firewalld` is the better case: Docker integrates with it when its iptables
options are enabled, creating a dedicated `docker` zone and a forwarding policy
for Docker networks. But on an Ubuntu host with `ufw` — the most common
combination in tutorials — a "deny all inbound" policy can be sitting there while
a published port is reachable from the internet. This is documented behaviour,
not a bug, and it is how databases end up exposed.
The habit that prevents it:

```bash
# ✅ Reachable from this host only
docker run -d -p 127.0.0.1:5432:5432 postgres:17

# ❌ Reachable from anywhere that can route to this host
docker run -d -p 5432:5432 postgres:17
```

**Bind to `127.0.0.1` unless you have a specific reason not to.** For anything a
user should reach, put a reverse proxy in front and publish only the proxy.

## You often do not need to publish at all

This is the point people miss for months. **Containers on the same user-defined
network reach each other on the container port, by name, with no publishing
whatsoever.**

```bash
docker network create app-net
docker run -d --network app-net --name db  postgres:17      # no -p
docker run -d --network app-net --name api -p 127.0.0.1:8080:3000 myorg/api
# the API connects to  postgres://db:5432  — internal, unpublished
```

Publishing is for **traffic entering from outside the container network**. The
database in the example is reachable by the API and by nothing else, which is
exactly right. Phase 7 covers the mechanism; Phase 8 shows Compose doing this by
default.

## `EXPOSE` publishes nothing

`EXPOSE 3000` in a Dockerfile is **documentation**. It records the port the image
intends to listen on, and it is what `-P` reads to pick ports. It opens nothing
and maps nothing. Only `-p`/`-P` (or Compose's `ports:`) publishes.

## Podman

Same syntax and same semantics, with one hard difference:

- **Rootless Podman cannot bind host ports below 1024.** `-p 80:80` as a normal
  user fails. Publish a high port and proxy, or lower
  `net.ipv4.ip_unprivileged_port_start`.
- **Rootless networking goes through `pasta`** (or `slirp4netns` historically),
  so the **source IP** your container sees for inbound connections may be the
  gateway rather than the real client. Applications doing IP-based rate limiting
  or allow-listing will behave differently. Phase 7 and Phase 11.

## Gotchas

**Symptom:** `curl localhost:8080` on the host gets connection refused, but the
app is definitely listening inside the container.
**Cause:** The application is bound to `127.0.0.1` **inside** the container, so
it only accepts connections from within that namespace. The published port
forwards to the container's external interface, where nothing is listening.
**Fix:** Bind the application to `0.0.0.0` inside the container. This is the
single most common "published port does not work" cause, and it is an
application-config problem, not a Docker one.

**Symptom:** `port is already allocated`.
**Cause:** Another container — or a host process — already holds that host port.
**Fix:** `docker ps --format '{{.Names}} {{.Ports}}'` to find the container, or
`ss -tlnp` for a host process. Change the host side of the mapping; the container
side does not need to move.

**Symptom:** A database published for "quick debugging" is found exposed to the
internet, despite `ufw` denying inbound.
**Cause:** `-p 5432:5432` binds all interfaces, and Docker's `nat`-table rules
divert the packets before `ufw`'s `INPUT` chain sees them.
**Fix:** Bind to `127.0.0.1`, or do not publish at all and reach it through the
container network. For remote access use an SSH tunnel rather than a public
port.

**Symptom:** The port works from the host but not from another container.
**Cause:** You are using the published host port and `localhost` from inside a
container, where `localhost` is that container.
**Fix:** Use the container network: the service name and the **container** port.
Publishing is irrelevant between containers on the same network.

## Interview questions

**★ What does `-p 8080:3000` do, and which number is which?**
Maps host port 8080 to container port 3000, on all host interfaces. The container
port is always last; the host side is everything before it, optionally including
an interface.

**★ Two containers need to talk. Do you publish ports?**
No. Put them on the same user-defined network and use the service name and the
container port. Publishing is only for traffic arriving from outside the
container network, and publishing a database is how it ends up exposed.

**★ A published port refuses connections although the app is running. Where do
you look first?**
What address the application binds **inside** the container. If it listens on
`127.0.0.1` inside, only that container can reach it; the published port
forwards to an interface where nothing is listening. Bind `0.0.0.0` inside.

**Does `EXPOSE` in a Dockerfile publish a port?**
No. It is metadata documenting the intended port, and it is what `-P` uses to
choose random host ports. Only `-p`/`-P` or Compose's `ports:` actually publishes.

**Why can rootless Podman not publish port 80?**
Binding below 1024 requires privilege the process does not have. Publish a high
port and put a proxy in front, or lower
`net.ipv4.ip_unprivileged_port_start` if host policy allows.

**Why is a published port reachable despite `ufw` denying it?**
Docker routes container traffic in the `nat` table, so packets are diverted
before reaching the `INPUT` chain that `ufw` filters on — the firewall rules
never see them. `firewalld` is integrated with better (Docker creates a `docker`
zone), but the safe habit either way is to bind `127.0.0.1` rather than to rely
on the host firewall.

---

← Prev: [exec versus run](04-exec-vs-run.md) · Index: [Phase 1](README.md) · Next → [Environment variables](06-environment.md)
