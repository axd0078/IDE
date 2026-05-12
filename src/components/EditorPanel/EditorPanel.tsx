import { useEditorStore } from '../../store/useEditorStore';
import { TabBar } from './TabBar';
import { CodeEditor } from './CodeEditor';
import { WelcomeScreen } from '../WelcomeScreen/WelcomeScreen';
import styles from './EditorPanel.module.css';

export function EditorPanel() {
  const activeTabId = useEditorStore(s => s.activeTabId);
  const fileContents = useEditorStore(s => s.fileContents);

  return (
    <div className={styles.panel}>
      <TabBar />
      <div className={styles.editorArea}>
        {activeTabId ? (
          <CodeEditor
            key={activeTabId}
            fileId={activeTabId}
            content={fileContents[activeTabId] ?? ''}
          />
        ) : (
          <WelcomeScreen />
        )}
      </div>
    </div>
  );
}
