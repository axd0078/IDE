/**
 * C IDE — 语言支持：Token 类型定义与配色映射
 *
 * TokenType 枚举值与 compiler/scanner.py 中的枚举保持一致。
 * 这样 Python 返回的 token.type 数字可以直接用这个枚举解读。
 */

/** Token 类型枚举（数值与 scanner.py 中的 TokenType 一致） */
export enum TokenType {
  // 关键字（100-199）
  CHAR = 101, INT = 102, FLOAT = 103, BREAK = 104,
  CONST = 105, RETURN = 106, VOID = 107, CONTINUE = 108,
  DO = 109, WHILE = 110, IF = 111, ELSE = 112, FOR = 113,

  // 运算符（200-299）
  LPAREN = 201, RPAREN = 202, LBRACKET = 203, RBRACKET = 204,
  NOT = 205, MULTIPLY = 206, DIVIDE = 207, MOD = 208,
  PLUS = 209, MINUS = 210, LT = 211, LE = 212,
  GT = 213, GE = 214, EQ = 215, NE = 216,
  AND = 217, OR = 218, ASSIGN = 219, DOT = 220,

  // 分隔符（300-399）
  LBRACE = 301, RBRACE = 302, SEMICOLON = 303, COMMA = 304,

  // 字面量（400-899）
  NUMBER = 400,        // 整数
  CHAR_LITERAL = 500,  // 字符常量
  STRING = 600,        // 字符串
  IDENTIFIER = 700,    // 标识符（变量名、函数名）
  FLOAT_NUM = 800,     // 浮点数

  // 其他
  COMMENT = 900,
  ERROR = 999,
  EOF = 0,
}

/** 关键字 Token 类型集合：用于快速判断一个 token 是否是关键字 */
const KEYWORD_CODES = new Set([
  101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113,
]);

/**
 * 根据 Token 类型返回对应的颜色
 *
 * 配色参考 VS Code Dark+ 主题：
 * - 关键字：蓝 #569CD6
 * - 注释：灰绿 #6A9955（VS Code 注释的经典色）
 * - 数字：浅绿 #B5CEA8
 * - 字符串/字符：橙色 #CE9178
 * - 标识符：浅蓝 #9CDCFE
 * - 运算符/分隔符：不设颜色（用编辑器默认前景色）
 *
 * 函数名不在此处理——由 cHighlight.ts 的 markFunctionNames() 单独检测
 * 并赋予黄色 #DCDCAA
 */
export function tokenColor(tokenType: number): string {
  if (KEYWORD_CODES.has(tokenType)) return '#569CD6';
  if (tokenType === TokenType.COMMENT) return '#6A9955';
  if (tokenType === TokenType.NUMBER || tokenType === TokenType.FLOAT_NUM) return '#B5CEA8';
  if (tokenType === TokenType.STRING || tokenType === TokenType.CHAR_LITERAL) return '#CE9178';
  if (tokenType === TokenType.IDENTIFIER) return '#9CDCFE';
  return '';  // 空字符串 = 不设颜色，使用默认前景色
}

/** 判断一个 token 类型代码是否是关键字 */
export function isKeyword(code: number): boolean {
  return KEYWORD_CODES.has(code);
}
