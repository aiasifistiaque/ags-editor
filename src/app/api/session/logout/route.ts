import { NextResponse } from 'next/server';
import { isTrustedEditorRequest } from '@/lib/auth';
import { EDITOR_SESSION_COOKIE } from '@/lib/session-crypto';

export async function POST(request: Request) {
	if (!isTrustedEditorRequest(request)) {
		return NextResponse.json({ message: 'Untrusted editor origin.' }, { status: 403 });
	}
	const response = NextResponse.json({ loggedOut: true });
	response.cookies.set(EDITOR_SESSION_COOKIE, '', { expires: new Date(0), path: '/' });
	return response;
}
