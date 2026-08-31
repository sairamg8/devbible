# Topic 07 · Logging done right — chunk plan

Tier: 🔴 **Master** — the only Master topic in the phase. Read `../_PHASE-NOTES.md` first.

## Boundary
Owns **the log as a product**: the facade, the backend, structure, correlation, cost and
content. 🔴 **08 owns metrics** and **09 owns traces** — this topic says where the boundary
between the three sits and stops there. Spring Boot's logging *configuration* was
introduced in Phase 9; here it is used, not re-taught.

## Chunks (a PLAN, not a budget)
| # | File | What it argues |
|---|---|---|
| 1 | `01-what-a-log-line-is-for.md` | One reader, at 03:00, who did not write the code |
| 2 | `02-the-facade-and-the-backend.md` | SLF4J is an API; Logback is an implementation; why the split exists |
| 2b | `02b-the-classpath-problem.md` | Multiple bindings, `jcl-over-slf4j`, `log4j-to-slf4j`, and the exclusion list |
| 3 | `03-levels.md` | ERROR/WARN/INFO/DEBUG/TRACE with an actual definition for each |
| 3b | `03b-the-warn-that-nobody-acts-on.md` | Alert fatigue as a design failure of the log |
| 4 | `04-parameterised-messages.md` | `{}` placeholders, `isDebugEnabled`, and the cost of string concatenation |
| 5 | `05-structured-json.md` | Why grep is not a query language; one event, one object |
| 5b | `05b-wiring-json-in-spring-boot.md` | Boot's structured-logging support and the encoder alternatives |
| 5c | `05c-schema-and-field-naming.md` | ECS/OTel field conventions; the cost of renaming a field later |
| 6 | `06-mdc.md` | Context on every line without threading it through every signature |
| 6b | `6b-mdc-and-thread-pools.md` | 🔴 The leak: MDC is a `ThreadLocal` on a pooled thread |
| 6c | `06c-mdc-across-async-and-virtual-threads.md` | `TaskDecorator`, context propagation, reactive `Context` |
| 7 | `07-correlation-ids.md` | Request id, trace id, and not writing the filter yourself |
| 8 | `08-what-never-to-log.md` | 🔴 Credentials, tokens, PII, card data; the exception message that contained the password |
| 8b | `08b-masking-and-the-audit-trail.md` | Redaction that works, and where the real audit log lives |
| 9 | `09-exceptions-in-logs.md` | Log **or** rethrow; the double-logged stack trace; `printStackTrace` |
| 9b | `09b-stack-traces-that-cost-you.md` | Depth, `OmitStackTraceInFastThrow`, and the exception used as control flow |
| 10 | `10-appenders-and-async.md` | Console vs file in a container; `AsyncAppender`, queue size, discarding |
| 10b | `10b-the-log-that-became-the-bottleneck.md` | Synchronous I/O under load; measured symptoms |
| 11 | `11-rolling-retention-and-cost.md` | Rotation, sampling, and the bill for DEBUG in production |
| 12 | `12-changing-levels-at-runtime.md` | Actuator `loggers` endpoint; turning DEBUG on for one class |
| 13 | `13-testing-your-logging.md` | Asserting on log output when the log *is* the contract |
| 14 | `14-the-checklist.md` | A review checklist for a log line and for a service's logging config |

## Verify, do not assume
- ⚠️ 🔴 Spring Boot **4.1**'s structured logging properties and supported formats — the
  production-ready reference, not a 3.4 blog post.
- ⚠️ Whether Boot 4.1 still defaults to Logback and what the Log4j2 swap costs.
- ⚠️ The exact Actuator endpoint id and its default exposure.
- ⚠️ Logback `AsyncAppender` defaults (`queueSize`, `discardingThreshold`) — quote them.
