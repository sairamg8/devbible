---
title: "02 · The manager and the preview"
sidebar_label: "02 · Manager and preview"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against the [Storybook configuration docs](https://storybook.js.org/docs/configure)
> and [`storybook@10.5.8`](https://registry.npmjs.org/storybook/latest).
> **No sandbox run** — this page carries no console output.

A running Storybook is **two documents in one browser tab**, and almost every
confusing failure in the tool comes from not knowing which one you are looking at.

```
┌─ MANAGER ─ the outer document ────────────────────────────┐
│  sidebar · toolbar · addon panels · search · URL routing  │
│  Storybook's own React app. Your app's code is not here.  │
│                                                           │
│  ┌─ PREVIEW ─ an <iframe>, its own document ───────────┐  │
│  │                                                     │  │
│  │   YOUR component. YOUR CSS. YOUR fonts.             │  │
│  │   YOUR providers. YOUR bundle.                      │  │
│  │                                                     │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

They are separate documents with separate `window` objects, separate stylesheets
and separate bundles. They communicate over a **channel** — a postMessage-based
event bus — and not by sharing memory.

## Why an iframe at all

Because otherwise your CSS and Storybook's CSS would be in the same document, and
your global `* { box-sizing: border-box }`, your reset, your `body { margin: 0 }`
and Storybook's own chrome would fight. The iframe is a hard boundary, and it is
the reason a story renders the same as it would in your app.

The cost of that boundary is the list of surprises below. All of them are the same
surprise wearing different clothes: **things you set up for the app land in the
preview, not the manager, and vice versa.**

## Which file configures which

| File | Runs in | Controls |
|---|---|---|
| `.storybook/main.ts` | build time, both | which stories exist, addons, framework, static dirs |
| `.storybook/preview.ts` | **preview** | global decorators, parameters, globals, your app's CSS import |
| `.storybook/preview-head.html` | **preview** | raw tags in the iframe's `<head>` — fonts, CDN links |
| `.storybook/manager.ts` | **manager** | Storybook's own UI: brand, logo, theme of the chrome |
| `.storybook/manager-head.html` | **manager** | raw tags in the outer document's `<head>` |

**The rule to memorise:** anything about *your component* goes in `preview.*`;
anything about *Storybook's chrome* goes in `manager.*`. There is no file that
does both, and they do not share variables.

## The consequences you will actually hit

### Your global stylesheet is not there unless you put it there

The app imports it in `main.tsx` or `_app.tsx`. Storybook never runs that file, so
the preview has no reset, no tokens, no base typography — and your component looks
subtly wrong in a way that is hard to name.

```ts
// .storybook/preview.ts
import '../src/styles/global.css';   // ← the app's entry does this; Storybook must too
```

### Your fonts load in the app and not in the preview

Same cause, one level down: a `<link>` in `index.html` is in the app's document,
which is neither of these two. It belongs in `preview-head.html`. Covered
properly in the theming phase.

### DevTools shows you the wrong document

Selecting an element inside the story and typing `$0` in the console gives
`undefined`, because the console is attached to the **manager** by default.
Switch the context dropdown at the top of the DevTools console to the
`storybook-preview-iframe` frame — or open the story on its own at
`/iframe.html?id=components-button--primary`, which loads the preview *without*
the manager and is the single most useful debugging trick in this tool.

### An error can come from either side, and they read differently

| What you see | Which process | Usual cause |
|---|---|---|
| Blank story area, error overlay inside it | preview | your component threw |
| Sidebar empty, "no stories found" | manager | the `stories` glob in `main.ts` matches nothing |
| Storybook itself fails to boot | build | `main.ts` is invalid — on 10.x, usually not valid ESM |
| Addon panel empty but story renders | manager | addon not registered, or the channel event never fired |

### Addons are two halves that talk over the channel

An addon like Actions has a **preview** half that captures the call and a
**manager** half that draws the panel. They exchange events over the channel. This
is why an addon can "work" (your `onClick` fires) while its panel stays empty —
the two halves are independently capable of being broken.

## `iframe.html` — the escape hatch

The preview is a real, standalone document. You can open it directly:

```
http://localhost:6006/iframe.html?id=components-button--primary&viewMode=story
```

No manager, no sidebar, no addon panels — just your component. Use it when:

- **DevTools is fighting you.** No frame switching, no `$0` returning `undefined`.
- **You need to know whether the manager is the problem.** If the story renders
  fine here and badly in the full UI, the fault is a decorator, an addon, or the
  chrome — not your component.
- **Something else needs to embed the story** — a visual-diff service, a
  screenshot job, a design tool.

This is also, in effect, how the test runner and Chromatic see your stories: they
drive `iframe.html`, not the manager.

## Gotchas

**Symptom — the component looks unstyled in Storybook and fine in the app.**
*Cause:* the app's global stylesheet is imported by the app's entry file, which
Storybook does not run. *Fix:* import it in `.storybook/preview.ts`. If it is a
font or a CDN tag rather than a stylesheet, it belongs in `preview-head.html`.

**Symptom — `$0` is `undefined` in the console after clicking an element in the
story.** *Cause:* the console is attached to the manager document; the element is
in the iframe. *Fix:* switch the DevTools JavaScript context to
`storybook-preview-iframe`, or open `/iframe.html?id=…` directly.

**Symptom — you themed Storybook and your component did not change (or the
reverse).** *Cause:* "theme" means two unrelated things here — `manager.ts` themes
the chrome, `preview.ts` themes your components. *Fix:* decide which one you meant;
they never share a value. This is the single biggest source of wasted time in the
theming phase.

**Symptom — an environment variable is `undefined` inside a component.**
*Cause:* the preview is a different build from your app, with a different config,
so your app's `.env` handling does not automatically apply. *Fix:* configure it in
`main.ts` for the builder you are on — `import.meta.env` under Vite,
`process.env` under Webpack. Covered in Phase 9.

**Symptom — an addon panel is permanently empty, but the feature works.**
*Cause:* the manager half of the addon is not registered, or the channel event is
not reaching it. *Fix:* check the addon is listed in `main.ts` and that you are
not on a stale pre-9.0 addon package that no longer exists —
see [topic 05](./05-storybook-10-and-package-consolidation.md).

## Interview questions

**★ Why does Storybook render stories inside an iframe?**
To isolate your application's CSS from Storybook's own UI. Both are documents full
of global styles; in one document a reset, a `body` rule or a `*` selector from
either side would affect the other. The iframe is a hard style and script
boundary, which is what makes a story render the same as it does in the app.

**★ You import your global stylesheet in the app's entry file and the component
looks unstyled in Storybook. Why?**
Storybook never executes your app's entry file — it has its own. The preview
document therefore has none of your global CSS. It has to be imported in
`.storybook/preview.ts`, which is the preview's equivalent of that entry.

**What is the difference between `preview.ts` and `manager.ts`?**
`preview.ts` configures the iframe your components render in — global decorators,
parameters, globals, stylesheets. `manager.ts` configures Storybook's own outer
UI — branding, logo, the chrome's theme. They run in different documents and share
nothing.

**How do the two halves of Storybook communicate?**
Over a postMessage-based channel. Addons are typically written as two halves — one
in the preview that observes or instruments, one in the manager that renders a
panel — exchanging events across it. That is why a feature can work while its
panel stays empty.

**What is `iframe.html` and when would you use it?**
It is the preview document on its own, addressable by story id. Use it to debug
without frame-switching in DevTools, to determine whether a problem is in your
component or in the surrounding chrome, and it is effectively how the test runner
and visual-regression services consume stories.

---

**← Prev** [01 · What Storybook is](./01-what-storybook-is.md) ·
**Next →** [03 · Renderers and builders](./03-renderers-and-builders.md)
