import { useEditorStore } from '../../store/useEditorStore';
import styles from './WelcomeScreen.module.css';

export function WelcomeScreen() {
  const openFolder = useEditorStore(s => s.openFolder);
  const folderPath = useEditorStore(s => s.folderPath);

  return (
    <div className={styles.welcome}>
      <div className={styles.logo}>💻</div>
      <div className={styles.title}>C IDE</div>
      <div className={styles.subtitle}>类C语言编程集成开发环境</div>

      {!folderPath ? (
        <>
          <button className={styles.openFolderBtn} onClick={openFolder}>
            打开文件夹
          </button>
          <div className={styles.shortcuts}>
            <div className={styles.shortcut}>
              <span className={styles.key}>Ctrl+K Ctrl+O</span>
              <span className={styles.desc}>打开文件夹</span>
            </div>
            <div className={styles.shortcut}>
              <span className={styles.key}>Ctrl+S</span>
              <span className={styles.desc}>保存文件</span>
            </div>
          </div>
        </>
      ) : (
        <div className={styles.shortcuts}>
          <div className={styles.shortcut}>
            <span className={styles.key}>Ctrl+S</span>
            <span className={styles.desc}>保存文件</span>
          </div>
          <div className={styles.shortcut}>
            <span className={styles.key}>Ctrl+Tab</span>
            <span className={styles.desc}>切换标签页</span>
          </div>
        </div>
      )}
    </div>
  );
}
