---
title: "A co-change ratio of 0.81 is a decision-grade number or meaningless noise depending on two things the matrix does not show you — how many joint changes it rests on, and which of four unrelated causes produced them"
sidebar_label: "19c · When a cell means nothing"
sidebar_position: 36
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the `git-log` and `git-shortlog` documentation
> ([git-scm.com](https://git-scm.com/docs/git-log)).
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**. Documentation-validated; **no sandbox run**.

**[19b · Reading the co-change matrix](19b-reading-the-co-change-matrix.md) gives the six shapes a matrix comes in. This chunk is the prior question, and it is the one that separates an analysis somebody can act on from a table of impressive-looking numbers: a cell is only evidence if it rests on enough joint changes to mean anything, and if the co-change it reports was actually produced by conceptual coupling rather than by one of the three other things that produce identical numbers. Both checks are cheap, neither is optional, and a ratio presented without its support is a number engineered to invite the wrong decision.**

## Two limits that decide whether a cell means anything

The six shapes tell you what a pattern looks like. Two questions decide whether the pattern is real,
and skipping them is how a matrix produces confident nonsense.

### 1 · Support: how many co-changes is the cell built on?

A pair with three co-changes and a ratio of 1.0 is not a strong coupling; it is a module that changed
three times. Ratios computed over tiny denominators swing wildly and always look dramatic.

```bash
# Print support alongside every ratio, and sort by support first.
# A cell with fewer than ~10 joint changes is a hypothesis, not a finding.
awk '{print $1, $2, $3, $4}' co-change.tsv | sort -k3 -rn | awk '$3 >= 10'
```

🔴 **State the support next to every number you present.** "Pricing and Sales co-change 0.81 of the
time" invites a decision; "0.81, over 47 joint changes" invites the right one, and "0.81, over 4"
stops the conversation where it should stop.

### 2 · Causation: co-change has at least three causes and only one is a boundary problem

| Why the pair co-changes | Is it a boundary finding? | How to tell |
|---|---|---|
| They implement one concept | ✅ **Yes** — this is the finding | The changes are the same *feature*, described the same way in both |
| One team owns both and batches its work | ❌ No | The authorship overlay shows a single team; the changes are unrelated features shipped together |
| A shared release train forces joint commits | ❌ No | Every module in the repo co-changes with every other at a similar rate |
| A cross-cutting sweep — a dependency bump, a lint fix | ❌ No | One commit touches dozens of modules at once |

**The cheapest discriminator is commit size.** Sweeps and batches are wide; genuine conceptual coupling
is narrow and repeated:

```bash
# Exclude sweeps: drop any commit touching more than N modules before aggregating
git log --format='%H' --name-only --since='2 years ago'   | awk '/^[0-9a-f]{40}$/ {c=$0; next} NF {split($0,p,"/"); print c, p[5]}'   | sort -u | awk '{n[$1]++; mods[$1]=mods[$1]" "$2} END {for (c in n) if (n[c] <= 4) print mods[c]}'
```

⚠️ **Co-change is correlational and stays correlational.** No threshold makes it causal. What it
buys is a shortlist ordered by evidence, which is enormously better than a shortlist ordered by whose
opinion was loudest — but the domain question still has to be asked about each pair, and the matrix
cannot answer it.

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

**★ Symptom: a dramatic 1.0 coupling between two modules, and nobody recognises the relationship.**
Cause: support. The cell is built on three or four joint changes, where a ratio is meaningless and
always extreme.
Fix: sort by support before ratio and set a floor — around ten joint changes — below which a cell is a
hypothesis rather than a finding, and quote the support next to every ratio you present.

**★ Symptom: every module co-changes with every other at roughly the same rate.**
Cause: not coupling — a release train, a monorepo-wide sweep, or squash merges collapsing unrelated
work into single commits.
Fix: exclude wide commits before aggregating; genuine conceptual coupling is narrow and repeated,
while sweeps and batches touch many modules at once:
```bash
awk '{n[$1]++; mods[$1]=mods[$1]" "$2} END {for (c in n) if (n[c] <= 4) print mods[c]}'
```

**★ Using authorship data as performance data.** It is architecture evidence about ownership
and it is toxic the moment anyone reads it as productivity. State that constraint out loud
before circulating it, or expect the analysis to be the last one you are allowed to run.

**★ Trusting a co-release number when both services deploy from one pipeline.** If a shared
pipeline deploys everything on every merge, co-release is an artefact of the tooling. Check
how deployment is triggered before interpreting the number.

## Interview questions

**★ Two modules co-change 80% of the time. What are the possible explanations, and how do you tell them apart?**
Four, and only the first is a boundary finding. They may implement one concept — the changes are the
same feature, described the same way on both sides. One team may own both and batch its work, so
unrelated features ship together; the authorship overlay shows this immediately. A shared release
train may force joint commits, in which case *every* pair in the repository co-changes at a similar
rate. Or a cross-cutting sweep — a dependency bump, a lint fix — may have touched dozens of modules in
one commit. The cheapest discriminator is commit width: sweeps and batches are wide, genuine coupling
is narrow and repeated, so excluding commits that touch more than a handful of modules removes most of
the noise. And the honest framing to keep: co-change is correlational and no threshold makes it
causal. It produces a shortlist ordered by evidence rather than by volume of opinion, which is its
whole value; the domain question still has to be asked about each pair.

**★ What are the ethical and practical constraints on using authorship data?**
Practically, it is architecture evidence about ownership and nothing else — it says who
touched what, not who was productive, and it is heavily distorted by who happened to be on
which project. Ethically, the moment it is read as a performance signal it stops being usable,
because people will change their commit behaviour and the data becomes worthless as well as
harmful. State the constraint explicitly whenever you circulate it, aggregate to team rather
than individual where you can, and be prepared to drop the analysis rather than let it be
repurposed.

---

← [Reading the co-change matrix](19b-reading-the-co-change-matrix.md) · [Topic index](README.md) · Next → [Event storming](20-event-storming.md)
