---
title: "--scale and the honest limits"
sidebar_label: "17 · --scale and the limits"
sidebar_position: 17
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against
> [`docker compose scale`](https://docs.docker.com/reference/cli/docker/compose/scale/),
> [`docker compose up`](https://docs.docker.com/reference/cli/docker/compose/up/),
> [the `services` element](https://docs.docker.com/reference/compose-file/services/) and
> [the `deploy` element](https://docs.docker.com/reference/compose-file/deploy/).
> **No sandbox** — no console output on this page.

**Compose can run N containers of a service. That is not the same as scaling a
system, and the gap between the two is this page.** Knowing where Compose stops
is worth more than knowing the flag.

## Running more than one

Four ways to say the same thing:

```bash
docker compose up -d --scale worker=4        # for this invocation
docker compose scale worker=4                # "Scale services", on a running stack
```

```yaml
services:
  worker:
    build: .
    scale: 4                 # the default number of containers for this service

  other:
    build: .
    deploy:
      replicas: 4            # the Deploy Specification's spelling
```

`--scale` is documented as *"Scale SERVICE to NUM instances. Overrides the
`scale` setting in the Compose file if present."* The service-level `scale`
attribute *"specifies the default number of containers to deploy for this
service"*, and **when both are set, `scale` must be consistent with the
`replicas` attribute in the Deploy Specification** — they are not two independent
knobs.

`deploy.replicas` belongs to the Deploy Specification, which is aimed at
orchestration platforms: *"if the service is `replicated` (which is the default),
`replicas` specifies the number of containers that should be running at any given
time."* Its siblings — `placement`, `update_config`, `endpoint_mode`,
`mode: global` — describe a cluster Compose does not have. Treat `replicas` as
the one line of `deploy` that means something on one host, and read the rest as
documentation of intent.

## The two hard blocks

🔴 **A `container_name` makes scaling impossible.** The reference is explicit:
*"Compose does not scale a service beyond one container if the Compose file
specifies a `container_name`. Attempting to do so results in an error."* Names
are unique, so this is not a policy — it is arithmetic. It is also the best
reason to leave `container_name` out of a file unless something external truly
needs a fixed name.

⚠️ **A fixed published port is the second block.** A host port can be bound
once; four containers cannot each own `3000:3000`. The scale documentation does
not spell this out, so treat it as mechanics rather than a quoted rule — but it
is the failure people actually hit, and the shape of the fix is fixed too:

- **Publish nothing** and let a proxy inside the stack reach the replicas by
  service name ([page 07](07-networks.md)). This is the normal answer.
- **Or do not scale that service.** The service that owns the host port is
  usually the one thing you want exactly one of.

## What Compose does *not* give you

Running four containers is the easy half. The parts an orchestrator provides and
Compose does not:

| | Compose on one host |
|---|---|
| Load balancing across replicas | **none of its own** — no virtual IP, no proxy. `endpoint_mode: vip`/`dnsrr` is a Swarm concept |
| Rolling updates | **no** — `update_config` is Deploy Specification, for a platform |
| Rescheduling a failed container elsewhere | **no** — there is no "elsewhere". One host |
| Replacing an unhealthy container | **no** — a healthcheck reports, nothing acts ([page 06](06-healthchecks/README.md)) |
| Capacity beyond the machine | **no** — every replica shares one host's CPU, memory and page cache |

That last row is the one that makes local scaling misleading as a performance
exercise: four replicas of a CPU-bound service on a four-core laptop are not four
times the throughput, they are the same four cores with more context switching.

⛔ **Never scale a stateful service.** Four containers of Postgres pointed at one
named volume are four processes writing one data directory — not a cluster, a
corruption. Replication is a database feature, configured in the database, not a
Compose flag ([page 08](08-volumes.md)).

## Addressing the replicas you have

Once a service has several containers, the per-container commands need to know
which one you mean:

```bash
docker compose ps worker                     # all four, with their generated names
docker compose logs --index=2 worker         # the second replica's output
docker compose exec --index=2 worker sh      # a shell in the second replica
```

`--index` is *"index of the container if service has multiple replicas"*, and it
exists on both `logs` and `exec` ([page 14](14-day-to-day-commands/README.md)).
Without it, those commands are ambiguous on a scaled service.

## Where scaling locally is genuinely useful

Not as a performance test — as a correctness test. Four replicas of a service
that has no port published is a cheap way to prove things you would otherwise
find out in production:

- **Statelessness.** In-memory sessions, a local cache, a file written to the
  container filesystem — all of it breaks the moment there are two replicas, and
  breaks *intermittently*, which is the expensive way to learn it.
- **Queue consumers.** Workers pulling from Redis, RabbitMQ or a database queue
  are the one service shape that scales cleanly on one host, because the queue is
  the coordination point. This is the case `--scale` was made for.
- **Concurrency bugs.** Two workers processing the same job, a migration run
  twice, a cron that assumes it is the only instance — all reproducible locally
  with `--scale 2`.
- **Leader assumptions.** Anything that quietly assumes it is singular: a
  scheduler, a cache warmer, a websocket hub.

## The honest ladder

| Situation | The tool |
|---|---|
| Development, and one host in production with modest needs | Compose, with **one** of each service |
| Several workers behind a queue, one host | Compose with `--scale` on the workers only |
| Needs restarts across reboots, dependencies, logging as a first-class citizen | systemd units — Quadlet under Podman *(Phase 11, not written yet)* |
| Rolling updates, health-based replacement, more than one machine | a real orchestrator — and at that point the Compose file becomes an input to something else |

**Compose is not a failed orchestrator; it is a correct description of one
machine's stack.** Most projects never need the next rung, and the ones that do
are better served by admitting it than by adding replicas to a file that cannot
route to them.

## Podman

Scaling is resolved by the compose provider, not the engine. Under
`podman compose` with `docker-compose` as the provider it behaves as documented;
`podman-compose` is a separate implementation, so confirm rather than assume
([page 15](15-podman-compose.md)). Podman's own answer to "many containers, one
host" is a pod or a set of Quadlet units, which is a different model rather than
a bigger `--scale`.

## Gotchas

**Symptom:** `--scale` fails with an error about the container name.
**Cause:** The service declares `container_name`, and Compose does not scale a
service beyond one container when it does.
**Fix:** Remove `container_name`. Compose's generated names are
`<project>-<service>-<n>` and they are what makes scaling possible.

**Symptom:** Scaling a service fails on a port that is already allocated.
**Cause:** A fixed host port can only be bound once, so the second replica has
nowhere to bind.
**Fix:** Do not publish the port at all — reach the service by name from inside
the stack and put the proxy in the stack — or leave that service at one replica.

**Symptom:** Requests behave inconsistently after scaling — logged out at random,
cache misses, half the responses stale.
**Cause:** The service is not stateless, and there is no session affinity because
there is no load balancer.
**Fix:** Move state out of the process — into Redis, the database, or the token.
This is the bug `--scale 2` was worth running to find.

**Symptom:** Someone scaled the database "for redundancy".
**Cause:** Multiple containers were pointed at one volume, which is not
replication.
**Fix:** One database container per volume. Replication is configured in the
database itself; there is no Compose-level equivalent.

## Interview questions

**★ What are the limits of `docker compose --scale`?**
It starts N containers of a service on one host and stops there. There is no load
balancer or virtual IP, no rolling update, no rescheduling, no replacement of an
unhealthy container, and no capacity beyond the machine. It also cannot run at
all if the service declares `container_name`, and a fixed published host port
limits it to one replica because a host port binds once.

**★ Which services scale cleanly under Compose, and which never should?**
Queue consumers scale cleanly: the queue is the coordination point, they publish
no ports, and they are usually stateless by construction. Stateful services never
should — several containers on one volume is corruption, not redundancy — and
neither should the service that owns a fixed host port.

**★ How do you talk to one replica out of four?**
`--index`, which both `logs` and `exec` accept: `docker compose exec --index=2
worker sh`. `docker compose ps <service>` lists them with their generated names.
Without `--index` those commands are ambiguous once a service has replicas.

**What is `deploy.replicas` for, if Compose is not an orchestrator?**
It is the Deploy Specification's spelling of the same number, aimed at
orchestration platforms — and `scale` and `replicas` must be consistent when both
are set. Its siblings (`placement`, `update_config`, `endpoint_mode`,
`mode: global`) describe a cluster, so on a single host `replicas` is the one
attribute of `deploy` that changes what happens.

**When does a project outgrow Compose, and what is the next step?**
When it needs rolling updates, health-based replacement, or more than one
machine. The intermediate rung is worth knowing: systemd units — Quadlet under
Podman — give restart-across-reboot, dependency ordering and real logging without
a cluster. Reaching for Kubernetes because `--scale` did not load-balance is
skipping a step that solves most of the actual problem.

---

← Prev: [`include` and `extends`](16-include-and-extends.md) · Index: [Phase 8](README.md) · Next → **Phase 9 · The MERN/PERN stack in containers** *(not written yet)*
