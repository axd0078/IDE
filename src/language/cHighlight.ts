import { ViewPlugin, Decoration, DecorationSet, EditorView, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder, StateEffect, StateField } from '@codemirror/state';
import { linter, Diagnostic } from '@codemirror/lint';
import { tokenColor, TokenType } from './types';

// ===== 共享状态：缓存最近一次扫描结果 =====
let cachedTokens: TokenInfo[] = [];
let cachedErrors: ScannerError[] = [];
let scanTimer: ReturnType<typeof setTimeout> | null = null;

interface ScanResult { tokens: TokenInfo[]; errors: ScannerError[] }

async function doScan(code: string): Promise<ScanResult> {
  const result = await window.electronAPI?.scanCode(code);
  if (!result) return { tokens: [], errors: [] };
  return { tokens: result.tokens, errors: result.errors };
}

// ===== 函数名检测 =====
function markFunctionNames(tokens: TokenInfo[]): Set<number> {
  const funcs = new Set<number>();
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i].type === TokenType.IDENTIFIER && tokens[i + 1].type === TokenType.LPAREN) {
      funcs.add(i);
    }
  }
  return funcs;
}

// ===== StateField：高亮 decorations =====
const highlightEffect = StateEffect.define<DecorationSet>();

const highlightField = StateField.define<DecorationSet>({
  create() { return Decoration.none; },
  update(deco, tr) {
    for (const e of tr.effects) if (e.is(highlightEffect)) return e.value;
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

function buildHighlights(code: string, tokens: TokenInfo[]): DecorationSet {
  const funcIndices = markFunctionNames(tokens);
  const builder = new RangeSetBuilder<Decoration>();
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.from >= t.to || t.to > code.length) continue;
    const isFunc = funcIndices.has(i);
    const color = isFunc ? '#DCDCAA' : tokenColor(t.type);
    if (!color) continue;
    builder.add(t.from, t.to, Decoration.mark({ attributes: { style: `color: ${color}` } }));
  }
  return builder.finish();
}

function buildDiagnostics(code: string, errors: ScannerError[]): Diagnostic[] {
  return errors.map(e => ({
    from: Math.max(0, Math.min(e.from, code.length)),
    to: Math.max(0, Math.min(e.to, code.length)),
    message: `[行 ${e.line}] ${e.message}`,
    severity: 'error' as const,
  }));
}

// ===== ViewPlugin：监听变更，触发异步扫描 =====
const highlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = Decoration.none;
      this.triggerScan(view);
    }
    update(update: ViewUpdate) {
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

// ===== Lint 扩展：从缓存读取错误 =====
const cLinter = linter(async (view) => {
  // 如果缓存为空且文档不为空，触发一次扫描
  const code = view.state.doc.toString();
  if (!code.trim()) {
    cachedErrors = [];
    return [];
  }
  if (cachedTokens.length === 0 && cachedErrors.length === 0) {
    const result = await doScan(code);
    cachedTokens = result.tokens;
    cachedErrors = result.errors;
    view.dispatch({ effects: highlightEffect.of(buildHighlights(code, result.tokens)) });
  }
  return buildDiagnostics(code, cachedErrors);
}, { delay: 500 });

export function cHighlight() {
  return [highlightField, highlightPlugin, cLinter];
}
