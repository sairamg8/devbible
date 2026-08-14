---
title: "Suspense inside a transition"
sidebar_label: "11 · Suspense inside a transition"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`<Suspense>`](https://react.dev/reference/react/Suspense) (the re-suspend caveat),
> [`useTransition`](https://react.dev/reference/react/useTransition)
> (*Transitions do not show fallbacks for suspended content*, and the returns), and
> [`useDeferredValue`](https://react.dev/reference/react/useDeferredValue) (the Suspense
> integration caveat).
> No sandbox script backs this page; claims are cited, not measured.

**A transition deliberately does not show the Suspense fallback. This is the single most
surprising behaviour in the phase, it is intentional, and once you know it, half the
"weird Suspense behaviour" reports resolve themselves — including the ones where the
complaint is that the spinner is *missing*.**

## The rule

> If Suspense was displaying content for the tree, but then it **suspended again**, the
> `fallback` will be **shown again unless the update causing it was caused by
> `startTransition` or `useDeferredValue`.**

And from the transition side, with the reasoning attached:

> **Transitions do not show fallbacks for suspended content** — Transitions only "wait"
> long enough to avoid hiding *already revealed* content. **If content was never revealed,
> the Transition will not "wait" for it.**

That second sentence is the precise statement of the behaviour, and it contains the
exception people miss. The rule is not "transitions never show fallbacks". It is:

| Situation | Fallback shown? |
|---|---|
| First load — nothing was revealed yet | **Yes.** There is no content to protect |
| Content is on screen, an **urgent** update re-suspends it | **Yes.** The content is replaced |
| Content is on screen, a **transition** re-suspends it | **No.** The old content stays |
| Content is on screen, a **deferred value** re-suspends it | **No.** Same |

So a boundary shows its fallback on the way *in* and protects its content thereafter,
provided the update is a transition.

## Why this is the right default

The behaviour looks strange until you picture the alternative. A user is reading a page.
They change a filter. Without this rule, the content they were reading **vanishes** and is
replaced by a skeleton, then comes back slightly different. They have lost their place,
the scroll position, and any sense that the page is stable.

Showing a stale-but-real screen while the new one loads is almost always better than
showing a spinner where content used to be. **React makes that the default and gives you
`isPending` to say so.**

This is also why the distinction is between "already revealed" and "never revealed": on
first load there is nothing to protect, so hiding nothing costs nothing and the fallback is
the right answer.

## The consequence: `isPending` becomes load-bearing

If the fallback is suppressed and you render nothing else, **the interface does not react
to the click at all.** The user presses a tab, nothing happens for 400 ms, and then the
content changes. That reads as a broken button, not as loading.

> The `isPending` flag that tells you whether there is a pending Transition.

So in a transition, `isPending` is not a nicety — it is the *only* feedback channel you
have, and rendering it is part of implementing the transition correctly:

```jsx
function Tabs() {
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState('posts');

  return (
    <>
      <TabList
        value={tab}
        onChange={(next) => startTransition(() => setTab(next))}
        disabled={isPending}
      />
      <div style={{ opacity: isPending ? 0.6 : 1 }}>
        <Suspense fallback={<PanelSkeleton />}>
          <TabPanel tab={tab} />
        </Suspense>
      </div>
    </>
  );
}
```

The `<Suspense>` boundary is still there and still does its job on **first** load. The
`isPending` styling covers every load after that.

**Design the indicator in place, not as a replacement.** Dimming, a disabled control, a
thin progress line at the top — all keep the content the transition was protecting.
Swapping in a spinner throws away the entire benefit and reintroduces the problem the rule
exists to prevent.

For a deferred value the same job is done by comparing the two:

```jsx
<div style={{ opacity: query !== deferredQuery ? 0.5 : 1 }}>
  <SearchResults query={deferredQuery} />
</div>
```

`useDeferredValue` gets the identical treatment from React:

> `useDeferredValue` is integrated with `<Suspense>`. **If the background update caused by
> a new value suspends the UI, the user will not see the fallback.** They will see the
> **old deferred value** until the data loads.

## The two reports this explains

**"The spinner doesn't show any more."** Correct behaviour. Something started marking the
update as a transition — often a router upgrade, since routers mark navigations as
transitions on your behalf. The fallback was suppressed to protect the content on screen.
The fix is an `isPending` indicator, not removing the transition.

**"The page blanks whenever I change a filter."** The opposite: an urgent update
re-entered a boundary that was showing content. The fix is a transition or a deferred
value, and it is not an optimisation — it is part of making the feature correct.

Both reports come from the same rule, read from opposite sides, which is why knowing the
rule resolves them instantly.

## What it does not protect against

- **First load.** Nothing was revealed, so the fallback shows. If a first load feels bad,
  that is boundary placement ([topic 10](10-boundary-placement.md)) and skeleton design,
  not transitions.
- **A `key` change that remounts the subtree.** Remounting means nothing was revealed for
  the *new* tree, so the fallback returns. Resetting state with `key`
  ([Phase 3 · 07](../phase-3-state/07-resetting-state-with-key.md)) and keeping content
  visible are in tension, and you have to pick.
- **The update never being marked.** An update after an `await` inside an async transition
  is not a transition ([topic 09](09-async-transitions.md)), so the fallback returns and
  nothing warns you. When a screen blanks in an async flow, that missing inner
  `startTransition` is the first thing to check.
- **Errors.** Suppression is about pending content. A rejected promise still goes to the
  nearest error boundary ([topic 16](16-error-boundaries-and-suspense.md)).

## Gotchas

**Symptom:** the Suspense fallback stopped appearing after a router upgrade.
**Cause:** the router marks navigations as transitions, which suppresses fallbacks for
already-revealed content.
**Fix:** render an `isPending`-driven indicator. Do not remove the transition.

**Symptom:** clicking a tab appears to do nothing for a moment.
**Cause:** the fallback is suppressed and nothing else was rendered from `isPending`.
**Fix:** dim the panel, disable the control, show a progress line — in place.

**Symptom:** a fallback still shows despite a transition.
**Cause:** it is the first load of that content, or a `key` change remounted the subtree —
in both cases nothing was "already revealed".
**Fix:** expected. Fix it with boundary placement and skeleton design if the first load
feels wrong.

**Symptom:** an async flow blanks the screen mid-way.
**Cause:** the `setState` after an `await` was never marked as a transition.
**Fix:** wrap it in another `startTransition`. It fails silently.

**Symptom:** a spinner was added inside a transition and the page still flashes.
**Cause:** the spinner replaced the content, doing by hand what the rule prevents.
**Fix:** an in-place indicator that keeps the content visible.

**Symptom:** a rejected request shows stale content indefinitely.
**Cause:** suppression concerns pending content, not failures.
**Fix:** an error boundary around the subtree.

## Interview questions

**★ Why does wrapping a navigation in `startTransition` make the spinner disappear?**
Because transitions do not show fallbacks for suspended content that was already revealed.
The docs put it precisely: transitions only "wait" long enough to avoid hiding already
revealed content, and if content was never revealed the transition will not wait for it.
So the boundary still shows its fallback on first load, and thereafter a transition
protects what is on screen rather than replacing it with a skeleton.

**★ Why is that the right default?**
Because the alternative is worse for the user. Someone reading a page who changes a filter
would watch their content vanish, be replaced by a skeleton, and come back slightly
different — losing their place and their scroll position. A stale-but-real screen is almost
always better than a spinner where content used to be.

**★ What does this make `isPending` responsible for?**
All of the feedback. With the fallback suppressed and nothing else rendered, a click looks
ignored — the interface does not respond for the duration and then the content simply
changes. So rendering something from `isPending` is part of implementing the transition,
not a polish step, and it must be *in place* — dimming, a disabled control, a progress line
— because swapping in a spinner discards the benefit entirely.

**★ Two bug reports: "the spinner stopped showing" and "the page blanks on every filter
change". Diagnose both.**
The same rule from opposite sides. The first is a transition working correctly — often
introduced by a router that marks navigations for you — and the fix is an `isPending`
indicator. The second is an urgent update re-entering a boundary that was showing content,
and the fix is a transition or a deferred value. Neither is a Suspense bug.

**When does a fallback still appear despite a transition?**
On first load, because nothing was revealed yet and there is nothing to protect; when a
`key` change remounts the subtree, since the new tree has revealed nothing; and when the
update was never actually marked — most commonly a `setState` after an `await` inside an
async transition, which fails silently.

**Does `useDeferredValue` behave the same way?**
Yes. It is integrated with Suspense in exactly this manner: if the background update
suspends, the user does not see the fallback, they keep seeing the old deferred value.
The staleness signal there is comparing the live value with the deferred one, which needs
no extra state.

---

← Prev: [Suspense boundary placement](10-boundary-placement.md) ·
Index: [Phase 8](README.md) ·
Next → [`use(context)`](12-use-context.md)
