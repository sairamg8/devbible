---
title: "Composition & Design Systems: Design Tokens, Variant Matrices & Storybook Composition"
sidebar_label: "Composition & Design Systems"
sidebar_position: 1
---

# 📖 Composition & Design Systems: Design Tokens, Variant Matrices & Storybook Composition

## 1. Under-The-Hood Mechanics

Beyond documenting individual components, Storybook can serve as the **central hub** for an entire design system — documenting design tokens as their own first-class stories, systematically covering every meaningful prop combination, and combining multiple teams' separate Storybook instances into one unified, browsable reference.

```
Design token stories: NOT components — just VISUAL documentation of the raw tokens themselves
  (color swatches, spacing scale, typography samples) as their OWN dedicated stories

Variant matrices: systematically rendering EVERY combination of size × variant × state,
  rather than a few hand-picked examples — catching visual bugs in combinations that
  might otherwise never get manually checked

Storybook Composition: combining MULTIPLE separate Storybook instances (different teams,
  different repos) into ONE shared, unified browsing experience — without needing to
  merge the underlying codebases at all
```

### Design Token Stories: Documenting the Foundation, Not Just Components
A dedicated "Colors" or "Spacing" story rendering the actual design system's color palette/spacing scale as swatches gives the whole team (including non-engineers) a single, authoritative, always-current reference for the design system's foundational values — generated directly from the actual token source (a JS/JSON tokens file), so it can never drift from what components actually use.

For **global theme switching, brand toolbars, shared CSS variables, and custom font loading** in the preview iframe, see the dedicated section:  
[Colors & themes](../17-theming-colors-and-fonts/01-global-colors-themes-and-tokens.md) · [Custom fonts & typography](../17-theming-colors-and-fonts/02-custom-fonts-and-typography.md).

### Variant Matrices: Exhaustive, Not Sampled, Coverage
Rather than a handful of individually-authored stories (`Primary`, `Secondary`, `Disabled`), a variant matrix systematically renders **every** combination of a component's key dimensions (size × color × state) in one grid — surfacing visual bugs that only manifest in specific, less-obvious combinations (e.g. a `small` + `disabled` + `secondary` button that nobody had thought to check individually).

### Storybook Composition: Unifying Multiple Teams' Component Libraries
`refs` configuration lets one Storybook instance embed and link to another, **remotely-hosted** Storybook — letting a large organization with multiple teams' separate component libraries (a core design system, a checkout-specific component library, a marketing-site component library) present them all through **one** unified browsing experience, without forcing every team into a single monorepo/shared build.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Variant Matrix Catching a Visual Bug That Existed for Months, Unnoticed in Individually-Authored Stories.
A button component had individually-authored stories for `Primary`/`Secondary`/`Disabled` — none of which happened to combine `small` size with `disabled` state, a combination that turned out to render with badly-clipped text due to a CSS rule interaction only present at that specific size. Introducing a systematic variant matrix story (rendering every size × variant × state combination in one grid) immediately surfaced this previously-invisible bug — a combination that had existed, broken, for months simply because no individually-authored story happened to exercise that exact combination.

---

## 3. Production-Grade Code Example

```tsx
// Colors.stories.tsx — design tokens as their own first-class documentation
import { tokens } from '../design-tokens';

export default { title: 'Design System/Colors' };

export const Palette = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
      {Object.entries(tokens.colors).map(([name, value]) => (
        <div key={name}>
          <div style={{ background: value, height: 60, borderRadius: 4 }} />
          <p>{name}: {value}</p>
        </div>
      ))}
    </div>
  ),
};
```

```tsx
// Button.stories.tsx — a systematic variant matrix, catching combinations individual stories would miss
const sizes = ['small', 'medium', 'large'] as const;
const variants = ['primary', 'secondary'] as const;

export const VariantMatrix: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
      {sizes.flatMap((size) =>
        variants.map((variant) => (
          <div key={`${size}-${variant}`}>
            <Button size={size} variant={variant} label={`${size} ${variant}`} />
            <Button size={size} variant={variant} label="Disabled" disabled /> {/* the combination that had the bug */}
          </div>
        ))
      )}
    </div>
  ),
};
```

```typescript
// .storybook/main.ts — Storybook Composition, combining multiple teams' separate instances
const config = {
  refs: {
    'design-system': {
      title: 'Core Design System',
      url: 'https://design-system.acme.com', // a SEPARATE, remotely-hosted Storybook, embedded here
    },
    'checkout-components': {
      title: 'Checkout Team Components',
      url: 'https://checkout-storybook.acme.com',
    },
  },
};
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Hand-Copying Design Token Values Instead of Importing From the Source of Truth
```tsx
// ❌ RISKY: hardcoding color values directly in a documentation story means the docs can
// drift from the ACTUAL tokens used elsewhere in the codebase the moment a token value changes
export const Palette = { render: () => <div style={{ background: '#0ea5e9' }} /> }; // hardcoded, can drift

// ✅ CORRECT: import the ACTUAL token source — documentation and real usage share ONE source of truth
import { tokens } from '../design-tokens';
export const Palette = { render: () => <div style={{ background: tokens.colors.primary }} /> };
```

### ⚠️ Pitfall 2: Variant Matrices Becoming So Large They're Impractical to Visually Scan
```
❌ UNWIELDY: a matrix combining 5 sizes × 8 colors × 4 states × 3 icon-positions produces
480 individual renders in one grid — technically exhaustive, but practically impossible
for a human to meaningfully scan for visual regressions at a glance

✅ CORRECT: for components with genuinely many dimensions, consider SEPARATE, smaller
matrices per meaningfully-distinct concern (a size×state matrix, a separate color×state
matrix) rather than one maximally exhaustive, unscannable grid
```

### ⚠️ Pitfall 3: Storybook Composition Creating a Confusing, Inconsistent Cross-Team Experience
Combining multiple teams' Storybook instances via composition is powerful, but if those teams use meaningfully different conventions (different CSF versions, wildly different addon sets, inconsistent naming/organization), the "unified" experience can feel disjointed rather than cohesive — composition solves the technical problem of combining instances, but doesn't substitute for actual cross-team convention alignment if a genuinely unified experience is the goal.
