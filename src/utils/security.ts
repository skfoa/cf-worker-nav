/**
 * src/utils/security.ts - 安全工具函数
 */

/**
 * 🔒 时序安全的字符串比对 (使用 Web Crypto API)
 * 防止通过响应时间差异推断密码内容
 */
export async function safeCompare(a: string, b: string): Promise<boolean> {
  if (!a || !b) return false
  const encoder = new TextEncoder()
  const aBuf = encoder.encode(a)
  const bBuf = encoder.encode(b)

  // 长度不等时仍需执行伪比较以防止长度泄漏
  if (aBuf.byteLength !== bBuf.byteLength) {
    await crypto.subtle.timingSafeEqual(aBuf, aBuf)
    return false
  }

  return crypto.subtle.timingSafeEqual(aBuf, bBuf)
}

/**
 * 🔒 SHA-256 哈希（带盐值防彩虹表攻击）
 */
export async function hashWithSalt(input: string, salt: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(input + salt)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
