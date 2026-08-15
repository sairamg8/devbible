---
title: "Publishing ports"
sidebar_label: "04 · Publishing ports"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [Docker — port publishing](https://docs.docker.com/engine/network/port-publishing/),
> [Docker — packet filtering and firewalls](https://docs.docker.com/engine/network/packet-filtering-firewalls/),
> [docker container run](https://docs.docker.com/reference/cli/docker/container/run/) and
> [Podman — podman-run `--publish`](https://docs.podman.io/en/latest/markdown/podman-run.1.html).
> **No sandbox** — no console output on this page.

**Publishing is how traffic from *outside* the container's network reaches it —
and by default that means from outside your machine.** Docker's own
documentation opens with the warning, and it is worth reading twice before the
syntax:

> *"Publishing container ports is insecure by default. Meaning, when you publish
> a container's ports it becomes available not only to the Docker host, but to
> the outside world as well."*

## The syntax

```
-p [host-ip:][host-port:]container-port[/protocol]
```

```bash
docker run -p 8080:80 nginx                    # all host interfaces → container 80
docker run -p 127.0.0.1:8080:80 nginx          # loopback only
docker run -p 192.168.1.100:8080:80 nginx      # one specific host address
docker run -p 8080:80/udp myapp                # UDP instead of TCP
docker run -p 8080:80 -p 8443:443 nginx        # more than one
```

**Read it right to left.** The rightmost field is always the container's port —
the one the process is listening on. Everything to its left describes where on
the host it should appear. Getting the order backwards produces a mapping that
looks plausible and connects to nothing.

## The default is every interface, and that is the whole problem

> *"By default, when a container's ports are mapped without any specific host
> address, the Docker daemon publishes ports to all host addresses (`0.0.0.0`
> and `[::]`)."*

So `-p 5432:5432` on a laptop in a café publishes Postgres to the café. On a
cloud VM with a public IP it publishes to the internet — which is how unsecured
databases end up in scan results.

The fix is one field:

> *"If you include the localhost IP address (`127.0.0.1`, or `::1`) with the
> publish flag, only the Docker host can access the published container port."*

```bash
docker run -p 127.0.0.1:5432:5432 postgres:17     # you can psql; nobody else can
```

⚠️ **Docker's documentation notes that in releases before 28.0.0**, ports
published to localhost *"remained accessible to hosts on the same L2 network
segment"* — the isolation was not as complete as it read. On a current engine
that is fixed; on an older one, do not treat `127.0.0.1:` as a security boundary
by itself.

**The habit worth forming:** publish to `127.0.0.1` unless something outside the
host genuinely needs to connect, and let a reverse proxy own the interfaces that
face the world.

## What you do *not* need to publish

Container-to-container traffic on a shared network (page 02). This is the
mistake that recurs across the whole track:

```yaml
services:
  api:
    ports:
      - "127.0.0.1:8080:3000"    # the proxy or your browser reaches this
  db:
    image: postgres:17
    # ports: — deliberately absent. "api" reaches db:5432 anyway.
```

**A database with no `ports:` is not unreachable — it is correctly reachable.**
Every service on its network can connect; nothing else can. Adding a mapping
does not enable the API, it only opens a door.

## Publishing bypasses your firewall

The surprise that catches out even careful people. Docker programs the kernel's
`nat` table directly, and the reference is explicit about the consequence:

> *"Docker routes container traffic in the `nat` table, which means that packets
> are diverted before it reaches the `INPUT` and `OUTPUT` chains that ufw uses."*

So `ufw deny 5432` does **not** protect a container published on 5432. The rule
sits in a chain the packet never reaches. `firewalld` is affected the same way.

Three things that do work:

1. **Bind to `127.0.0.1`** in the publish flag. The port is never on an external
   interface, so there is nothing for a firewall rule to be needed for. This is
   the simplest correct answer and it is why the habit above matters.
2. **Filter in the chain Docker leaves for you.** Docker inserts a `DOCKER-USER`
   chain that is evaluated before its own rules, so rules added there are not
   overwritten when the engine rewrites its own — this is the documented seam
   for host-level filtering of container traffic.
3. **Filter upstream** — a cloud security group, or a firewall on a device that
   is not this host — which is unaffected by any of it.

## Compose

```yaml
services:
  web:
    ports:
      - "127.0.0.1:8080:80"        # short syntax
      - target: 443                # long syntax — explicit and readable
        published: "8443"
        host_ip: 127.0.0.1
        protocol: tcp
        mode: host
```

⚠️ **Quote the short form.** Unquoted `8080:80` is fine, but a mapping like
`22:22` is parsed by YAML as a **sexagesimal number**, not a string — the classic
Compose foot-gun. Quoting every port entry costs nothing and removes the whole
class of problem.

Note also that `expose:` in Compose and `EXPOSE` in a Dockerfile
([Phase 3, page 10](../phase-3-dockerfile/10-expose.md)) publish **nothing**.
They are documentation. `-P` (`--publish-all`) is the one thing that reads them:
it publishes every exposed port to a random high host port, which is useful for
throwaway containers and unhelpful anywhere you need to know the address.

## Podman, and the rootless difference

The `-p` syntax is identical. Two differences are worth knowing:

**Ports below 1024 fail rootless.** An unprivileged user cannot bind a
privileged port, so `podman run -p 80:80` fails as your own user while working
under `sudo podman`. Page 09 covers the sysctl and the alternatives.

**The source address in your logs may be wrong.** Rootless Podman's networking
goes through a user-space stack, and depending on the mode every incoming
connection can appear to come from the gateway rather than the real client.
`pasta`, the current default, preserves source addresses far better than the
older `slirp4netns` did — page 08 has the detail, and it matters the moment
anything logs, rate-limits or allow-lists by IP.

Podman also writes its own firewall rules (through `netavark`), so the
"published ports bypass `ufw`" caution applies there too.

## Gotchas

**Symptom:** A database was published with `-p 5432:5432` on a cloud VM and is
now in someone's scan results.
**Cause:** With no host IP, the daemon publishes to **all** host addresses,
including the public one.
**Fix:** `-p 127.0.0.1:5432:5432`, and a proxy or tunnel for anything that must
reach it from elsewhere. Assume the port was found; rotate the credentials.

**Symptom:** `ufw deny 8080` has no effect on a published container port.
**Cause:** Docker's rules live in the `nat` table and divert packets before
`ufw`'s `INPUT` chain sees them.
**Fix:** Publish to `127.0.0.1`, or add rules to the `DOCKER-USER` chain, or
filter upstream at a cloud security group.

**Symptom:** `Error starting userland proxy: bind: address already in use`.
**Cause:** Another process — often a previous container — holds that **host**
port. Container ports never collide; host ports do.
**Fix:** `docker ps --filter publish=8080` and `ss -tlnp | grep 8080` to find the
holder, then pick another host port or stop the other process.

**Symptom:** A Compose file maps `22:22` and the container ends up on a bizarre
port.
**Cause:** YAML parses `22:22` as a sexagesimal number, not a string.
**Fix:** Quote every port entry — `"22:22"`.

**Symptom:** The mapping is right, the container is running, and connections are
refused.
**Cause:** The process bound to `127.0.0.1` inside the container, so the
published port forwards to nothing (page 03).
**Fix:** Bind `0.0.0.0` inside the container.

## Interview questions

**★ What does `-p 8080:80` actually do, and what is the default host
interface?**
It maps host port 8080 to container port 80, and with no host IP given the
daemon publishes on **all** host addresses — `0.0.0.0` and `[::]`. Docker's
documentation calls publishing *"insecure by default"* for exactly that reason:
the port is reachable from the outside world, not just from the host.

**★ Do containers on the same network need published ports to talk to each
other?**
No. Publishing is only for traffic arriving from outside the container network.
Containers on a shared user-defined network reach each other by name on the
container's own port. A database with no `ports:` entry is reachable by its
services and by nothing else, which is the posture you want.

**★ Why does `ufw deny` not protect a published container port?**
Because Docker routes container traffic through the `nat` table, and packets are
diverted before reaching the `INPUT` chain `ufw` operates on. The working
answers are to publish to `127.0.0.1` so the port is never externally reachable,
to add rules in the `DOCKER-USER` chain that Docker evaluates first and does not
overwrite, or to filter upstream.

**How do you expose a service to yourself but not to the network?**
Include the loopback address in the publish flag —
`-p 127.0.0.1:5432:5432`. Docker's documentation states that with `127.0.0.1` or
`::1`, *"only the Docker host can access the published container port"*. Note
that before engine 28.0.0 such ports remained reachable from the same L2
segment.

**What is `EXPOSE` for, then?**
Documentation, and one thing more: `-P`/`--publish-all` reads it and publishes
every exposed port to a random high host port. `EXPOSE` alone publishes nothing,
and confusing it with `-p` is one of the most common misconceptions in the whole
track.

**What changes rootless?**
Ports below 1024 cannot be bound by an unprivileged user, so `-p 80:80` fails;
and rootless networking runs through a user-space stack, so the source address
seen by the container may be the gateway rather than the real client, depending
on the mode. Both matter for anything that logs or filters by IP.

---

← Prev: [`localhost` inside a container is the container](03-localhost-is-the-container.md) · Index: [Phase 7](README.md) · Next → [Network drivers](05-network-drivers.md)
