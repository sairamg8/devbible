---
title: "Podman Desktop"
sidebar_label: "16 · Podman Desktop"
sidebar_position: 16
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against [podman-desktop.io](https://podman-desktop.io/) and its
> [introduction](https://podman-desktop.io/docs/intro),
> [podman-machine(1)](https://docs.podman.io/en/latest/markdown/podman-machine.1.html)
> and [Docker Desktop license agreement](https://docs.docker.com/subscription/desktop-license/).
> **No sandbox** — no console output on this page.

Podman Desktop is described as an "innovative desktop tool that brings the power
of containers and Kubernetes to your computer, making it easy to create, manage,
and run containerized applications visually" — a "free and open source" project,
"vendor-neutral", in the **CNCF sandbox**, and "available on Linux, macOS, and
Windows".

**It is a graphical front end over the engine you already have.** Nothing it does
is unavailable from the CLI, and nothing in this phase stops being true because
you are looking at a window. That is the frame to keep.

## What it is genuinely good at

**Seeing state.** The CLI makes you ask for things: `podman pod ps` needs
`--ctr-names --ctr-status` before it tells you anything useful
([Phase 11 · 08](08-pod-commands.md)), and correlating containers, images,
volumes and networks means several commands. A GUI shows all of it at once, which
is a real advantage when you are orienting rather than executing.

**Managing the machine.** On macOS and Windows there is a VM
([Phase 11 · 15](15-podman-machine.md)) and its subcommands are things people
look up every time. Having start, stop and resource settings in a window removes
a category of friction that has nothing to do with containers.

**The Kubernetes bridge.** The documentation covers deploying to **Kind, Lima,
Minikube and OpenShift**, which is the natural next step after
[Phase 11 · 11](11-kube-play.md): manifests you can run locally, then push at a
real cluster without leaving the tool.

**Registries and extensions.** Registry credentials in a settings pane rather
than in `~/.config/containers/`, and a "general extension mechanism" for adding
capabilities the base tool does not ship.

## What it does not change

Everything else in this phase. The GUI runs the same engine, so:

- **The rootless mapping still applies.** A file written into a bind mount is
  still owned by `subuid_start + n − 1` on the host, and no window changes that
  ([Phase 11 · 02](02-rootless-by-default/README.md)). A GUI that hides the
  mapping has not removed it.
- **A green "Running" badge is not health.** It means the container has not
  exited, exactly as `podman ps` does — which
  [Phase 10 · 09](../phase-10-production/09-healthchecks-in-production.md) spends
  a page on. Visual reassurance is the more dangerous version of that mistake.
- **Privileged ports, SELinux labels, log drivers and pods** all behave as the
  rest of this phase describes.

🔴 **The trap specific to a GUI is that clicking is not reproducible.** A
container you created through a form has its configuration nowhere except the
engine's database. A `.container` file ([Phase 11 · 04](04-quadlet/README.md)) or
a `compose.yaml` ([Phase 8](../phase-8-compose/README.md)) is the thing you can
review, commit, and run again next year.

## Where it fits

Use it as **a second window, not the only interface**:

- **Good:** exploring an unfamiliar stack, watching logs while something starts,
  managing the VM, learning what exists.
- **Bad as your only tool:** production is a server you reach over SSH, and the
  CLI is the interface that exists there. Anything you can only do by clicking is
  something you cannot do where it matters.
- **Bad as your source of truth:** if a container's definition exists only
  because someone filled in a form, it will be recreated by hand the next time —
  or not at all.

That is not a criticism of the tool; it is the same rule as `docker run` versus a
Compose file. The GUI is an excellent way to *look*, and a poor way to *define*.

⚠️ **The phase gate is deliberately a CLI task** — a rootless Quadlet unit that
survives a reboot, and an explanation of a file's UID mapping. Neither is
something a GUI teaches you, and both are what an interview or an incident asks
for.

## The comparison that decides it for organisations

For a lot of teams the choice is not made on features. **Docker Desktop requires
a paid subscription past a threshold**: it stays free for personal use,
education, non-commercial open source and small businesses — documented as "fewer
than 250 employees AND less than $10 million in annual revenue" — and needs a
Pro, Team or Business subscription for professional use in larger organisations
and for government entities.

Podman Desktop is "free and open source", vendor-neutral, and in the CNCF
sandbox. There is no threshold.

⚠️ **Note precisely what that does and does not cover.** The licence terms are
about **Docker Desktop**, the desktop application — not about Docker Engine on a
Linux server, and not about images or registries. A team that runs Linux servers
and Docker Engine is not affected by it at all; a team of developers on macOS
laptops is. Getting that distinction right matters, because it is routinely
reported as "Docker is not free any more", which is not what the terms say.

This is also why the engine-neutral approach in the rest of this track is worth
the effort: an organisation may change desktop tools for licensing reasons while
its servers, images and pipelines carry on unchanged.

## Gotchas

**Symptom:** Containers all disappear from the interface on macOS or Windows.
**Cause:** The machine is stopped. Every container lives inside that VM
([Phase 11 · 15](15-podman-machine.md)).
**Fix:** Start the machine. Nothing was lost — the engine simply is not running.

**Symptom:** Deleting a container from the GUI also lost its data.
**Cause:** Whatever was in the writable layer goes with the container, exactly as
on the CLI, and a delete action may include volumes
([Phase 6 · 06](../phase-6-storage/06-volume-lifecycle.md)).
**Fix:** Know which resource you are deleting before confirming. Named volumes
exist so that data is not attached to a container's lifetime.

**Symptom:** Everything looks healthy in the interface and the application is
returning errors.
**Cause:** "Running" is the container's process state, not the application's
readiness — the same gap healthchecks exist to close.
**Fix:** Read the logs and the healthcheck status rather than the badge, and
define a healthcheck that tests something real.

**Symptom:** A container built up through the GUI cannot be reproduced on a
server.
**Cause:** Its configuration exists only in the engine's state, not in a file.
**Fix:** Write it as a Quadlet unit or a Compose service. Use the GUI to
understand it, then write it down.

## Interview questions

**★ What does Podman Desktop actually give you over the CLI?**
Visibility and convenience, not capability. It shows containers, images, pods,
volumes and networks together, manages the macOS/Windows VM without remembering
subcommands, and bridges to local Kubernetes — Kind, Lima, Minikube, OpenShift.
It runs the same engine, so every behaviour in the Podman track applies
unchanged.

**★ Why should a GUI not be your source of truth?**
Because clicking is not reproducible. A container defined through a form exists
only in the engine's state — nothing to review, commit or re-run. A Quadlet unit
or a Compose file is the artefact; the GUI is a view of the result. It is the
same argument as `docker run` versus a Compose file, one layer up.

**Is a green "Running" badge good enough to say a service is up?**
No — it means the container's process has not exited, which a container that
starts and fails to reach its database satisfies. Readiness needs a healthcheck
testing something real, and in production it needs to feed something that acts on
the result.

**When does Docker Desktop cost money, and when does it not?**
Its licence keeps it free for personal use, education, non-commercial open source
and small businesses — under 250 employees and under $10 million annual revenue —
and requires a paid subscription for professional use in larger organisations and
for government entities. Crucially the terms are about the **desktop
application**, not Docker Engine on a Linux server and not images or registries,
so a team running Linux servers is unaffected. Podman Desktop has no such
threshold.

**Would you use it on a server?**
No. Servers are reached over SSH and the CLI is what exists there. That is also
why the phase gate for Podman is a Quadlet unit surviving a reboot rather than
anything you can click.

---

## Phase 11 in one paragraph

Podman is not Docker with a different name. It is **daemonless**, so containers
are children of your session and systemd is the supervisor
([01](01-daemonless/README.md), [04](04-quadlet/README.md)); it is **rootless**,
so a user-namespace map sits between every UID inside a container and the host
([02](02-rootless-by-default/README.md), [06](06-podman-unshare.md),
[07](07-userns-modes.md)); it has **pods**, the one construct Docker has no
equivalent of ([03](03-pods.md), [08](08-pod-commands.md)); and it meets Docker's
world through a compatibility layer that is good but not total
([13](13-docker-cli-compatibility.md)). Everything else in this phase — where it
bites ([05](05-where-podman-bites/README.md)), auto-update
([10](10-auto-update.md)), Kubernetes YAML ([11](11-kube-play.md)), the split-out
tools ([12](12-buildah-and-skopeo.md)), the removals in Podman 6
([14](14-podman-6-breaking-changes.md)) and the VM on macOS and Windows
([15](15-podman-machine.md)) — follows from those four facts.

---

← Prev: [`podman machine`](15-podman-machine.md) · Index: [Phase 11](README.md) · Next → **Phase 12 — Delivery, CI and orchestration** *(not written yet)*
