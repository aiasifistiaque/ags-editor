import { NextResponse } from 'next/server';
import { authorizeBearer, isTrustedEditorRequest } from '@/lib/auth';
import { encryptSession, EDITOR_SESSION_COOKIE, EDITOR_SESSION_SECONDS } from '@/lib/session-crypto';

export async function POST(request: Request) {
	if (!isTrustedEditorRequest(request)) {
		return NextResponse.json({ message: 'Untrusted editor origin.' }, { status: 403 });
	}

	const body = await request.json().catch(() => ({}));
	const token = typeof body.token === 'string' ? body.token : '';
	const admin = await authorizeBearer(token);
	if (!admin) {
		return NextResponse.json(
			{ message: 'A valid active admin with view and edit Contents permissions is required.' },
			{ status: 403 }
		);
	}

	const response = NextResponse.json({ authenticated: true });
	response.cookies.set(EDITOR_SESSION_COOKIE, encryptSession(token), {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		path: '/',
		maxAge: EDITOR_SESSION_SECONDS,
	});
	return response;
}
