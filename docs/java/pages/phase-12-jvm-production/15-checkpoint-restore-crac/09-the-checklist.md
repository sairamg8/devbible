---
title: "Deciding, then the readiness list before you try: the questions that must have answers before a checkpoint is worth attempting, and the ones that must have answers before a restored image is allowed near production"
sidebar_label: "09 · The checklist"
sidebar_position: 13
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 — this page consolidates the sources cited across the topic: the **CRaC
> project documentation** ([README](https://github.com/CRaC/docs/blob/master/README.md),
> [step-by-step](https://github.com/CRaC/docs/blob/master/STEP-BY-STEP.md),
> [best practices](https://github.com/CRaC/docs/blob/master/best-practices.md)), the **Spring
> Framework 7.0** and **Spring Boot 4.1** checkpoint/restore references.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8. 🔴 **No sandbox.**

**Two lists. The first decides whether to try. The second decides whether what you produced is
allowed to run.**

## List 1 · Should we do this at all?

- [ ] **Is the cost warm-up or initialisation?** Measure latency across the first minute of an
      instance's life ([01](01-the-cold-start-problem.md)). If it is initialisation, use the AOT
      cache (topic 10) and stop here.
- [ ] **Have we run `-Dspring.context.exit=onRefresh`** and fixed whatever the context does at
      refresh ([05b](05b-the-two-modes.md))?
- [ ] **Have we removed the obvious eager work** — pools, scans, migrations, clients nothing
      needs yet?
- [ ] **Are cold instances frequent and consequential** — scale-to-zero, aggressive autoscaling,
      or a deploy cadence that keeps the fleet partly cold?
- [ ] **Do we need a full JVM**, ruling out native image ([07](07-crac-vs-native-image-vs-aot-cache.md))?
- [ ] 🔴 **Will the platform grant CRIU its privileges?** Ask before writing code
      ([06](06-operating-it.md)).
- [ ] 🔴 **Will security accept an artefact containing the entire heap**, and is there a home for
      it and a rebuild cadence ([04c](04c-secrets-and-the-snapshot.md))?
- [ ] **Is the fleet Linux, with compatible CPU features** or a plan to pin them?
- [ ] **Can we run a canary step in the pipeline** against real-shaped dependencies?

## List 2 · Readiness before the first checkpoint

**Runtime**

- [ ] A CRaC-enabled JDK in the base image, and a vendor whose release cadence we accept.
- [ ] `org.crac:crac` **1.4.0 or above** on the classpath — the compatibility library, not
      `jdk.crac` ([05](05-spring-boot-support.md)).
- [ ] `-XX:CRaCCheckpointTo=PATH` for the checkpointing run; the parent directories exist.
- [ ] CRIU permissions verified on **both** the checkpointing and the restoring host.

**Code**

- [ ] Every `Resource` implementation stored in a **field**, not registered anonymously —
      the registry holds weak references ([03](03-the-resource-lifecycle.md)).
- [ ] Servers, listener containers, pools and schedulers stop in `beforeCheckpoint` and start in
      `afterRestore` — via Spring `Lifecycle` where possible.
- [ ] No `beforeCheckpoint` that ends the last non-daemon thread.
- [ ] Thread quiescing has a strategy — `ReadWriteLock`, `Phaser` or event-loop scheduling — and
      cannot block a checkpoint forever ([04](04-what-must-be-released.md)).
- [ ] Fixed-rate schedules cancelled in `beforeCheckpoint` and rescheduled in `afterRestore`, or
      converted to fixed-delay/cron ([04b](04b-what-changes-across-a-restore.md)).
- [ ] Hostname, IP, pod identity, DNS and service registration re-resolved in `afterRestore`.
- [ ] Secure random generators reseeded; cached identifiers regenerated.
- [ ] Credentials and tokens fetched or revalidated in `afterRestore`, ideally never present at
      checkpoint time.
- [ ] Circuit breakers, rate limiters and time-based caches reset or revalidated.

**Pipeline**

- [ ] Image and application versioned, promoted and rolled back as **one artefact**.
- [ ] The checkpoint's real outcome read from the **application console**, not `jcmd`'s output.
- [ ] The pipeline expects the process to be **killed** after checkpointing.
- [ ] 🔴 **A restore is verified in the pipeline**, on the target CPU family and privileges.
- [ ] `-XX:CPUFeatures` pinned for the fleet's lowest common denominator.
- [ ] Images rebuilt on a schedule, not only on code change.
- [ ] End-to-end timing measured: pull, restore, `afterRestore`, first request.

**Operations**

- [ ] Image storage encrypted, access-controlled and audited.
- [ ] Dashboards tolerate restored instances — uptime, monotonic counters and instance identity
      are unreliable immediately after restore.
- [ ] Readiness probes account for `afterRestore` work, not just process liveness (topic 12).
- [ ] A non-CRaC start path still works and is tested.

## The five sentences to take away

1. CRaC is CRIU plus coordination: the application is told to release resources before the
   image is taken and to reacquire them after restore, and the checkpoint aborts rather than
   producing an image it cannot honour.
2. It is the only technique in this phase that restores a **warm** JVM — profiles, compiled code
   and heap — and the restored process is still a full HotSpot JVM that keeps optimising.
3. The cheap Spring mode (`spring.context.checkpoint=onRefresh`) explicitly does **not** give a
   warm JVM; the warm one requires checkpointing a process that has served real traffic.
4. The image is your heap, so it contains every secret the JVM saw — treat it as a credential
   with an expiry date.
5. Almost every service that considers CRaC should first find out why it starts slowly, and
   most of those will stop there.

## Gotchas

🔴 **The checkpoint succeeding is not the finish line.** Restore is a separate, environmental
failure mode — verify it before promoting an image.

🔴 **A `Resource` registered anonymously is collected and never called.** It is the one API
mistake that produces no error at all.

⚠️ **`jcmd` always reports success.** Read the application's console.

⚠️ **Images expire even when code does not**, because of the credentials and leases inside them.

⚠️ **Restored fleets act in lockstep** — same PRNG state, same cached identity, simultaneous
reconnects. Add jitter deliberately, because the natural jitter is gone.

⚠️ **The `afterRestore` path is production code that runs once per instance and is easy to leave
untested.** Test it by actually restoring, not by unit-testing the method.

⚠️ **Everything in this topic is Linux-only.** A design that depends on it excludes developer
machines and any non-Linux target.

## Interview questions

**★ What are the two questions to settle before writing any CRaC code?**
Whether the platform will grant CRIU its privileges, and whether security accepts an artefact
containing the whole heap. Both are decided outside the application team and both end
evaluations.

**★ Give the readiness checks a reviewer should demand before a CRaC image reaches production.**
A verified restore on the target CPU family and privileges, pinned `-XX:CPUFeatures`, image and
jar versioned as one artefact, encrypted and access-controlled image storage, a rebuild
schedule, `afterRestore` handling for time/identity/randomness/credentials, and a working
non-CRaC start path.

**★ What is the most easily missed API rule?**
Holding the `Resource` in a field. The global context uses weak references and has no
`unregister`, so an anonymous instance passed straight to `register` is collected and never
notified — with no error.

**★ Why must restore be verified separately from checkpoint?**
Because restore failures are environmental — CPU features, privileges, kernel — and a
successful checkpoint tells you nothing about them. The failure otherwise lands on a production
instance.

**★ What operational surprises do restored fleets create?**
Lockstep behaviour: identical PRNG state, identical cached identity, and simultaneous
`afterRestore` reconnects that hit downstream services together. Uptime and monotonic counters
also become meaningless per instance.

**★ Summarise CRaC's value and its price in one sentence each.**
Value: it restores a warmed-up JVM — profiles, compiled code and heap — so peak performance is
available immediately. Price: Linux-only, a vendor JDK, CRIU privileges, a canary step in the
pipeline, and an artefact containing every secret the process ever saw.

That is the end of topic 15, and of phase 12's fast-start trio: the AOT cache in topic 10,
native image in topic 11, and checkpoint/restore here.

{/* FOOTER */}
