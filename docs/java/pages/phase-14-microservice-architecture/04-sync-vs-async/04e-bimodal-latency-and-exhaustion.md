---
title: "Google's SRE book works an example where a fault affecting 5% of requests produces an 80.4% error rate, caused by nothing but a deadline three orders of magnitude longer than the mean — and that amplification is the real reason a synchronous hop is dangerous"
sidebar_label: "16 · Bimodal latency and exhaustion"
sidebar_position: 16
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the Google SRE book, "Addressing Cascading Failures" — the
> *Bimodal latency*, *Resource Exhaustion* and *Latency and Deadlines* sections
> ([sre.google](https://sre.google/sre-book/addressing-cascading-failures/)).
> 🔴 **No sandbox.** The worked example below is **Google's**, reproduced with attribution;
> every number in it is theirs and is arithmetic within their stated scenario. Nothing here
> was measured by this page. Version spine: JDK 25 · Spring Boot 4.1.1 / Spring Framework
> 7.0.8.

**Everything before this chunk treats a dependency's failure as costing you exactly that
dependency. This chunk is the correction. A partially failing dependency, combined with a
generous deadline, does not cost you 5% of requests — it costs you most of them, because the
5% that hang consume the thread capacity the healthy 95% needed. The amplification factor is
a property of *your* timeout configuration, not of the dependency, and it is the mechanism by
which a small fault somewhere else becomes a total outage in your service.**

## The worked example, from the SRE book

Quoted in full, because the arithmetic is the point and paraphrasing it would weaken it:

> *"Suppose that the frontend from the preceding example consists of 10 servers, each with 100
> worker threads. This means that the frontend has a total of 1,000 threads of capacity.
> During usual operation, the frontends perform 1,000 QPS and requests complete in 100 ms.
> This means that the frontends usually have 100 worker threads occupied out of the 1,000
> configured worker threads (1,000 QPS * 0.1 seconds)."*

> *"Suppose an event causes 5% of the requests to never complete. This could be the result of
> the unavailability of some Bigtable row ranges, which renders the requests corresponding to
> that Bigtable keyspace unservable. As a result, 5% of the requests hit the deadline, while
> the remaining 95% of the requests take the usual 100 ms."*

> *"With a 100-second deadline, 5% of requests would consume 5,000 threads (50 QPS * 100
> seconds), but the frontend doesn't have that many threads available. Assuming no other
> secondary effects, the frontend will only be able to handle 19.6% of the requests (1,000
> threads available / (5,000 + 95) threads' worth of work), resulting in an 80.4% error
> rate."*

> *"Therefore, instead of only 5% of requests receiving an error (those that didn't complete
> due to keyspace unavailability), most requests receive an error."*

**Read the ratio: a 5% fault produced an 80.4% error rate.** Sixteen times amplification, and
the only ingredient beyond the fault itself was a deadline of 100 seconds against a mean of
100 milliseconds.

## Why it happens: threads are a time-area resource

The insight the example encodes is that concurrency capacity is not consumed by *requests* but
by **request-seconds**. A thread pool of size N can support `N / latency` requests per second.
When latency for a subset of requests goes up by a factor of 1,000, that subset's share of the
pool goes up by 1,000 too — and it takes that capacity away from everyone else.

```text
threads consumed = arrival rate × time held

healthy:  1000 QPS × 0.1 s                = 100 threads
faulted:    50 QPS × 100 s (the deadline) = 5,000 threads
```

The faulted 5% wants fifty times the entire pool. There is no configuration of your service
that survives that, because the problem is not your service.

**This is the single most important reason not to set generous timeouts.** The instinct that a
long timeout is "safe" — better a slow answer than an error — is backwards at the system level:
a long timeout converts a small fault into a capacity exhaustion that affects requests which
had nothing to do with the fault.

## The book's own guidance from the same section

Four items, and each maps to a concrete action:

> *"Detecting this problem can be very hard. In particular, it may not be clear that bimodal
> latency is the cause of an outage when you are looking at mean latency. When you see a
> latency increase, try to look at the distribution of latencies in addition to the averages."*

A mean is useless here: 95% at 100 ms and 5% at 100 s has a mean of about 5 s, which looks like
"everything got a bit slower" and is nothing of the kind. **Alert on percentiles and on the
shape of the distribution, not on the mean.**

> *"This problem can be avoided if the requests that don't complete return with an error early,
> rather than waiting the full deadline. For example, if a backend is unavailable, it's usually
> best to immediately return an error for that backend, rather than consuming resources until
> the backend is available. If your RPC layer supports a fail-fast option, use it."*

This is the argument for circuit breaking, stated as a resource-protection measure rather than
as a resilience buzzword. **Phase 16 owns the implementation**; see
**07g · Circuit breaking as a consequence** *(not written yet)* for what
belongs here.

> *"Having deadlines several orders of magnitude longer than the mean request latency is
> usually bad. In the preceding example, a small number of requests initially hit the deadline,
> but the deadline was three orders of magnitude larger than the normal mean latency, leading
> to thread exhaustion."*

A usable rule of thumb falls out of this: **a deadline more than one or two orders of magnitude
above the typical latency is a capacity bomb.** If your dependency normally answers in tens of
milliseconds and your timeout is thirty seconds, you have three orders of magnitude of headroom
for a partial fault to eat your pool.

> *"When using shared resources that can be exhausted by some keyspace, consider either
> limiting in-flight requests by that keyspace or using other kinds of abuse tracking."*

The general form: **cap concurrency per dependency**, not just globally. A bulkhead, in
resilience vocabulary.

## The Java-specific amplifier: the GC death spiral

The same chapter's resource-exhaustion section names the failure mode most likely to hit a JVM
service, and it is worth quoting because it explains why a Java service under this pressure
degrades non-linearly:

> *"Increased rate of garbage collection (GC) in Java, resulting in increased CPU usage. A
> vicious cycle can occur in this scenario: less CPU is available, resulting in slower requests,
> resulting in increased RAM usage, resulting in more GC, resulting in even lower availability
> of CPU. This is known colloquially as the 'GC death spiral.'"*

Every in-flight request holds its request object, response buffers, deserialised DTOs and
whatever the handler allocated. Five thousand in-flight requests is five thousand object graphs
that cannot be collected because they are reachable from live stacks. Heap pressure rises,
collection frequency rises, CPU available for real work falls, latency rises, and the number of
in-flight requests rises again.

The same section also names the health-check interaction, which is how the incident spreads to
the orchestrator:

> *"If the server can't respond in time because it's waiting for a lock, health checks may fail
> if the health check endpoint can't be served in time."*

A pod that cannot answer its liveness probe gets restarted, its in-flight work is lost, and its
load moves to the remaining pods — which are already at capacity.

## What actually protects you

In order of effectiveness, and none of them is "hope the dependency stays up":

1. **A short deadline, derived from the budget.** The single highest-leverage control, because
   it directly bounds `time held` in the arithmetic above.
2. **A concurrency cap per dependency.** Independent of latency: even with an unbounded
   deadline, a semaphore of size k means the faulted dependency can hold at most k threads.
   This is the bulkhead, and it is the control that degrades most gracefully.
3. **Fail fast when the dependency is known bad.** A circuit breaker turns "hold a thread for
   the deadline" into "return immediately", removing the `time held` term entirely for the
   duration of the outage.
4. **Shed load at the entry point** rather than queueing it. See
   **07h · Backpressure and load shedding** *(not written yet)*.
5. **Virtual threads**, which change *which* resource is exhausted but not whether the requests
   fail. They are a genuine improvement and not a solution — see
   **09c** *(not written yet)*.

## Gotchas

**★ A generous timeout feels conservative and is the opposite.** The intuition is "if I wait
longer, more requests succeed". At the system level, waiting longer means each doomed request
occupies capacity for longer, so *fewer* requests succeed — including requests that had nothing
to do with the fault. The SRE example is 5% in, 80.4% out.

**★ Mean latency conceals bimodality completely.** A distribution that is 95% fast and 5%
timing out has a mean that looks like a mild regression. Alert on high percentiles and on the
count of requests exceeding the deadline, and treat "the latency histogram grew a second mode"
as its own signal.

**★ Thread-pool exhaustion presents as your service being broken.** Your error rate, your
latency, your saturated pool, your failing health checks — every symptom is local and the cause
is not. This is why the first question in such an incident should be "which dependency's
outcome distribution changed", not "what did we deploy".

**★ Restarting the pods makes it worse.** In-flight work is lost, the pod comes back with a
cold pool and a cold JIT, and its share of the load arrives immediately. Meanwhile the fault is
still there. Restarts are the standard reflex and they are counterproductive for this specific
failure mode.

**★ A concurrency cap without a queue bound just moves the pile-up.** If requests that cannot
acquire the semaphore wait in an unbounded queue, you have relocated the exhaustion from threads
to queue memory and added latency for everyone. Bound the queue and reject beyond it.

**★ The amplification is a property of your configuration, so two services calling the same
faulty dependency can have completely different outcomes.** One with a 500 ms deadline sheds the
faulted 5% and serves the rest; one with a 60-second deadline collapses. That is worth saying
during an incident review, because "their service was fine and ours died" is otherwise taken as
evidence that our code is worse.

## Interview questions

**★ A dependency starts failing to respond for 5% of requests. Why might your error rate be far
higher than 5%?**
Because the failing requests occupy request-handling capacity for the full deadline instead of
the usual latency, and that capacity is shared with the healthy 95%. The SRE book works the
arithmetic: 1,000 threads, 1,000 QPS, 100 ms normal latency, a 100-second deadline, and a 5%
fault produces 5,000 threads' worth of demand against 1,000 available — an 80.4% error rate. The
amplification factor is set by the ratio of the deadline to the normal latency.

**★ What is the relationship between deadline length and blast radius?**
Directly proportional. Threads consumed equals arrival rate times time held, so doubling the
deadline doubles the capacity a faulted request stream consumes. The SRE book's rule is that
deadlines several orders of magnitude longer than the mean latency are usually bad; the corollary
is that a deadline derived from the operation's budget rather than from "how long could this
possibly take" is also the strongest capacity protection you have.

**★ Why is mean latency the wrong metric for detecting this?**
Because bimodal distributions have means that correspond to nothing. Ninety-five percent at 100
ms and five percent at 100 seconds averages to roughly five seconds, which reads as a general
slowdown rather than as two populations, one of which is completely stuck. You want percentiles,
a histogram, and an explicit count of requests that hit the deadline — the last of which is the
cleanest signal and the one most often not collected.

**★ What is the difference between a timeout and a concurrency cap as protections here?**
A timeout bounds how long each doomed request holds capacity; a concurrency cap bounds how many
of them can hold it at once. They protect against different failures: a timeout does nothing if
the arrival rate is high enough that even short holds saturate you, and a cap does nothing about
the latency each request experiences. Together they bound the product — the request-seconds term
— which is what actually exhausts the pool. A cap has the additional property of containing the
damage to one dependency rather than to the whole service.

**★ Why is the GC death spiral specific to services like a JVM microservice, and what does it
change?**
Because every in-flight request keeps an object graph reachable — the request, the buffers, the
deserialised payloads — so a build-up of in-flight requests is directly a build-up of live heap.
More live heap means more frequent and more expensive collection, which takes CPU away from
request handling, which lengthens requests, which increases the number in flight. It changes the
shape of the degradation from linear to cliff-edged: the service looks fine, then it does not,
and the transition is fast enough that autoscaling does not help.

**★ Your pods are failing their liveness probes during a downstream incident. Is restarting them
the right response?**
Almost certainly not. The probe is failing because the request-handling capacity is saturated by
requests waiting on a dependency, not because the process is broken. Restarting discards
in-flight work, returns a pod with a cold connection pool and cold JIT into a saturated system,
and moves its share of the load onto the remaining pods. The correct responses are to shorten
the deadline, cap concurrency to the failing dependency, or shed load at the entry point — and
to serve the liveness endpoint from a path that does not share the exhausted resource.

{/* FOOTER */}
