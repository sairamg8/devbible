# Topic 05 · Inter-service REST that survives change — chunk plan

Tier: **Understand**. 🔴 Read `../_PHASE-NOTES.md` first — it is binding.

## Boundary
Owns **change over the wire between services**: how a payload evolves without a lockstep
deploy, and the client that survives it. 🔴 **07 owns the edge** (gateway); this is
service-to-service. 🔴 **11 owns proving compatibility in CI**; 05 owns designing for it.
🔴 **16 owns Resilience4j** — name timeouts and retries as the caller's obligation, hand off
the library. 🔴 **Phase 9 owns building a REST API**; 05 owns *consuming another team's*.

## Chunks (a PLAN, not a budget)
| # | File | What it argues |
|---|---|---|
| 1 | `01-the-payload-is-a-contract.md` | Once another team parses it, the shape is an API |
| 2 | `02-the-tolerant-reader.md` | Ignore what you do not understand; never fail on a new field |
| 2b | `02b-making-jackson-tolerant.md` | 🔴 **Jackson 3** on Boot 4.1 — unknown-property handling and the defaults |
| 3 | `03-additive-only-evolution.md` | Add optional, never remove, never re-type, never re-mean |
| 3b | `03b-the-breaking-changes-people-do-not-notice.md` | Widening an enum, tightening validation, changing a null into a default |
| 4 | `04-versioning-strategies.md` | URI path, header, media type — with the honest trade-offs |
| 4b | `04b-versioning-you-can-actually-retire.md` | Every version is a deploy you still own; sunset headers and deprecation |
| 5 | `05-the-deploy-order-deadlock.md` | A needs new B, B needs new A — how teams get stuck |
| 5b | `05b-expand-and-contract.md` | The two-phase migration that breaks the deadlock |
| 6 | `06-dtos-are-not-your-entities.md` | Exposing the JPA entity ties your schema to their parser |
| 7 | `07-restclient.md` | Spring Framework 7's `RestClient` as the current synchronous client |
| 7b | `07b-webclient-and-when-reactive-is-the-answer.md` | Where the reactive client earns its complexity |
| 8 | `08-openfeign.md` | Declarative clients on **OpenFeign 5.0** — and what the interface hides |
| 9 | `09-timeouts-are-not-optional.md` | A client with no timeout is an outage waiting for a slow dependency |
| 9b | `09b-retries-and-idempotency.md` | A retry on a non-idempotent POST is a duplicate order |
| 10 | `10-error-contracts.md` | RFC 9457 problem details; what a 4xx from a peer service means |
| 11 | `11-the-shared-client-library-trap.md` | The jar that couples every consumer to the provider's release |
| 12 | `12-the-checklist.md` | Reviewing a cross-service call before it ships |

## Verify, do not assume
- ⚠️ 🔴 **Jackson 3** is the Boot 4 baseline — package names and unknown-property config differ
  from Jackson 2. Verify against the Boot 4.1 reference before showing any annotation.
- ⚠️ Verify `RestClient` API surface against the **Framework 7.0.x** reference, and how
  timeouts are actually configured on it (request factory settings) — do not carry over a
  `RestTemplate` recipe. ⚠️ Netflix 5.0's `RestTemplate` removal is about the **Eureka transport**
  only — `@LoadBalanced RestTemplate` still works via Commons 5.0.x. Prefer `RestClient` on the
  merits, do not claim the old one was removed.
- ⚠️ Verify OpenFeign **5.0** on the Oakwood train — what changed, and whether the old
  `@EnableFeignClients` shape still holds.
- ⚠️ Confirm the current RFC number for problem details (9457, which obsoleted 7807) and cite
  the section, not a blog.
