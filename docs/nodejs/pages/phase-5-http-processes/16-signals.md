---
title: "Signals"
sidebar_label: "16 · Signals"
sidebar_position: 16
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS), Linux.

**A signal is the operating system asking your process to do something. Every
deploy, every scale-down and every `docker stop` starts with `SIGTERM`, and what
your process does in the seconds that follow is the difference between a clean
rollout and a burst of 502s.**

## Catching them

```js
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => shutdown(sig));
}
```

```console
$ node sig.mjs
    0 ms pid 28175 waiting for signals
  365 ms caught SIGTERM — not exiting, on purpose
  667 ms caught SIGINT — not exiting, on purpose
  970 ms caught SIGHUP — not exiting, on purpose
 1272 ms caught SIGUSR2 — not exiting, on purpose
```

**Installing a listener replaces the default behaviour entirely.** Without one,
SIGTERM kills the process; with one, nothing happens unless you make it happen.
That is the trap in a half-written shutdown handler — the process stops dying and
starts hanging, and the orchestrator SIGKILLs it 30 seconds later.

The handler runs as an ordinary event-loop callback, so `async` work in it is
fine. That is what makes graceful shutdown possible at all.

## The ones that matter

| Signal | Sent by | Default | Catchable |
|---|---|---|---|
| **`SIGTERM`** (15) | `docker stop`, Kubernetes, systemd, `kill` | Terminate | ✅ |
| **`SIGINT`** (2) | Ctrl-C in a terminal | Terminate | ✅ |
| `SIGHUP` (1) | Terminal closed; conventionally "reload config" | Terminate | ✅ |
| `SIGUSR1` (10) | — | **Reserved by Node** to start the debugger | ⚠️ avoid |
| `SIGUSR2` (12) | Application-defined; nodemon uses it to restart | Terminate | ✅ |
| `SIGQUIT` (3) | Ctrl-\\ | Terminate + core dump | ✅ |
| **`SIGKILL`** (9) | `kill -9`, the OOM killer, an expired grace period | Terminate | ❌ **never** |
| `SIGSTOP` (19) | — | Suspend | ❌ never |

```console
$ node nosig.mjs & kill -TERM $!   -> status=143    # 128 + 15
$ node nosig.mjs & kill -KILL $!   -> status=137    # 128 + 9
```

**SIGKILL cannot be caught, blocked or ignored.** No handler runs, no buffer is
flushed, no connection is closed. Everything on [page 17](17-graceful-shutdown.md)
exists to make sure you finish before something sends it.

## What actually happens during a deploy

Kubernetes, in order: removes the pod from the Service endpoints, calls the
`preStop` hook, sends **SIGTERM to PID 1**, waits `terminationGracePeriodSeconds`
(default **30**), then sends **SIGKILL**. `docker stop` is the same with a 10
second default.

Two structural problems live in that sequence.

**Endpoint removal is not synchronous.** Deregistration propagates to kube-proxy,
ingress controllers and client-side load balancers at their own pace, so requests
keep arriving *after* SIGTERM. A `preStop` hook that simply sleeps 5–10 seconds —
during which you still serve traffic normally — is the standard fix, and it is
configuration rather than code.

**Your process may not be PID 1, and may not receive the signal at all.**

```dockerfile
CMD npm start                      # ❌ shell form: sh is PID 1, npm is a child
CMD ["node", "server.js"]          # ✅ exec form: node is PID 1
```

The shell form starts `/bin/sh -c`, which does not forward signals to its
children. Node never sees SIGTERM, the grace period expires, and everything is
SIGKILLed. `npm start` has the same problem one level up — npm's signal forwarding
has historically been unreliable, which is why production images exec `node`
directly. If you genuinely need a wrapper, use an init that reaps and forwards
(`tini`, or `docker run --init`).

Locally the equivalent trap is `npm run dev`: Ctrl-C may kill npm and orphan the
Node process holding port 3000.

## Sending them

```bash
kill -TERM <pid>          # polite: what every orchestrator sends
kill -INT  <pid>          # same as Ctrl-C
kill -9    <pid>          # last resort; no cleanup happens
```

```js
process.kill(pid, 'SIGTERM');       // despite the name, sends any signal
process.kill(pid, 0);               // signal 0: existence/permission check only
child.kill('SIGTERM');              // to a child — page 19
```

## Reloading instead of exiting

Not every signal has to end the process. A common pattern uses `SIGHUP` to
re-read configuration in place:

```js
process.on('SIGHUP', async () => {
  try { config = await loadConfig(); log.info('config reloaded'); }
  catch (err) { log.error({ err }, 'reload failed, keeping previous config'); }
});
```

Keeping the old configuration on failure is the important half — a reload that
half-applies is worse than one that does not happen.

Avoid `SIGUSR1`: Node uses it to attach the inspector, so your handler competes
with the debugger.

## Gotchas

**Symptom:** The app ignores Ctrl-C and `docker stop` after adding a shutdown
handler
**Cause:** Registering a listener removes the default terminate behaviour, and the
handler never exits.
**Fix:** Always end the handler by exiting — with a forced-exit timer as a backstop.

**Symptom:** Containers always take the full grace period and exit 137
**Cause:** Signals are not reaching Node — shell-form `CMD`, or `npm start`.
**Fix:** Exec form with `node` as PID 1, or an init like `tini`.

**Symptom:** Requests fail during a rolling deploy despite graceful shutdown
**Cause:** Endpoint deregistration lags SIGTERM, so traffic still arrives.
**Fix:** A `preStop` sleep that keeps serving while the removal propagates.

**Symptom:** SIGKILL handler never fires
**Cause:** It cannot. SIGKILL is not deliverable to the process.
**Fix:** Finish shutting down within the grace period.

**Symptom:** The debugger attaches unexpectedly
**Cause:** A `SIGUSR1` handler colliding with Node's reserved use.
**Fix:** Use `SIGUSR2`.

**Symptom:** Ctrl-C in development leaves port 3000 in use
**Cause:** The signal killed the npm wrapper, not Node.
**Fix:** Run `node` directly, or kill the process group.

## Interview questions

**★ What happens on `docker stop` or a Kubernetes pod deletion?**
The pod is removed from the Service endpoints, the `preStop` hook runs, SIGTERM
goes to PID 1, and after the grace period (30 s by default in Kubernetes, 10 s for
`docker stop`) SIGKILL follows. Everything the app needs to do must fit before the
SIGKILL.

**★ Why can't you handle SIGKILL?**
The kernel does not deliver it to the process; it terminates it. That is the
point — it is the mechanism that guarantees a process can always be stopped. No
handler runs and nothing is flushed.

**★ Why does `CMD npm start` break graceful shutdown?**
The shell form makes `/bin/sh` PID 1, and it does not forward signals to children.
Node never receives SIGTERM, so the grace period expires and everything is
SIGKILLed — visible afterwards as exit code 137.

**★ What does installing a signal handler change?**
It replaces the default disposition. Before, SIGTERM terminated the process; after,
only your handler runs. A handler that forgets to exit converts a clean shutdown
into a hang that ends in SIGKILL.

**Why do requests still arrive after SIGTERM?**
Because removal from the load balancer is eventually consistent. The signal and
the deregistration are independent, so a short `preStop` delay during which the
app keeps serving is what closes the gap.

**What is `process.kill(pid, 0)` for?**
Checking whether a process exists and you may signal it — signal 0 performs the
permission and existence check without delivering anything.

---

← Prev: [The process object](15-process.md) · Next → [Graceful shutdown](17-graceful-shutdown.md)
