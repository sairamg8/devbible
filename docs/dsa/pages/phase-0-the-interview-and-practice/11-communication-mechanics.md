---
title: "Narrate the plan before the code, name the invariant, state the complexity unprompted, and say what you would do with more time — the four sentences that make a coding round gradable"
sidebar_label: "11 · Communication mechanics"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07. Method, not a quoted standard; interview-format observations are
> tendencies. Builds on [01 · What the rounds grade](01-what-the-coding-rounds-grade.md) (the
> communication line), [02 · The 45-minute shape](02-the-45-minute-shape.md) (where each sentence
> falls) and [07 · The when-stuck protocol](07-the-when-stuck-protocol.md). The design-round
> version is the System Design track's
> [communication page](../../../system-design/pages/phase-0-the-interview/09-communication-mechanics.md).
> **No sandbox run.**

**A coding round has four sentences that the interviewer is waiting to write down, and a
candidate who says all four has filled the communication line and most of the complexity line
without doing anything else.** The plan before the code — structure, pass, invariant, bound —
turns typing into execution of something already agreed. The invariant, said and then written as
a comment, is what makes the code checkable and the trace meaningful. The complexity, stated
without being asked, is the difference between "knew it" and "chose the approach for it". And
"with more time I would…" at the end turns an unfinished optimisation or an untested edge into a
known, bounded gap rather than an omission. Around those four are the mechanics that keep the
interviewer oriented while you type: narrating blocks as they go in, announcing arithmetic,
saying which case you are tracing, and taking the hint in the same breath it arrives.

## The four sentences, and where they fall

| Sentence | When | The shape |
|---|---|---|
| **The plan** | after match, before typing | "One pass; a map from value to last index; invariant: the map holds every element before the current one; O(n) time and space. Brute force would be O(n²)." |
| **The invariant** | in the plan, then as a comment above the loop | "the window `[left, right]` contains no repeated character" — and the line of code that preserves it named as you write it |
| **The complexity** | at the end, unprompted; and earlier if the plan changed | "O(n) time — each index moves forward at most n times — and O(min(n, alphabet)) space for the map." |
| **With more time** | at the close, before the follow-up | "With more time I'd trace the all-equal case, and I'd replace the map with a fixed array of 128 for ASCII input." |

The first and third are the ones most candidates skip, and they are the ones the interviewer
cannot infer from the code.

## Narrating while typing

The rule from the design-round version applies unchanged — say the decision, not the
deliberation — with one addition for code: **name the block as you start it, not after**.
"Building the map as I go, so an element never pairs with itself." "Now the left pointer: it
only moves forward, which is what keeps this linear." "Base case first: empty returns zero."
Each sentence is a block header the interviewer hears before reading the code, and it means the
code is never read cold.

Silence is fine while typing a line whose purpose was just said. It is not fine across a block,
and it is not fine while thinking — thinking is done aloud in the [when-stuck](07-the-when-stuck-protocol.md)
form: restate, shrink, brute force, bottleneck.

## Announcing arithmetic and traces

Two moments look like stalls from the outside and are productive from the inside; both are
fixed by announcing them:

- **Arithmetic** — "let me check the class: ten to the five squared is ten to the ten, too
  slow." Said, the pause is a step; unsaid, it is a silence.
- **A trace** — "tracing `abba`: right at 3 sees `a`, whose last index is 0, but left is already
  2, so the `prev >= left` check keeps left where it is." Said, the interviewer follows the
  variable table with you and can point at the line where it goes wrong; unsaid, they watch you
  stare.

## Taking the hint in the same breath

The hint is a graded line ([01](01-what-the-coding-rounds-grade.md)), and the response is a
sentence: the hint restated, what it changes, and the next action. "Sorted first — right, then
two pointers from the ends, and I can drop the map; let me rewrite the loop." If the hint is not
understood, one clarifying question, immediately: "do you mean sorting the input, or keeping a
sorted structure as I go?" The two failures are deferring ("I'll come back to that") and
pretending.

## Stating the complexity well

"O(n)" is a claim; the graded form is a claim with its reason and its space: "O(n) time because
each index moves forward at most once; O(k) space for the map, where k is the number of
distinct values." Add the cost of the built-ins where they matter — "the sort is O(n log n) and
dominates" — and the assumption where one exists — "assuming the hash map's operations are
constant on average". A candidate who says the reason is not asked "why?"; one who says the
letter is.

## Closing

At the working solution, before the follow-up, a two-sentence close: what was tested, and what
you would do with more time. "Traced the duplicate case and the empty case; with more time I'd
trace the all-equal input and replace the map with a fixed-size array for ASCII." That sentence
turns every known gap into evidence of judgement, and it usually prompts the follow-up the
interviewer had planned — which is the round going well.

## Remote rounds

On a shared editor: say what you are about to type before typing it, because the interviewer
may see the text a second late; read numbers and indices aloud; when tracing, write the table
in a comment block rather than speaking it only, so it survives lag; confirm the editor is
shared in the first minute. The [design-track page on tooling](../../../system-design/pages/phase-0-the-interview/11-whiteboard-and-remote-tooling.md)
covers the setup; a coding round needs less of it — one editor, one language configured, the
test runner known.

## Gotchas

**★ Symptom: correct, linear, and "hard to follow" in the feedback.** Cause: the plan was never
said, so the code arrived without a header; the interviewer read it cold. Fix: the plan
sentence before typing — structure, pass, invariant, bound — and a block header for each block
as it goes in.

**★ Symptom: "what's the complexity?" at the end, every time.** Cause: never volunteered. Fix:
state it at the plan and again at the close, with the reason and the space; the question stops
being asked once the answer arrives first.

**Symptom: a trace done silently for two minutes.** Cause: the trace treated as private work.
Fix: announce the case and speak the variable table; the interviewer can then point at the line
where it diverges, which is faster than finding it alone.

**Symptom: the invariant said, never written, and the loop drifted from it.** Cause: the
sentence not anchored in the code. Fix: one comment above the loop with the invariant; each line
that touches the window or the map is checked against it as it is typed.

**Symptom: the hint acknowledged and the original path continued.** Cause: the hint heard as
a suggestion. Fix: restate it, say what it changes, act on it in the same breath; or ask one
clarifying question if it was not understood.

**Symptom: an unfinished optimisation presented as done.** Cause: no close. Fix: "with more
time I would…" names the gap as a known, bounded one; the interviewer grades a named gap far
above a discovered one.

**Symptom: on a shared editor, the interviewer asked "what line are you on?"** Cause: typing
without narrating on a laggy share. Fix: say what you are about to type, read indices aloud,
put traces in a comment block.

## Interview questions

**★ What do you say during a coding round, and when?**
Four sentences at fixed points: the plan before typing — structure, pass, invariant, bound, with
the brute force as baseline; the invariant again as a comment above the loop; the complexity at
the close, unprompted, with its reason and its space; and "with more time I would…" naming the
known gaps. Around them: a block header as each block starts, announced arithmetic and traces,
and the hint restated and acted on in the same breath it arrives. Together they fill the
communication line and most of the complexity line without any extra work.

**★ Why state the complexity before being asked?**
Because stated unprompted it is evidence that the approach was chosen for its cost — the
complexity line's strongest form — while stated on request it is evidence only that the cost was
known. It also catches the brute force that is too slow before it is written, and it invites the
follow-up on cost that the interviewer had planned, which is the round going to plan. The graded
form carries the reason and the space: "O(n) because each index moves forward once; O(k) for
the map".

**What does "with more time I would…" do for you?**
It converts every known gap — an untested edge, an optimisation not made, a fixed-size array
that would beat the map — into a bounded, named item that shows judgement, rather than an
omission the interviewer discovers. It also tends to prompt the planned follow-up, so the last
minutes are spent on the constraint change the round was building towards. Two sentences at the
close, before the follow-up: what was tested, and what would come next.

**How is narration different in a coding round from a design round?**
The same rule — decisions, not deliberation — with the block header added: name what a block
does as it starts, so the code is never read cold; announce arithmetic and traces so pauses read
as steps; write the invariant as a comment so it is anchored in the code rather than only said.
Design rounds narrate boxes and flows; coding rounds narrate blocks and traces, and both take
the hint in the same breath.

---

← Prev: [10 · Mock interviews](10-mock-interviews.md) · Index: [Phase 0 — The DSA interview and the practice system](README.md) · Next → [12 · Java's collections](12-javas-collections-for-interviews.md)
