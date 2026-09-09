'use client';

/* eslint-disable @next/next/no-img-element -- Media URLs come from the shared uploaded-file library. */
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Photo = { id: string; name: string; url: string; folder: string };
type Props = { label?: string; multiple?: boolean; onSelect: (urls: string[]) => void };

function validUrl(value: string) {
	if (value.startsWith('/') && !value.startsWith('//')) return true;
	try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}

function MediaDialog({ multiple, onSelect, onClose }: Props & { onClose: () => void }) {
	const dialog = useRef<HTMLDialogElement>(null);
	const titleId = useId();
	const [tab, setTab] = useState('photos');
	const [photos, setPhotos] = useState<Photo[]>([]);
	const [folders, setFolders] = useState<string[]>([]);
	const [totalPages, setTotalPages] = useState(1);
	const [selected, setSelected] = useState<string[]>([]);
	const [search, setSearch] = useState('');
	const [folder, setFolder] = useState('');
	const [uploadFolder, setUploadFolder] = useState('editor');
	const [url, setUrl] = useState('');
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [refresh, setRefresh] = useState(0);
	const [page, setPage] = useState(1);

	useEffect(() => { dialog.current?.showModal(); }, []);

	// Folder list is fetched once (refreshed on upload) — independent of the
	// current search/folder filter on the photo grid itself.
	useEffect(() => {
		const controller = new AbortController();
		fetch('/api/upload?folders=1', { signal: controller.signal, cache: 'no-store' })
			.then(async (response) => {
				const body = await response.json();
				if (response.ok) setFolders((Array.isArray(body.doc) ? body.doc : []).filter(Boolean).sort());
			})
			.catch(() => {});
		return () => controller.abort();
	}, [refresh]);

	// Search/folder/page are resolved server-side now — see the work order
	// §7.5, this used to fetch the whole library and filter client-side,
	// which stopped scaling once the backend started paginating for real.
	useEffect(() => {
		const controller = new AbortController();
		setLoading(true);
		const params = new URLSearchParams({ page: String(page), limit: '40' });
		if (search) params.set('search', search);
		if (folder) params.set('folder', folder);
		fetch(`/api/upload?${params.toString()}`, { signal: controller.signal, cache: 'no-store' })
			.then(async (response) => {
				const body = await response.json();
				if (!response.ok) throw new Error(body.message || 'Could not load images.');
				setPhotos((current) => (page === 1 ? body.doc : [...current, ...body.doc]));
				setTotalPages(body.totalPages || 1);
			})
			.catch((failure) => { if (!controller.signal.aborted) setError(failure.message); })
			.finally(() => { if (!controller.signal.aborted) setLoading(false); });
		return () => controller.abort();
	}, [refresh, search, folder, page]);

	// Reset to page 1 whenever the filters themselves change (not on
	// pagination or refresh, which manage `page` directly).
	useEffect(() => { setPage(1); }, [search, folder]);

	const chosen = tab === 'url' ? url.split('\n').map((item) => item.trim()).filter(Boolean) : selected;
	const canInsert = chosen.length > 0 && (multiple || chosen.length === 1) && chosen.every(validUrl);

	async function upload(files: FileList | null) {
		if (!files?.length) return;
		setBusy(true); setError('');
		const uploaded: string[] = [];
		try {
			for (const file of Array.from(files)) {
				if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) throw new Error(`${file.name}: choose an image of 10 MB or less.`);
				const form = new FormData(); form.append('image', file); form.append('folder', uploadFolder.trim() || 'editor');
				const response = await fetch('/api/upload', { method: 'POST', body: form });
				const body = await response.json();
				if (!response.ok) throw new Error(body.message || 'Upload failed.');
				const source = body.data?.url || body.file?.Location;
				if (typeof source !== 'string') throw new Error('The upload service did not return an image URL.');
				uploaded.push(source);
			}
		} catch (failure) { setError(failure instanceof Error ? failure.message : 'Upload failed.'); }
		finally {
			if (uploaded.length) {
				setSelected((current) => multiple ? [...new Set([...current, ...uploaded])] : uploaded.slice(-1));
				setRefresh((current) => current + 1); setTab('photos'); setFolder(''); setSearch('');
			}
			setBusy(false);
		}
	}

	return createPortal(<dialog className='media-dialog' ref={dialog} aria-labelledby={titleId} onCancel={(event) => { if (busy) event.preventDefault(); }} onClose={onClose}>
		<header className='media-dialog-header'><div><h2 id={titleId}>Photo library</h2><p>Choose uploaded photos, upload new images, or paste an image address.</p></div><button type='button' className='icon-button' aria-label='Close photo library' disabled={busy} onClick={() => dialog.current?.close()}>×</button></header>
		<nav className='media-tabs' aria-label='Image source'>{[['photos', 'All photos'], ['upload', 'Upload'], ['url', 'Web address (URL)']].map(([key, text]) => <button type='button' key={key} aria-pressed={tab === key} disabled={busy} onClick={() => setTab(key)}>{text}</button>)}</nav>
		<div className='media-dialog-body'>
			{tab === 'photos' ? <>
				<div className='media-filters'><input aria-label='Search uploaded photos' type='search' placeholder='Search photos…' value={search} onChange={(event) => { setSearch(event.target.value); }} /><select aria-label='Photo folder' value={folder} onChange={(event) => { setFolder(event.target.value); }}><option value=''>All folders</option>{folders.map((name) => <option key={name}>{name}</option>)}</select><button type='button' className='secondary-button' onClick={() => { setLoading(true); setError(''); setRefresh((value) => value + 1); }}>Refresh</button></div>
				{loading && page === 1 ? <p role='status'>Loading uploaded photos…</p> : <><p>{photos.length} photo{photos.length === 1 ? '' : 's'} · {selected.length} selected</p><div className='media-grid'>{photos.map((photo) => <button type='button' key={photo.id} className='media-photo' aria-label={`Select ${photo.name}`} aria-pressed={selected.includes(photo.url)} onClick={() => setSelected((current) => multiple ? current.includes(photo.url) ? current.filter((item) => item !== photo.url) : [...current, photo.url] : [photo.url])}><img loading='lazy' src={photo.url} alt={photo.name} /><span title={photo.name}>{photo.name}</span></button>)}</div>{!photos.length ? <p>No photos found. Upload an image or change your filters.</p> : null}{page < totalPages ? <button type='button' className='secondary-button' disabled={loading} onClick={() => setPage((current) => current + 1)}>Load more photos</button> : null}</>}
			</> : tab === 'upload' ? <div className='media-upload'><label>Folder<input value={uploadFolder} maxLength={120} disabled={busy} onChange={(event) => setUploadFolder(event.target.value)} /></label><label className='media-upload-zone'>Choose {multiple ? 'images' : 'an image'} to upload<input aria-label='Upload photos' type='file' accept='image/*' multiple={multiple} disabled={busy} onChange={(event) => { void upload(event.target.files); event.target.value = ''; }} /></label><p role='status'>{busy ? 'Uploading… Keep this window open.' : 'Images up to 10 MB. Uploaded photos are also available in Admin.'}</p></div> : <div className='media-url'><label>Image address{multiple ? <textarea aria-label='Image addresses' value={url} onChange={(event) => setUrl(event.target.value)} placeholder='One image URL per line' rows={4} /> : <input aria-label='Image address' type='text' inputMode='url' value={url} onChange={(event) => setUrl(event.target.value)} placeholder='https://example.com/photo.jpg or /uploads/photo.jpg' />}</label>{url && !canInsert ? <p>Enter {multiple ? 'valid image addresses' : 'one valid image address'} using https://, http://, or a local /path.</p> : null}{canInsert ? <div className='media-grid'>{chosen.map((source, index) => <img className='media-url-preview' key={`${source}-${index}`} src={source} alt='Image address preview' />)}</div> : null}</div>}
			{error ? <p className='form-error' role='alert'>{error}</p> : null}
		</div>
		<footer className='media-dialog-footer'><small>Insert updates the draft. Save the record to publish the change.</small><button type='button' className='secondary-button' disabled={busy} onClick={() => dialog.current?.close()}>Cancel</button><button type='button' className='primary-button' disabled={!canInsert || busy} onClick={() => { onSelect(chosen); dialog.current?.close(); }}>Insert {multiple ? 'images' : 'image'}</button></footer>
	</dialog>, document.body);
}

export function MediaPicker({ label = 'Choose image', ...props }: Props) {
	const [open, setOpen] = useState(false);
	return <><button type='button' className='upload-button' onClick={() => setOpen(true)}>{label}</button>{open ? <MediaDialog {...props} onClose={() => setOpen(false)} /> : null}</>;
}
