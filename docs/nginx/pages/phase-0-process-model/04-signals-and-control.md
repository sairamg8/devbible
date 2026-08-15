---
title: "Signals and nginx -s"
sidebar_label: "04 · Signals and control"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against [Controlling nginx](https://nginx.org/en/docs/control.html)
> (the master and worker signal tables) and
> [Command-line parameters](https://nginx.org/en/docs/switches.html).
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**You do not restart nginx. You send it a signal, and it reconfigures itself
around the traffic it is already carrying. There are six signals and four words
that send them.**

## The four words

`nginx -s <signal>` finds the master via its PID file and sends the right signal.
This is the entire operator interface:

```bash
nginx -s reload    # re-read the configuration
nginx -s quit      # graceful shutdown
nginx -s stop      # fast shutdown
nginx -s reopen    # re-open the log files
```

| Word | Signal sent | What it does |
|---|---|---|
| `reload` | **HUP** | Re-read config, start new workers, retire the old ones gracefully |
| `quit` | **QUIT** | Graceful shutdown — finish in-flight requests, then exit |
| `stop` | **TERM** | Fast shutdown — cut connections and exit now |
| `reopen` | **USR1** | Close and re-open log files, for rotation |

**`quit` and `stop` are not synonyms and the difference is a production
incident.** `stop` terminates connections mid-response. `quit` lets every
in-flight request finish first. Use `quit` unless something is actively wrong.

## The full signal table

Two signals have no `-s` word and must be sent with `kill`. Both belong to the
binary upgrade sequence on page 05.

**To the master process:**

| Signal | Action |
|---|---|
| `TERM`, `INT` | fast shutdown |
| `QUIT` | graceful shutdown |
| `HUP` | change configuration: re-read it, start new workers with it, gracefully shut down the old ones (also picks up a changed time zone, on FreeBSD and Linux) |
| `USR1` | re-open log files |
| **`USR2`** | **upgrade the executable file** — no `-s` word |
| **`WINCH`** | **graceful shutdown of the worker processes**, leaving the master running — no `-s` word |

**To an individual worker process** — you will rarely do this, but it explains
what the master is sending downward:

| Signal | Action |
|---|---|
| `TERM`, `INT` | fast shutdown |
| `QUIT` | graceful shutdown |
| `USR1` | re-open log files |
| `WINCH` | abnormal termination for debugging (requires `debug_points`) |

Note `WINCH` means something different to a worker than to the master. Send it to
the right process.

## Finding the master

Everything above targets **the master**, whose PID is in the file named by the
`pid` directive (documented default `logs/nginx.pid`; packages typically set
`/run/nginx.pid`).

```bash
cat /run/nginx.pid                 # the master's PID
kill -USR2 "$(cat /run/nginx.pid)" # send a signal with no -s equivalent
```

`nginx -s <word>` reads that same file for you. If the PID file is missing or
stale — which happens after an unclean stop — `nginx -s reload` fails with
`open() "/run/nginx.pid" failed`, and the fix is to find the master yourself
rather than to start a second one.

## Prefer the service manager

On a systemd host, use the unit rather than the binary:

```bash
systemctl reload nginx     # unit's ExecReload, which runs nginx -s reload
systemctl stop nginx
systemctl status nginx
```

The reason is bookkeeping, not capability: systemd tracks the process it started.
Bypassing it with `nginx -s stop` leaves systemd believing the service is still
running, and the next `systemctl start` behaves unpredictably. In a **container**
the reverse holds — there is no service manager, so the binary and its signals
are the interface (Phase 11).

## Log rotation and `USR1`

`USR1` exists because of a Unix detail that surprises people: **renaming or
deleting an open file does not affect the process writing to it.** The worker
holds a descriptor to the *inode*, not the path. Rotate `access.log` to
`access.log.1` and nginx keeps writing to the same file under its new name; the
new `access.log` stays empty forever.

`USR1` makes the master close its log descriptors, re-open them by path, and pass
the new ones to the workers. Which is why every logrotate config for nginx ends
in a `postrotate` hook:

```text
/var/log/nginx/*.log {
    daily
    rotate 14
    compress
    missingok
    postrotate
        [ -f /run/nginx.pid ] && kill -USR1 "$(cat /run/nginx.pid)"
    endscript
}
```

In a container this is all irrelevant: the official image symlinks the logs to
`stdout` and `stderr`, and rotation is the log driver's problem.

## Gotchas

**Symptom:** Log files stopped growing after a rotation, and nothing appears in
the new file.
**Cause:** The rotation renamed the file without telling nginx. Workers are still
writing to the old inode.
**Fix:** `nginx -s reopen` (or `kill -USR1`) now, and add the `postrotate` hook so
it happens every time. Confirm with `lsof -p <worker-pid>`, which will show the
old path marked `(deleted)`.

**Symptom:** `nginx -s reload` fails with
`nginx: [error] open() "/run/nginx.pid" failed (2: No such file or directory)`.
**Cause:** No PID file — nginx is not running, or it was started with a different
`pid` path, or a previous stop was unclean.
**Fix:** Check whether a master is actually alive before doing anything else. If
one is, find its PID and signal it directly; if not, start nginx normally.
Starting a second nginx while one holds port 80 just produces a confusing
`bind() ... Address already in use`.

**Symptom:** A deploy script runs `nginx -s stop` and users see truncated
responses and reset connections.
**Cause:** `stop` is TERM — fast shutdown, connections cut mid-response.
**Fix:** `quit` for a planned shutdown, `reload` for a config change. `stop` is
for when nginx is misbehaving and you want it gone now.

**Symptom:** You sent `WINCH` expecting a graceful stop and nginx kept serving.
**Cause:** `WINCH` shuts down the *workers* and leaves the master running with no
one to serve traffic — it is one step of the binary upgrade, not a stop command.
**Fix:** Use `quit`. `WINCH` only makes sense inside the page 05 sequence.

**Symptom:** `systemctl status nginx` says the service is running, but nothing
listens on port 80.
**Cause:** Somebody used `nginx -s stop` directly, so systemd's view and reality
diverged.
**Fix:** `systemctl stop nginx` then `systemctl start nginx` to resynchronise, and
use `systemctl reload` from then on.

## Trade-off

**Signals give you an interface with no acknowledgement.** `kill -HUP` returns
immediately and tells you nothing about whether the configuration was valid, only
that the signal was delivered. nginx will roll back to the old configuration and
log the failure — quietly, in the error log you were not reading.

That is precisely why `nginx -t` exists and why every reload should be
`nginx -t && nginx -s reload`. Page 06 is that habit in full.

## Interview questions

**★ What is the difference between `nginx -s quit` and `nginx -s stop`?**
`quit` sends QUIT: a graceful shutdown where workers stop accepting new
connections but finish the requests they are already serving before exiting.
`stop` sends TERM: a fast shutdown that terminates connections immediately. Use
`quit` for anything planned.

**★ How do you apply a configuration change without dropping requests?**
`nginx -t && nginx -s reload` — which sends HUP. The master validates the new
config, starts new workers with it, and asks the old workers to shut down
gracefully; they stop accepting connections but finish what they are serving.

**★ Why does log rotation need `USR1`?**
Because a worker holds an open descriptor to the log file's inode, not its path.
Renaming the file leaves nginx writing to the same inode under the new name and
the fresh file empty. `USR1` (`nginx -s reopen`) makes nginx close and re-open the
logs by path.

**Which two signals have no `nginx -s` equivalent, and what are they for?**
`USR2` (upgrade the executable on the fly) and `WINCH` (gracefully shut down the
workers while the master keeps running). Both belong to the live binary-upgrade
sequence and are sent with `kill`.

**`WINCH` means different things depending on the target — how?**
To the master it means "gracefully shut down your worker processes". To a worker
it means abnormal termination for debugging, and only when `debug_points` is
enabled. Sending it to the wrong process gets you the wrong behaviour.

**On a systemd host, why prefer `systemctl reload nginx` over `nginx -s reload`?**
They do the same thing to nginx — the unit's `ExecReload` calls the binary — but
systemd tracks the process it started. Signalling nginx directly for stops and
starts leaves systemd's state out of sync with reality.

---

← Prev: [Sizing the workers](03-sizing-the-workers.md) · Index: [Phase 0](README.md) · Next → [Reload, restart and binary upgrade](05-reload-and-upgrade.md)
