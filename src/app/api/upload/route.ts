import { NextResponse } from 'next/server';
import { getAuthorizedSession, isTrustedEditorRequest } from '@/lib/auth';
import { backendUrl } from '@/lib/env';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * `GET /api/upload` now forwards search/folder/paging to the backend
 * instead of fetching everything and filtering client-side — that stopped
 * scaling once `GET /api/upload` on the backend started honouring
 * pagination (see the Media Library work order §7.5; it used to ignore
 * `page`/`limit` entirely and return every row).
 *
 * `?folders=1` instead returns the distinct folder list
 * (`GET /api/upload/folders` on the backend) for the picker's folder filter.
 */
export async function GET(request: Request) {
	const session = await getAuthorizedSession();
	if (!session) return NextResponse.json({ message: 'Editor session expired.' }, { status: 401 });

	const params = new URL(request.url).searchParams;

	if (params.get('folders') === '1') {
		try {
			const response = await fetch(backendUrl('upload/folders'), {
				headers: { authorization: session.token }, cache: 'no-store',
			});
			const body = await response.json();
			if (!response.ok) return NextResponse.json({ message: body.message || 'Could not load folders.' }, { status: response.status });
			return NextResponse.json({ doc: Array.isArray(body.doc) ? body.doc : [] });
		} catch {
			return NextResponse.json({ message: 'Could not connect to the image library.' }, { status: 502 });
		}
	}

	const search = params.get('search') || '';
	const folder = params.get('folder') || '';
	const page = params.get('page') || '1';
	const limit = params.get('limit') || '40';

	try {
		const backendParams = new URLSearchParams({ type: 'image', page, limit });
		if (search) backendParams.set('search', search);
		if (folder) backendParams.set('folder', folder);

		const response = await fetch(backendUrl(`upload?${backendParams.toString()}`), {
			headers: { authorization: session.token }, cache: 'no-store',
		});
		const body = await response.json();
		if (!response.ok) return NextResponse.json({ message: body.message || 'Could not load uploaded images.' }, { status: response.status });
		const files = Array.isArray(body.doc) ? body.doc : [];
		return NextResponse.json({
			doc: files.filter((file: { type?: string; url?: string }) =>
				typeof file.url === 'string' && (file.type?.startsWith('image/') || file.type === 'image')
			).map((file: { _id: string; name?: string; url: string; folder?: string }) => ({
				id: file._id, name: file.name || 'Image', url: file.url, folder: file.folder || '',
			})),
			totalPages: body.totalPages || 1,
			page: body.page || 1,
		});
	} catch {
		return NextResponse.json({ message: 'Could not connect to the image library.' }, { status: 502 });
	}
}

export async function POST(request: Request) {
	if (!isTrustedEditorRequest(request)) {
		return NextResponse.json({ message: 'Untrusted editor origin.' }, { status: 403 });
	}
	const session = await getAuthorizedSession();
	if (!session) return NextResponse.json({ message: 'Editor session expired.' }, { status: 401 });

	const formData = await request.formData();
	const image = formData.get('image');
	if (!(image instanceof File)) {
		return NextResponse.json({ message: 'An image file is required.' }, { status: 400 });
	}
	if (!image.type.startsWith('image/')) {
		return NextResponse.json({ message: 'Only image files can be uploaded.' }, { status: 415 });
	}
	if (image.size > MAX_UPLOAD_BYTES) {
		return NextResponse.json({ message: 'Images must be 10 MB or smaller.' }, { status: 413 });
	}

	const upload = new FormData();
	upload.append('image', image, image.name);
	const folder = formData.get('folder');
	if (typeof folder === 'string' && folder.length <= 120) upload.append('folder', folder);

	const response = await fetch(backendUrl('upload'), {
		method: 'POST',
		headers: { authorization: session.token },
		body: upload,
		cache: 'no-store',
	});
	const body = await response.json().catch(() => ({ message: 'Upload failed.' }));
	return NextResponse.json(body, { status: response.status });
}
