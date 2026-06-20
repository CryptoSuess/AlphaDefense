/**
 * EIP-191 (`personal_sign`) signature verification for the leaderboard Worker.
 *
 * A submission that claims a wallet `address` must prove ownership by signing a
 * canonical score message. The Worker rebuilds that exact message from the
 * validated fields, recovers the signer from the signature, and accepts the
 * address only if it matches. Anonymous submissions (no address) skip all this.
 *
 * Pure-JS via @noble (secp256k1 recovery + keccak256); both run fine in the
 * Workers runtime. The message format MUST stay byte-identical to the client's
 * builder in src/utils/integrations.ts.
 */
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';

/**
 * Canonical message a player signs to claim a score under their wallet.
 * Keep in sync with buildScoreMessage in src/utils/integrations.ts.
 */
export function buildScoreMessage({ key, score, wave, address }) {
  return [
    'NIKO: Guardian of Base — verified score',
    `board: ${key}`,
    `score: ${score}`,
    `wave: ${wave}`,
    `wallet: ${String(address).toLowerCase()}`,
  ].join('\n');
}

function hexToBytes(hex) {
  const clean = typeof hex === 'string' && hex.startsWith('0x') ? hex.slice(2) : hex;
  if (typeof clean !== 'string' || clean.length % 2 !== 0) return null;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) return null;
    out[i] = byte;
  }
  return out;
}

function bytesToHex(bytes) {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

/** keccak256 of the EIP-191 `personal_sign` framing of a UTF-8 message. */
function ethSignedMessageHash(message) {
  const msgBytes = new TextEncoder().encode(message);
  const prefix = new TextEncoder().encode(`\x19Ethereum Signed Message:\n${msgBytes.length}`);
  const full = new Uint8Array(prefix.length + msgBytes.length);
  full.set(prefix, 0);
  full.set(msgBytes, prefix.length);
  return keccak_256(full);
}

/**
 * Recovers the signer address (0x-prefixed, lowercase) from a personal_sign
 * signature over `message`, or null if the signature is malformed.
 */
export function recoverAddress(message, signatureHex) {
  const sig = hexToBytes(signatureHex);
  if (!sig || sig.length !== 65) return null;
  let v = sig[64];
  if (v >= 27) v -= 27;
  if (v !== 0 && v !== 1) return null;
  try {
    const hash = ethSignedMessageHash(message);
    const signature = secp256k1.Signature.fromCompact(sig.slice(0, 64)).addRecoveryBit(v);
    const point = signature.recoverPublicKey(hash);
    const pub = point.toRawBytes(false).slice(1); // drop the 0x04 prefix → 64 bytes
    return '0x' + bytesToHex(keccak_256(pub).slice(-20));
  } catch {
    return null;
  }
}

/** True if `signatureHex` over `message` recovers to `expectedAddress`. */
export function verifySignature(message, signatureHex, expectedAddress) {
  const recovered = recoverAddress(message, signatureHex);
  return recovered !== null && recovered.toLowerCase() === String(expectedAddress).toLowerCase();
}
