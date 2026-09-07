import { NextResponse } from 'next/server';
import { getAuthorizedSession, isTrustedEditorRequest } from '@/lib/auth';
import { backendUrl } from '@/lib/env';
import { isResourceName } from '@/lib/resources';
import { readResponse, validateUpdates, validDocumentId } from '@/lib/resource-api';

type Context = { params: Promise<{ resource: string; id: string }> };

export async function GET(_request: Request, { params }: Context) {
	const session = await getAuthorizedSession();
	if (!session) return NextResponse.json({ message: 'Editor session expired.' }, { status: 401 });
	const { resource, id } = await params;
	if (!isResourceName(resource)) return NextResponse.json({ message: 'Unknown editor resource.' }, { status: 404 });
	if (!validDocumentId(id)) return NextResponse.json({ message: 'Invalid document ID.' }, { status: 400 });

	const response = await fetch(backendUrl(`${resource}/${id}`), {
		headers: { authorization: session.token },
		cache: 'no-store',
	});
	return NextResponse.json(await readResponse(response), { status: response.status });
}

export async function PUT(request: Request, { params }: Context) {
	if (!isTrustedEditorRequest(request)) {
		return NextResponse.json({ message: 'Untrusted editor origin.' }, { status: 403 });
	}
	const session = await getAuthorizedSession();
	if (!session) return NextResponse.json({ message: 'Editor session expired.' }, { status: 401 });
	const { resource, id } = await params;
	if (!validDocumentId(id)) return NextResponse.json({ message: 'Invalid document ID.' }, { status: 400 });

	const body = await request.json().catch(() => null);
	const validated = await validateUpdates(resource, session.token, body);
	if ('error' in validated) return NextResponse.json({ message: validated.error }, { status: 400 });

	const response = await fetch(backendUrl(`${validated.resource}/${id}`), {
		method: 'PUT',
		headers: { authorization: session.token, 'Content-Type': 'application/json' },
		body: JSON.stringify(validated.updates),
		cache: 'no-store',
	});
	return NextResponse.json(await readResponse(response), { status: response.status });
}
