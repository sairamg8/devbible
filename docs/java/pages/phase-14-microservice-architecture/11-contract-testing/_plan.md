# Topic 11 · Consumer-driven contract testing — chunk plan

Tier: **Understand**. 🔴 Read `../_PHASE-NOTES.md` first — it is binding.

## Boundary
Owns **proving cross-service compatibility in CI, without an integration environment**:
consumer-driven contracts, the provider's gate, and stubs the consumer can trust. 🔴 **Phase 11
owns testing technique** (JUnit, Mockito, AssertJ, Testcontainers) — link, do not re-teach.
🔴 **05 owns designing a payload for change**; 11 owns *proving* you did not break it.

## 🔴 The trap this topic exists to defuse
`_PHASE-NOTES.md` fact 4: **REST Assured support was REMOVED from Spring Cloud Contract 5.0**,
and `stubrunner` properties moved to the **`spring.cloud.contract.stubrunner`** prefix. The
generated-test story therefore differs from every tutorial and from the older reference docs.
**Verify what Contract 5.0 generates before describing it** — do not reproduce a
`RestAssuredMockMvc` generated test from an older train's documentation.

## Chunks (a PLAN, not a budget)
| # | File | What it argues |
|---|---|---|
| 1 | `01-the-integration-environment-that-does-not-work.md` | Shared staging: slow, flaky, and always someone else's fault |
| 2 | `02-what-a-contract-actually-is.md` | An executable agreement about one interaction, owned by the consumer |
| 2b | `02b-consumer-driven-versus-provider-driven.md` | Who writes it decides what it is worth |
| 3 | `03-the-two-halves.md` | The provider must honour it; the consumer must test against it |
| 4 | `04-spring-cloud-contract.md` | **Contract 5.0** — the DSL, the plugin, and what it generates |
| 4b | `04b-what-contract-5-generates.md` | 🔴 Verify first: REST Assured support was removed |
| 4c | `04c-the-base-test-class.md` | Where the provider wires the state the contract assumes |
| 5 | `05-stub-runner.md` | The consumer side; 🔴 the `spring.cloud.contract.stubrunner` prefix |
| 5b | `05b-where-stubs-come-from.md` | Local, remote repository, or the classpath — and the staleness risk |
| 6 | `06-pact.md` | The polyglot alternative, the broker, and `can-i-deploy` |
| 6b | `06b-pact-versus-spring-cloud-contract.md` | An honest comparison, including "is your other service Java" |
| 7 | `07-the-contract-is-not-the-schema.md` | OpenAPI describes shape; a contract describes an *interaction* |
| 8 | `08-messaging-contracts.md` | Contracts for events, not just HTTP — the phase 15 hand-off |
| 9 | `09-wiring-it-into-ci.md` | The gate that actually blocks a breaking merge |
| 9b | `09b-the-gate-everyone-disables.md` | Why contract suites get switched off, and how to keep them cheap |
| 10 | `10-versioning-and-retiring-contracts.md` | Contracts accumulate; the ones nobody consumes any more |
| 11 | `11-what-contract-testing-does-not-catch.md` | Semantics, performance, and the field that is present but wrong |
| 12 | `12-the-checklist.md` | Deciding whether a pair of services needs this at all |

## Verify, do not assume
- ⚠️ 🔴 Read the **Spring Cloud Contract 5.0** reference for what the plugin generates now that
  REST Assured is gone. This is the whole point of the topic — get it wrong and the topic is
  worse than nothing.
- ⚠️ 🔴 Confirm the current `stubrunner` property prefix verbatim.
- ⚠️ Verify the Maven and Gradle plugin coordinates for Contract 5.0.
- ⚠️ Verify Pact's current JVM tooling and the `can-i-deploy` semantics from Pact's own docs.
- ⚠️ **No sandbox.** No test-run output, no generated files that were not shown in the docs, no
  CI logs.
