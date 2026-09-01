# Topic 06 · gRPC — chunk plan

Tier: **Know**. Breadth over depth — the reader should be able to *decide* about gRPC and read
someone else's `.proto`, not become a protobuf expert. 🔴 Read `../_PHASE-NOTES.md` first.

## Boundary
Owns **the binary RPC alternative**: protobuf contracts, the four call shapes, deadlines, and
the honest comparison with REST. 🔴 **05 owns REST evolution**; 06 owns where gRPC changes that
answer. 🔴 **04 owns the sync/async decision** — gRPC is still synchronous coupling and 06 must
say so rather than re-argue it.

## 🔴 The trap this topic exists to defuse
`_PHASE-NOTES.md` fact 6: **gRPC is in Spring Boot itself now** — Boot 4.1 has a gRPC reference
section and the project is **Spring gRPC 1.0.3**. The top search results are three *community*
starters — `grpc-ecosystem/grpc-spring` (3.1.0, Boot 3.2), `yidongnan/grpc-spring-boot-starter`
(2.15.0, Boot 2.7), `LogNet/grpc-spring-boot-starter` (5.2.0). **Name all three, say they are not
the answer on this stack, and write everything against Spring gRPC.**

## Chunks (a PLAN, not a budget)
| # | File | What it argues |
|---|---|---|
| 1 | `01-what-grpc-actually-is.md` | HTTP/2 + protobuf + generated stubs; not "REST but faster" |
| 2 | `02-the-proto-file-is-the-contract.md` | Reading a `.proto`; the schema is the source of truth |
| 2b | `02b-protobuf-field-numbers.md` | Why the number matters more than the name, and never reuse one |
| 3 | `03-schema-evolution-in-protobuf.md` | Adding, reserving, and the changes that silently corrupt |
| 4 | `04-the-four-call-shapes.md` | Unary, server-streaming, client-streaming, bidirectional |
| 5 | `05-spring-grpc-server.md` | 🔴 **Spring gRPC 1.0.3** — the starter, the service bean, Boot config |
| 6 | `06-spring-grpc-client.md` | Channels, stubs, and configuration on Boot 4.1 |
| 6b | `06b-the-community-starters.md` | The three forks, their Boot baselines, and why not to use them here |
| 7 | `07-deadlines.md` | The one gRPC feature REST clients keep forgetting: a deadline propagates |
| 7b | `07b-cancellation.md` | What the server sees when the caller gives up |
| 8 | `08-status-codes-and-errors.md` | The gRPC status set vs HTTP status; error details |
| 9 | `09-build-wiring.md` | The protobuf plugin for Maven and Gradle; generated sources in the build |
| 10 | `10-grpc-versus-rest.md` | The decision table: internal high-volume vs public/browser-facing |
| 10b | `10b-grpc-web-and-the-browser.md` | Why a browser cannot just call it, and what proxies exist |
| 11 | `11-observability-and-debuggability.md` | The honest cost: you cannot `curl` it; `grpcurl` and reflection |
| 12 | `12-when-not-to.md` | Team familiarity, tooling, and the public API you must not make binary |

## Verify, do not assume
- ⚠️ 🔴 Verify **Spring gRPC 1.0.3** supports Boot **4.1.x** and read `docs.spring.io/spring-grpc/reference/`
  (getting-started, server, client, whats-new) plus the Boot reference's own gRPC page. Quote the
  real starter artifact id — do not guess it.
- ⚠️ Verify the current community-starter versions before printing them; they move.
- ⚠️ Confirm the exact protobuf build-plugin coordinates for Maven and Gradle from the Spring
  gRPC docs, not from a blog.
- ⚠️ **No sandbox** — no `grpcurl` output, no generated-code dumps that were not in the docs, no
  latency comparison numbers. The REST-vs-gRPC comparison is argued, never benchmarked.
