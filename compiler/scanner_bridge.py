"""scanner_bridge.py — JSON stdin/stdout 常驻词法扫描进程

协议（每行一个 JSON）：
  ← {"code": "int main() { return 0; }"}
  → {"tokens": [{"type": 102, "text": "int", "from": 0, "to": 3}, ...], "errors": []}
  ← {"code": "..."}
  → ...
  ← {"action": "exit"}
  → (进程退出)
"""

import json
import sys
from scanner import LexialAnalyzer

def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue

        if msg.get("action") == "exit":
            break

        code = msg.get("code", "")
        if not code:
            sys.stdout.write(json.dumps({"tokens": [], "errors": []}) + "\n")
            sys.stdout.flush()
            continue

        analyzer = LexialAnalyzer(code)
        result = analyzer.analyze()  # list of (TokenType, lexeme, line) or empty on error

        tokens = []
        pos = 0
        for token_type, lexeme, line in result:
            # 在 code 中查找 lexeme 的位置
            # 注意：analyzer 已跳过空白/注释，所以需要从当前位置搜索
            idx = code.find(lexeme, pos)
            if idx == -1:
                idx = pos
            tokens.append({
                "type": token_type.value,
                "text": lexeme,
                "from": idx,
                "to": idx + len(lexeme),
                "line": line,
            })
            pos = idx + len(lexeme)

        # 收集错误信息
        errors = []
        if analyzer.errors:
            for err in analyzer.errors:
                parts = err.split(" ", 1)
                line_num = int(parts[0]) if parts else 1
                code_str = parts[1] if len(parts) > 1 else ""
                errors.append({"line": line_num, "code": code_str})

        sys.stdout.write(json.dumps({"tokens": tokens, "errors": errors}, ensure_ascii=False) + "\n")
        sys.stdout.flush()

if __name__ == "__main__":
    main()
