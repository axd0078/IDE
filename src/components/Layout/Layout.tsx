import { Sidebar } from '../Sidebar/Sidebar';
import { EditorPanel } from '../EditorPanel/EditorPanel';
import { StatusBar } from '../StatusBar/StatusBar';
import styles from './Layout.module.css';

export function Layout() {
  return (
    <div className={styles.layout}>
      <div className={styles.sidebar}>
        <Sidebar />
      </div>
      <div className={styles.editorPanel}>
        <EditorPanel />
      </div>
      <div className={styles.statusBar}>
        <StatusBar />
      </div>
    </div>
  );
}
