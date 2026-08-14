---
title: "03 · The renderer architecture"
sidebar_label: "03 · Renderer architecture"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against the [Storybook frameworks documentation](https://storybook.js.org/docs/configure/integration/frameworks)
> and [`storybook@10.5.8`](https://registry.npmjs.org/storybook/latest).
> **No sandbox run** — this page carries no console output.

Storybook is three layers, and the middle one is the only framework-specific part.

```
CORE  (framework-agnostic)
  CSF · the args/argTypes model · decorators · the addon API
  the story index · the manager UI · the channel
        │
        ▼
RENDERER  (framework-specific — one thin adapter)
  @storybook/react · @storybook/vue3 · @storybook/svelte
  @storybook/angular · @storybook/web-components
        │
        ▼
BUILDER  (how Storybook itself is bundled — framework-agnostic)
  Vite · Webpack 5
```

## Why this matters to you, even on a single-framework team

Two practical consequences, and they are the only reason this topic exists:

**1. What you learn here transfers.** Args, argTypes, decorators, parameters, play
functions and the whole CSF shape are core concepts, not React concepts. A Vue
story file is recognisably the same file:

```ts
// Button.stories.ts — Vue 3. Same shape, different renderer import.
import type {Meta, StoryObj} from '@storybook/vue3';
import Button from './Button.vue';

const meta: Meta<typeof Button> = {component: Button, title: 'Components/Button'};
export default meta;

type Story = StoryObj<typeof Button>;
export const Primary: Story = {args: {variant: 'primary', label: 'Click me'}};
```

The renderer's whole job is turning `args` into that framework's render call —
`createElement` for React, `h()` for Vue. Everything above it is shared.

**2. The renderer and the builder are chosen independently.** React does not imply
Webpack, and Vite does not imply Vue. In practice you name a **combined package**
that pairs one of each:

| Package | Renderer | Builder |
|---|---|---|
| `@storybook/react-vite` | React | Vite |
| `@storybook/react-webpack5` | React | Webpack 5 |
| `@storybook/vue3-vite` | Vue 3 | Vite |
| `@storybook/nextjs` | React | the Next.js build |

```ts
// .storybook/main.ts
const config = {
  framework: {name: '@storybook/react-vite', options: {}},
  stories: ['../src/**/*.stories.@(ts|tsx)'],
};
export default config;
```

## Which builder should you be on?

**The one your application already uses.** This is not a preference question —
it is the only answer that keeps one set of aliases, one set of environment
variable semantics, one set of transforms and one set of plugin behaviours.

The failure mode of getting it wrong is not "Storybook is slow". It is that your
`@/components/…` alias resolves in the app and not in Storybook, your
`import.meta.env.VITE_API_URL` is `undefined`, your SVG-as-component import
returns a string, and each of those is debugged separately as if it were its own
bug.

Switching builders is a `main.ts` change and nothing else — **no story file and no
component changes**, because neither knows which builder is underneath:

```ts
// before
framework: {name: '@storybook/react-webpack5', options: {}}
// after — same React, same stories, same components
framework: {name: '@storybook/react-vite', options: {}}
```

That is the payoff of the separation. The migration cost lives entirely in
`main.ts` and whatever builder-specific config was in it.

## Where the renderer boundary leaks

The abstraction is good, not perfect. Three places it shows through:

- **Docgen.** Prop tables are extracted per-framework — React reads TypeScript
  types or PropTypes, Vue reads `defineProps`, Angular reads decorators. The
  quality and the failure modes differ.
- **Addon support.** An addon deeply coupled to a component model, or to
  builder-specific bundling, may support some combinations and not others.
  `@storybook/addon-a11y` is renderer-agnostic; anything advertising itself as
  "for React" is not.
- **CSF factories.** The `definePreview` / `preview.meta()` / `meta.story()` API
  landed for React first and was extended to Vue, Angular and Web Components in
  **10.3** (April 2026). Feature parity across renderers arrives at different
  times.

## Gotchas

**Symptom — an alias like `@/components/Button` resolves in the app and fails in
Storybook.** *Cause:* Storybook is a second build with a second config; your app's
`vite.config.ts` or `tsconfig` paths are not automatically its config. *Fix:* on
Vite, merge your app's config in `main.ts`'s `viteFinal`; on Webpack, extend
`resolve.alias` in `webpackFinal`. Fixing them one import at a time is the trap.

**Symptom — you picked a builder different from your app's, and small things break
constantly.** *Cause:* two bundlers with different alias, env-var, asset and
transform semantics. *Fix:* match the app's builder. There is no upside to the
mismatch that survives a week of debugging.

**Symptom — an addon works in one project and not another with the same version.**
*Cause:* addon support is per renderer *and* per builder, not universal. *Fix:*
check the addon's documented compatibility against your exact
framework+builder pair before adopting it — and before committing to a framework
migration, check every addon you depend on.

**Symptom — builder-specific code has crept into a `.stories.tsx` file.**
*Cause:* something like a Webpack `require.context()` used to enumerate files.
*Fix:* keep builder-specific concerns in `main.ts`. A story file that names a
bundler cannot survive a builder change, which is the one migration this
architecture was designed to make free.

## Interview questions

**★ What is the difference between a renderer and a builder in Storybook?**
The renderer is the framework adapter — it turns a story's `args` into a real
render for React, Vue, Angular and so on. The builder is how Storybook's own dev
server and static output are bundled: Vite or Webpack 5. They are orthogonal, so a
React project can run on either builder, and switching builders touches only
`main.ts`.

**★ Which builder should a project use, and why?**
Whichever the application already uses. Matching means one set of aliases, one
set of environment-variable semantics, one set of transforms and one set of
plugins. Mismatching produces a stream of small, individually-confusing failures —
an alias that does not resolve, an env var that is `undefined`, an asset import
that returns the wrong thing.

**How much work is it to migrate a Storybook from Webpack to Vite?**
For the stories and components, none — they never reference the builder. The work
is entirely in `main.ts`: the `framework` package name, plus porting whatever
builder-specific configuration lived in `webpackFinal` to `viteFinal`.

**Do your Storybook skills transfer if you change framework?**
Mostly. CSF, args, argTypes, decorators, parameters and play functions are core
and framework-agnostic. What changes is the renderer import, the component syntax
inside the story, and docgen behaviour — plus you must verify that every addon you
rely on supports the new renderer, which is a common late surprise in a framework
migration.

---

**← Prev** [02 · The manager and the preview](./02-manager-and-preview.md) ·
**Next →** [04 · Installing into an existing app](./04-installing-into-an-existing-app.md)
