import { NextResponse } from 'next/server';
import { getAuthorizedSession } from '@/lib/auth';
import { backendUrl } from '@/lib/env';
import { OPTION_MODELS } from '@/lib/resources';
import { readResponse } from '@/lib/resource-api';

type Context = { params: Promise<{ model: string }> };
type ListedDoc = { _id?: unknown; name?: unknown; title?: unknown };

/**
 * Option source for a `data-menu`/`data-tag` field whose `model` isn't one of
 * our 13 editor resources (courses' `university` is covered by `data[model]`
 * already; this is for the legacy `destinations`/`packages` relations
 * `gallerys`/`reviews` still carry). Only ever proxies a model in
 * `OPTION_MODELS` — never an arbitrary path a client could name.
 */
export async function GET(_request: Request, { params }: Context) {
	const session = await getAuthorizedSession();
	if (!session) return NextResponse.json({ message: 'Editor session expired.' }, { status: 401 });
	const { model } = await params;
	if (!OPTION_MODELS.has(model)) return NextResponse.json({ message: 'Unknown option source.' }, { status: 404 });

	const response = await fetch(backendUrl(`${model}?limit=1000&sort=name`), {
		headers: { authorization: session.token },
		cache: 'no-store',
	});
	const body = await readResponse(response);
	if (!response.ok) return NextResponse.json(body, { status: response.status });

	const docs = Array.isArray(body.doc) ? body.doc as ListedDoc[] : [];
	const options = docs
		.filter((doc): doc is ListedDoc & { _id: string } => typeof doc._id === 'string')
		.map((doc) => ({
			value: doc._id,
			label: (typeof doc.name === 'string' && doc.name) || (typeof doc.title === 'string' && doc.title) || doc._id,
		}));
	return NextResponse.json({ options });
}
