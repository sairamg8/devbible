---
title: "podman auto-update"
sidebar_label: "10 · podman auto-update"
sidebar_position: 10
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against [podman-auto-update(1)](https://docs.podman.io/en/latest/markdown/podman-auto-update.1.html),
> [podman-systemd.unit(5) — Quadlet](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html)
> and [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html).
> **No sandbox** — no console output on this page.

`podman auto-update` pulls new images and restarts the containers using them —
"auto update containers according to their auto-update policy". It is the one
piece of deployment automation Podman ships in the box, and it is **narrower than
it sounds**: three conditions must all hold before it does anything at all.

## The three conditions

**1 · The container carries an auto-update policy.** Set as the label
`io.containers.autoupdate`, or as `AutoUpdate=` in a Quadlet unit
([Phase 11 · 04](04-quadlet/README.md)). No label, no update — the command
silently has nothing to do.

**2 · It runs inside a systemd unit.** The documentation is flat about it:
"container or Kubernetes workloads must run inside a systemd unit". Auto-update
does not restart a container directly; it restarts the **unit**, which is what
brings the container back with the new image. A container started by hand with
`podman run` is not eligible, however it is labelled.

**3 · With the `registry` policy, the image reference is fully qualified.**
"The `registry` policy requires a fully-qualified image reference (e.g.,
`quay.io/podman/stable:latest`) to be used to create the container." A short name
cannot be checked, because Podman would have to guess which registry to ask —
the short-name resolution problem from
[Phase 11 · 05](05-where-podman-bites/README.md), showing up here as a hard
requirement rather than a prompt.

## The two policies

| Policy | What it compares | Use |
|---|---|---|
| **`registry`** | The remote registry's image against the running one | Deploying from a registry you push to |
| **`local`** | "Podman compares the image digest of the container to the one in the local container storage" | You build on the host, or something else pulls |

`local` is the one people miss. It never touches the network: you build or pull
the image by some other route, and auto-update notices that local storage now
holds a different digest than the running container and restarts the unit. That
makes it the right policy for a machine that builds its own images, and for a
host where the pull is done by something you control rather than by a timer.

## The timer

Podman ships the schedule. `podman-auto-update.service` "is triggered daily at
midnight by the `podman-auto-update.timer` systemd timer", and the service can
also be started by hand or pulled in by another unit.

```bash
systemctl --user enable --now podman-auto-update.timer   # rootless
```

⚠️ **Rootless, the timer runs in your user manager**, so it needs the same
lingering that keeps rootless services alive across logout
([Phase 11 · 01](01-daemonless/README.md)). Without it there is no user manager
at midnight and the timer simply does not fire.

## Rollback, and the catch that decides whether it works

Rollback defaults to **true**: if the unit fails to come back after the image
changes, Podman reverts to the previous image and restarts again. That is a real
safety net and it rests on one sentence:

> "Note that detecting if a systemd unit has failed is best done by the container
> sending the READY message via SDNOTIFY."

🔴 **That is the whole page in one line.** Systemd's idea of "started" is
otherwise "the process did not exit immediately", which a broken application
satisfies happily — it starts, fails to connect to its database, and serves
errors. Rollback sees a healthy unit and does nothing.

To make it real, the container has to tell systemd when it is genuinely ready:
`--sdnotify` on `podman run` (default `container`, meaning the container itself
sends the message) or `Notify=` in a Quadlet unit, with the application calling
`sd_notify` once its dependencies are up. This is
[Phase 10 · 02](../phase-10-production/02-graceful-shutdown/README.md)'s
readiness argument arriving from the other end: readiness is not a nicety here,
it is the input to the rollback decision.

Turn it off with `--rollback=false` if you would rather fail loudly than have a
version silently revert.

## Looking before leaping

```bash
podman auto-update --dry-run
```

Checks without pulling or restarting: "the `UPDATED` field indicates the
availability of a new image with 'pending'". This is the command worth putting in
a status check — it answers "is anything on this host behind?" without changing
anything.

`--authfile` (default `${XDG_RUNTIME_DIR}/containers/auth.json` on Linux),
`--tls-verify` (default true) and `--format` for JSON or a Go template round out
the useful options.

## Should you actually use it?

Honestly: on a single host with services you own, yes — it is far better than the
alternative of nobody updating anything. Beyond that, be deliberate.

- **It deploys whatever the tag points at, unreviewed.** With a moving tag, a
  registry push becomes a production deployment at midnight with no gate. That
  makes your tag strategy the real control — **Phase 12 · 01 · Tag strategy**
  *(not written yet)*.
- **A digest-pinned image never updates**, by definition
  ([Phase 5 · 08](../phase-5-image-quality/08-pinning-by-digest.md)). The two
  practices are opposites; pick per service.
- **There is no staged rollout.** Every unit on the host that matches updates in
  the same pass. On more than one host, a CI pipeline is the honest answer.

**Docker ships no equivalent in the engine.** The usual answers there are
external — a CI job that redeploys, or a third-party watcher — which is a real
difference in what the two tools consider their job.

## Gotchas

**Symptom:** `podman auto-update` prints nothing and updates nothing.
**Cause:** Nothing is eligible — no `io.containers.autoupdate` label, or the
container is not running inside a systemd unit.
**Fix:** Add the label (or `AutoUpdate=` in the Quadlet unit) and make sure the
container is managed by systemd. Confirm with `--dry-run`.

**Symptom:** A container updates on one host and not another, with the same
label.
**Cause:** The `registry` policy needs a fully-qualified image reference. A short
name in the unit cannot be resolved to a registry to check.
**Fix:** Write the full reference — registry, repository and tag.

**Symptom:** A broken image was rolled out and rollback did not fire.
**Cause:** The unit did not *fail*. The container started and stayed up while
being useless, and detecting failure "is best done by the container sending the
READY message via SDNOTIFY".
**Fix:** Have the application send readiness via `sd_notify`, and set
`--sdnotify`/`Notify=` accordingly. Without it, rollback only catches a container
that exits.

**Symptom:** Rootless auto-update never runs, though the timer is enabled.
**Cause:** The timer lives in your user manager, which does not exist when you
are not logged in.
**Fix:** `loginctl enable-linger` for the user, the same requirement every
rootless service has.

## Interview questions

**★ What does `podman auto-update` need before it will do anything?**
Three things: an auto-update policy on the container (the
`io.containers.autoupdate` label or Quadlet's `AutoUpdate=`), the container
running inside a systemd unit, and — for the `registry` policy — a fully
qualified image reference. Miss any one and the command does nothing, quietly.

**★ How does rollback actually decide something failed?**
By whether the systemd unit failed, and the documentation notes that detecting
this is best done by the container sending the READY message via SDNOTIFY.
Without that, systemd's bar is only that the process did not exit — so an
application that starts and is broken looks fine and rollback never fires.
Readiness signalling is what makes the safety net real.

**★ What is the `local` policy for?**
It compares the running container's image digest against local container
storage rather than a registry, and restarts the unit if they differ. It suits a
host that builds its own images, or one where the pull is done by something else
you control, because it never has to reach the network.

**When is auto-update the wrong tool?**
When a registry push should not be a deployment. It updates whatever the tag
points at, with no review, no staging and no per-host rollout — so on a fleet, or
anywhere a change needs a gate, a CI pipeline is the right shape. It is also
mutually exclusive with digest pinning.

**How do you check what would happen without doing it?**
`podman auto-update --dry-run`, where the `UPDATED` field shows `pending` for
anything with a newer image available. It is a good candidate for a scheduled
report on hosts you deliberately update by hand.

**Does Docker have this?**
Not in the engine. Updating is treated as the orchestrator's or the pipeline's
job there, so the equivalents are external tools. Podman's version exists because
Podman's deployment story is systemd, and systemd is already supervising the
unit it needs to restart.

---

← Prev: [Quadlet vs `podman generate systemd`](09-quadlet-vs-generate-systemd.md) · Index: [Phase 11](README.md) · Next → [11 · `podman kube play` / `generate kube`](11-kube-play.md)
