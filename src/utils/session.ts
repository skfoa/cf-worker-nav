/**
 * src/utils/session.ts
 * Web Crypto API 基于 HMAC-SHA256 的无状态 Session 签名/验签
 */

// 签发 Token
export async function signSession(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  
  // Convert ArrayBuffer to Base64 (URL safe variant is better, but standard base64 is fine if URI encoded)
  const signatureArray = Array.from(new Uint8Array(signatureBuffer))
  const signatureBase64 = btoa(String.fromCharCode(...signatureArray))
  
  return `${payload}.${signatureBase64}`
}

// 验证 Token
export async function verifySession(token: string, secret: string): Promise<string | null> {
  if (!token) return null
  
  const parts = token.split('.')
  if (parts.length !== 2) return null
  
  const [payload, signatureBase64] = parts
  
  // 重新签名并对比
  const expectedToken = await signSession(payload, secret)
  
  if (token === expectedToken) {
    return payload
  }
  return null
}
