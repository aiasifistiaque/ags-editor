import { NextResponse } from 'next/server';
import { getAuthorizedSession, isTrustedEditorRequest } from '@/lib/auth';
import { backendUrl } from '@/lib/env';
import { isResourceName, RESOURCE_CONFIGS } from '@/lib/resources';
import { getResourceSchema, readResponse, validDocumentId } from '@/lib/resource-api';

type Context = { params: Promise<{ resource: string }> };
type ReorderItem = { id: string; priority: number };

export async function PUT(request: Request, { params }: Context) {
	if (!isTrustedEditorRequest(request)) {
		return NextResponse.json({ message: 'Untrusted editor origin.' }, { status: 403 });
	}
	const session = await getAuthorizedSession();
	if (!session) return NextResponse.json({ message: 'Editor session expired.' }, { status: 401 });
	const { resource } = await params;
	if (!isResourceName(resource) || !RESOURCE_CONFIGS[resource].reorderable) {
		return NextResponse.json({ message: 'This collection cannot be reordered.' }, { status: 400 });
	}

	const body = await request.json().catch(() => null);
	const items: ReorderItem[] = Array.isArray(body?.items) ? body.items : [];
	if (
		items.length === 0 ||
		items.length > 500 ||
		items.some((item) => !item || !validDocumentId(item.id) || !Number.isFinite(item.priority)) ||
		new Set(items.map((item) => item.id)).size !== items.length
	) {
		return NextResponse.json({ message: 'Invalid reorder payload.' }, { status: 400 });
	}
	const schema = await getResourceSchema(resource, session.token);
	if (!schema.priority) return NextResponse.json({ message: 'This collection has no priority field.' }, { status: 400 });

	for (let index = 0; index < items.length; index += 8) {
		const batch = items.slice(index, index + 8);
		const responses = await Promise.all(batch.map((item) => fetch(backendUrl(`${resource}/${item.id}`), {
			method: 'PUT',
			headers: { authorization: session.token, 'Content-Type': 'application/json' },
			body: JSON.stringify({ priority: item.priority }),
			cache: 'no-store',
		})));
		const failureIndex = responses.findIndex((response) => !response.ok);
		if (failureIndex >= 0) {
			const failed = responses[failureIndex];
			return NextResponse.json(await readResponse(failed), { status: failed.status });
		}
	}

	return NextResponse.json({ message: 'Priority order saved.' });
}
