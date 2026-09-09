import { NextResponse } from 'next/server';
import { getAuthorizedSession } from '@/lib/auth';
import { backendUrl } from '@/lib/env';
import { isResourceName } from '@/lib/resources';
import { readResponse, validDocumentId } from '@/lib/resource-api';

type Context = { params: Promise<{ resource: string; id: string }> };

/**
 * Proxies `<resource>/edit/:id`, not `GET <resource>/:id` — the latter runs
 * `QUERY_OPTIONS.populate`, so a relation field (e.g. a course's
 * `university`) comes back as a populated object rather than the id its
 * `data-menu` control needs to preselect. Mirrors the admin's
 * `useLazyGetByIdToEditQuery`.
 */
export async function GET(_request: Request, { params }: Context) {
	const session = await getAuthorizedSession();
	if (!session) return NextResponse.json({ message: 'Editor session expired.' }, { status: 401 });
	const { resource, id } = await params;
	if (!isResourceName(resource)) return NextResponse.json({ message: 'Unknown editor resource.' }, { status: 404 });
	if (!validDocumentId(id)) return NextResponse.json({ message: 'Invalid document ID.' }, { status: 400 });

	const response = await fetch(backendUrl(`${resource}/edit/${id}`), {
		headers: { authorization: session.token },
		cache: 'no-store',
	});
	return NextResponse.json(await readResponse(response), { status: response.status });
}
