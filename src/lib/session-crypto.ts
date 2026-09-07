import 'server-only';

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { sessionSecret } from './env';

export const EDITOR_SESSION_COOKIE = 'ags_editor_session';
export const EDITOR_SESSION_SECONDS = 30 * 60;

type StoredSession = {
	token: string;
	expiresAt: number;
};

function encryptionKey(): Buffer {
	return createHash('sha256').update(sessionSecret()).digest();
}

export function encryptSession(token: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
	const payload: StoredSession = {
		token,
		expiresAt: Date.now() + EDITOR_SESSION_SECONDS * 1000,
	};
	const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();

	return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
}

export function decryptSession(value: string): StoredSession | null {
	try {
		const [ivValue, tagValue, encryptedValue] = value.split('.');
		if (!ivValue || !tagValue || !encryptedValue) return null;

		const decipher = createDecipheriv(
			'aes-256-gcm',
			encryptionKey(),
			Buffer.from(ivValue, 'base64url')
		);
		decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
		const decrypted = Buffer.concat([
			decipher.update(Buffer.from(encryptedValue, 'base64url')),
			decipher.final(),
		]);
		const session = JSON.parse(decrypted.toString('utf8')) as StoredSession;

		if (!session.token || session.expiresAt <= Date.now()) return null;
		return session;
	} catch {
		return null;
	}
}
