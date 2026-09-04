---
title: "Classifying each subdomain as core, supporting or generic decides where boundaries are worth money — you protect the core with a real model, you keep supporting cheap, and you buy generic rather than modelling it at all"
sidebar_label: "03b · Core, supporting, generic"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against microservices.io *Decompose by subdomain*
> ([microservices.io](https://microservices.io/patterns/decomposition/decompose-by-subdomain.html)),
> which classifies subdomains as **Core** (*"key business differentiators"*), **Supporting**
> (*"related but not distinctive"*) and **Generic** (*"universal functionality"*); Eric
> Evans, *Domain-Driven Design* (2003), Ch. 15 "Distillation", cited by concept.
> Version spine: **JDK 25 · Spring Boot 4.1.0 / Framework 7.0.8 · Spring Cloud train
> 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**.

**Not every part of a system deserves the same care, and pretending otherwise is how teams
spend six weeks perfecting a notification model while the pricing engine — the thing the
company actually competes on — stays a 2,000-line service class. The core/supporting/generic
classification is the budget allocation for design effort, and it directly determines which
boundaries you draw deliberately, which you draw casually, and which you do not draw at all
because you are going to buy the thing instead.**

## The three classes

microservices.io's *Decompose by subdomain* gives the classification in three phrases:

| Class | microservices.io's phrase | Meaning in practice |
|---|---|---|
| **Core** | *"key business differentiators"* | If this is worse than a competitor's, you lose. Nobody else can sell it to you. |
| **Supporting** | *"related but not distinctive"* | You need it, it is specific to you, but being merely adequate is fine. |
| **Generic** | *"universal functionality"* | Every company has this and yours is not special. Buy it. |

For a mid-sized online retailer, an honest classification:

| Subdomain | Class | Why |
|---|---|---|
| Pricing and promotions | **Core** | Margin lives here; the rules are the business's own invention |
| Search and ranking | **Core** | Directly drives conversion |
| Order capture | **Supporting** | Necessary, specific, but nobody buys from you because of the checkout data model |
| Inventory | **Supporting** | Specific rules about reservations and allocation, but not a differentiator |
| Delivery scheduling | **Supporting** or **Core** | Depends entirely on whether same-day delivery is the pitch |
| Payments | **Generic** | Use a payment provider. Do not model card networks. |
| Identity and login | **Generic** | Use an identity provider |
| Email and SMS sending | **Generic** | Use a provider |
| Tax calculation | **Generic** | Buy it — the rules change monthly and are jurisdiction-specific |
| Accounting ledger | **Generic** | Buy it |

Two entries there are the ones that provoke arguments, and both arguments are worth having.

**Delivery scheduling** is the row where the classification is genuinely
company-specific. For a retailer whose entire proposition is two-hour delivery, this is
core and deserves a real model, a dedicated team and a carefully drawn boundary. For a
retailer that posts things second class, it is generic and should be a thin adapter over a
carrier's API.

**Payments** is the row engineers most often want to move to core. It is not, unless you
are a payments company. What *is* often core is the adjacent logic — fraud rules, retry and
dunning strategy, which payment methods to offer to whom. That logic is yours; the card
network mechanics are not.

## How the class changes the boundary decision

**Core.** Draw the boundary deliberately and defend it. A core subdomain gets a rich domain
model, its own ubiquitous language, its own aggregates and invariants, and it is the first
candidate for its own service when scale or team growth demands one. It is also the place
where an anticorruption layer is mandatory: nothing from a generic vendor's model should
reach it unchanged. If a payment provider's `TransactionStatus` enum appears inside your
pricing code, your core has been colonised.

**Supporting.** Draw the boundary, keep the model simple, resist gold-plating. A supporting
subdomain frequently deserves a module rather than a service — it changes at the same rate
as the core it supports, so Common Closure argues for co-location. Splitting a supporting
subdomain out because "it is a separate concern" is the most common way to acquire a
service that costs more than it returns.

**Generic.** Do not draw a boundary around your model of it, because you should not have a
model of it. Draw a boundary around the *vendor*: a thin adapter, a port your code owns, and
an anticorruption layer so that swapping the vendor is a contained change. The boundary
here is an insulation layer, not a domain.

```java
package com.retailer.billing;

/// The port belongs to us. The interface speaks our language, not Stripe's, not Adyen's.
/// A generic subdomain is bought, and the purchase is hidden behind a type we own.
public interface PaymentGateway {

    AuthorisationResult authorise(PaymentRequest request);

    CaptureResult capture(AuthorisationReference reference, Money amount);

    RefundResult refund(CaptureReference reference, Money amount, RefundReason reason);
}
```

```java
package com.retailer.billing.internal.adapter;

import com.retailer.billing.*;
import org.springframework.stereotype.Component;

/// The adapter is the only class in the codebase that has ever heard of the vendor.
/// If this class is the only file that changes when we switch providers, the boundary
/// around the generic subdomain did its job.
@Component
class VendorPaymentGateway implements PaymentGateway {

    private final VendorClient vendor;

    VendorPaymentGateway(VendorClient vendor) {
        this.vendor = vendor;
    }

    @Override
    public AuthorisationResult authorise(PaymentRequest request) {
        var vendorRequest = new VendorAuthRequest(
                request.amount().minorUnits(),
                request.amount().currency().getCurrencyCode(),
                request.instrument().token());
        var response = vendor.authorise(vendorRequest);
        return switch (response.outcome()) {
            case "authorised" -> AuthorisationResult.authorised(
                    new AuthorisationReference(response.id()));
            case "refused"    -> AuthorisationResult.refused(
                    RefusalReason.fromVendorCode(response.refusalCode()));
            case "pending"    -> AuthorisationResult.pending(
                    new AuthorisationReference(response.id()));
            default           -> throw new IllegalStateException(
                    "unmapped vendor outcome: " + response.outcome());
        };
    }

    // capture and refund omitted from this excerpt
}
```

The `default` branch that throws is deliberate. A vendor adding an outcome value must fail
loudly at the boundary rather than being silently mapped to something plausible — an
unmapped state reaching your core is exactly the corruption the layer exists to prevent.

## The distillation question

Evans' *Distillation* chapter frames this as: what is the **core domain**, and can you state
it in a paragraph? The exercise is worth doing literally. Write one paragraph describing the
part of the system that, if a competitor copied it perfectly, would cost you the business.
If the paragraph is about your checkout form, either you are wrong or your company has a
problem that architecture will not fix.

The value of the paragraph is that it survives reorganisations. Team ownership changes;
which subdomain is core does not, unless the business strategy changes — and when the
business strategy changes, the paragraph changing is the earliest architectural signal you
will get.

## The classification decays, and the decay is dangerous

A subdomain that was core five years ago may be generic now, because the market
commoditised it. Recommendation engines were core for retailers in 2015 and are largely
bought in 2026. A team that built a core-grade model then is now maintaining a
differentiator that no longer differentiates, with a boundary, a service, a team and an
on-call rotation attached.

The reverse also happens and is worse. Something classified generic becomes core — a
retailer decides delivery speed is the strategy — and now the strategy depends on a thin
adapter over a carrier API with no model, no invariants and no team. Re-classification
upward is a rewrite; re-classification downward is a deletion. Both are cheaper if you
noticed the classification was stale.

Review the classification when the *business* changes, not on a schedule.

## Gotchas

**★ Symptom: the best engineers are working on the generic subdomains.** Cause: generic
subdomains have clean, satisfying, well-specified problems, and core subdomains have messy
ones full of business exceptions. Fix: this is a staffing decision, not an architecture
decision, but the architecture makes it visible — if the beautifully modelled part of your
codebase is the notification system, look at where the design effort has gone.

**★ Building a generic subdomain because the vendors are all slightly wrong.** They are all
slightly wrong, and your version will be substantially wrong plus you will own it forever.
The cost comparison people skip is not build vs licence fee; it is licence fee vs licence
fee plus ongoing maintenance, on-call, compliance updates and the opportunity cost of the
team. Tax calculation is the classic trap: the rules genuinely do not fit your business, and
they also change in dozens of jurisdictions every year.

**★ Symptom: a vendor's vocabulary appears in core domain classes.** Cause: no
anticorruption layer around a generic subdomain. Fix: the port-and-adapter pair above. The
test is a grep — if the vendor's package name appears outside one adapter package, the
insulation is not there. An ArchUnit rule makes it permanent; see
[26 · ArchUnit rules](26-archunit-rules.md).

**★ Classifying by how interesting the code is.** Core is about business differentiation,
not technical difficulty. A gnarly distributed scheduler may be entirely generic; a
deceptively simple set of discount rules may be the core of the company.

**★ Giving a generic subdomain its own service because "it is clearly separable".**
Separability is not the criterion — the criterion is whether the boundary buys you anything.
A generic subdomain you have bought is already behind a network boundary, at the vendor. Your
adapter is best co-located with whichever context uses it, so the two deploy together and
the mapping stays in step with the domain type it maps to.

**★ Assuming supporting subdomains never deserve services.** They can, once a team owns
them and the change rates genuinely diverge. The point is that "supporting" is not by
itself the argument — the argument is team ownership plus independent change rate, which is
the same argument you would apply anywhere.

## Interview questions

**★ How do you decide whether to build or buy a piece of your system, architecturally?**
Classify the subdomain. If it is a core differentiator — the thing customers choose you for
— build it, model it properly and give it a real boundary, because outsourcing your
differentiator means your product's ceiling is set by a vendor's roadmap. If it is generic —
payments, identity, email, tax, accounting — buy it, and spend the design effort on the
anticorruption layer instead of on the model. Supporting subdomains are the judgement calls:
build, but cheaply, and resist the urge to make them elegant.

**★ Your team wants to build its own authentication service. What do you say?**
That identity is a generic subdomain for almost every company, that the failure modes are
security failures rather than feature gaps, and that the maintenance burden — password
hashing migrations, MFA, session revocation, breach response, standards churn — never ends.
The exception is when identity genuinely is your product, or when a hard constraint such as
data residency or an unusual federation requirement makes every provider unusable, and that
should be demonstrated rather than assumed. What is often legitimately yours is the
*authorisation* model — who may do what in your domain — which is core and should not be
pushed into the identity provider's role model.

**★ A subdomain you classified as generic three years ago is now central to the company's
strategy. What changes?**
Effectively everything: it needs a real domain model where it currently has an adapter, a
team that owns it, deliberate boundaries and invariants, and probably its own service
eventually. The practical path is to grow the model *behind* the existing port — keep the
vendor for the parts that are still commodity, start expressing your own rules in your own
types on your side of the adapter, and shift responsibility across gradually. The mistake is
declaring a rewrite; the port you already own is the seam that makes an incremental move
possible.

**★ Does the classification change how you draw the boundary, or only how much effort you
spend inside it?**
Both, and the boundary effect is the less obvious one. For a core subdomain the boundary is
protective — it exists to stop other models leaking in, so it is strict, explicit, and
enforced by tests. For a generic subdomain the boundary is insulating — it exists to stop a
vendor leaking in, so it is a thin port plus one adapter, and it is deliberately shallow. For
a supporting subdomain the boundary is often just a package, because the thing it supports
changes with it and Common Closure says keep them together.

---

← [Subdomain vs bounded context](03-subdomain-vs-bounded-context.md) · [Topic index](README.md) · Next → [A service is not a context](04-a-service-is-not-a-context.md)
