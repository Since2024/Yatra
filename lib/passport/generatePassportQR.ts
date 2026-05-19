// lib/passport/generatePassportQR.ts
// Server-only. Signs the QR payload with Ed25519 (SOLANA_KEYPAIR).

import { Keypair } from '@solana/web3.js';
import nacl from 'tweetnacl';
import QRCode from 'qrcode';
import type { DriverPassportData } from './getPassportData';

function loadServerKeypair(): Keypair {
  const raw = process.env.SOLANA_KEYPAIR ?? process.env.SOLANA_SERVER_PRIVATE_KEY;
  if (!raw) {
    throw new Error('SOLANA_KEYPAIR env var is required for QR signing');
  }

  if (raw.startsWith('[')) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bs58 = require('bs58').default as { decode: (s: string) => Uint8Array };
  return Keypair.fromSecretKey(bs58.decode(raw));
}

export async function generatePassportQR(data: DriverPassportData): Promise<string> {
  const serverKeypair = loadServerKeypair();

  const payload = {
    v:      1,
    wallet: data.walletAddress,
    score:  data.trustScore,
    tier:   data.tier,
    pda:    data.pdaAddress,
    ts:     Math.floor(Date.now() / 1000),
  };

  const message   = new TextEncoder().encode(JSON.stringify(payload));
  const signature = nacl.sign.detached(message, serverKeypair.secretKey);

  const qrPayload = {
    ...payload,
    sig:    Buffer.from(signature).toString('base64'),
    verify: `https://yatra.io/verify/driver/${data.walletAddress}`,
  };

  return QRCode.toDataURL(JSON.stringify(qrPayload), {
    errorCorrectionLevel: 'M',
    width: 256,
    margin: 2,
  });
}
