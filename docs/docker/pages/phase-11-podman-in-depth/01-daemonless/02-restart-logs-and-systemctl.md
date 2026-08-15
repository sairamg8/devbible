---
title: "What it changes: restart, logs and systemctl"
sidebar_label: "02 · Restart, logs, systemctl"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html),
> [podman-logs(1)](https://docs.podman.io/en/latest/markdown/podman-logs.1.html),
> [loginctl(1)](https://man7.org/linux/man-pages/man1/loginctl.1.html),
> [logind.conf(5)](https://man7.org/linux/man-pages/man5/logind.conf.5.html)
> and [systemd.service(5)](https://man7.org/linux/man-pages/man5/systemd.service.5.html).
> **No sandbox** — no console output on this page.

[The previous chunk](01-what-runs-instead.md) established that a Podman container
is a process in your session rather than a child of a machine-wide service. The
syllabus row names the three places that shows up, and they are exactly the three
that surprise people in production: **restart, logs, and `systemctl`.**

## Restart: the policy is real, the supervisor is not

`--restart` exists and behaves as you would expect *while something is running to
enforce it*. The documented policies:

- **`no`** — "Do not restart containers on exit"; **`never`** is a synonym.
- **`on-failure[:max_retries]`** — "Restart containers when they exit with a
  non-zero exit code, retrying indefinitely or until the optional
  *max_retries* count is hit".
- **`always`** — "Restart containers when they exit, regardless of status,
  retrying indefinitely".
- **`unless-stopped`** — "Restart containers when they exit, unless the container
  was explicitly stopped by the user."

And the rule that catches everybody, quoted directly: "Restart policy does not
take effect if a container is stopped via the **podman kill** or **podman stop**
commands." A policy is not a supervisor; it is a rule about *exits you did not
ask for*. That distinction is the same one
[Phase 10 · 07](../../phase-10-production/07-restart-as-supervision.md) makes for
Docker.

### The reboot question, answered precisely

Under Docker the daemon starts at boot and re-asserts restart policies as part of
starting. Podman has no such process, so **a separate unit does that job**:
"Podman provides a systemd unit file, `podman-restart.service`, which restarts
containers after a system reboot."

🔴 **It has to be enabled, and the two "always restart" policies do not behave
the same across a reboot.** The documentation distinguishes them explicitly for
`unless-stopped`:

> "After a system reboot, containers with this policy will be restarted by
> podman-restart.service only if they were not explicitly stopped by the user
> before the reboot. This differs from **always**, which restarts containers
> after a system reboot regardless of whether they were user-stopped"

So `always` is genuinely more aggressive than `unless-stopped` on Podman — it
will bring back a container you deliberately stopped before rebooting. Under
Docker the two are much closer in practice, which is why copying a habit across
engines is a mistake here.

The documentation's own advice is the one to follow: **when containers run as
systemd services, use systemd's restart functionality rather than this option.**
That is the argument that ends at [04 · Quadlet](../04-quadlet/README.md).

## The session problem, which has nothing to do with Podman

Here is the failure everyone hits once: a rootless container "works until I close
my SSH session".

That is not a container bug and not a Podman bug. It is `systemd-logind` doing
what it is documented to do. From `logind.conf(5)`, `KillUserProcesses=`:

> "Configures whether the processes of a user should be killed when the user logs
> out. If true, the scope unit corresponding to the session and all processes
> inside that scope will be terminated."

with the man page's default being **`yes`**. Your login gets a session scope;
`conmon` and the container start inside it; you log out; the scope and everything
in it is terminated. ⚠️ **Check your own host rather than assuming** — that
setting exists in `/etc/systemd/logind.conf` precisely so it can be overridden,
and it is not unusual to find it changed.

### The fix is lingering, and it is a systemd concept

From `loginctl(1)`:

> "Enable/disable user lingering for one or more users. If enabled for a specific
> user, a user manager is spawned for the user at boot and kept around after
> logouts. This allows users who are not logged in to run long-running services."

```bash
loginctl enable-linger "$USER"
```

The key word is **user manager**. `logind.conf(5)` notes that processes may run
under "the user manager unit `user@.service`" independently of login sessions —
so the fix is not "stop logind killing things", it is **move the work out of the
session scope and into your persistent user manager**, where it was always
supposed to live.

That reframes the whole problem: a rootless service should not be a process you
left running in a shell. It should be a unit your user manager owns.

## Logs: a different default, and a different owner

Docker's default log driver is `json-file`, which performs no rotation — the
standard way a host fills its disk
([Phase 10 · 08](../../phase-10-production/08-log-drivers-and-rotation.md)).

Podman's default is different. From `podman-run(1)`:

> "Logging driver for the container. Currently available options are
> **k8s-file**, **journald**, **none**, **passthrough** and **passthrough-tty**,
> with **json-file** aliased to **k8s-file** for scripting compatibility.
> (Default **journald**)."

Two things follow, and both are consequences of daemonlessness:

- 🔴 **`json-file` is not `json-file`.** It is an alias for `k8s-file`, kept "for
  scripting compatibility". A script ported from Docker will be accepted and will
  not do what its author meant.
- **By default your container's output goes into the journal**, written by
  `conmon`, not into a per-container file managed by an engine. So **rotation is
  journald's business** — `SystemMaxUse=` and friends — not a per-container
  `max-size`/`max-file` pair. The Docker habit of setting rotation on every
  container has no equivalent to set.

`podman logs` itself "batch-retrieves whatever logs are present for one or more
containers at the time of execution" — note *whatever is present*: the command is
a reader over whichever driver that container was created with, which is why the
answer to "why is `podman logs` empty" is almost always the driver.

⚠️ The `passthrough` and `passthrough-tty` drivers are listed as available
options; the run reference names them without describing their behaviour, so this
page does not claim what they do. Reach for them only from a source that does.

## `systemctl`: the part that is strictly better

This is where daemonless pays for its inconveniences.

Under Docker, a systemd unit running `docker run` supervises **the CLI**, because
the container is the daemon's child. `Restart=`, `KillMode` and `TimeoutStopSec=`
all act on the wrong process, so the unit needs an explicit `ExecStop=` that
performs a real `docker stop` — the whole awkward shape argued in
[Phase 10 · 14](../../phase-10-production/14-under-systemd.md).

Under Podman the container really is the unit's own descendant. Everything
systemd knows how to do therefore applies to the thing you care about:

- **Process tracking is correct**, so `Restart=`, `RestartSec=` and
  `TimeoutStopSec=` mean what they say.
- **`--cgroups` "determines whether the container creates cgroups", and the
  "default is *enabled*"** — so the container appears in the cgroup tree and
  `systemd-cgls`, `systemctl status` and cgroup accounting all show it.
- **`--conmon-pidfile`** exists for exactly this: "Write the pid of the `conmon`
  process to a file. As `conmon` runs in a separate process than Podman, this is
  necessary when using systemd to restart Podman containers."
- **`--sdnotify`** "determines how to use the NOTIFY_SOCKET, as passed with
  systemd and `Type=notify`", defaulting to **`container`** — meaning readiness
  can be reported by the *application inside the container* to the unit outside
  it. Docker has no equivalent path for that signal at all.

🔴 **The conclusion of this topic:** on a systemd host, Podman's design means you
should stop hand-writing units around a client and let systemd own the container
directly — which is what Quadlet generates for you. Phase 10 stopped at that
sentence; [04 · Quadlet](../04-quadlet/README.md) is where it is cashed.

## Gotchas

**Symptom:** A rootless container dies the moment the SSH session ends.
**Cause:** `KillUserProcesses=` terminates the session scope and everything in it
at logout, and the container was started inside that scope.
**Fix:** `loginctl enable-linger $USER` so a user manager is spawned at boot and
kept after logout, and run the container as a unit that manager owns rather than
as a stray process in a shell.

**Symptom:** Containers with `--restart=always` do not come back after a reboot.
**Cause:** There is no daemon to re-assert policies at boot; that job belongs to
`podman-restart.service`, which is not doing it because it is not enabled — or
the user has no lingering user manager to run it.
**Fix:** Enable `podman-restart.service` for that user, plus lingering. For
anything that matters, use a systemd unit as the documentation recommends.

**Symptom:** A container you stopped on purpose is running again after a reboot.
**Cause:** `always`, which the documentation says "restarts containers after a
system reboot regardless of whether they were user-stopped".
**Fix:** Use `unless-stopped`, which restarts on reboot "only if they were not
explicitly stopped by the user before the reboot".

**Symptom:** `--log-driver=json-file` was set for Docker parity, and the log
files are not where the script expects.
**Cause:** On Podman `json-file` is an alias for `k8s-file`, accepted for
scripting compatibility rather than for identical behaviour.
**Fix:** Decide deliberately: keep the default `journald` and read with
`journalctl`, or set `k8s-file` knowingly. Do not port a Docker rotation config
across and assume it applies.

## Interview questions

**★ A rootless Podman container stops when the operator logs out. What is
happening and what is the fix?**
`systemd-logind` terminates the user's session scope and every process in it at
logout — `KillUserProcesses=`, documented as defaulting to yes. The container was
started inside that scope. The fix is `loginctl enable-linger`, which spawns a
user manager at boot and keeps it after logout, and then running the container as
a unit that manager owns instead of as a loose process.

**★ Podman has `--restart=always`, so why is it not enough for a reboot?**
Because a restart policy is enforced by something running, and Podman has no
daemon to re-assert policies at boot. That job is done by `podman-restart.service`,
which has to be enabled. Also note that `always` restarts after reboot regardless
of whether the container was user-stopped, while `unless-stopped` restarts only
containers that were not explicitly stopped — a distinction worth getting right.

**★ Why is a systemd unit for a Podman container structurally better than one for
a Docker container?**
Under Docker the unit supervises the CLI, because the container belongs to the
daemon — so `Restart=`, the kill mode and the stop timeout act on the wrong
process and the unit needs an explicit `ExecStop=`. Under Podman the container is
the unit's own descendant, so process tracking, cgroup accounting and readiness
via `--sdnotify` all apply to the container itself. That is why Quadlet exists and
why hand-written units are the wrong answer on Podman.

**What is Podman's default log driver, and what does that change?**
`journald`, against Docker's `json-file`. Output goes to the journal, written by
`conmon`, so rotation is journald's configuration rather than a per-container
`max-size`/`max-file` pair — the Docker habit has nothing to attach to.

**What is the trap with `--log-driver=json-file` on Podman?**
It is an alias for `k8s-file`, kept for scripting compatibility. The flag is
accepted, so a ported script runs clean and produces something other than what its
author intended.

**Why does `--conmon-pidfile` exist?**
Because `conmon` runs in a separate process from `podman`, so a systemd unit that
needs to track the surviving supervisor has to be told where its PID is. The
documentation names it as necessary when using systemd to restart Podman
containers.

---

← Prev: [What runs instead of a daemon](01-what-runs-instead.md) · Index: [Phase 11](../README.md) · Next → [02 · Rootless by default](../02-rootless-by-default/README.md)
