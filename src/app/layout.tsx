import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
	title: 'AGS Visual Editor',
	description: 'Authenticated visual content editor for Akashbari Global Services.',
	robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang='en'>
			<body>{children}</body>
		</html>
	);
}
