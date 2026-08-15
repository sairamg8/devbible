---
title: "Overlay networks and multi-host"
sidebar_label: "14 · Overlay networks and multi-host"
sidebar_position: 14
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 against [Docker — overlay network driver](https://docs.docker.com/engine/network/drivers/overlay/),
> [Docker — network drivers](https://docs.docker.com/engine/network/drivers/) and
> [podman-network-create(1)](https://docs.podman.io/en/latest/markdown/podman-network-create.1.html).
> **No sandbox** — no console output on this page.

**Everything in this phase so far has been one host. An overlay network is where
a single engine's networking stops and a cluster's begins** — and for most teams
the honest answer is that the next step is Kubernetes rather than an overlay
network. This page is here so you recognise one, not so you build one.

## What it is

> *"The `overlay` network driver creates a distributed network among multiple
> Docker daemon hosts"* which *"sits on top of (overlays) the host-specific
> networks, allowing containers connected to it to communicate securely when
> encryption is enabled."*

Containers on two different machines get addresses on one logical network and
reach each other by name, exactly as if they shared a bridge. The traffic is
encapsulated and carried between the hosts over their real network.

🔴 **It requires Swarm:** *"Docker hosts must be part of a swarm to use overlay
networks, even when connecting standalone containers."* There is no
single-machine overlay and no way to opt out of the cluster — `docker swarm
init` on one host and `docker swarm join` on the others is the entry fee.

## What it drags in

**Ports between hosts**, which is where most first attempts fail — a cloud
security group blocks one of them and the symptom is a cluster that forms but
does not carry traffic:

| Port | For |
|---|---|
| **2377/tcp** | the Swarm control plane |
| **7946/tcp**, **7946/udp** | node-to-node communication |
| **4789/udp** | the overlay data traffic itself |

**Two networks you did not create.** Swarm makes an `ingress` overlay network
and a `docker_gwbridge` bridge, where *"The `docker_gwbridge` connects the
`ingress` network to the Docker host's network interface."* Seeing them in
`network ls` on a Swarm node is normal, not leftovers.

**`--attachable` if plain containers must join:** *"The `--attachable` option
enables both standalone containers and Swarm services to connect to the overlay
network. Without `--attachable`, only Swarm services can connect to the
network."* That flag ([page 06](06-network-commands.md)) means nothing outside
this context, which is why it looks mysterious in the `network create` options.

**Encryption is opt-in** — `--opt encrypted` — and carries one documented
restriction: *"Don't attach Windows containers to encrypted overlay networks.
Overlay network encryption isn't supported on Windows."*

## When it is the right tool, and when it is not

| Situation | The answer |
|---|---|
| Several containers, one machine | A user-defined bridge. Nothing here applies |
| Several machines, and you already run Swarm | An overlay network — this page |
| Several machines, no orchestrator yet | Almost always **Kubernetes**, whose CNI plugin does this job. Adopting Swarm to get one network is a large decision for a small need |
| A handful of hosts, no cluster wanted | Published ports plus a proxy, or a host-level VPN/mesh (WireGuard, Tailscale) underneath ordinary bridge networks |

That last row is the underrated one. A VPN or mesh between the hosts makes the
machines reachable to each other, and then each host's containers are reached
through published ports as usual — no orchestrator, no overlay, and one fewer
distributed system to operate.

## Podman

**Podman has no overlay driver.** `podman network create` supports *"`bridge`,
`macvlan` and `ipvlan`"* and nothing else, and the reason is structural rather
than a missing feature: an overlay network connects *daemons*, and Podman has no
daemon to connect ([page 12](12-netavark-and-aardvark.md)). Multi-host under
Podman means Kubernetes — which is also why Podman speaks Kubernetes YAML, a
thread Phase 11 picks up.

## Gotchas

**Symptom:** `docker network create -d overlay` fails on a normal host.
**Cause:** Overlay requires Swarm — the host must be a member, even for
standalone containers.
**Fix:** `docker swarm init`, or reconsider whether a cluster is what you wanted
at all.

**Symptom:** Nodes join the swarm, services start, and containers on different
hosts cannot reach each other.
**Cause:** Almost always a blocked port — `4789/udp` for the data path and
`7946` for node communication, on top of `2377/tcp` for control.
**Fix:** Open all three between the hosts. The control plane forming proves only
that 2377 is open.

**Symptom:** A plain `docker run` cannot join the overlay network.
**Cause:** Without `--attachable`, only Swarm services can connect.
**Fix:** Create the network with `--attachable`, or run the workload as a
service.

**Symptom:** An overlay network was assumed to be encrypted.
**Cause:** Encryption is opt-in via `--opt encrypted`; the documentation's phrase
is *"when encryption is enabled"*.
**Fix:** Enable it deliberately — and remember it is unsupported for Windows
containers.

## Interview questions

**★ What is an overlay network and when would you need one?**
A network spanning multiple Docker daemons, so containers on different hosts
share one logical network and resolve each other by name. You need it when
workloads on separate machines must talk as if local. It requires Swarm — hosts
must be members even to attach standalone containers — and it needs 2377/tcp,
7946/tcp+udp and 4789/udp open between them.

**★ Why is an overlay network usually not the answer today?**
Because it commits you to Swarm. Most teams that need multi-host container
networking are heading to Kubernetes, where the CNI plugin provides the same
thing as part of a platform they want for other reasons. For a couple of hosts,
a VPN or mesh between the machines plus ordinary published ports is far less
machinery than either.

**★ Why does Podman not have one?**
An overlay connects daemons, and Podman is daemonless — there is nothing to
cluster. Its supported drivers are `bridge`, `macvlan` and `ipvlan`, and
multi-host is delegated to Kubernetes, which is also why Podman can generate and
consume Kubernetes YAML.

**What are `ingress` and `docker_gwbridge`?**
Networks Swarm creates for you: `ingress` is the overlay network carrying the
routing mesh, and `docker_gwbridge` is the bridge that connects `ingress` to the
host's own interface. They appear automatically on a Swarm node and are not
something you created and forgot.

**Is overlay traffic encrypted?**
Only if you ask. It is `--opt encrypted` at network creation, and the
documentation notes it is not supported for Windows containers. Assuming
encryption by default is the mistake worth avoiding.

---

← Prev: [Custom subnets, IPv6 and the VPN clash](13-subnets-ipv6-and-vpn.md) · Index: [Phase 7](README.md) · Next phase → **Phase 8 — Compose** *(chunk C)*
