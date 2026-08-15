---
title: "Custom subnets, IPv6 and the VPN clash"
sidebar_label: "13 · Custom subnets, IPv6 and the VPN clash"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against [Docker — networking overview](https://docs.docker.com/engine/network/),
> [dockerd](https://docs.docker.com/reference/cli/dockerd/),
> [Docker — use IPv6 networking](https://docs.docker.com/engine/daemon/ipv6/),
> [docker network create](https://docs.docker.com/reference/cli/docker/network/create/) and
> [containers.conf(5)](https://github.com/containers/common/blob/main/docs/containers.conf.5.md).
> **No sandbox** — no console output on this page.

**Docker picks its own private ranges, and one day one of them is the range your
VPN needs.** The symptom is unmistakable once you have seen it: the container
host loses access to something on the corporate network the moment a network is
created, and nothing in the application changed. This page is where the
addresses come from and how to move them.

## Where the addresses come from

> *"When no `--subnet` option is provided, Docker automatically selects a subnet
> from predefined 'default address pools'."*

The built-in default, quoted from the networking overview:

```json
{
  "default-address-pools": [
    { "base": "172.17.0.0/16", "size": 16 },
    { "base": "172.18.0.0/16", "size": 16 },
    { "base": "172.19.0.0/16", "size": 16 },
    { "base": "172.20.0.0/14", "size": 16 },
    { "base": "172.24.0.0/14", "size": 16 },
    { "base": "172.28.0.0/14", "size": 16 },
    { "base": "192.168.0.0/16", "size": 20 }
  ]
}
```

Two things to read out of that list. **`172.17.0.0/16` is first**, which is why
the default bridge lives there on almost every machine. And **`192.168.0.0/16`
is in the list**, which is the range home and office routers use — a collision
that is only a matter of time.

**Podman's equivalent** is `containers.conf`'s `default_subnet`, shipped as
`10.88.0.0/16` — a different range entirely, so "which subnet is Docker's" and
"which is Podman's" have different answers on the same machine.

## The VPN clash

The failure looks like this: connect to the VPN, everything works; run
`docker compose up`, and an internal host stops resolving or stops routing. The
new network was allocated a subnet that overlaps a route the VPN installed, and
the more specific route wins for anything inside it.

Docker cannot detect this. Its own overlap check only compares against networks
*it* knows about — *"Be sure that your subnetworks do not overlap. If they do,
the network create fails and Docker Engine returns an error."* A route belonging
to a VPN is invisible to it, so the allocation succeeds and the breakage is
silent.

**Three ways out, in order of how well they hold:**

1. **Move the pools daemon-wide.** Set `default-address-pools` in
   `/etc/docker/daemon.json` to ranges your organisation does not use, e.g.
   bases in `10.201.0.0/16`-style space, and every future network is allocated
   from them. This is the fix that survives new projects, because nobody has to
   remember anything.
2. **Pin the subnet per network.** `docker network create --subnet …`, or the
   Compose `ipam` block, for the projects that clash. Correct but per-project,
   so the next new stack is a fresh coin toss.
3. **Move the VPN's range.** Rarely yours to decide, and worth mentioning only
   because sometimes the container host is the newcomer and the range genuinely
   was a poor choice.

```yaml
networks:
  default:
    ipam:
      config:
        - subnet: 10.201.5.0/24
```

⚠️ **Pools also limit how many networks you can have.** Each Compose project
takes a subnet, and the documentation notes you *"can divide base subnets into
smaller pools to support more networks"* — a `size` of 24 out of a `/16` base
yields many more networks than the default `size: 16`. "No available IPv4
addresses on this network's address pools" on a busy CI machine is this, not a
leak; `docker network prune` and a finer `size` are the two answers.

## IPv6

**IPv6 is not on by default**, and it is *"only supported on Docker daemons
running on Linux hosts"*.

Daemon-wide, for the default bridge:

```json
{
  "ipv6": true,
  "fixed-cidr-v6": "2001:db8:1::/64"
}
```

Per network:

```bash
docker network create --ipv6 ip6net
docker network create --ipv6 --subnet 2001:db8::/64 ip6net
```

Notes worth carrying:

- **`ip6tables`** provides network isolation for IPv6 and *"is enabled
  by-default, but can be disabled"* — leave it on; disabling it removes the
  filtering that makes IPv6 containers as isolated as IPv4 ones.
- **Without an explicit subnet**, Docker allocates from **Unique Local
  Addresses** — *"`/64` subnets include a 40-bit Global ID based on the Docker
  Engine's randomly generated ID"*. Fine for internal use, not routable on the
  internet.
- ⚠️ **`2001:db8::/64` is documentation-only.** The docs say so explicitly:
  *"The address `2001:db8::/64` in these examples is reserved for use in
  documentation. Replace it with a valid IPv6 network."* Copy-pasting it into a
  real deployment is a small classic.
- **Publishing covers both families.** Publishing a port *"publishes port 80 on
  both IPv6 and IPv4"*, which is worth remembering when you assumed a service
  was IPv4-only ([page 04](04-publishing-ports.md)).

## Gotchas

**Symptom:** Connecting to the VPN works until a Compose project is started,
then internal hosts become unreachable.
**Cause:** The new network was allocated a subnet overlapping a VPN route.
**Fix:** Set `default-address-pools` in `daemon.json` to ranges your
organisation does not use. Pin per-project subnets only as a stopgap.

**Symptom:** `docker network create` fails complaining about overlap.
**Cause:** The requested subnet collides with an existing Docker network —
Docker checks its own, and only its own.
**Fix:** Pick another range or omit `--subnet`. And note the corollary: **no
error is not proof of no clash**, because routes outside Docker are invisible to
that check.

**Symptom:** "No available IPv4 addresses" on a machine with many stacks.
**Cause:** The default pools are exhausted — each project consumes a subnet, and
the built-in `size` is coarse.
**Fix:** `docker network prune` for the abandoned ones, and a finer `size` in
`default-address-pools` to fit more networks in the same space.

**Symptom:** Containers get IPv6 addresses that nothing outside can route to.
**Cause:** With no explicit subnet, Docker allocates Unique Local Addresses —
internal by design.
**Fix:** Assign a real prefix with `--subnet` if the containers must be routable,
and do not use `2001:db8::/64`, which is reserved for documentation.

**Symptom:** Podman and Docker on the same host use unrelated ranges, and only
one clashes.
**Cause:** They are configured separately — Podman's `default_subnet` is
`10.88.0.0/16`, Docker's first pool is `172.17.0.0/16`.
**Fix:** Change each in its own place: `daemon.json` for Docker,
`containers.conf` for Podman. ⚠️ Podman's docs warn not to change it *"if any
containers are currently running on the default network"*.

## Interview questions

**★ A developer says the VPN breaks when they start their stack. What is
happening and how do you fix it for the whole team?**
A Docker network was allocated a subnet overlapping a route the VPN installs, so
traffic for those addresses goes to the bridge instead. Docker's overlap check
only knows about its own networks, so it allocates happily and nothing errors.
The team-wide fix is `default-address-pools` in `daemon.json`, set to ranges the
organisation does not use — every future network then comes from safe space,
with no per-project discipline required.

**★ Where do container subnets come from if you never specify one?**
From the daemon's default address pools — `172.17.0.0/16` first, then further
`172.x` bases and `192.168.0.0/16`. Each network takes one, which is also why a
machine with many stacks can run out and report that no addresses are available.
Podman uses a different default, `10.88.0.0/16`, configured in
`containers.conf`.

**★ Is IPv6 on by default, and what do you have to do?**
No, and it is Linux-only. Enable it daemon-wide with `"ipv6": true` plus
`fixed-cidr-v6`, or per network with `--ipv6` and optionally a subnet. Leave
`ip6tables` enabled — it is on by default and provides the isolation. Without an
explicit subnet you get Unique Local Addresses, which are internal rather than
routable.

**Why can `network create` succeed and still break your machine?**
Because the overlap check compares only against Docker's own networks. Routes
from a VPN, a second engine or the host's own configuration are outside its
view, so an overlapping allocation is accepted and the symptom shows up as
unreachable hosts rather than as an error.

**How would you fit more networks on a CI machine?**
Split the base pools more finely — the documentation notes you can divide base
subnets into smaller pools to support more networks — and prune networks left
behind by finished jobs. The default pool sizes are generous per network, which
is what exhausts the space.

---

← Prev: [Podman's stack: netavark and aardvark-dns](12-netavark-and-aardvark.md) · Index: [Phase 7](README.md) · Next → **Overlay networks and multi-host** *(not written yet)*
