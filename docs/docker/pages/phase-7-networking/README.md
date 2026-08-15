---
title: "Phase 7 — Networking"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Docker Engine 29.7.2 · Compose v5.4.0 · Podman 6.1.0.**
> Every page is **documentation-validated** against docs.docker.com,
> docs.podman.io and the relevant manual pages, with the sources named per page.
> **No sandbox** — nothing was run, so no page carries console output.

**The layer where "it can't connect" gets solved.** Almost every such bug is one
of four things — the wrong network, the wrong hostname, the wrong port, or a
`localhost` that means the container — and this phase names all four before it
gets to a single flag.

Fourteen topics. **Pages 01, 02 and 03 are the load-bearing set**: they are, in
order, why Compose works when `docker run` alone does not, how one service finds
another, and the single most common connection bug in the whole track.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[The default bridge vs a user-defined bridge](01-default-vs-user-defined-bridge.md)** | <span className="db-tier t-master">Master</span> | Only user-defined networks give you DNS by container name |
| 02 | **[Service discovery](02-service-discovery.md)** | <span className="db-tier t-master">Master</span> | Reach a service by name, on the container port, with nothing published |
| 03 | **[`localhost` inside a container is the container](03-localhost-is-the-container.md)** | <span className="db-tier t-master">Master</span> | Why `DB_HOST=localhost` fails and `DB_HOST=postgres` works |
| 04 | **[Publishing ports](04-publishing-ports.md)** | <span className="db-tier t-understand">Understand</span> | `-p`, the host interface you bind to, and the firewall rules written for you |
| 05 | **[Network drivers](05-network-drivers.md)** | <span className="db-tier t-know">Know</span> | `bridge`, `host`, `none`, `macvlan`, `ipvlan`, `overlay`, one sentence each |
| 06 | **[`network create` and friends](06-network-commands.md)** | <span className="db-tier t-understand">Understand</span> | Creating, inspecting, and attaching a running container to a second network |
| 07 | **[Reaching the host from inside](07-reaching-the-host.md)** | <span className="db-tier t-understand">Understand</span> | `host.docker.internal`, `host.containers.internal`, and the Linux caveat |
| 08 | **Rootless networking** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | `pasta`, `slirp4netns`, and why source IPs look wrong in your logs |
| 09 | **Privileged ports rootless** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Why binding 80 fails as a user, and the sysctl that changes it |
| 10 | **`--network=host`** *(not written yet)* | <span className="db-tier t-know">Know</span> | No isolation, no mapping, native speed — and when that trade is right |
| 11 | **Debugging the network** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Ask from *inside* the container instead of guessing |
| 12 | **Podman's stack: netavark and aardvark-dns** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | What replaced CNI, and which error comes from where |
| 13 | **Custom subnets, IPv6 and the VPN clash** *(not written yet)* | <span className="db-tier t-know">Know</span> | The address collision that breaks your corporate network |
| 14 | **Overlay networks and multi-host** *(not written yet)* | <span className="db-tier t-when">When Needed</span> | Where a single engine's networking stops |

## Coverage

Fourteen syllabus topics across fourteen pages. Nothing merged, nothing dropped.

| Syllabus topic | Page |
|---|---|
| The default bridge vs a user-defined bridge | 01 |
| Service discovery by container name | 02 |
| `localhost` inside a container is the container | 03 |
| Publishing ports, host interfaces, firewall rules | 04 |
| Network drivers: bridge, host, none, macvlan, ipvlan, overlay | 05 |
| `network create` / `ls` / `inspect` / `connect` / `disconnect` | 06 |
| Reaching the host from inside | 07 |
| Rootless networking — `pasta` and `slirp4netns` | 08 |
| Privileged ports rootless | 09 |
| `--network=host` | 10 |
| Debugging the network | 11 |
| Podman's `netavark` and `aardvark-dns` | 12 |
| Custom subnets, IPv6, and the VPN address clash | 13 |
| Overlay networks and multi-host networking | 14 |

## Phase gate

Move on to Phase 8 when, given "the API cannot reach the database", you can find
the cause in under two minutes — with `network inspect`, a DNS lookup from
*inside* the container, and a port check — **without editing any YAML.**

## Where this connects

- **[Phase 6 — Storage](../phase-6-storage/README.md)** is the sibling phase:
  storage and networking are the two things a container needs from the host, and
  [the rootless UID shift](../phase-6-storage/05-uid-mismatch/02-rootless-and-the-shift.md)
  is the same user-namespace story that page 08 tells about networking.
- **[Phase 1 · publishing ports](../phase-1-running-containers/05-publishing-ports.md)**
  introduced `-p`; page 04 is where it gets its full treatment.
- **[Phase 3 · `EXPOSE`](../phase-3-dockerfile/10-expose.md)** — documentation,
  not publication, and the confusion is worth revisiting here.
- **Phase 8 — Compose** is where a user-defined network stops being a flag: every
  Compose project gets one automatically, which is the whole reason service
  discovery "just works" there.

---

← Syllabus: [Part 3 — Running a real stack](../../syllabus/03-running-a-stack.md) · Prev phase: [Phase 6](../phase-6-storage/README.md) · Start → [The default bridge vs a user-defined bridge](01-default-vs-user-defined-bridge.md)
