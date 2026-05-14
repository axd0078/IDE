/**
 * C IDE — 语法高亮与错误检测（CodeMirror 6 扩展）
 *
 * 这是"前端编辑器 ↔ Python 扫描器"的桥梁。
 *
 * 架构：
 * 1. 用户停止输入 300ms 后 → 调用 scanCode IPC → Python 扫描器返回 tokens 和 errors
 * 2. tokens → 按类型着色（关键字蓝、数字绿、字符串橙...）
 * 3. errors → @codemirror/lint 显示红色波浪线 + 悬停提示
 *
 * 为什么用 Python 扫描器而不是 CodeMirror 内置的 Lezer 语法？
 * 因为这是"自己的编译器"——后续还要做语义分析、代码补全等，
 * 全部基于同一个 Python 扫描器，保持一致性。
 *
 * 使用方式：在 CodeMirror extensions 中加入 cHighlight()
 */

import { ViewPlugin, Decoration, DecorationSet, EditorView, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder, StateEffect, StateField } from '@codemirror/state';
import { linter, Diagnostic } from '@codemirror/lint';
import { tokenColor, TokenType } from './types';

// === 防抖 & 缓存 ===

let scanTimer: ReturnType<typeof setTimeout> | null = null;
let cachedTokens: TokenInfo[] = [];
let cachedErrors: ScannerError[] = [];

interface ScanResult { tokens: TokenInfo[]; errors: ScannerError[] }

async function doScan(code: string): Promise<ScanResult> {
  const result = await window.electronAPI?.scanCode(code);
  if (!result) return { tokens: [], errors: [] };
  return { tokens: result.tokens, errors: result.errors };
}

/**
 * 检测函数名：标识符后面紧跟 '(' 就是函数调用
 *
 * 例如 "printf(" 中，printf 会被标为函数名（黄色）
 * 而 "int x" 中的 x 是普通标识符（浅蓝色）
 */
function markFunctionNames(tokens: TokenInfo[]): Set<number> {
  const funcs = new Set<number>();
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i].type === TokenType.IDENTIFIER && tokens[i + 1].type === TokenType.LPAREN) {
      funcs.add(i);
    }
  }
  return funcs;
}

// === StateField：存储高亮 decorations ===
// StateField 是 CodeMirror 的状态管理单元，类似于 React 的 useState
// 通过 StateEffect 来更新，更新后自动触发重绘

const highlightEffect = StateEffect.define<DecorationSet>();

const highlightField = StateField.define<DecorationSet>({
  create() { return Decoration.none; },
  update(deco, tr) {
    for (const e of tr.effects) if (e.is(highlightEffect)) return e.value;
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),  // 让编辑器使用这个字段的 decorations
});

/**
 * 根据 Token 列表构建 CodeMirror decorations
 * 每个 token 创建一个 Decoration.mark，设置对应的 CSS color
 */
function buildHighlights(code: string, tokens: TokenInfo[]): DecorationSet {
  const funcIndices = markFunctionNames(tokens);
  const builder = new RangeSetBuilder<Decoration>();
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.from >= t.to || t.to > code.length) continue;
    const isFunc = funcIndices.has(i);
    const color = isFunc ? '#DCDCAA' : tokenColor(t.type);  // 函数名黄色，其他按类型
    if (!color) continue;
    builder.add(t.from, t.to, Decoration.mark({ attributes: { style: `color: ${color}` } }));
  }
  return builder.finish();
}

/**
 * 把 Python 返回的错误列表转为 CodeMirror Diagnostic 格式
 * Diagnostic 会被 @codemirror/lint 自动渲染为红色波浪下划线
 */
function buildDiagnostics(code: string, errors: ScannerError[]): Diagnostic[] {
  return errors.map(e => ({
    from: Math.max(0, Math.min(e.from, code.length)),
    to: Math.max(0, Math.min(e.to, code.length)),
    message: `[行 ${e.line}] ${e.message}`,  // 悬停时显示
    severity: 'error' as const,
  }));
}

// === ViewPlugin：监听编辑器变更，触发扫描 ===
// ViewPlugin 是 CodeMirror 的"生命周期钩子"，类似 React 的 useEffect

const highlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = Decoration.none;
      this.triggerScan(view);  // 编辑器挂载时立即扫描
    }
    update(update: ViewUpdate) {
      // 文档内容改变时，300ms 防抖后重新扫描
      if (update.docChanged) this.triggerScan(update.view);
    }
    triggerScan(view: EditorView) {
      if (scanTimer) clearTimeout(scanTimer);
      scanTimer = setTimeout(async () => {
        const code = view.state.doc.toString();
        if (!code.trim()) {
          cachedTokens = [];
          cachedErrors = [];
          view.dispatch({ effects: highlightEffect.of(Decoration.none) });
          return;
        }
        const result = await doScan(code);
        cachedTokens = result.tokens;
        cachedErrors = result.errors;
        view.dispatch({ effects: highlightEffect.of(buildHighlights(code, result.tokens)) });
      }, 300);
    }
  },
  { decorations: (v) => v.decorations },
);

// === Lint 扩展：错误下划线 ===
// @codemirror/lint 的 linter() 会在文档变更时自动调用回调
// 这里复用缓存的扫描结果，避免重复调用 Python

const cLinter = linter(async (view) => {
  const code = view.state.doc.toString();
  if (!code.trim()) {
    cachedErrors = [];
    return [];
  }
  // 首次打开时缓存为空 → 主动扫描一次
  if (cachedTokens.length === 0 && cachedErrors.length === 0) {
    const result = await doScan(code);
    cachedTokens = result.tokens;
    cachedErrors = result.errors;
    view.dispatch({ effects: highlightEffect.of(buildHighlights(code, result.tokens)) });
  }
  return buildDiagnostics(code, cachedErrors);
}, { delay: 500 });  // lint 自身的防抖（比高亮稍长，减少闪烁）

/**
 * 导出：CodeMirror 扩展数组
 * 在 CodeMirror 的 extensions 属性中使用：
 *   extensions={[cHighlight(), ...]}
 */
export function cHighlight() {
  return [highlightField, highlightPlugin, cLinter];
}
