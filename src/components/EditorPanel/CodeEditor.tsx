import { useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { cpp } from '@codemirror/lang-cpp';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
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

  return (
    <div className={styles.editor}>
      <CodeMirror
        key={fileId}
        value={content}
        height="100%"
        theme={vscodeDark}
        extensions={[cpp(), EditorView.lineWrapping]}
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
