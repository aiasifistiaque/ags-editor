import 'server-only';

import { cookies } from 'next/headers';
import { backendUrl, editorOrigin } from './env';
import { decryptSession, EDITOR_SESSION_COOKIE } from './session-crypto';

export type AdminSelf = {
	_id: string;
	name?: string;
	email?: string;
	isActive?: boolean;
	isDeleted?: boolean;
	role?: {
		isActive?: boolean;
		permissions?: string[];
	};
};

export function hasContentAccess(admin: AdminSelf): boolean {
	const permissions = Array.isArray(admin.role?.permissions) ? admin.role.permissions : [];
	return permissions.includes('*') || (
		permissions.includes('view-contents') && permissions.includes('edit-contents')
	);
}

export function isActiveAdmin(admin: AdminSelf): boolean {
	return admin.isActive !== false && admin.isDeleted !== true && admin.role?.isActive !== false;
}

export async function fetchAdminSelf(token: string): Promise<AdminSelf | null> {
	try {
		const response = await fetch(backendUrl('auth/self'), {
			headers: { authorization: token },
			cache: 'no-store',
		});
		if (!response.ok) return null;
		return await response.json() as AdminSelf;
	} catch {
		return null;
	}
}

export async function authorizeBearer(token: string): Promise<AdminSelf | null> {
	if (!token.startsWith('Bearer ') || token.length > 8192) return null;
	const admin = await fetchAdminSelf(token);
	if (!admin || !isActiveAdmin(admin) || !hasContentAccess(admin)) return null;
	return admin;
}

export async function getAuthorizedSession(): Promise<{ token: string; admin: AdminSelf } | null> {
	const cookieStore = await cookies();
	const encrypted = cookieStore.get(EDITOR_SESSION_COOKIE)?.value;
	if (!encrypted) return null;
	const session = decryptSession(encrypted);
	if (!session) return null;
	const admin = await authorizeBearer(session.token);
	if (!admin) return null;
	return { token: session.token, admin };
}

export function isTrustedEditorRequest(request: Request): boolean {
	return request.headers.get('origin') === editorOrigin();
}
