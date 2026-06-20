/**
 * Round-trip test for the EIP-191 verification used by the Worker.
 *
 * Generates a keypair, signs a canonical score message exactly the way a wallet
 * would (personal_sign framing), then asserts the Worker's recovery returns the
 * matching address and rejects tampering. Run with `npm test` in server/.
 */
import assert from 'node:assert/strict';
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';
import { buildScoreMessage, recoverAddress, verifySignature } from '../src/eip191.js';

function addressFromPrivateKey(priv) {
  const pub = secp256k1.getPublicKey(priv, false).slice(1);
  return '0x' + Buffer.from(keccak_256(pub).slice(-20)).toString('hex');
}

/** Mimics a wallet's personal_sign: returns a 65-byte r||s||v hex signature. */
function personalSign(message, priv) {
  const msgBytes = new TextEncoder().encode(message);
  const prefix = new TextEncoder().encode(`\x19Ethereum Signed Message:\n${msgBytes.length}`);
  const full = new Uint8Array([...prefix, ...msgBytes]);
  const sig = secp256k1.sign(keccak_256(full), priv);
  const r = sig.r.toString(16).padStart(64, '0');
  const s = sig.s.toString(16).padStart(64, '0');
  const v = (sig.recovery + 27).toString(16).padStart(2, '0');
  return '0x' + r + s + v;
}

const priv = secp256k1.utils.randomPrivateKey();
const address = addressFromPrivateKey(priv);
const message = buildScoreMessage({ key: 'doubleCross:alpha', score: 54321, wave: 25, address });
const signature = personalSign(message, priv);

assert.equal(recoverAddress(message, signature)?.toLowerCase(), address.toLowerCase(), 'recovers signer');
assert.ok(verifySignature(message, signature, address), 'verifies matching address');
assert.ok(verifySignature(message, signature, address.toUpperCase()), 'case-insensitive address');
assert.ok(!verifySignature(message + ' ', signature, address), 'rejects tampered message');
assert.ok(!verifySignature(message, signature, '0x' + '11'.repeat(20)), 'rejects wrong address');
assert.equal(recoverAddress(message, '0xdeadbeef'), null, 'rejects malformed signature');

console.log('eip191 verification: all assertions passed (address %s)', address);
