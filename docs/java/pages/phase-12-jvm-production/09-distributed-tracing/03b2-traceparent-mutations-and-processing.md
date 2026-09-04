---
title: "A receiver may do exactly four things to a traceparent and nothing else, a header it cannot parse produces a new trace rather than an error, and Spring Boot 4.1 emits only W3C while accepting B3 too — all of which is invisible until the day a proxy uppercases a header or a test asserts propagation that was never switched on"
sidebar_label: "03b2 · Mutations and processing"
sidebar_position: 6
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-02 against the **W3C Trace Context Recommendation (Level 1, 23 November
> 2021)** — sections 3.3.3 *tracestate versioning*, 3.4 *Mutating the traceparent Field* and 4
> *Processing Model* ([w3.org](https://www.w3.org/TR/trace-context/)); the **Spring Boot 4.1
> reference** — the *Tracing* chapter, the *Testing → Using Tracing* section and the
> `management.tracing.propagation.*` / `management.tracing.export.enabled` entries of the
> application-properties appendix
> ([docs.spring.io](https://docs.spring.io/spring-boot/4.1/reference/actuator/tracing.html)); and
> the **Spring Boot 4.1.1 source** for `TracingProperties`, `OpenTelemetryPropagationConfigurations`
> and `OnEnabledTracingExportCondition`
> ([github.com](https://github.com/spring-projects/spring-boot/tree/v4.1.0/module/spring-boot-micrometer-tracing-opentelemetry)).
> 🔴 **No sandbox** — the test below was written, not run. JDK 25 · Spring Boot 4.1.1 / Spring
> Framework 7.0.9 · Micrometer Tracing 1.7.0 · OpenTelemetry Java 1.62.0.

**[03b](03b-the-traceparent-header.md) was the header at rest. This page is the header in
motion: what a participant is permitted to change, what a receiver must do when the header is
absent or broken, and what Spring Boot 4.1 actually emits and accepts. The theme is the same as
everywhere else in this topic — none of the failure modes raise an error. A malformed header, an
invisible proxy, a legacy service that only reads B3, a test that never enabled propagation: each
one produces a plausible, shorter trace.**

## The four legal mutations — and no fifth

> *"A vendor receiving a `traceparent` request header MUST send it to outgoing requests. It MAY
> mutate the value of this header before passing it to outgoing requests."*

The permitted mutations, verbatim in summary:

1. **Update `parent-id`** — *"the most typical mutation and should be considered a default."*
2. **Update `sampled`** — *"reflects the caller's recording behavior … This can be indicated by
   toggling the flag in both directions."*
3. **Restart trace** — *"All properties (`trace-id`, `parent-id`, `trace-flags`) are regenerated.
   This mutation is used in services that are defined as a front gate into secure networks and
   eliminates a potential denial-of-service attack surface."*
4. **Downgrade the version** — for a header of a higher version than the receiver understands.

> *"Vendors MUST NOT make any other mutations to the `traceparent` header."*

Mutation 3 is the one to design for deliberately. An edge that restarts the trace on every inbound
request means external callers can never inject a trace id into your system — and it also means a
trace from a browser or a partner *ends* at your edge by design. Both facts are consequences of
the same one-line decision; write it down where the on-call can find it.

A pass-through service is a different thing again:

> *"If the value of the `traceparent` field wasn't changed before propagation, `tracestate` MUST
> NOT be modified as well. Unmodified header propagation is typically implemented in pass-through
> services like proxies."*

**A proxy that forwards the header unchanged is not a participant.** It is invisible in the trace:
no span, no duration, no evidence that it was there. A service mesh that *does* participate
rewrites `parent-id` and appears as a span between A and B. Both behaviours are legal; know which
one your infrastructure does before you read a waterfall and blame the wrong hop for a gap.

## What happens when the header is missing or wrong

The processing model, section 4, is a decision table. Compressed:

- **No `traceparent`** — *"the vendor creates a new `trace-id` and `parent-id` that represents the
  current request."* And: *"If a `tracestate` header is received without an accompanying
  `traceparent` header, it is invalid and MUST be discarded."*
- **Unparseable version** — *"the vendor creates a new `traceparent` header and deletes
  `tracestate`."*
- **Higher version than supported** — *"the vendor uses the format defined in this specification
  (`00`) to parse `trace-id` and `parent-id`"* and ignores unknown flags.
- **Invalid `trace-id`, `parent-id` or `trace-flags`** (non-hex, uppercase, all zeros) — *"the
  vendor creates a new `traceparent` header and deletes `tracestate`."*

Why `tracestate` goes too: *"The version of `tracestate` is defined by the version prefix of
`traceparent` header."* A `tracestate` without a readable `traceparent` has no version and no
meaning.

The uniform consequence: **a malformed header does not produce an error, it produces a new
trace.** From the backend's perspective that is indistinguishable from the caller never having
sent a header at all, which is why [03e](03e-propagation-that-breaks.md) lists "a proxy that
rewrote the header case" alongside "a client that never injected one".

## What Spring Boot 4.1 does with it

Boot's `TracingProperties` fixes the defaults — in the source, `produce = List.of(PropagationType.W3C)`
and `consume = List.of(PropagationType.values())`, which the reference documents as:

> *"`management.tracing.propagation.produce` … Default: `[W3C]`"*
> *"`management.tracing.propagation.consume` … Default: `[W3C, B3, B3_MULTI]`"*
> *"`management.tracing.propagation.type` — Tracing context propagation types produced and consumed
> by the application. Setting this property overrides the more fine-grained propagation type
> properties."*

So a Boot 4.1 service **emits only `traceparent`** and **accepts `traceparent`, single-header `b3`
and the `X-B3-*` set** — the right shape for a fleet that is mid-migration from Zipkin-era formats
([03d](03d-b3-and-the-other-formats.md)). The consume list is deliberately wide and the produce
list deliberately narrow: reading three formats costs a header lookup, writing three costs bytes
on every outbound call forever.

⚠️ **Propagation is gated by the same switch as export.** The property description is *"Whether
auto-configuration of tracing is enabled to export **and propagate** traces."* In the Boot source
the `TextMapPropagator` beans in `OpenTelemetryPropagationConfigurations` carry
`@ConditionalOnEnabledTracingExport`, and `OnEnabledTracingExportCondition` reads
`management.tracing.export.enabled` (falling through to *"tracing is enabled by default"*). Boot's
testing chapter says *"tracing components which are reporting data are not auto-configured when
using `@SpringBootTest`"* and that you *"annotate the test with `@AutoConfigureTracing`"* to get
them — so a test that asserts an outgoing `traceparent` needs that annotation, or it fails for a
reason unrelated to your code.

A CI assertion for the one thing that matters — that an outbound call carries the header:

```java
@SpringBootTest
@AutoConfigureTracing
@AutoConfigureMockRestServiceServer
class OutboundPropagationTest {

    @Autowired MockRestServiceServer server;
    @Autowired InventoryClient inventoryClient;   // built from the auto-configured RestClient.Builder

    @Test
    void outboundCallCarriesTraceparent() {
        server.expect(requestTo("http://inventory/stock/42"))
              .andExpect(header("traceparent",
                      matchesPattern("^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$")))
              .andRespond(withSuccess());

        inventoryClient.stock("42");
        server.verify();
    }
}
```

The pattern encodes the grammar: version `00`, 32 lowercase hex, 16 lowercase hex, two hex flag
characters. It deliberately does not pin the flags to `01`, because under Boot's default 10 %
sampling most test requests are *not* sampled and the header is still required to be present.
That last point is the specification's, not Boot's: *"Every tracing tool MUST properly set
`traceparent` even when it only relies on vendor-specific information in `tracestate`."*

## Gotchas

**★ Uppercase hex is invalid, and the spec says to discard the header.** `HEXDIGLC` is lowercase
only. A gateway that "normalises" header values to uppercase, or a hand-rolled client that used
`String.toUpperCase()` on a UUID, produces a header every compliant receiver must ignore — which
starts a new trace, silently, at every service behind the gateway.

**★ A missing `traceparent` invalidates `tracestate`.** *"If a `tracestate` header is received
without an accompanying `traceparent` header, it is invalid and MUST be discarded."* Forwarding
`tracestate` on its own — a common outcome of an allow-list that names one header but not the
other — achieves nothing.

**★ A pass-through proxy is invisible; a participating one is a span.** Both are legal under the
mutation rules. A 200 ms gap between a client span and its server span may be a mesh sidecar that
did not participate; a mysterious extra span between them is one that did.

**★ Restarting the trace at the edge is a security decision with an observability cost.** It
closes the DoS surface the spec names — an outsider forcing `sampled = 1` on every request — and it
guarantees no browser, mobile or partner trace ever crosses your boundary. Decide which you want
and document it; the default behaviour of most ingress controllers is to forward, not restart.

**★ Boot produces W3C only, by default.** `produce = [W3C]`, `consume = [W3C, B3, B3_MULTI]`. A Boot
4.1 service calling a legacy Zipkin-era service that only reads `X-B3-*` breaks the trace unless
`management.tracing.propagation.produce` is widened.

**★ Under `@SpringBootTest` propagation is off unless you ask.** The propagator beans are
conditional on tracing export being enabled, which Boot's test support disables; add
`@AutoConfigureTracing` before trusting a header assertion in either direction. A test that
"proves" a client does not leak `traceparent` to a third party passes for the wrong reason without
it.

**★ `management.tracing.propagation.type` silently overrides `produce` and `consume`.** The
reference says so in one clause. A team that sets `type=B3` to talk to a legacy service has just
also stopped *consuming* W3C from everyone else.

## Interview questions

**★ A gateway uppercases header values. What happens to traces?**
Every service behind it receives an invalid `traceparent` — the grammar is lowercase-only — and the
processing model says the receiver must create a new `traceparent` and delete `tracestate`. No
error is raised; each service behind the gateway starts a fresh trace, and the backend shows one
trace per hop instead of one trace per request.

**★ What are the only mutations a participant may make to `traceparent`?**
Update `parent-id` (the default), update the `sampled` flag in either direction, restart the trace
entirely (regenerating all three fields — used at a trust boundary to close a denial-of-service
surface), or downgrade the version of a header newer than the receiver understands. *"Vendors MUST
NOT make any other mutations."* In particular, nothing may alter `trace-id` short of a full restart.

**★ Why must a receiver that cannot parse the version also delete `tracestate`?**
Because `tracestate` has no version of its own — the specification says its version *"is defined
by the version prefix of `traceparent` header"*. Once the `traceparent` is unreadable there is no
way to know what the `tracestate` entries mean, so forwarding them would attach vendor data of an
unknown format to a brand-new trace. The rule is the same for a `tracestate` that arrives alone.

**★ Your Boot 4.1 service calls an older service that only understands `X-B3-*` headers. What
breaks and what is the fix?**
Boot's default is `management.tracing.propagation.produce=[W3C]`, so the outgoing request carries
`traceparent` only; the legacy service sees no B3 headers and starts a new trace. Boot *consumes*
W3C, B3 and B3 multi by default, so the reverse direction works. The fix is to widen `produce` to
include `B3_MULTI` (or `B3`) for as long as the legacy service exists — not to set `type`, which
would also narrow what you consume — and to remove it afterwards so you are not paying for three
headers forever.

**★ Why would a service deliberately restart the trace at the edge, and what does it cost?**
Because an externally supplied header is untrusted input: a caller could force `sampled = 1` on
every request to inflate your tracing cost, or forge trace-id collisions to pollute your backend.
The spec names this as the reason for the "restart trace" mutation. The cost is that no trace can
span the boundary — a browser, mobile or partner trace ends at your edge — so end-to-end tracing
across that boundary needs a different mechanism, such as logging the inbound id as an attribute.

**★ A test asserts that an outbound request carries `traceparent`, and it fails under
`@SpringBootTest`. Is the client broken?**
Not necessarily. Boot's test support does not auto-configure the tracing components that report
data, and the propagator beans share that condition (`@ConditionalOnEnabledTracingExport`). Add
`@AutoConfigureTracing` and re-run; if it still fails, the client was built without the
auto-configured builder and [03](03-context-propagation.md) applies. The order matters — a team
that skipped the annotation and "fixed" a working client has done real damage.

---

← [03b · The traceparent header](03b-the-traceparent-header.md) · [Topic index](README.md) · Next → [03c · tracestate and baggage](03c-tracestate-and-baggage.md)
