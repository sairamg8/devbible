/**
 * A tiny module-level store shared by two theme wrappers:
 *
 *   src/theme/DocSidebar/index.js       renders the control
 *   src/theme/DocSidebarItems/index.js  applies the result to the item tree
 *
 * They sit in different parts of the tree (the control must live outside the
 * <ul class="menu__list">, the items inside it), so a context provider would mean
 * swizzling a third component just to wrap both. This is smaller.
 *
 * `mode` is null until the reader touches the control — until then the sidebar uses
 * whatever each `_category_.json` declares, which is `collapsed: true` everywhere.
 * `epoch` increments on every change and is used as a React `key` to remount the item
 * tree, because a category's collapsed state is seeded from props on mount.
 */

/** @type {{mode: 'collapsed' | 'expanded' | null, epoch: number}} */
let state = {mode: null, epoch: 0};

const listeners = new Set();

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// useSyncExternalStore compares snapshots by reference, so this must return the same
// object until something actually changes — never a fresh literal.
export function getSnapshot() {
  return state;
}

// The server render has no interaction yet, so it is always the untouched state.
export function getServerSnapshot() {
  return state;
}

export function setMode(mode) {
  state = {mode, epoch: state.epoch + 1};
  listeners.forEach((listener) => listener());
}

/**
 * Rewrite `collapsed` through the whole item tree.
 *
 * Only categories that are actually collapsible are touched; a category pinned open
 * with `"collapsible": false` stays open, which is the point of that setting.
 */
export function applyCollapsed(items, collapsed) {
  return items.map((item) => {
    if (item.type !== 'category') {
      return item;
    }
    return {
      ...item,
      collapsed: item.collapsible === false ? item.collapsed : collapsed,
      items: applyCollapsed(item.items ?? [], collapsed),
    };
  });
}
