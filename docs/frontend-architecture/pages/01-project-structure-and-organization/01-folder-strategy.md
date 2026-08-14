---
title: "Project Structure: Feature-Based vs Layer-Based, Colocation & Barrel Files"
sidebar_label: "Project Structure"
sidebar_position: 1
---

# 🏛️ Project Structure: Feature-Based vs Layer-Based, Colocation & Barrel Files

## 1. The Decision Framework

Folder structure isn't a stylistic preference — it's the primary lever determining whether a codebase stays navigable as it grows from 5 features to 50.

```
LAYER-BASED (organize by file TYPE):              FEATURE-BASED / "colocation" (organize by DOMAIN):
  src/
    components/                                       src/
      Button.tsx                                        features/
      CheckoutForm.tsx                                    checkout/
      UserAvatar.tsx                                        CheckoutForm.tsx
    hooks/                                                   useCheckout.ts
      useCheckout.ts                                          checkout.types.ts
      useUser.ts                                              CheckoutForm.test.tsx
    utils/                                                user/
      formatCurrency.ts                                       UserAvatar.tsx
                                                               useUser.ts
  ── simple for SMALL apps                          ── everything ONE feature needs lives in
  ── breaks down past ~20-30 features:                 ONE folder — tests, types, styles included
     touching "checkout" means editing              ── scales because working on checkout NEVER
     4+ scattered folders, cross-cutting                requires touching folders outside features/checkout/
     imports everywhere, unclear ownership
```

### The Actual Tradeoff
Layer-based structure optimizes for "I know what TYPE of file I'm looking for" (all hooks in one place) — feature-based optimizes for "I know what DOMAIN I'm working in" (everything checkout-related in one place). Real-world codebases almost universally hit a wall with layer-based structure once feature count grows past roughly 20-30, because a single feature's logic ends up scattered across 4+ top-level folders, and it becomes genuinely unclear which `components/Button.tsx` usages are safe to change without checking every feature that might import it.

### Colocation Principle: Tests/Styles/Types Live Next to Their Owner
Rather than a parallel mirrored tree (`src/components/Button.tsx` + `tests/components/Button.test.tsx` + `types/components/Button.types.ts`), colocation puts `Button.tsx`, `Button.test.tsx`, and `Button.types.ts` in the **same folder** — deleting a component means deleting one folder, not hunting across three parallel trees for orphaned files.

### Barrel Files: Convenience vs Real Costs at Scale
`export * from './Button'` re-export barrels (`index.ts` files) make imports shorter (`import { Button } from '@/components'` instead of the full path) — but at scale, barrels can defeat tree-shaking (a bundler sometimes can't prove which specific re-exported members are actually used through a barrel, especially with certain bundler/module configurations) and are a common source of circular-import bugs, since a barrel importing from a sibling that itself imports from the barrel creates a cycle that's often non-obvious from either file alone.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Team's Layer-Based Structure Becoming Unmaintainable Past 40 Features.
A team started with a layer-based structure (`components/`, `hooks/`, `utils/`) that worked fine for the first year. By the time the app had grown to 40+ distinct features, a single "add a field to the checkout form" task routinely required touching `components/CheckoutForm.tsx`, `hooks/useCheckout.ts`, `utils/checkoutValidation.ts`, and `types/checkout.ts` — four different top-level folders for one conceptually single change, with no folder-level signal indicating these four files were related at all. Migrating to `features/checkout/` (colocating the component, hook, validation utility, and types together) meant the SAME change touched one folder, and — critically — a new engineer could open `features/checkout/` and see the complete, self-contained scope of everything checkout-related, rather than needing tribal knowledge of which scattered files belonged together.

---

## 3. Reference Implementation

```
src/
  features/
    checkout/
      CheckoutForm.tsx
      CheckoutForm.test.tsx
      useCheckout.ts
      checkout.types.ts
      checkoutValidation.ts
    user-profile/
      ProfilePage.tsx
      useUserProfile.ts
      profile.types.ts
  components/          # ONLY genuinely cross-feature, reusable primitives — a design system, not feature logic
    Button.tsx
    Modal.tsx
  lib/                 # genuinely generic utilities with NO feature-specific knowledge (date formatting, etc.)
    formatDate.ts
```

```typescript
// Avoiding a barrel file's circular-import risk — direct imports instead
// ❌ features/checkout/index.ts (a barrel)
export * from './CheckoutForm';
export * from './useCheckout'; // if useCheckout ALSO imports something re-exported by this barrel ⇒ circular

// ✅ Direct import — no barrel, no circular-import risk, and bundlers can tree-shake precisely
import { CheckoutForm } from '@/features/checkout/CheckoutForm';
import { useCheckout } from '@/features/checkout/useCheckout';
```

---

## 4. Senior Engineer Anti-Patterns & Lessons

### ⚠️ Anti-Pattern 1: Migrating to Feature-Based Structure Mid-Project Without a Clear Boundary Definition
Migrating an established layer-based codebase to feature-based structure without first clearly defining what constitutes "one feature" produces inconsistent, overlapping folders (`checkout/` and `cart/` both partially owning related logic, with unclear boundaries) — worse than either pure structure, since it has neither layer-based's simplicity nor feature-based's clean domain boundaries. Define feature boundaries explicitly (usually matching top-level product/domain concepts) before migrating, rather than letting folder boundaries emerge ad hoc during the migration itself.

### ⚠️ Anti-Pattern 2: Barrel Files at Every Folder Level, "For Consistency"
Adding an `index.ts` barrel to every single folder (not just top-level package-like boundaries) multiplies the circular-import risk surface and the tree-shaking uncertainty across the entire codebase, for a convenience (shorter import paths) that matters far less than the compounding cost at scale. Reserve barrels for genuine package-like boundaries (a shared `packages/ui` consumed by multiple apps) where the convenience/API-surface argument is strongest, not for every feature folder internally.

### ⚠️ Anti-Pattern 3: A "Shared" or "Common" Folder That Becomes a Dumping Ground
A `shared/` or `common/` folder, without a strict definition of what belongs there, tends to accumulate anything an engineer wasn't sure where else to put — eventually becoming a large, unstructured pile with unclear ownership and hidden cross-feature coupling (two "unrelated" features both quietly depending on the same undocumented shared utility). Define `shared`/`components`/`lib` narrowly (genuinely generic, feature-agnostic code only) and push back on anything feature-specific landing there instead of in its owning feature folder.
