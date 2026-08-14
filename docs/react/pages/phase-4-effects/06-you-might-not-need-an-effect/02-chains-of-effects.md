---
title: "Chains of effects"
sidebar_label: "02 · Chains of effects"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
> (§ Chains of computations). No sandbox script backs this page; claims are
> cited, not measured.

**The most damaging shape in the whole topic, because every individual link looks
reasonable. Each effect sets the state that wakes the next one, and the cascade
is only visible when you read all four together.**

## What it looks like

```jsx
// 🔴 Avoid: Chains of Effects that adjust the state solely to trigger each other
useEffect(() => {
  if (card !== null && card.gold) {
    setGoldCardCount(c => c + 1);
  }
}, [card]);

useEffect(() => {
  if (goldCardCount > 3) {
    setRound(r => r + 1);
    setGoldCardCount(0);
  }
}, [goldCardCount]);

useEffect(() => {
  if (round > 5) {
    setIsGameOver(true);
  }
}, [round]);

useEffect(() => {
  alert('Good game!');
}, [isGameOver]);
```

Read any one of those in isolation and it is defensible: *when the card changes,
update the count.* Read them together and playing a single card costs four
renders, each one existing only to let React notice a value and run the next
effect.

Note also the guard clause at the top of each — `if (card !== null && …)`,
`if (goldCardCount > 3)`, `if (round > 5)`. Those exist because the effect runs
on mount too, and has to work out whether this is a real occurrence or just React
starting up. That guard is the same smell as
[chunk 01](01-logic-that-belongs-to-an-event.md)'s: intent being reconstructed
after the fact.

## The rewrite

```jsx
function Game() {
  const [card, setCard] = useState(null);
  const [goldCardCount, setGoldCardCount] = useState(0);
  const [round, setRound] = useState(1);

  // ✅ Calculate what you can during rendering
  const isGameOver = round > 5;

  function handlePlaceCard(nextCard) {
    if (isGameOver) {
      throw Error('Game already ended.');
    }

    // ✅ Calculate all the next state in the event handler
    setCard(nextCard);
    if (nextCard.gold) {
      if (goldCardCount < 3) {
        setGoldCardCount(goldCardCount + 1);
      } else {
        setGoldCardCount(0);
        setRound(round + 1);
        if (round === 5) {
          alert('Good game!');
        }
      }
    }
  }
}
```

Two things changed, and they are worth separating.

**`isGameOver` left state entirely.** It was always `round > 5` — a derived value
that had been stored, which is [Phase 3 · 06](../../phase-3-state/06-derived-state.md)'s
subject. **A chain of effects is very often a chain of derived values that were
mistakenly put in state**, and each stored derivation needs an effect to maintain
it. Remove the storage and the maintaining effect goes with it.

**The rest moved into the handler.** All the state for one card is now computed in
the one place that knows a card was played, and lands in a single batched render
([Phase 3 · 04](../../phase-3-state/04-automatic-batching.md)) instead of four.

## The argument that is underrated

react.dev leads with efficiency, but the second reason is the one that matters at
scale:

> It's also more flexible — if you implement game history, you can step through
> moves without the Effect chain triggering.

**An effect chain cannot be replayed.** It is attached to *state changing*, not to
*the user acting*, and it cannot tell those apart. So every feature that sets
state from somewhere other than the original interaction re-fires the whole
cascade:

- **Undo / redo** — restoring an earlier `round` re-runs the game-over effect.
- **Time-travel debugging or history** — stepping through moves replays alerts
  and requests.
- **Restoring a session** from storage or a URL — hydrating state looks exactly
  like playing the cards.
- **Tests** that seed state directly — they trigger side effects the test never
  asked for.

Logic in a handler is **inert until called**. That is a structural property, not
a performance nicety, and it is why the fix survives features that had not been
thought of yet.

## The snapshot trap in the rewrite

One caveat react.dev attaches, and the most common way the rewrite is got wrong:

> Remember that inside event handlers, state behaves like a snapshot.

So this does **not** work:

```jsx
setRound(round + 1);
if (round > 5) {          // 🔴 still the old round
  alert('Good game!');
}
```

`round` does not change when you call the setter
([Phase 3 · 02](../../phase-3-state/02-state-is-a-snapshot.md)). The chained
version had been getting fresh values for free, because each link ran in a
*later render* where the state had already updated. Collapsing the chain removes
that, so intermediate values have to be named:

```jsx
const nextRound = round + 1;
setRound(nextRound);
if (nextRound > 5) {      // ✅
  alert('Good game!');
}
```

react.dev's own version does this by comparing `round === 5` — checking the value
that *will* become 6 — which is the same idea expressed on the old value. Either
is fine as long as you know which one you are reading.

## When a chain is not a chain

Not every effect that reacts to another effect's state is this antipattern. The
distinguishing question is **whether an external system is involved at each
step**. Two effects where the first connects to a chat room and the second
synchronises the document title with the connection status are not a chain — they
are two independent synchronisations that happen to share a value.

react.dev's own criterion is in the heading: effects *"that adjust the state
solely to trigger each other"*. If a link would still be needed with no other
effects present, it is not part of a chain.

## Gotchas

**Symptom:** one user action produces four or five renders.
**Cause:** a chain of effects each setting the state that wakes the next.
**Fix:** compute the whole next state in the handler; make anything derivable a
plain `const` during render.

**Symptom:** adding undo, history or session restore re-triggers game logic,
sends duplicate requests, or fires alerts.
**Cause:** the logic is attached to state changing, and it cannot tell a restore
from a real interaction.
**Fix:** move it into the handler for the interaction. Handler logic is inert
until called.

**Symptom:** the rewritten handler computes the wrong values.
**Cause:** reading `round` after `setRound(round + 1)` in the same handler —
state is a snapshot, so it has not changed.
**Fix:** name the intermediate: `const nextRound = round + 1`, then use that.

**Symptom:** every effect in the chain starts with a guard clause.
**Cause:** they run on mount as well, so each has to detect whether this is a
real occurrence.
**Fix:** the guards disappear with the chain — a handler only runs when the thing
actually happened.

**Symptom:** removing one effect from the chain breaks two others.
**Cause:** the links are coupled through state, so the dependencies are invisible
in the code.
**Fix:** collapse them. Coupling expressed as sequential statements in a handler
is readable; coupling expressed through state and dependency arrays is not.

**Symptom:** a test sets state directly and unrelated side effects fire.
**Cause:** the side effects are reachable from state rather than from the
interaction.
**Fix:** the same collapse. This is often the first symptom teams actually
notice.

## Interview questions

**★ What is wrong with a chain of effects that each set state to trigger the
next?**
Two things. It costs a render per link — one card played, four renders — and more
importantly it cannot be replayed. The logic is attached to state changing rather
than to the user acting, so undo, history, session restore or a test that seeds
state all re-fire the whole cascade. Computing the next state in the handler that
started it makes the logic inert until something actually calls it.

**★ How do you recognise that a chain is really a derived-state problem?**
Look for state that is a pure function of other state — `isGameOver` being
`round > 5`. Each stored derivation needs an effect to maintain it, and those
maintenance effects are the links. Deleting the storage deletes the effect. In
react.dev's rewrite, `isGameOver` becomes a plain `const` during render and one
of the four effects disappears with it.

**★ What breaks when you collapse an effect chain into one handler?**
Intermediate values. Inside a handler, state is a snapshot, so reading `round`
after `setRound(round + 1)` still gives the old value — the chain had been
getting fresh values only because each link ran in a later render. Name the
intermediates explicitly, or compare against the pre-update value knowingly, as
react.dev's `round === 5` check does.

**How do you tell an effect chain from two legitimate independent effects?**
Ask whether each effect synchronises with an external system in its own right.
react.dev's wording is effects "that adjust the state solely to trigger each
other" — the word is *solely*. Two effects that happen to read the same state but
would each still be needed on their own are not a chain; four effects where three
exist only to wake the next one are.

**Why do the effects in a chain all start with a guard clause?**
Because effects also run on mount, so each one has to work out whether the value
it is watching really changed for a meaningful reason or whether React simply
started up. That guard is intent being reconstructed after the fact. In the
handler version the guards are unnecessary — the handler only runs when the card
was actually played.

---

← Prev: [Logic that belongs to an event](01-logic-that-belongs-to-an-event.md) · Index: [You might not need an effect](README.md) · Next → [State that belongs elsewhere](03-state-that-belongs-elsewhere.md)
