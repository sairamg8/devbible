---
sidebar_position: 4
title: "React 19.2 primitives: `useEffectEvent` for non-reactive side-effects, `<Activity>` for offscreen…"
sidebar_label: "React 19.2 primitives: `useEffectEvent` for non-reactive side-effects, `<Activity>` for offscreen…"
description: "React 19.2 primitives: `useEffectEvent` for non-reactive side-effects, `<Activity>` for offscreen state preservation."
---

# ▲ React 19.2 primitives: `useEffectEvent` for non-reactive side-effects, `<Activity>` for offscreen…

> **Syllabus chapter:** 3. Server Components vs. Client Components  
> **Exact concept:** React 19.2 primitives: `useEffectEvent` for non-reactive side-effects, `<Activity>` for offscreen state preservation.  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

## React 19.2 primitives for the RSC world

Two additions specifically address friction that showed up once components started living on both sides of the boundary:

- **`useEffectEvent`** — extracts non-reactive logic out of an effect (e.g. reading the latest value of a prop inside an event handler defined in the effect) without that logic becoming a reactive dependency that re-triggers the effect. Useful for keeping effect dependency arrays honest instead of suppressing lint warnings.
- **`<Activity>`** — preserves a subtree's state and DOM while it's visually hidden ("offscreen"), instead of unmounting it — e.g. keeping a background tab's scroll position and form state intact instead of losing it every time the user switches away and back.
