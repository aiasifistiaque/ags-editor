'use client';

import { useEffect, useState } from 'react';

const ADMIN_ORIGIN = process.env.NEXT_PUBLIC_ADMIN_ORIGIN || 'http://localhost:3001';

export default function HandoffPage() {
	const [message, setMessage] = useState('Waiting for your AGS admin session…');

	useEffect(() => {
		const opener = window.opener;
		if (!opener) return;

		const handleMessage = async (event: MessageEvent) => {
			if (event.origin !== ADMIN_ORIGIN || event.source !== opener) return;
			if (event.data?.type !== 'AGS_EDITOR_AUTH' || typeof event.data?.token !== 'string') return;

			setMessage('Validating your content permissions…');
			try {
				const response = await fetch('/api/session', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ token: event.data.token }),
				});

				if (!response.ok) {
					const body = await response.json().catch(() => ({}));
					setMessage(body.message || 'This account cannot access the visual editor.');
					return;
				}

				window.location.replace('/');
			} catch {
				setMessage('The editor could not reach the authentication service. Try again.');
			}
		};

		window.addEventListener('message', handleMessage);
		opener.postMessage({ type: 'AGS_EDITOR_READY' }, ADMIN_ORIGIN);
		return () => window.removeEventListener('message', handleMessage);
	}, []);

	return (
		<main className='handoff-page'>
			<div className='handoff-card' role='status' aria-live='polite'>
				<span className='brand-mark'>AGS</span>
				<h1>Secure visual editor</h1>
				<p>{message} If nothing happens, return to the admin and open the editor again.</p>
			</div>
		</main>
	);
}
