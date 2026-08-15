---
title: "The wiring: ports, networks, volumes and secrets"
sidebar_label: "02 · The wiring"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [the top-level `networks` element](https://docs.docker.com/reference/compose-file/networks/),
> [the top-level `volumes` element](https://docs.docker.com/reference/compose-file/volumes/),
> [the top-level `secrets` element](https://docs.docker.com/reference/compose-file/secrets/),
> [Compose networking](https://docs.docker.com/compose/how-tos/networking/),
> [`docker compose down`](https://docs.docker.com/reference/cli/docker/compose/down/) and
> [Specify a project name](https://docs.docker.com/compose/how-tos/project-name/).
> **No sandbox** — no console output on this page.

**Four blocks decide what can reach what: `ports`, `networks`, `volumes` and
`secrets`. Together they are about twenty lines, and they are the difference
between a stack and a pile of containers.** This page is those twenty lines.

## One published port

Publishing is about reaching the stack **from the host**. It has nothing to do
with services reaching each other, which happens on the Compose network using the
**container** port — the documentation is explicit that *"the `HOST_PORT` and
`CONTAINER_PORT` serve different purposes"*
([Phase 8 · Networks in Compose](../../phase-8-compose/07-networks.md)).

Every extra port costs something concrete:

| Published | What you gained | What you bought |
|---|---|---|
| `db` on 5432 | `psql` from the host | a database on the host network, and a collision with the next project |
| `api` on 3000 | `curl` without the proxy | a second origin, so the frontend needs CORS |
| `proxy` on 8080 | the application | one entry point, one thing to secure |

🔴 **The convenience the extra ports buy is already available.**
`docker compose exec db psql -U acme` reaches the database without publishing
anything ([topic 14](../14-connecting-from-the-host.md)), and it keeps working
when two projects are up at once.

And when you do publish, publish to an interface rather than to everything:

```yaml
    ports:
      - "127.0.0.1:8080:80"
```

**Without the host IP, Docker binds `0.0.0.0`**, and the documentation warns in as
many words that this is *"bypassing host firewall rules"*. On a laptop on a café
network that is the difference between a development stack being local and being
public.

⚠️ **The project name does not help here.** `name: acme` prefixes Compose's
*resources* — `acme_db-data`, `acme_edge`, the container names — but a host port
belongs to the host, which has never heard of a Compose project. Two checkouts
publishing `"8080:80"` collide, and the fix is to interpolate the host port so the
second one can move without editing the file:

```yaml
      - "127.0.0.1:${PROXY_PORT:-8080}:80"
```

## Two networks, and one service on both

```yaml
networks:
  edge:
  backend:
    internal: true
```

`proxy`, `web` and `api` sit on `edge`. `db`, `cache` and `migrate` sit on
`backend`. **`api` is the only service on both**, which is what makes it the only
path from the outside world to the data.

🔴 **`internal: true` means "externally isolated"** — a container attached only to
that network has no route off the host. A compromised database image cannot phone
home, and a dependency that decides to fetch something at runtime fails loudly
instead of succeeding quietly.

⚠️ **It is not a firewall between the containers on that network.** `api`,
`migrate`, `db` and `cache` still talk to each other freely; that is the point.
Isolation here is about the *outside*, and it is the outbound direction only.

Two other facts from phase 8 that this file depends on:

- **Compose creates `acme_default` whether you use it or not**, and services with
  no `networks:` key land on it. Declaring both networks explicitly is what stops
  a new service silently joining everything.
- **A recreated container "joins the network under a different IP address but the
  same name."** So the name is the address — hardcoding an IP works exactly once,
  and this is the fact the proxy's configuration has to respect
  ([04 · The application services](04-the-api-and-the-frontend.md)).

## Volumes are declared twice, deliberately

A named volume appears **in the service and again at the top level**. The
top-level entry is the declaration; the service line is the mount.

```yaml
    volumes:
      - db-data:/var/lib/postgresql   # the mount
volumes:
  db-data:                            # the declaration
```

Compose scopes the real volume to the project, so `db-data` becomes
`acme_db-data`. That is what keeps two checkouts of the same project from sharing
one database.

- ⚠️ **Setting `name:` opts out of the scoping** — the documentation says the name
  is then *"used as is and is not scoped with the stack name"*. Right for a volume
  deliberately shared between projects; never right by accident.
- **`external: true`** says the lifecycle is managed elsewhere, so
  `docker compose down -v` **cannot** delete it. On a volume holding data you care
  about, that is a guard worth four characters.
- The declaration being **mandatory** is the useful part: a typo in a mount path
  produces an "undefined volume" error rather than quietly creating a second,
  empty volume — and quietly-a-second-empty-volume looks exactly like data loss.

🔴 **`down -v` removes named volumes declared here *and* anonymous volumes
attached to containers.** In development that is the command that resets the
database on purpose, and it is also the command that deletes it by accident;
`external: true` on anything you would miss is the difference.

## Secrets are files, not variables

```yaml
secrets:
  db_password:
    file: ./secrets/db_password.txt
```

Compose mounts it at `/run/secrets/db_password` inside **only the services that
list it**, which the documentation calls *"granular access control within a
service container via standard filesystem permissions"*. The alternative — an
environment variable — is *"often available to all processes"* and *"can be
printed in logs when debugging errors without your knowledge"*
([topic 06](../06-secrets-dev-vs-prod.md)).

🔴 **This works with a plain `docker compose up`.** `docker secret` is the
Swarm-only command, and confusing the two is where "you need Swarm for secrets"
comes from.

Two practical notes for this stack:

- The file is on disk, unencrypted, and must be **gitignored**. A Compose secret
  is about *scope*, not encryption at rest.
- The `environment:` source (`db_password: {environment: DB_PASSWORD}`) is what a
  CI runner or a deployment platform uses: the value arrives as a variable in the
  deploy environment and is delivered to the container as a file. That single
  hop is what keeps the application code identical everywhere.

## What the four blocks buy, in one table

| Block | Question it answers | Failure it prevents |
|---|---|---|
| `ports` | what can the **host** reach | a database exposed to the network the laptop is on |
| `networks` | what can each **container** reach | a compromised image with an outbound route |
| `volumes` | what **survives** `up`, `down` and a rebuild | a database that is empty tomorrow |
| `secrets` | who can **read** the credential | a password in `docker inspect`, in the logs, in an error report |

## Gotchas

**Symptom:** `service "db" refers to undefined volume db-data`.
**Cause:** The volume was mounted in the service but never declared under the
top-level `volumes:` key.
**Fix:** Declare it in both places. Resist the urge to call the redundancy silly —
it is what turns a typo into an error message instead of into an empty database.

**Symptom:** Two projects are up and the second cannot start its proxy.
**Cause:** The project name namespaces Compose's resources, **not host ports**.
**Fix:** Interpolate the host port with a default —
`"127.0.0.1:${PROXY_PORT:-8080}:80"` — so a second checkout moves without a file
edit. Keep the number of published ports at one so there is only ever one to move.

**Symptom:** The development database is empty after someone "cleaned up".
**Cause:** `docker compose down -v`. It removes named volumes declared in the file
*and* anonymous volumes attached to containers, and it does not ask.
**Fix:** For a volume you would miss, create it outside the project and mark it
`external: true` — `down -v` then refuses to touch it. For everything else, make
the seed data reproducible so the reset is boring.

**Symptom:** Everything works, and then a security review finds the database was
reachable from the office network the whole time.
**Cause:** A published port with no host IP. Docker binds `0.0.0.0` and, in the
documentation's own words, bypasses host firewall rules.
**Fix:** Bind to `127.0.0.1` explicitly, or do not publish at all and use
`compose exec`. Grep the file for `ports:` before every review — there are usually
one or two left over from a debugging session.

## Interview questions

**★ Why publish only one port in a six-service stack?**
Because publishing controls what the *host* can reach and nothing else —
service-to-service traffic uses container ports on the Compose network. One port
means one origin, which removes CORS from the frontend, keeps the database off the
host network, and makes the development topology match production apart from what
sits in front of the proxy. Everything the extra ports would have given you is
available through `compose exec`, which also keeps working with two projects up.

**★ How do you stop the database container from reaching the internet?**
Put it on a network declared `internal: true` and on nothing else. The
documentation describes such a network as externally isolated, so containers
attached only to it have no outbound route. The API sits on both that network and
the edge network, which makes it the single path between the outside world and the
data. This is segmentation by topology rather than by firewall rules, so it
survives a restart, a rebuild and a move to another host.

**★ What is the real difference between a Compose secret and an environment
variable holding the same value?**
Scope and how easily it leaks by accident. A secret is delivered as a file at
`/run/secrets/<name>`, only to the services that list it, so ordinary filesystem
permissions apply. An environment variable is inherited by every child process,
visible to anything that can inspect the container, and — in Docker's own words —
*"can be printed in logs when debugging errors without your knowledge"*. Neither
is encrypted at rest by Compose; the secret's advantage is that the blast radius
is one container and one file rather than every process the container spawns.

**Why is a named volume written in two places?**
The top-level entry declares it, the service line mounts it. Because the
declaration is mandatory, a mistyped mount produces "undefined volume" rather
than silently creating a second, empty volume — and the silent version is
indistinguishable from data loss at three in the morning.

**When would you set `external: true` on a volume?**
When the data outlives the project: a database volume you would be sorry to lose,
or a volume deliberately shared between two stacks. It tells Compose the lifecycle
is owned elsewhere, so `down -v` cannot remove it. The trade is that the volume
has to exist already — Compose will not create it — which is exactly the friction
you want around durable data.

**Does `internal: true` stop containers on that network from talking to each
other?**
No. It removes the network's route to the outside; containers on it still resolve
and reach each other by service name. If you need to stop two containers from
talking, the answer is not to put them on the same network in the first place —
which is why this stack has two networks and only the API on both.

---

← Prev: [The file and its shape](01-the-file.md) · Index: [Phase 9](../README.md) · Next → [The stateful services](03-the-stateful-services.md)
