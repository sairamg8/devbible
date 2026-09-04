---
title: "\"One team per service\" is quoted as a sizing rule and is really an ownership rule — a service with no single team that can change it alone is not a service, and the constraint that binds first is not headcount but how much a team can hold in its head"
sidebar_label: "14b · One team per service"
sidebar_position: 26
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against microservices.io *Service per team*
> ([microservices.io](https://microservices.io/patterns/decomposition/service-per-team.html)), which
> states *"Each service is owned by a team, which has sole responsibility for making changes"* and
> sizes a codebase *"so as to not exceed the cognitive capacity of team"*; Melvin E. Conway,
> *How Do Committees Invent?* (Datamation, 1968)
> ([melconway.com](https://www.melconway.com/Home/Committees_Paper.html)).
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**. Documentation-validated; **no sandbox run**.

**[14 · Conway and the org chart](14-conway-and-the-org-chart.md) explains why the architecture copies the communication structure. This chunk is the operational consequence people quote as a headcount ratio and then apply as though it were about arithmetic. It is not: a service whose changes require two teams to agree does not become one service by being assigned an owner on a wiki page, and a team that owns four services it cannot hold in its head owns none of them in the way the rule means. The binding constraint is cognitive capacity rather than headcount, which is why a small service with six vendor integrations can exceed it while a large, boring one does not — and why the ratio that matters is not services per engineer.**

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
   ([19 · Change history as evidence](19-change-history-as-evidence.md)) is the tie-breaker,
   because it measures the communication structure directly rather than through the proxy of
   the org chart.

The order matters. Step 2 before step 1 is how a team gets its own service and discovers six
months later that it cannot enforce a rule it is accountable for.

## What cognitive capacity is actually made of

The pattern sizes a codebase *"so as to not exceed the cognitive capacity of team"*, and teams
reliably estimate that in lines of code, which is the one input that correlates worst with it. What a
team has to hold is not the code — it is everything that can page them at 3am.

| Load | Cheap | Expensive |
|---|---|---|
| **Domain rules** | A handful of stable invariants | Regulatory rules that change on someone else's schedule |
| **Integrations** | One database | Six vendor APIs, each with its own auth, failure modes and support process |
| **Operational surface** | One deployment, one dashboard | Three runtimes, a batch job, a message consumer, a cron |
| **Change rate** | Quarterly | Weekly, driven by a business that does not consult you |
| **Blast radius** | An internal report | The checkout path |

🔴 **That is why a 2,000-line service can exceed a team's capacity while a 40,000-line one does not.**
The small one with six vendor integrations carries six sets of failure semantics, six credentials to
rotate, six changelogs to track and six vendors to escalate to. The large boring one carries one.
Sizing by line count will reliably hand a team the first and tell them they have room for another.

**The practical test is not a metric, it is a question with an honest answer:** *can a new engineer on
this team be on call for this service within a month?* If the answer is no, the service exceeds the
team's capacity regardless of its size, and the options are to split it, to reduce its integration
surface, or to accept that it needs its own team.

## The ratio that actually constrains you

"One team per service" is quoted as though it forbids a team owning several services. It does not —
plenty of teams own three or four small, related, low-change services perfectly well. What it forbids
is the other direction:

> *"Each service is owned by a team, which has sole responsibility for making changes"*

🔴 **The binding word is *sole*.** A service that two teams change is the violation, and it is the one
that actually hurts, because it reintroduces exactly the coordination the split was performed to
remove. One team with four services has an ownership question about attention. Two teams with one
service has no owner at all — every change is a negotiation, and the boundary exists on the diagram
only.

**So when service count exceeds team count, the diagnostic order is:**

1. Does any service have **two** teams changing it? → fix that first; it is the real violation.
2. Does any service have **no** team? → assign or delete it. An unowned service decays silently.
3. Does any team's set of services exceed what it can hold? → the cognitive-capacity question above.

## Gotchas

**★ Symptom: a service with no owning team.** Cause: more services than teams, or a
dissolved project team. Fix: assign it or merge it, this quarter. An unowned service does not
stay static; it accumulates security debt and its boundary is defended by nobody.

**★ Treating cognitive load as a line count.** A small service with six vendor integrations,
two datastores and a bespoke protocol can exceed a team's capacity while a large single-domain
service does not. Count distinct things to know, not lines.

**★ Assuming a well-communicating pair of teams can hold a non-Conway boundary
indefinitely.** They can hold it while the communication is cheap. Add a time zone, a
reorganisation, or a busy quarter, and the boundary starts to move.

**★ Symptom: a team owns four services and every one of them is slightly out of date — dependencies, runbooks, alerts.**
Cause: the team's ownership is nominal on three of them. Attention, not headcount, ran out.
Fix: this is the cognitive-capacity limit arriving as neglect rather than as a complaint. Reduce the
surface — consolidate the three low-change services into one deployable, or hand one to a team whose
domain it actually belongs to. Adding an engineer rarely fixes it, because the load is per-service
context rather than per-line throughput.

**★ Symptom: a service is "owned" by a team that has to consult another team for most changes.**
Cause: the ownership is recorded and not real. The pattern's requirement is *sole* responsibility for
making changes, and this service has two effective owners.
Fix: treat it as the boundary defect it is rather than as a process problem. Either the second team's
concern belongs inside their own service — in which case the boundary is in the wrong place — or the
first team is missing the knowledge to own it, which is a staffing fix with a known shape.

## Interview questions

**★ Should service boundaries always follow team boundaries?**
No — they should follow the invariants first, and then the teams among the options that
remain. The org chart is a proxy for the communication structure and it fails in identifiable
ways: teams that exist because of an acquisition, a frontend/backend split, a time-zone
split, a manager's span of control, or a temporary programme. Building services along any of
those enshrines something that is not about the domain. The honest sequence is: reject any
boundary that cuts an invariant; among the survivors, choose the partition that gives each
team sole ownership; use co-change history to break remaining ties.

**★ Your partition produces fifteen services and you have six teams. What is wrong?**
Nine services have no owner, and unowned services do not sit still — dependencies rot, alerts
route to people who do not understand them, and nobody defends the boundary when someone
needs a shortcut. microservices.io's guidance is that a team should have exactly one service
unless there is a proven need for more, so the response is either to merge the partition down
to something the teams can own, or to name the proven need for each extra one — a genuinely
different scaling profile, a compliance boundary, a different technology stack. "It felt
cleaner" is not a proven need.

**★ "One team per service" — does that forbid a team owning several services?**
No, and reading it that way inverts the constraint. The requirement is that *"each service is owned by
a team, which has sole responsibility for making changes"*, and the binding word is **sole**. One team
owning four small, related, low-change services is common and fine; what the rule forbids is a service
that two teams change, because that reintroduces exactly the coordination the split was supposed to
remove and leaves the boundary existing only on the diagram. So when service count exceeds team count
the diagnostic order is: find any service with two teams changing it, then any service with no team at
all, and only then ask whether some team's portfolio exceeds what it can hold.

**★ Why is cognitive capacity, rather than lines of code, the thing that limits how much a team can own?**
Because what a team has to carry is everything that can page them, and code size is only weakly
related to that. A 2,000-line service integrating six vendor APIs carries six sets of failure
semantics, six credential rotations, six changelogs and six escalation paths; a 40,000-line service
with one database and quarterly changes carries almost none of that. Sizing by line count will hand a
team the first and tell them they have capacity for another. The usable test is a question rather than
a metric — can a new engineer on this team be on call for this service within a month? — and when the
answer is no, the response is to reduce the integration surface or give the service its own team,
because adding an engineer does not reduce per-service context.

---

← [Conway and the org chart](14-conway-and-the-org-chart.md) · [Topic index](README.md) · Next → [Too small](15-too-small.md)
