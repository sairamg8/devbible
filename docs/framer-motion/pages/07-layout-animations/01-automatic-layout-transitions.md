---
title: "Layout Animations: The `layout` Prop & `layoutId` Shared Transitions"
sidebar_label: "Layout Animations"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Motion docs — [Layout animation](https://motion.dev/docs/react-layout-animations),
> [Motion component](https://motion.dev/docs/react-motion-component) and
> [Tween](https://motion.dev/docs/tween), read from a 131-page raw mirror of motion.dev.
> Target: **Motion 13.2.0** (`motion`, formerly `framer-motion`) on **React 19.2.8** —
> React version probed on the installed package; `motion` is not installed in this
> checkout, so every API claim here is documentation-verified. **No sandbox run.**
> Validated: 2026-09-06 · claims + output provenance · session f53ba511

# 🎨 Layout Animations: The `layout` Prop & `layoutId` Shared Transitions

## 1. Under-The-Hood Mechanics

The `layout` prop automatically animates **any** position/size change caused by layout reflow (a flex/grid item reordering, a container resizing, content pushing siblings around) — without needing to specify what changed or by how much; Motion figures it out using the FLIP technique.

> *"Motion (previously Framer Motion) can automatically animate an element's size and position whenever a layout change occurs - with a single prop."*

```
FLIP technique (First, Last, Invert, Play):
  1. FIRST: record the element's bounding box BEFORE the layout-triggering change
  2. (the actual DOM/CSS change happens — a reorder, a resize, content added/removed)
  3. LAST: record the element's bounding box AFTER the change
  4. INVERT: apply a transform that makes the element APPEAR to still be in its FIRST position/size
  5. PLAY: animate that transform back to identity (0) — the element visually TRAVELS from
       its old position/size to its new one, even though the underlying layout change was instant
```
This is powerful specifically because it works for **layout changes Motion never explicitly configured** — it isn't told "animate from x:0 to x:100"; it observes that the element's bounding box changed between two renders (for whatever CSS/DOM reason) and automatically animates that transition.

⚠️ **FLIP is the shape of it, not the whole of it** — and upstream deliberately does not call the feature "FLIP":

> *"Layout animations do use the broad FLIP approach (and a whole lot else besides) but FLIP doesn't mean anything to most people."*

The "whole lot else besides" is the part that matters in production — scale correction, parent-relative projection, and `border-radius` compensation:

> *"Unlike basic "FLIP" implementations, it does so while correcting for scale-distortion."*

### How Motion detects a layout change — and what the detection costs
Motion does not diff your CSS or watch the DOM. It **measures**, on a schedule tied to React's render cycle rather than to whether anything actually moved:

> *"By default, layout changes are detected every render."*

That is the sentence to hold onto: *every render*, not *every layout change*. A parent re-rendering for a reason that has nothing to do with layout still costs a measurement pass on every `layout` descendant under it. The documented escape hatch is `layoutDependency`, which swaps "measure on commit" for "measure when this value changes":

> *"To reduce measurements and thus improve performance, you can pass a layoutDependency prop. Measurements will only occur when this value changes."*

```tsx
<motion.nav layout layoutDependency={isOpen} />
```

### Why the animation is a `transform`, and why that distorts children
The performance story is the entire reason this feature exists:

> *"Animating layout is traditionally slow, but Motion performs all layout animations using the CSS transform property for the highest possible performance."*

A width change is therefore played back as a `scale`, and `scale` applies to descendants — text inside a growing card gets stretched, not re-laid-out. Motion documents two separate corrections, and they are not interchangeable:

> *"Child elements: To fix distortion on direct children, these can also be given the layout prop."*

`border-radius` and `box-shadow` are corrected automatically — **but only when they are set through `style` or an animation prop**, never through a stylesheet class Motion cannot read.

```tsx
<motion.div layout style={{ borderRadius: 20 }} />
```

Every way this goes visibly wrong, and every fix for it, is [01b · When a layout animation silently does nothing](01b-when-layout-animations-fail-silently.md).

### `layout="position"` / `layout="size"`: Restricting Scope
Plain `layout` animates both position AND size changes together — `layout="position"` restricts it to only position changes (size changes apply instantly, unanimated), and `layout="size"` does the reverse — useful when only one dimension of a layout change should actually be animated.

> *"If set to "position" or "size" , only its position or size will animate, respectively."*

Those are the only two string values the props reference documents. There is no `"preserve-aspect"` or similar third mode in the current documentation.

### `layoutId`: Shared Element Transitions Across Different Components
Two **completely different** `motion` components (potentially even conditionally rendered, replacing each other) sharing the same `layoutId` string get treated as **one continuous element** by Motion — the classic "magic move" effect where a small thumbnail visually morphs into a full-size detail view, even though they're structurally two entirely separate JSX elements.

> *"If set, this component will animate changes to its layout. Additionally, when a new element enters the DOM and an element already exists with a matching layoutId , it will animate out from the previous element's size/position."*

The coordination machinery around `layoutId` — `LayoutGroup`, `AnimatePresence`, scroll and fixed containers, and which `transition` wins — is [01c · Shared layout coordination](01c-shared-layout-coordination.md).

---

## 2. Real-World Engineering Scenario

**Scenario**: A Photo Gallery Where Clicking a Thumbnail Makes It Visually "Grow" Into a Full-Screen Detail View.
A photo gallery needed clicking a thumbnail to feel like that exact thumbnail smoothly expands into a full-screen detail view — not a generic fade/slide transition between two unrelated-feeling screens. Giving both the small thumbnail `<motion.img>` and the full-screen detail `<motion.img>` the **same** `layoutId` (tied to that specific photo's ID) meant Motion automatically animated the transition between them as one continuous "magic move" — the thumbnail visually growing into the detail view's exact position and size — despite the two images being rendered by entirely different components at entirely different points in the tree, with the thumbnail actually unmounting as the detail view mounted.

---

## 3. Production-Grade Code Example

```tsx
// layout prop — automatic FLIP-based animation for a reorderable list
import { motion } from 'motion/react';

function SortableList({ items }: { items: Item[] }) {
  return (
    <ul>
      {items.map((item) => (
        <motion.li key={item.id} layout> {/* automatically animates position changes on reorder */}
          {item.text}
        </motion.li>
      ))}
    </ul>
  );
}
```

```tsx
// layoutId — shared element "magic move" transition between a thumbnail and a detail view
function Gallery({ photos, selectedId, onSelect }: GalleryProps) {
  return (
    <div className="grid">
      {photos.map((photo) => (
        <motion.img
          key={photo.id}
          layoutId={`photo-${photo.id}`} // shared identity — links this to the detail view below
          src={photo.thumbnailUrl}
          onClick={() => onSelect(photo.id)}
        />
      ))}
    </div>
  );
}

function PhotoDetail({ photo }: { photo: Photo }) {
  return (
    <motion.img
      layoutId={`photo-${photo.id}`} // SAME layoutId as the thumbnail — Motion treats them as ONE continuous element
      src={photo.fullSizeUrl}
      className="detail-view"
    />
  );
}
```

```tsx
// layout="position" — restricting animation to position only, letting size changes apply instantly
<motion.div layout="position">
  {/* if this element's SIZE changes due to content, that happens instantly, unanimated;
      only POSITION shifts (e.g. from a sibling being added/removed) get animated */}
</motion.div>
```

---

## Gotchas

### ⚠️ Pitfall 1: Applying `layout` to a Large Subtree, Causing Expensive Recalculation
Measurement is not conditional. The docs are unambiguous — *"By default, layout changes are detected every render"* — so a `layout` prop on a big container buys a measurement pass on every commit of that subtree, whether or not anything moved.

```tsx
// ❌ PERFORMANCE RISK: the layout prop makes Motion measure this element's bounding box
// on EVERY render of this component, not only renders where the layout actually changed —
// applying it broadly across a large, deeply-nested tree multiplies that measurement cost
<motion.div layout> {/* a huge subtree with hundreds of descendants */} </motion.div>

// ✅ CORRECT (1): apply layout precisely to the SPECIFIC elements that need automatic
// layout animation, not broadly to large container trees "just in case"

// ✅ CORRECT (2): where the container genuinely must animate, name the value that can
// change its layout — measurement then happens only when that value changes
<motion.nav layout layoutDependency={isOpen}>
  {/* hundreds of descendants; no measurement on unrelated re-renders */}
</motion.nav>
```

### ⚠️ Pitfall 2: Believing Two Mounted Elements With the Same `layoutId` Is an Error
🔴 **It is not an error, and Motion does not get confused — it crossfades.** This is documented behaviour in two separate places:

> *"If the original component is still on the page when the new one enters, they will automatically crossfade."*

> *"Layout animations allow more than one element with a layoutId whereas View Transitions will break if the previous element isn't removed."*

The real bug this produces is a *visual* one — you expected a morph and got a dissolve — and the real risk is collision, because IDs are not scoped to a component:

> *"layoutId is global across your site."*

```tsx
// ❌ AMBIGUOUS: a bare id shared by two logical items. Motion will happily crossfade them;
// what you lose is the one-element-moving illusion you were trying to build
<motion.img layoutId="photo" src={photoA.url} />
<motion.img layoutId="photo" src={photoB.url} />

// ✅ CORRECT: layoutId unique PER logical item, so only the pair you mean is ever matched
<motion.img layoutId={`photo-${photoA.id}`} src={photoA.url} />
```

When the same *literal* id is legitimately reused by repeated components — two tab rows both rendering `layoutId="underline"` — the documented fix is namespacing with `LayoutGroup id`, covered in [01c · Shared layout coordination](01c-shared-layout-coordination.md).

### ⚠️ Pitfall 3: Expecting `layout` to Animate Changes Not Caused by Actual DOM/CSS Layout
```tsx
// ❌ MISUNDERSTANDING: layout specifically animates BOUNDING BOX changes (position/size) —
// it does NOT animate arbitrary style property changes like color or opacity; those still
// need their own explicit animate prop values
<motion.div layout style={{ background: isActive ? 'blue' : 'gray' }} /> {/* color change NOT animated by `layout` */}

// ✅ CORRECT: combine layout (for position/size) with explicit animate props (for other properties)
<motion.div layout animate={{ backgroundColor: isActive ? '#3b82f6' : '#6b7280' }} />
```

## Interview questions

**★ Animating `width` and `height` is famously slow. How does a layout animation avoid that, given it is animating exactly those properties?**
It does not animate them. Motion measures the before and after boxes, then plays the difference back as a `transform` — *"Motion performs all layout animations using the CSS transform property for the highest possible performance."* Transforms are composited and can avoid triggering layout and paint entirely, whereas animating `width` forces the browser to recalculate layout for the element, its siblings and its descendants on every frame. The trade is that a size change becomes a `scale`, and `scale` is what creates the distortion problems the rest of the API exists to correct.

**★ How often does a `layout` component measure itself, and why does the answer matter for a big list?**
Every render, by default — not every layout change. The two are very different bills: a list whose parent re-renders on every keystroke of an unrelated search box pays a full measurement pass per keystroke on every `layout` child, even though nothing in the list moved. `layoutDependency` converts that to measurement-on-change: pass the value that can actually alter the layout and Motion measures only when it changes.

**★ Is Motion's layout animation just FLIP?**
FLIP is the skeleton — measure first, measure last, invert with a transform, play back to identity. But upstream is explicit that layout animations *"use the broad FLIP approach (and a whole lot else besides)"*, and the "else besides" is what you actually feel: scale correction on children, `border-radius` and `box-shadow` compensation, parent-relative projection so a child is never left behind by its parent, and interruptibility. Calling it FLIP undersells the parts that make it usable, which is why the docs deliberately avoid the name.

**★ Two elements are mounted with the same `layoutId` at once. What does Motion do, and is that a bug?**
It crossfades them — *"If the original component is still on the page when the new one enters, they will automatically crossfade."* Supporting more than one element per `layoutId` is called out by the docs as an advantage over the View Transitions API, which breaks if the previous element has not been removed. So it is not a bug in Motion; it is a bug in your expectation. If you wanted a single element to appear to travel, the previous one has to leave the tree.

**★ When would you reach for `layout="position"` rather than plain `layout`?**
When the size change is one you do not want animated, or cannot animate honestly. The reference is precise: `"position"` and `"size"` each restrict the animation to that half, and the other half applies instantly. The common case is an element whose aspect ratio differs at both ends — an image, a block of re-wrapping text — where a `scale` between the two states has no correct value to interpolate and reads as a stretch. Animating the position and snapping the size is the better lie.

---

← [Exit animations](../06-animatepresence/01-exit-animations.md) · [Explanations](../README.md) · Next → [When layout animations fail silently](01b-when-layout-animations-fail-silently.md)
