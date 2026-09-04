---
title: "The co-change matrix has about six recognisable shapes, and the same technique run across repositories rather than packages is the only objective test for whether an existing set of services is really one deployable unit"
sidebar_label: "19b · Reading the co-change matrix"
sidebar_position: 35
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the `git-log` and `git-shortlog` documentation
> ([git-scm.com](https://git-scm.com/docs/git-log)); microservices.io *Dark matter force:
> minimize design-time coupling*
> ([microservices.io](https://microservices.io/articles/dark-energy-dark-matter/dark-matter/minimize-design-time-coupling.html)),
> which notes that tight design-time coupling produces expensive lockstep changes; Gall,
> Hajek and Jazayeri (ICSM 1998) and Adam Tornhill, *Software Design X-Rays* (2018), cited by
> concept. Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud
> train 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**. **No sandbox** — no
> output of any command in this topic is reproduced.

**[19 · Change history as evidence](19-change-history-as-evidence.md) produces the numbers.
This chunk is about reading them, because a matrix of ratios is not yet a finding — the same
number means different things depending on which shape it sits in. It also extends the
technique in the direction that matters most for this phase: run it across repositories
rather than packages, and you have an objective, non-negotiable test for whether your
existing services are independently deployable or one unit wearing several names.**

## The six shapes

### 1. The block

A cluster of modules all coupled to each other and weakly to everything else. This is a
subdomain that has been split — most often by layer, sometimes by entity. The block boundary
is real; the boundaries inside it are not.

**Action:** merge the block into one module or service, then look for boundaries *inside* it
using invariants rather than history, because the history has been contaminated by the
existing bad split.

### 2. The hub

One module coupled to everything, with everything else mutually independent. Three distinct
things produce this and they need different responses:

- A **shared kernel** — a values module everyone uses. Fine, if it is small and rule-free
  ([33 · Shared kernel](33-shared-kernel.md)).
- A **god module** — it holds rules that belong elsewhere ([17 · The god
  service](17-the-god-service.md)).
- A **cross-cutting concern** — logging, security, an application shell. Usually fine.

**Distinguish them** by looking at what the co-changing commits actually did. Business rule
changes to a hub mean it is a god module; signature and utility changes mean it is a kernel.

### 3. The chain

A → B → C, each coupled to its neighbour and not to the far end. Usually a genuine pipeline
and often correct: an order flows to fulfilment flows to invoicing. The coupling is real but
directional, and the useful question is whether the coupling is at the *contract* — each
change to A's output forces B — or at the *rule*.

**Action:** if the contract is the coupling, the fix is contract stability (tolerant reader,
additive-only change), not a boundary move. That is **05 · Inter-service REST** *(not written
yet)*.

### 4. The pair

Exactly two modules highly coupled, everything else clean. The easiest and most actionable
shape. Almost always one concept in two places.

**Action:** find the concept. Usually a rule implemented twice, or an aggregate split by an
old refactoring.

### 5. The asymmetric pair

A changes whenever B does; B often changes alone. B is upstream. The downstream is paying for
every upstream change, which is what an anticorruption layer exists to stop.

**Action:** check whether A has an ACL. If it does, the ACL is not doing its job — most likely
because A's model mirrors B's rather than being A's own. See
[29 · Anticorruption layer](29-anticorruption-layer.md).

### 6. The isolate

A module that changes and never co-changes. Either a clean boundary or a dead module.

**Action:** check its absolute change frequency. Changes often and alone: an excellent
extraction candidate. Almost never changes: check whether anything calls it before spending
any thought on it.

## Combining with authorship: the org-chart overlay

The second dataset in the same repository is who changed what. Together with co-change it
answers the question in [14 · Conway and the org chart](14-conway-and-the-org-chart.md)
empirically.

```bash
# Which authors touch which modules, last year.
git log --since='1 year ago' --name-only --pretty=format:'%an' -- 'src/main/java/**' \
  | awk '/^[^ ]/ && !/\// {author=$0; next}
         NF {split($0, p, "/"); print author "\t" p[4]}' \
  | sort | uniq -c | sort -rn | head -40
```

Four readings, each a different problem:

| Pattern | Reading |
|---|---|
| One module, many authors from many teams | No ownership. The boundary is defended by nobody. |
| One team, many modules, all co-changing | The modules are one thing; merge them. |
| One team, many modules, none co-changing | Healthy — one team, several independent capabilities. |
| Two teams both editing one module heavily | The `Service per team` violation; either split it along the two teams' concerns if the domain allows, or give it one owner. |

The first pattern is the one that most often surprises people. A module everyone edits is not
a shared resource; it is an unowned one, and unowned modules are where boundaries dissolve
first.

## The version that matters most: co-change across repositories

For an existing microservice architecture, the same measurement across repositories is the
decisive test of independent deployability. Two services that are always released together
are one deployable unit, whatever the diagram says.

```bash
# For each service repo, list release dates (tags) — then look for tags that cluster.
for repo in ../retailer-*; do
  echo "== $repo"
  git -C "$repo" log --tags --simplify-by-decoration \
      --pretty=format:'%ad %d' --date=short --since='1 year ago'
done
```

```bash
# Or, if you deploy from main: dates on which each service shipped.
for repo in ../retailer-*; do
  echo "== $repo"
  git -C "$repo" log --first-parent --since='1 year ago' \
      --pretty=format:'%ad' --date=short | sort -u
done
```

What to compute: for each pair of services, the fraction of days on which both shipped, over
the days on which either shipped. A high fraction with no shared deploy pipeline means the
two are coupled at design time and their releases are being coordinated by humans — the
distributed monolith's clearest signature, and the subject of **12 · The distributed
monolith** *(not written yet)*.

**This is the number to bring to a meeting.** It requires no model, no domain knowledge and no
agreement about what a bounded context is, and it cannot be argued with. It is also the only
metric in this topic that measures the thing a service boundary was actually bought for.

## Turning a finding into a proposal

A finding is not a plan. The shape of a proposal that gets accepted:

1. **The measurement.** Two modules, the co-change ratio in each direction, the window, and
   the number of commits it is based on.
2. **The mechanism.** Which specific commits, and what they were doing. "Fourteen of these
   were adding a field to the shared status enum."
3. **The cost of the status quo.** Ordered releases per quarter, blocked tickets, incidents.
4. **The smallest change that would help.** Often not a merge or a split — often moving one
   rule, deleting one shared type, or replacing one read-then-decide.
5. **The measurement that would show it worked.** Re-run the same query in a quarter.

Step 4 is where most analyses fail. A co-change finding tends to produce a proposal to
restructure, and the actionable version is usually much smaller: a single shared enum, a single
duplicated rule, a single leaked internal package.

## Gotchas

**★ Symptom: the matrix shows a block that matches your service diagram exactly.** Cause: the
existing split contaminates the history — services split by layer will show a block because
every feature touches all of them. Fix: read the block as evidence about the *current*
boundaries being wrong, and find the new ones with invariants instead, because the history
cannot tell you where the lines should have been.

**★ Reading a hub as automatically bad.** Three different things make hubs and only one of
them is a defect. Look at what the co-changing commits did before deciding.

**★ Symptom: high co-change between a module and its own tests.** Cause: counting test files.
Fix: decide explicitly. Exclude same-module tests; keep cross-module tests, which are real
evidence.

**★ Comparing services with very different release cadences.** A service that deploys daily
and one that deploys monthly will show low co-release regardless of coupling. Normalise by the
number of releases each had, and be suspicious of any pair where one has very few.

**★ Symptom: an analysis with a finding and no proposal.** Cause: the leap from "these are
coupled" to "restructure" is too large to be accepted. Fix: find the mechanism in the actual
commits and propose the smallest change that addresses it — usually one shared type or one
duplicated rule, not a re-architecture.

**★ Using authorship data as performance data.** It is architecture evidence about ownership
and it is toxic the moment anyone reads it as productivity. State that constraint out loud
before circulating it, or expect the analysis to be the last one you are allowed to run.

**★ Trusting a co-release number when both services deploy from one pipeline.** If a shared
pipeline deploys everything on every merge, co-release is an artefact of the tooling. Check
how deployment is triggered before interpreting the number.

## Interview questions

**★ You have a co-change matrix. How do you read it?**
By shape, not by individual numbers. A block of mutually coupled modules is one subdomain that
has been split, usually by layer. A hub coupled to everything is a shared kernel, a god module
or a cross-cutting concern — distinguish them by looking at what the co-changing commits
actually did, since business-rule changes mean god module and utility changes mean kernel. A
chain is usually a genuine pipeline. A tight pair is one concept in two places, and is the
most actionable finding. An asymmetric pair is an upstream/downstream relationship. An isolate
is either a clean boundary or dead code.

**★ How do you test objectively whether an existing set of services is independently
deployable?**
Measure co-release from the repositories: for each pair, the fraction of days on which both
shipped, over the days on which either shipped. Two services that almost always ship together,
with no shared pipeline forcing it, are being coordinated by humans and are one deployable
unit regardless of the diagram. It is the only metric in this area that measures the property
a service boundary was actually bought for, and it needs no domain knowledge, so nobody in the
room can dispute the premises.

**★ What does it mean when one module is edited by authors from every team?**
That it has no owner, and unowned modules are where boundaries dissolve first — every team
makes the change that suits them, nobody refuses a shortcut, and there is no one to notice
that a rule from another context has arrived. It is usually more urgent than any co-change
finding, because it predicts future erosion rather than describing past coupling. The fix is
ownership before it is structure: assign it, then decide whether it should be split along the
lines the different teams are actually pulling it in.

**★ Why is the smallest-change step the hardest part of the proposal?**
Because a coupling finding naturally suggests restructuring, and restructuring proposals get
deferred. The actionable version comes from reading the actual commits behind the number: very
often the mechanism is one shared enum, one duplicated rule, or one place where a service
reads another's data and decides. Fixing that one thing is a week, ships independently, and
can be verified by re-running the same query next quarter — which is a proposal that gets
approved, unlike a re-architecture.

**★ What are the ethical and practical constraints on using authorship data?**
Practically, it is architecture evidence about ownership and nothing else — it says who
touched what, not who was productive, and it is heavily distorted by who happened to be on
which project. Ethically, the moment it is read as a performance signal it stops being usable,
because people will change their commit behaviour and the data becomes worthless as well as
harmful. State the constraint explicitly whenever you circulate it, aggregate to team rather
than individual where you can, and be prepared to drop the analysis rather than let it be
repurposed.

---

← [Change history as evidence](19-change-history-as-evidence.md) · [Topic index](README.md) · Next → [Event storming](20-event-storming.md)
