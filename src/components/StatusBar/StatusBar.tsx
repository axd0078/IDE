import { useEditorStore } from '../../store/useEditorStore';
import { selectActiveTab } from '../../store/selectors';
import styles from './StatusBar.module.css';

const ENCODINGS = ['UTF-8', 'GBK', 'UTF-16 LE', 'UTF-16 BE', 'ISO-8859-1'];

export function StatusBar() {
  const cursorPosition = useEditorStore(s => s.cursorPosition);
  const activeTab = useEditorStore(selectActiveTab);
  const activeTabId = useEditorStore(s => s.activeTabId);
  const fileEncodings = useEditorStore(s => s.fileEncodings);
  const reopenWithEncoding = useEditorStore(s => s.reopenWithEncoding);

  const currentEncoding = activeTabId
    ? (fileEncodings[activeTabId] || 'UTF-8')
    : 'UTF-8';

  const cycleEncoding = () => {
    if (!activeTabId) return;
    const idx = ENCODINGS.indexOf(currentEncoding);
    const next = ENCODINGS[(idx + 1) % ENCODINGS.length];
    reopenWithEncoding(activeTabId, next);
  };

  return (
    <div className={styles.statusBar}>
      <span className={styles.item}>
        Ln {cursorPosition.line}, Col {cursorPosition.column}
      </span>
      <span
        className={`${styles.item} ${styles.clickable}`}
        onClick={cycleEncoding}
        title="点击切换编码"
      >
        {currentEncoding}
      </span>
      <div className={styles.spacer} />
      {activeTab && (
        <span className={styles.item}>{activeTab.name}</span>
      )}
    </div>
  );
}
