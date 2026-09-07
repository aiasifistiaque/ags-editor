import 'server-only';

function required(name: string): string {
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`Missing required environment variable: ${name}`);
	return value;
}

function strongSecret(name: string): string {
	const value = required(name);
	if (value.length < 32) throw new Error(`${name} must be at least 32 characters.`);
	return value;
}

export function backendUrl(path = ''): string {
	return `${required('AGS_BACKEND_URL').replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

export function adminOrigin(): string {
	return required('AGS_ADMIN_ORIGIN').replace(/\/+$/, '');
}

export function editorOrigin(): string {
	return required('AGS_EDITOR_ORIGIN').replace(/\/+$/, '');
}

export function sessionSecret(): string {
	return strongSecret('AGS_EDITOR_SESSION_SECRET');
}
