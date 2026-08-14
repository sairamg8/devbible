---
title: "Restart policies"
sidebar_label: "12 · Restart policies"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against
> [Docker — start containers automatically](https://docs.docker.com/engine/containers/start-containers-automatically/),
> [docker container run — restart](https://docs.docker.com/reference/cli/docker/container/run/),
> [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html) and
> [podman-systemd.unit(5)](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html).
> **No sandbox** — no console output on this page.

**A restart policy tells the engine what to do when a container exits.** It is
the smallest amount of supervision you can have, and the difference between two
of the four values only shows up after a reboot — which is exactly when you find
out you picked wrong.

## The four values

| Policy | Restarts on crash? | Restarts after **daemon restart / reboot**? | After a **manual** `docker stop`? |
|---|---|---|---|
| `no` *(default)* | No | No | No |
| `on-failure[:N]` | Yes, **non-zero exit only** | No | No |
| `always` | Yes, any exit | Yes | **Yes** — it comes back when the daemon restarts |
| `unless-stopped` | Yes, any exit | Yes | **No** — stays stopped |

```bash
docker run -d --restart=unless-stopped --name api myorg/api:1.4.2
docker run -d --restart=on-failure:5 --name worker myorg/worker:1.4.2
docker update --restart=no api          # change it on a running container
```

### `always` vs `unless-stopped` — the only subtle one

They behave identically until you stop a container **by hand** and then restart
the daemon (or reboot the host):

- With **`always`**, the container comes back. The engine treats "should be
  running" as the desired state, and a daemon restart re-asserts it.
- With **`unless-stopped`**, it stays stopped, because you explicitly stopped it.

> **Pick `unless-stopped` for services you administer.** It respects a manual
> stop, which is almost always what you meant. `always` is for containers that
> must run no matter what a human did.

### `on-failure` respects the exit code

`on-failure` restarts only on a **non-zero** exit, and `:N` caps the attempts.
It is right for batch jobs and workers that should retry a failure but stop when
they finish successfully. It deliberately does **not** restart after a daemon
restart, so it is the wrong choice for a long-lived service.

## What a restart policy is not

- **It is not a healthcheck.** A process that is running but wedged — deadlocked,
  out of connections, serving 500s — is never restarted, because it never exited.
  Restart policies react to *exit*, not to *health*. Phase 8 and Phase 10.
- **It is not backoff you control.** The engine applies its own increasing delay
  between attempts; there is no user-tunable curve.
- **It is not a fix.** A container restarting every four seconds is a failing
  container wearing a hat. `docker ps` showing `Restarting (1)` repeatedly is the
  symptom to chase, not to accept.

## Podman: the important difference

🔴 **There is no daemon to re-assert desired state.** `--restart=always` under
Podman restarts a container when it *exits*, but nothing brings containers back
after a **reboot** the way `dockerd` does.

Two things are needed for a rootless container to survive a reboot:

```bash
# 1. Let your user's services run without an active login session
loginctl enable-linger $USER

# 2. Supervise it with systemd - the supported way is a Quadlet unit
#    ~/.config/containers/systemd/api.container
```

**Quadlet** is the answer, not a restart policy: a `.container` unit file that a
systemd generator turns into a real service, with systemd's own `Restart=`
directive doing the supervision. Phase 11 covers it properly.

This is the sharpest practical consequence of the daemonless design, and it is
the mistake most often made when moving a Compose stack from Docker to Podman:
the restart policy is copied across, looks right, and does nothing after the next
reboot.

## Gotchas

**Symptom:** A container you stopped by hand came back after a reboot.
**Cause:** `--restart=always` — the daemon re-asserts the desired state on
startup.
**Fix:** Use `unless-stopped` for anything you administer manually.

**Symptom:** Under Podman, `--restart=always` containers are gone after a reboot.
**Cause:** No daemon to restart them, and your user's session ended at logout.
**Fix:** `loginctl enable-linger $USER` and a Quadlet unit. A restart policy
alone does not survive a reboot rootless.

**Symptom:** `docker ps` shows `Restarting (1)` over and over and the service is
down.
**Cause:** A crash loop. The policy is faithfully restarting a container that
keeps failing.
**Fix:** `docker logs` — the policy is hiding the real error by making the
container look alive. Consider `on-failure:N` in development so it stops and
leaves evidence.

**Symptom:** A wedged service is never restarted despite `always`.
**Cause:** It never exited. Restart policies watch exits, not health.
**Fix:** Add a healthcheck and something that acts on it — an orchestrator, or a
supervisor that restarts on unhealthy. Phase 10.

## Interview questions

**★ What is the difference between `always` and `unless-stopped`?**
Only after a manual stop followed by a daemon restart or reboot: `always` brings
the container back, `unless-stopped` leaves it stopped. For services you
administer by hand, `unless-stopped` is the one that respects your intent.

**★ When would you use `on-failure`?**
For batch jobs and workers that should retry a failure but not be restarted after
finishing successfully. `on-failure:5` also caps the attempts. It does not
restart after a daemon restart, so it is wrong for a long-lived service.

**★ Why do restart policies not help with a hung service?**
They react to the container **exiting**. A process that is running but not
serving never exits, so nothing triggers. That gap is what healthchecks and an
orchestrator exist to close.

**Does `--restart=always` work the same on Podman?**
It restarts a container that exits, but with no daemon there is nothing to bring
containers back after a reboot. That needs `loginctl enable-linger` plus a
Quadlet unit supervised by systemd.

**A container is restarting every few seconds. What do you do?**
Read `docker logs` — the loop is masking a startup failure. The policy is working
as designed; the container is not. In development, `on-failure:N` stops the loop
and preserves the evidence.

---

← Prev: [Overriding ENTRYPOINT and CMD](11-overriding-entrypoint.md) · Index: [Phase 1](README.md) · Next → [Reclaiming disk space](13-reclaiming-disk.md)
