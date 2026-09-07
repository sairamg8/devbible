---
title: "Bytes on the wire are a latency lever on mobile and a CPU cost on the server — JSON is readable and large, Protobuf is compact and schema-bound, MessagePack is JSON's shape in fewer bytes — and compression decides more than the format: gzip everywhere, brotli for static, zstd where both ends are yours, and none of them on bytes that are already compressed"
sidebar_label: "13 · Serialization on the wire"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07. Method and common practice — the three formats and the three
> compressors are described by their documented design properties (text versus binary, schema
> versus self-describing, dictionary-based compression), without version numbers, benchmark
> figures or ratios; every "smaller" and "faster" below is qualitative and would be measured
> per payload before being relied on ([DSA's benchmarking page](../../../dsa/pages/phase-1-complexity/10-benchmarking-vs-analysis.md)
> is the discipline). Header compression is [RFC 9113](https://www.rfc-editor.org/rfc/rfc9113.html)
> (HPACK) as named there. **No sandbox run.**

**Every request and response is bytes, and the number of bytes is a decision with two prices:
on the client's link, bytes are time — a payload that takes three round trips of a mobile
connection's window to deliver has cost three round trips; on the server, bytes are CPU — every
byte is encoded, and every byte is compressed, per request, in the process that could be
serving another one.** The choice of format sets the baseline: JSON is text, self-describing,
readable, universal and large; Protobuf is binary, schema-bound, compact, fast to parse and
needs the schema at both ends; MessagePack keeps JSON's self-describing shape in a binary
encoding — smaller than JSON, larger than Protobuf, no schema. Compression then usually matters
more than the format for text: gzip is everywhere and cheap; brotli compresses text better and
costs more to compress, which is fine when the compression happens once (static assets) and
not when it happens per request; zstd is fast at both ends but needs both ends to speak it,
which they do when both are yours. And none of them helps bytes that are already compressed —
images, video, encrypted blobs — where a compressor spends CPU to add a header. This page is
the two prices, the three formats and when each wins, the three compressors and where each
sits on the path, the schema-evolution question that decides Protobuf's cost, and the
storefront's choices.

## The two prices

**On the client's link.** A payload larger than the connection's initial send window is
delivered in several round trips — the transport ramps up — so on a 300 ms mobile round trip a
payload that fits in the first window arrives in one and a payload three windows long arrives
in three. The lever is bytes on the *first* screen: the product page's first response should be
small and everything else deferred, and the API's list endpoints should not return fields the
screen does not show. Header bytes count too — a cookie of a few kilobytes on every request to
an API that returns two hundred bytes is mostly cookie — which is what HTTP/2's field
compression (HPACK, RFC 9113) removes for repeated headers, and what a *separate cookieless
domain* for the API removes at the source.

**On the server.** Serialisation is CPU per byte: building a JSON string, compressing it,
decompressing the request, parsing it. At a thousand requests a second it is a few percent of a
core; at a hundred thousand it is a fleet. The lever is doing less per request — a format that
is cheap to encode, compression at the level that pays for itself, and compressing once for
content that does not change.

The trade between the two prices is the page's theme: the smallest bytes on the wire (heavy
compression, compact formats) cost the most CPU to produce, and the answer is per payload and
per hop.

## The three formats

| | JSON | Protobuf | MessagePack |
|---|---|---|---|
| Encoding | text, UTF-8 | binary, field numbers, varints | binary, JSON's types |
| Self-describing | yes — keys in the payload | no — the schema is at both ends; the wire carries numbers | yes — keys in the payload |
| Schema | optional (JSON Schema, OpenAPI) | required, versioned, generated code | optional |
| Size | largest — keys repeated, numbers as digits | smallest — no keys, packed numbers | between — binary values, keys still present |
| Parse cost | highest — tokenising text | lowest — fixed layouts, no key matching | lower than JSON, higher than Protobuf |
| Readable in a log, a curl, a browser | yes | no — needs the schema and a tool | no — needs a tool, but no schema |
| Evolution | add or remove keys freely; consumers ignore unknowns by convention | field numbers are forever; add fields, never renumber; unknown fields preserved | as JSON |
| Typical home | public APIs, browsers, anything human-facing | service-to-service, gRPC, high-volume internal streams, mobile SDKs you control | caches, message payloads, places where JSON's shape is wanted at lower cost |

The decision is mostly *who reads it*: a browser, a partner, a support engineer with curl — JSON;
two services you both control at volume — Protobuf, with gRPC as the usual carrier; a payload
you want smaller than JSON without adopting a schema toolchain — MessagePack. The senior
sentence: *"JSON at the edge, Protobuf inside, and the gateway translates — the phone never sees
a `.proto`."*

## Schema evolution: Protobuf's real cost

Protobuf's compactness comes from not sending keys — the wire carries field numbers, and both
ends map numbers to names via the schema. That makes the schema a contract with rules that a
system must obey forever:

- **A field number is never reused or renumbered.** Renumbering silently reinterprets old data
  as the wrong field. Removed fields are *reserved*.
- **Adding a field is safe; making one required is not.** Old readers ignore unknown fields;
  new readers see a missing field as its default. Every field is effectively optional, and the
  code must treat a default as "absent", not "zero".
- **Changing a type is a new field**, not an edit.
- **The schema is deployed like code**, to every producer and consumer, and consumers must
  accept the previous version for as long as old messages exist — the event-log rule of
  [phase 1's evolution page](../phase-1-the-method/14-evolution-and-operations.md), which is
  the same rule for the same reason.

JSON has the same evolution problem with weaker enforcement: nothing stops a producer renaming
a key, and the consumer breaks at runtime rather than at compile time. So Protobuf's schema is a
cost *and* the safety: the discipline is mandatory either way, and Protobuf makes it checkable.

## The three compressors

| | gzip | brotli | zstd |
|---|---|---|---|
| Support | every client, every proxy, every CDN | every modern browser and CDN; over HTTPS only in browsers | libraries everywhere; browser support arriving, not universal |
| Compresses text | well | better than gzip — a built-in dictionary of common web text | comparable to brotli at speed, tunable |
| Compression cost | low | high at its best levels — for content compressed once | low to moderate; very fast decompression |
| Decompression cost | low | low | very low |
| Best placed | dynamic responses per request at the gateway or CDN | static assets compressed at build time, served from the CDN | service-to-service where both ends are yours; caches; logs and events at rest |
| The trap | compressing already-compressed bytes | compressing dynamic responses at a high level per request — CPU for nothing | assuming the browser speaks it |

The placement rule: **compress once where you can, cheaply where you must.** Static assets
are compressed at build time with brotli at its highest level and served pre-compressed by the
CDN — the cost is paid once, ever. Dynamic responses are compressed per request with gzip at a
moderate level at the gateway or CDN, because a high level costs CPU on every response for a
few percent of bytes. Between services and into caches, zstd, because both ends are yours and
its decompression is nearly free. And the negotiation is the client's `Accept-Encoding` header
answered by `Content-Encoding` — the gateway compresses what the client says it can read, and
a CDN must key its cache on the encoding it stored ([05](05-cdns.md)'s `Vary`).

**Where compression does nothing or harm.** Images, video, audio, PDFs, archives — already
compressed; running gzip over a JPEG spends CPU and adds bytes. Tiny responses — under a
kilobyte — where the compression header and dictionary overhead exceed the saving. Encrypted
payloads, which are incompressible by design. The gateway's rule is a minimum size and a
content-type list.

## Where on the path

| Hop | Format | Compression |
|---|---|---|
| browser ↔ CDN / gateway | JSON for the API; HTML; static assets | brotli pre-compressed for static; gzip per request for dynamic; nothing for images |
| CDN ↔ gateway | the same bytes, already compressed — the edge stores and forwards the compressed form | — |
| gateway ↔ services | JSON, or Protobuf over gRPC where the volume justifies it | usually none inside the region — the CPU costs more than the sub-millisecond bytes save; zstd for large payloads |
| service ↔ cache | MessagePack or Protobuf for hot objects; JSON where readability in the cache matters | zstd on large values |
| service ↔ event log | Protobuf or a schema'd JSON with a version field | the log's own compression, batched |
| service ↔ database | the driver's wire protocol — not a choice you make | — |

The middle row is the one that surprises: inside a region, bandwidth is plentiful and latency
is half a millisecond, so compressing service-to-service traffic often costs more CPU than the
bytes cost time. Compression is for the links where bytes are slow — the client's — and for
storage where bytes are money.

## The storefront

```text
browser → API           JSON; gzip per request at the gateway above 1 KB; list endpoints return the fields the screen shows
browser → static        brotli, pre-compressed at build, served by the CDN with a year TTL
browser → images        WebP/AVIF variants pre-generated — the format IS the compression; no Content-Encoding
gateway → services      JSON over HTTP/1.1 from pools; no compression in-region
orders → inventory      Protobuf over gRPC — the hot path, both ends ours, the schema versioned with reserved fields
services → Redis        MessagePack for the cart and product cache entries; zstd above 4 KB
outbox → event log      Protobuf with a version field; consumers accept the previous version for the retention window
```

Two rows carry the sentence. Images: the right *format* (a modern image codec, resized
variants) is the compression, and it is chosen once at upload — the largest bytes on the path
are not a serialisation question but an encoding one. And the event log: the schema-evolution
rule is what makes a replay safe a month later.

## Gotchas

**★ Symptom: the API response is two hundred bytes and the request is four kilobytes.** Cause:
cookies on every API request. Fix: a cookieless API host, or HTTP/2's header compression; tokens
in a header only where needed.

**★ Symptom: "we'll use Protobuf for the public API."** Cause: compactness chosen over the
audience. Fix: JSON at the edge — browsers, partners, curl — and Protobuf inside where both
ends are yours; the gateway translates.

**★ Symptom: a renumbered Protobuf field and silently corrupted data.** Cause: field numbers
treated as editable. Fix: numbers are forever; reserve removed ones; add, never renumber;
defaults mean absent.

**Symptom: gzip applied to images and the responses grew.** Cause: compressing compressed
bytes. Fix: a content-type allowlist and a minimum size at the gateway; images get the right
codec at upload instead.

**Symptom: brotli at its highest level on every dynamic response, and the gateway is CPU-bound.**
Cause: compress-once settings applied per request. Fix: brotli at build time for static; gzip
at a moderate level per request; measure the ratio before raising the level.

**Symptom: service-to-service compression added "for performance" and latency rose.** Cause:
CPU spent to save sub-millisecond bytes. Fix: no compression in-region for small payloads; zstd
only for large ones, measured.

**Symptom: the CDN served a gzip body to a client that asked for identity.** Cause: the cache
key ignored `Content-Encoding`. Fix: `Vary: Accept-Encoding`; the edge stores per encoding.

**Symptom: a consumer crashed on an event from last month during a replay.** Cause: the schema
changed incompatibly. Fix: the version field; consumers accept the previous version for the
retention window; additive changes only.

**Symptom: the mobile app's first screen waits on a 300 KB JSON.** Cause: list endpoints
returning everything. Fix: fields the screen shows, pagination, the rest deferred — bytes on the
first screen are round trips.

**Symptom: "zstd is faster" and the browser cannot read it.** Cause: support assumed. Fix:
negotiate via `Accept-Encoding`; zstd where both ends are yours; gzip or brotli for browsers.

## Interview questions

**★ JSON, Protobuf or MessagePack — how do you choose?**
By who reads the bytes. JSON is text, self-describing and readable by a browser, a partner or an
engineer with curl, at the cost of size and parse time — the public edge. Protobuf is binary and
schema-bound: no keys on the wire, packed numbers, generated code, the smallest and fastest to
parse — service-to-service at volume where both ends deploy the schema, with the evolution rules
that field numbers are forever and every field is effectively optional. MessagePack is JSON's
self-describing shape in a binary encoding — smaller than JSON without a schema toolchain, for
caches and message payloads. The gateway translates, so the phone never sees a `.proto`.

**★ Where does compression go on the path, and where does it do nothing?**
Once where possible, cheaply where necessary: static assets compressed with brotli at build
time and served pre-compressed by the CDN; dynamic responses with gzip at a moderate level per
request at the gateway or edge, negotiated by `Accept-Encoding` and keyed in the cache by
`Vary`; zstd between services and into caches only for large payloads, where both ends are
yours. Nothing in-region for small payloads, because the CPU costs more than half a millisecond
of bytes; nothing on images, video, archives or encrypted data, which are already compressed;
nothing under a kilobyte, where the overhead exceeds the saving.

**★ Why do bytes matter more on mobile than on the server, and what is the lever for each?**
On the client's link bytes are round trips: a payload larger than the transport's window
arrives in several, and each is hundreds of milliseconds on mobile, so the lever is bytes on
the first screen — fields the screen shows, deferred lists, compressed text, image codecs chosen
at upload, and cookies kept off the API host. On the server bytes are CPU per request —
encoding, compressing, parsing — so the lever is doing less per request: a cheap format inside,
compression only where it pays, and compress-once for content that does not change.

**What are Protobuf's schema-evolution rules, and why does JSON not escape them?**
Field numbers are never reused or renumbered — removed fields are reserved; adding a field is
safe, requiring one is not, because old readers ignore unknowns and new readers see defaults;
a type change is a new field; the schema deploys to every producer and consumer, and consumers
accept the previous version for as long as old messages exist. JSON has the same problem with
no enforcement: a renamed key breaks a consumer at runtime instead of at compile time. The
discipline is the same either way; Protobuf makes it checkable, which is part of what you pay
for.

**A four-kilobyte cookie rides on every two-hundred-byte API call. What do you do?**
Serve the API from a cookieless host so the browser sends no cookie, carrying the session as a
compact header only where the endpoint needs it; keep the session cookie scoped to the pages
that use it; and rely on HTTP/2's header compression, which removes the repeated bytes for
headers that do not change between requests on a connection. The response format was never the
problem; the request headers were twenty times the payload.

**Why is the image format a serialization decision?**
Because the largest bytes on the path are images, and no wire compression helps them — a JPEG
is already compressed. The bytes are decided at upload: a modern codec, resized variants for
each screen size, and the right quality level — chosen once, cached at the edge for a year.
That single decision moves more bytes than every JSON-versus-Protobuf choice on the site, and
it is why the gateway's compression rule excludes image types.

---

← Prev: [12 · Service discovery](12-service-discovery.md) · Index: [Phase 2 — The request path](README.md) · Next → [14 · Connection pooling and keep-alive](14-connection-pooling-and-keep-alive.md)
