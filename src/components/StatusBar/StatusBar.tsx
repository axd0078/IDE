import { useEditorStore } from '../../store/useEditorStore';
import { selectActiveTab } from '../../store/selectors';
import styles from './StatusBar.module.css';

export function StatusBar() {
  const cursorPosition = useEditorStore(s => s.cursorPosition);
  const activeTab = useEditorStore(selectActiveTab);

  return (
    <div className={styles.statusBar}>
      <span className={styles.item}>
        Ln {cursorPosition.line}, Col {cursorPosition.column}
      </span>
      <span className={styles.item}>UTF-8</span>
      <span className={styles.item}>C</span>
      <div className={styles.spacer} />
      {activeTab && (
        <span className={styles.item}>{activeTab.name}</span>
      )}
    </div>
  );
}
