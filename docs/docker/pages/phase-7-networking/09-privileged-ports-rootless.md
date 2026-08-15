---
title: "Privileged ports rootless"
sidebar_label: "09 · Privileged ports rootless"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [Docker — rootless troubleshooting](https://docs.docker.com/engine/security/rootless/troubleshoot/),
> [Docker — rootless mode](https://docs.docker.com/engine/security/rootless/) and the
> [Podman troubleshooting guide](https://github.com/containers/podman/blob/main/troubleshooting.md).
> **No sandbox** — no console output on this page.

**Binding a port below 1024 is a privilege, and a rootless engine does not have
it.** The kernel rule is older than containers and has nothing to do with them:
Podman's own troubleshooting guide states it in one line — *"Unprivileged users
on a Linux system can not bind to ports below 1024 by default."*

## Where the restriction actually applies

🔴 **It is the *host* side of the mapping that fails, not the container's port.**
Podman's documented error message says so literally:

> *"Listen failed for HOST TCP port \*/80: Permission denied"*

So this fails:

```bash
podman run -p 80:80 nginx        # binding host port 80 as your user
```

and this is fine:

```bash
podman run -p 8080:80 nginx      # host 8080; the container still serves on 80
```

The process inside the container binds 80 within its own namespace, where it is
root ([Phase 6 · a UID is just a number](../phase-6-storage/05-uid-mismatch/01-a-uid-is-just-a-number.md)).
Only the engine's attempt to hold host port 80 as your unprivileged user is
refused. Once that clicks, the whole topic is about how to get traffic from the
outside world's port 443 to a host port your user is allowed to bind.

Docker's message points at the same restriction and lists its fixes inline: add
`"net.ipv4.ip_unprivileged_port_start=0"` to `/etc/sysctl.conf`, set
`CAP_NET_BIND_SERVICE` on the `rootlesskit` binary, or *"choose a larger port
number (>= 1024)"*.

## The four answers, best first

### 1. Publish a high port and put something in front

Docker's troubleshooting page recommends exactly this: *"consider using an
unprivileged port instead. For example, 8080 instead of 80."*

In production there is almost always already something terminating TLS on 443 —
a reverse proxy, an ingress, a cloud load balancer. It forwards to 8080, and the
question never arises. **This is the answer that needs no host-wide change and no
capability**, and it is the one to reach for first.

### 2. Lower the unprivileged-port threshold

```bash
sudo sh -c "echo 80 > /proc/sys/net/ipv4/ip_unprivileged_port_start"
```

Podman's guide gives that command, and the permanent form —
`/etc/sysctl.d/99-mysettings.conf` containing
`net.ipv4.ip_unprivileged_port_start=80`.

⚠️ **Two things to weigh, and they are the whole reason this is second and not
first:**

- **It is host-wide.** Every unprivileged process on that machine — not just
  your engine — may now bind from that number upward. On a single-purpose VM
  that is acceptable; on a shared box it is a policy change you do not own.
- **Set it as high as you can.** Docker's message suggests `0`; Podman's guide
  uses `80`. Prefer the narrowest value that unblocks you — `80` still leaves
  every port below it protected, and there is no reason to open 1–79 to bind a
  web server.

### 3. Give the binary the capability (Docker)

Docker's third documented option is `CAP_NET_BIND_SERVICE` on the `rootlesskit`
binary. This is narrower than the sysctl — one program gains the ability, not
every process on the host — at the cost of being a change to an installed file
that a package upgrade can silently revert. Note it applies to
**`rootlesskit`**, the component that actually holds the host port, not to the
container's process.

### 4. Run that particular workload rootful

Sometimes the honest answer. If a host genuinely must serve on 443 with no proxy
in front, a rootful engine — or a systemd-managed container with the socket
opened by systemd — is a legitimate choice. Weigh it against what rootless was
bought for: an escape from the container is an escape to *your user*, not to
root. Giving that up so a port number can be 443 rather than 8443 is rarely a
good trade.

## The decision, compressed

| Situation | Do this |
|---|---|
| Anything with a proxy, ingress or load balancer in front | Publish 8080/8443. Nothing else needed |
| Single-purpose VM you control, no proxy | `ip_unprivileged_port_start`, set to the highest value that works |
| Shared host, other users | Do **not** change the sysctl. Proxy, or the capability on `rootlesskit` |
| Must have 443, no proxy possible, strict environment | Rootful, or systemd socket activation — deliberately, and written down |

## Podman and Docker, side by side

The restriction is the kernel's, so both engines hit it identically and the
sysctl fixes both. The differences are in the surroundings:

- **Docker rootless** routes host ports through **RootlessKit**, which is why
  `CAP_NET_BIND_SERVICE` is documented against the `rootlesskit` binary.
- **Podman rootless** forwards through **pasta** (or `rootlessport` on rootless
  bridge networks — [page 08](08-rootless-networking.md)), and its error surfaces
  as `Listen failed` from pasta itself.
- **Neither engine is doing anything unusual.** The same `sudo`-less failure
  happens to a plain `python -m http.server 80`.

⚠️ **`sudo podman` is not the same engine.** Running the command with `sudo`
does succeed, because root may bind port 80 — but it uses root's containers,
root's images and root's volumes. A container that "only works with `sudo`" is
usually a different container entirely, not a permissions fix.

## Gotchas

**Symptom:** `podman run -p 80:80` fails with a permission error; the identical
command works on a colleague's machine.
**Cause:** Their host has `net.ipv4.ip_unprivileged_port_start` lowered, or they
are running rootful.
**Fix:** Check the sysctl before concluding anything about the image or the
engine. Then decide deliberately which of the four answers you want.

**Symptom:** Someone "fixed" it with `sudo podman run …` and now the volumes are
empty and the image is being pulled again.
**Cause:** Rootful Podman is a separate world — separate storage, separate
images, separate volumes.
**Fix:** Go back to rootless and publish a high port. Use `sudo` only when
rootful is the actual decision.

**Symptom:** The sysctl was set at runtime and the failure returns after a
reboot.
**Cause:** `/proc/sys/...` is not persistent.
**Fix:** Write it to `/etc/sysctl.d/`, as Podman's guide shows.

**Symptom:** A container serving on port 80 internally is assumed to need host
port 80.
**Cause:** Confusing the two halves of the mapping. The container's own port is
bound inside its namespace and is unaffected.
**Fix:** `-p 8080:80`. The image needs no change at all.

**Symptom:** `CAP_NET_BIND_SERVICE` was set on `rootlesskit` and stopped working
after a package update.
**Cause:** File capabilities live on the binary; replacing the binary drops
them.
**Fix:** Re-apply after upgrades, or prefer the sysctl or a proxy — both survive
updates.

## Interview questions

**★ Why can't a rootless container publish port 80, and what exactly is
refused?**
Because the kernel does not let unprivileged users bind ports below 1024, and
the engine holds the **host** side of a published port as your user — Podman's
error names the host port explicitly. The container's own listener on 80 is
unaffected: it binds inside its namespace, where it is root. So `-p 8080:80`
works untouched.

**★ What are the ways around it, and which would you pick?**
Publish a high port and let a proxy or load balancer own 443 — no host change,
no capability, and it is what production looks like anyway. Failing that, lower
`net.ipv4.ip_unprivileged_port_start`, set as high as possible and made
persistent in `/etc/sysctl.d/`; or grant `CAP_NET_BIND_SERVICE` to the
`rootlesskit` binary, which is narrower but is lost on upgrade; or decide that
this workload runs rootful. I would take the first unless something specific
ruled it out.

**★ What is wrong with just setting the sysctl to 0?**
It applies to every unprivileged process on the host, not just your engine, so
any user can then bind any port — including 22 and 53. If you need it at all,
set it to the highest value that unblocks you; Podman's own guide uses `80`
rather than `0` for that reason.

**Is `sudo podman run` a fix?**
No — it is a different engine. Rootful Podman has its own storage, images and
volumes, so the container is not the one you were running, and you have given up
the isolation rootless was chosen for. It is a decision, not a workaround.

**Does this restriction have anything to do with containers?**
No. It is a standard Linux rule about binding privileged ports, and a plain
`python -m http.server 80` as an ordinary user fails the same way. Containers
only make it visible more often, because publishing a port is such a routine
thing to do.

**How does this interact with the rest of rootless networking?**
It is one of the same family of host-boundary limits: the source IP that does
not propagate, the container address that is namespaced away, the host
interfaces macvlan cannot reach. All of them come from the container's traffic
being handled outside the kernel's privileged path — the subject of the previous
page.

---

← Prev: [Rootless networking](08-rootless-networking.md) · Index: [Phase 7](README.md) · Next → [`--network=host`](10-network-host.md)
