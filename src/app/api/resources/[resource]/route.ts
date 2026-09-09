import { NextResponse } from 'next/server';
import { can, getAuthorizedSession, isTrustedEditorRequest } from '@/lib/auth';
import { backendUrl } from '@/lib/env';
import { isResourceName, RESOURCE_CONFIGS } from '@/lib/resources';
import { readResponse, validateContentUpdates, validateRecordWrite } from '@/lib/resource-api';

type Context = { params: Promise<{ resource: string }> };

export async function GET(_request: Request, { params }: Context) {
	const session = await getAuthorizedSession();
	if (!session) return NextResponse.json({ message: 'Editor session expired.' }, { status: 401 });
	const { resource } = await params;
	if (!isResourceName(resource)) return NextResponse.json({ message: 'Unknown editor resource.' }, { status: 404 });

	const [listResponse, schemaResponse] = await Promise.all([
		fetch(backendUrl(`${resource}?limit=500&sort=-priority`), {
			headers: { authorization: session.token },
			cache: 'no-store',
		}),
		fetch(backendUrl(`${resource}/get/schema`), {
			headers: { authorization: session.token },
			cache: 'no-store',
		}),
	]);
	const list = await readResponse(listResponse);
	const schema = await readResponse(schemaResponse);
	if (!listResponse.ok) return NextResponse.json(list, { status: listResponse.status });
	return NextResponse.json({ ...list, schema: schemaResponse.ok ? schema : {} });
}

export async function POST(request: Request, { params }: Context) {
	if (!isTrustedEditorRequest(request)) {
		return NextResponse.json({ message: 'Untrusted editor origin.' }, { status: 403 });
	}
	const session = await getAuthorizedSession();
	if (!session) return NextResponse.json({ message: 'Editor session expired.' }, { status: 401 });
	const { resource } = await params;
	if (!isResourceName(resource)) return NextResponse.json({ message: 'Unknown editor resource.' }, { status: 404 });
	if (!RESOURCE_CONFIGS[resource].creatable) {
		return NextResponse.json({ message: 'New records for this collection must be added from the admin panel.' }, { status: 405 });
	}
	if (resource !== 'contents' && !can(session.admin, 'create', resource)) {
		return NextResponse.json({ message: `Your role cannot create ${RESOURCE_CONFIGS[resource].label.toLowerCase()}.` }, { status: 403 });
	}

	const body = await request.json().catch(() => null);
	const validated = resource === 'contents'
		? await validateContentUpdates(resource, session.token, body, { creating: true })
		: await validateRecordWrite(resource, session.token, body, { creating: true });
	if ('error' in validated) return NextResponse.json({ message: validated.error }, { status: 400 });

	const response = await fetch(backendUrl(resource), {
		method: 'POST',
		headers: { authorization: session.token, 'Content-Type': 'application/json' },
		body: JSON.stringify(validated.updates),
		cache: 'no-store',
	});
	return NextResponse.json(await readResponse(response), { status: response.status });
}
