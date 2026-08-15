---
title: "Rootless networking"
sidebar_label: "08 · Rootless networking"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [Docker — rootless mode](https://docs.docker.com/engine/security/rootless/),
> [Docker — rootless troubleshooting](https://docs.docker.com/engine/security/rootless/troubleshoot/),
> [podman-run(1) — `--network`](https://docs.podman.io/en/latest/markdown/podman-run.1.html)
> and [podman-network-create(1)](https://docs.podman.io/en/latest/markdown/podman-network-create.1.html).
> **No sandbox** — no console output on this page.

**An unprivileged user cannot create network interfaces on the host, so rootless
containers get their networking from a TCP/IP stack running in user space
instead of from the kernel's.** Everything odd about rootless networking — the
wrong source IP in your logs, the unreachable `IPAddress` in `inspect`, the
throughput difference, the refusal to bind port 80 — follows from that one
sentence.

This is the same boundary that
[Phase 6's UID mismatch](../phase-6-storage/05-uid-mismatch/02-rootless-and-the-shift.md)
describes for files. There, your user namespace changes what a UID means; here,
it changes who is allowed to touch the host's network stack. One mechanism, two
symptoms.

## What replaces the kernel's networking

Rootful containers get a `veth` pair and a bridge, created by a daemon running
as root. Rootless containers cannot have that, so the traffic is carried by a
**user-mode TCP/IP stack** — a normal process that speaks IP.

| Engine | Rootless stack |
|---|---|
| **Docker** | RootlessKit, with a *network driver* (`slirp4netns`, `pasta`, VPNKit) and a separate *port driver* |
| **Podman** | `pasta` by default; `slirp4netns` before it |

Docker's documentation is direct about the cost: user-mode stacks such as
*"`slirp4netns`, `pasta`, `VPNKit`, and `gvisor-tap-vsock`"* are *"generally
slower than the one in kernel mode"*. It also notes that installing
`slirp4netns` *"may improve the network throughput"* over the fallback, which
tells you the same thing from the other direction — the stack you happen to have
installed determines your throughput.

**Podman's `pasta` copies the host's view:** *"IPv4 and IPv6 addresses and
routes, as well as the pod interface name, are copied from the host"*, and it
defaults to `--dns-forward 169.254.1.1` and `--map-guest-addr 169.254.1.2`.
Those link-local addresses turning up in a container's `/etc/resolv.conf` are
normal, not a misconfiguration.

## The source IP problem

This is the one that costs real time, because nothing errors — the application
simply believes every client is the same machine.

Docker's troubleshooting page states it plainly: source IP addresses **do not
propagate by default** with `docker run -p`. The fixes it documents are to use
the `slirp4netns` RootlessKit *port* driver, or the `pasta` network driver with
the `implicit` port driver — and it adds an important interaction:

> Docker Engine's `userland-proxy` is incompatible with RootlessKit's source IP
> propagation.

So propagation needs `"userland-proxy": false` in
`~/.config/docker/daemon.json` as well as the right driver pair. RootlessKit's
`builtin` port driver did not support source IP propagation at all until v3.0.

Podman's default is friendlier: pasta *"Port forwarding preserves the original
source IP address"*. But **rootless bridge networks are the exception** — there,
*"port forwarding uses `rootlessport` by default"*, and switching that to pasta
is what gives you kernel-level forwarding that *"preserves the original client
source IP address inside the container"*.

🔴 **What actually breaks when the source IP is wrong:**

- Rate limiting by IP throttles every client at once, or never triggers.
- Allow-lists and deny-lists match the gateway, so they either pass everything
  or block everything.
- Access logs and analytics are worthless.
- Anything geo-locating a request gets your own host.

None of it is visible in development, where you are the only client. It shows up
the first time real traffic arrives — which is why this belongs in your head
before then.

## The other rootless surprises

**`docker inspect` shows an IP you cannot reach.** The documented reason: the
`IPAddress` is *"namespaced inside RootlessKit's network namespace"*, so it is
unreachable from the host. Use `docker run -p` and talk to the published port —
the address in `inspect` is real, just not in your namespace.

**Ports below 1024 fail.** An unprivileged process cannot bind them. That has
its own page — [09 · Privileged ports rootless](09-privileged-ports-rootless.md) —
and the short version is that the documented options are the
`net.ipv4.ip_unprivileged_port_start` sysctl, granting `CAP_NET_BIND_SERVICE` to
the `rootlesskit` binary, or *"choose a larger port number (>= 1024)"* — and the
last one is usually right.

**`ping` may not work.** Documented as failing when
`/proc/sys/net/ipv4/ping_group_range` is set to `1 0`, which is a host sysctl
rather than anything about the container. A failing `ping` is therefore not
evidence that networking is broken — test with the actual protocol instead.

**`macvlan` and `ipvlan` are unavailable.** Podman states it outright: rootless,
those drivers *"have no access to the host network interfaces because rootless
networking requires a separate network namespace"*
([page 05](05-network-drivers.md)).

## What does *not* change

Worth saying, because the list above reads alarmingly:

- **Container-to-container networking is normal.** Names resolve, service
  discovery works, a user-defined bridge behaves as it does rootful
  ([page 02](02-service-discovery.md)).
- **Publishing works.** `-p` maps host ports as usual, above 1024.
- **Outbound connections work.** Pulling images, calling APIs, reaching a
  database elsewhere — all unaffected in behaviour, only in throughput.

The failures are all at the **boundary with the host**: which IP the host sees,
which ports you may bind, which host interfaces you may attach to.

## Choosing, in practice

| Situation | What to do |
|---|---|
| Development, rootless | Leave the defaults. The differences do not matter for one developer |
| Anything that logs, rate-limits or filters by client IP | Fix source IP propagation deliberately — pasta on Podman, and on Docker the documented driver pair **plus** `userland-proxy: false` |
| Throughput-sensitive service | Measure it. A user-mode stack is *"generally slower"*, and if that matters, rootful or `--network host` are the honest answers |
| Needs port 80/443 directly | Use a reverse proxy on the host, or the sysctl — see page 09 |
| Needs an address on the physical LAN | Not possible rootless. That is a rootful deployment |

## Gotchas

**Symptom:** Every request in the application's logs comes from the same
address, usually the gateway.
**Cause:** Rootless port forwarding does not propagate the source IP by default.
**Fix:** On Podman, prefer pasta (and note that rootless *bridge* networks use
`rootlessport` unless you switch them). On Docker, use the documented driver
combination **and** set `"userland-proxy": false` — they are incompatible
otherwise.

**Symptom:** `docker inspect` gives a container IP, and nothing on the host can
reach it.
**Cause:** That address lives inside RootlessKit's network namespace.
**Fix:** Publish a port and use it. The address is not meant to be reachable
from the host in rootless mode.

**Symptom:** `podman run -p 80:80` fails as your user but works under `sudo`.
**Cause:** Binding a privileged port needs a capability an ordinary user does
not have.
**Fix:** Publish 8080 and put a proxy in front, or apply the documented sysctl.
Page 09 covers the trade.

**Symptom:** `ping` from inside a rootless container fails, so networking looks
broken.
**Cause:** `ping` needs `/proc/sys/net/ipv4/ping_group_range` to include your
group; it is documented as failing when that is `1 0`.
**Fix:** Test with the real protocol — a TCP connection to the service — before
concluding anything from ICMP.

**Symptom:** Transfers are noticeably slower than the same stack rootful.
**Cause:** The traffic is going through a user-mode TCP/IP stack, which the
documentation says is generally slower than the kernel's.
**Fix:** Check which network driver is actually in use — installing
`slirp4netns` is documented as possibly improving throughput — and if it still
matters, this is a real reason to run that particular workload rootful.

## Interview questions

**★ Why is rootless networking different at all?**
Because an unprivileged user cannot create or configure interfaces in the host's
network namespace. The engine therefore routes container traffic through a
user-mode TCP/IP stack — RootlessKit with `slirp4netns` or `pasta` under Docker,
`pasta` by default under Podman. Everything else about rootless networking is a
consequence: the source IP, the namespaced container address, the throughput
difference, and the privileged-port restriction.

**★ Your application sees every client as the same IP address. What is
happening?**
Source IP propagation is off. Rootless port forwarding rewrites the source
address unless the right drivers are in use; Docker's documentation says it does
not propagate by default with `docker run -p`, and that the `userland-proxy` is
incompatible with RootlessKit's propagation, so it has to be disabled too.
Podman's pasta preserves the original source address, but rootless *bridge*
networks forward through `rootlessport` unless switched. It matters for rate
limiting, allow-lists and logs — none of which fail visibly in development.

**★ What is rootless networking *not* a problem for?**
Container-to-container traffic. Names resolve, user-defined networks work, and
publishing above 1024 behaves normally. The differences are all at the boundary
with the host — the source address the host presents, the ports you may bind,
and the host interfaces you may attach to.

**Why can't you reach the IP that `docker inspect` reports?**
It is namespaced inside RootlessKit's network namespace, so it means nothing on
the host. Publish a port instead; the container address is only meaningful to
other containers in that namespace.

**What is `pasta`, and what did it replace?**
The user-mode network stack Podman uses by default for rootless containers,
replacing `slirp4netns`. It copies the host's addresses, routes and interface
name into the container, forwards DNS through a link-local address, and — the
practical difference — preserves the original source IP when forwarding ports.

**When should a workload not be rootless?**
When it needs an address on the physical network (macvlan and ipvlan cannot
attach to host interfaces rootless), when it must bind a privileged port and a
proxy is not acceptable, or when the throughput of a user-mode stack is
measurably not enough. Those are real reasons; "it was easier" is not, because
rootless removes an entire class of host compromise.

---

← Prev: [Reaching the host from inside](07-reaching-the-host.md) · Index: [Phase 7](README.md) · Next → [Privileged ports rootless](09-privileged-ports-rootless.md)
