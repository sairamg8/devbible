---
title: "Conway's law is not advice, it is an observation that your architecture will end up matching your communication structure whether you plan it or not — so the org chart is either the boundary you chose deliberately or the boundary that will overwrite the one you drew"
sidebar_label: "22 · Conway and the org chart"
sidebar_position: 22
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against Melvin E. Conway, *How Do Committees Invent?* (Datamation,
> 1968) ([melconway.com](https://www.melconway.com/Home/Committees_Paper.html));
> microservices.io *Service per team*
> ([microservices.io](https://microservices.io/patterns/decomposition/service-per-team.html)),
> which states *"Each service is owned by a team, which has sole responsibility for making
> changes"* and sizes a codebase *"so as to not exceed the cognitive capacity of team"*;
> Skelton and Pais, *Team Topologies* (2019), cited by concept and referenced by that
> pattern. Version spine: **JDK 25 · Spring Boot 4.1.0 / Framework 7.0.8 · Spring Cloud
> train 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**.

**Conway's 1968 observation is that an organisation designing a system produces a design
whose structure copies the organisation's communication structure. It is usually quoted as a
warning; it is more useful read as a constraint. If your team boundaries and your service
boundaries disagree, one of them will move, and it will not be the team boundaries — because
those are enforced by managers, calendars, budgets and performance reviews, and yours are
enforced by a code review. The practical consequence is that team design is architecture
work, and doing it second means doing it twice.**

## What Conway actually claimed

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
[19 · Splitting by layer](12-splitting-by-layer.md).

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

## What "one team per service" actually requires

microservices.io's *Service per team* is direct about ownership:

> *"Each service is owned by a team, which has sole responsibility for making changes."*

and about sizing:

> *"Its code base is sized so as to not exceed the cognitive capacity of team."*

and about restraint:

> *"A team should have exactly one service unless there is a proven need."*

Three consequences follow that are frequently ignored.

**More services than teams is a debt.** Every unowned service is a service whose dependencies
rot, whose alerts route to a rotation that does not understand it, and whose boundary nobody
defends. If the partition produces more services than teams, either merge some or name the
proven need.

**Two teams per service does not work.** Every change needs cross-team review, the code
drifts into two styles, and accountability for incidents is contested. If two teams must own
one service, you have one boundary too few or one team too many, and it is worth finding out
which.

**Cognitive capacity is a real limit and it is not measured in lines.** It is measured in how
many distinct domains, technologies, integrations and failure modes a person must hold. A
20,000-line service integrating with six vendors may exceed capacity where a 200,000-line
service in one domain does not.

## The interaction with the domain criteria

Team structure and domain structure are both inputs and they can conflict. The resolution
order that survives contact with reality:

1. **Invariants first.** A boundary that cuts an invariant is rejected regardless of who
   wants to own it. Teams can be reorganised; consistency cannot be restored by reorganising.
2. **Then teams.** Among boundaries that respect the invariants, prefer the partition that
   gives each team sole ownership of what it changes.
3. **Then change history.** Where team structure is ambiguous or in flux, co-change data
   ([26 · Change history as evidence](19-change-history-as-evidence.md)) is the tie-breaker,
   because it measures the communication structure directly rather than through the proxy of
   the org chart.

The order matters. Step 2 before step 1 is how a team gets its own service and discovers six
months later that it cannot enforce a rule it is accountable for.

## Gotchas

**★ Symptom: an architecture that changed shape after a reorganisation nobody linked to
it.** Cause: Conway's law, acting on the new communication structure. Fix: expect it, and
review the boundary register after every reorg — the change is gradual and nobody announces
it.

**★ Symptom: a service with no owning team.** Cause: more services than teams, or a
dissolved project team. Fix: assign it or merge it, this quarter. An unowned service does not
stay static; it accumulates security debt and its boundary is defended by nobody.

**★ Drawing service boundaries along a frontend/backend team split.** This is a layer split
with headcount attached, and it produces every symptom in
[19 · Splitting by layer](12-splitting-by-layer.md). The team structure is the thing to
change here, not the architecture to accommodate it.

**★ Proposing a reorganisation as an architecture deliverable.** It is not yours to make and
it takes quarters. Deliver the disagreement list with costs instead; the reorganisation, if
it happens, will happen because someone with authority read that list.

**★ Symptom: a boundary that erodes gradually with no single decision.** Cause: friction —
each cross-team change is slightly harder than a local one, so people stop making cross-team
changes and start making local ones that duplicate. Fix: this is exactly what the build-time
enforcement in [15 · Finding it in the code](09b-finding-it-in-the-code.md) exists for; the
erosion is invisible in review and obvious to a test.

**★ Treating cognitive load as a line count.** A small service with six vendor integrations,
two datastores and a bespoke protocol can exceed a team's capacity while a large single-domain
service does not. Count distinct things to know, not lines.

**★ Assuming a well-communicating pair of teams can hold a non-Conway boundary
indefinitely.** They can hold it while the communication is cheap. Add a time zone, a
reorganisation, or a busy quarter, and the boundary starts to move.

## Interview questions

**★ What is Conway's law, and why does it matter when you are drawing service boundaries?**
Conway observed in 1968 that an organisation designing a system produces a design whose
structure copies the organisation's communication structure — because the interfaces that end
up clean are the ones between groups that talk easily. For boundary work it means the team
structure is not context, it is a competing design: if your service boundaries and your team
boundaries disagree, the team boundaries win over time, because they are backed by managers,
budgets and calendars, whereas yours are backed by a code review. So team design is
architecture work, and doing it after the fact means doing the architecture twice.

**★ Should service boundaries always follow team boundaries?**
No — they should follow the invariants first, and then the teams among the options that
remain. The org chart is a proxy for the communication structure and it fails in identifiable
ways: teams that exist because of an acquisition, a frontend/backend split, a time-zone
split, a manager's span of control, or a temporary programme. Building services along any of
those enshrines something that is not about the domain. The honest sequence is: reject any
boundary that cuts an invariant; among the survivors, choose the partition that gives each
team sole ownership; use co-change history to break remaining ties.

**★ What is the inverse Conway manoeuvre and what are its limits?**
Changing the team structure to match the architecture you want, and letting Conway's law
produce it. It works, and it is one of the few interventions with a reliable effect on
architecture. The limits are that it takes quarters to land, and that it is usually not the
proposer's decision to make. The version that gets acted on is not "let's reorganise" but a
short list of the specific places where team and service boundaries disagree, with the
monthly cost of each disagreement in ordered releases and blocked work.

**★ Your partition produces fifteen services and you have six teams. What is wrong?**
Nine services have no owner, and unowned services do not sit still — dependencies rot, alerts
route to people who do not understand them, and nobody defends the boundary when someone
needs a shortcut. microservices.io's guidance is that a team should have exactly one service
unless there is a proven need for more, so the response is either to merge the partition down
to something the teams can own, or to name the proven need for each extra one — a genuinely
different scaling profile, a compliance boundary, a different technology stack. "It felt
cleaner" is not a proven need.

**★ How do you notice a boundary eroding before it is gone?**
Two mechanisms, and you want both. Build-time enforcement — Spring Modulith's verification or
ArchUnit rules — catches the individual violation at the moment it is introduced, which is
the only moment it is cheap to reconsider. And periodic co-change analysis over the commit
history catches the slower pattern, where nothing crosses the boundary in code but two
services have started releasing together every time. The first sees the shortcut; the second
sees the drift. Reviews catch neither reliably, because reviewers are looking at the feature.

{/* FOOTER */}
