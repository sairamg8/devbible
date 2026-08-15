---
title: "Podman's stack: netavark and aardvark-dns"
sidebar_label: "12 · netavark and aardvark-dns"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [netavark](https://github.com/containers/netavark),
> [aardvark-dns](https://github.com/containers/aardvark-dns),
> [Podman — basic networking](https://github.com/containers/podman/blob/main/docs/tutorials/basic_networking.md),
> [containers.conf(5)](https://github.com/containers/common/blob/main/docs/containers.conf.5.md)
> and [podman-network-create(1)](https://docs.podman.io/en/latest/markdown/podman-network-create.1.html).
> **No sandbox** — no console output on this page.

**Podman has no daemon, so its networking is two ordinary programs: one that
builds the plumbing and one that answers names.** Knowing which is which turns a
confusing error into a one-line diagnosis, because their failures look nothing
alike.

## The two components

**`netavark`** — *"a rust based network stack for containers … designed to work
with Podman but also applicable for other OCI container management
applications"*. It does everything structural:

- *"creation and management of required network interfaces, including MACVLAN
  networks"*
- *"all required firewall configuration to perform NAT and port forwarding as
  required for containers"*, with drivers for **firewalld and nftables**

It is invoked by Podman when a container starts and again when it stops. It
requires **Podman 4.0+**.

**`aardvark-dns`** — *"an authoritative dns server for `A/AAAA` container
records. It can forward other requests to configured resolvers."* It is *"mostly
intended to be used with Netavark which will launch it automatically if both are
installed"*. So you never start it yourself; netavark does, when a network with
DNS enabled has containers on it.

The division is clean and worth memorising: **netavark = interfaces, NAT, port
forwarding, firewall rules. aardvark-dns = container names.**

## Which error comes from where

This is the payoff. Four rough categories:

| What you see | Who is speaking | Where to look |
|---|---|---|
| Container starts but a **name does not resolve** | `aardvark-dns` (or its absence) | Is DNS enabled on that network? Is aardvark-dns installed? |
| Failure **creating or starting** the container's interface, NAT or firewall rules | `netavark` | Network config in `/etc/containers/networks`, firewall backend |
| `Listen failed for HOST TCP port …` | **pasta**, not netavark | A privileged port, or one already held ([page 09](09-privileged-ports-rootless.md)) |
| Rootless container's IP unreachable *from the host* | Neither — expected | Join the namespace: `podman unshare --rootless-netns` ([page 11](11-debugging-the-network.md)) |

⚠️ **`netavark` errors mention interfaces, routes, NAT or the firewall.
`aardvark-dns` problems always present as name resolution and nothing else.** If
the connection is refused by IP as well as by name, DNS was never the problem.

## The default network has no DNS

🔴 The single most surprising fact in Podman's networking, and the one that
sends people to page 01 twice:

> *"The default network `podman` with netavark is memory-only. It does not
> support dns resolution because of backwards compatibility with Docker."*

So the default network behaves exactly like Docker's default bridge — no name
resolution — while a network you **create** has DNS on by default, which is why
`podman network create` needs an explicit `--disable-dns` flag to turn it off.
Same rule as Docker, different machinery: **create a network and name it.**

## Which backend is actually in use

Podman 4 introduced netavark alongside the older **CNI** stack, and
`containers.conf` documents how the choice is made:

> *"Network backend determines what network driver will be used to set up and
> tear down container networks. Valid values are `"cni"` and `"netavark"`. The
> default value is empty which means that it will automatically choose CNI or
> netavark. If there are already containers/images or CNI networks preset it
> will choose CNI."*

🔴 **That last sentence is the migration trap.** A machine upgraded from an older
Podman, with existing containers or CNI network files, keeps using **CNI**
silently. Everything works, but the advice you read about netavark and
aardvark-dns does not apply to it, and neither do the error messages.

**The quickest tell is the config directory**, which the same reference states
differs per backend:

| Backend | Network config directory |
|---|---|
| **CNI** | `/etc/cni/net.d` (root), `$HOME/.config/cni/net.d` (rootless) |
| **netavark** | `/etc/containers/networks` (root), `$graphroot/networks` (rootless) |

Whichever directory holds your network files is the backend that created them.
`podman info` is where the engine reports its own configuration if you would
rather ask it directly, and `network_backend` in `containers.conf` is what
pins it.

## Two settings worth knowing

- **`default_subnet`** — *"The subnet to use for the default network"*, shipped
  as `10.88.0.0/16`. ⚠️ *"This should not be changed if any containers are
  currently running on the default network."* Note that this is Podman's range,
  not Docker's — a useful thing to know when working out whose subnet is
  colliding with your VPN (page 13).
- **`dns_bind_port`** — *"Port to use for dns forwarding daemon with netavark in
  rootful bridge mode and dns enabled"*, default **53**. The documented reason to
  change it is that *"other dns services should run on the machine"* — a
  systemd-resolved or dnsmasq already holding 53 is the usual conflict.

(`aardvark-dns`'s own CLI defaults to port **5533** when run by hand; the bind
port above is what Podman configures in normal use. Do not confuse the two
numbers.)

## Why it is built this way

The whole design follows from being daemonless. Docker's `dockerd` holds network
state in memory and re-applies it; Podman has no such process, so the
configuration lives in files and the work is done by short-lived helpers invoked
at container start and stop. The consequences show up all over this track: no
daemon to re-assert restart policies, no daemon to keep the bridge configured,
and — here — networking that is genuinely a pair of programs you can inspect and
run yourself. Phase 11 collects the daemonless story.

## Gotchas

**Symptom:** Container names do not resolve on Podman, on a machine where
everything else works.
**Cause:** Either the containers are on the default `podman` network, which does
not support DNS resolution, or `aardvark-dns` is not installed for netavark to
launch.
**Fix:** Create a network and use it. Check the package is present before
assuming a bug.

**Symptom:** Advice about netavark makes no difference on this host.
**Cause:** The host is still on **CNI** — the backend chooses CNI automatically
when containers or CNI network files already exist from an earlier version.
**Fix:** Look at which config directory holds your networks, and set
`network_backend` in `containers.conf` deliberately rather than relying on
detection.

**Symptom:** Podman fails to start a container with an error about the firewall
or an interface.
**Cause:** netavark, not DNS. It owns interfaces, NAT and firewall rules, with
firewalld and nftables drivers.
**Fix:** Read the message as a firewall or interface problem — check the
firewall backend on the host — and do not spend time on name resolution.

**Symptom:** DNS forwarding fails on a rootful host and something else is
already on port 53.
**Cause:** netavark's forwarding daemon binds `dns_bind_port`, default 53.
**Fix:** Set `dns_bind_port` to something free, which is exactly the case the
documentation names.

**Symptom:** The default network's subnet clashes with a corporate range.
**Cause:** Podman's `default_subnet` ships as `10.88.0.0/16`, a different range
from Docker's defaults.
**Fix:** Change it in `containers.conf` — but *"not … if any containers are
currently running on the default network"*.

## Interview questions

**★ What are netavark and aardvark-dns, and how do they split the work?**
They are Podman's networking stack from 4.0 onward, in place of CNI. netavark is
a Rust network stack that creates the interfaces (including macvlan) and writes
all the NAT, port-forwarding and firewall configuration, with firewalld and
nftables drivers. aardvark-dns is an authoritative DNS server for container
`A`/`AAAA` records that forwards everything else to the configured resolvers,
and netavark launches it automatically when both are installed. Structural
failures are netavark's; anything that is purely a name is aardvark's.

**★ Why might a machine not be using netavark at all?**
Because the backend is auto-detected: `containers.conf` documents that an empty
`network_backend` chooses CNI *if there are already containers, images or CNI
networks present*. An upgraded host therefore keeps CNI silently. The config
directory gives it away — `/etc/cni/net.d` versus `/etc/containers/networks` —
and setting `network_backend` explicitly removes the ambiguity.

**★ Does Podman's default network resolve container names?**
No. Its documentation says the default `podman` network *"does not support dns
resolution because of backwards compatibility with Docker"*. A network you
create does have DNS enabled by default — `podman network create` has a
`--disable-dns` flag for the opposite case — so the portable habit is identical
on both engines: create a network and name it.

**How does this differ from Docker's arrangement?**
Docker's daemon owns networking and keeps the state in process; Podman is
daemonless, so configuration lives in files and short-lived helpers apply it at
container start and stop. That is why Podman's networking is two programs you
can name, inspect and run, rather than a subsystem inside a long-running
service.

**Something is not reachable — how do you tell DNS from everything else?**
Try the IP. If the connection works by address and fails by name, it is
aardvark-dns or a network without DNS enabled. If it fails both ways, name
resolution is irrelevant and the problem is the interface, the firewall, the
port or the listener.

---

← Prev: [Debugging the network](11-debugging-the-network.md) · Index: [Phase 7](README.md) · Next → **Custom subnets, IPv6 and the VPN clash** *(not written yet)*
