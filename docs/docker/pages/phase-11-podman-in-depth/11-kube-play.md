---
title: "podman kube play and generate kube"
sidebar_label: "11 · kube play / generate kube"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [podman-kube(1)](https://docs.podman.io/en/latest/markdown/podman-kube.1.html),
> [podman-kube-play(1)](https://docs.podman.io/en/latest/markdown/podman-kube-play.1.html),
> [podman-kube-generate(1)](https://docs.podman.io/en/latest/markdown/podman-kube-generate.1.html)
> and [podman-systemd.unit(5) — Quadlet](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html).
> **No sandbox** — no console output on this page.

Podman reads and writes Kubernetes YAML. `podman kube` "recreates containers,
pods or volumes based on the input from a structured (like YAML) file input", and
the four subcommands are the whole story:

| | |
|---|---|
| **`play`** | "Create containers, pods and volumes based on Kubernetes YAML" |
| **`generate`** | "Generate Kubernetes YAML based on containers, pods or volumes" |
| **`down`** | "Remove containers and pods based on Kubernetes YAML" |
| **`apply`** | "Apply Kubernetes YAML based on containers, pods or volumes **to a Kubernetes cluster**" |

That last row is the one people do not expect: `apply` sends your local
definition to a real cluster. The other three never leave the machine.

**This is not a Kubernetes cluster.** There is no scheduler, no control plane and
no second node — the cluster-level fields are documented as not applicable, and
that is the honest frame for the whole feature. It is Kubernetes YAML as a *file
format for one host*.

## `kube play` — running the YAML

```bash
podman kube play stack.yaml
podman kube play --replace stack.yaml     # rebuild from a changed file
podman kube play --down stack.yaml        # tear it back down
```

It "reads in a structured file of Kubernetes YAML" and "recreates containers,
pods, or volumes described in the YAML". The kinds it understands are **Pod,
Deployment, DaemonSet, Job, PersistentVolumeClaim, ConfigMap and Secret** — which
covers a surprising amount of a real manifest.

The options that matter day to day:

- **`--replace`** "tears down existing pods from a previous run and recreates
  them with the Kubernetes YAML file" — the edit-and-reapply loop.
- **`--down`** "tears down the pods created by a previous run of `podman kube
  play`", with `--force` to take the volumes too. ⚠️ Same shape as
  [`compose down -v`](../phase-8-compose/03-up-and-down/README.md): the flag that
  deletes your data.
- **`--build`** builds images "even if found in local storage"; `--build=false`
  disables it.
- **`--configmap`** points at ConfigMap YAML files "to provide environment
  variable values within pod containers".
- **`--publish`** and **`--network`** and **`--userns`** override what the YAML
  says, and the reference is explicit that command-line settings take precedence.
  Useful, and a portability smell if you rely on them.

🔴 **A `Pod` in the YAML becomes a real Podman pod** — the infra container, the
shared namespaces, the port rules, all of
[Phase 11 · 03](03-pods.md). The two features are the same construct seen from
two angles, which is exactly why pods are worth understanding before touching
this.

## What it does not support, and why that is fine

The reference carries long tables of fields marked unsupported, and the pattern
in them is consistent: **the things a cluster provides are the things missing** —
`nodeSelector`, `affinity`, `tolerations`, `schedulerName`, `imagePullSecrets`,
and a range of lifecycle and probe features.

None of those mean anything on one host. There is nowhere else to schedule to,
nothing to tolerate, and no node to select. So the gap is not really a
limitation of `kube play` — it is the shape of the problem. What you should take
from it is the reverse warning: **YAML that runs here is not proof it will run on
a cluster**, because everything cluster-specific was ignored rather than
validated.

## `kube generate` — the other direction

```bash
podman kube generate my-pod > pod.yaml
podman kube generate --type deployment --service my-pod
```

It "generates Kubernetes YAML (v1 specification) from Podman containers, pods or
volumes". `--type` picks pod (the default), deployment, daemonset or job;
`--service` "generate[s] a Kubernetes service object in addition to the Pods",
and `--filename` writes to a file instead of stdout — refusing to overwrite one
that exists.

⚠️ **`--podman-only` adds "podman-only reserved annotations in generated YAML
file (Cannot be used by Kubernetes)".** The flag name is the warning: it makes
the file round-trip better through Podman and unusable on a cluster. Do not put
it on anything you intend to hand over.

The realistic use is **a starting point, not a deliverable**. Build the thing
locally, generate the YAML, then read every line of it before it goes near a
cluster — the same relationship a generated systemd unit has to a hand-written
one ([Phase 11 · 09](09-quadlet-vs-generate-systemd.md)).

## Where this fits against Compose

Both describe a multi-container application in one file, and choosing between
them is a real decision:

| | **Compose** | **`kube play`** |
|---|---|---|
| Audience | Development and single-host deployment | Development that will end up on Kubernetes |
| Portability target | Docker and Podman | A Kubernetes cluster, eventually |
| Networking model | User-defined network, DNS by service name | A pod: one namespace, `localhost` |
| Scaling a service | `--scale` ([Phase 8 · 17](../phase-8-compose/17-scale-and-limits.md)) | Not on one host |
| Ergonomics | Better — `up`, `logs`, `exec`, watch | Thinner |

**If the destination is Kubernetes, writing the manifests from the start and
running them with `kube play` removes a translation step.** If it is not, Compose
is the better tool and pretending otherwise costs you every convenience in
[Phase 8](../phase-8-compose/README.md).

## Running it under systemd

Quadlet has a **`.kube`** unit type ([Phase 11 · 04](04-quadlet/README.md)):
point it at a YAML file and systemd manages the whole thing as one service, with
the same boot behaviour and dependency handling as a `.container` unit. That is
the production shape of this feature on a single host — `kube play` by hand is
for iterating.

## Gotchas

**Symptom:** `--down` removed everything including a database volume.
**Cause:** `--down --force` removes the volumes as well as the pods.
**Fix:** Know which one you typed. This is the `compose down -v` trap in a
different costume, and there is no undo.

**Symptom:** The manifest runs perfectly under Podman and fails on the cluster.
**Cause:** Unsupported fields are ignored, not rejected. `nodeSelector`,
`affinity`, `tolerations` and the rest are no-ops on one host, so a manifest with
a mistake in them passes locally.
**Fix:** Treat local success as a smoke test only, and validate against the
cluster's own tooling before shipping.

**Symptom:** Generated YAML is rejected by `kubectl`.
**Cause:** `--podman-only` was used, which adds annotations that "cannot be used
by Kubernetes".
**Fix:** Regenerate without it, and read the output before handing it over.

**Symptom:** Two containers in the YAML collide on a port.
**Cause:** A Kubernetes `Pod` becomes a real Podman pod — one network namespace,
one port space.
**Fix:** The same answer as [Phase 11 · 03](03-pods.md): change the port, or
accept that these are separate deployables.

## Interview questions

**★ What is `podman kube play` actually for?**
Running Kubernetes YAML on a single host — it recreates the containers, pods and
volumes a manifest describes, supporting Pod, Deployment, DaemonSet, Job,
PersistentVolumeClaim, ConfigMap and Secret. There is no scheduler and no control
plane, so it is Kubernetes YAML as a file format for one machine, not a cluster.
Its main value is removing a translation step when the destination *is*
Kubernetes.

**★ Why do unsupported fields matter more than they look?**
Because they are ignored rather than rejected. `nodeSelector`, `affinity`,
`tolerations`, `schedulerName` and similar are meaningless on one host, so a
manifest containing a mistake in any of them runs cleanly locally and fails on
the cluster. Local success is a smoke test, not validation.

**★ Compose or `kube play`?**
Compose unless the application is going to Kubernetes. Compose has the better
day-to-day ergonomics, a networking model that matches most stacks, and real
scaling. `kube play` earns its place when the manifests are the deliverable
anyway — then maintaining a second Compose file is duplicated truth.

**What does `podman kube apply` do that the others do not?**
It sends the definition to an actual Kubernetes cluster. `play`, `generate` and
`down` all operate locally; `apply` is the one that reaches outside the machine.

**Is generated YAML production-ready?**
No — treat it as a first draft. It is generated from what you happen to be
running, and `--podman-only` in particular adds annotations that cannot be used
by Kubernetes. Read it line by line, the same way you would a generated systemd
unit.

**How would you run a manifest as a service at boot?**
A Quadlet `.kube` unit pointing at the YAML file, so systemd owns the lifecycle
with the same dependency and restart handling as a `.container` unit. Running
`kube play` by hand is for iterating, not for deployment.

---

← Prev: [`podman auto-update`](10-auto-update.md) · Index: [Phase 11](README.md) · Next → [12 · Buildah and Skopeo](12-buildah-and-skopeo.md)
