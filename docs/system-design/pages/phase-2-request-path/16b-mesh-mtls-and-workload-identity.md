---
title: "Mesh mutual TLS replaces \"the network is private, so the caller must be one of us\" with a short-lived certificate that names the workload rather than the pod or its address — which buys encryption in transit, an authenticated caller and an end to the forwarded-header trap, and buys none of user authentication, authorization, or the hops that leave the mesh"
sidebar_label: "16b · Mesh mTLS and workload identity"
sidebar_position: 16.1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-07 against the [SPIFFE overview](https://spiffe.io/docs/latest/spiffe-about/overview/)
> — what SPIFFE is, *"short lived cryptographic identity documents"*, and the stated limit of
> IP-based network policy, all verbatim below; the fetch returned real documentation content, not
> a navigation shell. Certificate issuance from a platform-vouched token, permissive-to-strict
> migration, probe exemptions and trust-root federation are **common practice**, stated as such:
> no vendor defaults, no version numbers, no certificate lifetimes quoted as if measured. The
> sidecar and the two planes are [16](16-service-mesh.md); the compliance framing is
> [Part 9 of the syllabus](../../syllabus/09-security-and-compliance.md). **No sandbox run.**

**The single most defensible reason to adopt a mesh is that it changes what "the caller is
allowed" means: from a statement about the network — this packet came from an address inside our
subnet — to a statement about the workload, proven with a certificate it renews every few
hours.** That is a real change in the threat model, and it is the one thing on the mesh's
feature list that is genuinely hard to get any other way at fleet scale. It is also the feature
most often claimed to do things it does not: it does not identify your users, it does not
authorize anything by itself, and it stops at the edge of the mesh, which is exactly where your
database and your payment provider are. This page is the mechanism, the precise buys-and-does-not,
the migration mode that quietly never ends, and the cheaper rungs of the same ladder.

## What the mesh replaces: trust in the network

The pre-mesh arrangement is on [10](10-tls-termination-and-where-it-lives.md): TLS terminates at
the edge, and inside the cluster the network is trusted because it is the private network.
Authorization is then written against whatever the network can express — an IP range, a subnet, a
pod label — and that is what stops scaling:

> *"Conventional security practices (such as network policies that only allow traffic between
> particular IP addresses) struggle to scale under this complexity."* — *"A first-class identity
> framework for workloads in an organization becomes necessary."* — SPIFFE, *Overview*

> *"SPIFFE, the Secure Production Identity Framework for Everyone, is a set of open-source
> standards for securely identifying software systems in dynamic and heterogeneous
> environments."* — *"The heart of these specifications is the one that defines short lived
> cryptographic identity documents – called SVIDs via a simple API."* — SPIFFE, *Overview*

The reason IP-based rules struggle is the same reason [12](12-service-discovery.md) exists: pod
addresses are recycled within hours, so a rule written against an address is a rule written
against whatever occupies that address next. An identity that names the *workload* survives the
churn.

## The mechanism: a short-lived certificate that names a workload

1. The proxy starts and must prove which workload it is. It presents something the platform
   vouches for — typically a signed service-account token, or an attestation about the node and
   the pod — to the control plane's certificate authority.
2. The CA verifies that claim against the platform's own record and issues a **short-lived
   certificate naming the workload identity**, not the pod name and not the IP.
3. Every connection between two sidecars is TLS in both directions: each end presents its
   certificate, each end verifies the other against the mesh's trust root. Neither application
   knows this happened ([16](16-service-mesh.md)).
4. The proxy renews before expiry, continuously, with nobody deploying anything. Short lifetimes
   are affordable *because* renewal is automatic — and that is also why a control-plane outage
   has a deadline attached to it ([16](16-service-mesh.md)).

The identity comes from the platform's own record of what a workload is — in Kubernetes, in
practice, the pod's service account. That has a consequence people meet late: **two deployments
running under the same service account have the same identity**, and no authorization policy can
tell them apart. One service account per workload is not tidiness; it is the granularity of every
rule you will write afterwards.

## What mTLS buys, and what it does not

| Buys | Precisely what |
|---|---|
| **Encryption in transit inside the cluster** | uniformly, on every service-to-service hop, without a TLS client in any service — usually the line an audit or a contract actually asks for |
| **An authenticated caller** | authorization can be written against an identity that cannot be assumed by whatever else can route to the pod |
| **The end of [03](03-reverse-proxies-and-api-gateways.md)'s forwarded-header trap** | a service can require the peer identity to *be* the gateway, so a pod that reached it directly and set `X-User-Id: 42` is refused at connection time, before the header is read |
| **An audit trail keyed to identities** | rather than to addresses that have since been recycled |
| **Rotation as a non-event** | certificates that expire in hours are renewed by the proxy, so there is no annual expiry incident per service |

| Does not buy | Why people think it does |
|---|---|
| **User authentication** | peer identity says "the orders service is calling"; it says nothing about which buyer. The user's token still rides in the request and is still verified |
| **Authorization** | mTLS with an allow-everything policy proves who is calling and then lets everyone call everyone — an expensive way to draw the trust boundary you already had. The policy is the product; the certificates are the mechanism |
| **Encryption at rest**, in logs, or on the message bus | "encrypted everywhere" is said about the mesh and heard about the system |
| **The hops that leave the mesh** | the database, the cache, the payment provider are ordinary TLS clients in your application, exactly as before — and they are usually where the regulated data is going |
| **Protection from a compromised workload** | a compromised pod holds a valid identity. mTLS bounds *which* identity, not what that identity does — which is why the authorization policy is the point |

The fourth row is the one that decides whether a mesh satisfies a compliance requirement or only
appears to. Walk the actual data path and mark each hop: browser to edge is public TLS
([10](10-tls-termination-and-where-it-lives.md)); edge to gateway and gateway to services can be
mesh mTLS; service to database, service to cache and service to provider are not, unless you
configure TLS in those clients yourself. "We have mTLS" answers the middle of that list only.

## Permissive is a migration state, not a mode

Rollouts go through a **permissive** stage — the server accepts both plaintext and mutual TLS
while its callers move over one at a time — and then to **strict**. Permissive is what makes a
rollout possible without a flag day, and its danger is exactly that it never breaks anything, so
nothing forces the finish. A fleet parked in permissive for a year has the reporting of an
encrypted mesh and the threat model of a flat network: anything that can route to the pod is
still accepted unencrypted and unauthenticated.

The exit is a number, not a decision meeting:

1. **Count plaintext-accepted connections per namespace** — every mesh can report this, and it is
   the only metric that matters during the migration.
2. **Drive it to zero** by finding each source: a health probe from the node, a metrics scraper, a
   VM outside the cluster, a job that was never injected, a legacy client nobody owns.
3. **Flip that namespace to strict**, and watch the same counter stay at zero.
4. **Repeat per namespace.** Flipping the whole mesh at once is how you find out, during the
   outage, which of those five sources existed.

The most reliable member of that list is the **platform's health probe**: it arrives from the
node, not from a mesh peer holding a certificate, so under strict mTLS it is rejected and every
pod fails readiness at the same moment ([02](02-load-balancing-layer-4-vs-layer-7.md) then drains
the entire fleet out of the endpoint set). Meshes provide an exemption or a probe-rewriting
mechanism for exactly this; find yours before you flip, not after.

## The ladder: cheaper rungs of the same wall

| Rung | The identity is | What it misses | Costs |
|---|---|---|---|
| Flat private network | the network itself | everything inside is trusted; no encryption | nothing |
| NetworkPolicy by label or namespace | a label the platform assigns | coarse, not cryptographic, no encryption; label-based rather than proven | already in the platform |
| Transparent node-to-node encryption in the CNI | the **node** | encryption without per-workload identity — two workloads on one node are indistinguishable | a CNI feature flag |
| Per-service certificates from a certificate manager | the workload | you now operate issuance, distribution, rotation and TLS client code per service, in every language | real engineering per service |
| Mesh mTLS | the workload, rotated automatically | the whole cost ledger of [16e](16e-what-a-service-mesh-costs.md) | a mesh |

The middle two rungs are often enough, and saying which rung a requirement actually needs is what
separates "we should get a mesh" from a decision. A requirement that says *encrypted in transit*
is satisfied by the CNI rung. A requirement that says *the caller must be authenticated and
authorized per workload* is not, and that is the sentence that justifies the mesh.

## The storefront

```text
browser → edge / gateway        public TLS from a public CA — 10's job, unchanged, outside the mesh
gateway → catalogue, orders     mesh mTLS, STRICT: each service requires the peer identity to be the gateway's,
                                which is what finally makes 03's forwarded X-User-Id safe
orders → inventory              mesh mTLS: an authorization policy allowing the orders identity to call
                                inventory's reserve method, and nothing else to call it at all
identities                      one service account per deployment — catalogue, orders, inventory, gateway —
                                because two deployments sharing an account share one identity and no policy
                                can separate them
services → PostgreSQL, Redis    OUTSIDE the mesh: TLS configured in the database and cache clients if it is
                                required, because the mesh's certificate story stops at the pod boundary
orders → payment provider       OUTSIDE: public TLS to the provider's name; the provider has never heard of our
                                trust root. The mesh's contribution is an egress rule, not mTLS
health probes                   exempted from strict mTLS, or the platform's probe is rejected and every pod
                                fails readiness the moment strict is enabled
migration                       permissive per namespace, plaintext-accepted counter to zero, then strict —
                                catalogue first, checkout last
```

The two "OUTSIDE" rows are the honest answer to "are we encrypted everywhere": the mesh covers
service to service, and the card data goes to the provider over a connection the mesh never
touches.

## Gotchas

**★ Symptom: an audit found plaintext connections accepted on a fleet described as "mTLS
everywhere".** Cause: permissive mode left on permanently, because it never broke anything. Fix:
treat permissive as a migration state with an exit criterion — plaintext-accepted connections at
zero for that namespace, then strict — with that counter on a dashboard someone actually reads.

**★ Symptom: every pod failed readiness the moment strict mTLS was enabled.** Cause: probe
traffic originates from the node, not from a mesh peer with a certificate, so strict mode rejects
it and the platform marks every pod unready. Fix: exempt the probe port or use the mesh's
probe-rewriting mechanism *before* flipping, and roll strict out one namespace at a time after
that namespace's plaintext counter has reached zero.

**★ Symptom: mTLS is on and every service can still call every other service.** Cause: mutual TLS
with a default allow-all authorization policy — the certificates prove identity and nothing
consumes the proof. Fix: an authorization policy per service naming the identities allowed to call
it, rolled out in the mesh's dry-run or audit mode first so you can see what it *would* have
denied before it denies it.

**Symptom: the authorization policy cannot tell two services apart.** Cause: workload identity
derives from the platform's service account, and both deployments run under the same one — often
the namespace default. Fix: one service account per workload, created with the deployment, and
treated as the security identity it now is rather than as boilerplate.

**Symptom: "we are compliant, we have mTLS", but the regulated data leaves over a connection the
mesh never sees.** Cause: the mesh covers service-to-service hops only; the database, the cache,
the message bus and the external provider are outside it. Fix: walk the data path hop by hop and
mark which mechanism covers each — public TLS at the edge, mesh mTLS inside, TLS configured in the
database and provider clients — and present that list, not the mesh.

**Symptom: a VM, another cluster or a partner service stopped being able to call in.** Cause: it
holds no identity from this mesh's trust root, and strict mode rejects it. Fix: decide
deliberately per caller — federate the trust roots, put the caller behind a gateway that does hold
an identity, or exempt that port — and record the exemption where the next person will find it.

**Symptom: a compromised pod was able to call everything its identity allowed.** Cause: mTLS
bounds which identity is calling, not what that identity may do. Fix: least-privilege
authorization per identity — method and path prefix, not just "may connect" — and treat the
identity, not the network, as the blast radius you are sizing.

## Interview questions

**★ How is mesh mTLS different from "we are on a private network", or from a NetworkPolicy?**
It replaces trust in the network with a cryptographic identity per workload. SPIFFE's
documentation states the problem directly — conventional practices *"such as network policies that
only allow traffic between particular IP addresses"* struggle to scale — and the answer as *"short
lived cryptographic identity documents"* issued to workloads. In a mesh the proxy proves which
workload it belongs to using something the platform vouches for, receives a short-lived
certificate naming the workload rather than the pod or the IP, and every connection is TLS in both
directions with both ends verifying against the mesh's trust root. The reason the IP rule fails is
the reason service discovery exists: addresses are recycled within hours, so a rule about an
address is a rule about whoever occupies it next. The near neighbour is a CNI's transparent
node-to-node encryption, and the honest distinction is that its identity is the *node* — two
workloads on one node are indistinguishable to it.

**★ What does mesh mTLS not give you?**
Four things, and each is regularly assumed. It is not user authentication: peer identity says the
orders service is calling and nothing about which buyer, so the token still rides in the request
and is still verified. It is not authorization: certificates prove identity, and a default
allow-all policy means everyone can still call everyone, so the policy is the product and the
certificates are the mechanism. It is not encryption at rest, in logs or on the bus. And it stops
at the mesh boundary — the database, the cache and the payment provider are ordinary TLS clients
in your application — which is the row that decides whether a compliance claim is true, because
that is usually where the regulated data is going. Add a fifth if pressed: it does not protect you
from a compromised workload, which holds a perfectly valid identity; it bounds which identity is
calling, not what that identity may do.

**★ Our services trust an `X-User-Id` header from the gateway. Does a mesh fix that?**
It fixes the network half, which is the half that is hard to guarantee otherwise. The rule on
[03](03-reverse-proxies-and-api-gateways.md) is that a service trusting a forwarded identity
header must be unreachable by anything except the gateway, or a client that can reach it directly
is authenticated as anyone — and "unreachable" enforced by network configuration is one
misconfiguration away from false. With mesh mTLS the service requires the peer certificate
identity to be the gateway's, so an arbitrary pod is refused at connection time, before the header
is parsed. It does not make the header trustworthy in general: anything inside the allowed
identity can still set it, so a service called by more than the gateway either verifies the user's
token itself against the cached key or receives the identity in a signed form.

**What is permissive mTLS, and why is it dangerous to leave on?**
Permissive means the server accepts both plaintext and mutual TLS, which is what allows a rollout
without a flag day: inject the proxies, let callers switch one at a time, break nothing in
between. The danger is exactly that it breaks nothing, so there is no pressure to finish, and a
fleet parked in permissive has the reporting of an encrypted mesh with the threat model of a flat
network. The exit is a number rather than a decision: plaintext-accepted connections per
namespace, driven to zero by finding each source — the node's health probe, a metrics scraper, a
VM outside the cluster, an uninjected job, a legacy client — then that namespace flipped to
strict, then the next. Flipping everything at once is how you learn which of those five existed.

**Where does a workload's identity actually come from, and what breaks if two services share
one?**
From the platform's own record of what the workload is: the proxy presents something the platform
signs — in practice the pod's service-account token, or an attestation about the node and pod —
and the mesh's CA issues a certificate naming that identity only after verifying the claim against
the platform. The consequence is that the service account *is* the security identity, so two
deployments running under the same account, which is common when nobody created one per workload,
are indistinguishable to every authorization policy you subsequently write: you cannot allow the
orders service to call inventory without also allowing whatever else shares that account. One
service account per workload, created alongside the deployment, is the fix, and it has to happen
before the policies are written rather than after.

**A requirement says "encrypted in transit everywhere". Does that justify a mesh?**
On its own, no — it justifies the third rung of the ladder. Transparent node-to-node encryption in
the CNI satisfies "encrypted in transit" with a feature flag and no per-pod proxy, and TLS
configured in the database and provider clients covers the hops the mesh would not have covered
anyway. What a mesh adds above that rung is *identity*: the caller is authenticated as a specific
workload, so authorization can be written per workload and audited per workload. So the question
to put back is whether the requirement is about confidentiality on the wire or about authenticated,
authorized service-to-service access. The first is cheaper than a mesh; the second is the sentence
that justifies one, and it should be quoted from the requirement rather than inferred.

← Prev: [16 · Service mesh](16-service-mesh.md) · Index: [Phase 2 — The request path](README.md) · Next → [16c · Mesh retries, timeouts, breakers](16c-mesh-retries-timeouts-and-circuit-breaking.md)
