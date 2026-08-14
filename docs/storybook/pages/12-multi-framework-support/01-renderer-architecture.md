---
title: "Multi-Framework Support: Framework-Agnostic CSF & Builder Options"
sidebar_label: "Multi-Framework Support"
sidebar_position: 1
---

# 📖 Multi-Framework Support: Framework-Agnostic CSF & Builder Options

## 1. Under-The-Hood Mechanics

Storybook's Component Story Format is deliberately **framework-agnostic** at the conceptual level — the same core ideas (meta, named story exports, args, decorators) apply whether the underlying component is React, Vue, Svelte, Angular, or a plain Web Component, with each framework getting its own thin renderer adapter translating those shared concepts into framework-specific rendering calls.

```
Storybook CORE (framework-agnostic):
  CSF format, args/argTypes model, addons API, story index, UI shell
        │
        ▼
Framework RENDERER (framework-SPECIFIC adapter):
  @storybook/react  |  @storybook/vue3  |  @storybook/svelte  |  @storybook/angular  |  @storybook/web-components
        │
        ▼
BUILDER (how the dev server/static build itself is bundled):
  @storybook/builder-vite  |  @storybook/builder-webpack5
```

### Why Separating Renderer From Builder Matters
The **renderer** determines how a story's `args` get turned into an actual on-screen render for that specific framework (React's `createElement`, Vue's `h()`, etc.) — a fundamentally framework-specific concern. The **builder** determines how Storybook's own dev server/static output gets bundled — genuinely independent of which framework is being documented. This separation is why, for instance, a React project can choose the Vite builder (matching the app's own actual bundler, and gaining the same fast dev-server benefits covered in the [Vite bible](../../../vite/pages/01-core-architecture/01-dual-engine-model.md)) OR the Webpack builder, without that choice being tied to using React specifically.

### Same CSF, Portable Concepts Across Frameworks
A team maintaining components in multiple frameworks (a legacy Angular app alongside a new React app, during a migration) can apply the **same** story-authoring mental model to both — args, argTypes, decorators, play functions all conceptually transfer, even though the actual rendering code underneath looks different per framework.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Team Migrating From Webpack to Vite for Their Storybook Build, Independent of Any Framework Change.
A React-based design system's Storybook instance used the Webpack builder, inherited from an older project template — as the team's actual app build had already migrated to Vite (for the dev-server speed benefits covered in the Vite bible), they wanted the same speed benefit for their Storybook dev-server experience. Switching Storybook's `framework` config from the Webpack builder to the Vite builder required **zero changes** to any actual story files or component code — the switch was purely a builder-level configuration change, completely orthogonal to the fact that the underlying framework (React) never changed at all.

---

## 3. Production-Grade Code Example

```typescript
// .storybook/main.ts — React renderer + Vite builder combination
const config = {
  framework: {
    name: '@storybook/react-vite', // React renderer, Vite builder — the combined package for this pairing
    options: {},
  },
  stories: ['../src/**/*.stories.@(ts|tsx)'],
};
export default config;
```

```typescript
// The SAME core CSF concepts, applied to a Vue component instead — conceptually identical structure
// Button.stories.ts (Vue)
import type { Meta, StoryObj } from '@storybook/vue3';
import Button from './Button.vue';

const meta: Meta<typeof Button> = { component: Button, title: 'Components/Button' };
export default meta;

type Story = StoryObj<typeof Button>;
export const Primary: Story = { args: { variant: 'primary', label: 'Click me' } }; // SAME args-driven pattern
```

```typescript
// Switching builders WITHOUT changing the framework — a pure infrastructure/config change
// BEFORE:
const config = { framework: { name: '@storybook/react-webpack5', options: {} } };
// AFTER: (same React components, same story files — ONLY the builder changed)
const config2 = { framework: { name: '@storybook/react-vite', options: {} } };
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Assuming Every Addon Works Identically Across Every Framework/Builder Combination
```
❌ RISKY: some addons (particularly ones deeply integrated with a specific framework's
component model, or with builder-specific bundling behavior) may have partial or
inconsistent support across different renderer/builder combinations — an addon working
perfectly in a React+Webpack setup isn't automatically guaranteed to work identically
in a Vue+Vite setup

✅ CORRECT: verify a given addon's documented compatibility with your SPECIFIC
framework+builder combination before assuming universal support
```

### ⚠️ Pitfall 2: Mixing Builder-Specific Configuration Into Framework-Agnostic Story Files
```typescript
// ❌ WRONG: putting Webpack-specific configuration (a webpack loader rule, a webpack-specific
// alias) directly inside a .stories.tsx file couples that file to a SPECIFIC builder,
// breaking portability if the project later switches builders
// Button.stories.tsx containing webpack-specific require.context() calls, for example

// ✅ CORRECT: keep builder-specific configuration in .storybook/main.ts (the builder config
// layer), leaving story files themselves genuinely framework/builder-agnostic where possible
```

### ⚠️ Pitfall 3: Migrating Framework Without Verifying Every Addon's Renderer Support First
Switching a project's underlying UI framework (a hypothetical React-to-Vue migration) requires verifying that every currently-used Storybook addon has actual, functioning support for the NEW renderer — not every addon in the ecosystem supports every framework equally well, and discovering an essential addon lacks Vue support only AFTER committing to the framework migration is a costly, late-stage surprise.
