/**
 * C IDE — 代码编辑器组件
 *
 * 封装了 CodeMirror 6 编辑器，是整个 IDE 的核心 UI 组件。
 *
 * 主要功能：
 * - 代码编辑（行号、活动行高亮、括号匹配、代码折叠）
 * - C 语法高亮（可选，通过 cHighlight 扩展，底层调用 Python 扫描器）
 * - Ctrl+S 保存文件到磁盘
 * - 光标位置上报（状态栏显示）
 *
 * 滚动方案：
 * 编辑器区域使用绝对定位（position: absolute），不依赖高度百分比链。
 * CodeMirror 内部通过 EditorView.theme 强制 flex 列布局，
 * .cm-scroller 设为 flex:1 + overflow:auto 确保滚动条正常。
 */

import { useCallback, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { keymap, EditorView } from '@codemirror/view';
import { useEditorStore } from '../../store/useEditorStore';
import { cHighlight } from '../../language/cHighlight';
import styles from './CodeEditor.module.css';

/**
 * 编辑器暗色主题
 * EditorView.theme 把样式直接注入 CodeMirror 的 style 标签，
 * 优先级高于外部 CSS，确保颜色正确。
 */
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
    flex: '1 1 0',       // 撑满剩余空间
    overflow: 'auto',    // 内容超出时出现滚动条
    fontFamily: 'var(--font-mono)',
    fontSize: '14px',
  },
}, { dark: true });  // dark: true 告诉 CodeMirror 这是暗色主题

interface CodeEditorProps {
  fileId: string;   // 文件绝对路径
  content: string;  // 文件文本内容
}

export function CodeEditor({ fileId, content }: CodeEditorProps) {
  const updateFileContent = useEditorStore(s => s.updateFileContent);
  const updateCursorPosition = useEditorStore(s => s.updateCursorPosition);
  const saveFile = useEditorStore(s => s.saveFile);
  const activeTabId = useEditorStore(s => s.activeTabId);
  // 读取当前文件的语言模式（c 或 text），默认纯文本
  const langMode = useEditorStore(s => s.fileLanguageModes[fileId] || 'text');

  // 每次按键 → 更新 store 中的文件内容
  const handleChange = useCallback(
    (value: string) => { updateFileContent(fileId, value); },
    [fileId, updateFileContent]
  );

  // 光标移动 → 更新状态栏的行列显示
  const handleUpdate = useCallback(
    (viewUpdate: any) => {
      const pos = viewUpdate.state.selection.main.head;
      const line = viewUpdate.state.doc.lineAt(pos);
      updateCursorPosition({ line: line.number, column: pos - line.from + 1 });
    },
    [updateCursorPosition]
  );

  // 监听菜单"保存"事件（Ctrl+S 或菜单点击）
  useEffect(() => {
    const unsub = window.electronAPI?.onMenuSave(() => {
      if (activeTabId) saveFile(activeTabId);
    });
    return () => { unsub?.(); };
  }, [activeTabId, saveFile]);

  // Ctrl+S 快捷键（在编辑器内按下时触发）
  const saveKeymap = keymap.of([{
    key: 'Ctrl-s',
    run: () => { saveFile(fileId); return true; },
    preventDefault: true,
  }]);

  // 根据语言模式决定是否加载 C 语法高亮扩展
  const isC = langMode === 'c';
  const extensions = [
    plainDark,              // 暗色主题
    EditorView.lineWrapping,// 长行自动换行
    saveKeymap,             // Ctrl+S
    ...(isC ? [cHighlight()] : []),  // C 模式启用 Python 扫描器
  ];

  return (
    <div className={styles.editor}>
      <CodeMirror
        // key 包含语言模式：切换 C/文本 时强制重建编辑器
        key={`${fileId}-${langMode}`}
        value={content}
        height="100%"
        extensions={extensions}
        onChange={handleChange}
        onUpdate={handleUpdate}
        basicSetup={{
          lineNumbers: true,            // 行号
          highlightActiveLine: true,    // 高亮当前行
          bracketMatching: true,       // 括号匹配
          closeBrackets: true,         // 自动闭合括号
          foldGutter: true,            // 代码折叠
          highlightSelectionMatches: true,  // 高亮选中文本的匹配项
          indentOnInput: true,         // 自动缩进
          tabSize: 4,
        }}
      />
    </div>
  );
}
