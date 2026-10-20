export function parsePEM(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN[A-Z ]+-----/, "")
    .replace(/-----END[A-Z ]+-----/, "")
    .replace(/\s+/g, "");
  const binaryString = atob(body);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function parseDER(buffer: Uint8Array): { n: bigint; d: bigint } {
  let offset = 0;

  function readLength(): number {
    let len = buffer[offset++];
    if (len & 0x80) {
      const numBytes = len & 0x7f;
      len = 0;
      for (let i = 0; i < numBytes; i++) {
        len = (len << 8) | buffer[offset++];
      }
    }
    return len;
  }

  if (buffer[offset++] !== 0x30) throw new Error("Invalid PEM: not a sequence");
  readLength();

  let tag = buffer[offset++];
  let len = readLength();
  if (tag === 0x02 && len === 1 && buffer[offset] === 0) {
    offset += len;
    tag = buffer[offset++];
    len = readLength();
  }

  if (tag === 0x30) {
    offset += len; // skip algorithm identifier
    if (buffer[offset++] !== 0x04) throw new Error("Invalid PKCS#8: expected octet string");
    const octetLen = readLength();
    return parsePKCS1(buffer.subarray(offset, offset + octetLen));
  } else {
    const n = readInteger(tag, len);
    const tagE = buffer[offset++];
    const lenE = readLength();
    readInteger(tagE, lenE); // skip e
    const tagD = buffer[offset++];
    const lenD = readLength();
    const d = readInteger(tagD, lenD);
    return { n, d };
  }

  function readInteger(tag: number, len: number): bigint {
    if (tag !== 0x02) throw new Error("Expected INTEGER tag");
    let hex = "";
    for (let i = 0; i < len; i++) {
      hex += buffer[offset++].toString(16).padStart(2, "0");
    }
    return BigInt("0x" + hex);
  }

  function parsePKCS1(innerBuffer: Uint8Array): { n: bigint; d: bigint } {
    let innerOffset = 0;
    function readInnerLength(): number {
      let len = innerBuffer[innerOffset++];
      if (len & 0x80) {
        const numBytes = len & 0x7f;
        len = 0;
        for (let i = 0; i < numBytes; i++) {
          len = (len << 8) | innerBuffer[innerOffset++];
        }
      }
      return len;
    }
    if (innerBuffer[innerOffset++] !== 0x30) throw new Error("Invalid PKCS#1 structure");
    readInnerLength();
    if (innerBuffer[innerOffset++] !== 0x02) throw new Error("Expected version tag");
    const vLen = readInnerLength();
    innerOffset += vLen;
    if (innerBuffer[innerOffset++] !== 0x02) throw new Error("Expected modulus tag");
    const nLen = readInnerLength();
    let nHex = "";
    for (let i = 0; i < nLen; i++) {
      nHex += innerBuffer[innerOffset++].toString(16).padStart(2, "0");
    }
    if (innerBuffer[innerOffset++] !== 0x02) throw new Error("Expected public exponent tag");
    const eLen = readInnerLength();
    innerOffset += eLen;
    if (innerBuffer[innerOffset++] !== 0x02) throw new Error("Expected private exponent tag");
    const dLen = readInnerLength();
    let dHex = "";
    for (let i = 0; i < dLen; i++) {
      dHex += innerBuffer[innerOffset++].toString(16).padStart(2, "0");
    }
    return {
      n: BigInt("0x" + nHex),
      d: BigInt("0x" + dHex),
    };
  }
}

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let res = 1n;
  base = base % mod;
  while (exp > 0n) {
    if (exp & 1n) res = (res * base) % mod;
    base = (base * base) % mod;
    exp >>= 1n;
  }
  return res;
}

export function encryptWithPrivateKey(pem: string, message: string): string {
  const der = parsePEM(pem);
  const { n, d } = parseDER(der);

  const k = Math.ceil(n.toString(16).length / 2);
  const dBytes = new TextEncoder().encode(message);
  if (dBytes.length > k - 11) throw new Error("Message too long");

  const padded = new Uint8Array(k);
  padded[0] = 0x00;
  padded[1] = 0x01;
  const psLen = k - dBytes.length - 3;
  for (let i = 0; i < psLen; i++) {
    padded[2 + i] = 0xff;
  }
  padded[2 + psLen] = 0x00;
  padded.set(dBytes, 3 + psLen);

  let m = 0n;
  for (const byte of padded) {
    m = (m << 8n) | BigInt(byte);
  }

  const c = modPow(m, d, n);

  let cHex = c.toString(16);
  if (cHex.length % 2 !== 0) cHex = "0" + cHex;
  cHex = cHex.padStart(k * 2, "0");

  const encryptedBytes = new Uint8Array(k);
  for (let i = 0; i < k; i++) {
    encryptedBytes[i] = parseInt(cHex.slice(i * 2, i * 2 + 2), 16);
  }

  const binaryString = String.fromCharCode(...Array.from(encryptedBytes));
  return btoa(binaryString);
}
