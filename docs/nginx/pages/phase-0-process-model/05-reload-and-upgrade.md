---
title: "Reload, restart and binary upgrade"
sidebar_label: "05 · Reload and upgrade"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against [Controlling nginx](https://nginx.org/en/docs/control.html)
> — the "Changing Configuration" and "Upgrading Executable on the Fly" procedures — and
> [ngx_core_module](https://nginx.org/en/docs/ngx_core_module.html) (`worker_shutdown_timeout`,
> appeared in 1.11.11).
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**A reload drops zero requests. A restart drops all of them. Knowing exactly why
is the difference between a deploy and an outage, and it is the reason nginx sits
in front of Node in the first place.**

## What a reload actually does

You send HUP (`nginx -s reload`). The documented sequence is:

1. The master **checks the syntax** of the configuration file.
2. The master **attempts to apply** it — opening log files and new listen
   sockets.
3. **If that fails**, it rolls back and carries on with the old configuration.
   Nothing changes; nothing is dropped.
4. **If it succeeds**, the master **starts new worker processes** with the new
   configuration, and sends the old workers a request to shut down gracefully.
5. Old workers **close their listen sockets** — they accept nothing new — but
   **keep serving the clients they already have**.
6. When those clients are done, the old workers exit.

Read step 3 again, because it is the reassuring one: **a broken config cannot
take your site down via a reload.** The master validates before it commits. What
a broken config *can* do is silently leave your old configuration running while
you believe the new one is live — which is why the error log, and page 06's
`nginx -t`, matter.

Read step 5 too, because it is the load-bearing one: **the old workers still
hold their clients' connections.** No one is disconnected. Requests in flight
complete against the old configuration; requests that arrive after the reload are
accepted by the new workers and served by the new configuration.

## Reload vs restart, plainly

| | Reload (`HUP`) | Restart (`stop` then `start`) |
|---|---|---|
| Listening sockets | stay open the whole time | closed, then re-opened |
| In-flight requests | finish normally | **cut** |
| Idle keep-alive connections | drained gracefully | **reset** |
| A window with nothing listening | **none** | yes, brief but real |
| Invalid config | rolled back, old config keeps running | **nginx fails to start — the site is down** |

The last row is the one that bites during an incident. A restart with a broken
config leaves you with no nginx at all; a reload with the same broken config
leaves you exactly where you were.

**Restart only when a reload genuinely cannot do the job.**

## What a reload cannot change

Almost everything is reloadable. The exceptions are the things the *master*
established at startup, before any worker existed:

| Change | Reload enough? |
|---|---|
| `server` / `location` blocks, `proxy_pass`, headers, TLS certificates, caching, limits | **yes** |
| `worker_processes`, `worker_connections` | **yes** — new workers get the new values |
| A new `listen` port | **yes** — the master opens it while old workers keep the old ones |
| `user` | **yes**, for new workers |
| **`load_module`** (adding a dynamic module) | **no — full restart** |
| Changing the nginx **binary** | no — but see the live upgrade below |
| Some build-time and `main`-context settings | no |

`load_module` is the one that catches people: adding Brotli or the ACME module to
a running server needs a restart, not a reload.

**Renewed TLS certificates only need a reload**, which is why every ACME client's
deploy hook ends in `systemctl reload nginx` rather than a restart (Phase 5).

## The lingering-worker problem

Step 5 has a consequence: an old worker lives until its last client is finished.
For ordinary HTTP that is milliseconds. For a **WebSocket or an SSE stream it can
be hours**, and reloading four times a day leaves you with old workers stacked up,
each holding its own memory and its own copy of the retired configuration.

```nginx
# Cap how long old workers may linger after a reload.
worker_shutdown_timeout 30s;     # since 1.11.11; no default — unlimited
```

When the timeout expires nginx tries to close the still-open connections. That is
a real trade, not a free win: you are choosing to disconnect long-lived clients
rather than accumulate workers. For an app with WebSockets, a value in the tens of
seconds plus a client that reconnects cleanly is the usual answer.

Old workers still visible in `ps` after a reload are **correct behaviour**, not a
leak. Only worry when their count grows without bound.

## Upgrading the binary without dropping traffic

nginx can replace its own executable under live traffic. You will rarely do this
by hand — packages and containers make it unnecessary — but it is the mechanism
behind "nginx never goes down", and it is a fair interview question.

The documented sequence:

```bash
# 1. Put the new executable in place of the old one.

# 2. USR2: master renames its PID file to nginx.pid.oldbin, starts the new
#    executable, which starts its own workers. Old and new both accept requests.
kill -USR2 "$(cat /run/nginx.pid)"

# 3. WINCH to the OLD master: its workers finish current clients and exit.
#    The old master stays alive, doing nothing — this is the rollback point.
kill -WINCH "$(cat /run/nginx.pid.oldbin)"

# 4a. Happy path — QUIT the old master. Only the new processes remain.
kill -QUIT "$(cat /run/nginx.pid.oldbin)"
```

If the new binary is bad, you roll back instead:

```bash
# 4b. Rollback: HUP the OLD master — it starts workers again with the old
#     executable, without re-reading the configuration.
kill -HUP "$(cat /run/nginx.pid.oldbin)"

#     Then retire the new master.
kill -QUIT "$(cat /run/nginx.pid)"   # graceful; TERM for fast
```

When the new master exits, the old master discards the `.oldbin` suffix
automatically and life continues as though nothing happened.

**The property worth taking away:** between steps 2 and 4 there are two complete
nginx installations accepting connections on the same sockets, and you can
choose which one survives *after* seeing the new one handle real traffic. Very
little software offers that.

## The habit

Every configuration change, every time:

```bash
nginx -t && nginx -s reload        # or: nginx -t && systemctl reload nginx
```

The `&&` is the entire point. `nginx -t` parses the configuration and reports
errors without touching the running server; the reload happens only if it passed.
Without it, a typo means the reload silently rolls back and you deploy nothing —
the worst outcome, because it looks like success. Page 06 covers `-t` and its
siblings properly.

## Gotchas

**Symptom:** You changed the config, reloaded, and the old behaviour persists.
**Cause:** Usually one of three: the config failed validation and the master
rolled back; the file you edited is not included by `nginx.conf`; or another
`server` block is winning the match (Phase 2).
**Fix:** `nginx -t` to check the first, `nginx -T` to check the second — it dumps
the *fully resolved* configuration, so if your change is not in that output, nginx
is not reading your file.

**Symptom:** Old worker processes remain for hours after a reload, and their
number grows with each deploy.
**Cause:** Long-lived connections — WebSockets, SSE, long-polling — holding the
old workers open, exactly as designed.
**Fix:** Set `worker_shutdown_timeout`, and accept that it will disconnect those
clients. Make sure the client reconnects gracefully; this is a design decision,
not a tuning knob.

**Symptom:** You added a dynamic module with `load_module` and reloaded, and nginx
says the directives from it are unknown.
**Cause:** `load_module` is not applied by a reload.
**Fix:** A full restart. Plan for the brief outage, or do it behind a load
balancer.

**Symptom:** After `nginx -s stop`, nginx will not start:
`bind() to 0.0.0.0:80 failed (98: Address already in use)`.
**Cause:** Something still holds the socket — an old master from a half-finished
binary upgrade, a stale process, or another web server entirely.
**Fix:** Find the holder (`ss -lptn 'sport = :80'`) before starting anything.
Starting a second nginx never resolves this.

**Symptom:** A reload during a deploy caused a burst of 502s.
**Cause:** Not the reload — nginx handled it fine. The backend restarted at the
same time, and nginx faithfully reported that it could not reach it.
**Fix:** Look at the error log for the upstream message. Reloads do not produce
502s; unreachable upstreams do (Phase 4).

## Trade-off

**Graceful is not free.** A reload keeps old workers alive for as long as their
clients need, which means memory held, two configurations live at once, and a
window where a request could be served by either. For a config change that fixes
a security problem, "the old configuration is still serving some clients" is
exactly what you did not want.

`worker_shutdown_timeout` is the dial between the two, and there is no correct
setting — only the one that matches how long your longest legitimate connection
should be allowed to outlive a deploy.

## Interview questions

**★ What happens when you run `nginx -s reload`?**
The master gets HUP. It validates the new configuration and tries to apply it —
opening log files and new listen sockets. On failure it rolls back and keeps
running the old configuration. On success it starts new workers with the new
config and asks the old workers to shut down gracefully: they close their listen
sockets, finish the clients they already have, and exit. No connection is
dropped.

**★ Why is a reload safer than a restart?**
Three reasons. The listening sockets never close, so there is no window with
nothing listening. In-flight requests finish instead of being cut. And an invalid
configuration is rolled back rather than fatal — a restart with a broken config
leaves you with no nginx at all.

**★ What kind of change requires a full restart rather than a reload?**
Adding a dynamic module with `load_module`, and changing the nginx binary itself
(though that has its own live-upgrade procedure). Everything in the ordinary
`http`/`server`/`location` surface — including renewed TLS certificates — is
reloadable.

**★ Why are old nginx workers still running minutes after a reload?**
Because they are still serving connections that were open when the reload
happened. Old workers stop accepting new connections but do not abandon existing
clients, and a WebSocket or SSE stream can keep one alive indefinitely.
`worker_shutdown_timeout` bounds it, at the cost of disconnecting those clients.

**How do you upgrade the nginx binary without dropping traffic?**
Replace the executable, send USR2 to the master — it renames its PID file to
`.oldbin` and starts a new master and workers, with both generations accepting
requests. Send WINCH to the old master to retire its workers, then QUIT to retire
the old master itself. If the new binary misbehaves, HUP the old master to bring
its workers back and QUIT the new one instead.

**Why should a reload always be `nginx -t && nginx -s reload`?**
Because a reload with an invalid configuration silently rolls back. Nothing
breaks, but nothing changes either, and the failure appears only in the error
log — so a deploy that did nothing looks exactly like a deploy that worked.

**A deploy reloaded nginx and users saw 502s. Was the reload responsible?**
Almost certainly not — reloads do not drop requests. A 502 means nginx could not
reach the backend, so the backend was restarting at the same moment. The evidence
is in the error log's upstream message, not in nginx's own lifecycle.

---

← Prev: [Signals and `nginx -s`](04-signals-and-control.md) · Index: [Phase 0](README.md) · Next → [`nginx -t`, `-T` and `-V`](06-testing-the-config.md)
