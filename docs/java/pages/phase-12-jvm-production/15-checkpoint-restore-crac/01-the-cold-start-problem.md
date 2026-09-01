---
title: "Java's startup problem is not that the JVM is slow to launch, it is that a JVM which has just launched is running the worst version of your code — and autoscaling asks it to serve real traffic in exactly that state"
sidebar_label: "01 · The cold-start problem"
sidebar_position: 1
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the **CRaC project documentation**
> ([github.com/CRaC/docs](https://github.com/CRaC/docs/blob/master/README.md)) and the
> **Spring Framework 7.0 reference**, "JVM Checkpoint Restore"
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/integration/checkpoint-restore.html)).
> JVM behaviour cross-checked against the **HotSpot compilation policy** header at tag
> `jdk-25+36`. Version spine: JDK 25, Spring Boot 4.1.0 / Spring Framework 7.0.8.
> 🔴 **No sandbox** — no checkpoint was taken and no startup or restore time on these pages is
> a measurement. The CRaC project publishes comparison graphs; this topic quotes its prose,
> not numbers read off a chart.

**Every Java service has two startup costs and they are usually conflated. The first is
initialisation: classloading, bean creation, connection pools, configuration. The second is
warm-up: the JIT climbing from the interpreter to fully optimised code. The first is what
your logs measure. The second is what your users feel.**

## Where cold start became a production problem

For a decade, JVM startup was a developer-experience complaint. Three changes made it an
operational one:

- **Scale-to-zero.** If a workload is allowed to have no instances, some request pays the
  entire startup cost. Serverless platforms made that the normal case rather than the
  deployment case.
- **Autoscaling on a traffic spike.** The new instance arrives precisely when the system is
  already under load, and it arrives cold — so the instance added to relieve pressure is, for
  its first seconds, the slowest member of the pool.
- **Frequent deploys and rolling restarts.** With deploys per day rather than per quarter,
  the fraction of a service's lifetime spent cold stops rounding to zero.

🔴 **The pathological case is a cold instance behind a load balancer that routes by
round-robin.** It receives its share of traffic immediately, times out, and — if the health
check is aggressive enough — gets killed and replaced by another cold instance.

## The two costs, separated

**Initialisation** is work your application does: reading configuration, scanning classpaths,
building the context, opening pools, running migrations. It is deterministic, it is visible in
logs, and it is what "started in 2.4 seconds" refers to.

**Warm-up** is the JVM adapting to your workload. From
[topic 14](../14-benchmarking-with-jmh/02-why-the-jvm-defeats-naive-timing.md): execution
starts in the interpreter, moves through C1 tiers that collect a profile, and only then
reaches C2's profile-guided optimisation. Until then the same code path costs multiples of its
steady-state price, and no log line announces the transition.

⚠️ **Warm-up is the part every mitigation forgets.** A faster framework, lazy initialisation
or a smaller classpath shortens initialisation; none of them makes the first thousand requests
run optimised code.

## The four families of answer

| Approach | What it removes | What it costs |
|---|---|---|
| **Fix the startup** — lazy beans, fewer scans, less eager work | Part of initialisation | Nothing; usually the right first move |
| **CDS / AOT cache** (topic 10) | Classloading and linking work | A training run in the build; still cold JIT |
| **GraalVM native image** (topic 11) | Initialisation *and* the JVM itself | Closed-world constraints, no JIT, build complexity |
| **CRaC** (this topic) | Initialisation **and warm-up** | Linux, a specific JDK, CRIU privileges, a snapshot of your heap |

🔴 **Only one row removes warm-up, and that is the entire argument for this topic.** The CRaC
documentation states the claim directly:

> *"A Java application and JVM are started from an image in a warmed-up form."*

> *"The restore in general is faster than initialization. After the restore, Java runtime
> performance is also on-par with the one at the checkpoint. So, after proper warm-up before
> the checkpoint, restored Java instance is able to deliver the best runtime characteristics
> immediately."*

## The honest first question

⚠️ **Most services that reach for CRaC should first find out why they take so long to start.**
A context that opens six connection pools eagerly, scans a fat classpath and runs schema
validation at boot is not a candidate for snapshotting — it is a candidate for fixing. CRaC
makes a slow start *fast to repeat*; it does not make it correct, and it preserves whatever
the application did into an image you now have to manage, store and secure
([04c · Secrets and the snapshot](04c-secrets-and-the-snapshot.md)).

Spring Framework provides a way to investigate this without any CRaC machinery at all —
`-Dspring.context.exit=onRefresh`, which the reference describes as triggering similar
behaviour to the automatic checkpoint but *"without requiring the Project CraC
dependency/JVM or Linux"*, and which is *"useful to check if connections to remote services
are required when the beans are not started"*. 🔴 **Run that before you run anything else in
this topic.** See [05b · The two modes](05b-the-two-modes.md).

## Gotchas

🔴 **"Startup time" in your logs excludes warm-up entirely.** A service that reports a 2-second
start may still be several times slower than steady state for a minute afterwards. Measure the
latency of the first N requests, not the boot log.

🔴 **A readiness probe that passes at the end of initialisation admits a cold instance to the
pool.** If warm-up matters, readiness must account for it — topic 12 owns the probe interplay.

⚠️ **Lazy initialisation moves cost rather than removing it.** Beans created on first use turn
a slow start into a slow first request, which is often worse: the cost now lands on a user
instead of on the deployment.

⚠️ **Scale-to-zero multiplies the problem by the number of cold starts, not by uptime.** A
workload that scales to zero fifty times a day pays fifty cold starts.

⚠️ **Cold start and cold cache are different problems.** An empty application cache, an empty
page cache and an empty connection pool each cost separately, and a JVM-level fix addresses
none of them.

⚠️ **Comparing frameworks on "startup time" measures initialisation only** — the metric that
the least useful of the four approaches above improves.

## Interview questions

**★ Name the two components of Java cold start and say which one tooling usually reports.**
Initialisation (classloading, context creation, pools, configuration) and JIT warm-up. Logs
and framework metrics report initialisation; warm-up is invisible to them and is felt as
elevated latency on early requests.

**★ Why did cold start become an operational concern rather than a developer one?**
Scale-to-zero, autoscaling under load, and frequent deploys. Each makes cold instances a
regular part of serving traffic rather than a once-a-quarter event — and the autoscaling case
adds a cold instance exactly when the system is already struggling.

**★ Which cold-start mitigations address warm-up, and which do not?**
Only checkpoint/restore restores a warmed-up JVM. Reducing eager initialisation and using
CDS or the AOT cache shorten initialisation; native image removes initialisation and the JIT
entirely, trading peak throughput and dynamic features for it.

**★ Why is lazy initialisation not a general answer?**
It relocates the cost to the first request that needs the bean. The total work is unchanged
and it is now paid by a user, under load, rather than during deployment.

**★ What should you do before adopting CRaC?**
Find out why startup is slow. Spring's `-Dspring.context.exit=onRefresh` reaches the same
lifecycle phase without CRaC, a CRaC JDK or Linux, and shows whether the application is
contacting remote services during context refresh — often the real cause.

**★ Why can a cold instance make an overloaded system worse?**
Because it is added under load and immediately receives traffic while running interpreted or
lightly compiled code. It responds slowly, may fail health checks, and can be replaced by
another equally cold instance — a loop that adds capacity without adding throughput.

Next: [What CRaC is](02-what-crac-is.md).

{/* FOOTER */}
