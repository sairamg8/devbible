---
title: "A Context Map records the political and technical relationships between bounded contexts — classifying interactions as upstream/downstream, mutually dependent, or separate ways before drawing lines in architecture"
sidebar_label: "30 · Context mapping"
sidebar_position: 49
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against Eric Evans, *Domain-Driven Design Reference* (2015) — the nine
> context-mapping pattern definitions, reproduced verbatim in the ddd-crew *Context Mapping Guide*
> ([github.com/ddd-crew/context-mapping](https://github.com/ddd-crew/context-mapping)); Eric Evans,
> *Domain-Driven Design* (Addison-Wesley, 2003), Chapter 14 *Maintaining Model Integrity*.
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood"**. Documentation-validated; **no sandbox run**.

**A microservice architecture cannot be designed solely by drawing technical boxes on a white board; it must account for organizational dynamics, team autonomy, and leverage. Evans' Context Map is both an architectural and organizational model that makes explicit the relationships between bounded contexts. Every interaction between domains falls into one of three fundamental structural categories: asymmetric upstream/downstream relationships where upstream dictates contracts, mutually dependent relationships where teams must synchronize releases, or completely independent domains going separate ways. By documenting these relationships before authoring code, engineering teams prevent unrealistic assumptions about API stability, cross-team cooperation, and operational independence.**

## The map reflects reality, not aspirations

A common failure in software architecture is drawing an idealized diagram showing ten microservices interacting as polite, equal peers. In production, however, teams have unequal leverage, differing release cadences, conflicting priorities, and legacy systems that cannot be changed.

A Context Map documents the actual operating environment:
- Which team holds the leverage when an API change is needed?
- Will upstream accommodate downstream feature requests?
- Are two services truly independent, or do they fail together if one changes?

Conway's Law dictates that systems mirror the communication structures of the organizations that build them. A Context Map is the formal document that acknowledges this reality, classifying each boundary into an explicit pattern.

## The three relationship topologies

Every interaction between two bounded contexts belongs to one of three organizational topologies:

```text
1. Asymmetric (Upstream / Downstream)
   [ Upstream (U) ] ─────────────► [ Downstream (D) ]
   (Changes cascade downstream; upstream is indifferent)

2. Mutually Dependent (Symmetric)
   [ Context A ] ◄───────────────► [ Context B ]
   (Partnership or Shared Kernel; neither can ship alone)

3. Free (Independent)
   [ Context A ]                   [ Context B ]
   (Separate Ways; zero integration, duplication accepted)
```

### 1. Asymmetric: Upstream / Downstream (U / D)

The upstream context (U) can deliver its features independently of downstream. The downstream context (D), however, depends directly on the upstream system's data, uptime, and contract stability. Actions taken upstream dictate downstream success.

Patterns within this category include:
- **Customer-Supplier:** Downstream has leverage; upstream agrees to prioritize downstream requests.
- **Conformist:** Downstream has no leverage; downstream adopts upstream's model without translation.
- **Anticorruption Layer (ACL):** Downstream insulates itself by building an explicit translation layer.
- **Open Host Service / Published Language (OHS / PL):** Upstream provides a standardized, well-documented public API for many consumers.

### 2. Mutually Dependent: Symmetric Collaboration

Neither context can succeed without the other. Changes must be planned jointly, and deployments are frequently synchronized.

Patterns within this category include:
- **Partnership:** Two teams agree to synchronize development, roadmaps, and releases.
- **Shared Kernel:** Two contexts share a common subset of the domain model and database tables.

### 3. Free: Independent Coexistence

The cost of integrating two domains exceeds the value delivered. The teams choose **Separate Ways**, intentionally duplicating functionality or utilizing manual processes rather than establishing technical coupling.

## The nine canonical DDD patterns

Evans identified nine structural patterns governing context maps:

| Pattern | Topology | Dynamic | Primary use case |
|---|---|---|---|
| **Partnership** | Symmetric | Mutual cooperation | Two co-dependent core teams in the same organization |
| **Shared Kernel** | Symmetric | Shared code/schema | Tightly coupled subdomains sharing high-churn logic |
| **Customer-Supplier** | Asymmetric | Downstream has leverage | Core domain depending on internal supporting service |
| **Conformist** | Asymmetric | Downstream conforms | Integrating with dominant, well-designed SaaS or internal standard |
| **Anticorruption Layer** | Asymmetric | Downstream translates | Integrating with legacy systems or unruly vendor APIs |
| **Open Host Service** | Asymmetric | Upstream standardizes | Service offering a public API to numerous downstream callers |
| **Published Language** | Asymmetric | Standardized contract | Stable XML, JSON, or Protobuf schemas shared fleet-wide |
| **Separate Ways** | Independent | Zero integration | Specialized needs where integration cost exceeds duplication |
| **Big Ball of Mud** | Legacy | Undefined boundaries | Brownfield legacy systems with tangled boundaries |

## The nine definitions, verbatim

A context map is only useful if everyone reading it means the same thing by the words on it, and
these are short enough that there is no excuse for paraphrasing them. All nine are *DDD Reference*
(2015) text.

| Pattern | Definition |
|---|---|
| **Partnership** | *"Where development failure in either of two contexts would result in delivery failure for both, forge a partnership between the teams in charge of the two contexts."* |
| **Shared Kernel** | *"Designate with an explicit boundary some subset of the domain model that the teams agree to share. Keep this kernel small."* |
| **Customer/Supplier** | *"Establish a clear customer/supplier relationship between the two teams, meaning downstream priorities factor into upstream planning."* |
| **Conformist** | *"Eliminate the complexity of translation between bounded contexts by slavishly adhering to the model of the upstream team."* |
| **Anticorruption Layer** | *"As a downstream client, create an isolating layer to provide your system with functionality of the upstream system in terms of your own domain model."* |
| **Open Host Service** | *"A protocol that gives access to your subsystem as a set of services. Open the protocol so that all who need to integrate with you can use it."* |
| **Published Language** | *"Use a well-documented shared language that can express the necessary domain information as a common medium of communication."* |
| **Separate Ways** | *"Declare a bounded context to have no connection to the others at all, allowing developers to find simple, specialized solutions."* |
| **Big Ball of Mud** | Mixed models and inconsistent boundaries, to be **isolated** from other bounded contexts rather than integrated with |

🔴 **Two of these are not in the 2003 book.** *Partnership* and *Big Ball of Mud* were added in the
*Domain-Driven Design Reference* (2015). Chapter 14 of *Domain-Driven Design* carries the other seven
plus Bounded Context, Continuous Integration and Context Map itself. This matters because a great many
articles cite Partnership to "Evans, Chapter 14", and a reader checking your page against the book
will not find it — see [35 · Partnership and separate ways](35-partnership-and-separate-ways.md).

## Reading the map as a work plan, not a diagram

A context map that hangs on a wall and changes nothing is a drawing. The value comes from the fact
that **each pattern implies a different piece of work**, and the map is what assigns it:

| Relationship on the map | What it commits somebody to |
|---|---|
| **Partnership** | Joint planning, synchronised releases, a shared integration suite — an ongoing cost, on both roadmaps |
| **Customer/Supplier** | The supplier's backlog has downstream items in it. If it does not, this is not the relationship you have |
| **Conformist** | Nothing to build, and a standing acceptance that upstream changes become your changes |
| **ACL** | A layer to write, own and eventually retire — [29 · Anticorruption layer](29-anticorruption-layer.md) |
| **Open Host / Published Language** | A contract with a compatibility promise, and someone to keep it — [34 · Open host and published language](34-open-host-and-published-language.md) |
| **Separate Ways** | An explicit decision *not* to integrate, which needs recording precisely so it is not re-litigated quarterly |
| **Shared Kernel** | Dual ownership, joint CI, a mutual veto — [33 · Shared kernel](33-shared-kernel.md) |
| **Big Ball of Mud** | Containment: an ACL at every edge, and no new dependencies on it |

**The most useful question to ask of a finished map is which relationship nobody is paying for.** A
map showing Customer/Supplier where the supplier's backlog contains nothing from the customer is not
describing the system; it is describing what someone hoped. That relationship is Conformist and
labelling it honestly changes what the downstream team plans to build.

## Documenting the map

A Context Map should be maintained in version control alongside architectural decision records (ADRs). Teams often use textual notations:

```text
[Order Context] [U, OHS, PL] ───► [D, CF]  [Billing Context]
[Order Context] [D, ACL]     ◄─── [U]      [Legacy Warehouse]
[Order Context] [P]          ◄──► [P]      [Fulfillment Context]
[Order Context] [S]          x──x [S]      [Marketing Recommendations]
```

This map reveals critical architectural realities at a glance:
- `Order` provides an Open Host Service that `Billing` conforms to.
- `Order` must maintain an Anticorruption Layer to survive `Legacy Warehouse`.
- `Order` and `Fulfillment` are in a tight `Partnership` requiring shared release planning.
- `Order` and `Marketing` go `Separate Ways` to prevent coupling the core sales engine to experimental recommendation algorithms.

## Gotchas

**★ Symptom: Downstream team is blocked for three sprints waiting for an upstream team to add an API field.**
Cause: Misclassifying the relationship. The downstream team believed they were in a Customer-Supplier relationship, but upstream treated them as Conformist, prioritizing external roadmaps.
Fix: Recognize the true power dynamic. Downstream must build an Anticorruption Layer or use API composition rather than waiting for unpromised upstream changes.

**★ Symptom: Two "independent microservices" must always be deployed together in lockstep.**
Cause: An undeclared Partnership or Shared Kernel disguised as independent microservices.
Fix: Acknowledge the mutual dependency. Merge the services into a single deployable, or explicitly manage the shared dependency through consumer-driven contract testing.

**★ Symptom: Context map depicts an idealized future architecture that contradicts current code.**
Cause: Drawing aspirations rather than reality.
Fix: A Context Map must reflect the codebase as it exists today on disk. Use import graphs and dependency analysis to validate declared relationships.

**★ Symptom: the map says Customer/Supplier and the downstream team has been waiting two quarters for a field.**
Cause: the label records an aspiration. The defining property is that *"downstream priorities factor
into upstream planning"*, and if nothing downstream has ever appeared in the upstream's backlog, the
property does not hold.
Fix: relabel the edge Conformist and let the downstream team plan accordingly — either conform, or
build an ACL and stop waiting. 🔴 The relabelling is the deliverable: a wrong label costs a team a
quarter of blocked work, because they keep waiting for a negotiation the map told them they were
entitled to.

**★ Symptom: someone cites Partnership to Evans Chapter 14 and a reviewer cannot find it.**
Cause: Partnership is a *DDD Reference* (2015) pattern and is not in the 2003 book. Big Ball of Mud is
the other one in that category.
Fix: cite the Reference, or the ddd-crew guide that reproduces it verbatim. Getting the provenance
right is not pedantry here — a citation that does not check out is how a whole page loses its
credibility with the one reader who verifies things.

**★ Symptom: the map has an edge to a legacy system labelled with a pattern, and the pattern keeps changing.**
Cause: the upstream is a Big Ball of Mud — its model is inconsistent, so no single relationship
describes it and each integration point ends up labelled differently.
Fix: label the system itself as Big Ball of Mud and adopt the one strategy it admits: **isolate**.
An ACL at every edge, and a standing rule that nothing new depends on it directly. Trying to name a
per-edge relationship with a system that has no coherent model is a category error the map should
record rather than paper over.

**★ Symptom: Upstream makes a breaking API change that brings down four downstream services in production.**
Cause: Upstream failed to govern its API as an Open Host Service with backwards-compatible Published Language contracts.
Fix: Establish explicit deprecation policies and semantic versioning for upstream public contracts.

## Interview questions

**★ What is a Context Map in Domain-Driven Design, and what is its role in microservice architecture?**
A Context Map is an architectural model that identifies the bounded contexts within an enterprise and explicitly defines the technical and organizational relationships between them. In microservices, it bridges organizational reality with software architecture. It classifies how services communicate, which teams have leverage, where translation layers are required, and where mutual dependencies mandate coordinated planning, preventing architects from treating all microservices as autonomous peers.

**★ What does the Upstream/Downstream (U/D) notation signify in a Context Map?**
Upstream/Downstream defines the direction of influence and dependency. The Upstream context (U) delivers features and dictates contracts independently of Downstream. The Downstream context (D) depends on the Upstream service's availability and data representations. Consequently, changes made by the Upstream team cascade downstream, requiring Downstream to either conform, translate via an ACL, or negotiate changes as a Customer.

**★ Why is the "Partnership" pattern difficult to scale across multiple teams?**
A Partnership requires symmetric collaboration: both teams must coordinate backlogs, synchronize release schedules, and mutually agree on contract changes. While viable between two closely aligned teams, scaling Partnership to three or more teams creates an exponential coordination penalty, turning autonomous development into an organizational gridlock of joint planning meetings.

**★ Which of the nine context-mapping patterns are not in Evans' 2003 book?**
Partnership and Big Ball of Mud. Both were introduced in the *Domain-Driven Design Reference* (2015).
Chapter 14 of *Domain-Driven Design* — *Maintaining Model Integrity* — carries Shared Kernel,
Customer/Supplier, Conformist, Anticorruption Layer, Separate Ways, Open Host Service and Published
Language, alongside Bounded Context, Continuous Integration and the Context Map itself. It is worth
knowing because the misattribution is extremely common in secondary sources, and because a citation a
reader cannot verify undermines everything else on the page.

**★ What makes a context map useful rather than decorative?**
That each edge commits somebody to work. Partnership means joint planning and synchronised releases
on two roadmaps; Customer/Supplier means downstream items appear in the upstream's backlog; ACL means
a layer to write, own and eventually retire; Separate Ways means an explicit decision not to
integrate. A map whose edges imply no work is a drawing of boxes. The sharpest question to ask of a
finished one is which relationship nobody is paying for — that edge is almost always mislabelled, and
relabelling it changes what a team plans to build next quarter.

**★ What is the "Separate Ways" pattern, and when is it the correct architectural choice?**
Separate Ways is an intentional decision not to integrate two bounded contexts. It is the correct architectural choice when the cost of integration (network latency, shared models, coordination overhead, maintenance of adapters) exceeds the business value of sharing data. Teams accept duplicate code or manual workflows in exchange for total autonomy and zero technical coupling.

---

← [Where the ACL lives](29b-where-the-acl-lives.md) · [Topic index](README.md) · Next → [Customer-supplier](31-customer-supplier.md)
