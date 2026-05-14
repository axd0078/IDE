import { useEffect } from 'react';
import { Layout } from './components/Layout/Layout';
import { useEditorStore } from './store/useEditorStore';

export default function App() {
  const openFolder = useEditorStore(s => s.openFolder);
  const restoreLastWorkspace = useEditorStore(s => s.restoreLastWorkspace);
  const saveFile = useEditorStore(s => s.saveFile);
  const saveAllDirtyFiles = useEditorStore(s => s.saveAllDirtyFiles);
  const activeTabId = useEditorStore(s => s.activeTabId);
  const confirmQuit = () => window.electronAPI?.confirmQuit();

  useEffect(() => {
    restoreLastWorkspace();
  }, [restoreLastWorkspace]);

  useEffect(() => {
    const unsub = window.electronAPI?.onMenuOpenFolder(() => {
      openFolder();
    });
    return () => { unsub?.(); };
  }, [openFolder]);

  useEffect(() => {
    const unsub = window.electronAPI?.onSaveAllAndClose(async () => {
      await saveAllDirtyFiles();
      confirmQuit();
    });
    return () => { unsub?.(); };
  }, [saveAllDirtyFiles]);

  // 编译生成 .s
  useEffect(() => {
    const unsub = window.electronAPI?.onMenuCompile(async () => {
      const fileId = useEditorStore.getState().activeTabId;
      if (!fileId) return;
      await saveFile(fileId);
      const result = await window.electronAPI?.compileFile(fileId);
      alert(result?.success ? result.message : (result?.message || '编译失败'));
    });
    return () => { unsub?.(); };
  }, [saveFile]);

  // 链接并运行
  useEffect(() => {
    const unsub = window.electronAPI?.onMenuLinkRun(async () => {
      const fileId = useEditorStore.getState().activeTabId;
      if (!fileId) return;
      await saveFile(fileId);
      const result = await window.electronAPI?.linkAndRun(fileId);
      alert(result?.success ? result.message : (result?.message || '运行失败'));
    });
    return () => { unsub?.(); };
  }, [saveFile]);

  useEffect(() => {
    const unsub = useEditorStore.subscribe((state) => {
      const dirty = state.openTabs.some(tab => tab.isDirty);
      window.electronAPI?.setDirtyState(dirty);
    });
    return () => unsub();
  }, []);

  return <Layout />;
}
