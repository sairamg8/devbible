---
title: "Assertions & Matchers: Expect API, Equality & Custom Matchers"
sidebar_label: "Assertions & Matchers"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against Jest 29.7 / 30.x documentation — [Expect API](https://jestjs.io/docs/expect).

The `expect` API provides assertion matching and diagnostic diff generation, distinguishing between strict referential equality (`toBe`), deep recursive equality (`toEqual`), and exact structural/prototype parity (`toStrictEqual`).

---

## 1. Under-The-Hood Mechanics

Jest matchers compare received values against expected targets using three distinct equality tiers:

```
toBe(val)           ──► Referential Equality (Object.is)
                        Checks identical memory addresses or identical primitive values.
                        { a: 1 } !== { a: 1 }

toEqual(val)        ──► Deep Structural Equality
                        Recursively traverses enumerable keys.
                        Ignores object prototypes / class constructors.
                        Ignores keys with `undefined` values: { a: 1, b: undefined } == { a: 1 }

toStrictEqual(val)  ──► Strict Deep Structural Equality
                        Checks prototype / constructor equality (new User() !== plain Object).
                        Checks explicit `undefined` keys: { a: 1, b: undefined } != { a: 1 }
                        Checks sparse arrays vs undefined elements ([ , 1] != [undefined, 1]).
```

### Modifier Flags & Asynchronous Matchers
- `.not`: Inverts the assertion condition (`expect(res).not.toBeNull()`).
- `.resolves`: Unwraps a fulfilled Promise before matching (`await expect(fetchUser()).resolves.toEqual({ id: 1 })`).
- `.rejects`: Unwraps a rejected Promise error (`await expect(fetchUser()).rejects.toThrow('Not Found')`).

### Asymmetric Matchers
When asserting on large payloads containing non-deterministic data (UUIDs, timestamps, hashes), asymmetric matchers avoid brittle assertions without mocking timestamps:
- `expect.any(Constructor)`: Matches any instance of the constructor (e.g. `expect.any(String)`).
- `expect.objectContaining({...})`: Asserts that a subset of keys matches without requiring an exhaustive dictionary.
- `expect.arrayContaining([...])`: Asserts that the received array contains all specified elements in any order.

---

## 2. Real-World Engineering Scenario

**Scenario**: Validating API response contracts containing database-generated IDs and sparse optional fields.

An e-commerce order checkout returns an `Order` domain model instance containing a generated UUID, a creation timestamp, line items, and optional discount codes. If the code inadvertently sets `discount: undefined`, `toEqual` silently passes because it strips `undefined` keys during traversal. Using `toStrictEqual` combined with `expect.objectContaining` guarantees that required fields match while catching accidental `undefined` mutations.

---

## 3. Production-Grade Code Example

```typescript
// orderProcessor.test.ts
import { processOrder, calculateSummary, OrderModel } from './orderProcessor';

describe('Order Processor Suite', () => {
  test('returns primitive totals using toBe', () => {
    const total = calculateSummary([10, 20, 30]);
    expect(total).toBe(60);
  });

  test('validates full domain model contract with toStrictEqual', () => {
    const rawOrder = {
      orderId: 'ord_123',
      userId: 'usr_456',
      total: 100,
    };

    const result = processOrder(rawOrder);

    // toStrictEqual verifies that result is an instance of OrderModel,
    // not a plain JavaScript object literal
    expect(result).toStrictEqual(
      new OrderModel({
        orderId: 'ord_123',
        userId: 'usr_456',
        total: 100,
      })
    );
  });

  test('matches dynamic fields with asymmetric matchers', () => {
    const order = processOrder({ userId: 'usr_456', total: 100 });

    expect(order).toEqual(
      expect.objectContaining({
        orderId: expect.stringMatching(/^ord_[a-f0-9]+$/),
        createdAt: expect.any(Date),
        status: 'PENDING',
        tags: expect.arrayContaining(['retail', 'web']),
      })
    );
  });

  test('handles async promise rejections with toThrow', async () => {
    const invalidOrder = { userId: '', total: -10 };

    await expect(processOrder(invalidOrder)).rejects.toThrow('Invalid user ID');
  });
});
```

```typescript
// Custom domain matcher setup: src/test/customMatchers.ts
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} NOT to be within range [${floor}, ${ceiling}]`
          : `expected ${received} to be within range [${floor}, ${ceiling}]`,
    };
  },
});
```

---

## 4. Gotchas & Senior Pitfalls

### Symptom: Object comparison passes in test, but runtime crashes with "x.method is not a function"
- **Cause**: Using `toEqual` when asserting against Class/ORM instances. `toEqual` ignores the prototype chain and constructor, passing plain objects `{}` against class instances.
- **Fix**: Use `toStrictEqual`, which asserts prototype equality and verifies the object was instantiated with `new`.

### Symptom: `await expect(asyncFn()).rejects.toThrow()` passes even if the function resolves successfully
- **Cause**: Forgetting the `await` keyword before `expect(...)`. Without `await`, the assertion promise is returned to Jest without executing in-flight assertions.
- **Fix**: Always prefix `.resolves` and `.rejects` with `await`, or return the promise directly from the test function.

### Symptom: Snapshot or matcher fails intermittently due to dynamic timestamps
- **Cause**: Comparing whole objects that include `Date.now()` or UUIDs without masking.
- **Fix**: Use `expect.objectContaining({ timestamp: expect.any(Number) })` or snapshot property matchers.

---

## 5. Interview Questions & Deep Dives

### ★ 1. What are the three core differences between `toEqual` and `toStrictEqual`?
**Answer**:
1. **Undefined properties**: `toEqual` treats `{ a: 1, b: undefined }` as equal to `{ a: 1 }`. `toStrictEqual` flags this as a difference.
2. **Type/Class checking**: `toEqual` treats `new Point(1, 2)` as equal to `{ x: 1, y: 2 }`. `toStrictEqual` checks the prototype and constructor.
3. **Array sparseness**: `toEqual` considers `[, 1]` equal to `[undefined, 1]`. `toStrictEqual` distinguishes between empty slots and explicit `undefined`.

### ★ 2. How do asymmetric matchers work inside `toEqual`?
**Answer**: Asymmetric matchers implement a custom `asymmetricMatch(other)` method. When `toEqual` traverses object properties, if the expected value contains an asymmetric matcher (like `expect.any(String)`), it delegates the comparison to that matcher's logic rather than checking strict value identity.

### 3. How does `expect.extend` enable custom matcher creation with custom diff formatting?
**Answer**: `expect.extend` registers a matcher function returning an object with `{ pass: boolean, message: () => string }`. Inside the matcher, Jest exposes `this.utils` containing helpers like `this.utils.printReceived()`, `this.utils.printExpected()`, and `this.utils.diff()` for formatted terminal color output.

### 4. What is the danger of asserting errors with `expect(() => fn()).toThrow()` on async functions?
**Answer**: Synchronous `expect(() => fn()).toThrow()` only catches errors thrown synchronously during the initial function call. If `fn()` returns a rejected Promise, the error occurs asynchronously on the microtask queue, causing an unhandled promise rejection. Async rejections must use `await expect(fn()).rejects.toThrow()`.

---

## Where this connects

- **Previous**: [01 · Jest Core Concepts](../01-jest-core-concepts/01-test-structure.md) — Test tree execution lifecycle and hooks.
- **Next**: [03 · Mocking](../03-mocking/01-jest-mock-functions.md) — Spying on functions and asserting call arguments.
- **RTL Matchers**: [08 · RTL Queries](../08-rtl-queries/01-query-variants-and-priority.md) — Extending `expect` with `@testing-library/jest-dom`.
