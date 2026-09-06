---
title: "Layout Animations: The `layout` Prop & `layoutId` Shared Transitions"
sidebar_label: "Layout Animations"
sidebar_position: 1
---

# 🎨 Layout Animations: The `layout` Prop & `layoutId` Shared Transitions

## 1. Under-The-Hood Mechanics

The `layout` prop automatically animates **any** position/size change caused by layout reflow (a flex/grid item reordering, a container resizing, content pushing siblings around) — without needing to specify what changed or by how much; Motion figures it out using the FLIP technique.

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

### `layout="position"` / `layout="size"`: Restricting Scope
Plain `layout` animates both position AND size changes together — `layout="position"` restricts it to only position changes (size changes apply instantly, unanimated), and `layout="size"` does the reverse — useful when only one dimension of a layout change should actually be animated.

### `layoutId`: Shared Element Transitions Across Different Components
Two **completely different** `motion` components (potentially even conditionally rendered, replacing each other) sharing the same `layoutId` string get treated as **one continuous element** by Motion — the classic "magic move" effect where a small thumbnail visually morphs into a full-size detail view, even though they're structurally two entirely separate JSX elements.

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

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Applying `layout` to a Large Subtree, Causing Expensive Recalculation
```tsx
// ❌ PERFORMANCE RISK: the layout prop requires Motion to measure the element's bounding box
// on every render where a layout change MIGHT have occurred — applying it broadly across a
// large, deeply-nested tree can introduce real measurement/recalculation overhead
<motion.div layout> {/* a huge subtree with hundreds of descendants */} </motion.div>

// ✅ CORRECT: apply layout precisely to the SPECIFIC elements that actually need automatic
// layout animation, not broadly to large container trees "just in case"
```

### ⚠️ Pitfall 2: Using Mismatched or Colliding `layoutId` Values
```tsx
// ❌ WRONG: TWO simultaneously-mounted elements sharing the SAME layoutId confuses Motion —
// it expects layoutId to represent ONE logical element across time, not two coexisting ones
<motion.img layoutId="photo" src={photoA} />
<motion.img layoutId="photo" src={photoB} /> {/* ❌ same layoutId, but BOTH exist at once */}

// ✅ CORRECT: layoutId should be unique PER logical item (e.g. include the item's own id),
// and the shared-transition pattern assumes only ONE of the pair is ever mounted at a time
<motion.img layoutId={`photo-${photoA.id}`} src={photoA.url} />
```

### ⚠️ Pitfall 3: Expecting `layout` to Animate Changes Not Caused by Actual DOM/CSS Layout
```tsx
// ❌ MISUNDERSTANDING: layout specifically animates BOUNDING BOX changes (position/size) —
// it does NOT animate arbitrary style property changes like color or opacity; those still
// need their own explicit animate prop values
<motion.div layout style={{ background: isActive ? 'blue' : 'gray' }} /> {/* color change NOT animated by `layout` */}

// ✅ CORRECT: combine layout (for position/size) with explicit animate props (for other properties)
<motion.div layout animate={{ backgroundColor: isActive ? '#3b82f6' : '#6b7280' }} />
```
