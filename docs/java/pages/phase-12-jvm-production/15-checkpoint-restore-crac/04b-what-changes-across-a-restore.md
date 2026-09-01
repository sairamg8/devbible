---
title: "The restored process believes it is still Tuesday: time jumped, the token expired, DNS moved, the hostname is someone else's, and the only reason any of this is survivable is that CRaC gives you a hook to notice"
sidebar_label: "04b · What changes across a restore"
sidebar_position: 6
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the **Spring Framework 7.0** reference, "JVM Checkpoint Restore"
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/integration/checkpoint-restore.html)) —
> the source of the `@Scheduled(fixedRate)` warning quoted below — the CRaC project's
> [step-by-step guide](https://github.com/CRaC/docs/blob/master/STEP-BY-STEP.md) and
> [best practices guide](https://github.com/CRaC/docs/blob/master/best-practices.md), and the
> project [README](https://github.com/CRaC/docs/blob/master/README.md).
> 🔴 **No sandbox** — nothing on this page was executed.

**[04](04-what-must-be-released.md) was about handles the JVM holds. This page is about facts
the application *believes*. Those are not checked by anything, they do not abort the
checkpoint, and they are where the subtle production bugs live.**

The step-by-step guide names the category in its first paragraph:

> *"A program can be restored in a different environment compared to the one where it was
> checkpointed. Dependencies on the environment need to be detected and a coordination code
> need to be created to update the dependencies after restore. Such dependencies are open
> handles for operating system resources like files and sockets, cached hostname and
> environment, registration in remote services, ..."*

## Time is the big one

The wall clock advances while the process does not exist. On restore, everything derived from
a timestamp taken before the checkpoint is stale by an unknown interval — seconds in a test,
weeks in a container image shipped through a release process.

**Scheduled work.** Spring Framework documents the concrete consequence:

> *"Be aware that when defining scheduling tasks at a fixed rate, for example with an
> annotation like `@Scheduled(fixedRate = 5000)`, all missed executions between checkpoint and
> restore will be performed when the JVM is restored with on-demand checkpoint/restore. If this
> is not the behavior you want, it is recommended to schedule tasks at a fixed delay (for
> example with `@Scheduled(fixedDelay = 5000)`) or with a cron expression as those are
> calculated after every task execution."*

🔴 **A five-second fixed-rate task and an image an hour old is 720 executions in a burst at
restore.** The CRaC best-practices guide makes the same point for
`ScheduledExecutorService.scheduleAtFixedRate`: the task *"would try to keep up after restore
and perform all the missed invocations"*, and *"Handling that should be a part of the
`beforeCheckpoint` procedure, cancelling the task and rescheduling it again in
`afterRestore`."*

**Everything else time-derived**, none of which is checked for you:

- Cached credentials and tokens: an OAuth2 access token, a signed URL, a database auth token —
  all captured with their expiry and all possibly expired on restore (phase 13 owns token
  lifetimes).
- TLS session tickets and certificates: a certificate valid at checkpoint may be near expiry at
  restore.
- Rate limiters and circuit breakers holding "last failure at" timestamps: a breaker may
  restore in the open state having "just" failed an hour ago.
- Caches with time-based eviction: they restore full of entries whose age is a lie.
- Metrics and uptime counters: a restored instance reports an uptime that includes time it did
  not exist, and monotonic counters resume mid-count on every instance.

⚠️ **The metrics case matters operationally**: a fleet of instances restored from one image all
start with identical counter values, which makes rate computations and instance identity
confusing until they diverge (topic 08 owns metric semantics).

## Identity moves

The restored process may run on another machine, in another pod, with another address. Anything
resolved once at startup is now wrong:

- **Hostname, IP, pod name, container ID** captured into a field, a log pattern, or a metrics
  tag.
- **DNS resolution results**, including anything the JVM's own DNS caching held.
- **Service registration**: an entry in a registry pointing at the checkpointing machine.
  The step-by-step guide lists *"registration in remote services"* explicitly.
- **Node-local configuration**: an availability zone, a rack label, a locally-mounted secret.

🔴 **This is `afterRestore`'s real job.** The coordination the project talks about — *"it is
possible to react on changes in execution environment that happened since checkpoint was
done"* — is exactly re-resolving these.

## Randomness and identifiers

Anything generated once and cached is now shared by every restored instance. Seeded PRNG state
is part of the heap: two instances restored from one image produce **the same sequence** unless
the generator is reseeded.

⚠️ **The danger scales with what you built on it**: a cached UUID used as an instance
identifier, a nonce pool, a shuffled sharding order, a jitter schedule that no longer jitters
because every instance jitters identically. Reseed from a fresh entropy source in
`afterRestore`, and treat any secret material generated before the checkpoint as compromised —
[04c](04c-secrets-and-the-snapshot.md) has the security argument in full.

## Configuration and environment

Environment variables and system properties are read at startup, captured into the heap, and
frozen into the image. A restored process runs with the *checkpointing* environment's values
even when the restoring container was given different ones. 🔴 **That inverts the usual
twelve-factor assumption** — configuration by environment stops working the moment the process
is a snapshot, which is why the checkpoint should be taken with production-shaped, non-secret
configuration and anything instance-specific re-read in `afterRestore`.

## Gotchas

🔴 **`fixedRate` scheduling floods on restore; `fixedDelay` and cron do not.** Spring's
reference states this outright and it applies to any fixed-rate scheduling primitive.

🔴 **Two instances restored from one image share their PRNG state.** Reseed anything security-
or distribution-sensitive in `afterRestore`.

⚠️ **Tokens and leases expire in the gap.** Anything with a TTL must be revalidated on restore,
not assumed.

⚠️ **Cached hostname, IP or pod identity is wrong on every instance but the first.** Re-resolve
it rather than reading a field.

⚠️ **Environment variables read at boot are baked into the image.** Instance-specific
configuration must be re-read after restore, not injected by the platform and hoped for.

⚠️ **Circuit breakers and rate limiters restore with stale internal clocks**, so a service may
come up already tripped, or with a full token bucket it should not have.

⚠️ **Uptime, and any monotonic counter, is nonsense immediately after a restore.** Dashboards
that assume monotonic per-instance counters need to tolerate it.

⚠️ **Anything registered externally at startup — service discovery, a lock, a lease — points at
the checkpointing machine.** Deregister in `beforeCheckpoint`, re-register in `afterRestore`.

## Interview questions

**★ Why does `@Scheduled(fixedRate = 5000)` misbehave after a restore?**
Because fixed-rate schedules are computed against absolute times, so every execution missed
between checkpoint and restore fires at once. Spring's reference recommends `fixedDelay` or a
cron expression, which are calculated after each execution.

**★ Name four categories of state that are stale after a restore.**
Time-derived state (schedules, tokens, TTLs, breaker timestamps), identity (hostname, IP, pod,
DNS, service registration), randomness (seeded generators and anything cached from them), and
configuration read from the environment at startup.

**★ Why is a seeded PRNG a correctness problem rather than a curiosity?**
Because the generator's state is in the heap, so every instance restored from one image
produces an identical sequence. Anything built on it — identifiers, nonces, jitter, shard
selection — is duplicated across the fleet.

**★ How does CRaC help you cope with a changed environment?**
Through coordination: `afterRestore` is the documented place to re-resolve names, re-register
with remote services, reseed generators and revalidate credentials. The project frames it as
being able to *"react on changes in execution environment that happened since checkpoint was
done"*.

**★ What happens to environment-variable configuration under checkpoint/restore?**
It is captured into the image at checkpoint time. A restored process runs with the values it
saw then, regardless of what the restoring environment provides — so instance-specific settings
must be re-read explicitly after restore.

**★ Your restored service comes up with its circuit breaker open. Why?**
Because the breaker's internal timestamps were captured in the image. It believes a failure it
recorded before the checkpoint happened moments ago, so its cool-down has not elapsed from its
point of view.

**★ How should a fixed-rate background task be made checkpoint-safe?**
Cancel it in `beforeCheckpoint` and reschedule it in `afterRestore` — the best-practices guide
prescribes exactly that — or use a fixed-delay or cron schedule so the next execution is
computed after the previous one completes.

Next: [Secrets and the snapshot](04c-secrets-and-the-snapshot.md).

{/* FOOTER */}
