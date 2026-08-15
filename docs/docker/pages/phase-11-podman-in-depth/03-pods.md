---
title: "Pods"
sidebar_label: "03 · Pods"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [podman-pod(1)](https://docs.podman.io/en/latest/markdown/podman-pod.1.html),
> [podman-pod-create(1)](https://docs.podman.io/en/latest/markdown/podman-pod-create.1.html)
> and [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html).
> **No sandbox** — no console output on this page.

The name is in the binary: **Podman is the Pod Manager.** A pod is Podman's one
genuine capability that Docker has no equivalent of, and it is not a grouping
convenience — it is a **shared set of kernel namespaces** with a container whose
only job is to hold them open.

`podman pod create` "creates an empty pod, or unit of multiple containers, and
prepares it to have containers added to it", and `podman pod` is "a set of
subcommands that manage pods, or groups of containers".

## The infra container is the pod

Create a pod with nothing in it and a container appears anyway. That is the
**infra container**, documented as "a lightweight container used to coordinate the
shared kernel namespace of a pod", created by default (`--infra`, default true)
and running `/pause` as its command.

Its job is to **exist**. Namespaces live as long as a process is in them, so if
the pod's namespaces belonged to your first application container, stopping that
container would destroy the network namespace the others are using. The infra
container is the process that outlives every restart, so the pod's identity — its
IP, its port bindings, its hostname — survives replacing the containers inside it.

That is why `/pause` is the right command: a process that does nothing, forever,
costs nothing and never exits.

## What is actually shared — and the surprise

`--share` takes "a comma-separated list of kernel namespaces to share", and this
is the part worth memorising:

| | |
|---|---|
| **Default** | `ipc`, `net`, `uts` |
| **Allowed values** | `cgroup`, `ipc`, `net`, `pid`, `uts` |
| **Syntax** | "If the option is prefixed with a `+`, the namespace is appended to the default list. Otherwise, **it replaces the default list**" |

🔴 **The PID namespace is NOT shared by default.** Almost everyone assumes a pod
means "these processes can see each other", and by default they cannot — each
container still has its own PID 1 with all of
[Phase 10 · 01](../phase-10-production/01-pid-1/README.md)'s consequences intact.
If you want a sidecar that can signal or inspect the main process, you ask for it
with `--share=+pid`.

⚠️ **The `+` is load-bearing.** `--share=pid` *replaces* the default list, so it
silently takes away the shared network namespace — which is the one thing you
almost certainly wanted. `--share=+pid` is nearly always what was meant.

`--share-parent` is the cgroup half: "this boolean determines whether or not all
containers entering the pod use the pod as their cgroup parent", defaulting to
true. So a pod is also a **resource-accounting unit**, and a limit applied to the
pod bounds everything in it —
[Phase 10 · 03](../phase-10-production/03-resource-limits/README.md) applied one
level up.

## `localhost` finally means what people expect

[Phase 7 · 03](../phase-7-networking/03-localhost-is-the-container.md) is blunt
about it: `localhost` inside a container is the container, and the commonest
networking mistake is expecting it to be a neighbour.

**A pod is the exception, and it is the only one.** Because `net` is shared by
default, every container in the pod is in one network namespace: one IP, one
loopback, one set of ports. An API container reaches its cache at
`127.0.0.1:6379` with no DNS, no service discovery and no user-defined network.

The cost is the other side of the same coin:

- 🔴 **Two containers in a pod cannot both bind the same port.** They are in one
  namespace, so it is a straightforward collision — the same reason
  [Phase 10 · 16](../phase-10-production/16-zero-downtime-restarts.md) says a pod
  is not how you run two versions side by side.
- **Publishing is a pod-level operation.** The documentation is explicit: "you
  must not publish ports of containers in the pod individually, but only by the
  pod itself." Ports belong to the namespace, and the namespace belongs to the
  pod.
- **Adding a port after the fact means recreating the pod**, because the infra
  container holds the bindings.

## Docker's nearest thing, and why it is not the same

Docker can share a network namespace: `--network container:<name|id>` attaches one
container to another's networking stack, which
[Phase 7 · 11](../phase-7-networking/11-debugging-the-network.md) uses as a
debugging trick and [Phase 10 · 12](../phase-10-production/12-debugging-without-a-shell.md)
uses to get into an image with no shell.

It is the same kernel mechanism and a much weaker construct:

| | Docker `--network container:` | Podman pod |
|---|---|---|
| Lifetime | Tied to the **target container** — it dies, you lose the namespace | Tied to the infra container, which outlives members |
| Which namespaces | Network only | `ipc`, `net`, `uts` by default; `pid`, `cgroup` on request |
| Managed as a unit | No | `pod start`, `stop`, `rm`, `stats`, `logs`, `top` |
| Cgroup parent | No | Yes, by default |

Podman gives you the group as a first-class object with its own subcommands —
`create`, `start`, `stop`, `rm`, `ps`, `stats`, `top`, `logs`, `clone`, `prune`
and the rest.

## The Kubernetes lineage, which is the real point

A pod is not Podman's invention — it is **Kubernetes' smallest deployable unit**,
and Podman implements it faithfully enough that the mental model transfers. A
sidecar pattern you build locally as a pod is the sidecar pattern you deploy, and
`podman kube play` runs the YAML directly (**Phase 11 · 11 · `podman kube play`**
*(not written yet)*).

That is the honest reason to learn pods even if you never use them locally: they
are the on-ramp, not a Podman quirk.

## So when is a pod the right answer?

The short version, argued properly in **Phase 11 · 08 · `podman pod create`,
`ps`, `rm`** *(not written yet)*:

- **Use a pod** when containers are genuinely one deployable thing that scale and
  fail together — an application with its log shipper, a proxy sidecar, a
  service with a local cache nothing else uses.
- **Use a user-defined network** when they are separate services that happen to
  talk. That is the ordinary case, it is what Compose builds
  ([Phase 8 · 07](../phase-8-compose/07-networks.md)), and it keeps ports and
  lifecycles independent.

⚠️ **A pod is not "Compose for Podman".** Reaching for one because a stack has
several containers gives you port collisions and a shared failure domain you did
not ask for.

## Gotchas

**Symptom:** A sidecar in the pod cannot see the main container's processes.
**Cause:** The PID namespace is not shared by default — only `ipc`, `net` and
`uts` are.
**Fix:** `--share=+pid` when creating the pod. Note the `+`.

**Symptom:** Adding `--share=pid` broke `localhost` between the containers.
**Cause:** Without the `+`, the value *replaces* the default list instead of
appending to it, so the network namespace stopped being shared.
**Fix:** `--share=+pid`.

**Symptom:** A second container in the pod fails to start with a port already in
use, and nothing else on the host is using it.
**Cause:** The pod is one network namespace. Two containers in it compete for the
same port exactly as two processes on one host would.
**Fix:** Change one of the ports, or accept that these two containers are not one
deployable unit and put them on a user-defined network instead.

**Symptom:** `-p` on a container inside a pod is rejected or ignored.
**Cause:** Ports are published by the pod, not by its members — the documentation
says not to publish container ports individually.
**Fix:** Publish on `podman pod create`. If the port list has to change, recreate
the pod.

## Interview questions

**★ What is a pod, mechanically?**
A group of containers sharing kernel namespaces, held open by an infra container —
"a lightweight container used to coordinate the shared kernel namespace of a
pod" — that runs `/pause` and exists so the namespaces outlive any individual
member. By default the shared set is `ipc`, `net` and `uts`.

**★ Why is `localhost` between containers true in a pod and false everywhere
else?**
Because the pod shares one network namespace, so its containers share one
loopback interface and one port space. Outside a pod each container has its own
network namespace, and `localhost` refers to that container — the commonest
networking mistake there is.

**★ What is the trap with `--share`?**
The PID namespace is not in the default list, so containers in a pod cannot see
each other's processes unless you ask. And the value *replaces* the default list
unless prefixed with `+`, so `--share=pid` quietly removes the shared network
namespace. Use `--share=+pid`.

**How do you publish a port for a service inside a pod?**
On the pod. The documentation says you "must not publish ports of containers in
the pod individually, but only by the pod itself", because the network namespace
belongs to the pod's infra container. Changing the published ports means
recreating the pod.

**Is `docker run --network container:<name>` the same thing?**
It is the same kernel mechanism for the network namespace only, with no infra
container, no group lifecycle and no shared cgroup parent. If the target
container dies, the borrower loses its networking. It is a debugging technique
rather than a deployment unit.

**When would you not use a pod?**
Whenever the containers are separate services that merely talk to each other —
which is most stacks. Then a user-defined network gives you DNS by name,
independent ports and independent lifecycles. A pod is for things that scale,
restart and fail together.

---

← Prev: [Rootless by default](02-rootless-by-default/README.md) · Index: [Phase 11](README.md) · Next → **04 · Quadlet** *(not written yet)*
