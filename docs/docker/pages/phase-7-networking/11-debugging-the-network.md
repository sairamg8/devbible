---
title: "Debugging the network"
sidebar_label: "11 · Debugging the network"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [Docker — networking overview](https://docs.docker.com/engine/network/),
> [docker network inspect](https://docs.docker.com/reference/cli/docker/network/inspect/),
> [podman-run(1) — `--network`](https://docs.podman.io/en/latest/markdown/podman-run.1.html)
> and [podman-unshare(1)](https://docs.podman.io/en/latest/markdown/podman-unshare.1.html).
> **No sandbox** — no console output on this page.

**Ask the question from inside the container, because the host is not in the
container's network namespace and its answers are about a different machine.**
A name that resolves on your laptop, a port that answers from your shell, a
`ping` that works from the host — none of them are evidence about what the
container can do. This page is the ladder to climb instead, and how to climb it
when the image has no tools in it.

## The ladder

Five questions, in this order. Each one eliminates a whole class of cause, and
the phase gate is being able to get through them in about two minutes.

**1 · Are both containers actually on the same network?**

```bash
docker network inspect app-net
```

The container list is the answer ([page 06](06-network-commands.md)). More
"cannot connect" reports end here than anywhere else — two Compose projects,
a service on the default bridge, a container that never joined.

**2 · Does the name resolve *inside* the container?**

```bash
docker exec -it api getent hosts db      # or: nslookup db / dig db
```

On a user-defined network the lookup goes to Docker's embedded resolver — *"The
embedded DNS server address is `127.0.0.11`"* — while a default-bridge container
instead receives *"a copy of the host's `/etc/resolv.conf`"* and gets no
container names at all ([page 01](01-default-vs-user-defined-bridge.md)).

**3 · Does a TCP connection to the port open?**

```bash
docker exec -it api curl -sv telnet://db:5432
```

Use the **container's** port, not the published one
([page 02](02-service-discovery.md)). A resolving name plus a refused connection
means the name is fine and the listener is not.

**4 · Is the server bound where you think?**

```bash
docker exec -it db ss -tlnp
```

A listener on `127.0.0.1` inside the container serves nobody outside it — the
single most common connection bug in the track
([page 03](03-localhost-is-the-container.md)). This is where you find it.

**5 · Only now, look from the host.**

If containers talk to each other but you cannot reach the service from your
laptop, the problem is publishing, not networking
([page 04](04-publishing-ports.md)) — check the mapping, the host interface it
bound to, and whether something else already holds that host port.

## When the image has no shell

Steps 2–4 assume you can run something inside the container. A distroless or
`scratch` image has no shell, no `curl` and no `ss`
(**Phase 5 · distroless and scratch**, chunk A). Two ways in, and the first is
the good one.

### Join its network namespace from a container that does have tools

```bash
docker run -it --rm --network container:api nicolaka/netshoot
podman run -it --rm --network container:api nicolaka/netshoot
```

`--network container:<name|id>` *"Allows attaching a container directly to
another container's networking stack"*, so the debug container sees **exactly**
what the target sees: the same interfaces, the same `/etc/resolv.conf`, the same
listeners on `localhost`. Every answer it gives is authoritative for the target.

`netshoot` is the conventional image for this — a small image whose only purpose
is to carry `dig`, `curl`, `ss`, `tcpdump`, `nmap` and friends. Any image with
the tools you need works the same way; the mechanism is the flag, not the image.

🔴 **This is the technique to remember from the whole page.** It needs no change
to the target image, no rebuild, no restart, and it works on a container that is
mid-incident.

### `nsenter` from the host

```bash
sudo nsenter -t <pid> -n ss -tlnp        # -n = the network namespace only
```

Enters the target's network namespace with a host binary, so the tools come from
the host rather than from the image. It needs root and the container's PID
(`docker inspect` reports it), which makes it the second choice on a rootful
host and awkward on a rootless one.

**Podman rootless has a specific version of this problem:** a rootless
container's IP is inside a network namespace the host is not in, so you cannot
reach it directly. `podman unshare --rootless-netns` exists for exactly that —
it joins *"the rootless network namespace used for netavark networking"*, which
lets you *"connect to a rootless container via IP address (bridge networking).
This is otherwise not possible from the host network namespace."* It is the
network sibling of the `podman unshare` used for file ownership in
[Phase 6](../phase-6-storage/05-uid-mismatch/03-the-fixes.md).

## What each tool answers

| Tool | The question it answers |
|---|---|
| `docker network inspect` | Are they on the same network? What is its subnet? |
| `getent hosts` / `dig` / `nslookup` | Does the name resolve, and to what? |
| `curl -v` / `nc` | Does a connection open, and does the service speak? |
| `ss -tlnp` | What is listening, and **on which address**? |
| `ip addr` / `ip route` | Which interfaces and routes does this namespace have? |
| `tcpdump` | Do the packets arrive at all? (Last resort — the earlier steps are faster) |

⚠️ **Do not install tools into the container you are debugging.** `apt install
curl` changes the thing under investigation, may not be possible on a read-only
root filesystem, and is lost on the next deploy anyway. A sidecar on the same
namespace gives better answers with no side effects.

⚠️ **`ping` is not a network test here.** ICMP can be blocked, and rootless
containers depend on the host's `ping_group_range`
([page 08](08-rootless-networking.md)). A failed `ping` with a working TCP
connection is normal. Test the protocol you actually use.

## Gotchas

**Symptom:** The name resolves from your shell on the host, so DNS is declared
fine.
**Cause:** The host uses the host's resolver. The container may be on a
different network with a different resolver, or on the default bridge with no
container names at all.
**Fix:** Resolve from inside the container — with a sidecar on
`--network container:` if the image has no tools.

**Symptom:** No shell in the image, so debugging stops.
**Cause:** Distroless and `scratch` images deliberately contain no tooling.
**Fix:** `--network container:<target>` with a tool-carrying image. Same
namespace, full toolkit, no change to the target.

**Symptom:** A rootless Podman container's IP does not answer from the host.
**Cause:** That address lives in the rootless network namespace, which the host
is not in.
**Fix:** `podman unshare --rootless-netns` to join it, or just use the published
port.

**Symptom:** `tcpdump` was the first thing tried and an hour later there is
still no answer.
**Cause:** Starting at the bottom of the stack. Packet capture is precise and
slow.
**Fix:** Walk the ladder — network membership, name, connection, listener — and
reach for capture only when those are all clean.

**Symptom:** A debug sidecar shows different behaviour from the real container.
**Cause:** It was started on the *network* rather than on the container's
namespace — `--network app-net` instead of `--network container:api`.
**Fix:** Use `container:`. The whole value of the technique is being in the same
namespace, not merely on the same network.

## Interview questions

**★ "The API can't reach the database." Walk me through it.**
Check they are on the same network with `network inspect` — that is the most
common cause on its own. Then, from inside the API container, resolve the
database's name; then open a TCP connection to the **container** port; then
check what the database is actually listening on with `ss -tlnp`, since a
listener on `127.0.0.1` inside the container is unreachable. Only if all of that
is clean do I look at publishing and the host, because that is a different
question.

**★ How do you debug a container with no shell in it?**
Start a second container in the target's network namespace:
`docker run --rm -it --network container:api nicolaka/netshoot`. It sees the
same interfaces, resolver and listeners as the target, so its answers apply
directly — and the target image is untouched. On a rootful host `nsenter -t
<pid> -n` does the same thing with host binaries; for rootless Podman,
`podman unshare --rootless-netns` joins the namespace that container IPs live
in.

**★ Why is testing from the host misleading?**
Because the host is in a different network namespace. Its resolver, its
interfaces and its routes are not the container's. A name that resolves on the
host may not resolve in the container, and a port that answers on the host may
be answering because of a published mapping that has nothing to do with
container-to-container traffic.

**When is `tcpdump` the right tool?**
When membership, DNS, the connection and the listener are all verified and the
behaviour still makes no sense — asymmetric routing, an MTU problem, a proxy
rewriting things. It answers precisely but slowly, so it belongs at the end of
the ladder rather than the start.

**Why not just install `curl` in the container?**
It changes the artefact under investigation, fails on a read-only root
filesystem, is lost on redeploy, and it grows the image if anyone commits the
change. A sidecar sharing the namespace answers the same question with none of
that.

---

← Prev: [`--network=host`](10-network-host.md) · Index: [Phase 7](README.md) · Next → [Podman's stack: netavark and aardvark-dns](12-netavark-and-aardvark.md)
