---
title: "Jest Core Concepts: Test Structure, Hooks & Parameterization"
sidebar_label: "Jest Core Concepts"
sidebar_position: 1
---

# 🧪 Jest Core Concepts: Test Structure, Hooks & Parameterization

## 1. Under-The-Hood Mechanics

Jest builds a **tree** of test structure at file-load time — every `describe`/`test` call registers itself into this tree **synchronously**, before any actual test body runs; the tests themselves execute only afterward, in a separate phase.

```
File load (SYNCHRONOUS — registers structure, runs NO test bodies yet):
  describe('Cart', () => {
    beforeAll(...)     // registered, runs ONCE before ALL tests in this describe block
    beforeEach(...)      // registered, runs before EACH test in this describe block
    test('adds item', () => {...})   // registered, body NOT yet executed
    describe('nested', () => {...})    // nested describe — hooks CASCADE inward
  })

Execution phase (AFTER the whole file has loaded):
  beforeAll → beforeEach → test 1 body → afterEach → beforeEach → test 2 body → afterEach → afterAll
```

### Hook Scoping & Cascading
`beforeEach`/`afterEach` declared in an **outer** `describe` run for **every** test in that block, including tests inside **nested** `describe` blocks — outer hooks always wrap inner ones (outer `beforeEach` before inner `beforeEach`, inner `afterEach` before outer `afterEach`), regardless of the physical order hooks are declared in relative to nested blocks.

### `test.each()`/`describe.each()`: Data-Driven Test Generation
```javascript
test.each([
  [1, 1, 2],
  [2, 3, 5],
])('adds %i + %i to equal %i', (a, b, expected) => {
  expect(a + b).toBe(expected);
});
```
Rather than hand-writing near-duplicate test bodies for each input combination, `test.each` generates one distinct, individually-reportable test **per row** of the provided data table — each row shows up as its own named entry in test output, not a single test looping internally (which would only report one pass/fail for the whole loop).

### `test.skip`/`test.only`/`test.todo`
`.skip` excludes a test from the run entirely (registered, but never executed); `.only` runs **only** the marked test(s) in that file, excluding all siblings (useful for focused debugging, dangerous if accidentally committed); `.todo` marks a planned-but-unwritten test, appearing in output as a reminder without needing a body at all.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Validation Function Needing to Be Tested Against Dozens of Input/Output Combinations.
A price-formatting utility needed correctness verification across many distinct input shapes (negative numbers, zero, very large numbers, different currency codes) — hand-writing 20+ near-identical `test('formats X correctly', () => {...})` blocks would be repetitive and hard to scan for coverage gaps. `test.each` with a data table of `[input, currency, expected]` tuples generated one clearly-named, individually-reportable test per row from a single, compact test definition — adding a new edge case meant adding one row to the table, not writing a whole new test block.

---

## 3. Production-Grade Code Example

```javascript
// priceFormatter.test.js
import { formatPrice } from './priceFormatter';

describe('formatPrice', () => {
  let originalLocale;

  beforeAll(() => {
    originalLocale = Intl.DateTimeFormat().resolvedOptions().locale;
  });

  beforeEach(() => {
    jest.clearAllMocks(); // fresh mock state before EVERY test in this describe block
  });

  test.each([
    [0, 'USD', '$0.00'],
    [19.99, 'USD', '$19.99'],
    [-5, 'USD', '-$5.00'],
    [1000000, 'USD', '$1,000,000.00'],
    [19.99, 'EUR', '€19.99'],
  ])('formatPrice(%f, %s) returns %s', (amount, currency, expected) => {
    expect(formatPrice(amount, currency)).toBe(expected);
  });

  describe('when currency is invalid', () => {
    // NESTED describe — the outer beforeEach above STILL runs before each test in here too
    test('throws a descriptive error', () => {
      expect(() => formatPrice(10, 'INVALID')).toThrow('Unsupported currency: INVALID');
    });

    test.todo('handle lowercase currency codes gracefully'); // planned, not yet implemented
  });
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Committing `test.only` Accidentally, Silently Skipping an Entire Suite
```javascript
// ❌ DANGEROUS: if this is accidentally committed, EVERY other test in the file (and CI's
// overall pass/fail signal) silently ignores every OTHER test entirely — CI can report
// "all tests passing" while dozens of tests never actually ran at all
test.only('one specific test I was debugging', () => { /* ... */ });
test('a completely different, important test', () => { /* NEVER RUNS while .only exists above */ });

// ✅ CORRECT: many teams lint-ban test.only/describe.only in committed code (eslint-plugin-jest's
// no-focused-tests rule) specifically to catch this before it reaches CI
```

### ⚠️ Pitfall 2: Assuming `test.each`'s Row Values Are Deep-Cloned Per Test
```javascript
// ❌ RISKY: if a row contains a shared, mutable object reference, and one test mutates it,
// SUBSEQUENT tests using the same row data see the ALREADY-MUTATED object — test.each does
// NOT automatically clone row values between test invocations
const sharedConfig = { retries: 3 };
test.each([[sharedConfig], [sharedConfig]])('test with %o', (config) => {
  config.retries = 0; // mutates the SAME object every invocation shares
});

// ✅ CORRECT: use a factory function per row, or ensure row data is either primitive or
// genuinely intended to be shared/immutable across the generated tests
```

### ⚠️ Pitfall 3: Relying on Hook Execution Order Across SIBLING (Not Nested) `describe` Blocks
```javascript
// ❌ WRONG ASSUMPTION: two SIBLING describe blocks' hooks have NO guaranteed interaction —
// state set up in one describe's afterAll should never be assumed to affect a sibling
// describe's beforeAll, even though Jest runs them in file order by default
describe('Suite A', () => { afterAll(() => { globalThis.flag = true; }); test('...', () => {}); });
describe('Suite B', () => { beforeAll(() => { expect(globalThis.flag).toBe(true); }); test('...', () => {}); }); // fragile

// ✅ CORRECT: each describe block should set up and tear down its OWN state independently,
// never relying on execution order or leaked state from a sibling block
```
