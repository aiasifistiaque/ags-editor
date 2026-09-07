import { NextResponse } from 'next/server';
import { getAuthorizedSession, isTrustedEditorRequest } from '@/lib/auth';
import { backendUrl } from '@/lib/env';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

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

	const response = await fetch(backendUrl('upload'), {
		method: 'POST',
		headers: { authorization: session.token },
		body: upload,
		cache: 'no-store',
	});
	const body = await response.json().catch(() => ({ message: 'Upload failed.' }));
	return NextResponse.json(body, { status: response.status });
}
