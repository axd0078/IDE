import { useEffect } from 'react';
import { Layout } from './components/Layout/Layout';
import { useEditorStore } from './store/useEditorStore';

export default function App() {
  const openFolder = useEditorStore(s => s.openFolder);

  useEffect(() => {
    const unsub = window.electronAPI?.onMenuOpenFolder(() => {
      openFolder();
    });
    return () => { unsub?.(); };
  }, [openFolder]);

  return <Layout />;
}
