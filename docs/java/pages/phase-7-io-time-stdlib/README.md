---
title: "Phase 7 — I/O, time and the everyday standard library"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Java 25 (LTS).** Documentation-validated — every page names its
> sources on a `> Verified:` line (the JDK 25 API documentation, JEP 400,
> the Jackson documentation for the JSON topic). No sandbox: pages carry Java
> code, never fabricated program output.

The APIs you touch in every service, tiered by how often they bite. The two
Master topics — `java.time` and Jackson — are Master because getting either
subtly wrong ships silently and corrupts data at a boundary.

🚧 **12 of 13 written; `java.time` chunk 4 is mid-write.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | 🚧 **[`java.time`](01-java-time/README.md)** *(chunks 1–3 of 4 written)* | <span className="db-tier t-master">Master</span> | `Instant` in the data, zones at the edge; the DST bug prevented |
| 02 | **[`Path` and `Files`](02-path-and-files.md)** | <span className="db-tier t-understand">Understand</span> | Modern file work; `Files.lines` holds a file open |
| 03 | **[Streams, buffers and charsets](03-streams-buffers-charsets.md)** | <span className="db-tier t-understand">Understand</span> | Byte vs char, buffering, UTF-8 default since 18 |
| 04 | **[`HttpClient`](04-httpclient.md)** | <span className="db-tier t-understand">Understand</span> | Sync/async HTTP without a library — timeouts on every call |
| 05 | **[JSON with Jackson](05-json-jackson/README.md)** | <span className="db-tier t-master">Master</span> | One shared `ObjectMapper`; records as DTOs; unknown-field policy |
| 06 | **[Regex](06-regex.md)** | <span className="db-tier t-understand">Understand</span> | Compile once; the backtracking input that hangs a thread |
| 07 | **[`UUID` and randomness](07-uuid-and-randomness.md)** | <span className="db-tier t-understand">Understand</span> | `SecureRandom` vs `Random` vs `ThreadLocalRandom` — one is safe for tokens |
| 08 | **[Java serialization](08-java-serialization.md)** | <span className="db-tier t-know">Know</span> | A deserialization-attack liability — recognize and avoid |
| 09 | **[Localization basics](09-localization-basics.md)** | <span className="db-tier t-know">Know</span> | `Locale`, `ResourceBundle` — no hardcoded `en_US` assumptions |
| 10 | **[`ProcessBuilder`](10-processbuilder.md)** | <span className="db-tier t-know">Know</span> | Shelling out safely: argument lists, stream draining |
| 11 | **[Console I/O and `Scanner`](11-console-io-scanner.md)** | <span className="db-tier t-know">Know</span> | Fine for exercises, absent from services |
| 12 | **[NIO channels and selectors](12-nio-channels-selectors.md)** | <span className="db-tier t-when">When Needed</span> | The layer under Netty — framework territory |
| 13 | **[Foreign Function & Memory API](13-ffm-api.md)** | <span className="db-tier t-when">When Needed</span> | Native calls without JNI (final in 22) |

## Phase gate

Move on when you can fetch JSON from an API with `HttpClient`, deserialize
into records, and store the timestamp correctly — `Instant` in the data, zone
conversion only at the edge for display.

## Where this connects

- **[Phase 5](../phase-5-exceptions/README.md)** — try-with-resources guards
  every stream and channel here.
- **Phase 9 — Spring** replaces hand-rolled `HttpClient` calls with
  `RestClient` and hides Jackson behind `@RequestBody`.
- **Phase 13 — OAuth2** leans on topic 07's `SecureRandom` story for tokens.
