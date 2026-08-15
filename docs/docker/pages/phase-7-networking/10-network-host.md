---
title: "`--network=host`"
sidebar_label: "10 · `--network=host`"
sidebar_position: 10
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against [Docker — host network driver](https://docs.docker.com/engine/network/drivers/host/)
> and [podman-run(1) — `--network`](https://docs.podman.io/en/latest/markdown/podman-run.1.html).
> **No sandbox** — no console output on this page.

**Host networking removes the network namespace, and with it every problem and
every benefit that namespace provided.** [Page 05](05-network-drivers.md)
introduced it as one of six drivers; this page is the decision — what you get,
what you give up, and the short list of cases where the trade is right.

## What it actually is

> *"the container's network stack isn't isolated from the Docker host (the
> container shares the host's networking namespace), and the container doesn't
> get its own IP-address allocated."*

The container's processes bind the host's interfaces directly. There is no
bridge, no NAT, no port mapping and no per-container address — the container's
`localhost` **is** the host's `localhost`, which is the one situation where the
usual advice of [page 03](03-localhost-is-the-container.md) inverts.

```bash
docker run --network host nginx        # serves on the host's :80, no -p involved
```

```yaml
services:
  proxy:
    network_mode: host                 # Compose spelling
```

## What you give up

**Port mapping.** Publishing flags are *"discarded when using host network
mode"* — `-p`, `-P`, and the Compose `ports:` block do nothing. The container's
port is the host's port, full stop. Host port collisions come back with it: two
containers that each listen on 3000 now conflict the way two ordinary processes
would.

**Service discovery.** No user-defined network means no embedded DNS, so
resolving another container by name stops working
([page 02](02-service-discovery.md)). In a Compose stack, moving one service to
`network_mode: host` usually breaks the others' ability to reach it by name —
they must use `localhost` or a host address instead, and the file stops being
portable.

**Isolation, and Podman spells out exactly how much:**

> *"Warning: This gives the container full access to abstract Unix domain
> sockets and to TCP/UDP sockets bound to localhost. Since these mechanisms are
> often used to prevent access to sensitive system services, isolating them from
> external entities, use of this option may be considered a security
> vulnerability."*

That is the sharpest statement of the cost anywhere in either engine's
documentation, and it is the one to remember. A service you deliberately bound
to `127.0.0.1` on the host — a database, an admin interface, a metrics endpoint
— is fully reachable from any container running with host networking.

**Portability.** It is supported on *"Docker Engine on Linux"* and on *"Docker
Desktop version 4.34 and later (requires enabling the feature in Settings)"*;
*"Host networking does not work with Windows containers"*, and it is
incompatible with Enhanced Container Isolation. A compose file that depends on
it is a compose file that behaves differently per teammate.

## When the trade is right

| Case | Why host networking, and not a published port |
|---|---|
| **A very large or dynamic port range** | Publishing thousands of ports, or ports chosen at runtime — media servers negotiating RTP, some game protocols — is impractical to map |
| **Broadcast, multicast or discovery protocols** | mDNS, SSDP and similar need to see the host's actual L2 traffic, which a bridge does not carry |
| **Monitoring and network tooling** | A metrics agent or packet inspector is *meant* to observe the host's stack; namespacing it away defeats the purpose |
| **Measured throughput or latency ceiling** | No NAT and no userland proxy in the path. Reach for this only after measuring, and note it is also the answer for rootless throughput ([page 08](08-rootless-networking.md)) |
| **A single-purpose appliance host** | One workload owns the machine, so isolation between containers is not buying anything |

⚠️ **Not on the list: "the container can't reach my database".** Host networking
does make a host service reachable on `localhost`, but
[page 07](07-reaching-the-host.md) solves that with `host-gateway` and a name,
keeping the namespace. Reaching for `--network host` to fix one hostname is a
large change to solve a small problem.

## Rootless

`--network host` does **not** grant privileges you did not have. The container's
processes are still your unprivileged user, so the kernel's rule about ports
below 1024 still applies — a rootless container with host networking cannot bind
80 any more than a rootless container with a published port can
([page 09](09-privileged-ports-rootless.md)).

What it does give rootless containers is the kernel's networking path instead of
a user-mode stack, which is why it appears in the throughput conversation. Podman
notes that pasta *"is the default for rootless containers and only supported in
rootless mode"* — host mode sidesteps it entirely.

## `none`, the opposite end

Worth knowing as the mirror image, since it is the same kind of choice:

> *"Create a network namespace for the container but do not configure network
> interfaces for it, thus the container has no network connectivity."*

Host networking removes the namespace; `none` keeps the namespace and empties
it. Between them sits every ordinary container.

## Gotchas

**Symptom:** `ports:` was added to a `network_mode: host` service and nothing
changed.
**Cause:** Publishing flags are discarded in host mode; the daemon warns and
carries on.
**Fix:** Change what the process binds inside the container. There is no mapping
layer left to adjust.

**Symptom:** Other services in the Compose stack can no longer reach the one
moved to host networking by name.
**Cause:** It left the project's user-defined network, so the embedded DNS no
longer has a record for it.
**Fix:** Address it via the host, or put it back on the network and publish a
port instead.

**Symptom:** A container with host networking can reach an admin service that
was deliberately bound to `127.0.0.1` on the host.
**Cause:** That is exactly what sharing the namespace means — Podman's
documentation calls it out as a possible security vulnerability.
**Fix:** Treat host-networked containers as trusted host processes, because that
is what they are. If the workload is not trusted to that degree, it does not get
host networking.

**Symptom:** Two containers with host networking will not start together.
**Cause:** They bind the same host port. Without namespaces there is nothing to
keep them apart.
**Fix:** Configure different ports, or give at least one of them a normal
network.

**Symptom:** It works on the Linux CI runner and fails on a developer's Mac.
**Cause:** Host networking needs Docker Desktop 4.34+ with the feature enabled
in Settings, and does not exist for Windows containers.
**Fix:** Prefer a published port for anything that must be cross-platform, and
keep host networking for deployment targets you control.

## Interview questions

**★ What does `--network=host` change, and what does it cost?**
The container shares the host's network namespace: no separate IP, no NAT, no
port mapping — publishing flags are discarded — and no container DNS, so service
discovery by name is gone. Host port collisions return. The security cost is
concrete: Podman's documentation warns it grants full access to abstract Unix
domain sockets and to TCP/UDP sockets bound to localhost, which is precisely how
sensitive services are usually protected.

**★ Name a case where it is the right choice.**
A workload that needs a large or dynamic range of ports (media servers), one
that needs broadcast or multicast traffic (mDNS-style discovery), or a
monitoring agent whose job is to observe the host's stack. Also as a measured
answer to a throughput ceiling — particularly rootless, where the alternative is
a user-mode TCP/IP stack.

**★ Does host networking let a rootless container bind port 80?**
No. The port restriction is about the privileges of the process, not about
namespaces — an unprivileged user cannot bind below 1024 either way. What
changes is the data path, not the permission.

**How does host networking interact with Compose?**
`network_mode: host`, and the `ports:` block stops having any effect. The bigger
consequence is that the service leaves the project's default network, so the
other services lose name resolution for it. That usually means the whole file
has to be written differently rather than one line being changed.

**Is it portable?**
Not fully. Linux engines yes; Docker Desktop from 4.34 with the feature enabled;
Windows containers not at all. Anything that must run on every teammate's
machine is better off with a published port.

---

← Prev: [Privileged ports rootless](09-privileged-ports-rootless.md) · Index: [Phase 7](README.md) · Next → [Debugging the network](11-debugging-the-network.md)
