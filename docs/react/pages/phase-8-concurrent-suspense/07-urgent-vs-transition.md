---
title: "Urgent vs transition updates"
sidebar_label: "07 · Urgent vs transition updates"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useTransition`](https://react.dev/reference/react/useTransition) and
> [`startTransition`](https://react.dev/reference/react/startTransition) (Caveats and the
> parameter description), and
> [`<Suspense>`](https://react.dev/reference/react/Suspense) (the re-suspend caveat).
> The bucket-by-bucket classification is **applied judgement** built on those documented
> behaviours, and is labelled where it is.
> No sandbox script backs this page; claims are cited, not measured.

**Every update is urgent unless you say otherwise. The decision is not "is this slow?" —
it is "would the user be annoyed if this waited?" Those give different answers more often
than you would expect, and the second one is the correct question.**

## The two buckets

| | Urgent | Transition |
|---|---|---|
| **How you get it** | The default — any `setState` | `startTransition(() => setState(…))` |
| **Blocking?** | Yes — commits as soon as it can | No — renders in the background |
| **Interruptible?** | No | Yes, and **restarted** from the newer state |
| **Suspense fallback on re-suspend?** | **Yes** — visible content is replaced | **No** — old content stays |
| **Feedback available** | Immediate result | `isPending` |

The third and fourth rows are the ones that decide real cases, and the fourth is the one
people discover last.

## The wrong test: "is it slow?"

The instinct is to mark slow things as transitions and leave fast things urgent. It gives
the wrong answer in both directions.

**A fast update that should be a transition:** navigating to a route whose data is already
cached. It renders in a millisecond — but if anything in it *can* suspend, an urgent update
means the current screen is replaced by a fallback the moment it does
([topic 02 · 02](02-suspense/02-state-effects-and-resuspending.md)). The speed was never
the issue; the risk of a blanking screen was.

**A slow update that must stay urgent:** a controlled text input. Typing is expensive in a
large form, and it does not matter —

> **Transition updates can't be used to control text inputs.**

— because a value that lags behind the keystrokes is broken, not merely slow.

## The right test

**Would the user be annoyed if this waited?** Applied to the update, not the render cost:

- **Yes → urgent.** Anything that must appear to happen *at* the moment of the
  interaction: the character in the input, the checkbox flipping, the button's pressed
  state, the menu opening.
- **No → transition.** Anything the user understands as "the app is now doing the thing I
  asked for": navigating, filtering, switching tabs, applying a sort, loading a
  panel's contents.

The dividing line is roughly **direct manipulation versus consequence.** Direct
manipulation must be instantaneous or it feels broken. A consequence is allowed to take a
moment, provided the interface says so.

## The classification, applied

⚠️ **Judgement, not documentation** — but each row follows from the documented behaviours
above.

| Interaction | Bucket | Why |
|---|---|---|
| Typing in an input | **Urgent** | Direct manipulation, and transitions cannot control text inputs |
| Toggling a checkbox / radio | **Urgent** | The control must reflect the press immediately |
| Opening a menu or dialog | **Urgent** | The user asked for it to be *there*; it is not a consequence |
| Hover and focus states | **Urgent** | Direct feedback, and cheap |
| Filtering a large list from that input | **Transition** (or a deferred value) | The consequence of typing, not the typing |
| Navigating to another route | **Transition** | Otherwise the current screen blanks the moment anything suspends |
| Switching a tab whose panel loads data | **Transition** | Same |
| Sorting or paginating a big table | **Transition** | A consequence, and it may suspend |
| Applying a filter panel's settings | **Transition** | Same |
| Submitting a form | **Neither** — an Action | Phase 9 owns pending mutations |

Note the last row. A mutation is not a rendering-priority question at all: it is an
event-handler concern with its own pending state, and Phase 9's Actions handle it.
Reaching for `startTransition` there is a category error, even though React 19 does
connect the two.

## Getting it wrong, in both directions

**Marking too much urgent** is the default state of every app that has not thought about
this, and its symptoms are the familiar ones: the input stutters while a list re-renders,
and screens blank to a spinner when the user navigates. Nothing is broken; nothing was
prioritised.

**Marking too much as a transition** is the subtler failure, because the code looks
careful:

- **A control that lags.** If a toggle's own state is deferred, the user presses it and
  sees nothing happen. They press again. Now you have two updates and a bug report about
  double-submission.
- **Feedback disappears entirely.** Suspense fallbacks are suppressed inside transitions,
  so a transition with no `isPending` indicator looks like a click that did nothing
  ([topic 01 · 02](01-usetransition/02-ispending-and-which-tool.md)).
- **Everything becomes interruptible**, including work you wanted finished. A transition is
  restarted by any later update, so an update marked non-urgent in a busy component can be
  restarted repeatedly.

The rule of thumb that falls out: **mark the consequence, never the control.**

## The pairing that does the work

Most real screens have both, and the split is the design:

```jsx
function ProductList() {
  const [query, setQuery] = useState('');          // urgent — the control
  const deferredQuery = useDeferredValue(query);   // non-urgent — the consequence

  const [isPending, startTransition] = useTransition();
  const [sort, setSort] = useState('relevance');

  function changeSort(next) {
    startTransition(() => setSort(next));           // non-urgent — a consequence you own
  }

  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <SortPicker value={sort} onChange={changeSort} disabled={isPending} />
      <div style={{ opacity: query !== deferredQuery || isPending ? 0.6 : 1 }}>
        <Results query={deferredQuery} sort={sort} />
      </div>
    </>
  );
}
```

Two non-urgent things, two different tools, for the documented reason from
[topic 01 · 02](01-usetransition/02-ispending-and-which-tool.md): you own `setSort`, so you
can mark that update; you cannot mark the input's own update, so you defer the *value* the
results receive instead. And both staleness signals — `isPending` and
`query !== deferredQuery` — feed one indicator, because the user does not care which
mechanism made the content stale.

## Gotchas

**Symptom:** the whole screen blanks to a spinner on navigation.
**Cause:** an urgent update re-entered a boundary that was showing content.
**Fix:** navigation is a transition. The fallback is then suppressed and the old screen
stays.

**Symptom:** a toggle feels unresponsive and users double-press it.
**Cause:** the control's own state was marked non-urgent.
**Fix:** mark the consequence, never the control.

**Symptom:** an input drops or reorders characters.
**Cause:** its update was put in a transition, which is not supported for text inputs.
**Fix:** keep it urgent; defer the value the expensive subtree receives.

**Symptom:** a transition never seems to finish in a busy component.
**Cause:** transitions are interrupted and restarted by later updates.
**Fix:** expected. If the work must complete, it does not belong in a transition.

**Symptom:** a form submission is wrapped in `startTransition` and the pending state is
wrong.
**Cause:** a mutation is not a rendering-priority question.
**Fix:** Phase 9's Actions, which own pending mutations.

**Symptom:** everything was marked as a transition and the app feels laggy overall.
**Cause:** with nothing urgent, there is nothing to prioritise *against*.
**Fix:** urgent is the correct default. Mark the exceptions.

## Interview questions

**★ How do you decide whether an update is urgent?**
Not by how slow it is. Ask whether the user would be annoyed if it waited — direct
manipulation must be instantaneous, a consequence may take a moment. Typing, toggling and
opening a menu are urgent; filtering, navigating, sorting and switching a tab that loads
data are transitions. Speed is a bad test in both directions: a fast navigation should
still be a transition so the screen does not blank, and a slow text input must still be
urgent because a lagging value is broken rather than slow.

**★ What is the rule of thumb in one line?**
Mark the consequence, never the control. The control has to reflect the interaction
immediately; the work it causes is what can be deprioritised.

**★ What goes wrong if you mark too much as a transition?**
Controls lag, so users press them twice. Feedback disappears, because Suspense fallbacks
are suppressed inside transitions and without an `isPending` indicator a click looks
ignored. And everything becomes interruptible — a transition is restarted by any later
update, so in a busy component it can be restarted repeatedly. Urgent is the right
default; you mark the exceptions.

**★ Why is a fast update sometimes still a transition?**
Because the reason is not speed but re-suspension. An urgent update that re-enters a
Suspense boundary already showing content replaces that content with the fallback; inside
a transition the old content stays. A route whose data is cached renders instantly and
still blanks the screen if anything in it suspends.

**Where do form submissions fit?**
Nowhere in this classification — a mutation is an event-handler concern with its own
pending state, not a rendering-priority decision. Phase 9's Actions own it, and reaching
for `startTransition` there is a category error.

**A screen has both a search box and a sort control. How do you wire the priorities?**
Both consequences are non-urgent but need different tools. You own `setSort`, so wrap it
in `startTransition` and use `isPending`. You cannot mark the input's own update — text
inputs are excluded — so pass `useDeferredValue(query)` to the results instead. Then feed
both staleness signals, `isPending` and `query !== deferredQuery`, into one indicator,
since the user does not care which mechanism made the content stale.

---

← Prev: [What concurrent rendering means](06-what-concurrent-rendering-means.md) ·
Index: [Phase 8](README.md) ·
Next → [`useDeferredValue`](08-usedeferredvalue.md)
