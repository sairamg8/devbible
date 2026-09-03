---
title: "traceparent is fifty-five characters in four dash-separated fields, and the three things people get wrong about it — which field is the caller's span, why the flags byte must be masked, and why the sampled bit is a recommendation rather than an order — are all answered in the specification's own words"
sidebar_label: "03b · The traceparent header"
sidebar_position: 5
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-02 against the **W3C Trace Context Recommendation (Level 1, 23 November
> 2021)** — section 3.2 *Traceparent Header* ([w3.org](https://www.w3.org/TR/trace-context/));
> the **W3C Trace Context Level 2** draft for the random-trace-id flag
> ([w3.org](https://www.w3.org/TR/trace-context-2/)); and the **OpenTelemetry Trace SDK
> specification**, *Span flags* ([opentelemetry.io](https://opentelemetry.io/docs/specs/otel/trace/sdk/)).
> 🔴 **No sandbox** — every header value below is the specification's own example. JDK 25 ·
> Spring Boot 4.1.0 / Spring Framework 7.0.8 · Micrometer Tracing 1.7.0 · OpenTelemetry Java 1.62.0.

**The whole of wire propagation for a trace is one HTTP header of fixed length. That is its
virtue: fast to parse, impossible to half-send, and identical across every vendor. It is also why
people stop reading after the example and get three things wrong — they call the third field
"span id" when the spec calls it `parent-id`, they compare the flags byte with `==` instead of
masking it, and they treat the sampled bit as an instruction. This page is the header, field by
field. [03b2](03b2-traceparent-mutations-and-processing.md) is what a receiver is allowed to do
with it.**

## The shape

The specification's own example:

```text
traceparent: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01
```

Its grammar, quoted:

> *"`value           = version "-" version-format`"*
> *"`version         = 2HEXDIGLC   ; this document assumes version 00. Version ff is forbidden`"*
> *"`version-format   = trace-id "-" parent-id "-" trace-flags`"*
> *"`trace-id         = 32HEXDIGLC  ; 16 bytes array identifier. All zeroes forbidden`"*
> *"`parent-id        = 16HEXDIGLC  ; 8 bytes array identifier. All zeroes forbidden`"*
> *"`trace-flags      = 2HEXDIGLC   ; 8 bit flags. Currently, only one bit is used.`"*

And `HEXDIGLC` is *"lowercase hex character"* — uppercase is invalid. Four fields, three dashes:
2 + 1 + 32 + 1 + 16 + 1 + 2 = **55 characters**, always, for version `00`.

The specification also fixes where a parser looks, which is worth having in your head when a
header is rejected:

> *"Parse `trace-id` (from the first dash through the next 32 characters). Vendors MUST check that
> the 32 characters are hex, and that they are followed by a dash (`-`). Parse `parent-id` (from
> the second dash at the 35th position through the next 16 characters). Vendors MUST check that
> the 16 characters are hex and followed by a dash. Parse the `sampled` bit of `flags` (2
> characters from the third dash). Vendors MUST check that the 2 characters are either the end of
> the string or a dash."*

*"Either the end of the string or a dash"* is the forward-compatibility hook: the specification
states that future versions *"will be additive to the current one"*, so a later version may append
fields after another dash, and a version-`00` parser must tolerate them.

## Field 3 is called `parent-id`, and the name is the point

The third field holds the **span id of the caller's current span** — the span that will be the
parent of whatever the receiver creates. The specification does not call it "span id" because,
from the receiver's point of view, it is not the receiver's span; it is the id the receiver's new
span must point at. The processing model makes the receiver's obligation explicit:

> *"Update `parent-id`: The value of property `parent-id` MUST be set to a value representing the
> ID of the current operation."*

So the header is rewritten at every participating hop. Service A sends `parent-id = A's span`;
service B extracts it, creates its own span with that parent, and when B calls C it sends
`parent-id = B's span`. The `trace-id` is the only field that survives the whole journey
unchanged — which is exactly why it is the grouping key at the backend, and why the receiver of a
header knows only its immediate caller, never the origin.

## `trace-flags` is a bitfield, and the mask is not optional

> *"Like other fields, `trace-flags` is hex-encoded. For example, all `8` flags set would be `ff`
> and no flags set would be `00`. As this is a bit field, you cannot interpret flags by decoding the
> hex value and looking at the resulting number. For example, a flag `00000001` could be encoded as
> `01` in hex, or `09` in hex if present with the flag `00001000`. A common mistake in bit fields is
> forgetting to mask when interpreting flags."*

The specification's own Java for reading it:

```java
static final byte FLAG_SAMPLED = 1; // 00000001
// ...
boolean sampled = (traceFlags & FLAG_SAMPLED) == FLAG_SAMPLED;
```

This stopped being theoretical when Level 2 assigned the second bit. From the Level 2 draft:

> *"The second least significant bit of the trace-flags field denotes the `random-trace-id` flag.
> … If that flag is set, at least the right-most 7 bytes of the `trace-id` MUST be selected randomly
> (or pseudo-randomly) with uniform distribution over the interval [0..2^56-1]."*
>
> *"For example, both `01` (`00000001`) and `03` (`00000011`) represent that the trace has been
> sampled because the sampled flag (`00000001`) is set, and `03` and `02` (`00000010`) both represent
> that at least the right-most 7 bytes of the `trace-id` are randomly (or pseudo-randomly)
> generated"*

Any code that tested `flags == "01"` for "sampled" silently reports every `03` trace as unsampled.
The OpenTelemetry SDK specification reserves room for exactly this: *"Bits 0-7 (8 least significant
bits) of the Span Flags field are reserved for the 8 bits of Trace Context flags, specified in the
W3C Trace Context Level 2 Candidate Recommendation."*

Why a *random* flag matters to a tracing pipeline: probability samplers hash the trace id
([06](06-sampling.md)), and a hash of a non-random id is not a fair coin. The flag lets a
downstream sampler know whether the id it is about to hash was generated the way the sampling
maths assumes.

## The sampled flag is a recommendation, and the spec says why

> *"An 8-bit field that controls tracing flags such as sampling, trace level, etc. These flags are
> recommendations given by the caller rather than strict rules to follow for three reasons: Trust
> and abuse · Bug in the caller · Different load between caller service and callee service might
> force callee to downsample."*

And the precise semantics of the one flag defined in version `00`:

> *"When set, the least significant bit (right-most), denotes that the caller may have recorded
> trace data. When unset, the caller did not record trace data out-of-band."*

Read that asymmetry carefully. **Set means "may have recorded"; unset means "did not."** A `1` is
not a promise that the caller's spans exist — the caller's exporter may still drop them. A `0` is
a statement of fact. That is why a downstream `ParentBased` sampler ([06](06-sampling.md)) treats
`0` as decisive and `1` as "follow the parent unless configured otherwise".

The specification's guidance for a participant, all `SHOULD`:

> *"If a component made definitive recording decision - this decision SHOULD be reflected in the
> `sampled` flag. If a component needs to make a recording decision - it SHOULD respect the
> `sampled` flag value. … If a component deferred or delayed the decision and only a subset of
> telemetry will be recorded, the `sampled` flag should be propagated unchanged. It should be set to
> `0` as the default option when the trace is initiated by this component."*

That last sentence is the one tail-sampling deployments trip over: a service that defers its
decision to a collector ([06b](06b-the-trace-you-needed-was-not-sampled.md)) is told to start new
traces with `sampled = 0`, and every downstream `ParentBased` sampler will then honour that zero.
The deferred design has to be fleet-wide or it silently drops the downstream half.

## Gotchas

**★ The third field is the caller's span id, not "the span id".** The spec names it `parent-id`
for that reason. A receiver that copies it into its own span's id — which B3 implementations
historically did on purpose (shared span ids; see [03d](03d-b3-and-the-other-formats.md)) — is
producing a different tree than W3C tooling expects.

**★ Comparing `trace-flags` as a number breaks the day the second bit is used.** Level 2 assigns
bit 2 as `random-trace-id`; a sampled trace with a random id is `03`. Only a masked test
(`flags & 0x01`) reads that correctly. This is the spec's own worked example of *"forgetting to
mask"*.

**★ All-zero ids are forbidden.** Both `trace-id` and `parent-id` say *"All zeroes forbidden"*. A
placeholder id written by a test fixture, or a zero-initialised buffer in a native client, is an
invalid header rather than a root marker — and an invalid header starts a new trace
([03b2](03b2-traceparent-mutations-and-processing.md)).

**★ The header is rewritten at every participating hop, so "which service sent this?" is answered
by `parent-id`, not by the header's presence.** The receiver of a header knows only its immediate
caller's span, never the origin. The trace id is the only end-to-end constant.

**★ Sampled `= 1` means "may have recorded", not "did record".** The spec is explicit about the
asymmetry. A downstream that sees `1` and records, while the upstream's exporter dropped its spans,
produces a trace with a missing root. That is a cost-and-overhead symptom
([08](08-cost-and-overhead.md)), not a propagation bug.

**★ Deferred (tail) sampling is told to start traces with `sampled = 0`.** *"It should be set to `0`
as the default option when the trace is initiated by this component."* Every `ParentBased` sampler
downstream will then drop. A mixed fleet — some services deferring, some head-sampling on the
parent flag — loses the downstream half of exactly the traces the tail sampler wanted.

**★ Version `ff` is forbidden and `00` is the only version anyone emits.** A header whose version
field is anything else is either invalid or from the future; the receiver's obligations for both
cases are in [03b2](03b2-traceparent-mutations-and-processing.md), and neither of them is "raise
an error".

## Interview questions

**★ Walk through the four fields of a `traceparent` header and their sizes.**
Version (2 lowercase hex characters; `00` today, `ff` forbidden), then a dash, then the trace id
(32 lowercase hex characters encoding 16 bytes, all-zero forbidden), then the parent id (16
lowercase hex encoding 8 bytes, all-zero forbidden — the span id of the caller's current span),
then the trace flags (2 hex characters encoding an 8-bit field, of which version `00` defines only
the least-significant `sampled` bit). Fifty-five characters in total for version `00`, always.

**★ Why is the third field called `parent-id` rather than `span-id`?**
Because it is described from the receiver's perspective: it is the id the receiver's new span must
record as its parent. It is the caller's current span id, and the processing model requires every
participating hop to overwrite it with its own span id before forwarding. Calling it "span id"
invites the B3-style mistake of reusing it as the receiver's own id.

**★ Is the sampled flag an instruction to the receiver?**
No. The specification calls the flags *"recommendations given by the caller rather than strict
rules"* and gives three reasons — trust and abuse, a bug in the caller, and load differences that
may force the callee to downsample. A `1` means the caller *may* have recorded; a `0` means it did
not. `ParentBased` samplers choose to follow it because a coherent trace requires everyone to make
the same decision, not because the header commands it.

**★ A header arrives with flags `03`. What do you know?**
Two things, because two bits are set. Bit 1 (`0x01`) is `sampled`: the caller may have recorded
this trace. Bit 2 (`0x02`) is Level 2's `random-trace-id`: at least the right-most seven bytes of
the trace id were generated uniformly at random, so a hash-based probability sampler can trust the
id as a fair input. Code that compared the whole byte to `01` would have concluded, wrongly, that
this trace was not sampled.

**★ Why does the spec say "the 2 characters are either the end of the string or a dash" when
parsing flags?**
Forward compatibility. The specification states that future versions *"will be additive to the
current one"* — a later version may append more dash-separated fields. A version-`00` parser must
therefore accept a dash after the flags and ignore what follows, rather than rejecting the header
as too long.

---

← [03 · Context propagation](03-context-propagation.md) · [Topic index](README.md) · Next → [03b2 · Mutations and processing](03b2-traceparent-mutations-and-processing.md)
