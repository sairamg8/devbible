---
title: "Think aloud, number the flows, summarise every few minutes, ask before deep-diving, and treat the interviewer's hint as the agenda — communication is the rubric line that multiplies all the others"
sidebar_label: "09 · Communication mechanics"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07. Method, not a quoted standard; interview-format observations are
> tendencies. Builds on [03 · The rubric](03-the-rubric.md) (line 7) and
> [07 · The common ways to fail](07-the-common-ways-to-fail.md) (silence, defending, the wrong
> deep dive). **No sandbox run.**

**The interviewer can only grade what they heard, and communication is the line that decides how
much of the other six lines they heard.** Five mechanics do most of the work: narrate while you
draw so there is never a silent minute; number the flows on the diagram so a journey can be
referred to by number; summarise every few minutes in decisions, not technologies; ask before a
deep dive so the time goes where the interviewer wants it; and treat every hint as the agenda
rather than an interruption. None of them is about charisma. They are habits that make the
reasoning audible, and each one has a phrase that does it — the phrases are worth rehearsing
until they arrive on their own.

## The five mechanics, with the phrase for each

| Mechanic | When | The phrase |
|---|---|---|
| **Narrate the box** | every time you draw one | "This is the order service; it owns the order row and the outbox. If it went away, nothing could accept a checkout." |
| **Number the flows** | as soon as the high-level diagram exists | "Flow 1 is browse, flow 2 is add-to-cart, flow 3 is checkout — I'll refer to them by number." |
| **Summarise in decisions** | every ten minutes, and at every transition | "So far: three journeys, read-heavy, one region; a log for order events, asynchronous fan-out; next, the celebrity case." |
| **Ask before the deep dive** | after the high-level design | "I'd go deep on inventory contention — that's the hardest part at a sale. Would you rather I went deep on payments?" |
| **Take the hint as the agenda** | whenever the interviewer redirects | "You mentioned preferences — let me go there now and come back to fan-out if there's time." |

## Narrating without rambling

Thinking aloud is graded well when it is *structured* thinking aloud: the sentence has a subject
(the box), a purpose (the requirement it serves), and a consequence (what breaks without it).
It is graded badly when it is a stream — every thought voiced, including the ones you discard a
second later. The difference is one habit: **say the decision, not the deliberation.** "A cache
here, because product reads dominate and the hot set is small" is narration. "Hmm, maybe a cache,
or maybe read replicas, or actually we could…" is noise until it resolves; resolve it silently for
five seconds, then say the decision and the rejected alternative in one sentence.

Two places silence is fine: the five seconds before a decision, and while you write a number.
Announce the second: "let me work this out — a million a day is about twelve a second." The
announcement turns a silence into a visible step.

## Numbering the flows

A diagram with numbered flows changes the conversation. Instead of "the thing where the user
buys", both of you say "flow 3". The deep dive becomes "flow 3, steps 4 to 6". The failure walk
becomes "if the primary dies, flows 2 and 3 fail, flow 1 keeps working from the cache". The
numbers make the diagram *addressable*, and an addressable diagram is one the interviewer can
write feedback against.

The convention is cheap: a small circled number on each arrow of a journey, in the order the
journey traverses them, and a legend of journeys at the side. Draw the legend first — three lines
of text — because it doubles as the functional-requirements list the rubric wants to see written
down.

## Summarising

A summary every ten minutes does three things: it lets the interviewer redirect early, it lets
*you* notice a blank rubric line while it is still fixable, and it gives the round a shape the
interviewer can follow. The failure mode is summarising the *diagram* — a list of technologies
— which adds nothing. Summarise the *decisions*:

- what is in scope and what is out
- the numbers you are designing for
- the choices made so far, each with its cost in a clause
- what you are about to do next

Twenty seconds. If the interviewer interrupts the summary with a redirect, that is the summary
working.

## Asking before the deep dive

The deep dive is where senior loops put the most weight, and the wrong deep dive wastes it. The
ask is one sentence naming your choice, your reason and the alternative: "I'd go deep on
inventory contention because it's the hardest thing at a sale — or would payments be more
useful?" Three outcomes, all good: the interviewer agrees (you have consent for ten minutes on
your strongest ground), the interviewer redirects (you now know the agenda), or the interviewer
says "your call" (you have shown that you can choose, and you go with your first).

What not to do is deep-dive without asking and discover at minute forty that the interviewer
wanted the other component. It is the single most expensive communication failure because it
costs the highest-weighted ten minutes of the round.

## Taking the hint

Interviewers hint constantly, and the hints are the agenda: "what about the write path?",
"how does that behave when the provider is slow?", "you mentioned preferences earlier". Each one
is a line of the rubric the interviewer is trying to fill for you. The graded response is to go
there immediately and visibly: "good point — let me trace the write path now." The anti-signal is
to finish the current thought first, or to say "I'll get to that" and not get to it. If you are
mid-sentence on something that matters, finish the sentence — not the paragraph — and go.

A hint is not a criticism. An interviewer who hints is investing in the round; one who has
stopped hinting has often stopped grading.

## Disagreeing, not knowing, and stopping

Three moments where the mechanics are less obvious:

- **Disagreeing with the interviewer.** Rare, and fine when done as a trade-off: "I'd push back
  gently — synchronous replication there adds a cross-region round trip to every write; if
  durability across regions is the requirement I'd rather pay it asynchronously with a stated
  recovery point. Does that meet what you need?" The disagreement is a reasoned choice with its
  cost, and it ends with a question.
- **Not knowing.** Say it, bound it, and reason from what you do know: "I haven't operated
  Cassandra, so I'll reason from what I know about leaderless quorums — R plus W over N — and you
  can correct the specifics." Reasoning from a bounded gap is graded well; bluffing is graded
  very badly when it is caught, and it is usually caught.
- **Stopping.** When the interviewer says "that's enough on that", stop, even mid-thought.
  When you have answered a follow-up, stop; do not append three more considerations. When the
  round is ending, offer a one-sentence close — what you would do next with more time — and stop.

## Remote rounds

On a shared board or a screen share, the mechanics change slightly:

- **Say what you are drawing while you draw it**, because the interviewer may be seeing your
  cursor a second late. "Adding the order service to the right of the gateway."
- **Read numbers out**, because small text on a shared board is hard to read: "twelve hundred a
  second — I've written it next to the gateway."
- **Confirm the board is visible** in the first minute, and again if the interviewer goes quiet.
- **Keep a text pane** for requirements and numbers; text survives a laggy board better than
  handwriting. **11 · Whiteboard and remote tooling** *(not written yet)* covers the setup.

## Gotchas

**★ Symptom: a complete, correct design and feedback that says "hard to follow."** Cause: the
reasoning stayed in your head; the interviewer saw boxes appear without hearing why. Fix: narrate
every box with its requirement and its consequence, and summarise in decisions every ten minutes;
the reasoning has to be audible to be graded.

**★ Symptom: the deep dive was on the wrong component.** Cause: no ask before diving. Fix: one
sentence — your choice, your reason, the alternative — before the deep dive, every time; the
answer costs ten seconds and the mistake costs ten minutes.

**Symptom: "I'll get to that" — and you never did.** Cause: the hint treated as an interruption
to be deferred. Fix: go there now; finish the sentence, not the paragraph. If you genuinely must
finish a thought, say the hint back so it is on record and return within a minute.

**Symptom: the summary was a list of technologies and the interviewer looked bored.** Cause:
summarising the diagram rather than the decisions. Fix: scope, numbers, choices with costs, what
is next — twenty seconds, no product names unless a choice is about one.

**Symptom: you thought aloud and it came out as a stream of maybes.** Cause: deliberation
voiced instead of decisions. Fix: resolve for five seconds silently, then say the decision and the
rejected alternative in one sentence; announce the silence when it is arithmetic.

**Symptom: you disagreed with the interviewer and the temperature dropped.** Cause: the
disagreement was stated as a verdict rather than a trade-off with a question at the end. Fix:
"I'd rather X because Z, paying W — does that meet the requirement?" gives the interviewer a way
to redirect without either of you losing face.

**Symptom: on a shared board, the interviewer asked "what is that?" twice.** Cause: drawing
without narrating on a laggy board. Fix: say what you are adding as you add it, read numbers out,
and keep requirements in text.

**Symptom: the interviewer said "that's enough on that" and you kept going.** Cause: the
sentence heard as encouragement to finish. Fix: stop, even mid-thought, and ask where they want
to go next; the phrase means the line is filled.

## Interview questions

**★ What are the communication mechanics of a design round, and why does the line multiply the
others?**
Narrate each box with its requirement and consequence; number the flows so the diagram is
addressable; summarise in decisions every ten minutes; ask before the deep dive; and take every
hint as the agenda. Communication multiplies the other rubric lines because the interviewer can
only grade what they heard: scoping, estimation, depth, failure handling and trade-offs all
produce evidence as sentences, and a candidate who does not make those sentences audible is
graded as not having done the work, however good the diagram.

**★ How should you handle a hint from the interviewer, and what does mishandling it cost?**
Go there immediately and visibly — "let me trace the write path now" — finishing the sentence you
are on but not the paragraph. A hint is the interviewer trying to fill a rubric line for you, so
deferring it ("I'll get to that") leaves the line blank and signals that you do not take
direction. The costliest version is the deep dive: an interviewer who said "I care most about the
feed" and then watched ten minutes on uploads has seen the highest-weighted part of the round
spent on the wrong thing.

**What is the difference between narrating and rambling?**
Narrating states decisions: the box, the requirement it serves, what breaks without it, and the
alternative rejected — one sentence each. Rambling voices the deliberation: every option
considered, in real time, including the ones discarded a second later. The fix is to resolve
silently for a few seconds and then say the decision; the only silences worth announcing are
arithmetic, and those are announced so they read as a step rather than a stall.

**Why number the flows on a diagram?**
Because it makes the diagram addressable. The deep dive becomes "flow 3, steps 4 to 6"; the
failure walk becomes "if the primary dies, flows 2 and 3 fail and flow 1 keeps working"; the
interviewer can write feedback against a numbered journey. The legend of flows, drawn first,
doubles as the written functional-requirements list the rubric wants to see.

**How do you say "I don't know" in a design round?**
Say it, bound it, and reason from the nearest thing you do know: "I haven't run that system, so
I'll reason from the general mechanism — leaderless quorums with R plus W over N — and you can
correct the specifics." A bounded gap with reasoning attached is graded well; a bluff is graded
badly when caught, and in a follow-up-driven round it is usually caught.

**What should a ten-minute summary contain, and what should it leave out?**
Scope in and out, the numbers being designed for, each choice made with its cost in a clause, and
what comes next — about twenty seconds. Leave out the list of technologies on the board; that
restates the diagram and gives the interviewer nothing to redirect. A summary that gets
interrupted by a redirect has done its job.

---

← Prev: [08 · Reasoned beats memorised](08-reasoned-wrong-beats-memorised-right.md) · Index: [Phase 0 — What system design interviews test](README.md) · Next → **How to practise** *(not written yet)*
