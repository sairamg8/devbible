---
title: "Outside puzzles, plane geometry shows up as four things — an axis-aligned box test, a radius check that should never call sqrt, a hit test against a polygon, and a bounding box used as a cheap filter in front of an expensive predicate"
sidebar_label: "13k · Geometry in backend work"
sidebar_position: 13.95
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08. The rectangle overlap predicate, the intersection-area formula, the
> inclusion–exclusion union of two rectangles and the broad-phase/narrow-phase pattern are
> **mathematics and standard practice**, derived here rather than cited; the inclusion–exclusion
> step is [08e](08e-inclusion-exclusion-and-derangements.md)'s. ⚠️ **Named but not documented
> here**, because their specifications were not fetched for this page: PostGIS and `ST_DWithin`,
> R-trees, PostgreSQL GiST indexes, the GeoJSON coordinate order, and the Haversine formula's
> accuracy characteristics. Each is flagged at the point of use. **No sandbox run** — the SQL below
> has not been executed and no query plan is claimed. Version spine:
> **JDK 25 · MDN as fetched 2026-09-07**.

**Almost none of the geometry in a working system is a convex hull. It is a rectangle overlapping
another rectangle, a point being within a radius, a point being inside a drawn region, and a cheap
box test standing in front of an expensive exact one.** Those four cover map viewports, geofences,
delivery zones, collision detection, hit testing, image-region deduplication and search-index
tiling. They are also where the squared-distance habit and the exactness argument from the rest of
this topic pay for themselves in production rather than in an interview — because a delivery radius
computed with a square root, on floating-point degrees, near a boundary, is a support ticket that
reproduces for one customer and nobody else.

## Axis-aligned rectangles

Represent a rectangle by two opposite corners, with `x1 < x2` and `y1 < y2` normalised on
construction. Two axis-aligned rectangles overlap **iff they overlap on both axes independently** —
that is the whole derivation, and it is why this predicate has no geometry in it at all:

```ts
type Rect = { x1: number; y1: number; x2: number; y2: number };

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;

/** Zero when they do not overlap, so no branch is needed. */
const intersectionArea = (a: Rect, b: Rect): number => {
  const w = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
  const h = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
  return w > 0 && h > 0 ? w * h : 0;
};

const unionArea = (a: Rect, b: Rect): number =>
  (a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - intersectionArea(a, b);
```

```java
record Rect(long x1, long y1, long x2, long y2) {}

static boolean overlaps(Rect a, Rect b) {
    return a.x1() < b.x2() && b.x1() < a.x2() && a.y1() < b.y2() && b.y1() < a.y2();
}

static long intersectionArea(Rect a, Rect b) {
    long w = Math.min(a.x2(), b.x2()) - Math.max(a.x1(), b.x1());
    long h = Math.min(a.y2(), b.y2()) - Math.max(a.y1(), b.y1());
    return w > 0 && h > 0 ? w * h : 0;      // long: an area is a PRODUCT
}
```

The union of two rectangles is inclusion–exclusion — `A + B − A∩B` — which is
[08e](08e-inclusion-exclusion-and-derangements.md) in two dimensions. For **`n` rectangles it is
not**: inclusion–exclusion over `n` sets has `2^n` terms, and the practical algorithm is the sweep
line of [13i](13i-convex-hull-and-the-sweep-line.md) — sweep in `x`, maintain the covered `y`
length as rectangles open and close, and accumulate covered-length times `x`-width.

**Strict or non-strict is a decision.** The `<` above means rectangles sharing only an edge do
**not** overlap. For pixel rectangles and grid cells that is what you want, and it pairs with the
half-open convention `[x1, x2)`, under which adjacent cells tile the plane with no cell counted
twice. For "do these two reserved areas touch", you want `<=`. Mixing the two conventions inside
one codebase is the reliable way to double-count exactly the boundary rows.

**Intersection over union** — `intersectionArea / unionArea` — is the standard score for "are these
two detected boxes the same object", used to deduplicate detections. It is a ratio, so it is one of
the few places on these pages where a division is genuinely the output.

## The radius check, and the storefront

The PERN storefront's delivery-radius test is the squared-distance habit of
[13](13-geometry-basics.md) in its natural habitat: *is this address within `r` of the store?*

```ts
const withinRadius = (store: Pt, addr: Pt, r: number): boolean =>
  dist2(store, addr) <= r * r;          // no sqrt, and r*r is computed once
```

Three practical points that the interview version does not raise.

**Hold the radius in the same unit as the coordinates, and prefer an integer unit.** Metres, not
kilometres. `4.5` km is representable as a double and `0.1` km is not, so a radius stored in
kilometres puts a rounding question directly into a comparison that decides whether a customer can
order. Store `4500` metres and compare squared metres.

**The comparison at the boundary is a business rule, not a numerical one.** "Exactly on the
boundary" needs `<=` or `<` chosen deliberately, written down, and matched between the API and the
UI — otherwise the map draws a circle that includes an address the API rejects.

**In SQL, the shape that uses an index is a bounding box, not a distance.** A distance expression
over both columns cannot use an ordinary B-tree index, so the pattern is a cheap indexable box
filter followed by the exact test:

```sql
SELECT id
FROM   addresses
WHERE  lat BETWEEN :lat_min AND :lat_max        -- indexable range, prunes cheaply
  AND  lon BETWEEN :lon_min AND :lon_max
  AND  (lat - :lat) * (lat - :lat)
     + (lon - :lon) * (lon - :lon) <= :r_deg_squared;   -- exact, on the survivors
```

⚠️ For real geospatial work the answer is a spatial extension — PostGIS with a distance predicate,
backed by a GiST or R-tree index. Those are **named here, not documented**: their specifications
were not fetched for this page, so treat the names as pointers to read rather than as claims about
behaviour.

## 🔴 Latitude and longitude are not a plane

The SQL above is written in degrees, and degrees are not a metric space. **A degree of latitude is
roughly constant in ground distance; a degree of longitude shrinks with the cosine of the
latitude**, going to zero at the poles. So a "radius in degrees" is a circle in coordinate space and
an ellipse on the ground, wider east–west near the equator and increasingly narrow towards the
poles.

Three levels of answer, in increasing cost:

1. **Small areas, one city:** scale longitude by `cos(latitude)` before the Euclidean comparison —
   the local flat-earth approximation. Cheap, and adequate when the region is small enough that the
   cosine barely varies across it.
2. **Anywhere on the globe:** the Haversine formula, which computes great-circle distance on a
   sphere. ⚠️ Named here; its exact form and its accuracy relative to an ellipsoidal model were not
   fetched for this page.
3. **Anything that matters:** a geospatial library or extension, with a stated coordinate reference
   system.

Two more failure modes belong to coordinates rather than to distance. **The antimeridian**: a
bounding box that crosses ±180° longitude has `lon_min > lon_max`, so the naive `BETWEEN` matches
nothing — it must be split into two boxes. And **coordinate order**: ⚠️ GeoJSON is widely
documented to order positions longitude-first while most map UIs and most people say "lat, long" —
verify against RFC 7946 before writing the adapter, and then write a test that would fail if the
two were swapped, because a swapped pair is still a valid coordinate somewhere else in the world.

## Hit testing and collision

**Hit testing** is point-in-rectangle for a button and point-in-polygon
([13e](13e-point-in-polygon-by-ray-casting.md)) for an irregular region — a map country, an SVG
path, a drawn selection. Three details that are specific to a UI rather than to geometry:

- **Screen coordinates put `y` downward**, which reflects the plane and inverts every orientation
  sign, per [13b](13b-the-cross-product.md). Parity-based point-in-polygon is immune; anything
  winding-based is not.
- **Z-order decides the winner.** With overlapping targets, iterate in reverse paint order and take
  the first hit, rather than collecting all hits and picking arbitrarily.
- **Transforms compose.** Scroll offset, zoom and device pixel ratio all sit between the event's
  coordinates and the geometry's coordinates. Convert once, at the boundary, into one coordinate
  space, and do all geometry there.

**Collision detection** is the broad-phase/narrow-phase pattern, and it is the most transferable
idea on this page:

1. **Broad phase** — reject cheaply and conservatively. Test axis-aligned bounding boxes, which is
   four comparisons and never gives a false negative. To avoid testing all `O(n²)` pairs, bucket
   objects into a uniform grid (a spatial hash) or a quadtree and only test pairs sharing a bucket.
2. **Narrow phase** — run the expensive exact test only on the survivors: polygon–polygon
   intersection, or the segment tests of
   [13c](13c-orientation-and-segment-intersection.md).

The same two-phase shape appears everywhere: a bounding box in front of a point-in-polygon geofence
check, a cheap hash in front of a full equality comparison, a Bloom filter in front of a disk read.
Recognising it as one pattern is more useful than any individual instance.

## Gotchas

**★ An area is a product, so an area overflows where a coordinate does not.** A rectangle
`10^9 × 10^9` has an area of `10^18` — inside a `long`, outside an `int`, and outside a JavaScript
number's exact integer range at `10^9 × 10^7`. [13g](13g-integer-exactness-and-where-it-ends.md)
has the bounds; the practical rule is that width and height may be `int` and the area may not.

**★ Mixing half-open and closed rectangle conventions double-counts boundaries.** Pixel and grid
work wants `[x1, x2)`, so adjacent cells tile without overlap. Reservation and collision work often
wants closed intervals. Pick one per coordinate space, write it in the type's documentation, and
normalise at the boundary between systems.

**★ Rounding a floating-point rectangle to integers must be directional.** `Math.round` on all four
corners can shrink a box below the region it was meant to cover. To stay conservative — never lose
a candidate in a broad phase — floor the minimum corner and ceil the maximum.

**★ A distance predicate in SQL does not use a B-tree index.** Any expression over the columns
defeats an ordinary index, so a query that is only a distance filter is a sequential scan. The box
prefilter is what makes it indexable, and the exact test then runs on a small survivor set. ⚠️ This
is a statement about how ordinary B-tree indexes are used, not a claim about any specific planner's
behaviour, which was not verified here.

**★ Comparing a distance in degrees to a radius in kilometres type-checks.** Both are numbers. Unit
mismatches in geospatial code are silent, and the usual symptom is a radius that behaves correctly
in one city and absurdly in another. Encode the unit in the name — `radiusMetres`, `latDegrees` —
because the type system will not.

**★ Bounding boxes that cross the antimeridian match nothing.** `lon BETWEEN 179 AND -179` is an
empty range. Split into `lon >= 179 OR lon <= -179`. The same applies to any wrapped coordinate
space, including angle ranges in radians.

**★ A geofence boundary needs a documented convention.** "Is a point exactly on the fence inside
it" is a business question, and ray casting's answer to it is arbitrary. Decide it, implement it
with the explicit on-edge check from [13e](13e-point-in-polygon-by-ray-casting.md), and test it —
because the customer who complains will be standing on the line.

**★ GPS coordinates are floating point and arrive with error, so exact predicates on them are
theatre.** Quantise to a grid whose cell size reflects the sensor's actual accuracy, per
[13f](13f-floating-point-and-the-epsilon-decision.md), and then compare exactly. That converts an
epsilon scattered through the code into one documented decision at the boundary.

**★ Broad phase without a spatial index is still `O(n²)`.** Testing every pair's bounding boxes is
cheaper per pair, not fewer pairs. The grid or quadtree is what removes the quadratic; the box test
only removes the constant.

## Interview questions

**★ Do these two axis-aligned rectangles overlap?**
They overlap iff their `x` ranges overlap and their `y` ranges overlap independently, which is
`a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2`. The reason it decomposes is that an
axis-aligned rectangle is the Cartesian product of two intervals, so intersecting rectangles is
intersecting intervals twice. I would confirm whether rectangles that merely touch should count,
because that is the difference between `<` and `<=` and it is not deducible from the problem
statement.

**★ Compute the area of the intersection, and then of the union.**
The intersection is a rectangle whose width is `min(x2) − max(x1)` and whose height is
`min(y2) − max(y1)`; if either is non-positive there is no intersection and the area is zero, which
means the overlap test is not needed as a separate branch. The union is `A + B − A∩B` by
inclusion–exclusion. For `n` rectangles inclusion–exclusion is `2^n` terms and unusable — the real
answer is a sweep line that tracks the total covered `y` length as rectangles open and close, and
multiplies it by the `x` distance between events.

**★ Design the delivery-radius check for a store.**
Compare squared distances: `dx² + dy² <= r²`, with `r` squared once, outside the loop, and with
every quantity in the same integer unit — metres, not kilometres, so no representable-value
question enters a comparison that decides an order. In the database, the query is a bounding-box
range filter that an index can serve, followed by the exact squared comparison on the survivors.
And I would raise two non-numeric issues: whether the boundary is inclusive, and that latitude and
longitude are not a plane, so a radius in degrees is an ellipse on the ground — for a single city I
would scale longitude by the cosine of the latitude, and for anything global use a real geospatial
extension.

**★ Why is a bounding box the first thing you test?**
Because it is a conservative filter: it can produce false positives but never false negatives, so
it is safe to use in front of an exact test. Four comparisons reject the overwhelming majority of
candidate pairs, and the expensive predicate — polygon intersection, point-in-polygon, a distance
on an ellipsoid — only runs on what survives. The same pattern is a hash before an equality check
and a Bloom filter before a disk read. The one caveat is that the filter reduces the cost per pair,
not the number of pairs; removing the quadratic needs a spatial index as well.

**★ Ten thousand moving objects, and you need the colliding pairs each frame. What do you build?**
A uniform grid whose cell size is about the size of the largest object, rebuilt or updated each
frame: insert each object into the cells its bounding box touches, and test only pairs sharing a
cell, deduplicating pairs found in more than one cell. That is the broad phase, and it is linear in
practice when the objects are spread out. Then the narrow phase runs the exact test on the
survivors. A quadtree is the alternative when the density varies a lot across the space, since a
uniform grid degenerates when everything clusters into one cell.

**★ Why should a distance never appear in a query's `WHERE` clause on its own?**
Two reasons. It is an expression over the columns, so an ordinary B-tree index cannot serve it and
the query degrades to a scan. And it is usually written with a square root, which is both
unnecessary — squaring the radius gives the same predicate — and a floating-point operation on
values that may already be approximate. The shape that works is an indexable range filter on each
coordinate followed by the exact squared comparison, or a purpose-built spatial index if the
workload justifies one.

**★ Where does the screen's downward y-axis actually bite?**
Anywhere a sign carries meaning: orientation tests, winding-based fill rules, convex-hull output
order and the shoelace sign all invert, because a flipped axis is a reflection. Magnitudes — areas,
distances, overlap — are unaffected, and parity-based point-in-polygon is unaffected because it
counts crossings rather than reading signs. The defence is to convert into a single coordinate
convention at the input boundary and do every geometric computation in that one space.

---

← Prev: [13j · Max points on a line](13j-max-points-on-a-line.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next phase → [Part 2 of the syllabus — arrays, strings and hashing](../../syllabus/02-arrays-strings-and-hashing.md)
