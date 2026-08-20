---
title: "The conditions report"
sidebar_label: "7 · The conditions report"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Boot reference *Using Spring Boot ·
> Auto-configuration* (the `--debug` switch and the conditions report), the
> `ConditionEvaluationReport` API javadoc (condition outcomes grouped by source,
> exclusions, unconditional classes), and the Actuator API documentation for the
> `conditions` endpoint (the `contexts`, `positiveMatches`, `negativeMatches`,
> `unconditionalClasses` and `parentId` fields, and the `condition`/`message`
> and `notMatched`/`matched` entry shapes). Spring Boot 4.1.0, Spring Framework
> 7.0.x, JDK 25.

**Every question of the form "why is this bean not here" has a mechanical answer
the framework already computed, recorded and will hand over on request. Spring
Boot evaluates every condition into a `ConditionEvaluationReport` on every
startup and keeps it in the context. Reading that report instead of reading
annotations is the single largest productivity difference between someone
fluent in Boot and someone who has been using it for three years by trial and
error.**

## Getting the report

Start the application with `--debug` — or set `debug=true` in
`application.properties`, or `DEBUG=true` in the environment:

```bash
java -jar invoice-service.jar --debug
```

The reference describes exactly what this does: *"enables debug logs for a
selection of core loggers and logs a conditions report to the console."* It is
**not** `--trace`, and it is not the same as raising your own package's log
level — it is a specific Boot switch whose main product is this report.

⚠️ `--debug` here is a Spring Boot **application argument**, not a JVM debug
flag. It has nothing to do with `-agentlib:jdwp` and opens no debugger port. The
name collision costs people real time.

## What the report is made of

The report renders a `ConditionEvaluationReport`, and the Actuator endpoint
exposes the same data under documented field names — which is the precise way to
describe its structure:

| Section | Field at `/actuator/conditions` | Contains |
|---|---|---|
| Positive matches | `contexts.*.positiveMatches` | Classes and methods whose conditions **matched**. Each entry carries a `condition` name and a `message` saying why |
| Negative matches | `contexts.*.negativeMatches` | Classes and methods whose conditions **did not match**. Each entry splits into `notMatched` and `matched` lists |
| Unconditional classes | `contexts.*.unconditionalClasses` | Auto-configuration classes with no conditions at all — they always apply |
| Exclusions | reported by `ConditionEvaluationReport` | Classes explicitly excluded from evaluation |

A `parentId` field appears when the context has a parent, which is how you tell
a management context's report from the application's.

### Negative matches are where you look

The `notMatched` / `matched` split is the feature that makes the report usable.
An auto-configuration that satisfied four conditions and failed one shows you
**the one**, by name, with a message. That is how a line reporting that
`OnPropertyCondition` did not find `acme.libx.enabled` replaces an afternoon of
reading someone else's starter.

The mental model to carry: the report is not a log of what went wrong. It is a
complete record of every decision, and the overwhelming majority of negative
matches are correct and uninteresting — libraries you do not have, platforms you
are not on. You are searching it, not reading it.

### Unconditional classes matter more than they look

An auto-configuration listed here has **no guards at all** and therefore always
applies. When something is being configured and you cannot find the condition
that allowed it, this is the section that explains why: there was never a
condition to satisfy.

## The Actuator endpoint

Enabling `--debug` in production is usually unacceptable, because it raises log
levels across core loggers for the life of the process. The same evaluation data
is available as JSON without touching logging:

```yaml
management:
  endpoints:
    web:
      exposure:
        include: conditions
```

That endpoint reveals a great deal about your classpath and configuration —
which libraries you use, which properties are set, which features are off — so
it belongs behind authentication. Exposure and locking the Actuator down is
**[Phase 9 topic 13 — Actuator](../13-actuator/README.md)**.

## The trade-off

The report is complete and therefore enormous: every auto-configuration on the
classpath, evaluated, in one document. That completeness is what makes it
authoritative — nothing is summarised away — and it is also why nobody reads it
top to bottom. Treat it as a queryable artifact rather than a diagnostic
message: capture it to a file, search for the bean type or the property name,
and read the twenty lines around the hit.

## Gotchas

**Symptom:** `--debug` prints a wall of logging and you cannot find the report in it
**Cause:** the report is one section among the debug logging the switch enables, and it is emitted near the end of context refresh rather than at the top
**Fix:** capture and search rather than scroll:
```bash
java -jar app.jar --debug > startup.log 2>&1
```
then search `startup.log` for the bean type or property name. Better still, expose the `conditions` endpoint locally and read structured JSON

**Symptom:** you add `--debug` in production to diagnose a wiring problem and log volume explodes
**Cause:** the switch enables debug logging for a selection of core loggers for the whole process lifetime, not just the one report
**Fix:** use the Actuator endpoint, which yields the same evaluation data without changing any log level:
```yaml
management.endpoints.web.exposure.include: conditions
```

**Symptom:** a bean you expected is absent and appears in neither the positive nor the negative matches
**Cause:** the auto-configuration was never imported at all, so nothing was ever evaluated — its jar is missing, or its registration file is misnamed
**Fix:** confirm the jar is on the classpath and that the path is exactly `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`; then check the exclusions section before assuming a condition failed

**Symptom:** something is clearly being auto-configured but no condition in the report explains it
**Cause:** the class is in `unconditionalClasses` — it has no conditions, so it always applies and there is nothing to match
**Fix:** stop looking for a condition and treat it as always-on; if it must not run, that is an exclusion, covered in [chunk 8](08-excluding-and-writing-your-own.md)

**Symptom:** the report you are reading does not mention the endpoint or metric you are chasing
**Cause:** you are reading the application context's report, and Actuator may run in a separate management context with its own evaluation — distinguishable by `parentId`
**Fix:** check which context each block belongs to before concluding a condition failed; the management context has its own set of matches

**Symptom:** `debug=true` in `application.properties` produces no report, though `--debug` on the command line does
**Cause:** the property is being set in a source that is read *after* the report would be produced, such as a profile-specific document that only activates later in startup
**Fix:** pass it as an environment property so it is available from the very beginning:
```bash
DEBUG=true java -jar app.jar
```

## Interview questions

**★ How do you find out why a bean was not created?**
Start the application with `--debug`, which the reference documents as enabling
debug logs for a selection of core loggers and logging a conditions report to
the console. Read the **negative matches** section: each entry names the class
or method, the conditions that did not match, and the conditions that did — so a
missing property or an absent class is identified by name rather than inferred
by reading annotations. Where enabling debug logging is unacceptable, the
`conditions` Actuator endpoint exposes the same `ConditionEvaluationReport` data
as JSON.

**★ What are the sections of the conditions report, and which do you read first?**
Positive matches, negative matches, unconditional classes, and exclusions.
Negative matches almost always — that is where a bean you expected went. The
detail that makes it usable is that each negative entry separates the conditions
that `notMatched` from those that `matched`, so an auto-configuration which
satisfied four guards and failed one shows you the one that vetoed it, with a
message, instead of leaving you to work out which of five was responsible.

**★ What does the "unconditional classes" section tell you?**
That those auto-configuration classes carry no conditions at all and therefore
always apply. It is the answer to the opposite question from the usual one — not
"why is this bean missing" but "why is this being configured when I cannot find
a condition that allowed it". There was never a condition to satisfy, so the
only way to stop it is an explicit exclusion.

**★ Does `--debug` attach a debugger?**
No. It is a Spring Boot application argument consumed by `SpringApplication`,
unrelated to the JVM's `-agentlib:jdwp` machinery, and it opens no port. It
enables debug logging on a selection of core loggers and emits the conditions
report. The name collision causes genuine confusion, and it is one more reason
to prefer the `conditions` Actuator endpoint when the report is all you want.

**★ Why not just leave `--debug` on in production?**
Because it is not a report switch, it is a logging switch: it raises levels
across a selection of core loggers for the entire life of the process, which
costs throughput, fills disks and buries the application's own logs. The
conditions report is produced once at startup, so paying for permanently
elevated logging to get it is a bad trade. Expose the `conditions` Actuator
endpoint behind authentication instead — the same data, on demand, with no
logging change.

**★ You read the report and your bean is in neither matches section. What now?**
That means no condition was ever evaluated for it, so the auto-configuration was
never imported — which is a different failure from a condition returning false.
Check that the contributing jar is actually on the classpath, and that its
registration file is at exactly
`META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`
(a misnamed file loads nothing and reports nothing). Then check the exclusions
section, in case an `exclude` attribute or the `spring.autoconfigure.exclude`
property removed it before evaluation.

---

← Prev: [Property and environment conditions](06-property-and-environment-conditions.md) · Index: [Boot auto-configuration](README.md) · Next → [Excluding it and writing your own](08-excluding-and-writing-your-own.md)
