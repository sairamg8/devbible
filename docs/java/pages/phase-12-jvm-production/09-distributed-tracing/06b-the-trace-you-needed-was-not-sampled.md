---
title: "Tail sampling buffers completed traces at the collector layer to guarantee retention of rare 500 errors and p99 latency spikes that probabilistic head sampling inevitably drops"
sidebar_label: "06b · Tail sampling"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-03 against the **OpenTelemetry Collector Contrib `tail_sampling` processor documentation** ([github.com/open-telemetry/opentelemetry-collector-contrib](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/tailsamplingprocessor)); the **OpenTelemetry Load-Balancing Exporter specification**; and production telemetry topology patterns.
> Target: **JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8 · OpenTelemetry Collector Contrib 0.120+**.
> 🔴 **No sandbox run** — pipeline topologies, configuration parameters, and memory formulas verified against OpenTelemetry Collector components.

**The fundamental tragedy of head sampling is that it makes its decision when it knows the least. At the instant a request hits your ingress gateway, the head sampler rolls a ten-sided die and decides to drop 90% of requests. Five hundred milliseconds later, when that request crashes with a `NullPointerException` on hop seven or stalls for nine seconds in a database lock acquisition, it is too late: the trace was discarded at the front door. You receive a PagerDuty alert for an error spike, open your tracing backend, and find nothing. Tail sampling reverses this architecture: applications transmit telemetry to an OpenTelemetry Collector fleet that buffers full traces in memory and decides what to keep only after the request has finished.**

## The architectural inversion

```
Head Sampling Architecture:
App SDK (Drop 90% in-process) ──[10% kept spans]──> Collector ──> Storage

Tail Sampling Architecture:
App SDK (Send 100% of spans)  ──[100% spans]──> OTel Collector Fleet
                                                   │
                                            [Buffer 10-30s in RAM]
                                                   │
                                          Evaluate Tail Rules:
                                          - Error == true? -> KEEP 100%
                                          - Duration > 1s? -> KEEP 100%
                                          - HTTP 200 OK?   -> KEEP 1%
                                                   │
                                                   ▼
                                        [Exported to Tempo/Jaeger]
```

## How tail sampling works in the OpenTelemetry Collector

Applications do not perform tail sampling in-process because individual services only see their local spans—Service A cannot know whether downstream Service F will fail. Tail sampling lives inside the **OpenTelemetry Collector** using the `tail_sampling` processor.

The collector groups incoming spans by `trace_id` in an in-memory buffer. It waits for a configurable period (`decision_wait`) to allow all asynchronous and multi-service child spans to arrive, evaluates a chain of rule-based policies, and either flushes the complete trace to storage or discards it.

### Representative `tail_sampling` configuration

```yaml
processors:
  # 🔴 Always place memory_limiter before tail_sampling to prevent OOM
  memory_limiter:
    check_interval: 1s
    limit_percentage: 75
    spike_limit_percentage: 20

  tail_sampling:
    decision_wait: 10s
    num_traces: 100000
    expected_new_traces_per_sec: 2500
    policies:
      # Rule 1: Always retain any trace containing a span error
      - name: errors-policy
        type: status_code
        status_code: { status_codes: [ ERROR ] }

      # Rule 2: Always retain slow traces (p99 latency investigations)
      - name: latency-policy
        type: latency
        latency: { threshold_ms: 1500 }

      # Rule 3: Always retain HTTP 5xx responses
      - name: http-5xx-policy
        type: numeric_attribute
        numeric_attribute:
          key: http.response.status_code
          min_value: 500
          max_value: 599

      # Rule 4: Discard high-frequency health checks completely
      - name: drop-healthchecks
        type: string_attribute
        string_attribute:
          key: url.path
          values: [ "/actuator/health", "/livez", "/readyz" ]
          enabled_regex_matching: false
          invert_match: true

      # Rule 5: Probabilistically keep 2% of successful requests for baseline metrics
      - name: probabilistic-success
        type: probabilistic
        probabilistic: { sampling_percentage: 2.0 }
```

## 🔴 The two non-negotiable costs of tail sampling

Tail sampling gives you 100% error and outlier coverage, but shifts significant architectural complexity onto your infrastructure.

### 1. The Trace-ID routing requirement (Load-Balancing Exporter)
For tail sampling to work, **every span belonging to a given `trace_id` must arrive at the exact same collector instance**.

If Service A sends its root span to Collector 1, and Service B sends its child span to Collector 2:
- Collector 1 evaluates its partial trace (status: OK) and discards it.
- Collector 2 evaluates its partial span (status: ERROR) and keeps it.
- The resulting trace in your APM backend is missing its root span, resulting in broken waterfalls.

**The Solution:** You must deploy a two-tier collector topology. Tier 1 collectors run the `loadbalancing` exporter, which hashes the `trace_id` to route all spans for that trace to the identical Tier 2 tail-sampling collector replica:

```
App Fleet ──> Tier 1 OTel Collectors (Router with loadbalancing exporter)
                    │
           [Consistent Hash on TraceId]
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
 Tier 2 Collector A    Tier 2 Collector B
 (Holds Trace 0x4b...)  (Holds Trace 0x00...)
```

### 2. Collector memory sizing
A collector running tail sampling must hold thousands of active traces in RAM. The memory formula is:

$$\text{RAM Required} = \text{Traces per second} \times \text{Average spans per trace} \times \text{Bytes per span} \times \text{decision\_wait (sec)} \times 1.5$$

If your system processes 5,000 requests/sec with 10 spans per trace at 2 KB per span, a 10-second `decision_wait` requires:
$$5{,}000 \times 10 \times 2{,}048 \times 10 \times 1.5 \approx 1.53\text{ GB RAM}$$
During traffic spikes, collector memory will surge, which is why the `memory_limiter` processor is mandatory.

## Gotchas

### Traces rendered with missing parents in tail-sampled clusters
**Symptom.** Spans showing errors are captured, but the upstream HTTP controller spans that invoked them are missing from the trace tree.  
**Cause.** Applications sent spans to a Kubernetes service load-balanced across multiple collector pods using round-robin DNS. Different spans of the same trace landed on different collectors.  
**Fix.** Deploy a routing tier configured with OpenTelemetry's `loadbalancingexporter` keyed by `trace_id`.

### OpenTelemetry Collector crashing with OutOfMemoryError
**Symptom.** Tail-sampling collector pods enter `CrashLoopBackOff` during load tests or flash sales.  
**Cause.** `decision_wait` was set to 30 seconds with no memory governor. Surging request volume exhausted container cgroup limits.  
**Fix.** Lower `decision_wait` to 5–10 seconds, configure `memory_limiter` as the very first processor in the pipeline, and set container memory limits with at least 50% headroom.

### Late-arriving asynchronous spans dropped
**Symptom.** Kafka consumer spans that process 15 seconds after an order is submitted show up in APM as orphaned traces without their producer parent.  
**Cause.** `decision_wait` expired at 10 seconds; the collector made its decision and cleared the trace buffer before the slow async consumer span arrived.  
**Fix.** For long-delayed async workflows, link spans using OpenTelemetry Span Links instead of parent-child spans, or use hybrid sampling.

## Interview questions

**★ Why does probabilistic head sampling fail to capture critical production bugs?**  
Probabilistic head sampling makes decisions uniformly at random when the request starts. If an incident affects a tiny fraction of traffic (e.g. a bug triggered on 0.01% of requests), a 10% head sample rate drops 90% of those failure cases. If only three requests fail during an incident, there is a $(0.90)^3 \approx 73\%$ probability that all three failure traces are discarded, leaving on-call engineers with zero diagnostic telemetry.

**★ Why does tail sampling require a load-balancing exporter tier in clustered deployments?**  
Tail sampling policies (such as "keep any trace with status = ERROR") require evaluating the entire trace tree. If individual spans of a trace are distributed across multiple collector instances via standard round-robin load balancing, no single collector instance has the complete set of spans to make an accurate decision. An initial routing tier with a `loadbalancingexporter` hashes the 128-bit `trace-id` to guarantee that all spans for that trace converge on the identical collector node.

**★ What is the trade-off between `decision_wait` length and collector resource usage?**  
`decision_wait` determines how long the collector buffers spans before evaluating policies. A longer wait (e.g. 30s) ensures that slow asynchronous operations and long-running database queries are captured before the decision is locked. However, doubling `decision_wait` doubles the number of active traces held in collector memory, drastically increasing RAM requirements and risking OOM failures under heavy traffic spikes.

**★ What happens if a trace's spans arrive after `decision_wait` has expired?**  
When `decision_wait` expires, the collector evaluates its policies, exports or drops the buffered spans, and removes the trace ID from its cache. Any span arriving after this window is treated as an entirely new trace fragment with no memory of prior parent decisions, often resulting in fragmented, un-joined spans in downstream APM storage.

---

← [06 · Sampling](06-sampling.md) · **Topic index** *(not written yet)* · Next → **08 · Cost and overhead** *(not written yet)*
