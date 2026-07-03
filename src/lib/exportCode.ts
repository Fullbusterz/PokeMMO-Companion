// Self-contained base64 codec (no btoa/Buffer dependency, works identically in
// Hermes/RN and Node) so tournament state can be shared as a plain-text code
// without any backend — see CLAUDE.md Fase 1 sync decision.
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function binaryToBase64(binary: string): string {
  let output = '';
  for (let i = 0; i < binary.length; i += 3) {
    const b1 = binary.charCodeAt(i);
    const b2 = binary.charCodeAt(i + 1);
    const b3 = binary.charCodeAt(i + 2);
    const hasB2 = i + 1 < binary.length;
    const hasB3 = i + 2 < binary.length;
    const triplet = (b1 << 16) | ((hasB2 ? b2 : 0) << 8) | (hasB3 ? b3 : 0);
    output += B64_CHARS[(triplet >> 18) & 0x3f];
    output += B64_CHARS[(triplet >> 12) & 0x3f];
    output += hasB2 ? B64_CHARS[(triplet >> 6) & 0x3f] : '=';
    output += hasB3 ? B64_CHARS[triplet & 0x3f] : '=';
  }
  return output;
}

function base64ToBinary(base64: string): string {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const value = B64_CHARS.indexOf(char);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return output;
}

export function encodeToCode(data: unknown): string {
  const json = JSON.stringify(data);
  const binary = encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
  return binaryToBase64(binary);
}

export function decodeFromCode<T>(code: string): T {
  const binary = base64ToBinary(code.trim());
  let percentEncoded = '';
  for (let i = 0; i < binary.length; i++) {
    percentEncoded += '%' + binary.charCodeAt(i).toString(16).padStart(2, '0');
  }
  const json = decodeURIComponent(percentEncoded);
  return JSON.parse(json) as T;
}
