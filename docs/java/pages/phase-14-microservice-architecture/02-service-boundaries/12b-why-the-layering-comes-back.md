---
title: "A team that understands every argument against layered services will still produce them, because the architecture is a copy of the organisation's communication structure rather than a decision anybody made — which is why re-drawing the services without re-drawing the teams reverts within a year"
sidebar_label: "12b · Why the layering comes back"
sidebar_position: 20
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against Melvin Conway, *How Do Committees Invent?* (1968), at
> [melconway.com](https://www.melconway.com/Home/Committees_Paper.html); microservices.io — the dark
> energy and dark matter force descriptions
> ([microservices.io](https://microservices.io/post/architecture/2023/03/26/dark-energy-dark-matter-force-descriptions.html));
> the `git-log` documentation.
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**. Documentation-validated; **no sandbox run**.

**[12 · Splitting by layer](12-splitting-by-layer.md) establishes that the layered split is wrong and shows what it looks like in Java. The uncomfortable part is that knowing all of it does not stop it happening. Teams who can recite the argument still ship `web-service`, `business-service` and `data-service`, and teams who successfully merge them find the layering reassembling itself eighteen months later out of nobody's decision. The explanation is not ignorance and it is not discipline — it is that the architecture is a homomorphic image of the organisation, so the design that matches a front-end team, a back-end team and a DBA team is the layered one, and it will keep being re-derived until the communication structure changes. That makes the org change the load-bearing half of the migration, and it is usually somebody else's decision — which in turn changes what an honest plan looks like when you cannot get it.**

## Why teams keep choosing it anyway: Conway, not ignorance

The strongest version of this page's argument is not "people do not know better". Teams that know all
of the above still produce layered services, and the reason is
[14 · Conway and the org chart](14-conway-and-the-org-chart.md):

> *"organizations which design systems (in the broad sense used here) are constrained to produce
> designs which are copies of the communication structures of these organizations."*

An organisation with a front-end team, a back-end team and a DBA team **cannot easily produce
anything but a layered architecture**, because the design that matches its communication structure is
the layered one. The architecture is not a decision somebody made badly; it is a reflection.

🔴 **This is why re-drawing the services without re-drawing the teams reverts.** A team can merge
`web-service`, `business-service` and `data-service` into three capability services in a quarter, and
if the same three functional teams still own the same three technical specialities, the next six
features will re-introduce the layering — as internal packages first, then as new services. Conway's
own conclusion points the same way: *"a design effort should be organized according to the need for
communication"*, and *"flexibility of organization is important to effective design."*

**The practical consequence for anyone planning this migration:** the org change is the load-bearing
half and it is somebody else's decision. If you cannot get it, the honest plan is a modular monolith
with enforced module boundaries — [25 · Verifying the boundary](25-verifying-the-boundary.md) — not
capability services that will re-layer themselves.

## Proving it to an organisation that disagrees

"Our services are coupled" is an opinion until it is a number. Two measurements settle it, and both
come from data the organisation already has.

**1 · Co-change across the layer repositories.** If the split were sound, a feature would touch one
repository. Count how often it touches three:

```bash
# Commits that reference the same ticket ID across all three layer repos
for repo in web-service business-service data-service; do
  git -C "$repo" log --since="6 months ago" --pretty=format:'%s'     | grep -oE '[A-Z]+-[0-9]+' | sort -u > "/tmp/tickets-$repo.txt"
done
comm -12 /tmp/tickets-web-service.txt /tmp/tickets-business-service.txt   | comm -12 - /tmp/tickets-data-service.txt | wc -l
```

Compare that against the total ticket count for the period. The ratio is the argument, and it needs no
interpretation: a high proportion means the boundaries are not where change happens, which is the
whole claim.

**2 · Release coupling.** Independent deployability is the property the split was supposed to buy, so
check whether it was delivered:

```bash
# Deploys of the three services, by day. If they cluster, they are one deployable in three pieces.
git -C business-service log --since="6 months ago" --tags --simplify-by-decoration     --pretty=format:'%ad' --date=short | sort | uniq -c
```

🔴 **Present the ratio, not the diagram.** Architectural arguments about layering lose to "it looks
tidy on the diagram" every time; a measurement over the organisation's own history does not, because
nobody in the room chose the data. This is the technique [19 · Change history as evidence](19-change-history-as-evidence.md)
generalises.

## The plan when the org change is not available

Most engineers reading this cannot reorganise the company, and "get the teams changed first" is
therefore useless advice on its own. There are three honest options and they are not equally good.

| Option | What you get | What it costs | When it is right |
|---|---|---|---|
| **Modular monolith with enforced boundaries** | Capability boundaries that a build failure defends, and that survive a layered org because no team can violate them silently | One deployable; you keep the release coordination you have | 🔴 **The default.** Almost always the right answer without an org change |
| **Capability services anyway** | The target architecture, briefly | It re-layers. Internal packages first, then services, within about a year | Only if the org change is genuinely scheduled |
| **Change nothing, document the constraint** | Honesty, and a case that can be made later | Nothing improves | When the layering is not currently costing anything measurable |

🔴 **Option 1 is the one that gets skipped, and it is the one that works.** A module boundary enforced
by `ApplicationModules.verify()` or an ArchUnit rule does not care what the org chart looks like: a
front-end engineer who reaches into pricing's internals gets a failing build, not a code review
comment they can argue with. That converts the boundary from something the organisation has to
*support* into something it has to *route around*, and routing around it is visible.

```java
// src/main/java/com/retailer/pricing/package-info.java
// Enforceable today. Survives a layered team topology, because the build does not report to anyone.
@org.springframework.modulith.ApplicationModule(allowedDependencies = {"catalog"})
package com.retailer.pricing;
```

**And it leaves the migration cheap.** A module that has held its boundary for a year under an
adversarial org chart is a module you can extract in weeks when the org change finally arrives — see
[40b · Ready to extract](40b-ready-to-extract.md). Capability services attempted without the org
change give you neither the boundary nor the option.

## Conway's own conclusion, which is not the law

The famous sentence is a description. The paper's *recommendation* is a separate claim and it is the
useful half for anyone planning this:

> *"a design effort should be organized according to the need for communication"*

> *"flexibility of organization is important to effective design"*

That is the **Inverse Conway Manoeuvre** stated fifty-odd years before the phrase existed: if the
architecture is a copy of the communication structure, then choosing the communication structure is
how you choose the architecture. Organise teams around the capabilities you want to be able to
change independently, and the layered design stops being the one the organisation can most easily
produce.

⚠️ **The paper also warns about scale in a way that is quoted less often:**

> *"two men and one hundred men cannot work in the same organizational structure…they will not design
> similar systems; therefore the value of their efforts may not even be comparable."*

Read alongside the law, that says the *right* architecture changes as the organisation grows — not
because the domain changed, but because the communication structure did. It is the same point
[44c · Worked example: two teams vs twelve](44c-worked-example-two-teams-and-twelve.md) reaches from
the other direction, and it is the reason an architecture that was correct at fifteen engineers can
be wrong at eighty with no code having changed.

## Gotchas

**★ Symptom: the layers were merged into capability services, and eighteen months later there is a `platform-data-service` again.**
Cause: the code was re-drawn and the organisation was not. Three functional teams owning three
technical specialities produce a layered design because that is the design their communication
structure supports — Conway's homomorphism, not anybody's error.
Fix: treat the team topology as part of the migration plan, not as context for it. If the org change
is not available, the honest deliverable is a modular monolith with enforced boundaries rather than
services that will re-layer:
```java
// Enforceable today, without an org change, and it does not silently revert
@org.springframework.modulith.ApplicationModule(allowedDependencies = {})
package com.retailer.pricing;
```

**★ Symptom: everyone agrees the layering is wrong and nobody will fund changing it.**
Cause: the case is being made architecturally, and architectural cases lose to diagrams.
Fix: measure it over the organisation's own history — the proportion of tickets touching all three
repositories, and whether the three services' deploys cluster on the same days. A ratio computed from
their own git log is not an opinion anybody in the room can trade against a tidier picture.

**★ Symptom: an Inverse Conway reorganisation happens, and the architecture does not follow.**
Cause: the teams were renamed rather than re-wired. Conway's constraint is about **communication**,
not about reporting lines — three "capability teams" who still hold their daily stand-up as a
front-end, back-end and database conversation have the same communication structure they had before.
Fix: check the artefacts that record communication rather than the org chart. Who reviews whose pull
requests, who is in which channel, who is on which rota. If the review graph is still layered, the
architecture will be.

**★ Symptom: boundaries are agreed in a design document and violated within a sprint, repeatedly.**
Cause: the boundary exists only as agreement, and agreement is exactly what a mismatched
communication structure erodes. Nobody is defecting; each individual violation is the shortest path
given who talks to whom.
Fix: move the boundary from agreement into the build, where it does not depend on anybody
remembering. This is the entire argument for
[25 · Verifying the boundary](25-verifying-the-boundary.md) and
[26 · ArchUnit rules](26-archunit-rules.md), and it is strongest precisely when the org chart is
working against you.

## Interview questions

**★ A team that knows all of this still ends up with layered services. Why?**
Conway. *"Organizations which design systems … are constrained to produce designs which are copies of
the communication structures of these organizations"* — so a company with a front-end team, a
back-end team and a DBA team will produce a layered architecture almost regardless of what its
architects believe, because that is the design its communication structure supports. The important
consequence is about remediation rather than blame: re-drawing the services without re-drawing the
teams reverts. You can merge three layer services into capability services in a quarter, and if the
same three functional teams still own the same three specialities, the layering comes back — first as
internal packages, then as new services. Which means the org change is the load-bearing half of the
migration, and it is usually somebody else's decision to make.

**★ You can see the layering is wrong and you cannot change the organisation. What do you actually do?**
A modular monolith with boundaries enforced by the build — and specifically **not** capability
services. Services attempted against a layered org re-layer themselves within about a year, because
the design that matches the communication structure keeps being re-derived, so you spend the
migration and end up where you started with extra deployables. A module boundary enforced by
`ApplicationModules.verify()` or an ArchUnit rule is different in kind: it does not depend on anyone
agreeing, a violation is a failing build rather than a review comment, and routing around it is
visible. It also leaves you in the best position for later — a module that has held its boundary for
a year under an adversarial org chart extracts in weeks once the org change arrives.

**★ What does Conway's paper recommend, as distinct from what it observes?**
The law itself is a description: designs are *"copies of the communication structures"* of the
organisations that produce them. The recommendation is separate and is the actionable half — *"a
design effort should be organized according to the need for communication"*, and *"flexibility of
organization is important to effective design."* That is the Inverse Conway Manoeuvre decades before
it was named: if architecture mirrors communication, then choosing the communication structure is how
you choose the architecture. The paper adds a scale caveat that is quoted much less — *"two men and
one hundred men cannot work in the same organizational structure"* — which implies the correct
architecture changes as the organisation grows, with no change in the domain at all.

**★ A company reorganises into capability teams and the architecture stays layered. What went wrong?**
The teams were renamed and the communication structure was not changed. Conway's constraint is about
who needs to talk to whom, not about who reports to whom — so three "capability teams" whose members
still review each other's work along front-end, back-end and database lines have the same
communication graph they had before, and will keep producing the same design. The diagnostic is to
look at artefacts that record communication rather than at the org chart: the pull-request review
graph, channel membership, who is paged for what. If those are still layered, the architecture will
be too, whatever the teams are called.

---

← [Splitting by layer](12-splitting-by-layer.md) · [Topic index](README.md) · Next → [Entity services](13-entity-services.md)
