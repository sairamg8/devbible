---
title: "Jest Core Concepts: Test Structure, Hooks & Parameterization"
sidebar_label: "Jest Core Concepts"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against Jest 29.7 / 30.x documentation — [Jest Test API](https://jestjs.io/docs/api) and [Setup and Teardown](https://jestjs.io/docs/setup-teardown).

Jest executes tests in two distinct phases: a synchronous registration phase where `describe` blocks construct an in-memory execution tree, followed by an asynchronous test execution phase where scoped lifecycle hooks cascade through suites.

---

## 1. Under-The-Hood Mechanics

When Jest loads a test file, it does not immediately execute test bodies. It runs the file from top to bottom, registering all `describe`, `test`, and lifecycle hooks into an execution tree.

```
Phase 1: File Discovery (SYNCHRONOUS — registers execution tree, runs NO test bodies):
  describe('Cart', () => {
    console.log('1');                 // Executes IMMEDIATELY during discovery
    beforeAll(...)                   // Registered
    beforeEach(...)                  // Registered
    test('adds item', () => {...})   // Registered (body untouched)
    describe('nested', () => {
      console.log('2');               // Executes IMMEDIATELY during discovery
      test('removes item', () => {}) // Registered (body untouched)
    })
  })

Phase 2: Test Execution (Sequential runner loop):
  Cart beforeAll
    ├── Cart beforeEach → 'adds item' test body → Cart afterEach
    └── Cart beforeEach → nested beforeEach → 'removes item' test body → nested afterEach → Cart afterEach
  Cart afterAll
```

### Hook Scoping & Cascading
- Outer `beforeEach` hooks always execute **before** inner `beforeEach` hooks.
- Inner `afterEach` hooks always execute **before** outer `afterEach` hooks (unwinding in reverse order).
- Code written directly in `describe` callbacks (outside of hooks or test bodies) executes during **file collection**, not during test runs.

### Data-Driven Parameterization (`test.each`)
```javascript
test.each([
  [1, 1, 2],
  [2, 3, 5],
])('adds %i + %i to equal %i', (a, b, expected) => {
  expect(a + b).toBe(expected);
});
```
`test.each` generates a distinct, reportable test entry per row in the matrix. If row 2 fails, CI reports a discrete failure at row 2 with precise inputs rather than terminating an entire loop.

---

## 2. Real-World Engineering Scenario

**Scenario**: Testing a financial transaction calculator across multiple currencies and rounding edge cases.

A currency formatting and tax utility must process zero values, decimal fractions, negative deductions, and multi-currency formatting. Rather than writing 15 individual `test()` blocks that duplicate setup logic, `test.each` defines a single parameterized specification tested against a matrix of inputs, currency codes, and expected output strings.

---

## 3. Production-Grade Code Example

```javascript
// priceCalculator.test.js
import { calculateTotal, formatCurrency } from './priceCalculator';

describe('Price Calculator Suite', () => {
  let initialConfig;

  beforeAll(() => {
    initialConfig = { defaultCurrency: 'USD', taxRate: 0.08 };
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateTotal with tax', () => {
    test.each([
      [100, 0.08, 108],
      [50, 0.10, 55],
      [0, 0.08, 0],
      [19.99, 0.05, 20.99],
    ])('subtotal $%f with %f tax rate calculates total $%f', (subtotal, taxRate, expected) => {
      const result = calculateTotal(subtotal, taxRate);
      expect(result).toBe(expected);
    });
  });

  describe('formatCurrency localization', () => {
    test.each`
      amount    | currency | expected
      ${100}    | ${'USD'} | ${'$100.00'}
      ${100}    | ${'EUR'} | ${'€100.00'}
      ${-50.5}  | ${'USD'} | ${'-$50.50'}
    `('$amount in $currency formats as $expected', ({ amount, currency, expected }) => {
      expect(formatCurrency(amount, currency)).toBe(expected);
    });
  });

  describe('error handling on invalid currency', () => {
    test('throws descriptive error on unsupported currency code', () => {
      expect(() => formatCurrency(100, 'INVALID')).toThrow('Unsupported currency: INVALID');
    });

    test.todo('support crypto currency symbols in future release');
  });
});
```

---

## 4. Gotchas & Senior Pitfalls

### Symptom: CI passes with 1 test executed while 50 tests are skipped
- **Cause**: A developer left `test.only()` or `describe.only()` in a file during local debugging. Jest ignores all other tests in the file.
- **Fix**: Enable the ESLint rule `jest/no-focused-tests` in `.eslintrc.js` to fail pull request linting whenever `.only` is committed.

### Symptom: Parameterized tests fail intermittently across runs when using object payloads
- **Cause**: Passing mutable objects in `test.each` rows. If one test case mutates the object, downstream row tests receive the modified object reference.
- **Fix**: Use primitive row values or return fresh object instances inside each test using a factory function.

### Symptom: Console logs inside `describe` print before `beforeAll` runs
- **Cause**: Top-level code inside `describe(...)` executes during the discovery/registration phase, before any lifecycle hooks execute.
- **Fix**: Move all state initialization, network setups, or dynamic configuration into `beforeAll` or `beforeEach` blocks.

---

## 5. Interview Questions & Deep Dives

### ★ 1. What is the exact execution order of code in a Jest test file?
**Answer**: Jest loads the file synchronously, executing all top-level statements and `describe` function bodies to construct the test tree. Only after the tree is fully registered does the test runner execute hooks and test bodies in order: outer `beforeAll` → inner `beforeAll` → outer `beforeEach` → inner `beforeEach` → `test` body → inner `afterEach` → outer `afterEach` → inner `afterAll` → outer `afterAll`.

### ★ 2. What is the difference between `test.each` using array tables vs tagged template literals?
**Answer**: Array tables (`test.each([[a, b, expected]])`) accept typed tuples and pass parameters as function arguments (`(a, b, expected)`). Tagged template literals (`test.each\`amount | expected\``) provide inline column headers and inject an object parameter (`({ amount, expected })`), improving readability for large parameter sets with named fields.

### 3. What happens if an error is thrown inside `beforeAll` vs `beforeEach`?
**Answer**: If `beforeAll` throws, all tests inside that `describe` block are aborted immediately and marked as failed. If `beforeEach` throws, only the current test is failed, but Jest will still attempt to run subsequent tests (re-triggering `beforeEach` for the next test).

### 4. How does `test.concurrent` execute asynchronous tests differently from standard tests?
**Answer**: Standard `test()` blocks execute serially within a file. `test.concurrent()` runs asynchronous tests concurrently within the same process worker. It requires shared resources (mocks, databases) to be strictly isolated per test to avoid race conditions.

---

## Where this connects

- **Next**: [02 · The Expect API](../02-assertions-and-matchers/01-the-expect-api.md) — Assertion matchers and deep equality semantics.
- **Mocking**: [03 · Jest Mock Functions](../03-mocking/01-jest-mock-functions.md) — Clearing and restoring spy state across lifecycle hooks.
- **Node.js Phase 9 (`docs/nodejs/pages/phase-9-testing/`)**: Backend integration testing patterns using the same runner structure.
