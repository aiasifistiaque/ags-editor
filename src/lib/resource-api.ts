import 'server-only';

import { backendUrl } from './env';
import {
	BLOCKED_ON_CREATE_FIELDS,
	invalidRecordWriteKeys,
	isEditableField,
	isResourceName,
	type ConfigFormField,
	type ResourceFormConfig,
	type ResourceName,
	type ResourceSchema,
} from './resources';

export function validDocumentId(id: string): boolean {
	return /^[a-f\d]{24}$/i.test(id);
}

export async function readResponse(response: Response): Promise<Record<string, unknown>> {
	const text = await response.text();
	if (!text) return {};
	try {
		const value: unknown = JSON.parse(text);
		return value && typeof value === 'object' && !Array.isArray(value)
			? value as Record<string, unknown>
			: { data: value };
	} catch {
		return { message: text };
	}
}

export async function getResourceSchema(resource: ResourceName, token: string): Promise<ResourceSchema> {
	const response = await fetch(backendUrl(`${resource}/get/schema`), {
		headers: { authorization: token },
		cache: 'no-store',
	});
	if (!response.ok) return {};
	const body = await readResponse(response);
	return body as ResourceSchema;
}

/**
 * The form Admin's `FormMain` renders for this resource, served ready-made by
 * the backend from the model's `config.ts` + `settings.ts`. A non-200 (a
 * resource with no `frontendConfig`, or the backend being briefly down) fails
 * closed: an empty form means `writableFormFields` allows nothing, rather
 * than a broken config accidentally opening every schema key to writes.
 */
export async function getResourceFormConfig(resource: ResourceName, token: string): Promise<ResourceFormConfig> {
	const response = await fetch(backendUrl(`${resource}/get/config`), {
		headers: { authorization: token },
		cache: 'no-store',
	});
	if (!response.ok) return { form: [], schema: {} };
	const body = await readResponse(response);
	const form = Array.isArray(body.form) ? body.form as ConfigFormField[] : [];
	const schema = body.schema && typeof body.schema === 'object' && !Array.isArray(body.schema)
		? body.schema as ResourceSchema
		: {};
	const route = body.route && typeof body.route === 'object' && !Array.isArray(body.route)
		? body.route as ResourceFormConfig['route']
		: undefined;
	return { form, schema, route };
}

function isSafeJsonValue(value: unknown, depth = 0): boolean {
	if (depth > 8) return false;
	if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
	if (typeof value === 'number') return Number.isFinite(value);
	if (Array.isArray(value)) return value.length <= 500 && value.every((item) => isSafeJsonValue(item, depth + 1));
	if (typeof value === 'object') {
		const entries = Object.entries(value as Record<string, unknown>);
		return entries.length <= 100 && entries.every(([key, item]) =>
			!key.startsWith('$') && !key.includes('.') && isSafeJsonValue(item, depth + 1)
		);
	}
	return false;
}

function checkPayload(resourceValue: string, updates: unknown): { keys: string[] } | { error: string } {
	if (!isResourceName(resourceValue)) return { error: 'Unknown editor resource.' };
	if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
		return { error: 'Invalid update payload.' };
	}
	const serialized = JSON.stringify(updates);
	if (serialized.length > 1_500_000) return { error: 'This update is too large.' };
	if (!isSafeJsonValue(updates)) return { error: 'The update contains an unsupported value.' };
	const keys = Object.keys(updates);
	if (keys.length === 0) return { error: 'There are no changes to save.' };
	return { keys };
}

/**
 * The `contents` write guard: `key in get/schema` minus `IMMUTABLE_FIELDS`
 * (edit) or minus `BLOCKED_ON_CREATE` (create). `contents` schema is shared
 * across ~50 slugs, so this stays schema-driven rather than form-driven —
 * there's no single `contents` form to derive an allowlist from.
 */
export async function validateContentUpdates(
	resourceValue: string,
	token: string,
	updates: unknown,
	options: { creating?: boolean } = {},
): Promise<{ resource: ResourceName; updates: Record<string, unknown> } | { error: string }> {
	const payload = checkPayload(resourceValue, updates);
	if ('error' in payload) return payload;
	const resource = resourceValue as ResourceName;
	const schema = await getResourceSchema(resource, token);
	const invalid = payload.keys.filter((key) =>
		!(key in schema) ||
		(options.creating ? BLOCKED_ON_CREATE_FIELDS.has(key) : !isEditableField(resource, key))
	);
	if (invalid.length > 0) return { error: `Unsupported fields: ${invalid.join(', ')}` };
	return { resource, updates: updates as Record<string, unknown> };
}

/**
 * The write guard for every resource except `contents`: the exact set of
 * fields the admin's own form posts (D3 in the work order), derived from
 * `get/config` rather than a hand-maintained list. A field added to a
 * model's `config.ts` becomes postable here with no editor change.
 */
export async function validateRecordWrite(
	resourceValue: string,
	token: string,
	updates: unknown,
	options: { creating?: boolean } = {},
): Promise<{ resource: ResourceName; updates: Record<string, unknown> } | { error: string }> {
	const payload = checkPayload(resourceValue, updates);
	if ('error' in payload) return payload;
	const resource = resourceValue as ResourceName;
	const config = await getResourceFormConfig(resource, token);
	const invalid = invalidRecordWriteKeys(payload.keys, config, Boolean(options.creating));
	if (invalid.length > 0) return { error: `Unsupported fields: ${invalid.join(', ')}` };
	return { resource, updates: updates as Record<string, unknown> };
}
