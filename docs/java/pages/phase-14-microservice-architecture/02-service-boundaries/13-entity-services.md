---
title: "A service per entity looks like the most obvious decomposition available and Michael Nygard named it an anti-pattern for a precise reason: real features span entities, so entity services guarantee that every feature is a distributed operation across several of them"
sidebar_label: "13 · Entity services"
sidebar_position: 21
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against Michael Nygard, *The Entity Service Antipattern* (2017)
> ([michaelnygard.com](https://www.michaelnygard.com/blog/2017/12/the-entity-service-antipattern/));
> microservices.io *Decompose by business capability*
> ([microservices.io](https://microservices.io/patterns/decomposition/decompose-by-business-capability.html))
> and *Self-contained Service*
> ([microservices.io](https://microservices.io/patterns/decomposition/self-contained-service.html)).
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train
> 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**.

**`CustomerService`, `OrderService`, `ProductService`, `AddressService`. It is the
decomposition that requires no analysis: you already have the entities, so make each one a
service. Nygard's argument against it is not aesthetic — it is that features are not shaped
like entities. Any interesting feature needs several of them, so an entity decomposition
converts every feature into a distributed operation, coupling the services both at runtime
and at design time, and delivering none of the independence the split was for.**
## "Anti-pattern" is a precise claim here, not an insult

Nygard's post opens by defining the word, and the definition is worth having because it is what makes
the charge falsifiable rather than rhetorical:

> *"a commonly-rediscovered solution to a problem in a context, that inadvertently creates a
> resulting context we like less than the original context."*

Three things have to be true for that to apply, and entity services satisfy all three:

1. **Commonly rediscovered.** Nobody reads a paper and adopts entity services; every team derives them
   independently from their own entity list. That is what makes the pattern worth naming — it will be
   proposed again in your next design review by someone who has never heard of it.
2. **A solution to a real problem in a real context.** "How do we decompose this?" is a genuine
   question and "one service per noun" is a genuine answer to it, which is why it survives review.
3. 🔴 **A resulting context we like less than the original.** This is the load-bearing clause and the
   one that makes the claim testable: the assertion is not that entity services are inelegant, it is
   that they leave you **worse off than the monolith you started with.** If your entity-service
   architecture is not worse than the monolith it replaced, this page's argument does not apply to
   you.

⚠️ **Provenance, stated plainly:** Nygard's post diagnoses the problem and **does not propose a
replacement** — it closes with *"In a future post, we'll look at what to do instead of entity
services."* Everything below under *The capability version* is this corpus's answer, derived from the
invariant criterion in [06 · Invariants are the criterion](06-invariants-are-the-criterion.md), and
it is **not** attributable to Nygard. Nor does his post argue in loose-coupling / high-cohesion terms,
so do not cite him for that either.

## The two couplings Nygard names

**Operational coupling.** A single request activates several services, so the request's
availability is the product of theirs and its latency is their sum. His worked example is
calculating the total price of a basket, which *"involves the cart, the products (for their
individual prices) and the account to find the applicable sales tax or VAT"* — three or four
services for one screen.

**Semantic coupling.** *"A change to any of the entity services has the potential to ripple
through into the online shopping service"*, because the consumer must understand each
entity's shape and must translate between them. The consumer accumulates the knowledge that
the entity services declined to hold.

The second is the one that kills you. Operational coupling shows up on a dashboard and can
be attacked with caching and batching. Semantic coupling shows up as a release calendar.

### The number that makes operational coupling concrete

Nygard's own worked example is a shopping cart price calculation, and it activates *"four of the five
services in our architecture."* That is the whole argument in one observation: a single, ordinary,
read-only user action needs almost the entire system to be up.

**The consequence is availability arithmetic, and it compounds silently.** Each service is
individually excellent; the operation is the product of all of them. Nothing in a per-service SLO
dashboard shows this, because every service is meeting its target while the *operation* the customer
cares about is not — which is why an entity-service architecture tends to produce the specific
complaint "everything is green and the site is broken".

🔴 **Note what makes this different from ordinary distribution.** A capability service also calls
other services sometimes. The distinguishing property of an entity architecture is that it happens on
the **common path** rather than the exceptional one: not a rare cross-boundary operation, but every
page load, because the decomposition guaranteed that no single service can answer a business question
on its own.

## The mechanism, in one sentence

An entity service exposes **fields** and no **decisions**. Every rule about those fields
therefore lives in the callers. With three callers, the rule exists three times. When it
changes, three teams change it, and one of them will be late.

That is the whole failure and it explains every symptom:

- Why entity services get chatty: callers must fetch everything, because the service cannot
  answer a question, only return rows.
- Why they never stabilise: every new consumer needs one more field, so the DTO grows
  forever.
- Why bugs cluster in consumers: the rules are there, duplicated, and the duplicates drift.
- Why the "orchestrator" appears: someone notices the rules are scattered and builds a
  service to hold them, which owns no data and can enforce nothing —
  [17 · The god service](17-the-god-service.md).

## The example, in Java

```java
// ANTI-PATTERN. Three entity services, and the pricing rule lives in the caller.
package com.retailer.checkout;

import org.springframework.stereotype.Service;

@Service
public class CheckoutService {

    private final CartClient carts;
    private final ProductClient products;
    private final AccountClient accounts;
    private final TaxClient tax;

    // constructor omitted

    /// Four remote calls, and — the real damage — the business rules about which price
    /// applies, whether the customer's segment discount stacks with a promotion, and
    /// how tax is computed for a mixed basket are all *here*, in a consumer that owns
    /// none of the data and speaks for none of the departments involved.
    public BasketTotal total(CartId cartId) {
        var cart = carts.get(cartId);
        var account = accounts.get(cart.accountId());
        var lines = cart.lines().stream()
                .map(line -> {
                    var product = products.get(line.productId());
                    var unit = account.segment() == Segment.TRADE
                            ? product.tradePrice()      // a pricing rule, in checkout
                            : product.listPrice();
                    return new PricedLine(line.productId(), line.quantity(), unit);
                })
                .toList();
        var net = lines.stream().map(PricedLine::lineTotal).reduce(Money.zero(), Money::plus);
        var vat = tax.calculate(net, account.taxJurisdiction());
        return new BasketTotal(net, vat, net.plus(vat));
    }
}
```

Count what is wrong. Four network calls per basket view. A pricing rule (`TRADE` uses trade
price) implemented in checkout, where Pricing cannot see it and will not know when it needs
changing. A tax jurisdiction read from an account entity, so the rule about which
jurisdiction applies is split between Accounts and Checkout. And a second consumer — the
mobile app's basket endpoint, or the quote generator, or the reorder flow — will implement
all of it again.

The diagnosis is Nygard's. The cure is not — see
[13c · What to build instead](13c-what-to-build-instead.md).

## Gotchas

**★ Symptom: a service whose API is a mirror of its table.** Cause: entity decomposition.
Fix: ask what the service can refuse, and why. If the answer is "nothing, except validation
of types", the rules are in the callers and the boundary is wrong.

**★ Symptom: the same business rule implemented in three consumers.** Cause: the service
that owns the data does not own the rule. Fix: move the rule into the owner and replace the
three implementations with one call. This is usually a bigger political change than a
technical one, because it removes autonomy from three teams.

**★ Symptom: a DTO that grows every sprint.** Cause: each new consumer needs a different
subset, so the response accretes fields. Fix: an entity service cannot escape this, because
it cannot know what the caller is asking; a capability service can, because the caller asks a
question rather than requesting a row.

**★ Symptom: an orchestrator appearing to hold rules that "do not fit anywhere".** Cause:
the entity services refused to hold them. Fix: the rules do fit somewhere — with the state
they constrain. The orchestrator is a symptom; deleting it without moving the rules just
scatters them again.

**★ Symptom: every service meets its SLO and customers report the site is broken.**
Cause: operational coupling. The per-service dashboards measure services; the customer experiences an
*operation*, which needs several of them, and its availability is the product rather than the minimum.
Nygard's cart example needs *"four of the five services in our architecture"* for one price
calculation.
Fix: measure the operation, not the components. An SLO on `calculateCartPrice` that spans every
service it touches makes the coupling visible in the only place anybody looks during an incident:
```java
// the span that matters is the business operation, not each hop inside it
@Observed(name = "cart.price.calculate")
public CartPrice calculate(CartId id) { … }
```

**★ Symptom: somebody proposes entity services again, eighteen months after they were removed.**
Cause: the pattern is *"commonly-rediscovered"* by construction — it is derived independently from an
entity list, so it arrives from people who have never encountered the argument against it.
Fix: keep the rejection recorded with its reasoning where design proposals are reviewed, and make the
counter-argument the invariant test rather than an appeal to authority. "Which business rule does this
service enforce alone?" settles it in one question and does not require anyone to have read a blog
post.

## Interview questions

**★ What is the entity service anti-pattern and what specifically goes wrong?**
It is decomposing by data entity — a service per `Customer`, `Order`, `Product` — and the
problem is that features are not shaped like entities. Any real feature needs several, so
every feature becomes a distributed operation. Nygard names two consequences: operational
coupling, where one request activates several services so availability multiplies and latency
adds; and semantic coupling, where a change to any entity service ripples into its consumers.
The underlying mechanism is that an entity service exposes fields and no decisions, so the
rules about those fields live in the callers, duplicated once per caller, and they drift.

**★ In what precise sense are entity services an "anti-pattern", and what would falsify the claim?**
Nygard's definition is *"a commonly-rediscovered solution to a problem in a context, that
inadvertently creates a resulting context we like less than the original context"* — so the claim is
not aesthetic. It has three testable parts: the pattern is arrived at independently rather than
learned, it genuinely answers a real question, and it leaves you **worse off than what you had**. The
last clause is what makes it falsifiable: if an entity-service architecture is not worse than the
monolith it replaced, the charge does not stick. In practice it usually is worse, and the mechanism is
named — operational coupling, where one ordinary user action needs most of the system up, and semantic
coupling, where changes *"ripple through into"* dependants that end up *"brokering between data
formats"*.

**★ Nygard diagnoses entity services. What does he say to do instead?**
Nothing — and that is worth knowing before citing him for a solution. The post ends with *"In a
future post, we'll look at what to do instead of entity services."* Its contribution is the diagnosis
and the naming of the two couplings. The capability-service answer this page gives comes from
elsewhere: the invariant criterion, which says a service boundary is legitimate when the service
enforces a rule by itself, and that a service enforcing no rule alone is a table with an HTTP
interface. Attributing that conclusion to Nygard's post is a citation that will not check out.

**★ Is a CRUD API ever acceptable for a service?**
Yes, when there genuinely are no domain rules — a media library, a document store, a settings
service. The test is whether anything anywhere can refuse a change for a business reason. If
nothing can, there is nothing to encapsulate and a CRUD API is honest rather than lazy. That
is essentially the definition of a generic subdomain, and those are usually bought rather
than built anyway. For anything in your core domain the answer is no, because core domains
are made of rules.


---

← [Why the layering comes back](12b-why-the-layering-comes-back.md) · [Topic index](README.md) · Next → [CRUD is not a capability](13b-crud-is-not-a-capability.md)
