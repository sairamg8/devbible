# Topic 12 · Graceful shutdown — chunk plan

Tier: **Understand**. 🔴 Read `../_PHASE-NOTES.md` first — it is binding.

## Boundary
Owns **stopping without dropping work**: signals, the grace period, draining, and the
probe interplay. 🔴 **10 owns starting**; **Phase 16** owns retries and circuit breakers —
this topic owns the shutdown side of the contract that makes retries unnecessary.

## Chunks (a PLAN, not a budget)
| # | File | What it argues |
|---|---|---|
| 1 | `01-the-deploy-that-dropped-requests.md` | 503s during a rolling update that nobody attributed to shutdown |
| 2 | `02-signals.md` | SIGTERM vs SIGKILL; PID 1 in a container; `exec` in an entrypoint script |
| 2b | `02b-the-shell-that-swallowed-sigterm.md` | 🔴 The `sh -c` entrypoint that never forwards the signal |
| 3 | `03-shutdown-hooks.md` | `Runtime.addShutdownHook`, ordering, no guarantees, `Runtime.halt` |
| 4 | `04-spring-graceful-shutdown.md` | `server.shutdown=graceful`, `spring.lifecycle.timeout-per-shutdown-phase` |
| 4b | `04b-what-graceful-actually-drains.md` | In-flight requests yes; long polls, SSE and WebSockets are a decision |
| 5 | `05-the-order-of-teardown.md` | Stop accepting → finish in-flight → stop schedulers → close pools → close clients |
| 5b | `05b-smartlifecycle-and-phases.md` | Controlling that order for your own beans |
| 6 | `06-executors-and-schedulers.md` | `shutdown` vs `shutdownNow`, `awaitTermination`, the task that was mid-flight |
| 6b | `06b-message-consumers.md` | Acknowledgement, in-flight messages, and redelivery. Links to Phase 15 |
| 7 | `07-connection-pools.md` | Closing Hikari, and the query that was still running |
| 8 | `08-readiness-and-the-load-balancer.md` | 🔴 The propagation delay: you must fail readiness *before* you stop accepting |
| 8b | `08b-preStop-and-terminationGracePeriodSeconds.md` | The Kubernetes side of the same handshake |
| 9 | `09-idempotency-as-the-backstop.md` | Graceful shutdown reduces the problem; it does not remove it |
| 10 | `10-the-checklist.md` | A zero-drop rolling deploy, step by step |

## Verify, do not assume
- ⚠️ 🔴 Boot **4.1**'s exact property names and defaults for graceful shutdown and the
  lifecycle timeout — quote the production-ready reference.
- ⚠️ Which embedded servers support graceful shutdown in 4.1 (Tomcat/Jetty/Undertow/Netty).
- ⚠️ Whether Boot registers a shutdown hook by default and how to disable it.
- ⚠️ Default `terminationGracePeriodSeconds` — state it as Kubernetes' default, sourced.
