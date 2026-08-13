# Graph Report - src  (2026-08-13)

## Corpus Check
- Corpus is ~4,165 words - fits in a single context window. You may not need a graph.

## Summary
- 34 nodes · 41 edges · 6 communities (4 shown, 2 thin omitted)
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Home Page & Layer Layout
- Sidebar Collapse State Store
- Progress Data & Status Utilities
- Progress Bar Component
- Doc Sidebar Items Component

## God Nodes (most connected - your core abstractions)
1. `SidebarCollapseAll()` - 5 edges
2. `DocSidebarItemsWrapper()` - 5 edges
3. `subscribe()` - 4 edges
4. `getSnapshot()` - 4 edges
5. `getServerSnapshot()` - 4 edges
6. `setMode()` - 3 edges
7. `phaseStatus()` - 2 edges
8. `summarise()` - 2 edges
9. `isRootLevel()` - 2 edges
10. `STATE_LABEL` - 1 edges

## Surprising Connections (you probably didn't know these)
- `DocSidebarItemsWrapper()` --indirect_call--> `subscribe()`  [INFERRED]
  theme/DocSidebarItems/index.js → components/SidebarCollapseAll/store.js
- `DocSidebarItemsWrapper()` --indirect_call--> `getSnapshot()`  [INFERRED]
  theme/DocSidebarItems/index.js → components/SidebarCollapseAll/store.js
- `DocSidebarItemsWrapper()` --indirect_call--> `getServerSnapshot()`  [INFERRED]
  theme/DocSidebarItems/index.js → components/SidebarCollapseAll/store.js
- `SidebarCollapseAll()` --indirect_call--> `getServerSnapshot()`  [INFERRED]
  components/SidebarCollapseAll/index.js → components/SidebarCollapseAll/store.js
- `SidebarCollapseAll()` --indirect_call--> `getSnapshot()`  [INFERRED]
  components/SidebarCollapseAll/index.js → components/SidebarCollapseAll/store.js

## Import Cycles
- None detected.

## Communities (6 total, 2 thin omitted)

### Community 0 - "Home Page & Layer Layout"
Cohesion: 0.17
Nodes (9): css, express, git, javascript, LAYERS, node, postgres, react (+1 more)

### Community 1 - "Sidebar Collapse State Store"
Cohesion: 0.38
Nodes (7): SidebarCollapseAll(), getServerSnapshot(), getSnapshot(), listeners, setMode(), state, subscribe()

### Community 2 - "Progress Data & Status Utilities"
Cohesion: 0.67
Nodes (3): LANGUAGES, phaseStatus(), summarise()

## Knowledge Gaps
- **13 isolated node(s):** `STATE_LABEL`, `state`, `listeners`, `LANGUAGES`, `css` (+8 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DocSidebarItemsWrapper()` connect `Doc Sidebar Items Component` to `Sidebar Collapse State Store`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `subscribe()` connect `Sidebar Collapse State Store` to `Doc Sidebar Items Component`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `getSnapshot()` connect `Sidebar Collapse State Store` to `Doc Sidebar Items Component`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `SidebarCollapseAll()` (e.g. with `getServerSnapshot()` and `getSnapshot()`) actually correct?**
  _`SidebarCollapseAll()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `DocSidebarItemsWrapper()` (e.g. with `getServerSnapshot()` and `getSnapshot()`) actually correct?**
  _`DocSidebarItemsWrapper()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `subscribe()` (e.g. with `SidebarCollapseAll()` and `DocSidebarItemsWrapper()`) actually correct?**
  _`subscribe()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `getSnapshot()` (e.g. with `SidebarCollapseAll()` and `DocSidebarItemsWrapper()`) actually correct?**
  _`getSnapshot()` has 2 INFERRED edges - model-reasoned connections that need verification._