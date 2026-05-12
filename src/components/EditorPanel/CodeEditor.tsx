import { useCallback, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { cpp } from '@codemirror/lang-cpp';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { keymap } from '@codemirror/view';
import { EditorView } from '@codemirror/view';
import { useEditorStore } from '../../store/useEditorStore';
import styles from './CodeEditor.module.css';

interface CodeEditorProps {
  fileId: string;
  content: string;
}

export function CodeEditor({ fileId, content }: CodeEditorProps) {
  const updateFileContent = useEditorStore(s => s.updateFileContent);
  const updateCursorPosition = useEditorStore(s => s.updateCursorPosition);
  const saveFile = useEditorStore(s => s.saveFile);
  const activeTabId = useEditorStore(s => s.activeTabId);
  const openTabs = useEditorStore(s => s.openTabs);

  const tab = openTabs.find(t => t.id === fileId);

  const handleChange = useCallback(
    (value: string) => {
      updateFileContent(fileId, value);
    },
    [fileId, updateFileContent]
  );

  const handleUpdate = useCallback(
    (viewUpdate: any) => {
      const pos = viewUpdate.state.selection.main.head;
      const line = viewUpdate.state.doc.lineAt(pos);
      updateCursorPosition({
        line: line.number,
        column: pos - line.from + 1,
      });
    },
    [updateCursorPosition]
  );

  // Listen for menu save event
  useEffect(() => {
    const unsub = window.electronAPI?.onMenuSave(() => {
      if (activeTabId) saveFile(activeTabId);
    });
    return () => { unsub?.(); };
  }, [activeTabId, saveFile]);

  // Ctrl+S keymap
  const saveKeymap = keymap.of([
    {
      key: 'Ctrl-s',
      run: () => {
        saveFile(fileId);
        return true;
      },
      preventDefault: true,
    },
  ]);

  return (
    <div className={styles.editor}>
      <CodeMirror
        key={fileId}
        value={content}
        height="100%"
        theme={vscodeDark}
        extensions={[cpp(), EditorView.lineWrapping, saveKeymap]}
        onChange={handleChange}
        onUpdate={handleUpdate}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: true,
          bracketMatching: true,
          closeBrackets: true,
          foldGutter: true,
          highlightSelectionMatches: true,
          indentOnInput: true,
          tabSize: 4,
        }}
      />
    </div>
  );
}
