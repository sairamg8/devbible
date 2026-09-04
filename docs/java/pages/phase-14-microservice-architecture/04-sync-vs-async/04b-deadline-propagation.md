---
title: "A deadline is an absolute point in time that travels with the request and shrinks at every hop, and the reason HTTP systems do not have one is that HTTP never standardised a header for it"
sidebar_label: "12 · Deadline propagation"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the Google SRE book, "Addressing Cascading Failures" —
> the *Latency and Deadlines* section
> ([sre.google](https://sre.google/sre-book/addressing-cascading-failures/)), the gRPC
> documentation, "Deadlines" ([grpc.io](https://grpc.io/docs/guides/deadlines/)), and JEP 506
> "Scoped Values" ([openjdk.org](https://openjdk.org/jeps/506)) — *Closed / Delivered*,
> release **25**, i.e. final API, not preview.
> 🔴 **No sandbox.** Durations below are chosen to make arithmetic legible, or are quoted
> from the source they came from. Version spine: JDK 25 · Spring Boot 4.1.1 / Spring
> Framework 7.0.9 · Spring gRPC 1.0.3.

**A timeout is a duration each hop invents. A deadline is an instant the whole request tree
shares. The difference is the difference between six services each waiting two seconds and a
tree that collectively stops at the moment the caller stopped caring. Every RPC framework
worth using propagates deadlines automatically; HTTP does not, because there is no standard
header for it, which is why the discipline has to be built by hand in a REST architecture and
is therefore usually absent.**

## Deadline versus timeout, exactly

The gRPC documentation draws the line precisely:

> *"A deadline is used to specify a point in time past which a client is unwilling to wait
> for a response from a server."*

and

> *"When an API asks for a deadline, you provide a point in time which the call should not go
> past. A timeout is the max duration of time that the call can take."*

A timeout is relative and per hop. A deadline is absolute and per request. You convert a
timeout to a deadline by adding it to the current time when the call begins; the point of the
conversion is that the deadline is then **meaningful to somebody else**, which a timeout is
not.

## What propagation does

The SRE book's worked description is the clearest available and it is worth having in full:

> *"With deadline propagation, a deadline is set high in the stack (e.g., in the frontend).
> The tree of RPCs emanating from an initial request will all have the same absolute
> deadline. For example, if server A selects a 30-second deadline, and processes the request
> for 7 seconds before sending an RPC to server B, the RPC from A to B will have a 23-second
> deadline. If server B takes 4 seconds to handle the request and sends an RPC to server C,
> the RPC from B to C will have a 19-second deadline, and so on. Ideally, each server in the
> request tree implements deadline propagation."*

And the counter-example, which is the failure mode in every un-propagated system:

> *"Server A sends an RPC to server B with a 10-second deadline. Server B takes 8 seconds to
> start processing the request and then sends an RPC to server C. If server B uses deadline
> propagation, it should set a 2-second deadline, but suppose it instead uses a hardcoded
> 20-second deadline for the RPC to server C. Server C pulls the request off its queue after
> 5 seconds. Had server B used deadline propagation, server C could immediately give up on
> the request because the 2-second deadline was exceeded. However, in this scenario, server C
> processes the request thinking it has 15 seconds to spare, but is not doing useful work,
> since the request from server A to server B has already exceeded its deadline."*

Server C is doing work nobody will read, holding a thread and a database connection to do it,
during an incident. Multiply by every request in flight and that is a meaningful fraction of
your fleet's capacity spent on work that has already been abandoned.

The book adds two operational refinements that matter:

> *"You may want to reduce the outgoing deadline a bit (e.g., a few hundred milliseconds) to
> account for network transit times and post-processing in the client."*

> *"Also consider setting an upper bound for outgoing deadlines. You may want to limit how
> long the server waits for outgoing RPCs to noncritical backends, or for RPCs to backends
> that typically complete in a short duration."*

## Checking the deadline between stages

Propagation gets the number to the callee. Using it is a second discipline:

> *"If handling a request is performed over multiple stages (e.g., there are a few callbacks
> and RPC calls), the server should check the deadline left at each stage before attempting
> to perform any more work on the request. For example, if a request is split into parsing,
> backend request, and processing stages, it may make sense to check that there is enough
> time left to handle the request before each stage."*

This is cheap to implement and almost never implemented. A handler that has already spent its
budget should return immediately rather than starting a database query it cannot finish in
time — the query will run to completion regardless of the client having left, consuming the
database's capacity during an incident.

## gRPC does it for you, and does one clever thing

The gRPC documentation notes that a server acting as a client can propagate deadlines from an
incoming RPC to outgoing ones, automatically in Java and Go. It also records the subtlety
that makes the mechanism correct across machines:

> *"Since a deadline is set [as] a point in time, propagating it as-is to a server can be
> problematic as the clocks on the two servers might not be synchronized."*

so gRPC converts the deadline back to a **timeout** on the wire — a remaining duration —
which the receiving side re-anchors against its own clock. Absolute in memory, relative on the
wire. This is the correct design, and it is the design you should copy if you build the
mechanism yourself over HTTP.

**06 · gRPC** *(not written yet)* owns gRPC deadlines as a feature; what belongs here is that
the *reason* to want them is the budget argument in
[11 · The latency budget](04-the-latency-budget.md).

## HTTP has no standard for this, and that is the whole problem

There is no IANA-registered request header that means "you have this long left". `Expires`,
`Cache-Control: max-age` and `Retry-After` are all about caching and retry scheduling, not
about request deadlines. The consequence:

- Every HTTP-based microservice system either builds the mechanism itself or does not have it.
- The overwhelming majority do not have it.
- Sidecar meshes and gateways generally implement per-hop timeouts, not propagated deadlines,
  so buying a mesh does not solve this.

Building it yourself is not hard. It is roughly forty lines and it needs three pieces.

**1 · Carry the remaining budget on the wire.** A custom header with a duration in
milliseconds, sent as remaining time rather than an absolute instant, for the clock-skew reason
gRPC gives:

```java
public final class Deadlines {

    public static final String HEADER = "X-Request-Timeout-Ms";

    private static final ScopedValue<Instant> DEADLINE = ScopedValue.newInstance();

    private Deadlines() {}

    public static Optional<Instant> current() {
        return DEADLINE.isBound() ? Optional.of(DEADLINE.get()) : Optional.empty();
    }

    public static Duration remaining(Clock clock) {
        return current()
            .map(d -> Duration.between(clock.instant(), d))
            .orElse(Duration.ofMillis(Long.MAX_VALUE));
    }

    public static <T> T withDeadline(Instant deadline, Callable<T> body) throws Exception {
        return ScopedValue.where(DEADLINE, deadline).call(body);
    }
}
```

`ScopedValue` is **final API in JDK 25** — JEP 506 is *Closed / Delivered*, release 25, and
its summary is that scoped values *"enable a method to share immutable data both with its
callees within a thread, and with child threads"*. That second clause is the reason to prefer
it to a `ThreadLocal` here: a scoped value is visible inside subtasks forked from a
`StructuredTaskScope`, so the deadline survives a fan-out without being threaded through as a
parameter. A `ThreadLocal` does not, and **a deadline that does not follow the request onto
the threads that do the work is not propagated at all.** Note the one incompatibility JEP 506
called out when finalising: *"The `ScopedValue.orElse` method no longer accepts null as its
argument."*

**2 · Read it on the way in.** A `Filter` or `HandlerInterceptor` that reads the header,
subtracts a safety margin, and binds the resulting instant for the duration of the request.

**3 · Write it on the way out.** A `ClientHttpRequestInterceptor` (or a `RestClient`
request initializer) that computes the remaining time, subtracts the transit margin, sets the
header, and — crucially — **sets the read timeout on this specific request to the remaining
budget** rather than to a static configured value:

```java
@Bean
RestClientCustomizer deadlinePropagation(Clock clock) {
    return builder -> builder.requestInterceptor((request, body, execution) -> {
        Duration left = Deadlines.remaining(clock).minusMillis(50);   // transit margin
        if (left.isNegative() || left.isZero()) {
            throw new DeadlineExceededException(request.getURI());
        }
        request.getHeaders().add(Deadlines.HEADER, Long.toString(left.toMillis()));
        return execution.execute(request, body);
    });
}
```

The `throw` on an already-expired deadline is the important line. It is the *"you don't get
credit for late assignments"* rule applied at the caller: do not start a call you cannot
finish.

Setting the per-request read timeout from the remaining budget is harder than it looks with a
shared `RestClient`, because the timeout usually lives on the request factory rather than the
request. The practical approaches are a request factory that consults the bound deadline, or —
simpler and coarser — an outer bound on the whole operation via a
`StructuredTaskScope` timeout, as in
[08 · Fanning out in Java](03c2-fanning-out-in-java.md).

## Gotchas

**★ Sending an absolute timestamp instead of a remaining duration makes you dependent on clock
sync.** If the two machines' clocks differ by a second, a one-second deadline is either
already expired or twice as long as intended. gRPC converts to a remaining duration on the
wire for exactly this reason, and the same conversion is the right choice for a custom header.

**★ Propagation without enforcement is decoration.** A header that arrives and is never read,
or is read and never used to bound anything, has cost you a header. The mechanism only pays
when the callee (a) refuses to start work with no budget left, (b) checks between stages, and
(c) derives its own outgoing timeouts from it.

**★ A `ThreadLocal` deadline does not survive a fan-out; a `ScopedValue` mostly does.**
The moment you fork subtasks onto other threads — a virtual-thread `ExecutorService`, an
`@Async` method, a reactive scheduler hop — a `ThreadLocal` deadline is gone unless you
propagate it explicitly. Spring Framework's own reference warns about exactly this class of
problem for events: *"ThreadLocals and logging context are not propagated by default for the
event processing."* `ScopedValue` inherits into subtasks forked from a `StructuredTaskScope`,
which covers the fan-out case — but it does **not** magically follow a task handed to an
unrelated `ExecutorService` or a reactive scheduler, so check the mechanism you are actually
using rather than assuming.

**★ Deadline propagation makes a slow dependency fail *earlier* in more places, which reads
as a regression.** Before propagation, a slow leaf produced timeouts only at the leaf's
caller; after, every service in the chain gives up as its own share expires, so the error
count in the middle tiers goes up. Nothing got worse — you replaced silent wasted work with a
visible, attributable failure. Say so before you deploy it, or someone will roll it back.

**★ An upper bound on outgoing deadlines is a separate control from the propagated budget.**
The SRE book recommends both: propagate the remaining budget *and* cap what you are willing to
wait for a given backend. Without the cap, a caller with a very long budget will wait a very
long time on a backend that should never take that long, which is the resource-exhaustion
problem again.

**★ Gateways and service meshes give you per-hop timeouts, not deadlines.** Configuring a
30-second timeout at the gateway and a 30-second timeout at each service is the un-propagated
case with extra steps. The mesh does not know how much time the request has already spent. If
you need a deadline, you are building it in the application.

**★ Retry interacts with the deadline and usually loses.** A retry inside a hop must fit
within the remaining budget, not extend it. A client configured with "250 ms timeout, 2
retries" against a 300 ms remaining budget will exceed the deadline on the first retry. Either
the retry schedule is derived from the remaining budget or the two mechanisms are fighting.

## Interview questions

**★ What is the difference between a timeout and a deadline?**
A timeout is a relative duration, chosen by one caller for one hop, and it means nothing to
anybody else. A deadline is an absolute instant that belongs to the whole request and can be
passed to everyone who works on it, so each participant can compute how much of the original
budget is left. gRPC's documentation puts it as: a deadline is *"a point in time past which a
client is unwilling to wait"*, whereas a timeout is *"the max duration of time that the call
can take"*.

**★ Server B receives a request with 2 seconds left and calls C with a hardcoded 20-second
timeout. What is wrong?**
C will spend up to 20 seconds doing work that nobody will read, because A gave up on B after
the original deadline and B will give up on C long before 20 seconds. The resources C consumes
— a thread, a connection, possibly a transaction — are spent producing a result that is
discarded. During an incident, when every request is slow, that wasted capacity is a
significant fraction of the fleet and it actively delays recovery.

**★ Why does gRPC convert a deadline to a remaining duration before putting it on the wire?**
Because the two machines' clocks may not agree. An absolute timestamp interpreted against a
skewed clock is either already expired or far too generous, and neither error is detectable at
the receiver. Sending "you have 1,850 ms left" lets the receiver re-anchor against its own
clock, so the mechanism depends only on each machine's clock being locally monotonic, not on
the two being synchronised.

**★ Why do most HTTP microservice systems lack deadline propagation?**
Because HTTP never standardised a header for it, so there is nothing to turn on — the
mechanism has to be built. Meshes and gateways provide per-hop timeouts, which look similar
and are not: a per-hop timeout has no idea how much of the request's total budget has already
been spent. Building it is about forty lines — a header, an inbound interceptor that binds the
deadline, an outbound interceptor that decrements and enforces it — and the hard part is
propagating the bound value across every thread hop inside the service.

**★ You add deadline propagation and your middle-tier error rate goes up. Did you make things
worse?**
No, you made an existing failure visible and attributable. Previously those requests were
already doomed — the top of the tree had given up — but the middle tiers kept working and
their metrics counted the eventual response as a success or as someone else's timeout. Now
each tier gives up when its share expires and records a deadline-exceeded error naming the
dependency. The user-visible outcome is the same or better; what changed is that the incident
now points at itself.

**★ Where should a service check the remaining deadline, beyond the outbound call?**
Between stages of its own handling. The SRE book recommends checking before each stage —
before parsing, before issuing a backend request, before an expensive processing step — and
returning immediately if there is not enough time left to complete it. The value is highest
for stages that consume shared resources: refusing to start a database query you cannot finish
protects the database's capacity for requests that can still succeed.

{/* FOOTER */}
