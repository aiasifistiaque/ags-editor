import { redirect } from 'next/navigation';
import { EditorShell } from '@/components/EditorShell';
import { getAuthorizedSession } from '@/lib/auth';
import { adminOrigin } from '@/lib/env';
import { getWorkspaceData } from '@/lib/workspace-data';

export const dynamic = 'force-dynamic';

export default async function Page() {
	const session = await getAuthorizedSession();
	if (!session) redirect(`${adminOrigin()}/visual-editor`);
	const workspace = await getWorkspaceData(session.token);

	return (
		<EditorShell
			adminName={session.admin.name || session.admin.email || 'AGS admin'}
			adminOrigin={adminOrigin()}
			initialData={workspace.data}
			initialSchemas={workspace.schemas}
			initialErrors={workspace.errors}
		/>
	);
}
