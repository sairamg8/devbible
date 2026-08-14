---
title: "Component Architecture: Compound Components, Headless UI & Composition Over Configuration"
sidebar_label: "Component Architecture"
sidebar_position: 1
---

# 🏛️ Component Architecture: Compound Components, Headless UI & Composition Over Configuration

## 1. The Decision Framework

Component API design is a real architectural decision — the same underlying UI behavior can be exposed through several genuinely different patterns, each with different flexibility/simplicity tradeoffs for consumers.

```
Container/Presentational split (LARGELY OBSOLETE since hooks):
  <UserListContainer> (fetches data) → <UserList> (renders it)
  ── hooks (useUsers()) now separate data-fetching from rendering WITHOUT needing
     a dedicated component layer just to hold that separation

Compound Components (flexible, for LIBRARIES/design systems):
  <Select><Select.Option value="a">A</Select.Option></Select>
  ── parent manages shared state (which option is selected), children consume via
     context — consumers control STRUCTURE/composition freely

Headless Components (ZERO styling opinion):
  useSelect() returns { isOpen, selectedValue, getOptionProps } — NO rendered markup at all
  ── consumer owns 100% of the visual implementation; the hook owns ONLY behavior/state

Configuration-prop explosion (the pattern composition typically REPLACES):
  <Button variant="primary" size="lg" iconLeft={<Icon/>} iconRight={<Icon/>} loading loadingText="..." />
  ── every new visual variation adds ANOTHER prop, eventually unmanageable
```

### Atomic Design: A Mental Model, Rarely Literal Folders
"Atoms/molecules/organisms" is useful for **thinking** about a design system's composition hierarchy (a Button is an atom, a SearchBar combining an input+button is a molecule) — but in practice, very few real codebases maintain literal `atoms/`/`molecules/`/`organisms/` folders, since the categorization is often genuinely ambiguous (is a form field with a label and error message an atom or a molecule?) and adds organizational overhead without a corresponding clarity benefit.

### Composition Over Configuration: Slots Instead of Prop Explosion
Rather than a `<Card>` component accepting `headerText`, `headerIcon`, `footerActions`, `showDivider`, etc. (a growing prop list trying to anticipate every layout variation), accepting `children` (or named slot props like `header`/`footer`) lets consumers compose arbitrary content freely — the component owns structural/behavioral concerns (spacing, borders) while consumers own content, without the component author needing to anticipate every future content combination in advance.

---

## 2. Real-World Engineering Scenario

**Scenario**: A `<Select>` Component's Configuration Props Becoming Unmanageable, Fixed by Compound Components.
A design system's `<Select>` component started simple — a few props for options and a selected value. Over eighteen months, consumer requests added `renderOption`, `groupBy`, `disabledOptions`, `optionIcons`, `customOptionLabel` — each new customization need became another prop, and the component's internal logic branching on all these props became genuinely hard to reason about or extend further. Refactoring to a compound component API (`<Select><Select.Option>...</Select.Option><Select.Group label="...">...</Select.Group></Select>`) let consumers compose whatever structure/content they needed directly in JSX — the parent `<Select>` only needed to manage shared selection state via context, with zero props dedicated to anticipating every possible option-rendering variation.

---

## 3. Reference Implementation

```tsx
// Compound component — parent manages state via context, children consume it, structure is consumer-controlled
const SelectContext = createContext<{ value: string; onSelect: (v: string) => void } | null>(null);

function Select({ value, onChange, children }: SelectProps) {
  return (
    <SelectContext.Provider value={{ value, onSelect: onChange }}>
      <div role="listbox">{children}</div>
    </SelectContext.Provider>
  );
}

Select.Option = function Option({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = useContext(SelectContext)!;
  return (
    <div role="option" aria-selected={ctx.value === value} onClick={() => ctx.onSelect(value)}>
      {children}
    </div>
  );
};

// Consumer has FULL structural freedom — no props needed for grouping, icons, custom labels
<Select value={selected} onChange={setSelected}>
  <Select.Option value="a"><FlagIcon country="US" /> United States</Select.Option>
  <Select.Option value="b"><FlagIcon country="CA" /> Canada</Select.Option>
</Select>
```

```tsx
// Headless component — ZERO rendered markup, pure behavior/state, consumer owns ALL visuals
function useDisclosure(initialOpen = false) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((v) => !v),
  };
}

// Consumer renders EVERYTHING — the hook only tracks state/logic
function Accordion() {
  const { isOpen, toggle } = useDisclosure();
  return (
    <div>
      <button onClick={toggle}>{isOpen ? 'Collapse' : 'Expand'}</button>
      {isOpen && <div>Content, styled however THIS consumer wants</div>}
    </div>
  );
}
```

---

## 4. Senior Engineer Anti-Patterns & Lessons

### ⚠️ Anti-Pattern 1: Building a Container/Presentational Split "By Convention" Post-Hooks
Maintaining a dedicated `UserListContainer` component whose ONLY job is calling `useUsers()` and passing the result to `<UserList data={data} />` adds an indirection layer hooks already made unnecessary — the hook itself IS the separation of data-fetching from rendering. This pattern persists in some codebases purely out of habit from pre-hooks React, adding a file and a layer of props-drilling for no remaining architectural benefit.

### ⚠️ Anti-Pattern 2: Reaching for Compound Components for a Simple, Rarely-Varied Component
Compound components add real API complexity (context providers, careful parent-child coordination) — applying this pattern to a component with only 2-3 stable, rarely-changing variations (a simple `<Badge variant="success" | "warning" | "error">`) adds architectural overhead with no corresponding flexibility benefit, since the variation space was never actually large enough to need it. Reserve compound components for genuinely open-ended composition needs (a Select, a Tabs, a Menu), not every component with more than one prop.

### ⚠️ Anti-Pattern 3: Configuration-Prop Explosion Left Unaddressed Until It's Genuinely Unmanageable
The `<Select>` scenario above is common precisely because the warning signs (a steadily growing prop list, increasingly complex internal conditional logic) are gradual and easy to individually rationalize ("just one more prop won't hurt") — waiting until the component is genuinely unmanageable before addressing it means a much larger, riskier refactor later, across every consumer, than addressing the pattern shift (to compound/headless composition) earlier, while the prop list was still merely "getting large" rather than fully unmanageable.
