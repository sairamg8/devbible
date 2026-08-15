---
title: "Writing logs a machine can read"
sidebar_label: "02 · Writing logs a machine can read"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [Docker — configure logging drivers](https://docs.docker.com/engine/logging/configure/),
> [docker container logs](https://docs.docker.com/reference/cli/docker/container/logs/),
> [Dockerfile `LABEL`](https://docs.docker.com/reference/dockerfile/#label),
> the [OCI image-spec annotations](https://github.com/opencontainers/image-spec/blob/main/annotations.md)
> and [podman-logs(1)](https://docs.podman.io/en/latest/markdown/podman-logs.1.html).
> **No sandbox** — no console output on this page.

**The container log pipeline is line-oriented, and every log line will eventually
be read by a machine before a human sees it.** That single fact settles the
format argument, the multi-line-stack-trace problem, and most of what belongs in
a record.

## One event, one line, one JSON object

```
{"ts":"2026-08-15T09:14:02.117Z","level":"error","msg":"order failed","orderId":"o_8812","userId":"u_44","reqId":"c1f2…","durMs":412,"err":"payment_declined"}
```

Not because JSON is elegant, but because of what the pipeline does with it:

- **The driver splits on newlines.** Anything spanning several lines becomes
  several unrelated events, in an order that is not guaranteed once several
  containers interleave.
- **The aggregator indexes fields, not prose.** `level:error AND
  orderId:o_8812` is a query; `grep` over free text on a host you first have to
  find is not.
- **Correlation is the point.** A request id carried on every line is what turns
  eleven services' logs into one story. Nothing else recovers that after the
  fact.

Human-readable pretty printing belongs in development, selected by environment,
never by rebuilding the image.

### The multi-line problem

A stack trace is the most valuable log you will ever emit and the worst-behaved.
Three options, in order of preference:

1. **Serialise it into the record** — `"stack":"Error: …\n    at …"` — so the
   newlines are escaped inside one JSON line. One event, intact.
2. **Let the aggregator join lines** with a multi-line rule. This works and it is
   fragile: the rule is a regex in a system nobody edits confidently.
3. **Leave it raw.** The trace arrives as twenty separate events, and interleaved
   with another container's output it may be unreadable.

Every serious logging library does option 1 for you. That is most of the argument
for using one instead of `console.log`.

## What belongs in a record

| Field | Why |
|---|---|
| `ts` | ISO-8601 with a timezone — see the warning below |
| `level` | Severity as data, **not** as a choice of stream |
| `msg` | Short, stable, and **not** interpolated with values |
| ids (`reqId`, `traceId`, `userId`, `orderId`) | The only way to reconstruct a request |
| `durMs`, `status` | What turns logs into cheap metrics |
| `err` / `stack` | Serialised, never a bare `Error` object |

⚠️ **Keep `msg` constant and put the variables in fields.** `"order failed"` with
an `orderId` field groups; `"order o_8812 failed"` produces one distinct message
per order and destroys every aggregation the tool can offer.

⚠️ **Timestamps: emit your own, in UTC with an explicit offset.** The engine can
add one (`docker logs -t`), but that is the *collection* time, not the event
time. A container also defaults to UTC while your host may not, which is the
subject of [15 · Time, timezones and locales](../15-time-and-timezones.md) and a
recurring source of "the logs are an hour out".

### What must never be in a log line

Logs are copied, indexed, retained for months and shipped to third parties. The
container makes this worse in one specific way: `docker logs` output and the
driver's files are readable by anyone with access to the **host**, which is a
wider audience than your database.

- **No secrets.** No tokens, passwords, connection strings, API keys, session
  ids, or `Authorization` headers. Logging the environment at startup — a
  surprisingly common "helpful" debug line — dumps every secret you carefully
  kept out of the image ([Phase 3 — ENV versus ARG](../../phase-3-dockerfile/07-env-vs-arg.md)).
- **No personal data** beyond an identifier you can resolve elsewhere. An id is
  a log field; an email address is a retention and deletion problem.
- **No whole payloads.** Log the id, the size and the outcome. A request body in
  a log line is a secret leak, a PII leak and a disk problem at once.

🔴 **The rule that applies here is the same one from the build:** rotating the
credential is the only real remedy once it is in a log, because the log has
already been copied. Deleting the line does not unship it.

## Volume is a production concern

Log volume is not free: it is disk on the host, bandwidth to the aggregator,
storage cost, and — when the driver blocks — **backpressure into your
application**.

- **Do not log per iteration of a loop.** Log the summary.
- **Sample the high-frequency, low-value events** (successful health checks, cache
  hits) rather than deleting them entirely.
- **Make the level runtime-configurable** — an environment variable, so raising
  detail during an incident does not require a rebuild and a deploy.
- **Health-check output is logged too.** A `HEALTHCHECK` every five seconds that
  prints a line is 17,000 lines a day per container, all of them useless
  ([Phase 3 — HEALTHCHECK](../../phase-3-dockerfile/11-healthcheck.md)).

## Where the container's own identity comes from

You do not need to log the hostname, container id or image tag — the driver
attaches them, and hand-rolled versions are usually wrong after a redeploy.

```bash
docker run --log-opt tag="{{.Name}}/{{.ImageName}}" myimage
docker run --label app=api --label version=1.4.2 myimage
```

Image-level metadata is better still, because it travels with the artefact:
`org.opencontainers.image.revision` and `image.version` set at build time answer
"which commit produced the container that logged this" months later
([Phase 3 — LABEL](../../phase-3-dockerfile/12-label-and-metadata.md)). Phase 12's
tagging discipline is the other half of that answer.

## Logs are not metrics, and not traces

Three failure modes worth naming, because each is a log pipeline being used as
the wrong tool:

- **Counting log lines to get a rate** is expensive and lossy — sampling and
  rotation both silently change the answer. Emit a counter
  ([11 · Observing](../11-observing.md)).
- **Reconstructing a call graph from timestamps** across containers fails the
  moment clocks disagree. That is what a trace id is for.
- **Alerting on a log string** works until someone rewords the message. Alert on
  a field, or on a metric.

Logs answer *what happened in this process, in order, with detail*. That is a
large and useful job, and it is not the other two.

## Podman

Identical at the application level — the record you emit is the record that
lands. With the **journald** default, structure survives differently: the journal
stores fields, so `journalctl -o json` and field filters work, and container
output sits alongside the rest of the machine's logs. Under Quadlet (Phase 11)
`journalctl -u <unit>` becomes the natural reading, which is one fewer
container-specific command for an operator to know.

## Gotchas

**Symptom:** A stack trace arrives as twenty separate log events, interleaved
with other output.
**Cause:** The driver splits on newlines; a multi-line trace is multi-line.
**Fix:** Serialise the trace into a `stack` field in one JSON record. Multi-line
join rules in the aggregator are the fallback, not the plan.

**Symptom:** The aggregator shows tens of thousands of distinct message strings
and no useful grouping.
**Cause:** Values interpolated into `msg`.
**Fix:** Constant `msg`, variables in fields.

**Symptom:** A security review finds tokens in the log archive.
**Cause:** A start-up line that logs configuration or the whole environment, or
an error handler that logs the request including its headers.
**Fix:** Redact at the logger, allow-list what may be logged from a request —
and **rotate every credential that appeared**, because the archive is already
copied.

**Symptom:** Log volume is enormous and dominated by health checks.
**Cause:** A `HEALTHCHECK` on a short interval whose command prints, plus access
logging of the probe endpoint.
**Fix:** Silence the probe path in the access log and keep the check's command
quiet. The check's *result* is what matters, not its output.

## Interview questions

**★ Why structured JSON logs rather than human-readable text?**
Because the pipeline is line-oriented and the first reader is a machine. JSON
gives indexed fields, so `level:error AND orderId:x` is a query rather than a
grep on a host you must first identify; it keeps a stack trace inside one event;
and it lets a request id correlate several services. Pretty output is a
development-time choice, selected by environment.

**★ What should never be in a container log line?**
Secrets, personal data beyond a resolvable id, and whole request or response
payloads. Container logs are readable by anyone with host access and are copied
into systems with long retention — so a leaked credential must be **rotated**,
not deleted, because deleting the line does not unship it.

**★ Why keep the message constant and put values in fields?**
So identical events group. Interpolating an order id into the message creates a
unique message per order, which destroys counting, grouping and alerting — and
alerting on a log string breaks anyway the first time someone rewords it.

**Should the application timestamp its own logs when the engine can add one?**
Yes. The engine's timestamp is collection time, not event time, and the two
diverge exactly when it matters — under buffering, backpressure or a slow
shutdown. Emit ISO-8601 in UTC with an explicit offset; the container's clock
defaults to UTC while the host's may not.

**How do you know which build produced a given log line?**
From metadata attached outside the record: the driver's tag and container labels,
and image labels such as `org.opencontainers.image.revision` set at build time.
Hand-logging a version string inside the application is the version that goes
stale.

**Why not derive metrics by counting log lines?**
Because sampling, rotation and dropped buffers all change the count without
changing the truth, and the query is expensive at volume. Logs record what
happened in order and in detail; a counter is the cheap, correct answer to
"how many".

---

← [01 · The contract](01-the-contract.md) · [Topic index](README.md)
