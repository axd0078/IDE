import { useCallback, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { keymap, EditorView } from '@codemirror/view';
import { useEditorStore } from '../../store/useEditorStore';
import { cHighlight } from '../../language/cHighlight';
import styles from './CodeEditor.module.css';

// 纯文本暗色主题（由 Python 扫描器提供高亮，这里只配基础编辑器外观）
const plainDark = EditorView.theme({
  '&': {
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  '.cm-gutters': {
    backgroundColor: '#1e1e1e',
    color: '#858585',
    border: 'none',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#2a2d2e',
  },
  '.cm-activeLine': {
    backgroundColor: '#2a2d2e',
  },
  '.cm-cursor': {
    borderLeftColor: '#d4d4d4',
  },
  '.cm-selectionBackground': {
    backgroundColor: '#264f78',
  },
  '.cm-selectionMatch': {
    backgroundColor: '#264f78',
  },
  '.cm-matchingBracket': {
    backgroundColor: '#3a3a3a',
    outline: '1px solid #888',
  },
  '.cm-scroller': {
    flex: '1 1 0',
    overflow: 'auto',
    fontFamily: 'var(--font-mono)',
    fontSize: '14px',
  },
}, { dark: true });

interface CodeEditorProps {
  fileId: string;
  content: string;
}

export function CodeEditor({ fileId, content }: CodeEditorProps) {
  const updateFileContent = useEditorStore(s => s.updateFileContent);
  const updateCursorPosition = useEditorStore(s => s.updateCursorPosition);
  const saveFile = useEditorStore(s => s.saveFile);
  const activeTabId = useEditorStore(s => s.activeTabId);
  const langMode = useEditorStore(s => s.fileLanguageModes[fileId] || 'text');

  const handleChange = useCallback(
    (value: string) => { updateFileContent(fileId, value); },
    [fileId, updateFileContent]
  );

  const handleUpdate = useCallback(
    (viewUpdate: any) => {
      const pos = viewUpdate.state.selection.main.head;
      const line = viewUpdate.state.doc.lineAt(pos);
      updateCursorPosition({ line: line.number, column: pos - line.from + 1 });
    },
    [updateCursorPosition]
  );

  useEffect(() => {
    const unsub = window.electronAPI?.onMenuSave(() => {
      if (activeTabId) saveFile(activeTabId);
    });
    return () => { unsub?.(); };
  }, [activeTabId, saveFile]);

  const saveKeymap = keymap.of([{
    key: 'Ctrl-s',
    run: () => { saveFile(fileId); return true; },
    preventDefault: true,
  }]);

  const isC = langMode === 'c';
  const extensions = [
    plainDark,
    EditorView.lineWrapping,
    saveKeymap,
    ...(isC ? [cHighlight()] : []),
  ];

  return (
    <div className={styles.editor}>
      <CodeMirror
        key={`${fileId}-${langMode}`}
        value={content}
        height="100%"
        extensions={extensions}
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
