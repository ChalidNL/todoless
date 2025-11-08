import speakeasy from 'speakeasy'
import QRCode from 'qrcode'

export function generateTOTPSecret(label: string) {
  const secret = speakeasy.generateSecret({ length: 20, name: label })
  return secret
}

export function verifyTOTP(secret: string, token: string) {
  return speakeasy.totp.verify({ secret, encoding: 'ascii', token, window: 1 })
}

export async function toDataURL(otpauth: string) {
  return QRCode.toDataURL(otpauth)
}
