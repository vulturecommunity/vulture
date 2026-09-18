import * as Crypto from 'expo-crypto';

/** Gera um identificador único (UUID v4). */
export function novoId(): string {
  return Crypto.randomUUID();
}

export function agoraIso(): string {
  return new Date().toISOString();
}
