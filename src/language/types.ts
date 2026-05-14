// Token 类型枚举（与 compiler/scanner.py 保持一致）
export enum TokenType {
  CHAR = 101, INT = 102, FLOAT = 103, BREAK = 104,
  CONST = 105, RETURN = 106, VOID = 107, CONTINUE = 108,
  DO = 109, WHILE = 110, IF = 111, ELSE = 112, FOR = 113,

  LPAREN = 201, RPAREN = 202, LBRACKET = 203, RBRACKET = 204,
  NOT = 205, MULTIPLY = 206, DIVIDE = 207, MOD = 208,
  PLUS = 209, MINUS = 210, LT = 211, LE = 212,
  GT = 213, GE = 214, EQ = 215, NE = 216,
  AND = 217, OR = 218, ASSIGN = 219, DOT = 220,

  LBRACE = 301, RBRACE = 302, SEMICOLON = 303, COMMA = 304,

  NUMBER = 400, CHAR_LITERAL = 500,
  STRING = 600, IDENTIFIER = 700, FLOAT_NUM = 800,

  COMMENT = 900, ERROR = 999, EOF = 0,
}

// 关键字集合（TokenType 数值 → 类别）
const KEYWORD_CODES = new Set([
  101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113,
]);

// Token 类型 → 高亮颜色
// VS Code Dark+ 配色
export function tokenColor(tokenType: number): string {
  if (KEYWORD_CODES.has(tokenType)) return '#569CD6';       // 关键字：蓝色
  if (tokenType === TokenType.COMMENT) return '#6A9955';     // 注释：灰绿色
  if (tokenType === TokenType.NUMBER || tokenType === TokenType.FLOAT_NUM) return '#B5CEA8'; // 数字：浅绿
  if (tokenType === TokenType.STRING || tokenType === TokenType.CHAR_LITERAL) return '#CE9178'; // 字符串/字符：橙色
  if (tokenType === TokenType.IDENTIFIER) return '#9CDCFE';  // 标识符：浅蓝
  return '';  // 其他：默认色
}

export function isKeyword(code: number): boolean {
  return KEYWORD_CODES.has(code);
}
