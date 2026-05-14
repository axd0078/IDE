import { ViewPlugin, Decoration, DecorationSet, EditorView, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder, StateEffect, StateField } from '@codemirror/state';
import { tokenColor, TokenType } from './types';

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// 标记函数名：标识符后紧跟 '('
function markFunctionNames(tokens: TokenInfo[]): Set<number> {
  const funcs = new Set<number>();
  for (let i = 0; i < tokens.length - 1; i++) {
    if (
      tokens[i].type === TokenType.IDENTIFIER &&
      tokens[i + 1].type === TokenType.LPAREN
    ) {
      funcs.add(i);
    }
  }
  return funcs;
}

async function scanAndDecorate(view: EditorView) {
  const code = view.state.doc.toString();
  if (!code.trim()) {
    view.dispatch({ effects: highlightEffect.of(Decoration.none) });
    return;
  }

  const result = await window.electronAPI?.scanCode(code);
  if (!result?.tokens) return;

  const funcIndices = markFunctionNames(result.tokens);
  const builder = new RangeSetBuilder<Decoration>();

  for (let i = 0; i < result.tokens.length; i++) {
    const t = result.tokens[i];
    if (t.from >= t.to || t.to > code.length) continue;

    const isFunc = funcIndices.has(i);
    const color = isFunc ? '#DCDCAA' : tokenColor(t.type); // 函数名黄色
    if (!color) continue;

    builder.add(
      t.from,
      t.to,
      Decoration.mark({ attributes: { style: `color: ${color}` } }),
    );
  }

  view.dispatch({
    effects: highlightEffect.of(builder.finish()),
  });
}

const highlightEffect = StateEffect.define<DecorationSet>();

const highlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = Decoration.none;
      scanAndDecorate(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => scanAndDecorate(update.view), 300);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

const highlightField = StateField.define<DecorationSet>({
  create() { return Decoration.none; },
  update(deco, tr) {
    for (const e of tr.effects) {
      if (e.is(highlightEffect)) return e.value;
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export function cHighlight() {
  return [highlightField, highlightPlugin];
}
