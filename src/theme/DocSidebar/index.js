import React from 'react';
import DocSidebar from '@theme-original/DocSidebar';
import SidebarCollapseAll from '@site/src/components/SidebarCollapseAll';
import styles from './styles.module.css';

/**
 * Wraps the theme sidebar to put the collapse/expand-all control above it.
 *
 * It goes here rather than inside DocSidebarItems because the items render inside a
 * <ul class="menu__list">, where a <div> of buttons would be invalid markup.
 */
export default function DocSidebarWrapper(props) {
  return (
    <div className={styles.wrapper}>
      <SidebarCollapseAll />
      <DocSidebar {...props} />
    </div>
  );
}
