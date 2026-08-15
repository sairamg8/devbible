---
title: "Reaching the host from inside"
sidebar_label: "07 · Reaching the host from inside"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [docker container run — `--add-host`](https://docs.docker.com/reference/cli/docker/container/run/),
> [dockerd — `host-gateway-ip`](https://docs.docker.com/reference/cli/dockerd/),
> [Docker Desktop networking how-tos](https://docs.docker.com/desktop/features/networking/networking-how-tos/)
> and [podman-run(1) — `--add-host`](https://docs.podman.io/en/latest/markdown/podman-run.1.html).
> **No sandbox** — no console output on this page.

**A container's `localhost` is the container, so reaching a service running on
your laptop needs a name for the host — and the name is not automatic
everywhere.** Docker Desktop resolves `host.docker.internal` for you; Docker
Engine on Linux makes you ask for it; Podman adds both its own name and Docker's
by default. Knowing which of those you are on is the whole topic.

## The problem

Something is running **on the host, not in a container** — a database installed
with your package manager, a `yarn dev` server, an SSH tunnel to staging — and a
container needs to reach it.

`localhost` inside the container is the container itself
([page 03](03-localhost-is-the-container.md)), so it fails. The container needs
the host's address on the bridge network, and hard-coding one is exactly the
brittle thing to avoid: it differs per network, per machine and after a restart.

## `host-gateway`, and the name it is usually given

Docker's answer is a special value for `--add-host`:

> *"The `--add-host` flag supports a special `host-gateway` value that resolves
> to the internal IP address of the host."*

and the daemon reference says what that address actually is:

> *"By default, `host-gateway` resolves to the IPv4 address of the default
> bridge, and its IPv6 address if it has one."*

The name is a convention, not a built-in:

> *"It's conventional to use `host.docker.internal` as the hostname referring to
> `host-gateway`."*

So on Docker Engine you write it out — the reference's own example does exactly
this:

```bash
docker run --add-host host.docker.internal=host-gateway myimage
docker run --add-host host.docker.internal:host-gateway myimage    # : also accepted
```

In Compose:

```yaml
services:
  api:
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

🔴 **This is the Linux caveat the syllabus row names.** On **Docker Desktop**,
`host.docker.internal` *"resolves to the internal IP address of your host"*
without any flag — which is why a colleague's setup "just works" on a Mac and
yours does not on a Linux server. On **Docker Engine** the name exists only
because you added it. Put the `extra_hosts` line in the compose file and both
behave the same.

Docker Desktop also provides **`gateway.docker.internal`**, which *"resolves to
the gateway IP of the Docker VM"* — a different address, and a Desktop-only
detail rather than something to build on.

The address `host-gateway` maps to is configurable daemon-wide with the
`--host-gateway-ip` flag or the `host-gateway-ip` / `host-gateway-ips` keys in
`daemon.json`, which matters when the default bridge is not the interface you
want containers reaching the host on.

## The half everyone forgets: what the host is listening on

Adding the name fixes DNS. It does **not** fix a service that is not listening
where the container can reach it, and this is the failure that eats an
afternoon.

A development server started as `localhost:5173` or a Postgres with
`listen_addresses = 'localhost'` is bound to the host's **loopback**. Traffic
arriving from a container arrives on the bridge interface, not on loopback, so
it is refused — the name resolved perfectly and there is nothing listening at
that address.

**The fix is on the host, not in the container:** bind the service to `0.0.0.0`
(or to the bridge address specifically). It is the mirror image of
[page 03](03-localhost-is-the-container.md), where the server inside the
container bound to loopback and the published port forwarded to nothing. Same
mistake, opposite direction.

⚠️ **And notice what binding `0.0.0.0` on the host means:** the dev server is now
reachable from your network, not just from containers. On a laptop on shared
Wi-Fi that is a real exposure. Bind to the bridge address rather than to
everything if you can, and treat `0.0.0.0` as a deliberate choice.

## Podman

Podman does more of this for you. From `podman-run(1)`:

> *"The `host-gateway` address is also used by Podman to automatically add the
> `host.containers.internal` and `host.docker.internal` hostnames to
> `/etc/hosts`."*

Two things follow:

- **`host.containers.internal` is the engine-neutral name** — it is the one to
  reach for in anything Podman-first.
- **`host.docker.internal` also works under Podman without `--add-host`**, which
  is a deliberate compatibility choice. So a compose file written for Docker
  Desktop tends to work under Podman unchanged, while the same file on Docker
  Engine needs the `extra_hosts` line. Counter-intuitive, and worth knowing
  before you conclude that Podman is "broken" because the reverse happened.

Two caveats, both documented and both quiet:

> *"If no host-gateway address was configured manually and Podman fails to
> determine the IP address automatically, Podman will silently skip adding these
> internal hostnames to `/etc/hosts`."*

> *"If Podman is running in a virtual machine using `podman machine` (this
> includes Mac and Windows hosts), Podman will silently skip adding the internal
> hostnames to `/etc/hosts`, unless an IP address was configured manually; the
> internal hostnames are resolved by the gvproxy DNS resolver instead."*

**"Silently skip"** is the phrase to remember: the failure mode is a name that
does not resolve, with no warning at start-up. You can also switch the behaviour
off deliberately — `--no-hosts`, or `host_containers_internal_ip="none"` in
`containers.conf`.

## The alternatives, and when they are right

| Approach | When it fits |
|---|---|
| `host.docker.internal` / `host.containers.internal` via `host-gateway` | The default answer. Portable across machines, survives restarts |
| `--network host` | You already wanted host networking for other reasons — then the host's services really are on `localhost` ([page 05](05-network-drivers.md)) |
| Hard-coded bridge IP | Almost never. It changes per network and per machine, and the name costs nothing |
| Put the service in a container too | Usually the *right* long-term answer: then it is service discovery ([page 02](02-service-discovery.md)) and none of this applies |

That last row is worth taking seriously. Most needs to reach the host are a sign
that half the stack has not been containerised yet, and the reaching-out
mechanism is scaffolding for the transition rather than a destination.

## Gotchas

**Symptom:** `host.docker.internal` does not resolve, on a Linux server, in a
setup that works on a colleague's Mac.
**Cause:** Docker Desktop provides the name automatically; Docker Engine does
not.
**Fix:** `--add-host host.docker.internal:host-gateway`, or `extra_hosts` in
Compose. Add it unconditionally — Desktop tolerates it.

**Symptom:** The name resolves, and the connection is still refused.
**Cause:** The host service is bound to `127.0.0.1`, so it is not listening on
the interface the container's traffic arrives on.
**Fix:** Bind it to `0.0.0.0` or to the bridge address — and be aware that
`0.0.0.0` also exposes it to your local network.

**Symptom:** Under Podman on a Mac, `host.containers.internal` behaves
differently from on a Linux box.
**Cause:** Inside a `podman machine` VM, Podman skips the `/etc/hosts` entries
and the name is resolved by the gvproxy DNS resolver instead.
**Fix:** Expect resolution to work but the *address* to be the VM's view of the
host. Do not build anything on the literal IP.

**Symptom:** Nothing resolves and no error was printed anywhere.
**Cause:** Podman *"will silently skip adding these internal hostnames"* when it
cannot determine the host-gateway address.
**Fix:** Configure the address explicitly — `--add-host` with an IP, or
`host_containers_internal_ip` in `containers.conf`.

**Symptom:** A container reaches the host fine but another container cannot
reach *it* by the same name.
**Cause:** `host.docker.internal` is the **host**, not a shortcut to other
containers.
**Fix:** Container-to-container is service discovery on a shared network
([page 02](02-service-discovery.md)); no host round-trip is involved or wanted.

## Interview questions

**★ A container needs to reach a Postgres running natively on the developer's
laptop. How?**
Give the container a name for the host: `--add-host
host.docker.internal:host-gateway` (or `extra_hosts` in Compose), since
`host-gateway` *"resolves to the internal IP address of the host"* — by default
the IPv4 address of the default bridge. Then make sure Postgres is actually
listening on an address other than loopback, because that is the second half of
the problem and the one that usually bites. On Docker Desktop the name is
already there; on Docker Engine it is not.

**★ Why does `host.docker.internal` work for your teammate and not for you?**
They are almost certainly on Docker Desktop, which resolves it automatically,
while you are on Docker Engine, where the name is a convention you have to
attach to `host-gateway` yourself. Adding the `extra_hosts` entry makes both
environments behave identically, and it is harmless on Desktop.

**★ The name resolves but the connection is refused. What is wrong?**
The host service is bound to `127.0.0.1`. Traffic from a container arrives on
the bridge interface, so a loopback-only listener never sees it. Bind to
`0.0.0.0` or to the bridge address — and note this is the same class of mistake
as a containerised server binding loopback and then being unreachable through
its published port.

**What is `host.containers.internal`?**
Podman's engine-neutral name for the same thing, added to `/etc/hosts`
automatically along with `host.docker.internal` for compatibility. Prefer it in
Podman-first work; keep `host.docker.internal` for portability with Docker.

**When should you use `--network host` for this instead?**
Only when you wanted host networking anyway. It solves reaching the host by
removing the network namespace entirely, but it also removes container DNS,
reintroduces host port collisions and behaves differently on Docker Desktop. It
is a large change to solve a small problem.

**What is the better answer than any of this?**
Containerise the service too. Then the question becomes ordinary service
discovery on a shared network, which is portable, works in CI and does not
depend on what happens to be installed on one developer's machine. Reaching out
to the host is a bridge during migration, not a destination.

---

← Prev: [`network create` and friends](06-network-commands.md) · Index: [Phase 7](README.md) · Next → **Rootless networking** *(not written yet)*
