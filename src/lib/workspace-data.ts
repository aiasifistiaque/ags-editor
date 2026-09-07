import 'server-only';

import { backendUrl } from './env';
import {
	emptyWorkspaceData,
	emptyWorkspaceSchemas,
	RESOURCE_NAMES,
	type EditorRecord,
	type ResourceName,
	type ResourceSchema,
	type WorkspaceData,
	type WorkspaceSchemas,
} from './resources';

type BackendList = {
	doc?: EditorRecord[];
};

export type WorkspacePayload = {
	data: WorkspaceData;
	schemas: WorkspaceSchemas;
	errors: Partial<Record<ResourceName, string>>;
};

async function responseJson<T>(response: Response): Promise<T | null> {
	try {
		return await response.json() as T;
	} catch {
		return null;
	}
}

export async function getWorkspaceData(token: string): Promise<WorkspacePayload> {
	const data = emptyWorkspaceData();
	const schemas = emptyWorkspaceSchemas();
	const errors: Partial<Record<ResourceName, string>> = {};

	await Promise.all(RESOURCE_NAMES.map(async (resource) => {
		try {
			const [listResponse, schemaResponse] = await Promise.all([
				fetch(backendUrl(`${resource}?limit=500&sort=-priority`), {
					headers: { authorization: token },
					cache: 'no-store',
				}),
				fetch(backendUrl(`${resource}/get/schema`), {
					headers: { authorization: token },
					cache: 'no-store',
				}),
			]);

			const list = await responseJson<BackendList & { message?: string }>(listResponse);
			const schema = await responseJson<ResourceSchema>(schemaResponse);
			if (listResponse.ok && Array.isArray(list?.doc)) data[resource] = list.doc;
			else errors[resource] = list?.message || `Could not load ${resource}.`;
			if (schemaResponse.ok && schema && typeof schema === 'object') schemas[resource] = schema;
		} catch {
			errors[resource] = `Could not connect while loading ${resource}.`;
		}
	}));

	return { data, schemas, errors };
}
