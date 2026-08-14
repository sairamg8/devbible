---
title: "06 · Parameters and the merge order"
sidebar_label: "06 · Parameters"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against the [parameters reference](https://storybook.js.org/docs/api/parameters)
> and [`storybook@10.5.8`](https://registry.npmjs.org/storybook/latest).
> **No sandbox run** — this page carries no console output.

Three kinds of configuration now exist, and telling them apart is most of what
this page is for:

| | What it is | Who reads it |
|---|---|---|
| **args** | inputs to the component | the component |
| **globals** | session-wide environment | decorators, via context |
| **parameters** | static config *about* a story | **Storybook and its addons** |

Parameters never reach your component. They tell Storybook and its addons how to
present, document and test the story.

```tsx
const meta = {
  component: Button,
  parameters: {
    layout: 'centered',                       // core: how the canvas positions the story
    backgrounds: {default: 'dark'},           // the backgrounds feature
    a11y: {config: {rules: [{id: 'color-contrast', enabled: false}]}},
    docs: {description: {component: 'The primary action control.'}},
    chromatic: {disableSnapshot: true},       // a third-party addon reading its own key
  },
} satisfies Meta<typeof Button>;
```

**Each addon owns a top-level key.** That is the whole convention: `a11y` belongs
to the accessibility addon, `chromatic` to Chromatic, `docs` to the docs addon. An
addon you have not installed simply ignores its key — which is why a typo here
fails silently.

## The merge order

The rule you actually need:

```
preview.ts  (global)   →   meta  (file)   →   story
                       overriding, per key
```

More specific wins. This is the same order as args, globals and argTypes — one
rule for everything.

**The merge is deep for parameters**, unlike args:

```ts
// preview.ts
parameters: {
  docs: {toc: true, source: {type: 'dynamic'}},
},
```

```tsx
// a story
parameters: {
  docs: {toc: false},
},
```

The story gets `{toc: false, source: {type: 'dynamic'}}` — `source` survives. Args
in the same shape would have lost it. **Parameters merge deeply; args merge
shallowly.** That asymmetry is the single most useful thing on this page, and it
is where most "why did my override behave differently than I expected" questions
land.

### Replacing rather than merging

Because the merge is deep, you cannot *remove* a nested key by overriding — only
set it to something. Where an addon supports it, `null` or an explicit disable flag
is the escape hatch:

```tsx
parameters: {
  backgrounds: {disable: true},
  chromatic: {disableSnapshot: true},
},
```

Most addons provide `disable` for exactly this reason.

## Parameters you will use

| Parameter | Effect |
|---|---|
| `layout` | `'centered'`, `'padded'`, `'fullscreen'` — how the canvas frames the story |
| `backgrounds` | the canvas background swatches, and the default |
| `viewport` | preset device sizes, and which one a story opens in |
| `docs` | description, table of contents, source-code display |
| `a11y` | axe rule configuration (Phase 7) |
| `options.storySort` | sidebar ordering — global only (Phase 1 topic 05) |
| `test` | test-runner behaviour |

`layout` is the one worth setting deliberately per component: `'centered'` for a
button, `'fullscreen'` for a page or a layout shell, `'padded'` (the default) for
most things. A page component rendered `'padded'` looks broken in a way that is
easy to misattribute to the component.

## Args, globals, parameters — choosing

The question that resolves it: **who needs to read this?**

- The **component** needs it → **arg**.
- Every story needs it and a person switches it → **global**.
- **Storybook or an addon** needs it → **parameter**.

Worked example — a story that must render dark:

- `args: {theme: 'dark'}` — only if `theme` is genuinely a prop of the component;
- `globals: {theme: 'dark'}` — if the app-wide theme decorator supplies it, which
  is the usual case;
- `parameters: {backgrounds: {default: 'dark'}}` — only changes the canvas
  background behind the component, and changes nothing about the component. This
  is a frequent confusion: a dark canvas with a light component looks like the
  theme "half applied".

## Gotchas

**Symptom — a parameter override "did not apply".** *Cause:* it is being set at a
level you are not looking at — usually `preview.ts` — or on the wrong level of
nesting inside the addon's key. *Fix:* check all three levels for that key. Merge
order is global → meta → story, most specific winning.

**Symptom — an override behaved differently for parameters than for args.**
*Cause:* parameters merge **deeply**; args merge **shallowly**. *Fix:* expected.
Overriding one nested parameter key keeps its siblings; overriding an object arg
replaces the whole object.

**Symptom — you set a parameter and absolutely nothing happened.** *Cause:* a
misspelled addon key, or an addon that is not installed. Parameters are untyped
free-form config, so nothing validates them. *Fix:* check the key against the
addon's documentation, and check the addon is in `main.ts`.

**Symptom — the background is dark but the component is still light.** *Cause:*
`parameters.backgrounds` changes the canvas behind the story, not the component's
theme. *Fix:* use the theme global and its decorator (topic 05). The two are
independent, and setting only the background produces exactly this half-applied
look.

**Symptom — a page-level component looks broken in Storybook only.** *Cause:* the
default `layout: 'padded'` adds padding a page component does not expect. *Fix:*
`parameters: {layout: 'fullscreen'}` on that component's meta.

## Interview questions

**★ What is the difference between args, globals and parameters?**
Args are inputs to the component. Globals are session-wide environment state,
switched from the toolbar. Parameters are static configuration *about* the story,
read by Storybook and its addons and never passed to the component. The test is
who needs to read it — the component, a person switching context, or an addon.

**★ How do parameters merge, and how does that differ from args?**
Both merge global → meta → story with the most specific winning, but **parameters
merge deeply while args merge shallowly**. Overriding one nested parameter key
keeps its siblings; overriding an object-valued arg replaces the whole object. That
asymmetry is behind most "why did my override behave differently" confusion.

**★ You set a parameter and nothing happened. What do you check?**
Whether the key is spelled correctly and belongs to an addon you actually have
installed — parameters are free-form and untyped, so an unknown key is silently
ignored. Then check whether a more specific level is overriding it, since story
beats meta beats global.

**Why does each addon own a top-level parameter key?**
Because parameters are the addon configuration channel — `a11y` for the
accessibility addon, `chromatic` for Chromatic, `docs` for the docs addon. An addon
reads its own key and ignores everything else, which is what lets unrelated addons
coexist without a shared schema, at the cost of no validation.

**A story's background is dark but the component still renders light. Why?**
`parameters.backgrounds` only changes the canvas behind the story; it does not
touch the component's theme. Theming comes from a global plus a decorator that
supplies the theme provider. Setting only the background is what produces the
"half-applied theme" look.

---

**← Prev** [05 · Globals and toolbars](./05-globals-and-toolbars.md) ·
**Next →** the phase index — [Phase 2 overview](./README.md)
