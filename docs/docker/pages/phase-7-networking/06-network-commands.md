---
title: "`network create` and friends"
sidebar_label: "06 · `network create` and friends"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [docker network create](https://docs.docker.com/reference/cli/docker/network/create/),
> [docker network connect](https://docs.docker.com/reference/cli/docker/network/connect/),
> [docker network ls](https://docs.docker.com/reference/cli/docker/network/ls/),
> [docker network inspect](https://docs.docker.com/reference/cli/docker/network/inspect/),
> [docker network prune](https://docs.docker.com/reference/cli/docker/network/prune/),
> [docker network rm](https://docs.docker.com/reference/cli/docker/network/rm/),
> [podman-network-create(1)](https://docs.podman.io/en/latest/markdown/podman-network-create.1.html),
> [podman-network-connect(1)](https://docs.podman.io/en/latest/markdown/podman-network-connect.1.html)
> and [podman-network-rm(1)](https://docs.podman.io/en/latest/markdown/podman-network-rm.1.html).
> **No sandbox** — no console output on this page.

**Five commands, and only two of them ever need thought.** `create` and `ls`
are trivial; `inspect` is what you run when something cannot connect; `connect`
and `disconnect` are the interesting pair, because they work on a **running**
container and they are how one service ends up on two networks.

## The five

```bash
docker network create mynet                 # a user-defined bridge
docker network ls                           # what exists
docker network inspect mynet                # who is on it, and on what addresses
docker network connect mynet api            # attach a running container
docker network disconnect mynet api         # detach it
docker network rm mynet                     # delete it
docker network prune                        # delete every unused one
```

Podman's spelling is identical — `podman network create|ls|inspect|connect|
disconnect|rm|prune` — with the differences noted at the bottom, one of which is
genuinely dangerous.

## `create` — the flags that matter

Only `--driver` and, occasionally, `--subnet` come up in normal work.

```bash
docker network create --driver bridge app-net           # the default anyway
docker network create --subnet 172.28.0.0/16 app-net    # pin the addressing
docker network create --internal secure-net             # no route out
```

- **`--driver` / `-d`** — *"Driver to manage the Network"*, default `bridge`.
  [Page 05](05-network-drivers.md) is the map of the alternatives.
- **`--subnet`** — *"Subnet in CIDR format that represents a network segment"*.
  You normally do not need it: Docker Engine picks a non-overlapping subnet from
  its own pool. You reach for it when the pool collides with something real,
  which is the corporate-VPN clash covered in page 13.
- **`--gateway`** — *"IPv4 or IPv6 Gateway for the master subnet"*, chosen
  automatically when omitted. It needs `--subnet` alongside it to be meaningful.
- **`--ip-range`** — *"Allocate container ip from a sub-range"*, so the engine
  hands out a slice of the subnet and you keep the rest for static assignments.
- 🔴 **`--internal`** — *"Restrict external access to the network"*. Containers
  on it talk to each other and nothing else; there is no route out. This is the
  cheapest possible way to make a database unable to phone home, and it is the
  flag most worth remembering on this page.
- **`--label`** — *"Set metadata on a network"*, which is what makes
  `prune --filter label=…` selective later.
- **`--opt` / `-o`** — *"Set driver specific options"*: MTU, macvlan's parent
  interface, `ipvlan_mode`, and everything else that belongs to one driver
  rather than to networks in general.
- **`--ipv6`** — *"Enable or disable IPv6 address assignment"*.
- **`--attachable`** — *"Enable manual container attachment"*, which only means
  anything on an overlay network in Swarm: without it, a plain `docker run`
  cannot join a network that Swarm services use.

⚠️ **Subnets must not collide:** *"Be sure that your subnetworks do not overlap.
If they do, the network create fails and Docker Engine returns an error."* The
failure is loud, which is the good case — the quiet case is a subnet that
overlaps something on your *VPN* rather than something Docker knows about, and
Docker cannot detect that at all.

## `ls` and `inspect` — the two-minute diagnosis

`docker network ls` lists name, driver and scope, and takes filters — *"The
`driver` filter matches networks based on their driver"*, and `scope` accepts
`swarm`, `global` or `local`.

`docker network inspect <name>` is the one that answers questions. It prints the
network's addressing and **the containers currently attached to it**, which
settles the most common connection bug in one command: *is the thing I am trying
to reach actually on this network?* The options are `--format` (*"Format output
using a custom template"*, including `json`) and `--verbose` (*"Verbose output
for diagnostics"*).

The order to work in when "the API cannot reach the database" (this is the phase
gate):

1. `docker network inspect <net>` — **are both containers listed?** If the
   database is not there, nothing else matters, and this is the answer far more
   often than DNS or firewalls.
2. If both are listed, resolve the name **from inside** the container rather
   than from the host ([page 02](02-service-discovery.md)).
3. If the name resolves, check the port — and check which address the server
   bound to, because `127.0.0.1` inside the container serves nobody
   ([page 03](03-localhost-is-the-container.md)).

## `connect` and `disconnect` — the interesting pair

> *"Connects a container to a network. You can connect a container by name or by
> ID. Once connected, the container can communicate with other containers in the
> same network."*

**It works on a running container** — no restart, no recreate. That is the whole
reason the command exists, and it is the difference between debugging a live
stack and rebuilding it:

```bash
docker network connect debug-net api        # while api is running
docker network disconnect debug-net api
```

Useful options:

- **`--alias`** — *"can be used to resolve the container by another name in the
  network being connected to"*, and you can give several. This is how one
  container answers to `db` on one network and `postgres-primary` on another.
- **`--ip`** — *"specify the IP address you want to be assigned to the
  container's interface"*. Rarely right; a name is stabler than an address.
- **`--link`** — *"the legacy `--link` option"*. Do not start using it.

🔴 **A container can be on several networks at once:** *"You can connect a
container to one or more networks. The networks need not be the same type."*
This is the standard segmentation pattern, and it is worth knowing as a shape:

```
 [ browser ] → frontend-net → [ api ] → backend-net → [ db ]
                                 ↑ on both networks
```

The API is on both; the database is on `backend-net` only and is `--internal`.
Nothing that reaches the frontend network can address the database at all — not
because a rule denies it, but because there is no path. Compose expresses the
same thing declaratively, which is why you rarely type `connect` in a
Compose-managed stack.

⚠️ **Attaching a second network changes what a bare hostname means for *other*
containers, not for this one.** The container gets a second interface; DNS on
each network resolves the names on that network. If two networks both have a
container called `cache`, which one a lookup returns is not something to rely on
— use `--alias` to make the names distinct.

## `rm` and `prune`

`docker network rm` *"Removes one or more networks by name or identifier"*, and
you *"must first disconnect any containers connected to it"*. So a network in
use simply refuses to go, which is the safe behaviour.

`docker network prune` removes *"all unused networks"*, where *"Unused networks
are those which are not referenced by any containers"*. It prompts —
*"WARNING! This will remove all custom networks not used by at least one
container"* — unless you pass `-f`. Filters are `until` (*"created before given
timestamp"*, accepting `10m` or `1h30m`) and `label`, with the usual rule that
different filter keys AND together while repeated keys OR.

Networks are cheap and nothing is stored in them, so pruning is one of the few
prune commands with no capacity to lose your data. Compare `volume prune`
([Phase 6, page 06](../phase-6-storage/06-volume-lifecycle.md)), where the same
reflex deletes a database.

## Podman

Same five commands, and mostly the same flags — `--subnet` (*"Can be specified
multiple times to allocate more than one subnet for this network"*), `--gateway`,
`--ip-range`, `--ipv6`, `--label`, `--opt`. `podman network connect` takes
`--alias`, `--ip`, `--ip6` and **`--mac-address`**, which Docker's `connect` does
not.

Three differences worth carrying:

- **`--internal` is documented as bridge-only** — *"Restrict external access of
  this network when using a `bridge` network"* — with the note that under the
  older CNI backend, *"DNS will be automatically disabled"* on such a network.
  On the current netavark backend name resolution keeps working.
- **`--disable-dns`** has no Docker equivalent: it *"Disables the DNS plugin for
  this network which if enabled, can perform container to container name
  resolution"*. Turning it off gives you a user-defined network with the default
  bridge's worst property, so the only real use is diagnosing whether a problem
  is DNS at all.
- **`--ignore`** — *"Ignore the create request if a network with the same name
  already exists instead of failing"* — is the flag that makes a setup script
  idempotent without a `|| true`.

🔴 **The dangerous divergence: `podman network rm --force` deletes containers.**
Docker's `rm` refuses while anything is attached. Podman's documentation is
explicit: *"The `force` option removes all containers that use the named network.
If the container is running, the container is stopped and removed."* The muscle
memory of adding `-f` when a command complains is exactly wrong here.

## Gotchas

**Symptom:** `docker network rm` reports the network is in use, and nothing
obvious is running on it.
**Cause:** A stopped container still counts as connected; removal requires
disconnecting every container first.
**Fix:** `docker network inspect` to list them, then `network disconnect` each —
or remove the stale containers. `network prune` will not touch it either, since
it is referenced.

**Symptom:** `podman network rm -f mynet` and a running service disappears.
**Cause:** Podman's `--force` removes the *containers* using the network,
stopping them first. It is not Docker's `-f`.
**Fix:** Disconnect deliberately instead. Reserve `-f` for the case where losing
those containers is the intention.

**Symptom:** `docker network create` fails with an overlap error.
**Cause:** The requested `--subnet` collides with an existing network's subnet.
**Fix:** Pick another range, or drop `--subnet` entirely and let the engine
allocate a non-overlapping one — which is what it does by default.

**Symptom:** A container was connected to a second network, but code inside it
still cannot reach the new peers.
**Cause:** Usually the peer is not actually on that network, or the application
resolved and cached the address at startup, before the interface existed.
**Fix:** Confirm with `network inspect`, then restart the process (not
necessarily the container) so it resolves again.

**Symptom:** Two `docker compose up` projects cannot see each other despite
"both being on bridge".
**Cause:** Each project creates its **own** user-defined network. Sharing the
driver is not sharing the network.
**Fix:** `docker network connect` the container into the other project's
network, or declare an `external` network in both compose files.

## Interview questions

**★ How do you attach a running container to a second network, and why would
you?**
`docker network connect <net> <container>` — it works on a running container
with no restart. The usual reason is segmentation: an API sits on both a
frontend and a backend network, while the database sits only on the backend one,
so nothing reachable from outside has any path to it. The other reason is
debugging: attach a diagnostic container to a live network without touching the
services on it.

**★ What does `--internal` do, and what is it for?**
It restricts external access to the network — containers on it can talk to each
other but have no route out. It is the cheapest way to guarantee that a
database, a cache or a build container cannot make outbound connections, and it
is enforced by the absence of a route rather than by a filter, so there is no
rule for a mistake to disable.

**★ "The API cannot reach the database" — what is your first command?**
`docker network inspect` on the network they are supposed to share, to check
that both containers are actually listed on it. That single answer eliminates
the most common cause. Only then is it worth resolving the name from inside the
container and checking which address the server bound to.

**When is `--subnet` worth specifying?**
Rarely. The engine allocates a non-overlapping subnet automatically and fails
loudly if you request one that collides. You pin a subnet when Docker's default
range clashes with a real network you connect to — a corporate VPN is the usual
culprit — or when something upstream needs to write firewall rules against a
known range.

**What does `docker network prune` remove, and is it safe?**
Every network not referenced by any container, with `until` and `label` filters
to narrow it. It is one of the safer prune commands, because a network holds no
data — unlike `volume prune`, which is how development databases are lost. It
still prompts unless you pass `-f`.

**What is the difference between `docker network rm -f` and
`podman network rm -f`?**
Docker refuses to remove a network with containers attached and `-f` does not
change that fact. Podman's `--force` *"removes all containers that use the named
network"*, stopping running ones first. Same flag, different blast radius.

---

← Prev: [Network drivers](05-network-drivers.md) · Index: [Phase 7](README.md) · Next → [Reaching the host from inside](07-reaching-the-host.md)
