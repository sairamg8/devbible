---
title: "TLS ends somewhere, and where it ends decides who sees plaintext, who holds the certificates, and how many round trips the user pays — at the edge for the user's handshakes, re-encrypted inside, mutual TLS between services when the network is not trusted — and resumption is what makes the second handshake nearly free"
sidebar_label: "10 · TLS termination and where it lives"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against [RFC 8446](https://www.rfc-editor.org/rfc/rfc8446.html) (TLS 1.3
> — the abstract, the handshake's purpose in §2, PSK resumption in §2.2, the 0-RTT warning in
> §2.3 — verbatim below) and [RFC 9000](https://www.rfc-editor.org/rfc/rfc9000.html) (QUIC
> integrating the TLS handshake). Certificate automation, mutual TLS between services and the
> placement trade-offs are common practice, stated as such; no vendor, library or cipher
> defaults are claimed. Latency figures are the ladder of
> [phase 0](../phase-0-the-interview/05-the-latency-ladder.md). **No sandbox run.**

**TLS is the layer that makes the request path private and authenticated, and it has to
*terminate* — end, with the bytes decrypted — at some box; that box sees plaintext, holds the
private key, and is where the user's handshake round trips are spent.** The three candidates
are the CDN edge, the load balancer or gateway, and the service pod, and each answers three
questions differently: who is trusted with plaintext, who manages certificates, and how far the
user's handshake travels. The usual answer is layered: terminate at the edge so the user's
handshake is with the nearest city, re-encrypt from edge to origin so the backbone carries
ciphertext, and — when the internal network is not trusted — mutual TLS between services, so
each service proves who it is to the other. What makes any of it affordable is that a handshake
is paid once per connection and then amortised: TLS 1.3 completes in one round trip, resumption
with a pre-shared key makes the next connection cheaper, and QUIC folds the transport handshake
into the same round trip. This page is what a handshake costs and buys, the three places to
terminate with their trade-offs, resumption and 0-RTT with the RFC's warning, certificates at
scale, mutual TLS inside the network, and the storefront's layout.

## What a handshake costs and buys

The RFC's own statement of the purpose:

> *"TLS allows client/server applications to communicate over the Internet in a way that is
> designed to prevent eavesdropping, tampering, and message forgery."* — RFC 8446, abstract

And of what the handshake does:

> the handshake lets the peers *"negotiate a protocol version, select cryptographic algorithms,
> optionally authenticate each other, and establish shared secret keying material."* — RFC 8446,
> §2

The cost is round trips and CPU. A full TLS 1.3 handshake completes in one round trip after the
TCP handshake — two round trips to the first byte of payload — and the asymmetric cryptography
of the key exchange and the certificate verification is the CPU-heavy part, spent once per
connection; the symmetric encryption of the payload afterwards is cheap enough to be
negligible against the network. So the design levers are about *how many handshakes* and *how
far each travels*: a connection reused for many requests amortises its handshake to nothing; a
handshake to a box in the same city costs tens of milliseconds, to a box across an ocean a
hundred and fifty ([01](01-from-the-tap-to-the-first-byte.md)).

## The three places to terminate

| Terminates at | Who sees plaintext | Who holds the certificate | The user's handshake travels to | Trade |
|---|---|---|---|---|
| **the CDN edge** | the CDN, then re-encrypted to origin | the CDN (yours, uploaded, or one it issues) | the nearest point of presence — tens of ms | fastest for users; the CDN is trusted with plaintext; a second, internal handshake edge→origin, amortised over pooled connections |
| **the balancer / gateway** | the gateway and everything behind it on the private network | the gateway tier, one place to rotate | the origin region — the full distance | one place for certificates and policy ([03](03-reverse-proxies-and-api-gateways.md)); the private network behind it must actually be private |
| **the service pod** | only the pod | every service — each needs a certificate and rotation | the pod — the full distance, plus a balancer at layer 4 only | end-to-end confidentiality for compliance; the balancer cannot route on the request; certificates everywhere |

Layered, which is the usual answer: **edge termination for the user**, so the handshake is
local and the CDN can cache and shield; **re-encryption from edge to gateway**, so the backbone
carries ciphertext and the gateway is the origin's policy point; and then either a private
network the gateway trusts, or **mutual TLS between services** when it does not. The pure
"terminate in the pod" answer is for a requirement — a regulator, a contract — that says no
intermediary may see plaintext, and it is stated with its cost: the balancer works at layer 4
only ([02](02-load-balancing-layer-4-vs-layer-7.md)) and every service manages certificates.

The one thing that is not negotiable at any placement: the hop where TLS ends and plaintext
begins must be on a network no client can reach directly, or the identity headers the gateway
forwards are forgeable ([03](03-reverse-proxies-and-api-gateways.md)'s trap).

## Resumption, and 0-RTT with its warning

A returning client should not pay the full handshake. TLS 1.3's mechanism is a pre-shared key
carried over from the previous connection:

> PSKs *"can be established out of band, [or] in a previous connection and then used to
> establish a new connection ("session resumption" or "resuming" with a PSK)."* — RFC 8446, §2.2

Resumption skips the certificate exchange and the expensive asymmetric work; the round trip
remains unless the client sends data *with* its first flight — 0-RTT — and the RFC is explicit
about what that costs:

> *"The security properties for 0-RTT data are weaker than those for other kinds of TLS data.
> Specifically: This data is not forward secret, as it is encrypted solely under keys derived
> using the offered PSK. There are no guarantees of non-replay between connections."* — RFC 8446,
> §2.3

*No guarantee of non-replay*: an attacker who captured the 0-RTT flight can send it again, and
the server will process it again. So 0-RTT is enabled only for requests that are safe to
replay — idempotent `GET`s of cacheable content — and the gateway rejects or downgrades
anything else arriving as early data; `POST /orders` in 0-RTT is a replayable checkout. That is
the second mechanism, after the idempotency key, that exists because "the same request twice"
is the normal case on a network.

QUIC goes one step further by folding the transport handshake into the same exchange:

> *"The handshake combines negotiation of cryptographic and transport parameters. QUIC
> integrates the TLS handshake, although using a customized framing for protecting packets."*
> — RFC 9000, §1

So HTTP/3 on a resumed connection reaches the first byte in the fewest round trips any of the
stack offers — **11 · HTTP/1.1, HTTP/2 and HTTP/3** *(not written yet)* is the comparison.

## Certificates at scale

Every terminating box holds a certificate and its private key, and the operational design is
about issuance, rotation and expiry — the "one certificate with an expiry" SPOF of
[phase 1's checklist](../phase-1-the-method/11-bottlenecks-and-single-points-of-failure.md):

- **Automate issuance and renewal.** Short-lived certificates from an automated authority,
  renewed well before expiry by the platform, not by a person with a calendar reminder. An
  expiry is a scheduled outage that nobody scheduled; automation is the fix, and monitoring of
  days-to-expiry is the backstop.
- **One place per boundary.** The edge holds the public certificate; the gateway holds the
  origin's; services hold internal ones issued by a private authority. Fewer places is fewer
  rotations to get wrong.
- **Rotate keys without downtime.** A new certificate is deployed alongside the old, traffic
  moves, the old is retired — the same overlap window as the gateway's token-verification key
  ([03](03-reverse-proxies-and-api-gateways.md)).
- **Wildcards and SANs** reduce the count; a wildcard's private key is a broader secret, and a
  compromised one covers every subdomain — the trade to name.

## Mutual TLS inside the network

Ordinary TLS authenticates the *server* to the client. Between services, the question is the
reverse — is this caller allowed to call me? — and **mutual TLS** answers it by having both
sides present certificates issued by a private authority: the order service proves it is the
order service; the inventory service accepts calls only from identities it allows. It replaces
"the network is private, so anything on it is trusted" with per-service identity, which matters
the moment the network is shared, multi-tenant, or breached. The cost is a certificate per
service with rotation, and a handshake per connection between services — amortised over pooled
connections (**14 · Connection pooling** *(not written yet)*) — and the usual way to pay it
without every service implementing it is a sidecar or a mesh that terminates and originates the
internal TLS on the service's behalf (**16 · Service mesh** *(not written yet)*). The sentence:
*"mutual TLS between services when the internal network is not fully trusted; the gateway's
forwarded identity is only as trustworthy as the network it crosses."*

## The storefront

```text
user ──TLS 1.3 (resumption, 0-RTT for GET only)──► CDN edge      certificate: shop.example.com, automated, 90-day, renewed at 60
CDN edge ──TLS, pooled connections──► API gateway                 certificate: origin.example.com, automated; the edge is trusted with plaintext
API gateway ──mutual TLS──► services                              private authority; per-service identities; rotated by the platform
services ──TLS──► PostgreSQL, Redis                               server certificates from the private authority; the driver verifies
admin.example.com ──mutual TLS from the admin network only──► admin service   client certificates issued to operators
```

Two rows explain themselves in a round. The edge is *trusted with plaintext* because it caches
and shields — a CDN that cannot read the response cannot cache it — and that trust is a decision,
said out loud. And the admin route uses mutual TLS from *clients* — operators' certificates —
which is the strongest cheap authentication for a small, known population and useless for the
public.

## Gotchas

**★ Symptom: three handshake round trips across the ocean before the first byte.** Cause: TLS
terminated at the origin. Fix: terminate at the edge; the user's handshake is with the nearest
city; re-encrypt edge to origin over pooled connections.

**★ Symptom: 0-RTT enabled globally and a checkout processed twice.** Cause: the RFC's
non-replay warning ignored. Fix: 0-RTT only for idempotent, cacheable `GET`s; the gateway
rejects early data on anything else.

**★ Symptom: the site went down at midnight — certificate expired.** Cause: manual renewal.
Fix: automated short-lived certificates renewed by the platform, and an alert on days-to-expiry
as the backstop.

**Symptom: "the balancer can't route by path."** Cause: TLS terminated in the pod, so the
balancer is layer 4 and blind. Fix: terminate at the gateway with re-encryption, unless a
requirement forbids an intermediary seeing plaintext — then say the cost.

**Symptom: the gateway's forwarded identity header trusted on a network clients can reach.**
Cause: plaintext begins on a reachable network. Fix: the segment behind the terminating hop is
private, or mutual TLS so services accept only known identities.

**Symptom: a wildcard certificate's key leaked and every subdomain is affected.** Cause: one
broad secret. Fix: name the trade when choosing wildcards; separate certificates for the
sensitive hosts.

**Symptom: mutual TLS proposed and every service team implements it differently.** Cause: no
shared mechanism. Fix: a sidecar or mesh terminating internal TLS on the service's behalf, with
identities issued by the platform.

**Symptom: the internal handshake between services on every request.** Cause: no connection
reuse. Fix: pooled, keep-alive connections; the handshake is per connection, amortised.

**Symptom: "resumption makes the handshake free."** Cause: the round trip and the 0-RTT caveat
conflated. Fix: resumption removes the asymmetric work; the round trip stays unless 0-RTT, which
is replayable.

**Symptom: the CDN terminates TLS and "therefore it's end-to-end encrypted".** Cause: the
edge's plaintext forgotten. Fix: say that the edge is trusted with plaintext and why — caching,
shielding — and that edge-to-origin is re-encrypted.

## Interview questions

**★ Where do you terminate TLS, and what does each choice cost?**
At the CDN edge for the user's handshakes — tens of milliseconds to the nearest city instead of
a crossing — with the edge trusted to see plaintext because it caches and shields, and traffic
re-encrypted from edge to origin over pooled connections. At the gateway for the origin's
policy point and one place for certificates, behind which the network must be genuinely
private or services must use mutual TLS. In the pod only when a requirement forbids any
intermediary seeing plaintext, at the cost of a layer-4-only balancer and certificates in
every service. Layered is the usual answer.

**★ What does 0-RTT buy, and why would you not use it for checkout?**
It lets a resuming client send application data in its first flight, saving the handshake's
round trip on top of resumption's saving of the asymmetric work — the fewest round trips to a
first byte, and with QUIC folding the transport handshake in, fewer still. RFC 8446 §2.3 says
0-RTT data is not forward secret and has no guarantee of non-replay between connections: a
captured first flight can be sent again and processed again. A replayed `POST /orders` is a
duplicate order, so 0-RTT is for idempotent, cacheable `GET`s and the gateway rejects early
data on anything else.

**★ What is mutual TLS, and when is it worth its cost?**
TLS where both sides present certificates from a private authority, so the caller's identity is
proven cryptographically rather than assumed from the network: the inventory service accepts
calls only from identities it allows. Worth it when "on the private network" is not a
sufficient credential — shared or multi-tenant networks, a breach model that assumes an attacker
inside, a compliance requirement. The cost is a certificate per service with rotation and a
handshake per pooled connection, usually paid by a sidecar or mesh rather than by each service.

**How is a handshake's cost amortised?**
By reusing the connection: the handshake — one round trip and the asymmetric cryptography in
TLS 1.3 — is paid once per connection, and keep-alive, HTTP/2 multiplexing and pooled
connections between services carry many requests over it. Returning clients resume with a
pre-shared key from the previous connection, skipping the certificate exchange and the expensive
work; 0-RTT removes the round trip too for replay-safe requests; QUIC combines the transport
and TLS handshakes. The design goal is few handshakes, each as short a distance as possible.

**How do you manage certificates so that expiry is never the outage?**
Automate: short-lived certificates from an automated authority, renewed by the platform well
before expiry, deployed alongside the old with an overlap so rotation has no downtime; one
certificate per boundary — edge, gateway, internal — so there are few to rotate; a private
authority issuing internal identities; and monitoring of days-to-expiry as the backstop for
the automation failing. An expiry is a scheduled outage nobody scheduled, and a calendar
reminder is not a control.

**The CDN terminates TLS. Is the path end-to-end encrypted?**
No, and saying so is the mark: the edge decrypts, sees plaintext, and re-encrypts to the
origin. The path is encrypted on every wire, but the CDN is a trusted intermediary — trusted
deliberately, because a cache that cannot read a response cannot cache it or shield the origin.
If a requirement forbids that, the CDN passes TLS through at layer 4 and loses caching for that
route, and termination moves to the origin.

---

← Prev: [09 · DNS as a component](09-dns-as-a-component.md) · Index: [Phase 2 — The request path](README.md) · Next → [11 · HTTP/1.1, HTTP/2 and HTTP/3](11-http-1-1-http-2-and-http-3.md)
