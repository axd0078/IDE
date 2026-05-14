"""
C IDE — Python 词法+语法扫描器桥接进程

这是一个常驻进程，通过 stdin/stdout 的 JSON 行协议与 Node.js 主进程通信。
每次扫描不需要冷启动 Python（~200ms），常驻后平均 < 5ms。

通信协议（每行一个完整的 JSON 对象）：

  输入 ← {"code": "int main() { return 0; }"}
  输出 → {"tokens": [{"type": 102, "text": "int", "from": 0, "to": 3, "line": 1}, ...],
          "errors": [{"from": 10, "to": 25, "line": 1, "message": "缺少分号 ;"}]}

  输入 ← {"action": "exit"}
  → 进程退出

工作流程：
1. 收到 JSON → 解出 code 字段
2. 调用 scanner.py 的 LexialAnalyzer 做词法分析
3. 把 Scanner Token 转换为 Parser 需要的格式
4. 调用 parser.py 的 ErrorParser（容错解析器）做语法分析
5. 收集所有错误（词法 + 语法），映射行号到字符偏移
6. 返回 JSON

为什么用 ErrorParser 而不是 Parser？
  - ErrorParser 是容错解析器：遇到错误后尝试同步恢复，能报告多个错误
  - Parser 是严格解析器：遇到第一个错误就抛异常，只适合最终编译
  - 对于 IDE 的实时错误提示，需要一次扫描看到所有问题
"""

import json
import sys
from scanner import LexialAnalyzer, TokenType as ScannerTokenType
from parser import ErrorParser, Token as ParserToken, EOF_CODE

# === 错误码 → 中文消息映射 ===
# 这些消息会显示在编辑器的红色波浪线悬停提示中

ERROR_MESSAGES = {
    # 词法错误（1xx）—— 扫描器在 tokenize 时发现的问题
    101: "非法字符",                 # 源代码中出现了不认识的字符
    102: "无效的 Token",
    103: "注释未闭合（缺少 */）",     # /* 开始了但没有 */
    104: "字符常量未闭合（缺少 '）",   # 'a 没有配对的 '
    105: "字符串未闭合（缺少 \"）",    # "hello 没有配对的 "

    # 语法错误（2xx）—— 解析器在构建 AST 时发现的问题
    201: "缺少标识符",                # 类型后面没跟变量名（如 int ;）
    202: "缺少分号 ;",               # 语句末尾没有 ;
    203: "多余的 }",                 # 多了一个右花括号
    204: "缺少 {",                  # 函数/if/while 后面没跟 {
    205: "缺少 }",                  # 代码块没有闭合
    206: "多余的 )",
    207: "缺少 (",
    208: "缺少 )",
    210: "赋值左侧必须是变量",        # 1 = 2 这样的错误
    211: "缺少操作数",               # 运算符后面没有值
    212: "do-while 缺少 while",
}


def line_to_offset(code: str, line_num: int) -> int:
    """
    把行号转换为该行第一个字符在整个文本中的偏移位置

    例如 "abc\ndef\nghi" 中第 2 行 → 偏移 4（'d' 的位置）
    前端需要字符偏移来定位红色下划线
    """
    pos = 0
    current = 1
    while current < line_num and pos < len(code):
        if code[pos] == '\n':
            current += 1
        pos += 1
    return pos


def line_end_offset(code: str, line_num: int) -> int:
    """
    把行号转换为该行最后一个字符在整个文本中的偏移位置
    错误下划线会覆盖整行
    """
    start = line_to_offset(code, line_num)
    end = code.find('\n', start)
    if end == -1:
        end = len(code)
    return end


def scan_and_check(code: str):
    """
    对一段代码做完整的词法分析 + 容错语法分析，返回 tokens 和 errors

    返回格式：
    - tokens: [{"type": int, "text": str, "from": int, "to": int, "line": int}, ...]
    - errors: [{"from": int, "to": int, "line": int, "message": str}, ...]
    """
    errors = []

    # ===== 第一步：词法分析 =====
    analyzer = LexialAnalyzer(code)
    result = analyzer.analyze()  # 返回 list of (TokenType, lexeme, line)

    # 收集扫描器本身的错误（词法错误）
    for err in analyzer.errors:
        # 扫描器错误格式："行号 错误码"
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
        # 词法错误太严重，扫描失败 → 跳过语法检查
        tokens_out = []
        return tokens_out, errors

    # ===== 构建 Token 输出（供前端高亮着色） =====
    tokens_out = []
    pos = 0
    for token_type, lexeme, line in result:
        # 在源代码中查找 token 文本的位置
        idx = code.find(lexeme, pos)
        if idx == -1:
            idx = pos  # 找不到时用当前位置（容错）
        tokens_out.append({
            "type": token_type.value,   # TokenType 枚举的数值
            "text": lexeme,             # 原始文本（如 "int", "main", "("）
            "from": idx,                # 起始字符偏移
            "to": idx + len(lexeme),    # 结束字符偏移
            "line": line,               # 行号
        })
        pos = idx + len(lexeme)

    # ===== 第二步：容错语法分析 =====
    # 将 Scanner Token 转换为 Parser 期望的 Token 对象
    parser_tokens = []
    for token_type, lexeme, line in result:
        parser_tokens.append(ParserToken(lexeme, int(token_type.value), int(line)))

    # ErrorParser 不抛异常，收集所有语法错误后返回
    parser = ErrorParser(parser_tokens)
    parse_errors = parser.parse()  # 返回 list of (line, error_code)

    for line_num, err_code in parse_errors:
        msg = ERROR_MESSAGES.get(err_code, f"语法错误 {err_code}")
        start = line_to_offset(code, line_num)
        end = line_end_offset(code, line_num)
        # 避免同一行重复报错（词法错误和语法错误可能在同一行）
        already = any(e["line"] == line_num for e in errors)
        if not already:
            errors.append({
                "from": start,
                "to": end,
                "line": line_num,
                "message": msg,
            })

    # 按行号排序（前端依赖有序的错误列表）
    errors.sort(key=lambda e: e["line"])
    return tokens_out, errors


def main():
    """
    主循环：逐行读取 stdin → 解析 JSON → 扫描 → 返回 JSON

    这是一个无限循环，直到收到 {"action": "exit"} 才退出。
    每行是一个独立的扫描请求，互不干扰。
    """
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue  # 忽略无法解析的行

        if msg.get("action") == "exit":
            break  # 收到退出信号

        code = msg.get("code", "")
        if not code:
            # 空代码 → 返回空结果
            sys.stdout.write(json.dumps({"tokens": [], "errors": []}) + "\n")
            sys.stdout.flush()
            continue

        tokens, errors = scan_and_check(code)
        sys.stdout.write(json.dumps(
            {"tokens": tokens, "errors": errors},
            ensure_ascii=False,  # 中文错误消息不转义
        ) + "\n")
        sys.stdout.flush()  # 立即刷新，Node.js 端才能实时收到


if __name__ == "__main__":
    main()
