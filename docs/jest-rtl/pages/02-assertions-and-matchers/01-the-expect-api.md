---
title: "Assertions & Matchers: `toBe` vs `toEqual`, Asymmetric Matchers & `expect.extend()`"
sidebar_label: "Assertions & Matchers"
sidebar_position: 1
---

# 🧪 Assertions & Matchers: `toBe` vs `toEqual`, Asymmetric Matchers & `expect.extend()`

## 1. Under-The-Hood Mechanics

Jest's matcher family encodes several genuinely different equality/comparison semantics — picking the wrong one either produces false failures (too strict) or false passes (too loose, missing real bugs).

```
toBe(value)          ──► Object.is() REFERENCE equality — for primitives, or verifying the EXACT same object instance
toEqual(value)          ──► RECURSIVE structural/deep equality — ignores undefined properties, ignores object TYPE
toStrictEqual(value)      ──► deep equality LIKE toEqual, PLUS checks undefined properties explicitly AND object type/class
```

### `toBe` vs `toEqual`: Reference vs Structural
```javascript
expect({ a: 1 }).toBe({ a: 1 });     // ❌ FAILS — different object references, even with identical content
expect({ a: 1 }).toEqual({ a: 1 });    // ✅ PASSES — structurally identical, reference doesn't matter
```
`toBe` is correct for primitives (`expect(sum).toBe(5)`) or for verifying two variables reference the **exact same** object (`expect(cachedUser).toBe(originalUser)`) — using it for a fresh object/array comparison is almost always a mistake, since two independently-constructed-but-equal objects will never pass `toBe`.

### `toStrictEqual`: Catching What `toEqual` Deliberately Ignores
```javascript
expect({ a: 1, b: undefined }).toEqual({ a: 1 });        // ✅ PASSES — toEqual ignores undefined properties
expect({ a: 1, b: undefined }).toStrictEqual({ a: 1 });    // ❌ FAILS — toStrictEqual does NOT ignore them

class Point { constructor(x, y) { this.x = x; this.y = y; } }
expect(new Point(1, 2)).toEqual({ x: 1, y: 2 });          // ✅ PASSES — toEqual ignores the class/prototype
expect(new Point(1, 2)).toStrictEqual({ x: 1, y: 2 });      // ❌ FAILS — toStrictEqual checks the object's TYPE too
```

### Asymmetric Matchers: Partial Structural Matching
`expect.objectContaining({...})`, `expect.arrayContaining([...])`, and `expect.any(Constructor)` let an assertion check **part** of a value's shape without requiring an exhaustive, brittle full match — essential when asserting against an object containing genuinely non-deterministic fields (a generated ID, a timestamp).

### Custom Matchers: `expect.extend()`
Domain-specific assertions (`expect(response).toBeValidApiResponse()`) improve test readability and failure-message clarity over generic matchers manually re-checking the same multi-field shape in every test — `expect.extend()` registers a new matcher globally, with a custom pass/fail message.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Test Passing Despite a Real Bug, Because `toEqual` Silently Ignored an Unexpected `undefined` Field.
A refactor accidentally introduced a bug where a required `userId` field was present but set to `undefined` instead of being correctly populated — the existing test used `toEqual`, which explicitly ignores `undefined`-valued properties during comparison, so the test kept passing despite the object being genuinely broken. Switching the assertion to `toStrictEqual` (which does NOT ignore undefined properties) immediately caught the regression, failing loudly on the exact bug `toEqual` had been silently tolerating.

---

## 3. Production-Grade Code Example

```javascript
// toBe vs toEqual vs toStrictEqual — choosing correctly based on what's actually being verified
test('sum returns the correct primitive value', () => {
  expect(sum(2, 3)).toBe(5); // primitive — toBe is correct and appropriate here
});

test('createUser returns the correct shape', () => {
  const user = createUser('Alex');
  expect(user).toEqual({ name: 'Alex', role: 'member' }); // structural match, object identity irrelevant
});

test('createUser does not include unexpected undefined fields', () => {
  const user = createUser('Alex');
  expect(user).toStrictEqual({ name: 'Alex', role: 'member' }); // catches an accidental stray `id: undefined`
});
```

```javascript
// Asymmetric matchers — partial matching for non-deterministic fields
test('creates an order with a generated id and current timestamp', () => {
  const order = createOrder({ items: ['sku_1'] });
  expect(order).toEqual({
    id: expect.any(String),           // don't care about the EXACT generated id, just that it's a string
    createdAt: expect.any(Date),        // don't care about the exact timestamp, just its type
    items: expect.arrayContaining(['sku_1']), // items array CONTAINS this, may have others too
  });
});
```

```javascript
// Custom matcher via expect.extend() — improving readability and failure messages
expect.extend({
  toBeValidApiResponse(received) {
    const pass =
      typeof received === 'object' && received !== null &&
      'status' in received && 'data' in received;
    return {
      pass,
      message: () =>
        pass
          ? `expected response NOT to be a valid API response`
          : `expected response to have 'status' and 'data' fields, got: ${JSON.stringify(received)}`,
    };
  },
});

test('API returns a valid response shape', async () => {
  const response = await fetchData();
  expect(response).toBeValidApiResponse(); // reads clearly, and gives a domain-specific failure message
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Using `toBe` for Object/Array Comparison
```javascript
// ❌ WRONG: ALWAYS fails for freshly-constructed objects/arrays, even when content is identical —
// a very common early mistake, since `toBe` "feels" like the default equality check
expect(getConfig()).toBe({ retries: 3 }); // FAILS — different object references

// ✅ CORRECT: use toEqual (or toStrictEqual) for structural comparison of objects/arrays
expect(getConfig()).toEqual({ retries: 3 });
```

### ⚠️ Pitfall 2: Defaulting to `toEqual` When `toStrictEqual` Would Have Caught a Real Bug
As shown in the scenario above, `toEqual`'s deliberate leniency (ignoring undefined properties, ignoring object type) can mask genuine bugs. For any assertion where an unexpected extra `undefined` field or wrong-class object would represent a real, meaningful bug, `toStrictEqual` is the more rigorous default — reserve plain `toEqual` for cases where that leniency is genuinely desired (e.g. comparing against a plain object literal when the actual value is a class instance, by design).

### ⚠️ Pitfall 3: Over-Constraining an Assertion With an Exhaustive Match Where Asymmetric Matchers Were Needed
```javascript
// ❌ FRAGILE: hardcoding an exact, generated id/timestamp makes the test fail on every single
// run (since these values are genuinely different each time), forcing constant, meaningless test updates
expect(order).toEqual({ id: 'abc123', createdAt: '2026-07-31T10:00:00Z', items: ['sku_1'] });

// ✅ CORRECT: use expect.any()/objectContaining() for genuinely non-deterministic fields,
// keeping the assertion meaningful and STABLE across repeated runs
expect(order).toEqual({ id: expect.any(String), createdAt: expect.any(Date), items: ['sku_1'] });
```
