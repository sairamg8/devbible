---
name: research-framer-motion-track
description: 🔴 BANKED RESEARCH — do not re-derive. The primary-source facts for the whole docs/framer-motion track, verified 2026-09-06 against a 131-page mirror of motion.dev. Covers the framer-motion→motion/react rename, motion.create() replacing the callable motion(Component) form, and the React 18 vs 19 ref split. Open before touching any framer-motion page.
metadata:
  type: reference
---

# Motion (framer-motion) — banked research, 2026-09-06

🔴 **Do not re-derive.** Verified against a **131-page mirror of motion.dev**, fetched raw
(`urllib`, never WebFetch — its summariser paraphrases, which is the defect class being
hunted). Mirror method: `https://motion.dev/llms.txt` → 131 doc URLs → strip HTML → text.
Rebuild in ~60s with the script in `.agents/references/validation-pipeline.md` if needed.

## Version spine

| | |
|---|---|
| `motion` | **13.2.0** (npm registry, 2026-09-06) |
| `framer-motion` | **13.2.0** — 🔴 **still published, in lockstep, and NOT deprecated on npm.** No deprecation notice on the latest version. |
| React pinned by this corpus | **19.2.8** (T1-probed: `node -p "require('./node_modules/react/package.json').version"`) |
| `src/data/pins.js:266` | `motion`, policy `latest`, **pin `null`** — the track has no version anchor |

⚠️ **The old package name still works.** A page importing `framer-motion` is not broken code —
it is *out of date with upstream's own instruction*, which matters for a reference site but is
an **S2, not an S1**. Do not describe it to a reader as an error that breaks their build.

## The three load-bearing facts

### 1 · The rename — `framer-motion` → `motion/react`

> *"To upgrade to Motion for React, uninstall framer-motion and install motion"* —
> [React upgrade guide](https://motion.dev/docs/react-upgrade-guide)

```bash
npm uninstall framer-motion
npm install motion
```

> *"Then simply swap imports from "framer-motion" to "motion/react""* — ibid.

```tsx
import { motion } from "motion/react"
```

Upstream still writes `framer-motion` in exactly three of 131 docs — the upgrade guide (as
the *old* side of the swap), `figma`, and `ai-kit-context`. Everywhere current, it is
`motion/react`.

### 2 · 🔴 `motion(Component)` is gone — it is `motion.create()`

> *"You can add motion capabilities to any React component with motion.create()."* —
> [Motion component](https://motion.dev/docs/react-motion-component)

```tsx
const MotionComponent = motion.create(Component)
```

🔴 **The callable form `motion(Component)` appears ZERO times in all 131 current docs.** A page
teaching it is teaching an API upstream no longer documents. This is an **S1** — wrong API in
a code example — and it is a *separate defect from the rename*, which is why a pure
import-name sweep would have left it in place.

`motion.create()` also accepts a string, and takes a config:

```tsx
const MotionComponent = motion.create('custom-element')     // renders <custom-element />
motion.create(Component, {forwardMotionProps: true})        // props are filtered out by default
```

### 3 · 🔴 `forwardRef` is version-split — and this corpus is on React 19

Upstream's requirement is *"Your component must pass a ref to the component you want to
animate"* — **how** you pass it depends on the React version:

> *"React 18: Use forwardRef to wrap the component and pass ref to the element you want to
> animate"*

```tsx
const Component = React.forwardRef((props, ref) => {
  return <div ref={ref} />
})
```

> *"React 19: React 19 can pass ref via props"*

```tsx
const Component = (props) => {
  return <div ref={props.ref} />
}
```

🔴 **Any page stating `forwardRef` is *required* is teaching the React 18 path as a hard rule
to a corpus that pins React 19.2.8.** This is the defect class no version tooling can catch:
the claim was true when written, and a *different library's* major release silently falsified
it. There is no version string on the page to flag.

⚠️ One place `forwardRef` **is** still required on React 19:

> *"When using popLayout mode, any immediate child of AnimatePresence that's a custom
> component must be wrapped in React's forwardRef function"* —
> [AnimatePresence](https://motion.dev/docs/react-animate-presence)

So do not sweep `forwardRef` out of the track wholesale — check the context.

## Blast radius, measured on disk 2026-09-06

| Pattern | Files | Class |
|---|---:|---|
| imports `framer-motion` | **13** | S2 — works, but contradicts upstream's instruction |
| callable `motion(X)` | **1** (`01-core-concepts/01-declarative-animation-philosophy.md`, 4 occurrences) | **S1** |
| asserts `forwardRef` required | **1** (same file) | **S2** |
| uses `motion.create` | **0** | — |

The whole track is 16 pages / 18 units, **0 sourced, 0 badged, 0 stamped**.

Related: [[devbible-validation-ledger]] · [[devbible-frontend-toolchain-currency-plan]] ·
[[devbible-corpus-audit-20260905]]
