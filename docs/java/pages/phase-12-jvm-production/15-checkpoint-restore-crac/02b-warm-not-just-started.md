---
title: "The differentiator is one word in the documentation — the restored JVM is warmed-up, which means the profile, the compiled code and the heap all survive, and no other fast-start technique in this phase can say that"
sidebar_label: "02b · Warm, not just started"
sidebar_position: 3
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the **CRaC project documentation**
> ([github.com/CRaC/docs](https://github.com/CRaC/docs/blob/master/README.md)), the **Spring
> Boot 4.1** and **Spring Framework 7.0** checkpoint/restore references
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/integration/checkpoint-restore.html)),
> and the **HotSpot compilation policy** header at `jdk-25+36` for what "warm" consists of.
> 🔴 **No sandbox** — no restore was performed and no timing on this page is a measurement.
> The CRaC project publishes comparison charts; this page quotes its claims, not chart values.

**Every fast-start technique in this phase removes initialisation. Exactly one of them also
removes warm-up, and that is the sentence on which the whole topic turns.**

## The claim

> *"The restore in general is faster than initialization. After the restore, Java runtime
> performance is also on-par with the one at the checkpoint. So, after proper warm-up before
> the checkpoint, restored Java instance is able to deliver the best runtime characteristics
> immediately."*

Spring Boot says the same from the JVM's side:

> *"A memory representation of the running JVM, including its warmness, is then serialized to
> disk"* … *"The restored process retains all the capabilities of the HotSpot JVM, including
> further JIT optimizations at runtime."*

🔴 **Read that last clause carefully — it is the answer to the obvious objection about native
image.** A restored process is still a full HotSpot JVM. It can keep profiling, keep
compiling, and keep deoptimising and recompiling as the workload changes. It has not traded
peak performance for start-up performance; it has moved the warm-up somewhere else.

## What "warm" actually consists of

From [topic 14](../14-benchmarking-with-jmh/02-why-the-jvm-defeats-naive-timing.md), a warm
JVM is several distinct things at once, and the snapshot preserves all of them because it
preserves memory:

| Warmth | Survives a restore because… |
|---|---|
| Loaded and linked classes | They are objects and metadata in the image |
| Method profiles (MDOs) | They are JVM data structures in the image |
| C2-compiled code in the code cache | The code cache is memory |
| Inline caches and speculative assumptions | Ditto — including the branch and type profiles they rest on |
| A populated application heap: caches, pools, parsed configuration | It is the heap |
| Sized and grown data structures | Same |

⚠️ **The last two rows are frequently overlooked and are often the biggest win.** An
application cache primed with a thousand entries, a fully parsed configuration tree, an
initialised template engine — all present at the first request after restore.

## What is *not* warm after a restore

Being honest about this is what separates a useful adoption from a disappointing one:

- **The OS page cache and the CPU caches** on the restoring machine are cold. Memory is faulted
  back in as it is touched.
- **Everything outside the process**: the database's plan cache, the remote service's
  connection pool, the proxy's DNS cache.
- **Connections**, which had to be closed for the checkpoint to be taken at all
  ([04](04-what-must-be-released.md)) and must be reopened in `afterRestore`. Reopening a pool
  is real work on the restore path.
- **Anything the application deliberately reset** in `beforeCheckpoint`.

🔴 **So the honest description is "warm JVM, cold surroundings".** The JIT problem is solved;
the first request still pays for a TCP handshake, a TLS negotiation and a database round trip.

## How it compares, in one paragraph each

**Versus CDS and the AOT cache** (topic 10): those share class metadata — and, with the AOT
cache, loaded, linked and profiled classes — across runs, which cuts initialisation
substantially. They do not carry your heap, your pools or your C2 code. They are also far
cheaper to operate: no CRIU, no privileges, no Linux-only constraint, no image containing your
data.

**Versus GraalVM native image** (topic 11): native image removes the JVM's start-up cost
almost entirely and produces a small self-contained binary, at the price of the closed-world
assumption, reachability metadata for reflection, and no JIT — peak throughput is whatever the
ahead-of-time compiler achieved. CRaC keeps the JVM and everything dynamic about it.

**Versus "just fix the startup"**: no contest as a first step, and it composes with everything
else. See [08 · When to reach for it](08-when-to-reach-for-it.md), and the full table in
[07](07-crac-vs-native-image-vs-aot-cache.md).

## The catch, stated once here and expanded later

The two Spring modes are not equivalent on this axis. The automatic on-refresh checkpoint is
documented as a way to *"fast-forward"* startup — and the reference is explicit that it
*"does not allow to have a fully warmed-up JVM"*. Only a checkpoint taken from a genuinely
warmed process delivers the headline claim, and that requires driving real traffic at the
application before checkpointing it:

> *"If the checkpoint is created on a warmed-up JVM, the restored JVM will be equally
> warmed-up, allowing potentially peak performance immediately. This method typically requires
> access to remote services, and thus requires some level of platform integration."*

🔴 **"Requires access to remote services" is the operational cost of the good mode.** The
warm-up traffic has to be real enough to exercise the code paths that matter, which means the
checkpointing environment needs a database, a broker and whatever else the hot path touches.
See [05b · The two modes](05b-the-two-modes.md) and [06 · Operating it](06-operating-it.md).

## Gotchas

🔴 **The on-refresh mode does not deliver a warm JVM** by its own documentation. If the reason
you adopted CRaC was warm-up, the automatic mode is not the mode you want.

🔴 **Warm-up quality is a property of the traffic you replayed.** A checkpoint taken after
hitting one endpoint is warm for that endpoint and cold for everything else — and the JIT may
have speculated on a profile that production traffic will invalidate.

⚠️ **A restored JVM can still deoptimise.** Keeping the JIT means keeping speculative
optimisation; if post-restore traffic differs from the warm-up traffic, assumptions break and
code is recompiled. This is normal, not a defect.

⚠️ **The heap you captured is the heap you get, including its garbage.** A checkpoint taken
just before a major collection carries that state into every restored instance.

⚠️ **A warm JVM does not fix a cold cluster.** If every instance restores at once during a
scale-out, the databases and downstream services see a simultaneous connection storm from
`afterRestore` handlers.

⚠️ **Memory is faulted in lazily on restore.** The process is warm logically, but its pages
arrive from disk as they are touched, so the very first moments still have I/O cost.

## Interview questions

**★ What does CRaC provide that CDS, the AOT cache and native image do not?**
A warmed-up JVM: profiles, C2-compiled code and a populated heap restored as they were at the
checkpoint. The others reduce initialisation (or eliminate the JVM), but none carries the
JIT's accumulated state or your application's in-memory data.

**★ Does a restored process still benefit from the JIT?**
Yes — Spring Boot's reference says the restored process *"retains all the capabilities of the
HotSpot JVM, including further JIT optimizations at runtime"*. That is the main
differentiator from native image, which has no JIT at all.

**★ What is *not* warm after a restore?**
Everything outside the process — connections that had to be closed for the checkpoint,
downstream caches and pools, DNS — plus the OS page cache and CPU caches on the restoring
machine. Warm JVM, cold surroundings.

**★ Which Spring mode gives the warm-up benefit, and which does not?**
An on-demand checkpoint of a warmed, traffic-served process does. The automatic on-refresh
checkpoint explicitly *"does not allow to have a fully warmed-up JVM"* — it fast-forwards
initialisation only.

**★ Why does taking a good checkpoint require platform integration?**
Because warming the JVM means serving representative traffic first, which needs access to the
remote services the hot path touches. The documentation flags this as a requirement of the
on-demand method.

**★ Can a restored JVM's performance degrade after restore?**
Yes. It keeps speculative, profile-guided optimisation, so traffic that differs from the
warm-up profile can invalidate assumptions and force deoptimisation and recompilation — the
normal JVM behaviour, restored along with everything else.

Next: [The resource lifecycle](03-the-resource-lifecycle.md).

{/* FOOTER */}
