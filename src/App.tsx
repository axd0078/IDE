import { useEffect } from 'react';
import { Layout } from './components/Layout/Layout';
import { useEditorStore } from './store/useEditorStore';

export default function App() {
  const openFolder = useEditorStore(s => s.openFolder);
  const restoreLastWorkspace = useEditorStore(s => s.restoreLastWorkspace);
  const saveAllDirtyFiles = useEditorStore(s => s.saveAllDirtyFiles);
  const confirmQuit = () => window.electronAPI?.confirmQuit();

  // 启动时恢复上次工作区
  useEffect(() => {
    restoreLastWorkspace();
  }, [restoreLastWorkspace]);

  // 监听菜单"打开文件夹"
  useEffect(() => {
    const unsub = window.electronAPI?.onMenuOpenFolder(() => {
      openFolder();
    });
    return () => { unsub?.(); };
  }, [openFolder]);

  // 监听"保存全部并退出"
  useEffect(() => {
    const unsub = window.electronAPI?.onSaveAllAndClose(async () => {
      await saveAllDirtyFiles();
      confirmQuit();
    });
    return () => { unsub?.(); };
  }, [saveAllDirtyFiles]);

  // 同步脏状态到主进程
  useEffect(() => {
    const unsub = useEditorStore.subscribe((state) => {
      const dirty = state.openTabs.some(tab => tab.isDirty);
      window.electronAPI?.setDirtyState(dirty);
    });
    return () => unsub();
  }, []);

  return <Layout />;
}
