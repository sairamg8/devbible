---
title: "Conway's law is not advice, it is an observation that your architecture will end up matching your communication structure whether you plan it or not — so the org chart is either the boundary you chose deliberately or the boundary that will overwrite the one you drew"
sidebar_label: "14 · Conway and the org chart"
sidebar_position: 25
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against Melvin E. Conway, *How Do Committees Invent?* (Datamation,
> 1968) ([melconway.com](https://www.melconway.com/Home/Committees_Paper.html));
> microservices.io *Service per team*
> ([microservices.io](https://microservices.io/patterns/decomposition/service-per-team.html)),
> which states *"Each service is owned by a team, which has sole responsibility for making
> changes"* and sizes a codebase *"so as to not exceed the cognitive capacity of team"*;
> Skelton and Pais, *Team Topologies* (2019), cited by concept and referenced by that
> pattern. Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud
> train 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**.

**Conway's 1968 observation is that an organisation designing a system produces a design
whose structure copies the organisation's communication structure. It is usually quoted as a
warning; it is more useful read as a constraint. If your team boundaries and your service
boundaries disagree, one of them will move, and it will not be the team boundaries — because
those are enforced by managers, calendars, budgets and performance reviews, and yours are
enforced by a code review. The practical consequence is that team design is architecture
work, and doing it second means doing it twice.**
## What Conway actually claimed

The sentence everyone quotes:

> *"organizations which design systems (in the broad sense used here) are constrained to produce
> designs which are copies of the communication structures of these organizations."*

And the formal version, which is quoted far less and is the sharper claim:

> *"there is a homomorphism from the linear graph of a system to the linear graph of its design
> organization."*

🔴 **A homomorphism maps the system onto the organisation, not the other way round — and that
direction carries a specific consequence.** It means every part of the system maps to some part of the
organisation, and connected things stay connected. So the system **cannot be more finely structured
than the communication structure that produced it**: you may end up with more services than teams,
but the *boundaries that actually hold* cannot be finer than the lines along which people communicate.
That is a stronger and more useful statement than "architecture mirrors the org chart", because it
predicts the specific failure — a partition drawn finer than the communication structure does not
produce fine-grained services, it produces coarse-grained coupling wearing fine-grained deployment.

### What the law does not say

Three misreadings do real damage in design discussions, and each is worth being able to rebut:

| Misreading | What is actually claimed |
|---|---|
| *"Your architecture will be bad."* | Nothing about quality. An organisation whose communication structure matches its domain produces a **good** architecture by the same mechanism |
| *"Reorganise and the architecture follows automatically."* | The law constrains; it does not construct. A reorganisation removes an obstacle to the target design; somebody still has to build it |
| *"It is a law of nature."* | 🔴 The 1968 paper is an **argument from reasoning about communication cost**, not an empirical study. Treat it as a well-supported heuristic that predicts well, not as a measurement |

⚠️ **The third row matters when someone in the room disputes it.** The honest position is that
Conway's law is a strong, widely-corroborated heuristic whose mechanism is obvious once stated — and
that is enough to plan with. Overclaiming it as proven fact invites a fight you do not need and cannot
win from the source itself.

The paper's argument is about communication cost. Any two components that must fit together
require the people building them to communicate; the communication that happens is the
communication the organisation makes easy; so the interfaces that end up clean are the ones
between groups that talk, and the interfaces that end up messy are the ones between groups
that do not.

The mechanism matters because it tells you when the law *does not* bite. Two teams that
genuinely communicate well can maintain a boundary that does not follow the org chart — for a
while. What erodes it is not malice but friction: the fifth time a change requires a
conversation with another team's backlog, someone finds a way to make the change locally, and
the boundary has moved a little.

## The inverse Conway manoeuvre, and its limits

The manoeuvre is to change the team structure to match the architecture you want, and let
Conway's law produce it. It works, and it is one of the few architecture interventions with a
reliable effect. Two limits are worth stating before recommending it:

**It is slow.** Reorganisations take a quarter to land and two more to stop producing noise.
An architecture decision that depends on one is not available this sprint.

**It is not yours to make.** Most engineers proposing it do not control team boundaries. The
useful version of the proposal is therefore not "reorganise" but "here are the two or three
places where our team boundaries and our service boundaries disagree, and here is what each
disagreement costs per month, in ordered releases and blocked tickets". That framing gets
acted on; "we should do the inverse Conway manoeuvre" does not.

## When the org chart is the wrong map

The org chart is a *proxy* for the communication structure, and proxies fail in specific,
recognisable ways. Each of these produces a team boundary that should not become a service
boundary:

**The acquisition.** Two teams exist because two companies existed. The boundary encodes a
purchase, not a domain. Building services along it enshrines an accident permanently.

**The functional split.** A "frontend team" and a "backend team" is a layer split expressed
as headcount, and letting Conway's law act on it produces exactly the architecture in
[12 · Splitting by layer](12-splitting-by-layer.md).

**The geography split.** Teams in two time zones with one domain between them. The
communication structure genuinely is split, so Conway's law will produce a boundary — but the
domain does not have one there, so the boundary will cut an invariant. This is the case where
you must fight the law rather than exploit it, usually by moving whole capabilities to one
site rather than splitting one capability across two.

**The seniority split.** A "platform team" of experienced engineers and a "features team" of
everyone else. The boundary tracks career stage, not domain.

**The temporary project team.** A team formed for a programme of work, which will be
dissolved. Any service it creates outlives it and becomes ownerless.

**The manager's span of control.** A team exists because eleven people is too many for one
manager. That is a legitimate reason to have two teams and no reason at all to have two
services.

For each of these the right response is the same: keep the subdomains as enforced modules
inside one service, and let the team structure change without dragging a deployment topology
behind it.

## Reading the communication structure, not the org chart

The law is about **communication**, and the org chart is a proxy for it that is often wrong — teams
are renamed without their interaction patterns changing, and real communication frequently follows
lines no chart records. Four artefacts describe the actual structure, and all four are available
without asking anybody:

| Artefact | What it reveals |
|---|---|
| **The pull-request review graph** | Who is actually required to agree before code ships. The single best proxy |
| **Incident channel membership** | Who gets pulled in when something breaks — often a very different graph |
| **Shared on-call rotas** | Which components are operationally one unit regardless of ownership on paper |
| **Meeting series with standing attendance** | The coordination the organisation has institutionalised |

```bash
# Who reviews whose work: the communication structure the architecture will copy
gh pr list --repo org/pricing-service --state merged --limit 200   --json author,reviews   --jq '.[] | {a: .author.login, r: [.reviews[].author.login] | unique} | "\(.a) -> \(.r | join(","))"'   | sort | uniq -c | sort -rn | head -20
```

🔴 **Where the review graph and the org chart disagree, the review graph wins**, because it is the
communication that is actually happening. A "capability team" whose members' work is always reviewed
by the same front-end and back-end specialists has a layered communication structure and will produce
a layered design, whatever the chart says. This is also the check that tells a real reorganisation
from a rename — see [12b · Why the layering comes back](12b-why-the-layering-comes-back.md).

What Conway's law implies for the *number* of services you may have, and what owning one actually
requires of a team, is [14b · One team per service](14b-one-team-per-service.md).

## Gotchas

**★ Symptom: an architecture that changed shape after a reorganisation nobody linked to
it.** Cause: Conway's law, acting on the new communication structure. Fix: expect it, and
review the boundary register after every reorg — the change is gradual and nobody announces
it.

**★ Drawing service boundaries along a frontend/backend team split.** This is a layer split
with headcount attached, and it produces every symptom in
[12 · Splitting by layer](12-splitting-by-layer.md). The team structure is the thing to
change here, not the architecture to accommodate it.

**★ Proposing a reorganisation as an architecture deliverable.** It is not yours to make and
it takes quarters. Deliver the disagreement list with costs instead; the reorganisation, if
it happens, will happen because someone with authority read that list.

**★ Symptom: a boundary that erodes gradually with no single decision.** Cause: friction —
each cross-team change is slightly harder than a local one, so people stop making cross-team
changes and start making local ones that duplicate. Fix: this is exactly what the build-time
enforcement in [09b · Finding it in the code](09b-finding-it-in-the-code.md) exists for; the
erosion is invisible in review and obvious to a test.

**★ Symptom: a reorganisation into capability teams, and the architecture does not change.**
Cause: the org chart changed and the communication structure did not. Reporting lines are not what the
law is about.
Fix: check the review graph, the incident channels and the rotas. If the same specialists still gate
the same kinds of change, the communication structure is unchanged and so is the design it will
produce. Moving people between boxes is not the intervention; changing who has to agree with whom is.

**★ Symptom: a partition into twelve services, drawn by four teams who all review each other's work.**
Cause: the partition is finer than the communication structure. The homomorphism direction says the
system's holding boundaries cannot be finer than the lines along which people actually communicate —
so what you get is not twelve independent services but coarse coupling in twelve deployables.
Fix: either coarsen the partition to match the communication structure, or change the communication
structure first. Twelve services drawn across four communicating groups is the most expensive of the
three available options.

**★ Someone dismisses Conway's law as "not really a law".** They have a point about the wording and
none about the planning. The 1968 paper argues from communication cost rather than measuring
outcomes, so it is a heuristic rather than a measured law.
Fix: do not defend it as proven fact — defend the mechanism, which is uncontroversial: interfaces
between groups that talk end up clean, interfaces between groups that do not end up messy. That is
enough to make the planning decision, and it does not require winning an argument about
epistemology.

## Interview questions

**★ What is Conway's law, and why does it matter when you are drawing service boundaries?**
Conway observed in 1968 that an organisation designing a system produces a design whose
structure copies the organisation's communication structure — because the interfaces that end
up clean are the ones between groups that talk easily. For boundary work it means the team
structure is not context, it is a competing design: if your service boundaries and your team
boundaries disagree, the team boundaries win over time, because they are backed by managers,
budgets and calendars, whereas yours are backed by a code review. So team design is
architecture work, and doing it after the fact means doing the architecture twice.

**★ Conway's law is usually stated as "architecture mirrors the org chart". What is the sharper version, and what does it predict?**
The paper's formal claim is that *"there is a homomorphism from the linear graph of a system to the
linear graph of its design organization"* — a map **from** the system **to** the organisation. The
direction matters: every part of the system maps to some part of the organisation and connected
things stay connected, so the system's boundaries cannot be finer than the communication structure
that produced it. That predicts a specific failure the loose version does not: a partition drawn
finer than the communication structure does not yield fine-grained services, it yields coarse-grained
coupling distributed across more deployables. Twelve services drawn by four teams who all review each
other's work is the standard instance.

**★ Someone says Conway's law is "not really a law". Are they right, and does it matter?**
On the wording, partly: the 1968 paper is an argument from reasoning about communication cost rather
than an empirical study, so calling it a law overstates its epistemic status. It does not matter for
planning, and the mistake is to defend it as proven fact — that is an argument you cannot win from
the source. Defend the mechanism instead, which nobody disputes: two components that must fit
together require their builders to communicate, the communication that happens is the communication
the organisation makes easy, so interfaces between groups that talk come out clean and interfaces
between groups that do not come out messy. That is sufficient to justify checking your team structure
against your intended boundaries, which is all you needed it for.

**★ What is the inverse Conway manoeuvre and what are its limits?**
Changing the team structure to match the architecture you want, and letting Conway's law
produce it. It works, and it is one of the few interventions with a reliable effect on
architecture. The limits are that it takes quarters to land, and that it is usually not the
proposer's decision to make. The version that gets acted on is not "let's reorganise" but a
short list of the specific places where team and service boundaries disagree, with the
monthly cost of each disagreement in ordered releases and blocked work.


---

← [What to build instead](13c-what-to-build-instead.md) · [Topic index](README.md) · Next → [One team per service](14b-one-team-per-service.md)
