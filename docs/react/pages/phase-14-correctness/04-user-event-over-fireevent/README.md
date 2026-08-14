---
title: "user-event over fireEvent"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **`@testing-library/user-event` 14.x**, from documentation —
> [user-event · Intro](https://testing-library.com/docs/user-event/intro),
> [setup](https://testing-library.com/docs/user-event/setup),
> [Options](https://testing-library.com/docs/user-event/options) and
> [Keyboard API](https://testing-library.com/docs/user-event/keyboard).
> No sandbox script backs this topic; claims are cited, not measured.

**`fireEvent` dispatches a DOM event. `user-event` performs an interaction.** The
documentation draws the line exactly there: `fireEvent` dispatches DOM events, while
`user-event` simulates *"interactions, which may fire multiple events and do additional
checks along the way"*.

That difference decides whether your test can tell the difference between a working
component and a broken one. A single synthetic `click` event lands on a button that is
disabled, invisible, or covered by a modal — because dispatching an event does not consult
any of that. A real click does.

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[What a real interaction is](01-what-an-interaction-is.md)** | The event sequences a browser actually fires, the checks `user-event` performs, `setup()` and why every call is awaited, and the bugs `fireEvent` cannot catch |
| 02 | **[The API, and when `fireEvent` is still right](02-the-api-in-practice.md)** | `click`, `type`, `keyboard`, `selectOptions`, `upload`, `tab`, `hover`, clipboard; fake timers via `advanceTimers`; the `pointerEventsCheck` cost; and the narrow cases where `fireEvent` is the correct tool |

## Why this is two files

The first chunk is the argument and the setup — why the library exists, what it checks, and
the one-line ceremony that makes it work. The second is the reference you come back to
while writing tests, including the two situations that genuinely trip people up: fake
timers, and the handful of events no user directly produces.

## Where this connects

- **[Topic 03 · The query families](../03-the-query-families/README.md)** — find the
  element, then interact with it. `user-event` takes the element a query returned.
- **[Topic 05 · Async testing and `act()`](../05-async-testing-and-act/README.md)** — every
  `user-event` call is awaited, and that is half of why `act()` warnings disappear.
- **[Topic 08 · Testing forms and Actions](../08-testing-forms-and-actions.md)** — filling
  and submitting a form is where these APIs earn their keep.
- **[Topic 14 · Flaky tests, fake timers and CI](../14-flaky-tests-and-ci.md)** — the
  `advanceTimers` option, in the context that makes it necessary.

---

← Prev: [The query families](../03-the-query-families/README.md) ·
Index: [Phase 14](../README.md) ·
Next → [What a real interaction is](01-what-an-interaction-is.md)
