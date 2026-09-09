import 'server-only';

import { cookies } from 'next/headers';
import { backendUrl, editorOrigin } from './env';
import { decryptSession, EDITOR_SESSION_COOKIE } from './session-crypto';
import { hasResourcePermission, RESOURCE_NAMES, type ResourceName, type ResourcePermissionMap } from './resources';

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

/**
 * The session's bearer is the admin's own, so the backend already enforces
 * `create-blogposts` etc. on every write — this is what stops the editor
 * from rendering an "Add Blog Post" button (or the record edit form) for a
 * role that cannot use it. `hasContentAccess` is still the session gate: an
 * admin needs contents view+edit to enter the editor at all; these
 * per-resource checks only widen what they can do once inside.
 */
export function permissionsFor(admin: AdminSelf): Set<string> {
	return new Set(Array.isArray(admin.role?.permissions) ? admin.role.permissions : []);
}

export function can(
	admin: AdminSelf,
	action: 'create' | 'edit' | 'delete' | 'view',
	resource: ResourceName,
): boolean {
	return hasResourcePermission(permissionsFor(admin), action, resource);
}

/** Computed once per page load and passed down to the client shell as plain data — `can()` itself needs `server-only` context it doesn't have. */
export function permissionMapFor(admin: AdminSelf): ResourcePermissionMap {
	return Object.fromEntries(RESOURCE_NAMES.map((resource) => [resource, {
		create: can(admin, 'create', resource),
		edit: can(admin, 'edit', resource),
		delete: can(admin, 'delete', resource),
	}])) as ResourcePermissionMap;
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
