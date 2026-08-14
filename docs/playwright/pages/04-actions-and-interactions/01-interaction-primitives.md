---
title: "Actions & Interactions: Core Methods & Low-Level Keyboard/Mouse APIs"
sidebar_label: "Actions & Interactions"
sidebar_position: 1
---

# 🎭 Actions & Interactions: Core Methods & Low-Level Keyboard/Mouse APIs

## 1. Under-The-Hood Mechanics

Playwright's interaction methods operate at two distinct levels — high-level, semantically-named actions (`click`, `fill`) that handle common cases correctly and automatically, and low-level primitives (`page.keyboard`, `page.mouse`) for interactions those higher-level methods can't express.

```
High-level (preferred default):
  locator.click()      ──► auto-waits for actionability, THEN dispatches a real click sequence
  locator.fill(text)      ──► clears the field and sets its value directly — FAST, but bypasses
                                 individual keystroke events (see the pitfall below)
  locator.type(text)         ──► DEPRECATED in favor of pressSequentially() — dispatches individual
                                    keydown/keyup events per character, for components needing REAL keystrokes

Low-level (for custom gestures fill/click/hover can't express):
  page.mouse.move(x, y) / .down() / .up()   ──► raw mouse control, for custom drag paths/gestures
  page.keyboard.press('Shift+Tab')             ──► raw keyboard control, for key COMBINATIONS
```

### `fill()` vs `pressSequentially()`: A Genuine Behavioral Difference
`fill()` sets an input's value directly (fast, and correct for the vast majority of form-filling needs) — but it does **not** fire individual keystroke events, meaning any component logic keyed specifically to keydown/keyup (a character counter updating live, a masked input reformatting per keystroke, an autocomplete triggering on each character) won't be correctly exercised by `fill()` alone. `pressSequentially()` dispatches real, individual key events per character, at the cost of being noticeably slower — the right tool specifically when that keystroke-level behavior needs verification.

### `dragTo()` and `setInputFiles()`: Purpose-Built for Otherwise-Awkward Interactions
`dragTo()` handles a full drag-and-drop sequence (mousedown, move, mouseup) between a source and target locator in one call. `setInputFiles()` sets a file `<input>`'s value directly (bypassing the OS-level native file picker dialog, which automation tools cannot interact with at all) — the standard, only-practical way to test file upload flows.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Test Passing With `fill()` While a Real Character-Counter Bug Went Undetected.
A message composer had a live character counter, implemented via a keyup handler updating a "characters remaining" display on every keystroke. A test using `locator.fill('a long message')` to populate the textarea passed — because `fill()` sets the value directly without firing keyup events, the character counter update logic never actually ran during the test, so a genuine bug (the counter not updating correctly) went completely undetected. Switching that specific test to `locator.pressSequentially('a long message')` correctly fired the real keyup sequence the counter depended on, immediately surfacing the bug the faster `fill()`-based test had been structurally blind to.

---

## 3. Production-Grade Code Example

```typescript
// fill() — the fast, correct default for the vast majority of form interactions
test('submits a contact form', async ({ page }) => {
  await page.goto('/contact');
  await page.getByLabel('Name').fill('Alex Rivera'); // fast, sets value directly — fine here, no keystroke logic depends on it
  await page.getByLabel('Email').fill('alex@acme.com');
  await page.getByRole('button', { name: 'Send' }).click();
});
```

```typescript
// pressSequentially() — when real per-keystroke behavior must be exercised
test('character counter updates as the user types', async ({ page }) => {
  await page.goto('/compose');
  const textarea = page.getByLabel('Message');

  await textarea.pressSequentially('Hello there', { delay: 20 }); // REAL keydown/keyup per character

  await expect(page.getByText('11 characters')).toBeVisible(); // only correctly exercised via real keystrokes
});
```

```typescript
// Low-level mouse API for a custom gesture fill()/click() can't express — a canvas-based drawing interaction
test('draws a line on the canvas', async ({ page }) => {
  await page.goto('/whiteboard');
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();

  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 100, { steps: 10 }); // multiple intermediate steps — a smooth drag path
  await page.mouse.up();

  await expect(canvas).toHaveScreenshot('drawn-line.png'); // visual verification, see the visual testing doc
});
```

```typescript
// setInputFiles() — testing a file upload flow, bypassing the native OS file picker
test('uploads a profile picture', async ({ page }) => {
  await page.goto('/profile');
  await page.getByLabel('Profile picture').setInputFiles('./fixtures/avatar.png');
  await expect(page.getByAltText('Profile preview')).toBeVisible();
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Using `fill()` for Content That Needs Real Keystroke-Driven Behavior
```typescript
// ❌ MISSES REAL BEHAVIOR: a masked/formatted input (a phone number formatter reacting to
// each digit typed) won't correctly reformat, since fill() sets the raw value directly
await page.getByLabel('Phone').fill('5551234567'); // formatting logic never actually triggered

// ✅ CORRECT: use pressSequentially() when keystroke-level reactivity is what's being tested
await page.getByLabel('Phone').pressSequentially('5551234567');
```

### ⚠️ Pitfall 2: Hand-Rolling a Drag Gesture With Raw Mouse Events Instead of `dragTo()`
```typescript
// ❌ UNNECESSARILY COMPLEX: manually sequencing mouse.move/down/up for a SIMPLE drag-and-drop
// reimplements what dragTo() already does correctly, in fewer lines and with fewer edge cases to get wrong
await page.mouse.move(sourceX, sourceY);
await page.mouse.down();
await page.mouse.move(targetX, targetY);
await page.mouse.up();

// ✅ SIMPLER: for straightforward source-to-target drags, dragTo() handles the full sequence
await page.locator('.draggable-item').dragTo(page.locator('.drop-zone'));
// (reserve raw mouse.move/down/up for genuinely CUSTOM gesture paths, like the canvas drawing example above)
```

### ⚠️ Pitfall 3: Attempting to Interact With a Native OS File Picker Dialog Directly
```typescript
// ❌ IMPOSSIBLE: automation tools (Playwright included) CANNOT interact with native OS-level
// dialogs (the file picker window itself is outside the browser's own DOM/automation surface)
await page.getByRole('button', { name: 'Upload' }).click();
// ... attempting to interact with the native file picker that opens — NOT POSSIBLE

// ✅ CORRECT: setInputFiles() sets the file input's value directly, bypassing the native
// dialog entirely — the only practical way to test file upload flows in browser automation
await page.getByLabel('Upload').setInputFiles('./fixtures/document.pdf');
```
