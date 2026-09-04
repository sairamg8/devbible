---
title: "Your version control history is the only record of what actually changes together, which makes it the only empirical test of the Common Closure Principle you will ever get — and it is free, already collected, and almost never consulted"
sidebar_label: "19 · Change history as evidence"
sidebar_position: 34
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against microservices.io *Decompose by business capability*
> ([microservices.io](https://microservices.io/patterns/decomposition/decompose-by-business-capability.html))
> and *Decompose by subdomain*
> ([microservices.io](https://microservices.io/patterns/decomposition/decompose-by-subdomain.html)),
> both of which state the force *"Services must conform to the Common Closure Principle -
> things that change together should be packaged together"*; *Dark matter force: minimize
> design-time coupling*
> ([microservices.io](https://microservices.io/articles/dark-energy-dark-matter/dark-matter/minimize-design-time-coupling.html));
> the `git-log` documentation ([git-scm.com](https://git-scm.com/docs/git-log)). The
> technique of deriving logical coupling from release history is due to Gall, Hajek and
> Jazayeri, *Detection of logical coupling based on product release history* (ICSM 1998),
> and is developed for practitioners in Adam Tornhill's *Software Design X-Rays* (2018),
> both cited by concept.
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train
> 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**. **No sandbox** — the
> commands below are shown so you can run them on your own repository; no output of any run
> is reproduced anywhere in this topic.

**Every boundary criterion in this topic except one asks you to reason about the domain. The
Common Closure Principle asks a different kind of question — what changes together — and that
question has an answer sitting in your repository, recorded automatically, for every commit
anyone has ever made. Almost nobody looks. It is the only place in a decomposition exercise
where you can replace an argument with a measurement, and it routinely contradicts the
architecture diagram.**

## What you are measuring

**Logical coupling** (also called change coupling or co-change): the frequency with which two
components appear in the same commit. Two files that change together in most of their commits
are coupled regardless of whether either imports the other — and *that* is the point. Static
analysis finds the dependencies you declared. Co-change finds the dependencies you have.

The two disagree in both directions, and both disagreements are informative:

- **Coupled with no static dependency.** Two modules that always change together but never
  reference each other: a duplicated rule, a shared implicit protocol, a schema convention
  nobody wrote down, or a single concept split across two places. This is the highest-value
  finding in the whole exercise, because it is invisible to every other tool.
- **Static dependency with no co-change.** Module A imports B constantly and they never change
  in the same commit: B is a stable abstraction, and a boundary between them is nearly free.

## The commands

These read your history. Run them; nothing in this topic reproduces their output.

```bash
# 1. Commits that touched more than one top-level module, most recent year.
git log --since='1 year ago' --name-only --pretty=format:'%H' -- 'src/main/java/**' \
  | awk '/^[0-9a-f]{40}$/ {commit=$0; next}
         NF {split($0, p, "/"); print commit, p[4]}' \
  | sort -u \
  | awk '{count[$1]++} END {for (c in count) if (count[c] > 1) print c}' \
  | wc -l
```

```bash
# 2. Which pairs of modules co-change, ranked. The core measurement.
git log --since='1 year ago' --name-only --pretty=format:'%H' -- 'src/main/java/**' \
  | awk '/^[0-9a-f]{40}$/ {c=$0; next} NF {split($0, p, "/"); print c, p[4]}' \
  | sort -u \
  | awk '{mods[$1] = mods[$1] " " $2}
         END {for (c in mods) {
                n = split(mods[c], m, " ")
                for (i = 1; i <= n; i++) for (j = i+1; j <= n; j++) {
                  a = m[i]; b = m[j]
                  if (a > b) { t = a; a = b; b = t }
                  pair[a "," b]++
                }}
              for (p in pair) print pair[p], p}' \
  | sort -rn | head -30
```

```bash
# 3. How often each module changes at all — the denominator you need for step 2.
git log --since='1 year ago' --name-only --pretty=format:'' -- 'src/main/java/**' \
  | awk 'NF {split($0, p, "/"); print p[4]}' \
  | sort | uniq -c | sort -rn
```

Adjust `p[4]` to whichever path component is your module name; for
`src/main/java/com/retailer/sales/...` the module is field 7 with that split, so check one
path first.

## The number that matters is a ratio, not a count

A raw co-change count is misleading: the two modules everyone edits will top the list simply
because they are edited. What you want is conditional probability:

> **P(B changed | A changed)** = (commits touching both) ÷ (commits touching A)

Compute it in both directions, because it is asymmetric and the asymmetry is the finding:

- **Both directions high** (say, above two thirds): the two are one thing. A boundary between
  them will be crossed by most changes. Merge them, or accept that the boundary is decorative.
- **One direction high, the other low.** A changes whenever B does, but B often changes alone.
  That is an upstream/downstream relationship: B is upstream, A is downstream and conformist
  or dependent. This maps directly onto the context-mapping relationships in
  [30 · Context mapping](30-context-mapping.md), and it is derived from data rather than from
  a workshop.
- **Both low.** Independent. A boundary here is cheap and probably correct.

Pick your own thresholds and state them; the shape of the distribution matters more than any
particular cut-off, and a distribution with no high-coupling pairs at all usually means your
path parsing is wrong rather than that your architecture is perfect.

## What to do with each finding

| Finding | Action |
|---|---|
| Two modules co-change in most commits | Candidate merge, or find the shared concept and give it one home |
| Two modules co-change, no static dependency | Look for the duplicated rule or implicit protocol; this is a boundary error you cannot see any other way |
| A module co-changes with everything | It is a shared kernel, a god module, or a cross-cutting concern; classify it before acting |
| A module never co-changes with anything | A clean boundary, and a good first candidate for extraction |
| Asymmetric coupling | An upstream/downstream relationship — name it, and check the code agrees |

## When to use it, and when it lies

**Use it** on a codebase with at least a year of history and reasonably scoped commits, when
you are choosing between two candidate boundaries, and when a team asserts that two things are
independent.

**It lies** in five specific circumstances, and each has a mitigation:

1. **Large mechanical commits** — a formatter run, a dependency bump, a package rename — make
   everything co-change. Exclude them by commit size or by author.
2. **Squash merges** turn a fifteen-commit feature branch into one commit touching everything
   the feature touched. This inflates coupling uniformly and is very common; if your team
   squashes, the absolute numbers are meaningless and only the *relative* ranking is usable.
3. **Generated code** committed to the repository co-changes with its source and tells you
   nothing.
4. **A recent reorganisation** means the last year's history describes the old team structure.
   Window the analysis to the period since the reorg, accepting a smaller sample.
5. **New code** has no history. Nothing mitigates this; it is why greenfield boundaries are
   guesses — [18 · Boundaries from a whiteboard](18-boundaries-from-a-whiteboard.md).

## Why this evidence persuades people the domain argument does not

An invariant argument requires the listener to accept a model. A co-change table requires them
to accept their own commit history. In practice this is the difference between a decision made
and a decision deferred: "these two modules changed together in most of the last year's
commits" is not a matter of opinion, and it converts an architecture debate into a discussion
about what to do next.

It is also the only technique here that can be re-run cheaply, which means it can be a
quarterly check rather than a one-off study — and boundary erosion is exactly the kind of slow
change that only shows up in a trend.

## Gotchas

**★ Symptom: everything co-changes with everything.** Cause: usually squash merges or
mechanical commits, not an architecture that is entirely coupled. Fix: check the commit size
distribution first. If most commits touch dozens of files, the signal is drowned and you must
either exclude large commits or work from the pre-squash branch history if you still have it.

**★ Using raw co-change counts.** The busiest module wins every pairing. Always divide by how
often each module changes at all, and compute both directions.

**★ Symptom: two modules co-change with no import between them.** Cause: a duplicated rule, an
undocumented protocol or a shared schema convention. Fix: this is the most valuable finding
the technique produces — go and find the concept that lives in two places, and give it one
home. Do not "fix" it by adding a dependency.

**★ Treating the analysis as an answer rather than as a hypothesis.** Co-change tells you
what happened; it does not tell you why. Every high-coupling pair needs a look at the actual
commits before you act, because the explanation is sometimes "one person did a big
refactoring in March".

**★ Analysing at file granularity for a boundary decision.** File-level co-change is useful
for finding classes to merge, and it is noisy at module scale. Aggregate to the module or
package level for boundary work, and drop to file level only when investigating a specific
pair.

**★ Ignoring test files, or including them without thinking.** Tests co-change with their
subject by definition, which inflates every pair; but a *cross-module* test that changes with
two modules is real evidence. Decide explicitly and state which you did.

**★ Running it once and never again.** Boundary erosion is a trend, not an event. A quarterly
re-run is the only way to see a boundary weakening while it is still cheap to correct.

## Interview questions

**★ How would you find service boundaries in a large legacy codebase using evidence rather
than opinion?**
Measure logical coupling from the commit history: for each pair of modules, how often they
appear in the same commit, normalised by how often each changes at all. That is a direct
empirical test of the Common Closure Principle, which both of microservices.io's decomposition
patterns list as a force — things that change together should be packaged together. It is free,
already collected, and it routinely contradicts the architecture diagram. Pairs that change
together in most commits are one thing; pairs that never do are cheap boundaries.

**★ What can co-change analysis find that static analysis cannot?**
Coupling with no dependency. Two modules that always change together but never reference each
other are sharing something the compiler cannot see — a duplicated business rule, an implicit
protocol, a schema convention, a magic string, or one concept implemented twice. Static
analysis is blind to all of it, and it is exactly the kind of coupling that survives a
service split and then produces lockstep releases nobody can explain. It is the highest-value
output of the technique.

**★ Why compute the ratio in both directions?**
Because the asymmetry is the relationship. If A changes whenever B changes, but B frequently
changes alone, then B is upstream and A is downstream — A is conformist or dependent on B's
model. That maps onto a context-mapping relationship, derived from data rather than asserted
in a workshop, and it tells you which side needs an anticorruption layer. Symmetric high
coupling means something quite different: the two are one component that has been split.

**★ When does this technique mislead you?**
Five cases. Squash merges collapse a whole feature branch into one commit, inflating coupling
uniformly — very common, and it makes absolute numbers meaningless while leaving the ranking
usable. Mechanical commits like formatter runs and dependency bumps touch everything.
Generated code co-changes with its source and says nothing. A recent reorganisation means the
history describes the previous team structure. And new code has no history at all, which is
why greenfield boundaries cannot use this and have to be treated as hypotheses.

**★ How does this change an architecture conversation?**
It replaces a claim about a model with a fact about the team's own commits, which is much
harder to argue with and much easier for non-specialists to accept. "These two services
changed together in most of the last year's releases" ends the discussion about whether they
are independent and starts the discussion about what to do. It is also cheap to re-run, so it
can be a quarterly health check rather than a one-off study — which matters because boundary
erosion is gradual and only visible as a trend.

---

← [Boundaries from a whiteboard](18-boundaries-from-a-whiteboard.md) · [Topic index](README.md) · Next → [Reading the co-change matrix](19b-reading-the-co-change-matrix.md)
