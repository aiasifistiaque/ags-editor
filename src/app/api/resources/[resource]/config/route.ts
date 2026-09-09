import { NextResponse } from 'next/server';
import { getAuthorizedSession } from '@/lib/auth';
import { isResourceName } from '@/lib/resources';
import { getResourceFormConfig } from '@/lib/resource-api';

type Context = { params: Promise<{ resource: string }> };

/**
 * The form `ags-admin`'s `FormMain` renders for this resource — same
 * endpoints, same layout, same fields, per the work order's D1. Session-
 * guarded even though the backend route itself needs no auth: this proxy
 * still shouldn't be an open door for an unauthenticated caller to enumerate
 * every resource's field layout. `view`/`table` are dropped; the editor has
 * no table.
 */
export async function GET(_request: Request, { params }: Context) {
	const session = await getAuthorizedSession();
	if (!session) return NextResponse.json({ message: 'Editor session expired.' }, { status: 401 });
	const { resource } = await params;
	if (!isResourceName(resource)) return NextResponse.json({ message: 'Unknown editor resource.' }, { status: 404 });

	const config = await getResourceFormConfig(resource, session.token);
	return NextResponse.json({ form: config.form, schema: config.schema, route: config.route });
}
