---
title: "localhost inside a container is the container"
sidebar_label: "03 · localhost is the container"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [Docker — networking overview](https://docs.docker.com/engine/network/),
> [Docker — bridge network driver](https://docs.docker.com/engine/network/drivers/bridge/),
> [Docker — published ports](https://docs.docker.com/engine/network/#published-ports) and
> [Podman — podman-run `--network`](https://docs.podman.io/en/latest/markdown/podman-run.1.html).
> **No sandbox** — no console output on this page.

**Every container has its own loopback interface, and `127.0.0.1` inside a
container means *that container* and nothing else.** This is the number-one
connection bug in containers, it produces two completely different symptoms
depending on which side made the mistake, and both are fixed by understanding
one sentence.

## Why it is not shared

A container gets its own **network namespace**
([Phase 0, page 02](../phase-0-what-a-container-is/02-namespaces.md)): its own
interfaces, its own routing table, its own port space. `lo` is one of those
interfaces, created fresh for each namespace.

So `127.0.0.1` is not "the machine". It is "whoever is asking, in their own
namespace". Inside the API container it is the API container; inside the
database container it is the database; on the host it is the host. Three
different places, one address.

That is also why **two containers can both bind port 3000** without conflict.
Their port spaces are separate, and only publishing brings them into the host's
shared space where a collision is possible.

## Symptom 1 — the config that names `localhost`

```bash
DATABASE_URL=postgres://user:pass@localhost:5432/app     # ❌ inside a container
DATABASE_URL=postgres://user:pass@db:5432/app            # ✅
```

The API container resolves `localhost` to itself, finds nothing listening on
5432, and reports `ECONNREFUSED 127.0.0.1:5432`. **The refusal is the clue**: a
wrong hostname usually gives you `ENOTFOUND`, so *connection refused on
127.0.0.1* means the address was right and the target was your own container.

This is nearly always inherited configuration — a `.env` written when the
database ran on the developer's laptop. The fix is the container name on a
shared network (page 02), and the durable version of the fix is to keep the
hostname in an environment variable so the same image works in both worlds.

## Symptom 2 — the server that *binds* to localhost

The mirror image, and much more confusing, because everything looks correct.

```js
app.listen(3000, '127.0.0.1')   // ❌ in a container: unreachable from outside it
app.listen(3000, '0.0.0.0')     // ✅ all interfaces
app.listen(3000)                // ✅ Node defaults to all interfaces
```

A process bound to the container's loopback is reachable **only from inside that
container**. Then:

- `docker exec -it api curl localhost:3000` **works** — you are inside.
- `curl localhost:8080` on the host, with `-p 8080:3000` published, **fails**.
- Another container connecting to `api:3000` **fails**.

So the container is healthy, the port is published, DNS resolves, and nothing
can reach it. The tell is that first bullet: **it works from `exec` and from
nowhere else.**

Frameworks that default to loopback for safety are the usual source — several
dev servers do, and Python's `flask run` historically did. In a container the
isolation is the namespace, so binding to `0.0.0.0` inside it is not the
exposure it would be on a host.

```yaml
# common environment-variable spellings for "bind everywhere"
environment:
  HOST: 0.0.0.0          # Nuxt, many Node tools
  HOSTNAME: 0.0.0.0      # Next.js standalone
```

Vite needs `--host` (or `server.host: true`), and many Python servers want
`--host 0.0.0.0`.

## The three-way table

| From | To | Address to use |
|---|---|---|
| container → **itself** | a sidecar process in the same container | `localhost` ✅ |
| container → **another container** (same network) | that container's port | **its name**, e.g. `db:5432` |
| container → **the host** | something running on the host | `host.docker.internal` / `host.containers.internal` — page 07 |
| host → **container** | a published port | `localhost:<host port>` |
| container → **another container** on a different network | — | ❌ not reachable; attach them to a shared network |

The one row where `localhost` between processes is right by design is **inside a
Podman pod**, where containers share a single network namespace — and therefore
also share the port space, so two of them cannot both bind 3000. Phase 11.

## Diagnosing in three commands

```bash
# 1. is the process listening, and on which address?
docker exec -it api sh -c 'netstat -tlnp 2>/dev/null || ss -tlnp'

# 2. reachable from another container on the network?
docker run --rm --network appnet nicolaka/netshoot curl -sv http://api:3000

# 3. reachable from the host, via the published port?
curl -sv http://localhost:8080
```

Read the first output carefully: **`127.0.0.1:3000` is the bug and `0.0.0.0:3000`
is correct.** That one line separates "bound to loopback" from every other
networking problem, and it is worth checking before anything else. Page 11 turns
this into a full procedure.

## Gotchas

**Symptom:** `ECONNREFUSED 127.0.0.1:5432` from an application container.
**Cause:** The connection string says `localhost`, which is the application's own
container.
**Fix:** Use the database container's name on a shared user-defined network.
Keep the host in an environment variable so the image runs unchanged locally and
in a container.

**Symptom:** The port is published, the container is healthy, and `curl` from
the host gets connection refused.
**Cause:** The server bound to `127.0.0.1` inside the container, so the published
port has nothing to forward to.
**Fix:** Bind `0.0.0.0` — `app.listen(3000, '0.0.0.0')`, `HOST=0.0.0.0`,
`--host 0.0.0.0`, `server.host: true`.

**Symptom:** `docker exec … curl localhost:3000` works but nothing else can
reach the service.
**Cause:** Same as above — `exec` runs *inside* the namespace, so it is the one
place loopback works.
**Fix:** Check the listening address with `ss -tlnp` inside the container; treat
`exec`-only reachability as proof of a loopback bind.

**Symptom:** Two containers each bind 3000 with no error, and you expected a
conflict.
**Cause:** Separate network namespaces mean separate port spaces. Conflicts only
happen on the host, between *published* ports.
**Fix:** Nothing to fix — but remember `-p 8080:3000` twice on the same host port
*will* fail, and that is the collision people are thinking of.

## Interview questions

**★ Why does `DB_HOST=localhost` fail inside a container?**
Because each container has its own network namespace and therefore its own
loopback interface, so `127.0.0.1` resolves to that container, not to the host or
to any other container. The database is a different namespace entirely. On a
user-defined network the correct address is the other container's name.

**★ A service is published and healthy but unreachable from the host. What is
your first guess?**
That the process bound to `127.0.0.1` inside the container instead of `0.0.0.0`,
so the published port has nothing to forward to. Confirm with `ss -tlnp` inside
the container: `127.0.0.1:3000` is the bug, `0.0.0.0:3000` is correct. The
signature symptom is that `docker exec … curl localhost:3000` works and nothing
else does.

**★ Is binding `0.0.0.0` inside a container a security problem?**
Not in the way it is on a host. The container's namespace is the isolation
boundary: `0.0.0.0` means every interface *that container* has, and reachability
from outside the host still requires you to publish the port. What matters is
what you publish and to which host interface (page 04), not what the process
binds inside its own namespace.

**Why can two containers both listen on port 3000?**
Because port spaces are per network namespace. There is no conflict until the
ports are published to the host, which is a single shared space — publishing two
containers to the same host port does fail.

**When is `localhost` between two containers correct?**
When they share a network namespace — containers in a Podman pod, or a container
started with `--network=container:<other>`. They then also share the port space,
so they cannot both bind the same port. That is the model Kubernetes pods use,
and it is the exception that proves the rule.

---

← Prev: [Service discovery](02-service-discovery.md) · Index: [Phase 7](README.md) · Next → [Publishing ports](04-publishing-ports.md)
