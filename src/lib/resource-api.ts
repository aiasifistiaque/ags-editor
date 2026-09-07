import 'server-only';

import { backendUrl } from './env';
import {
	isEditableField,
	isResourceName,
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

export async function validateUpdates(
	resourceValue: string,
	token: string,
	updates: unknown,
	options: { creating?: boolean } = {},
): Promise<{ resource: ResourceName; updates: Record<string, unknown> } | { error: string }> {
	if (!isResourceName(resourceValue)) return { error: 'Unknown editor resource.' };
	if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
		return { error: 'Invalid update payload.' };
	}

	const serialized = JSON.stringify(updates);
	if (serialized.length > 1_500_000) return { error: 'This update is too large.' };
	if (!isSafeJsonValue(updates)) return { error: 'The update contains an unsupported value.' };

	const resource = resourceValue;
	const schema = await getResourceSchema(resource, token);
	const keys = Object.keys(updates);
	const blockedOnCreate = new Set(['_id', 'id', '__v', 'code', 'createdAt', 'updatedAt']);
	const invalid = keys.filter((key) =>
		!(key in schema) ||
		(options.creating ? blockedOnCreate.has(key) : !isEditableField(resource, key))
	);

	if (keys.length === 0) return { error: 'There are no changes to save.' };
	if (invalid.length > 0) return { error: `Unsupported fields: ${invalid.join(', ')}` };
	return { resource, updates: updates as Record<string, unknown> };
}
