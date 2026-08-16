---
title: "podman pod create, ps, rm"
sidebar_label: "08 · Pod commands"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [podman-pod-create(1)](https://docs.podman.io/en/latest/markdown/podman-pod-create.1.html),
> [podman-pod-ps(1)](https://docs.podman.io/en/latest/markdown/podman-pod-ps.1.html),
> [podman-pod-rm(1)](https://docs.podman.io/en/latest/markdown/podman-pod-rm.1.html),
> [podman-pod-stats(1)](https://docs.podman.io/en/latest/markdown/podman-pod-stats.1.html),
> [podman-ps(1)](https://docs.podman.io/en/latest/markdown/podman-ps.1.html) and
> [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html).
> **No sandbox** — no console output on this page.

[Phase 11 · 03](03-pods.md) argues what a pod *is*. This page is how you drive
one, and it ends with the only decision that actually matters: **a pod, or a
user-defined network?** Most of the time the answer is the network, and knowing
why is worth more than knowing the flags.

## The whole lifecycle, in five commands

```bash
podman pod create --name shop -p 8080:80        # ports belong to the pod
podman run -d --pod shop --name api   myapi     # members publish nothing
podman run -d --pod shop --name cache redis:8
podman pod ps                                    # what exists
podman pod rm -f shop                            # takes the containers with it
```

Two details in there are not obvious.

**`--pod` also creates.** The run reference is explicit: "run container in an
existing pod. Podman makes the pod automatically if the pod name is prefixed
with **`new:`**" — so `podman run -d --pod new:shop …` builds the pod and the
first member in one command. Convenient interactively, and a mistake in a script,
because the pod it creates has no published ports and you cannot add them later
without recreating it ([Phase 11 · 03](03-pods.md)).

**Start order is defined.** "When a container is run with a pod with an
infra-container, the infra-container is started first." The namespaces exist
before any member does, which is the whole reason the infra container is there.

## Reading what you have

`podman pod ps` "lists all pods on the system. By default it lists: pod ID, pod
name, the time the pod was created, number of containers attached to pod,
container ID of the pod infra container, status of pod".

🔴 **Note what is missing: the containers' names.** The default view tells you a
pod has four containers and not one thing about them, which is why the two flags
below are the ones you actually type:

```bash
podman pod ps --ctr-names --ctr-status     # what is in it, and is it up
podman pod ps --sort status                # created, ID, name, status, number of containers
podman pod ps --filter name=shop
```

`--ctr-names` "display[s] the container names", `--ctr-status` "display[s] the
container statuses", and `--sort` takes created, ID, name, status or number of
containers, defaulting to created.

⚠️ **`podman ps` and `podman pod ps` answer different questions.** The first
lists containers and by default says nothing about pod membership; `podman ps
--pod` "display[s] the pods the containers are associated with", and
`--filter pod=<name>` narrows to one. If a container looks orphaned, it is
usually that you looked at the wrong list.

## Removing one — the command that deletes more than you asked for

`podman pod rm` "removes one or more stopped pods **and their containers** from
the host". That is the sentence to internalise:

| | |
|---|---|
| No flag | Only a stopped pod can go. "If all containers added by the user are in an exited state, the pod is removed" |
| `-f` / `--force` | "Stop running containers and delete all stopped containers before removal of pod" |
| `-t` / `--time` | "Seconds to wait before forcibly stopping running containers within the pod" — **requires `--force`** |
| `-a` / `--all` | Every pod, "can be used in conjunction with `-f` as well" |
| `-i` / `--ignore` | "Ignore errors when specified pods are not in the container store" — the flag that makes a teardown script idempotent |

🔴 **`podman pod rm -a -f` is the `compose down` of the pod world and it is
unguarded.** Unlike `docker compose down`, there is no project scoping: it takes
every pod you own. On a development machine that is usually fine; in a shell you
share with anything else it is not. There is nothing to undo it.

⚠️ **Deleting a pod deletes its members.** People expect `pod rm` to dissolve the
grouping and leave the containers, the way removing a network leaves the
containers attached to it. It does not — a pod owns its containers, and the
infra container's namespaces are their networking.

## Watching one

`podman pod stats` gives "a live stream of containers in one or more pods
resource usage statistics", with `--no-stream` for a single snapshot and
`--no-reset` to keep the terminal output between intervals.

It works because `--share-parent` defaults to true, so the pod is a cgroup parent
([Phase 11 · 03](03-pods.md)) and a real accounting boundary — you can put a
memory limit on the pod and it bounds everything in it, which is
[Phase 10 · 03](../phase-10-production/03-resource-limits/README.md) one level
up.

⚠️ **"Running rootless is only supported on cgroups v2"**, which is the same
constraint every rootless resource limit carries. On Podman 6 that is moot —
cgroups v1 support was removed — but it will bite on an older host.

## The decision: pod or user-defined network?

This is the section worth keeping. Both give containers a way to talk; they are
not interchangeable.

| | **Pod** | **User-defined network** |
|---|---|---|
| How they reach each other | `127.0.0.1:<port>` — one namespace | DNS by container or service name |
| Port space | **Shared** — two members cannot bind the same port | Independent per container |
| Publishing | Pod-level only, fixed at creation | Per container, any time |
| Lifecycle | One unit: `pod start`, `stop`, `rm` take everything | Independent — restart one, the rest do not notice |
| Failure domain | Shared | Separate |
| Scaling a member | Not possible — the port would collide | Ordinary |
| What Compose builds | Not this | **This** ([Phase 8 · 07](../phase-8-compose/07-networks.md)) |
| Kubernetes analogue | A pod, genuinely | A Service |

**Use a pod** when the containers are one deployable thing: an application and
its log shipper, a proxy sidecar, a cache nothing else reads. They start
together, fail together, and are never scaled apart.

**Use a user-defined network** for everything else — which in a MERN or PERN
stack is everything. An API, a database and a frontend are separate services with
separate lifecycles; you want to restart one without touching the others, and you
want to be able to run two of something. That is what
[Phase 9](../phase-9-mern-pern-stack/README.md) builds throughout, and it never
reaches for a pod.

🔴 **The tell that a pod is wrong:** you are working around a port collision, or
you restarted one container and something unrelated went down with it.

## What `podman compose` does with all this

Nothing, and that is worth knowing. Compose files describe services on a network,
so a Compose stack under Podman gets a **network**, not a pod
([Phase 8 · 15](../phase-8-compose/15-podman-compose.md)). Pods are a Podman-CLI
and Quadlet construct — `.pod` units ([Phase 11 · 04](04-quadlet/README.md)) —
or something you get from Kubernetes YAML via **Phase 11 · 11 · `podman kube
play`** *(not written yet)*.

So the two paths do not meet in the middle: choose the Compose path or the
pod/Quadlet path per project, rather than trying to run both over one stack.

## Gotchas

**Symptom:** `podman pod rm shop` fails, saying the pod has containers in it.
**Cause:** Without `--force` only a stopped pod can be removed — every member has
to be in an exited state.
**Fix:** `podman pod stop shop` then `podman pod rm shop`, or `podman pod rm -f
shop` in one step. Use `-t` with `-f` if members need longer than the default to
shut down.

**Symptom:** A teardown script fails on a pod that was already removed.
**Cause:** `pod rm` errors when the pod is not in the container store.
**Fix:** `--ignore`, which exists for exactly this. Idempotent teardown is worth
the flag.

**Symptom:** `podman ps` shows containers with no sign of which pod they belong
to, and one of them looks orphaned.
**Cause:** The container list does not show pod membership by default.
**Fix:** `podman ps --pod`, or `podman pod ps --ctr-names --ctr-status` to read
it from the pod's side.

**Symptom:** `podman run --pod new:api-stack -p 3000:3000 …` is rejected, or the
port is not reachable.
**Cause:** `new:` creates a pod with no published ports, and ports cannot be
published by a member — they belong to the pod's infra container.
**Fix:** Create the pod explicitly with its ports (`podman pod create -p
3000:3000 --name api-stack`), then run members into it.

## Interview questions

**★ What does `podman pod rm` actually remove?**
The pod and its containers — the reference says it "removes one or more stopped
pods and their containers from the host". It is not a grouping you can dissolve;
the pod owns its members, and their networking is the infra container's
namespaces. Without `--force` the pod must already be stopped.

**★ How do you decide between a pod and a user-defined network?**
By lifecycle. A pod is right when the containers are one deployable thing that
starts, fails and scales together — an app and its sidecar. A user-defined
network is right when they are separate services that merely talk, which is most
stacks: it gives DNS by name, independent ports and independent restarts. Port
collisions or unrelated containers going down together are the tell that a pod
was the wrong call.

**★ What is `--pod new:name` and when should you not use it?**
A shorthand on `podman run` that creates the pod if it does not exist. It is fine
interactively and wrong in a script, because the pod it creates publishes no
ports, and ports cannot be added to a pod after creation — you would have to tear
it down and rebuild it.

**Why does `podman pod ps` need extra flags to be useful?**
Its default columns are the pod's own — ID, name, created, container count, infra
container ID, status — so it tells you how many containers there are and nothing
about them. `--ctr-names` and `--ctr-status` add the members, and `--sort` and
`--filter` narrow the list.

**What does `podman pod stats` rely on?**
The pod being a cgroup parent, which `--share-parent` makes it by default. That
also means a resource limit on the pod bounds everything in it. Rootless, it
needs cgroups v2 — which Podman 6 requires anyway, having dropped v1.

**Does `podman compose` create pods?**
No. A Compose file describes services on a network, so you get a network. Pods
come from the Podman CLI, from `.pod` Quadlet units, or from Kubernetes YAML via
`podman kube play`. Mixing the two models over one stack is not worth the
trouble — pick one per project.

---

← Prev: [`--userns` modes](07-userns-modes.md) · Index: [Phase 11](README.md) · Next → **09 · Quadlet vs `podman generate systemd`** *(not written yet)*
