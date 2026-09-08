'use client';

import { useMemo, useState } from 'react';
import { EditorPanel, type EditorSelection } from './EditorPanel';
import { SitePreview } from './SitePreview';
import {
	EDITOR_PAGES,
	RESOURCE_NAMES,
	RESOURCE_CONFIGS,
	type EditorRecord,
	type HomepageCollection,
	type ResourceName,
	type WorkspaceData,
	type WorkspaceSchemas,
} from '@/lib/resources';

type Props = {
	adminName: string;
	adminOrigin: string;
	initialData: WorkspaceData;
	initialSchemas: WorkspaceSchemas;
	initialErrors: Partial<Record<ResourceName, string>>;
};

type Viewport = 'desktop' | 'tablet' | 'mobile';

async function jsonBody(response: Response): Promise<Record<string, unknown>> {
	return response.json().catch(() => ({ message: 'The editor service returned an invalid response.' }));
}

function messageFrom(body: Record<string, unknown>, fallback: string): string {
	return typeof body.message === 'string' ? body.message : fallback;
}

function keyForSelection(selection: EditorSelection | null): string {
	if (!selection) return '';
	return selection.kind === 'record'
		? `record:${selection.resource}:${selection.id}`
		: `homepage:${selection.definition.resource}`;
}

export function EditorShell({ adminName, adminOrigin, initialData, initialSchemas, initialErrors }: Props) {
	const [data, setData] = useState(initialData);
	const [schemas, setSchemas] = useState(initialSchemas);
	const [activePath, setActivePath] = useState('/');
	const [selection, setSelection] = useState<EditorSelection | null>(null);
	const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
	const [viewport, setViewport] = useState<Viewport>('desktop');
	const [isSaving, setIsSaving] = useState(false);
	const [isReloading, setIsReloading] = useState(false);
	const [error, setError] = useState('');
	const [notice, setNotice] = useState(() => {
		const failed = Object.keys(initialErrors).length;
		return failed ? `${failed} collection${failed === 1 ? '' : 's'} unavailable for this admin role.` : 'Standalone preview ready';
	});
	const activeResource = RESOURCE_NAMES.find((resource) => activePath === `/collections/${resource}`);
	const activePage = activeResource
		? { label: RESOURCE_CONFIGS[activeResource].label, path: activePath }
		: EDITOR_PAGES.find((page) => page.path === activePath) || EDITOR_PAGES[0];
	const currentSelectionKey = useMemo(() => keyForSelection(selection), [selection]);

	// The preview renders the record the panel is currently editing, unsaved values
	// included, so typing in a field is visible on the page immediately.
	const previewData = useMemo(() => {
		if (!draft || !selection || selection.kind !== 'record') return data;
		const { resource, id } = selection;
		if (!Object.keys(draft).length) return data;
		return {
			...data,
			[resource]: data[resource].map((record) => record._id === id ? { ...record, ...draft } : record),
		};
	}, [data, draft, selection]);

	const closePanel = () => {
		setSelection(null);
		setDraft(null);
		setError('');
	};

	const handleUnauthorized = (response: Response): boolean => {
		if (response.status !== 401) return false;
		window.location.replace(`${adminOrigin}/visual-editor`);
		return true;
	};

	const selectRecord = (resource: ResourceName, id: string) => {
		setError('');
		setDraft(null);
		setSelection({ kind: 'record', resource, id });
		setNotice(resource === 'contents' ? 'Editing page content' : `Arranging ${resource}`);
	};

	const saveRecord = async (resource: ResourceName, id: string, updates: Record<string, unknown>) => {
		setIsSaving(true);
		setError('');
		try {
			const response = await fetch(`/api/resources/${resource}/${id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updates),
			});
			if (handleUnauthorized(response)) return;
			const body = await jsonBody(response);
			if (!response.ok) throw new Error(messageFrom(body, 'The record could not be saved.'));
			const saved = body.doc && typeof body.doc === 'object' && !Array.isArray(body.doc)
				? body.doc as EditorRecord
				: null;
			setData((current) => ({
				...current,
				[resource]: current[resource].map((record) => record._id === id ? { ...record, ...updates, ...(saved || {}) } : record),
			}));
			setDraft(null);
			setNotice('Changes saved');
		} catch (saveError) {
			setError(saveError instanceof Error ? saveError.message : 'The record could not be saved.');
		} finally {
			setIsSaving(false);
		}
	};

	const reorder = async (resource: ResourceName, orderedIds: string[]) => {
		const before = data[resource];
		const byId = new Map(before.map((record) => [record._id, record]));
		const reordered = orderedIds.map((id, index) => ({ ...byId.get(id)!, priority: (orderedIds.length - index) * 10 }));
		const leftovers = before.filter((record) => !orderedIds.includes(record._id));
		const next = [...reordered, ...leftovers];
		setData((current) => ({ ...current, [resource]: next }));
		setNotice(`Saving ${resource} order…`);
		setError('');
		try {
			const response = await fetch(`/api/resources/${resource}/reorder`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ items: reordered.map((record) => ({ id: record._id, priority: record.priority })) }),
			});
			if (handleUnauthorized(response)) return;
			const body = await jsonBody(response);
			if (!response.ok) throw new Error(messageFrom(body, 'The new order could not be saved.'));
			setNotice('Priority order saved');
		} catch (reorderError) {
			setData((current) => ({ ...current, [resource]: before }));
			setError(reorderError instanceof Error ? reorderError.message : 'The new order could not be saved.');
			setNotice('Order restored because saving failed');
		}
	};

	const saveHomepage = async (definition: HomepageCollection, ids: string[]) => {
		setIsSaving(true);
		setError('');
		try {
			const existing = data.contents.find((record) => record.slug === definition.contentSlug);
			const response = await fetch(existing ? `/api/resources/contents/${existing._id}` : '/api/resources/contents', {
				method: existing ? 'PUT' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(existing ? { list: ids } : {
					name: definition.defaultName,
					slug: definition.contentSlug,
					category: 'list',
					status: 'published',
					pageName: 'home',
					isVisible: true,
					isActive: true,
					list: ids,
					priority: 0,
				}),
			});
			if (handleUnauthorized(response)) return;
			const body = await jsonBody(response);
			if (!response.ok) throw new Error(messageFrom(body, 'The homepage selection could not be saved.'));
			const saved = body.doc && typeof body.doc === 'object' && !Array.isArray(body.doc) ? body.doc as EditorRecord : null;
			setData((current) => ({
				...current,
				contents: existing
					? current.contents.map((record) => record._id === existing._id ? { ...record, list: ids, ...(saved || {}) } : record)
					: saved ? [...current.contents, saved] : current.contents,
			}));
			setNotice(`${definition.label} saved`);
		} catch (saveError) {
			setError(saveError instanceof Error ? saveError.message : 'The homepage selection could not be saved.');
		} finally {
			setIsSaving(false);
		}
	};

	const reload = async () => {
		setIsReloading(true);
		setError('');
		setNotice('Reloading editor data…');
		let loaded = 0;
		await Promise.all(RESOURCE_NAMES.map(async (resource) => {
			try {
				const response = await fetch(`/api/resources/${resource}`, { cache: 'no-store' });
				if (handleUnauthorized(response)) return;
				const body = await jsonBody(response);
				if (!response.ok || !Array.isArray(body.doc)) return;
				loaded += 1;
				setData((current) => ({ ...current, [resource]: body.doc as EditorRecord[] }));
				if (body.schema && typeof body.schema === 'object' && !Array.isArray(body.schema)) {
					setSchemas((current) => ({ ...current, [resource]: body.schema as WorkspaceSchemas[ResourceName] }));
				}
			} catch {
				// Keep the last usable data for an individually unavailable collection.
			}
		}));
		setNotice(`Reloaded ${loaded} of ${RESOURCE_NAMES.length} collections`);
		setIsReloading(false);
	};

	const logout = async () => {
		await fetch('/api/session/logout', { method: 'POST' });
		window.location.replace(`${adminOrigin}/visual-editor`);
	};

	return <main className='editor-shell'>
		<header className='editor-toolbar'>
			<div className='editor-brand'><span className='brand-mark'>AGS</span><div><strong>Visual Editor</strong><span>{activePage.label} · standalone preview</span></div></div>
			<div className='toolbar-status' aria-live='polite'><span className='status-dot' />{notice}</div>
			<div className='toolbar-actions'>
				<div className='viewport-switcher' aria-label='Preview width'>
					{(['desktop', 'tablet', 'mobile'] as const).map((size) => <button key={size} type='button' className={viewport === size ? 'is-active' : ''} onClick={() => setViewport(size)} aria-label={`${size} preview`}>{size === 'desktop' ? '▱' : '▯'}</button>)}
				</div>
				<span className='admin-name'>{adminName}</span>
				<button type='button' className='toolbar-button' disabled={isReloading} onClick={() => void reload()}>{isReloading ? 'Reloading…' : 'Reload data'}</button>
				<button type='button' className='toolbar-button' onClick={() => void logout()}>Exit</button>
			</div>
		</header>

		<div className={`workspace ${selection ? 'has-panel' : ''}`}>
			<aside className='page-sidebar'>
				<div className='page-sidebar-heading'><span className='eyebrow'>SITE PAGES</span><h2>Choose a page</h2><p>Page changes happen here. Links inside the preview are intentionally inactive.</p></div>
				<nav className='page-navigation' aria-label='Website pages'>
					{(['Main pages', 'Student journey', 'Resources'] as const).map((group) => <div className='page-navigation-group' key={group}><span>{group}</span>{EDITOR_PAGES.filter((page) => page.group === group).map((page) => <button key={page.path} type='button' className={page.path === activePath ? 'page-button is-active' : 'page-button'} onClick={() => { closePanel(); setActivePath(page.path); setNotice(`${page.label} preview ready`); }} aria-current={page.path === activePath ? 'page' : undefined}><span>{page.label}</span><small>{page.path}</small></button>)}</div>)}
				</nav>
				<nav className='page-navigation' aria-label='Content library'>
					<div className='page-navigation-group'>
						<span>All content</span>
						{RESOURCE_NAMES.map((resource) => <button key={resource} type='button' className={`page-button ${activeResource === resource ? 'is-active' : ''}`} aria-current={activeResource === resource ? 'page' : undefined} onClick={() => { closePanel(); setActivePath(`/collections/${resource}`); setNotice(`${RESOURCE_CONFIGS[resource].label} ready`); }}><span>{RESOURCE_CONFIGS[resource].label}</span><small>{data[resource].length}</small></button>)}
					</div>
				</nav>
				<p className='page-sidebar-note'><b>Editing:</b> hover to see the slug. Content blocks show only fields used on the website. Other collections open their priority list; their data is managed in Admin.</p>
			</aside>

			<section className='preview-stage' aria-label={`${activePage.label} page preview`}>
				<div className={`preview-device viewport-${viewport}`}>
					<div className='preview-site' key={activePath}>
						<SitePreview
							activePath={activePath}
							data={previewData}
							selectionKey={currentSelectionKey}
							onSelectRecord={selectRecord}
							onSelectHomepage={(definition) => { setError(''); setDraft(null); setSelection({ kind: 'homepage', definition }); setNotice(`Choosing ${definition.resource} for the homepage`); }}
							onReorder={reorder}
						/>
					</div>
				</div>
			</section>

			{selection ? <EditorPanel selection={selection} data={data} schemas={schemas} isSaving={isSaving} error={error} onClose={closePanel} onSaveRecord={saveRecord} onSaveHomepage={saveHomepage} onDraftChange={setDraft} onReorder={reorder} /> : null}
		</div>
	</main>;
}
