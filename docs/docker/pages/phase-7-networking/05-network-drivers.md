---
title: "Network drivers"
sidebar_label: "05 · Network drivers"
sidebar_position: 5
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against [Docker — network drivers](https://docs.docker.com/engine/network/drivers/),
> [host](https://docs.docker.com/engine/network/drivers/host/),
> [none](https://docs.docker.com/engine/network/drivers/none/),
> [macvlan](https://docs.docker.com/engine/network/drivers/macvlan/),
> [ipvlan](https://docs.docker.com/engine/network/drivers/ipvlan/),
> [docker network ls](https://docs.docker.com/reference/cli/docker/network/ls/) and
> [podman-network-create(1)](https://docs.podman.io/en/latest/markdown/podman-network-create.1.html).
> **No sandbox** — no console output on this page.

**Six drivers exist and you will use one of them.** `bridge` is the default and
covers essentially every application container; the other five answer specific
questions that most stacks never ask. This page is the one-sentence-each map, so
that when you meet `macvlan` in someone else's compose file you know what
question they were answering.

## The map

| Driver | Docker's own description | Reach for it when |
|---|---|---|
| **`bridge`** | *"The default network driver. If you don't specify a driver, this is the type of network you are creating."* | Always, unless something below applies |
| **`host`** | *"Remove network isolation between the container and the Docker host, and use the host's networking directly."* | You need the host's stack itself — native performance, or a port range too large to publish |
| **`none`** | *"Completely isolate a container from the host and other containers."* | A container that processes data and must not talk to anything |
| **`macvlan`** | *"Macvlan networks allow you to assign a MAC address to a container, making it appear as a physical device on your network."* | *"you are migrating from a VM setup or need your containers to look like physical hosts on your network"* |
| **`ipvlan`** | *"IPvlan networks give users total control over both IPv4 and IPv6 addressing."* | *"there's a restriction on the number of MAC addresses that can be assigned to a network interface or port"* |
| **`overlay`** | *"Overlay networks connect multiple Docker daemons together and enable Swarm services and containers to communicate across nodes."* | Containers on **different hosts** must reach each other |

Third-party drivers exist too — the documentation notes you *"can install and use
third-party network plugins with Docker"* — but a plugin is a deployment
decision, not a default worth learning up front.

## Drivers, and the two that are not networks

`docker network create -d <driver>` takes `bridge`, `overlay`, `macvlan` and
`ipvlan`. It does not take `host` or `none`, and this trips people up because
all six names appear in `docker network ls`. The CLI reference's own example
listing shows the difference plainly:

| NAME | DRIVER | SCOPE |
|---|---|---|
| `bridge` | `bridge` | local |
| `none` | `null` | local |
| `host` | `host` | local |
| `multi-host` | `overlay` | swarm |

Note the `none` network's driver is **`null`** — the network object exists so
that `--network none` has something to name, but there is nothing to configure
and no second one to create. `host` is the same shape: one host network stack
exists, so there is one `host` network.

**The practical split:** `bridge`, `macvlan`, `ipvlan` and `overlay` are
networks you *create and attach containers to*. `host` and `none` are **modes
you select at run time** with `--network`, and creating more of them is
meaningless.

## `host` — no isolation, no mapping

> *"the container's network stack isn't isolated from the Docker host (the
> container shares the host's networking namespace), and the container doesn't
> get its own IP-address allocated."*

Two consequences follow immediately, and both surprise people:

- **Publishing flags are ignored.** `-p`, `--publish`, `-P` and
  `--publish-all` do nothing, and the engine warns *"Published ports are
  discarded when using host network mode"*. There is nothing to map: the
  process is already listening on the host's port.
- **Host port collisions are back.** Two containers that each bind 3000 now
  conflict exactly as two ordinary processes would. The isolation that let you
  run ten containers on "port 3000" was the bridge network, not the container.

⚠️ **It is Linux-native.** Host networking works on *"Docker Engine on Linux"*
and on *"Docker Desktop version 4.34 and later (requires enabling the feature in
Settings)"*; *"Host networking does not work with Windows containers"*, and it
is mutually exclusive with Enhanced Container Isolation. A compose file that
relies on `network_mode: host` is a compose file that behaves differently on
your colleague's Mac.

There is also a name cost: on the host network there is no per-container DNS,
so service discovery by container name ([page 02](02-service-discovery.md)) is
gone. Everything is `localhost` again — which for once is true, because
[the container's `localhost`](03-localhost-is-the-container.md) and the host's
are now the same namespace.

## `none` — the loopback and nothing else

> *"Within the container, only the loopback device is created."*

No `eth0`, no address, no route. The documentation also notes that *"No IPv6
loopback address is configured for containers using the `none` driver"*, which
is worth knowing if something inside insists on `::1`.

This is the right answer more often than its obscurity suggests: a batch job
that reads a mounted file and writes a mounted file has no business holding a
network interface, and `--network none` is a stronger statement than a firewall
rule because there is no interface to filter. ⚠️ `none` *"is not available for
Swarm services"*.

## `macvlan` and `ipvlan` — appearing on the physical network

Both give a container an address on the LAN itself rather than behind the host's
NAT, and both exist for the same class of application: ones that, in Docker's
words, *"expect to be directly connected to the physical network"* — legacy
software and traffic monitors above all.

`macvlan` does it by giving each container **its own MAC address**, which is why
*"Your networking equipment needs to be able to handle 'promiscuous mode', where
one physical interface can be assigned multiple MAC addresses."* `ipvlan` does
it without minting MAC addresses, which is precisely why you would choose it —
the documented use case is a restriction on how many MACs a port will accept.
`ipvlan` also has an `ipvlan_mode` of `l2` (the default), `l3` or `l3s`; L3 mode
routes rather than bridges and *"drops all broadcast and multicast traffic"*.

Both take a `parent` interface, and macvlan supports 802.1Q trunking: give it a
parent like `eth0.50` and *"traffic goes through an 802.1Q sub-interface which
Docker creates on the fly"*.

🔴 **Three warnings, all from the driver's own page, and any one of them is
usually enough to send you back to `bridge`:**

- *"Containers attached to a macvlan network cannot communicate with the host
  directly, this is a restriction in the Linux kernel."* The host and its own
  containers cannot reach each other — a genuinely confusing failure the first
  time.
- *"Most cloud providers block macvlan networking. You may need physical access
  to your networking equipment."*
- *"You may unintentionally degrade your network due to IP address exhaustion or
  to 'VLAN spread'"*, i.e. an inappropriately large number of unique MAC
  addresses.

## `overlay` — where one engine stops

An overlay network spans daemons: it *"connect[s] multiple Docker daemons
together"* so containers on different hosts communicate as if local. Its
`SCOPE` is `swarm` rather than `local`, which is the tell — this is Swarm's
driver, and outside Swarm the multi-host answer is usually Kubernetes with its
own CNI. Phase 7's last page revisits it; for a single-host stack it never comes
up.

## Podman

The list is shorter, and the reason is architectural rather than a gap.

`podman network create` documents that *"Currently `bridge`, `macvlan` and
`ipvlan` are supported. Defaults to `bridge`."* There is no `overlay` — with no
daemon to cluster, there is nothing for one to connect (Phase 11 covers the
daemonless model, and multi-host under Podman is a Kubernetes question).

`host` and `none` are still there, because they were never drivers:
`--network host` and `--network none` work exactly as they do under Docker.
Podman additionally accepts `--network container:<id>` and `--network ns:<path>`
to join an existing namespace, which is the same primitive a Kubernetes pod is
built from.

⚠️ **Rootless changes the answer for macvlan and ipvlan:** *"When running
rootless, the `macvlan` and `ipvlan` drivers have no access to the host network
interfaces because rootless networking requires a separate network namespace."*
The driver names are accepted; the thing they exist to do cannot happen without
root. This is the same user-namespace boundary that page 08,
**Rootless networking** *(not written yet)*, covers in full.

## Gotchas

**Symptom:** `docker network create -d host mynet` fails.
**Cause:** `host` is a network *mode*, not a driver you can instantiate. There
is one host network stack, so there is one `host` network.
**Fix:** Use `--network host` on the container, or `network_mode: host` in
Compose.

**Symptom:** Switched a service to `network_mode: host` and its `ports:` mapping
silently stopped applying.
**Cause:** Publishing flags are *"discarded when using host network mode"* —
there is nothing to publish to, because the process is already on the host's
ports.
**Fix:** Expect the container port to *be* the host port. If you needed a
different external port, host networking is the wrong tool — go back to a bridge
and publish.

**Symptom:** A macvlan container is reachable from every other machine on the
LAN except the Docker host itself.
**Cause:** Not a firewall — a kernel restriction: containers on a macvlan
network cannot talk to their host directly.
**Fix:** Accept it and reach the container from elsewhere, or add a macvlan
sub-interface on the host for the purpose, or use a bridge network if the host
must participate.

**Symptom:** A macvlan network that works in the office does nothing on a cloud
VM.
**Cause:** *"Most cloud providers block macvlan networking."*
**Fix:** Bridge plus published ports, or a load balancer. Macvlan assumes you
control the switch.

**Symptom:** `--network none` and the container immediately fails to resolve
anything.
**Cause:** That is the entire point — only the loopback device exists.
**Fix:** If it needs DNS, it needs a network. `none` is for jobs that genuinely
have no peer.

## Interview questions

**★ What is the default network driver, and when would you deliberately not use
it?**
`bridge` — *"If you don't specify a driver, this is the type of network you are
creating."* You leave it for three reasons: the container needs the host's own
network stack (`host`), it must appear as a real device on the physical LAN
(`macvlan`/`ipvlan`), or it must reach containers on other hosts (`overlay`).
Everything else is a bridge network, and the choice is which one, not which
driver.

**★ What actually changes when you run with `--network host`?**
The container shares the host's network namespace, gets no address of its own,
and publishing flags are discarded — the process binds host ports directly. You
lose per-container DNS and you get host-level port collisions back. On Linux
that is a genuine performance and simplicity win for a proxy or a
high-throughput service; on Docker Desktop it needs 4.34+ with the feature
enabled, and it does not exist for Windows containers.

**★ `macvlan` or `ipvlan` — what decides?**
MAC addresses. Macvlan gives every container its own, so the switch must accept
many MACs on one port and be in promiscuous mode; ipvlan shares the parent's,
which is exactly why the documentation points you at it *"when there's a
restriction on the number of MAC addresses that can be assigned to a network
interface or port"*. Before either, check the three warnings — no host-to-
container traffic on macvlan, most clouds block it, and address exhaustion is
real.

**Why does `docker network ls` show `host` and `none` if you cannot create
them?**
They are pre-created network objects so that `--network host` and
`--network none` have names to refer to. `none`'s driver is listed as `null`.
Neither has anything to configure, so a second one would be meaningless.

**Which drivers does Podman not have, and why?**
`overlay`. It exists to connect multiple Docker daemons; Podman has no daemon to
connect, so multi-host networking is delegated to Kubernetes. Podman supports
`bridge` (default), `macvlan` and `ipvlan`, plus the `host` and `none` modes and
its own `container:` and `ns:` modes for joining an existing namespace.

**What breaks about macvlan when running rootless?**
Everything it is for. Rootless containers live in a separate network namespace
with no access to the host's interfaces, so the driver cannot attach to a parent
NIC. Podman documents this directly. If containers must appear on the LAN, that
is a rootful deployment.

---

← Prev: [Publishing ports](04-publishing-ports.md) · Index: [Phase 7](README.md) · Next → [`network create` and friends](06-network-commands.md)
