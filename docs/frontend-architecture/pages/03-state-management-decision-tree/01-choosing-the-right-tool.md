---
title: "State Management Decision Tree: Local, Lifted, Global & Server State"
sidebar_label: "State Management Decision Tree"
sidebar_position: 1
---

# 🏛️ State Management Decision Tree: Local, Lifted, Global & Server State

## 1. The Decision Framework

The single highest-leverage state management decision isn't "which library" — it's correctly identifying **which category** a given piece of state actually belongs to. Each category has a natural home, and reaching for the wrong one is the root cause of most state-management pain in real codebases.

```
                          Is this data FETCHED FROM A SERVER?
                                    │
                    ┌───────YES────┴────NO────────┐
                    ▼                              ▼
          SERVER STATE                    Is it needed by MULTIPLE,
     (TanStack Query / RTK Query)             UNRELATED parts of the tree?
     Treat as a CACHE with staleness,               │
     never duplicate into a global store   ┌───NO───┴───YES──┐
                                            ▼                  ▼
                                   LOCAL STATE          Is it HIGH-FREQUENCY
                                (useState/useReducer)      (changes on every keystroke/
                                  Default choice —          frame) or LOW-FREQUENCY
                                  scoped to ONE component        (theme, auth user)?
                                  and its direct children            │
                                                          ┌────HIGH──┴──LOW────┐
                                                          ▼                    ▼
                                                 GLOBAL CLIENT STATE      LIFTED STATE
                                              (Zustand/Redux Toolkit)     (React Context)
                                              cross-cutting UI state,     low-frequency,
                                              complex mutations, or        broad subtree
                                              DevTools/time-travel value      sharing
```

### The Core Rule: Colocate, Lift Only When Genuinely Shared
Default every piece of state to the narrowest possible scope (`useState` in the component that needs it) — only lift it upward (to a parent, to Context, to a global store) when a **second, genuinely independent** consumer actually needs it. Lifting state preemptively "in case it's needed elsewhere later" is a common source of unnecessary complexity and re-render scope.

### Why Context Is Wrong for High-Frequency Data
Every Context consumer re-renders whenever the Context's value changes — for low-frequency data (a theme toggle, an authenticated user object that rarely changes), this is a non-issue. For high-frequency data (a form's live keystroke value, a real-time cursor position), Context re-renders every subscriber on every single update, often far more broadly than the actual data-owning component's own render — this specific mismatch is why Context is the wrong tool for that category, not a general "Context is bad" conclusion.

### Server State Is a Cache, Not Owned State
The most common state-management architecture mistake: fetching server data and copying it into a global client store (Redux/Zustand) as if the app owns it. Server data has staleness, can change server-side independent of the client, and needs cache invalidation semantics — treating it as plain owned state means hand-rolling (usually incompletely) exactly what TanStack Query/RTK Query already solve correctly (see the dedicated [TanStack Query bible](../../../tanstack-query/pages/01-core-concepts/01-the-server-state-model.md)).

---

## 2. Real-World Engineering Scenario

**Scenario**: A Team's Redux Store Duplicating Server Data, Causing Persistent Staleness Bugs.
A team's Redux store held a `users` slice populated by dispatching an action after a `fetch()` call completed — every time a user's profile was updated elsewhere in the app, the Redux copy had to be manually kept in sync via additional dispatched actions, and it was easy to miss a spot, leaving stale user data displayed in one part of the UI while another part correctly showed the update. Migrating server-fetched data to TanStack Query (treating it explicitly as a cache, with `invalidateQueries` correctly refreshing every consumer automatically) eliminated the entire class of manual-sync bugs — the "keep the copy fresh" problem simply stopped existing, because there was no longer a separate owned copy to keep in sync with the source of truth.

---

## 3. Reference Implementation

```tsx
// Local state — the default, correct choice for component-scoped UI state
function SearchInput() {
  const [query, setQuery] = useState(''); // used ONLY by this component — no reason to lift it
  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
}
```

```tsx
// Lifted state via Context — LOW-FREQUENCY, broadly-shared data (theme)
const ThemeContext = createContext<'light' | 'dark'>('light');
// Appropriate here: theme changes RARELY, and every consumer NEEDS to know its value

// ❌ WRONG use of the SAME pattern for HIGH-FREQUENCY data:
const CursorPositionContext = createContext<{ x: number; y: number }>({ x: 0, y: 0 });
// updates dozens of times per second — every consumer re-renders on every mouse move
```

```tsx
// Global client state — cross-cutting, complex UI state genuinely needed app-wide
const useUIStore = create<{ sidebarOpen: boolean; toggleSidebar: () => void }>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
// Appropriate: sidebar state affects layout across many unrelated route/component trees
```

```tsx
// Server state — NEVER duplicated into a global store, treated as a cache
function useUserProfile(userId: string) {
  return useQuery({ queryKey: ['user', userId], queryFn: () => fetchUser(userId) });
  // NOT: dispatch(setUser(data)) into a Redux slice — TanStack Query's cache IS the source of truth
}
```

---

## 4. Senior Engineer Anti-Patterns & Lessons

### ⚠️ Anti-Pattern 1: Lifting State to Global/Context "Just in Case It's Needed Elsewhere Later"
Preemptively lifting state to a global store or Context based on a hypothetical future need — rather than an actual, current second consumer — adds unnecessary complexity (broader re-render scope, more indirection to trace) for a need that may never materialize, and if it does, is usually a small, mechanical refactor to lift at THAT point rather than upfront.

### ⚠️ Anti-Pattern 2: Duplicating Server State Into a Global Store "For Consistency With Other State"
As the scenario above illustrates, this is the single most common category error — treating a `useQuery` result as insufficient and additionally dispatching it into Redux "to keep all state in one place" reintroduces exactly the staleness/sync bugs TanStack Query's cache model exists to prevent. If a team's mental model treats "all state must live in the global store," that mental model itself needs correcting for server data specifically.

### ⚠️ Anti-Pattern 3: Using Context for Frequently-Updating Values Without `useMemo`/Splitting
Even for borderline-frequency data, passing an un-memoized object literal as a Context value (`<Context.Provider value={{ a, b }}>`) causes every consumer to re-render on every Provider re-render, regardless of whether the specific values they read actually changed — a real, common performance bug distinct from the "Context is wrong for high-frequency data" issue, fixable by memoizing the value or splitting a large Context into several narrower ones.
