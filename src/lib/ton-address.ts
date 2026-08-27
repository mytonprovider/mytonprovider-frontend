const ADDRESS_BYTES = 36
const CHECKSUM_AT = 34
const TAG_BOUNCEABLE = 0x11
const TAG_NON_BOUNCEABLE = 0x51
const TAG_TESTNET = 0x80
const CRC_POLYNOMIAL = 0x1021

const crc16 = (data: Uint8Array): number => {
  let crc = 0

  for (const byte of data) {
    crc ^= byte << 8
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ CRC_POLYNOMIAL) & 0xffff : (crc << 1) & 0xffff
    }
  }

  return crc
}

const decode = (address: string): Uint8Array | null => {
  if (!/^[A-Za-z0-9_-]{48}$/.test(address)) return null

  try {
    const raw = atob(address.replace(/-/g, "+").replace(/_/g, "/"))
    if (raw.length !== ADDRESS_BYTES) return null
    return Uint8Array.from(raw, (char) => char.charCodeAt(0))
  } catch {
    return null
  }
}

const encode = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")

export const toNonBounceable = (address: string): string => {
  const bytes = decode(address)
  if (!bytes) return address

  const tag = bytes[0] & ~TAG_TESTNET
  if (tag !== TAG_BOUNCEABLE && tag !== TAG_NON_BOUNCEABLE) return address
  if (crc16(bytes.subarray(0, CHECKSUM_AT)) !== ((bytes[CHECKSUM_AT] << 8) | bytes[CHECKSUM_AT + 1])) return address

  bytes[0] = TAG_NON_BOUNCEABLE | (bytes[0] & TAG_TESTNET)
  const checksum = crc16(bytes.subarray(0, CHECKSUM_AT))
  bytes[CHECKSUM_AT] = checksum >> 8
  bytes[CHECKSUM_AT + 1] = checksum & 0xff

  return encode(bytes)
}
