---
name: research-system-design-phase2
description: Banked primary-source quotes for docs/system-design/pages/phase-2-request-path/ (18 pages) — RFC 6585 (429), RFC 9110 (Retry-After, 503), RFC 9000 (QUIC), RFC 9113 (HTTP/2), RFC 9114 (HTTP/3), RFC 8446 (TLS 1.3 resumption, 0-RTT), RFC 6455 (WebSocket), MDN SSE, Kubernetes Service. Reuse research_system-design_phase0.md for the Norvig/Dean latency rows and phase1 for RFC 9110 safe/idempotent. Fetched once on 2026-09-07 by session cac93078. Do not re-derive.
metadata:
  type: reference
---

# Research bank — System Design phase 2, the request path (fetched 2026-09-07, session `cac93078`)

**Do not re-fetch.** Load-balancing algorithms, gateway patterns, rate-limiter algorithms
(token bucket etc.), retry budgets and pool sizing are **method / common practice** with no single
primary source — write them as such. The latency figures are the Norvig table + Dean list in
[research_system-design_phase0.md](research_system-design_phase0.md) (same-datacentre RTT ~500 µs,
US↔Europe RTT 150 ms). RFC 9110 safe/idempotent is in [research_system-design_phase1.md](research_system-design_phase1.md).
TCP's three-way handshake (RFC 9293) was **not fetched** — state it as protocol mechanism, quote nothing.

## RFC 6585 — Additional HTTP Status Codes, §4 "429 Too Many Requests"
URL: https://www.rfc-editor.org/rfc/rfc6585.html
- *"The 429 status code indicates that the user has sent too many requests in a given amount of time ("rate limiting")."*
- *"The response representations SHOULD include details explaining the condition, and MAY include a Retry-After header indicating how long to wait before making a new request."*
- *"Responses with the 429 status code MUST NOT be stored by a cache."*
- *"This specification does not define how the origin server identifies the user, nor how it counts requests."*

### RFC 6585 §5 "431 Request Header Fields Too Large" and §7.3 (added 2026-09-07 by session `5c396fd0`, fetched by the topic-18 agent)
- *"The 431 status code indicates that the server is unwilling to process the request because its header fields are too large."*
- *"It can be used both when the set of request header fields in total is too large, and when a single header field is at fault."*
- *"Responses with the 431 status code MUST NOT be stored by a cache."*
- §7.3: *"Servers are not required to use the 431 status code; when under attack, it may be more appropriate to just drop connections, or take other steps."*

⚠️ **RFC 9110's 403 / 413 / 414 definitions could NOT be fetched** — the fetch returned a truncated
document with only §15.5's table of contents. Two attempts. Describe those codes as mechanism, unquoted.
⚠️ **`graphql.org/learn/caching/` and `spec.graphql.org/October2021/` both returned HTTP 403.** Nothing is
quotable from either; every GraphQL claim in pages 17e/17f is written as mechanism and says so.

## Istio — Architecture (fetched 2026-09-07 by session `5c396fd0`'s topic-16 agent)
URL: https://istio.io/latest/docs/ops/deployment/architecture/
- *"The data plane is composed of a set of intelligent proxies (Envoy) deployed as sidecars."*
- *"These proxies mediate and control all network communication between microservices. They also collect and report telemetry on all mesh traffic."*
- *"The control plane manages and configures the proxies to route traffic."*
- *"Istiod converts high level routing rules that control traffic behavior into Envoy-specific configurations, and propagates them to the sidecars at runtime."*

## SPIFFE — Overview (fetched 2026-09-07 by session `5c396fd0`'s topic-16 agent)
URL: https://spiffe.io/docs/latest/spiffe-about/overview/
- *"SPIFFE, the Secure Production Identity Framework for Everyone, is a set of open-source standards for securely identifying software systems in dynamic and heterogeneous environments."*
- *"The heart of these specifications is the one that defines short lived cryptographic identity documents – called SVIDs via a simple API."*
- *"Conventional security practices (such as network policies that only allow traffic between particular IP addresses) struggle to scale under this complexity."*
- *"A first-class identity framework for workloads in an organization becomes necessary."*

⚠️ **Still NOT fetched, and deliberately unquoted in the pages:** Kubernetes native sidecar containers
(no version or GA claim made anywhere), ambient/sidecarless mesh maturity (page 16g carries an explicit
paragraph saying it makes no maturity or feature-parity claim), per-implementation retry-budget semantics,
and Envoy response-flag strings. Any future page wanting these must fetch them first.

## RFC 9110 — HTTP Semantics, Retry-After and 503
URL: https://www.rfc-editor.org/rfc/rfc9110.html
- §10.2.3: *"The Retry-After header field indicates how long a client should wait before retrying a request to the origin server."* · a server sending 503 or a 3xx with Location *MAY* also send Retry-After · value is *"either an HTTP-date or a delay-seconds integer"* (paraphrase of the field grammar).
- §15.6.4: *"The 503 (Service Unavailable) status code indicates that the server is currently unable to handle the request."* · *"The server MAY send a Retry-After header field to suggest an appropriate time for the client to retry."*

## RFC 9000 — QUIC: A UDP-Based Multiplexed and Secure Transport
URL: https://www.rfc-editor.org/rfc/rfc9000.html
- Abstract: *"This document defines the core of the QUIC transport protocol. QUIC provides applications with flow-controlled streams for structured communication, low-latency connection establishment, and network path migration."*
- §1: QUIC packets *"are carried in UDP datagrams to better facilitate deployment in existing systems and networks."* · *"Application protocols exchange information over a QUIC connection via streams, which are ordered sequences of bytes."* · *"The handshake combines negotiation of cryptographic and transport parameters. QUIC integrates the TLS handshake, although using a customized framing for protecting packets."*

## RFC 9113 — HTTP/2
URL: https://www.rfc-editor.org/rfc/rfc9113.html
- Abstract: *"HTTP/2 enables a more efficient use of network resources and a reduced latency by introducing field compression and allowing multiple concurrent exchanges on the same connection."*
- *"Multiplexing of requests is achieved by having each HTTP request/response exchange associated with its own stream."*
- *"HTTP/1.1 added request pipelining, but this only partially addressed request concurrency and still suffers from application-layer head-of-line blocking."*
- *"TCP head-of-line blocking is not addressed by this protocol."*

## RFC 9114 — HTTP/3
URL: https://www.rfc-editor.org/rfc/rfc9114.html
- Abstract: *"The QUIC transport protocol has several features that are desirable in a transport for HTTP, such as stream multiplexing, per-stream flow control, and low-latency connection establishment. This document describes a mapping of HTTP semantics over QUIC."*
- *"Because the parallel nature of HTTP/2's multiplexing is not visible to TCP's loss recovery mechanisms, a lost or reordered packet causes all active transactions to experience a stall regardless of whether that transaction was directly impacted by the lost packet."*
- *"By providing reliability at the stream level and congestion control across the entire connection, QUIC has the capability to improve the performance of HTTP compared to a TCP mapping."*

## RFC 8446 — TLS 1.3
URL: https://www.rfc-editor.org/rfc/rfc8446.html
- Abstract: *"TLS allows client/server applications to communicate over the Internet in a way that is designed to prevent eavesdropping, tampering, and message forgery."*
- §2: the handshake lets peers *"negotiate a protocol version, select cryptographic algorithms, optionally authenticate each other, and establish shared secret keying material."* ⚠️ The explicit "1-RTT" sentence was not returned by the fetch — say "a full TLS 1.3 handshake completes in one round trip" as the RFC's design, unquoted.
- §2.2: PSKs *"can be established out of band, [or] in a previous connection and then used to establish a new connection ("session resumption" or "resuming" with a PSK)."*
- §2.3: *"The security properties for 0-RTT data are weaker than those for other kinds of TLS data. Specifically: This data is not forward secret, as it is encrypted solely under keys derived using the offered PSK. There are no guarantees of non-replay between connections."*

## RFC 6455 — The WebSocket Protocol
URL: https://www.rfc-editor.org/rfc/rfc6455.html
- Abstract: *"The WebSocket Protocol enables two-way communication between a client running untrusted code in a controlled environment to a remote host that has opted-in to communications from that code."*
- §1.1 on polling: *"The server is forced to use a number of different underlying TCP connections for each client: one for sending information to the client and a new one for each incoming message."* · *"A simpler solution would be to use a single TCP connection for traffic in both directions. This is what the WebSocket Protocol provides."*

## MDN — Using server-sent events
URL: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events
- *"This is a one-way connection, so you can't send events from a client to a server."*
- *"By default, if the connection between the client and server closes, the connection is restarted."* · `retry` field: *"The reconnection time. If the connection to the server is lost, the browser will wait for the specified time before attempting to reconnect."*
- *"The server-side script that sends events needs to respond using the MIME type `text/event-stream`."*
- *"When not used over HTTP/2, SSE suffers from a limitation to the maximum number of open connections, which can be especially painful when opening multiple tabs, as the limit is per browser and is set to a very low number (6)."* · *"When using HTTP/2, the maximum number of simultaneous HTTP streams is negotiated between the server and the client (defaults to 100)."*

## Kubernetes — Service
URL: https://kubernetes.io/docs/concepts/services-networking/service/
- A Service is *"a method for exposing a network application that is running as one or more Pods in your cluster."*
- *"Pods are ephemeral resources (you should not expect that an individual Pod is reliable and durable)"* … *"how do the frontends find out and keep track of which IP address to connect to"*
- *"Kubernetes updates the EndpointSlices for a Service whenever the set of Pods in a Service changes"*
- ⚠️ The DNS-record sentence (`my-service.my-ns`) and the "ClusterIP is the default" sentence were **not returned** — describe cluster DNS in prose without quoting; ClusterIP-as-default stated as the documented default, unquoted.

## Not fetched
- RFC 9293 (TCP) — three-way handshake as mechanism, no quote.
- RFC 1034/1035 (DNS TTL) — TTL as mechanism, no quote.
- Envoy / NGINX / HAProxy docs — balancing algorithms and health checks described as common practice.
- Cloudflare / AWS docs on CDNs, WAF, anycast — described as common practice; no vendor claims.
