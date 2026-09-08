import type { Metadata } from 'next';
import { Sora, DM_Sans } from 'next/font/google';
import './globals.css';

const sora = Sora({ subsets: ['latin'], variable: '--font-sora', display: 'swap', weight: ['400', '600', '700'] });
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', display: 'swap', weight: ['400', '500', '600'] });

export const metadata: Metadata = {
	title: 'AGS Visual Editor',
	description: 'Authenticated visual content editor for Akashbari Global Services.',
	robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang='en' className={`${sora.variable} ${dmSans.variable}`}>
			<body>{children}</body>
		</html>
	);
}
