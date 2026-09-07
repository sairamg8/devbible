---
title: "Box-and-arrow conventions, one colour for data and one for control, a diagramming tool you can drive without thinking, and a plan for when the shared board lags — the tooling should be invisible so the reasoning is not"
sidebar_label: "11 · Whiteboard and remote tooling"
sidebar_position: 12
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-07. Conventions and setup advice, not a quoted standard; no tool is
> recommended by name because the right one is whichever you can drive without thinking. Builds
> on [09 · Communication mechanics](09-communication-mechanics.md). **No sandbox run.**

**The board is not graded; what it lets the interviewer follow is. So the tooling has one job —
to never be the thing you are thinking about.** That means a fixed vocabulary of shapes so the
diagram is legible without a legend, one colour for data flow and one for control so a journey
can be traced by eye, numbered arrows so a flow can be named, and, for remote rounds, a
diagramming tool you have used enough that your hands know it, plus a text pane for requirements
and numbers that survives a laggy board. Practise on the exact setup you will be interviewed on:
a candidate who has only drawn on paper and meets a shared canvas for the first time in the round
spends the reading minutes learning a toolbar.

## A shape vocabulary

Any consistent set works; the point is consistency, so the interviewer stops decoding shapes after
the first minute. One that reads well on both a physical board and a canvas:

| Shape | Means |
|---|---|
| **Rectangle** | a service or a process — something that runs your code |
| **Cylinder** | a store — database, cache, object storage, search index |
| **Wide flat rectangle** | a queue or a log — something that holds messages |
| **Rounded rectangle** | an external system — the client, a payment provider, an email gateway |
| **Dashed rectangle** | a boundary — a region, a zone, a trust boundary |
| **Solid arrow** | data flow — a request, a message, a replication stream |
| **Dashed arrow** | control — a health check, a config push, a leader lease |
| **Small circled number** | a step in a numbered flow |

Label every box with a noun and every store with what it holds ("orders, outbox", "product
cache"). A box with no label is a box the interviewer has to ask about.

## Two colours

One colour for data and one for control is the cheapest legibility win on the board. With it, a
journey is traceable by eye — follow the blue arrows from the client to the store and back — and
the control plane (health checks, leader election, config) does not clutter the trace. Without
it, a diagram with a dozen arrows reads as a web.

On a physical board that is two markers. On a canvas it is two line colours, set once and left.
A third colour for "the thing I am going deep on" is useful at the deep dive — circle the
component, and the interviewer's eye goes where the next ten minutes are.

## Numbering flows

The mechanic is in [09](09-communication-mechanics.md); the drawing habit that supports it: write
the legend of journeys first, at the side of the board, as short text — "1 browse · 2 add to cart
· 3 checkout · 4 order events" — then draw, and put the flow's number on each arrow it traverses,
in traversal order. A flow that touches five arrows gets five small "3"s. When the deep dive comes,
it is "flow 3, from the gateway to the commit", and the interviewer can find it.

The legend doubles as the written functional-requirements list the rubric wants to see, which is
why it goes up first and stays up.

## Layout

A layout that does not need redrawing when the design grows:

- **Left to right** in the direction of a request: client, edge, gateway, services, stores.
- **Asynchronous work below** the synchronous path: queues and workers under the services that
  feed them, so the write path reads as a line and the fan-out reads as a drop.
- **Space between boxes** from the start; the deep dive adds detail *inside* one box, and a
  cramped diagram has nowhere to put it.
- **Requirements and numbers in a fixed corner**, in text, never mixed into the diagram. On a
  canvas that is a text block; on a board it is the top-left, protected from erasure.
- **The "not yet" list** ([01b](01b-staff-and-reading-the-room.md)) in another corner, as text.

When a diagram must grow past what fits, do not shrink it — redraw the changed region on a fresh
area and say "I'm redrawing the checkout path with the reservation ledger in it." Redrawing
cleanly is itself legible.

## Remote rounds: the tool

Pick one diagramming tool and use it for every drill until you no longer look at the toolbar. The
properties that matter, regardless of which:

- **Shapes and arrows in two keystrokes**, and arrows that stay attached when a box is moved.
- **A text tool that is fast**, because half of what goes on the board is words.
- **Colour switching without a menu.**
- **Copy and paste of a box**, so a second service is one action.
- **Works in the browser with no install**, in case the interview uses their tool and you can
  only bring habits.

Interviewers often supply their own canvas. Ask beforehand which; if it is one you have not used,
spend twenty minutes in it the day before. If they say "whatever you like, share your screen", use
yours, and have it open, blank and full-screen before the call starts.

## Remote rounds: the setup

- **Two panes visible at once**: the diagram and a text document for requirements, numbers, the
  API sketch and the not-yet list. Text survives lag and is readable at any zoom.
- **Share the window, not the screen**, so a notification never appears on the board.
- **Test the share** in the first minute — "can you see the canvas?" — and again if the
  interviewer goes quiet for long.
- **Narrate everything you draw** ([09](09-communication-mechanics.md)), because the interviewer
  may see your cursor a second late.
- **Read numbers out** as you write them.
- **A wired connection if you have one**; a phone hotspot as a fallback, tested.

## When the board lags or dies

A plan, rehearsed once, so it is not improvised at minute twenty:

1. **Say it.** "The board seems to be lagging on my side — is it on yours?"
2. **Switch to text.** The text pane holds the design as a list: services, stores, flows as
   numbered lines. A design can be discussed entirely in text; the diagram is a convenience.
3. **Offer the fallback.** "I can share a different tool, or describe the diagram and you draw —
   whichever is easier." Interviewers have seen this and do not penalise it.
4. **If the call itself drops**, rejoin, and summarise where you were in two sentences; the
   summary habit means you have one ready.

The failure that costs is not the lag; it is thirty seconds of silence while you fight it.

## Physical boards

Fewer rounds are on physical boards now, but on-site loops still use them:

- **Write smaller than feels natural** and start at the top-left; boards fill from the left and
  the right third is where the deep dive goes.
- **Keep the requirements corner sacred**; erase around it.
- **Step aside after drawing** so the interviewer can see the board, and point at what you are
  talking about.
- **Two marker colours, tested before the round**; a dead marker is a real and silly delay.

## Gotchas

**★ Symptom: the first five minutes of a remote round spent finding the arrow tool.** Cause: a
tool met for the first time in the interview. Fix: one tool, every drill, until the toolbar is
invisible; and twenty minutes in the interviewer's tool the day before if they supply one.

**Symptom: a dozen arrows and the interviewer asks "which way does the data go?"** Cause: one
colour, no numbers. Fix: data in one colour, control in another, and a flow number on each arrow
of each journey; the diagram becomes traceable by eye.

**Symptom: the requirements got erased to make room for the deep dive.** Cause: requirements
mixed into the diagram area. Fix: a fixed corner (or a text pane) for requirements, numbers and
the not-yet list, never drawn over.

**Symptom: the board lagged and you went silent.** Cause: no rehearsed fallback. Fix: say it,
switch to text, offer to describe while they draw; the design is discussable without the picture.

**Symptom: a notification appeared on the shared screen.** Cause: sharing the whole screen. Fix:
share the window, and silence notifications before the call.

**Symptom: the diagram grew into a cramped web and the deep dive had nowhere to go.** Cause: no
space left between boxes. Fix: draw sparse from the start, and redraw the changed region on fresh
space rather than squeezing detail in.

**Symptom: unlabelled stores, and "what's in that database?"** Cause: cylinders drawn as icons.
Fix: label every store with what it holds; the label is a free sentence of evidence.

## Interview questions

**★ What conventions make a design diagram legible to an interviewer?**
A fixed shape vocabulary — rectangles for services, cylinders for stores, flat rectangles for
queues, rounded ones for external systems, dashed boxes for boundaries — with every box labelled;
two colours, one for data flow and one for control; and numbered flows with a legend that doubles
as the functional-requirements list. Layout left to right in request order, asynchronous work
below the synchronous path, requirements and numbers in a fixed text corner, and space left for
the deep dive.

**How do you prepare the tooling for a remote design round?**
Choose one diagramming tool and use it for every drill until it is invisible; ask beforehand
which tool the interviewer uses and spend twenty minutes in it if it is unfamiliar; keep a text
pane beside the canvas for requirements, numbers, the API sketch and the not-yet list; share the
window rather than the screen; test the share in the first minute; narrate what you draw and read
numbers out; and rehearse the fallback for a lagging board once, so it is not improvised.

**What do you do when the shared board lags or the call drops?**
Say it immediately, switch to the text pane and continue the design as a numbered list, offer to
share a different tool or to describe while the interviewer draws, and if the call drops, rejoin
and summarise where you were in two sentences. The costly failure is silence while fighting the
tool, not the tool failing.

**Why keep requirements and numbers in text rather than on the diagram?**
Because text survives lag, is readable at any zoom, and is never erased to make room for the deep
dive; and because the requirements list is the rubric's line-1 evidence, which should stay visible
for the whole round so the interviewer can redirect against it. The diagram changes; the
requirements should not.

---

← Prev: [10 · How to practise](10-how-to-practise.md) · Index: [Phase 0 — What system design interviews test](README.md) · Next → **Primary sources behind the folklore** *(not written yet)*
