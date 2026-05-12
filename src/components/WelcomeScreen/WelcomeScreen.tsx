import styles from './WelcomeScreen.module.css';

export function WelcomeScreen() {
  return (
    <div className={styles.welcome}>
      <div className={styles.logo}>💻</div>
      <div className={styles.title}>C IDE</div>
      <div className={styles.subtitle}>类C语言编程集成开发环境</div>
      <div className={styles.shortcuts}>
        <div className={styles.shortcut}>
          <span className={styles.key}>Ctrl+O</span>
          <span className={styles.desc}>打开文件</span>
        </div>
        <div className={styles.shortcut}>
          <span className={styles.key}>Ctrl+N</span>
          <span className={styles.desc}>新建文件</span>
        </div>
        <div className={styles.shortcut}>
          <span className={styles.key}>Ctrl+W</span>
          <span className={styles.desc}>关闭标签页</span>
        </div>
        <div className={styles.shortcut}>
          <span className={styles.key}>Ctrl+Tab</span>
          <span className={styles.desc}>切换标签页</span>
        </div>
      </div>
    </div>
  );
}
