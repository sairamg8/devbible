---
title: "02 · File structure and the stories glob"
sidebar_label: "02 · Files and the glob"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the [Storybook configuration docs](https://storybook.js.org/docs/configure)
> and [`storybook@10.5.8`](https://registry.npmjs.org/storybook/latest).
> **No sandbox run** — this page carries no console output.

Two decisions, and the second one causes more confusion per line of config than
anything else in Storybook: **where story files live**, and **which files
Storybook actually looks at**.

## Colocation

Put the story next to the component:

```
src/components/Button/
├── Button.tsx
├── Button.stories.tsx      ← here
├── Button.test.tsx
└── index.ts
```

Not in a top-level `stories/` folder mirroring your source tree. The mirror looks
tidy on day one and is wrong by month three, because nothing forces the two trees
to stay in step: you move `Button` into `components/forms/`, the story stays where
it was, and nobody notices because a stale story still renders.

Colocation gives you three things that a parallel tree cannot:

- **The story moves with the component.** A rename or a directory move takes it
  along, because it is in the same folder.
- **Deleting the component deletes the story.** No orphans.
- **Its absence is visible.** Open the folder, see no `.stories.tsx`, know there
  are no stories. In a parallel tree you have to go and look somewhere else to
  learn that nothing is there.

The cost is that your component folders have more files in them. That is the whole
downside, and it is worth it.

## The `stories` glob

`main.ts` decides what exists:

```ts
// .storybook/main.ts
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  framework: {name: '@storybook/react-vite', options: {}},
};
export default config;
```

**A story file outside this glob does not exist.** Storybook does not warn you, log
anything, or show a placeholder — the file is simply never imported. This is the
number-one cause of "I wrote a story and it isn't in the sidebar".

The `@(a|b)` syntax is picomatch's "exactly one of these" group. A few globs worth
recognising:

| Glob | Matches |
|---|---|
| `../src/**/*.stories.@(ts\|tsx)` | `.stories.ts` and `.stories.tsx` under `src`, any depth |
| `../src/**/*.mdx` | standalone MDX docs pages |
| `../src/**/*.stories.@(js\|jsx\|ts\|tsx)` | the default `init` writes, covering JS too |
| `../packages/*/src/**/*.stories.tsx` | one level of workspace packages in a monorepo |

Two things that catch people:

- **`.stories.jsx` is not matched by `@(ts|tsx)`.** A single JavaScript story file
  in a TypeScript project vanishes silently.
- **`../src/**` does not reach outside `src`.** A story in `packages/ui/` or in a
  sibling app is not covered, which is the standard monorepo surprise.

### The object form, when you need it

```ts
stories: [
  {
    directory: '../src/components',
    files: '**/*.stories.@(ts|tsx)',
    titlePrefix: 'Components',      // prepended to every title from this entry
  },
  {
    directory: '../packages/design-system/src',
    files: '**/*.stories.tsx',
    titlePrefix: 'Design System',
  },
],
```

`titlePrefix` is how you give a monorepo a sane sidebar without writing an explicit
`title` in every single file.

## Diagnosing "my story is not there"

In order — this sequence resolves it nearly every time:

1. **Is it exported?** `const Primary = {...}` with no `export` is not a story.
2. **Does the filename match the glob?** Check the extension and the `.stories.`
   infix specifically. `Button.story.tsx` (singular) is a classic.
3. **Is the file inside the glob's directory?** Print the resolved paths if you are
   unsure — `../src/**` is relative to `.storybook/`, not to the project root.
4. **Is there a default export?** A file with named exports and no `meta` may load
   but behave oddly.
5. **Did the dev server pick up a new file?** Adding the *first* file in a new
   directory occasionally needs a restart; editing an existing one does not.

## What is a story, from the module's point of view

Storybook treats **every named export as a story**. That has a consequence people
hit constantly:

```tsx
// ❌ sampleRows is now a "story" and Storybook will try to render it.
export const sampleRows = [{id: 1}, {id: 2}];

export const WithData: Story = {args: {rows: sampleRows}};
```

```tsx
// ✅ Do not export helpers from a story file.
const sampleRows = [{id: 1}, {id: 2}];

export const WithData: Story = {args: {rows: sampleRows}};
```

If a helper genuinely must be shared, put it in a sibling module —
`Button.fixtures.ts` — and import it. There is also an `includeStories` /
`excludeStories` escape hatch on the meta, but a fixtures module is cleaner and
does not need explaining to the next person.

## Gotchas

**Symptom — you wrote a story file and nothing appears in the sidebar; no error.**
*Cause:* the file is outside the `stories` glob, or its name does not match it.
*Fix:* run through the five-step list above. Storybook never reports a file it did
not import, so silence is the expected symptom, not a sign of something worse.

**Symptom — one story file works and its neighbour does not, in the same folder.**
*Cause:* extension mismatch — `.stories.jsx` against a `@(ts|tsx)` glob, or
`.story.tsx` singular. *Fix:* rename, or widen the glob. This is faster to spot if
you compare the two filenames character by character rather than reading them.

**Symptom — an exported constant shows up in the sidebar as a broken story.**
*Cause:* every named export in a story file is treated as a story. *Fix:* stop
exporting it. Move shared fixtures to a sibling module.

**Symptom — stories in a workspace package do not appear.** *Cause:* `../src/**`
only covers the app's own source. *Fix:* add a second glob entry, or use the object
form with `directory` and `titlePrefix` per package. Also check the package
resolves from source rather than a built `dist`, or hot reload will not work on it.

**Symptom — a story that used to exist stopped appearing after a refactor.**
*Cause:* the component moved and the story did not, so the story now sits outside
the glob — or it moved and still imports a path that no longer exists. *Fix:*
colocate. This class of failure is what colocation prevents structurally.

## Interview questions

**★ You added a story file and it does not appear in Storybook. Where do you
look?**
The `stories` glob in `main.ts` first — a file outside it is never imported and
Storybook reports nothing at all, so silence is the expected symptom. Then check
the export keyword, the exact filename (`.stories.` not `.story.`, and the
extension against the glob's `@(…)` group), and that the path is inside the glob's
directory, which is resolved relative to `.storybook/`.

**★ Why colocate story files with components rather than using a `stories/`
directory?**
Because a parallel tree has nothing keeping it in step with the source tree. Moves
and renames leave stories orphaned, deletions leave them stale, and you cannot tell
by looking at a component folder whether stories exist. Colocation makes all three
structural rather than a matter of discipline.

**What does Storybook consider a story in a `.stories.tsx` file?**
Every named export. That includes exported helpers and fixtures, which is why they
should stay unexported or live in a sibling module — otherwise Storybook tries to
render your sample data as a story.

**How do you organise stories in a monorepo?**
Multiple `stories` entries, usually in the object form with `directory` and
`titlePrefix`, so each package gets a sensible sidebar section without writing an
explicit `title` in every file. Aliases for workspace packages also need mirroring
into `viteFinal`/`webpackFinal`, and resolving those packages from source rather
than `dist` keeps hot reload working.

---

**← Prev** [01 · Component Story Format](./01-component-story-format.md) ·
**Next →** [03 · Typing stories](./03-typing-stories.md)
