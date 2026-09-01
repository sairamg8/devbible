---
title: "In a container the log is not a file, it is a stream the platform collects — so the file appender, the rotation policy and the log volume you carefully configured are all solving a problem the platform already solved, and every one of them adds a failure mode the stream does not have"
sidebar_label: "10 · Appenders and where logs go"
sidebar_position: 21
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the JDK-agnostic **Logback** sources on the `master` branch as of
> this date —
> [`OutputStreamAppender`](https://github.com/qos-ch/logback/blob/master/logback-core/src/main/java/ch/qos/logback/core/OutputStreamAppender.java),
> which extends `UnsynchronizedAppenderBase`, declares
> `protected final ReentrantLock streamWriteLock = new ReentrantLock(false)` with the comment
> *"All synchronization in this class is done via the lock object"*, defaults
> `boolean immediateFlush = true`, and whose `writeByteArrayToOutputStreamWithPossibleFlush`
> writes then flushes when `immediateFlush` is set; and the **Logback manual** on appenders and
> encoders ([logback.qos.ch](https://logback.qos.ch/manual/appenders.html)). Also the
> **twelve-factor** logs guidance ([12factor.net/logs](https://12factor.net/logs)) and the
> **Spring Boot 4.1** logging reference
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/features/logging.html)).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**An appender is the thing that decides where a log event physically goes, and it is the part of
logging configuration most often inherited from a decade-old template. The template assumes a
long-lived server with a disk and a logrotate cron job. If you deploy containers, almost none of
that assumption holds — and the configuration that follows from it converts a solved problem back
into an unsolved one.**

## The pipeline, in order

Five stages, and knowing which stage owns which concern prevents most configuration mistakes:

1. **Logger** — the named hierarchy (`com.example.payments`). Owns the level decision. A call
   below the effective level stops here, having allocated nothing except the argument evaluation
   you did not guard — [04 · Parameterised messages](04-parameterised-messages.md).
2. **Filter** — additional accept/deny beyond level. Where markers and per-request rules apply.
3. **Appender** — the destination. Console, file, socket, or a wrapper like `AsyncAppender`.
4. **Encoder** — event to bytes. The pattern, or the JSON structure of
   [05 · Structured JSON](05-structured-json.md).
5. **The write itself** — a lock, a byte-array write, and usually a flush.

Two properties of that list matter later. The level check is the *only* stage that is free.
Everything from the encoder onward is proportional to message size and happens on some thread —
which one is the entire subject of [10b](10b-async-appender.md).

## Console versus file, and why the answer changed

The traditional configuration writes to a file, rotates it by size or date, keeps N generations,
and leaves cleanup to the platform. It is the right design for a long-lived host running several
applications, and it is the wrong one for a container.

In a container the convention — and it is the platform's contract, not a style preference — is
that the application writes to stdout and the platform collects the stream. Twelve-factor puts it
plainly: an app *"should not attempt to write to or manage logfiles"*. What follows is a list of
things you stop owning:

- **Rotation.** The runtime's log driver handles it. A rotation policy inside the container is a
  second, uncoordinated one.
- **Retention.** Set centrally, per environment, rather than per application.
- **Shipping.** The platform already reads the stream. A sidecar or an in-process appender that
  ships logs is a duplicate path with its own failure modes.
- **Disk.** This is the important one. **A container's filesystem is usually a shared,
  size-limited layer, and filling it takes the application down** — often after the log rotation
  you configured failed to keep up, or because the rotation policy and the disk quota were set by
  different people.

There is a case for file output — a compliance requirement for a local copy, a platform without
stream collection, or the audit trail of [08b](08b-masking-and-the-audit-trail.md) where a local
durable copy is deliberate. It should be a decision with a reason attached, and the reason should
not be "the template had it".

🔴 **The failure mode nobody plans for is the disk filling.** A `FileAppender` whose target
filesystem is full does not stop the application, but the failure is silent from the
application's point of view, and what you lose is the log — starting exactly when something went
wrong enough to produce a lot of it. That combination, an incident that generates volume and a log
that stops recording because of the volume, is the specific reason the stream is safer.

## Spring Boot's defaults, and what they already give you

Boot configures Logback with a console appender and a sensible pattern out of the box, and adds a
file appender only when `logging.file.name` or `logging.file.path` is set. That default is the
container-appropriate one, so **the most common way to get this wrong is to add configuration**.

The other thing worth knowing: dropping a `logback.xml` into the classpath replaces Boot's
configuration entirely, including the parts you wanted. `logback-spring.xml` is the version Boot
processes — it supports property substitution and profile blocks, and lets you include Boot's own
defaults rather than reimplementing them. Choosing the wrong filename is how teams lose Boot's
colour coding, its property bindings and its structured-logging wiring in one step, then
reimplement them by hand.

## `immediateFlush`, and the tradeoff it encodes

`OutputStreamAppender` declares `boolean immediateFlush = true`, and its write path is:

```java
this.outputStream.write(byteArray);
if (immediateFlush) {
    this.outputStream.flush();
}
```

Flushing every event is why a log line is visible the instant it is written and why nothing is
lost when the process is killed — including, critically, the last lines before a crash, which are
usually the ones you want. It also means every event pays a syscall.

Setting `immediateFlush=false` buffers, which is faster and means **an abrupt termination loses
whatever was in the buffer**. For a service whose logs matter most at the moment it dies —
OOMKilled, `ExitOnOutOfMemoryError`, SIGKILL after a failed shutdown — that is a poor trade, and
it is the wrong lever to reach for anyway: the right response to logging cost is
[10b](10b-async-appender.md)'s queue or less logging, both of which keep durability.

## Ordering and the wrapper

`AsyncAppender` is not a destination; it is a wrapper that takes another appender by reference.
That has a consequence worth stating because the configuration does not make it obvious: **the
encoder still runs, and it runs on whichever thread the wrapper decides.** Wrapping does not make
formatting free, it relocates it — and it relocates one specific thing, caller data, in a way that
silently changes your output. That is [10b](10b-async-appender.md).

## Gotchas

**★ In a container, writing to a file re-creates a problem the platform already solved.**
Rotation, retention, shipping and disk management all become yours again, each with its own
failure mode, and none of them coordinated with the platform's.

**★ A full disk stops the log at exactly the moment the log matters.**
An incident generates volume; the volume fills a size-limited container layer; the appender stops
recording. The correlation between "something is badly wrong" and "the log ends here" is not a
coincidence, and it is the strongest practical argument for the stream.

**★ `logback.xml` replaces Boot's configuration entirely; `logback-spring.xml` extends it.**
The wrong filename silently discards Boot's pattern, colour coding, property bindings and
structured-logging wiring — which then get reimplemented by hand, slightly differently.

**★ Adding logging configuration is the most common way to get container logging wrong.**
Boot's default is console-only, which is already correct. The file appender arrives from a
template, not from a requirement.

**★ `immediateFlush` defaults to `true`, and turning it off loses the lines before a crash.**
Buffering is faster and discards whatever was pending when the process is killed — which is
precisely the window you care about after an OOMKill or a SIGKILL.

**★ Every stage after the level check costs something proportional to message size.**
The level check is the only free one. Encoding, locking and writing are all paid per event that
passes, which is why guarding an expensive argument matters and guarding a cheap one does not.

**★ `AsyncAppender` is a wrapper, not a destination, and the encoder still runs.**
It relocates work rather than removing it. A configuration that wraps a slow appender still has a
slow appender, now with a queue in front of it.

**★ A logging path that ships over the network has the network's failure modes.**
A socket appender writing to a collector inherits its latency and its outages. The platform
reading a stream does not put the network on your application's critical path.

**★ Two rotation mechanisms are worse than one.**
An in-container rotation policy plus a platform log driver produces files neither of them fully
owns, and a disk usage neither of them accounts for.

**★ Local files and multi-replica deployments interact badly.**
Ten replicas mean ten local logs on ten ephemeral filesystems, each disappearing when its pod
does. Reconstructing a request's path across them requires exactly the central collection you
bypassed.

## Interview questions

**★ Why should a containerised application log to stdout rather than to a file?**
Because in a container the log is a stream the platform collects, and writing to a file takes back
ownership of four things the platform already handles — rotation, retention, shipping and disk
management — each of which then becomes an independent failure mode uncoordinated with the
platform's. The one that actually bites is disk: a container's filesystem is typically a
size-limited layer, and filling it degrades or kills the application. That failure correlates
exactly with incidents, because an incident produces log volume, so the log stops recording at the
moment it is most needed. There are legitimate reasons to write files — a compliance requirement
for a local durable copy, a platform with no stream collection, or an audit trail that is
deliberately separate — but they should be decisions with reasons, and in practice the file
appender usually arrives inherited from a template written for a long-lived host running several
applications, where it was the correct design.

**★ What is the difference between `logback.xml` and `logback-spring.xml` in a Spring Boot
application?**
`logback.xml` is picked up by Logback itself, before and independently of Boot, and it replaces
Boot's logging configuration wholesale. `logback-spring.xml` is processed by Boot, which means it
can use `<springProperty>` to read values from the environment and `<springProfile>` blocks to
vary configuration per profile, and — most usefully — it can include Boot's own defaults rather
than reimplementing them. The practical consequence of choosing wrong is that a team drops in a
`logback.xml` to add one appender and silently loses Boot's default pattern, its colour coding, the
property bindings for `logging.level.*`, and the structured-logging wiring, then reintroduces
approximations of each by hand over the following months. It is a good example of a configuration
choice where the two options look interchangeable and one of them quietly discards work somebody
else did for you.

**★ `immediateFlush` is true by default. When would you turn it off and what do you lose?**
You would turn it off to reduce syscalls when logging volume is genuinely the bottleneck — every
event currently writes and then flushes, so buffering amortises that across many events. What you
lose is everything still in the buffer when the process terminates abruptly, and that is the
expensive part: the lines immediately before a crash are usually the ones that explain it, and the
terminations where this matters — an OOMKill, `ExitOnOutOfMemoryError`, a SIGKILL after graceful
shutdown timed out — are exactly the ones that give the buffer no chance to drain. So the trade is
throughput now against diagnosability at the worst moment. It is also the wrong lever for the
stated problem: if logging cost is the issue, an async appender moves the work off the application
thread while keeping the durability, and reducing what you log removes the cost entirely. I would
want a measurement showing flush syscalls were the actual bottleneck before accepting that trade.

**★ Walk through what happens between `log.info(...)` and bytes appearing.**
The logger checks the effective level for its name against the call; if the call is below it,
nothing further happens and the only cost paid is evaluating the arguments — which is why
parameterised messages matter and why guarding a cheap argument does not. If it passes, filters
run, giving markers and per-request rules a chance to accept or deny. Then the event goes to each
attached appender. The appender hands the event to its encoder, which turns it into bytes — this
is the pattern layout or the JSON structure, and it is proportional to message size. Then the
write: in Logback's `OutputStreamAppender` that means taking a `ReentrantLock`, writing the byte
array to the stream, and flushing if `immediateFlush` is set, which it is by default. If an
`AsyncAppender` is in the chain, it sits between the logger and the real appender and moves the
tail of that work onto its own worker thread via a bounded queue. The useful thing about knowing
the order is that it tells you which stage a given configuration change actually affects — level
changes eliminate everything, encoder changes affect only what passed, and async changes affect
only which thread pays.

**★ You have ten replicas each writing local log files. What breaks?**
Reconstruction, retention and durability, in that order. A single request that touches several
services now leaves its trace scattered across several pods' local filesystems, so answering "what
happened to this request" means finding and correlating files on machines you may not have access
to — which is precisely the problem central collection and a correlation id exist to solve, and
you have opted out of it. Retention becomes ten independent policies that drift, and disk usage
becomes ten independent quotas that nobody is watching until one fills. And durability is the
worst of it: a pod's filesystem is ephemeral, so when a pod is rescheduled, evicted or OOMKilled,
its logs go with it — meaning the logs from the instance that failed, which are the only ones
anybody wants, are the ones most likely to be gone. Writing to stdout and letting the platform
collect removes all three problems at once, which is why the convention exists.

{/* FOOTER */}
