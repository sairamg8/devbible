---
title: "Masking in the logging pipeline is the layer that catches the mistake you did not prevent, so it has to be judged as a safety net rather than as a control — and the audit trail people think they are getting from their application log is a different artefact with different requirements, a different retention period and, usually, a different storage system"
sidebar_label: "08b · Masking and the audit trail"
sidebar_position: 18
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Logback** manual — layouts, `PatternLayout` replace/converter
> mechanics and filters ([logback.qos.ch](https://logback.qos.ch/manual/layouts.html)); the
> **SLF4J** API documentation for `Marker`
> ([slf4j.org](https://www.slf4j.org/api/org/slf4j/Marker.html)); the **OWASP Logging Cheat
> Sheet** for the event-attribute list
> ([owasp.org](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)); **PCI DSS
> v4.0 Requirement 10** on audit logs and **10.5.1** on the one-year retention with three months
> immediately available ([pcisecuritystandards.org](https://www.pcisecuritystandards.org/document_library/));
> and the **Spring Boot 4.1 production-ready** reference for the auditing support and structured
> logging configuration
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/actuator/auditing.html)).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**[08](08-what-never-to-log.md) argued that the only reliable control is not producing the line.
This page is about the two things you still owe after accepting that: a masking layer that limits
the damage when the rule is broken anyway, and an audit log — which people believe they already
have, because they have an application log, and which is a different artefact in almost every
respect that matters.**

## Masking, judged honestly

The correct framing is a **safety net**: it exists because [08](08-what-never-to-log.md)'s rule
will be broken by someone who has not read it, by a library, or by a field added to a DTO two
years from now. That framing has consequences for how you build it. A safety net should be broad,
cheap and forgiving; it should not be relied on, and it should never be the reason a review
approves a line that logs an object.

Where the masking runs decides what it can promise:

| Layer | Catches | Misses |
|---|---|---|
| **In the code** — a `toString()` override, `@ToString.Exclude`, a field marked for the logging serialiser | The specific field, always, on every path | Anything nobody annotated; new fields |
| **In the appender/encoder** — a converter or replace rule, or a structured-logging field filter | Everything that reaches the appender, including third-party logging | Cost is paid per line; patterns are guesses over free text |
| **At the shipper** | Whatever the local file already contains | The local file itself, which is where a forensic investigation looks |
| **At the aggregator** | The search UI | Local disk, shipper buffer, backups — everything before it |

🔴 **The two layers worth having are the first two.** In-code exclusion is exact and free. Encoder
masking is the net. The shipper and aggregator layers are worth configuring and worth nothing as
assurance, for the reason in [08](08-what-never-to-log.md): the line was already written.

Logback's mechanisms for the second layer are `PatternLayout`'s `replace` conversion word and a
custom `ClassicConverter`, and for JSON output the equivalent is a field-aware filter in the
encoder. Two practical constraints, both of which people discover late:

- **A converter runs on every line.** A regex over the full message on a hot path is a real cost —
  the argument of [10c](10c-the-log-that-became-the-bottleneck.md) applies to your own masking
  code exactly as it does to an appender.
- **Structured logging makes this far more tractable.** Masking a *named field* is exact;
  masking a substring of free-form text is a guess with two failure modes — missing the value in
  an unanticipated format, and corrupting an unrelated line that happened to match. That is a
  concrete, security-flavoured argument for [05 · Structured JSON](05-structured-json.md) beyond
  queryability.

**Partial masking is usually better than full redaction**, and it is what the standards expect
anyway: the last four digits of a card, the domain of an email, the first characters of a token
id. It preserves enough to correlate and debug while removing enough to be useless if stolen.
`****` tells you a field was present and nothing else, which frequently causes someone to remove
the mask temporarily to investigate — the worst outcome available.

## The audit log is a different artefact

This is the part that gets conflated, and the conflation is expensive. An application log and an
audit log answer different questions for different readers, and almost every requirement differs:

| | Application log | Audit log |
|---|---|---|
| **Question** | What did the system do? | Who did what to whom, and when? |
| **Reader** | Engineers, during an incident | Auditors, investigators, sometimes a court |
| **Content** | Whatever helps debugging | A fixed, agreed event schema |
| **Loss tolerance** | Acceptable — sampling and discarding are normal | 🔴 **Not acceptable.** A dropped audit event is a compliance failure |
| **Retention** | Days to weeks, driven by cost | Years, driven by regulation |
| **Mutability** | Rotated, deleted, sometimes rewritten | Append-only, tamper-evident |
| **Level filtering** | Central to its design | Meaningless — an audit event is not "INFO" |
| **Failure mode** | Log and continue | May need to fail the operation |

Read the "loss tolerance" row against [10b · The async appender](10b-async-appender.md) and the
conflict is immediate: `AsyncAppender` **silently discards events** when its queue is under
pressure, and `neverBlock` makes discarding unconditional. Anything routed through it has no
delivery guarantee. An audit event that must not be lost cannot go down that path, and if your
audit events are `log.info(...)` calls in the same pipeline as everything else, they are already
on it.

That is the load-bearing argument of this page: **audit events belong in a store, not in a log
line.** A table with a transaction, an append-only stream, or a dedicated audit service — something
where writing the event is part of the operation's success rather than a side effect of it.
Spring Boot's Actuator auditing support is the framework-level version of this idea, publishing
audit events as first-class objects with their own listener rather than as formatted strings.

The reverse mistake is just as common and less discussed: putting audit-grade retention on the
application log because it is easier than building the audit store. That buys years of retention
for gigabytes of debugging output, most of which is personal data nobody decided to keep, and it
makes the GDPR erasure problem from [08](08-what-never-to-log.md) enormously worse.

## When both are genuinely the same pipeline

Sometimes shipping both through the same infrastructure is the pragmatic answer — small system,
one aggregator, no separate audit store yet. It can be defensible if three things are true, and it
is worth being explicit about them because they are usually assumed rather than checked:

1. **A marker or a structured field distinguishes audit events unambiguously**, so retention,
   access control and alerting can be applied to that subset. SLF4J `Marker`s exist for exactly
   this kind of orthogonal classification, and a dedicated logger name works as well.
2. **The audit subset is routed to a synchronous, non-discarding appender.** Different appender,
   different guarantees, same pipeline afterwards.
3. **Retention is configured per subset**, not globally, so audit events keep years and debug
   output keeps days.

If any of the three is missing, what you have is an application log that somebody will
nevertheless present as an audit trail during an investigation — and the discussion about whether
events could have been dropped will not go well.

## What an audit event has to contain

The OWASP guidance is the practical checklist, and the useful discipline is that these are
*required fields of a schema*, not things to remember to mention in a message:

- **Who** — the authenticated principal, and the real user if acting on someone's behalf.
- **What** — the action, from a closed vocabulary rather than free text.
- **When** — a timestamp with a timezone, from a trusted source rather than the client's clock.
- **Where** — the source address, the service instance.
- **To what** — the entity identifiers affected.
- **Outcome** — success or failure, with a reason code. 🔴 **Failed attempts matter more than
  successful ones**, and are the ones most often omitted, because the code path that rejects a
  request tends to return early before any recording happens.

Note what is absent: the values. An audit event says a user updated a customer record, not what
the record contained. That keeps the audit trail outside the scope of the erasure problem while
still answering the question it exists to answer.

## Gotchas

**★ Masking is a safety net, not a control, and the distinction has to survive code review.**
The moment "the pipeline masks it" becomes a reason to approve a line that logs an object, the net
has made things worse than not having it. Its purpose is to reduce the blast radius of a mistake,
never to license one.

**★ Redaction over free text is a guess; redaction over a named field is exact.**
A pattern misses the value in an unanticipated encoding and corrupts unrelated lines that resemble
it. This is a security argument for structured logging that has nothing to do with queryability.

**★ Partial masking beats full redaction, and the standards assume it.**
Last four digits, email domain, token id prefix. `****` proves a field existed and nothing more,
which regularly leads someone to disable the mask "just to see" — converting a safe log into an
unsafe one at exactly the wrong moment.

**★ Your masking converter runs on every line, including the hot path.**
A regex over each message has a cost, and it is paid whether or not anything matches. Masking code
is application code on the logging path, subject to everything in
[10c](10c-the-log-that-became-the-bottleneck.md).

**★ `AsyncAppender` discards events, so an audit event routed through it has no delivery
guarantee.**
Logback's async path drops events below its discarding threshold, and `neverBlock` drops
unconditionally when full. Anything that must not be lost cannot share that appender —
[10b](10b-async-appender.md).

**★ An audit log is a store, not a log line.**
Its requirements — no loss, append-only, years of retention, a fixed schema, tamper evidence —
are the requirements of a database table or an append-only stream. Meeting them with a text file
and a shipper means meeting none of them.

**★ Failed attempts are the audit events most often missing.**
The rejecting code path returns early, before any recording. Yet a sequence of failures is exactly
what an investigation looks for, and its absence is indistinguishable from nothing having
happened.

**★ Applying audit retention to the application log is the expensive way to avoid building an
audit store.**
It keeps years of debugging output, most of it personal data nobody chose to retain, and makes
erasure obligations dramatically worse — while still not providing tamper evidence or delivery
guarantees.

**★ Level filtering is meaningless for audit events, and routing them by level is the common
mistake.**
"Audit at INFO" means a level change somewhere can silence the audit trail. Route by logger name
or marker, never by level.

**★ An audit event should record identifiers, not values.**
That a user updated a customer record is the fact; what the record contained is not. Keeping
values out is what allows an append-only years-long store to coexist with data-protection
obligations.

**★ A `Marker` is the right mechanism for "this line is special" and is widely unused.**
SLF4J markers classify orthogonally to level and logger name, which is exactly the shape of the
audit/application distinction. Most teams reach for a naming convention in the message instead,
which no appender can filter on reliably.

**★ Masking config and the application's own serialiser configuration drift apart.**
A field added to a DTO is covered by neither until someone updates both. The systematic fix is a
test that asserts a known sensitive field never appears in rendered output —
[13 · Testing your logging](13-testing-your-logging.md).

## Interview questions

**★ You have masking in the log aggregator. What still needs to be done in the application, and
why?**
Everything that matters, because aggregator masking cannot undo a write. By the time the
aggregator applies a rule the plaintext has already existed in a file on the application's disk,
in the shipper's buffer and possibly in a snapshot — which is exactly the set of locations a
breach investigation examines. So the application still owes two layers: exclusion in the code, so
the value is never rendered at all — a `toString()` override, an exclusion annotation, a field
marked on the logging serialiser — and masking in the appender or encoder, which is the net for
everything nobody annotated, including third-party libraries logging your data. The aggregator
layer is worth configuring as defence in depth and is worthless as assurance, and the important
part of that sentence is the second half, because the failure mode is cultural: once people
believe the pipeline handles it, review stops catching the lines that produce it.

**★ Why is an audit log not just an application log with a filter on it?**
Because nearly every requirement differs. An application log tolerates loss — sampling, discarding
under pressure and rotation are all normal, and Logback's async appender will silently drop events
by design. An audit log tolerates none: a missing event is indistinguishable from the action not
happening, which is the entire question an audit answers. Retention differs by orders of magnitude
and for different reasons — cost versus regulation. Mutability differs: application logs are
rotated and deleted, audit logs must be append-only and ideally tamper-evident. The content
differs, because an audit event is a fixed schema with required fields rather than whatever helped
someone debug something. And level filtering, which is central to application logging, is
meaningless for audit — an audit event is not "INFO", and routing it by level means a level change
can silence the trail. The practical conclusion is that audit events belong in a store where
writing the event is part of the operation succeeding, not a side effect that a queue may discard.

**★ What has to be true to ship both through one pipeline?**
Three things, and they are usually assumed rather than verified. First, audit events must be
unambiguously identifiable — a dedicated logger name or an SLF4J marker, not a convention in the
message text, because appenders and retention rules need something they can filter on
mechanically. Second, that subset has to be routed to a synchronous, non-discarding appender, so
the delivery guarantee exists even though everything else in the pipeline is best-effort; sharing
the aggregator afterwards is fine, sharing the async queue is not. Third, retention has to be
configurable per subset, so audit events keep years while debug output keeps days — otherwise you
choose between under-retaining the audit trail and over-retaining personal data, and both are
findings. If any of the three is missing, you have an application log that somebody will
nonetheless present as an audit trail during an investigation, and the first question will be
whether events could have been dropped.

**★ Design the masking layer for a service handling payments. Where does each piece live?**
In the code first, because it is exact and free: the classes carrying card data get explicit
`toString()` implementations that emit the last four digits and the scheme and nothing else, and
the logging serialiser is configured to exclude those fields — separately from the API serialiser,
since they are different configurations and assuming otherwise is the classic mistake. Then a
masking converter or encoder filter as the net, targeting named fields rather than free text,
which is a direct argument for structured JSON output: a rule for a field called `pan` is exact
where a regex for digit sequences will both miss and over-match. Partial rather than full masking
throughout, because it preserves the ability to correlate and removes the temptation to disable
the mask during an investigation. Then a test that asserts a known card number never appears in
rendered log output, so the coverage does not silently lapse when a field is added. And separately
from all of it, the audit events — authorisation attempted, outcome, amount, merchant, actor — into
a store with a transaction, not into the log pipeline, because PCI's retention expectations and
the log's discard behaviour are incompatible.

**★ Which audit events do teams most often miss, and why does it matter?**
Failures — failed logins, denied authorisations, rejected permission checks — and the reason is
structural rather than careless: the code path that rejects a request returns early, often from a
framework filter or a guard clause, before reaching any code that records anything. The successful
path is the one somebody instrumented because it is the one they were building. It matters because
an investigation is almost always looking for the failures: a sequence of denied attempts is the
signature of an attack, an insider probing boundaries, or a misconfigured integration, and its
absence from the trail is indistinguishable from nothing having happened. The second most-missed
category is administrative and out-of-band actions — a support engineer using an internal tool, a
migration script run by hand, a break-glass credential — precisely the actions where the audit
trail is most valuable and least likely to have been designed in.

**★ Why do people end up disabling masking during an incident, and how do you design against it?**
Because full redaction destroys the ability to distinguish cases. If every card number renders as
`****`, an engineer trying to work out whether two failing requests involved the same card cannot
tell, so someone reaches for the configuration and turns the mask off to see — usually under time
pressure, usually in production, and usually without turning it back on, which is exactly the
failure mode from [08](08-what-never-to-log.md) about temporary DEBUG. The design answer is
partial masking: keep a deterministic, non-reversible discriminator — the last four digits, a
truncated hash prefix, a token's `jti` — so the correlating question can be answered without the
value. That removes the motive rather than relying on discipline. The general principle is worth
stating: a control that blocks legitimate work will be circumvented by people doing legitimate
work, so the useful version is the one that leaves the debugging path intact.

{/* FOOTER */}
