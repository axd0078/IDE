"""scanner_bridge.py — JSON stdin/stdout 常驻词法+语法检查进程

协议（每行一个 JSON）：
  ← {"code": "int main() { return 0; }"}
  → {"tokens": [...], "errors": [{"line":1,"col":0,"from":0,"to":0,"message":"..."}]}
  ← {"code": "..."}
  → ...
  ← {"action": "exit"}
  → (进程退出)
"""

import json
import sys
from scanner import LexialAnalyzer, TokenType as ScannerTokenType
from parser import ErrorParser, Token as ParserToken, EOF_CODE

# 错误码 → 中文消息
ERROR_MESSAGES = {
    # 词法错误 (1xx)
    101: "非法字符",
    102: "无效的 Token",
    103: "注释未闭合（缺少 */）",
    104: "字符常量未闭合（缺少 '）",
    105: "字符串未闭合（缺少 \"）",
    # 语法错误 (2xx)
    201: "缺少标识符",
    202: "缺少分号 ;",
    203: "多余的 }",
    204: "缺少 {",
    205: "缺少 }",
    206: "多余的 )",
    207: "缺少 (",
    208: "缺少 )",
    210: "赋值左侧必须是变量",
    211: "缺少操作数",
    212: "do-while 缺少 while",
}


def line_to_offset(code: str, line_num: int) -> int:
    """计算第 line_num 行首字符在 code 中的偏移"""
    pos = 0
    current = 1
    while current < line_num and pos < len(code):
        if code[pos] == '\n':
            current += 1
        pos += 1
    return pos


def line_end_offset(code: str, line_num: int) -> int:
    """计算第 line_num 行尾字符在 code 中的偏移"""
    start = line_to_offset(code, line_num)
    end = code.find('\n', start)
    if end == -1:
        end = len(code)
    return end


def scan_and_check(code: str):
    """扫描 + 语法检查，返回 (tokens, errors)"""
    errors = []

    # === 词法分析 ===
    analyzer = LexialAnalyzer(code)
    result = analyzer.analyze()  # list of (TokenType, lexeme, line) or empty on error

    # 收集词法错误（scanner 内部错误）
    for err in analyzer.errors:
        parts = err.split(" ", 1)
        line_num = int(parts[0]) if parts else 1
        code_str = parts[1] if len(parts) > 1 else ""
        err_code = int(code_str) if code_str.isdigit() else 0
        msg = ERROR_MESSAGES.get(err_code, "词法错误")
        start = line_to_offset(code, line_num)
        end = line_end_offset(code, line_num)
        errors.append({
            "from": start,
            "to": end,
            "line": line_num,
            "message": msg,
        })

    if not result:
        # 词法错误导致扫描失败，跳过语法检查
        tokens_out = []
        return tokens_out, errors

    # === 构建 tokens 输出 ===
    tokens_out = []
    pos = 0
    for token_type, lexeme, line in result:
        idx = code.find(lexeme, pos)
        if idx == -1:
            idx = pos
        tokens_out.append({
            "type": token_type.value,
            "text": lexeme,
            "from": idx,
            "to": idx + len(lexeme),
            "line": line,
        })
        pos = idx + len(lexeme)

    # === 语法分析（ErrorParser） ===
    parser_tokens = []
    for token_type, lexeme, line in result:
        parser_tokens.append(ParserToken(lexeme, int(token_type.value), int(line)))

    parser = ErrorParser(parser_tokens)
    parse_errors = parser.parse()  # list of (line, error_code)

    for line_num, err_code in parse_errors:
        msg = ERROR_MESSAGES.get(err_code, f"语法错误 {err_code}")
        start = line_to_offset(code, line_num)
        end = line_end_offset(code, line_num)
        # 避免重复报同一行
        already = any(e["line"] == line_num for e in errors)
        if not already:
            errors.append({
                "from": start,
                "to": end,
                "line": line_num,
                "message": msg,
            })

    # 按行号排序
    errors.sort(key=lambda e: e["line"])
    return tokens_out, errors


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

        tokens, errors = scan_and_check(code)
        sys.stdout.write(json.dumps(
            {"tokens": tokens, "errors": errors},
            ensure_ascii=False,
        ) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
