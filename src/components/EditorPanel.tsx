'use client';

/* eslint-disable @next/next/no-img-element -- CMS URLs are arbitrary and this editor must preview them without a deployment-time host allowlist. */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
	isEditableField,
	isResourceName,
	prioritySorted,
	recordLabel,
	recordSlug,
	RESOURCE_CONFIGS,
	type BackendFieldSchema,
	type EditorRecord,
	type HomepageCollection,
	type ResourceName,
	type ResourceSchema,
	type WorkspaceData,
} from '@/lib/resources';

export type EditorSelection =
	| { kind: 'record'; resource: ResourceName; id: string }
	| { kind: 'homepage'; definition: HomepageCollection };

type Props = {
	selection: EditorSelection;
	data: WorkspaceData;
	schemas: Record<ResourceName, ResourceSchema>;
	isSaving: boolean;
	error: string;
	onClose: () => void;
	onSaveRecord: (resource: ResourceName, id: string, updates: Record<string, unknown>) => Promise<void>;
	onSaveHomepage: (definition: HomepageCollection, ids: string[]) => Promise<void>;
	onDraftChange: (updates: Record<string, unknown> | null) => void;
};

function cloneValue<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function sameValue(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

function humanize(value: string): string {
	return value
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/[-_]/g, ' ')
		.replace(/^./, (character) => character.toUpperCase());
}

function inputType(schema: BackendFieldSchema, current: unknown): string {
	if (schema.type === 'checkbox' || typeof current === 'boolean') return 'boolean';
	if (schema.type === 'number' || typeof current === 'number') return 'number';
	if (schema.type === 'textarea' || schema.type === 'editor') return 'textarea';
	if (schema.type === 'select') return 'select';
	if (schema.type === 'image') return 'image';
	if (schema.type === 'date' || schema.type === 'date-only') return 'date';
	if (schema.type === 'data-menu') return 'relation';
	if (schema.type === 'data-tag') return 'relation-list';
	if (schema.type === 'array-string' || schema.type === 'image-array') return 'string-list';
	if (schema.type?.includes('array') || Array.isArray(current)) return 'array';
	if (schema.type === 'seo' || (current && typeof current === 'object')) return 'json';
	return 'text';
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function uploadedUrl(payload: unknown): string {
	if (!payload || typeof payload !== 'object') return '';
	const body = payload as { data?: { url?: unknown }; file?: { Location?: unknown } };
	const url = body.data?.url ?? body.file?.Location;
	return typeof url === 'string' ? url : '';
}

async function uploadImage(file: File): Promise<string> {
	if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
	if (file.size > MAX_UPLOAD_BYTES) throw new Error('Images must be 10 MB or smaller.');

	const form = new FormData();
	form.append('image', file);
	const response = await fetch('/api/upload', { method: 'POST', body: form });
	const payload: unknown = await response.json().catch(() => null);
	if (!response.ok) {
		const message = payload && typeof payload === 'object' && typeof (payload as { message?: unknown }).message === 'string'
			? (payload as { message: string }).message
			: 'The image could not be uploaded.';
		throw new Error(message);
	}
	const url = uploadedUrl(payload);
	if (!url) throw new Error('The upload service did not return an image URL.');
	return url;
}

function UploadButton({ label, multiple, onUploaded }: {
	label: string;
	multiple?: boolean;
	onUploaded: (urls: string[]) => void;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [uploadError, setUploadError] = useState('');

	const handleFiles = async (files: FileList | null) => {
		if (!files || !files.length) return;
		setIsUploading(true);
		setUploadError('');
		try {
			const urls = await Promise.all([...files].map(uploadImage));
			onUploaded(urls);
		} catch (error) {
			setUploadError(error instanceof Error ? error.message : 'The image could not be uploaded.');
		} finally {
			setIsUploading(false);
			if (inputRef.current) inputRef.current.value = '';
		}
	};

	return <>
		<button type='button' className='upload-button' disabled={isUploading} onClick={() => inputRef.current?.click()}>
			{isUploading ? 'Uploading…' : label}
		</button>
		<input
			ref={inputRef}
			type='file'
			accept='image/*'
			multiple={multiple}
			hidden
			onChange={(event) => void handleFiles(event.target.files)}
		/>
		{uploadError ? <small className='field-warning'>{uploadError}</small> : null}
	</>;
}

function ImageControl({ value, onChange }: { value: unknown; onChange: (value: string) => void }) {
	const current = typeof value === 'string' ? value : '';
	return <div className='image-control'>
		<input type='text' inputMode='url' value={current} onChange={(event) => onChange(event.target.value)} placeholder='https://… or upload a file' />
		<div className='image-control-actions'>
			<UploadButton label={current ? 'Replace image' : 'Upload image'} onUploaded={(urls) => onChange(urls[0])} />
			{current ? <button type='button' className='link-button' onClick={() => onChange('')}>Remove</button> : null}
		</div>
		{current ? <div className='field-image-preview'><img src={current} alt='' /></div> : null}
	</div>;
}

function StringListControl({ value, onChange, imageList }: { value: unknown; onChange: (value: string[]) => void; imageList?: boolean }) {
	const list = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
	return <>
		<textarea
			value={list.join('\n')}
			onChange={(event) => onChange(event.target.value.split('\n').map((item) => item.trim()).filter(Boolean))}
			rows={Math.max(4, Math.min(10, list.length + 2))}
			placeholder={imageList ? 'One image URL per line' : 'One item per line'}
		/>
		{imageList ? <div className='image-control-actions'>
			<UploadButton label='Upload images' multiple onUploaded={(urls) => onChange([...list, ...urls])} />
		</div> : null}
		{imageList && list.length ? <div className='field-image-list'>{list.slice(0, 8).map((source, index) => <img key={`${source}-${index}`} src={source} alt='' />)}</div> : null}
	</>;
}

function JsonControl({ value, onChange }: { value: unknown; onChange: (value: unknown) => void }) {
	const [text, setText] = useState(() => JSON.stringify(value ?? {}, null, 2));
	const [invalid, setInvalid] = useState(false);
	return <>
		<textarea
			className='code-input'
			value={text}
			onChange={(event) => {
				const next = event.target.value;
				setText(next);
				try {
					onChange(JSON.parse(next));
					setInvalid(false);
				} catch {
					setInvalid(true);
				}
			}}
			rows={10}
		/>
		{invalid ? <small className='field-warning'>Finish the JSON value before saving.</small> : null}
	</>;
}

function nestedFields(schema: BackendFieldSchema, items: Array<Record<string, unknown>>): Array<BackendFieldSchema & { name: string }> {
	const defined = schema.section?.dataModel;
	if (Array.isArray(defined) && defined.length) return defined;
	const keys = new Set<string>();
	items.forEach((item) => Object.keys(item).forEach((key) => {
		if (key !== '_id' && key !== 'id') keys.add(key);
	}));
	if (!keys.size) ['title', 'subTitle', 'description', 'image'].forEach((key) => keys.add(key));
	return [...keys].map((name) => ({ name, label: humanize(name), type: name === 'description' ? 'textarea' : name === 'image' ? 'image' : 'string' }));
}

function NestedArrayControl({ schema, value, onChange }: { schema: BackendFieldSchema; value: unknown; onChange: (value: Array<Record<string, unknown>>) => void }) {
	const items = Array.isArray(value)
		? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
		: [];
	const fields = nestedFields(schema, items);
	const updateItem = (index: number, key: string, nextValue: unknown) => {
		const next = cloneValue(items);
		next[index] = { ...next[index], [key]: nextValue };
		onChange(next);
	};
	return <div className='nested-items'>
		{items.map((item, index) => (
			<div className='nested-item' key={String(item._id || index)}>
				<div className='nested-item-heading'><strong>Item {index + 1}</strong><button type='button' onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>
				{fields.map((field) => {
					const type = inputType(field, item[field.name]);
					return <label className='nested-field' key={field.name}><span>{field.label || humanize(field.name)}</span>
						{type === 'textarea' ? <textarea rows={3} value={String(item[field.name] ?? '')} onChange={(event) => updateItem(index, field.name, event.target.value)} />
							: type === 'select' ? <select value={String(item[field.name] ?? '')} onChange={(event) => updateItem(index, field.name, event.target.value)}><option value=''>Select…</option>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
							: type === 'image' ? <ImageControl value={item[field.name]} onChange={(next) => updateItem(index, field.name, next)} />
							: <input type={type === 'number' ? 'number' : 'text'} value={String(item[field.name] ?? '')} onChange={(event) => updateItem(index, field.name, type === 'number' ? Number(event.target.value) : event.target.value)} />}
					</label>;
				})}
			</div>
		))}
		<button type='button' className='add-array-button' onClick={() => onChange([...items, Object.fromEntries(fields.map((field) => [field.name, '']))])}>+ Add item</button>
	</div>;
}

function ArrayControl({ schema, value, onChange }: { schema: BackendFieldSchema; value: unknown; onChange: (value: unknown) => void }) {
	const items = Array.isArray(value) ? value : [];
	if (schema.type === 'array-string' || schema.type === 'image-array' || (items.length > 0 && items.every((item) => typeof item === 'string'))) {
		return <StringListControl value={items} onChange={onChange} imageList={schema.type === 'image-array'} />;
	}
	return <NestedArrayControl schema={schema} value={items} onChange={onChange} />;
}

function FieldControl({
	field,
	schema,
	value,
	data,
	onChange,
}: {
	field: string;
	schema: BackendFieldSchema;
	value: unknown;
	data: WorkspaceData;
	onChange: (value: unknown) => void;
}) {
	const type = inputType(schema, value);
	if (type === 'boolean') return <label className='switch-control'><input type='checkbox' checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} /><span /><b>{Boolean(value) ? 'Yes' : 'No'}</b></label>;
	if (type === 'textarea') return <textarea value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} rows={6} placeholder={schema.placeholder} />;
	if (type === 'number') return <input type='number' value={typeof value === 'number' ? value : String(value ?? '')} onChange={(event) => onChange(event.target.value === '' ? 0 : Number(event.target.value))} />;
	if (type === 'select') return <select value={String(value ?? '')} onChange={(event) => onChange(event.target.value)}><option value=''>Select…</option>{schema.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
	if (type === 'image') return <ImageControl value={value} onChange={onChange} />;
	if (type === 'date') return <input type='date' value={String(value ?? '').slice(0, 10)} onChange={(event) => onChange(event.target.value)} />;
	if (type === 'relation') {
		const model = schema.model;
		const options = model && isResourceName(model) ? data[model] : [];
		const current = value && typeof value === 'object' && !Array.isArray(value) ? String((value as EditorRecord)._id || '') : String(value ?? '');
		return <select value={current} onChange={(event) => onChange(event.target.value)}><option value=''>Select…</option>{options.map((option) => <option key={option._id} value={option._id}>{recordLabel(model as ResourceName, option)}</option>)}</select>;
	}
	if (type === 'relation-list') {
		const ids = Array.isArray(value) ? value.map((item) => typeof item === 'object' && item ? String((item as EditorRecord)._id || '') : String(item)) : [];
		return <StringListControl value={ids} onChange={onChange} />;
	}
	if (type === 'string-list') return <StringListControl value={value} onChange={onChange} imageList={schema.type === 'image-array'} />;
	if (type === 'array') return <ArrayControl schema={schema} value={value} onChange={onChange} />;
	if (type === 'json') return <JsonControl value={value} onChange={onChange} />;
	const isUrl = field.toLowerCase().includes('url') || field.toLowerCase().includes('website');
	return <input type={field === 'email' ? 'email' : 'text'} inputMode={isUrl ? 'url' : undefined} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} placeholder={schema.placeholder} />;
}

function RecordEditor({
	resource,
	record,
	schema,
	data,
	isSaving,
	error,
	onClose,
	onSave,
	onDraftChange,
}: {
	resource: ResourceName;
	record: EditorRecord;
	schema: ResourceSchema;
	data: WorkspaceData;
	isSaving: boolean;
	error: string;
	onClose: () => void;
	onSave: Props['onSaveRecord'];
	onDraftChange: Props['onDraftChange'];
}) {
	const editableFields = useMemo(() => Object.entries(schema).filter(([key]) => isEditableField(resource, key)), [resource, schema]);
	const [values, setValues] = useState<Record<string, unknown>>(() => Object.fromEntries(editableFields.map(([key]) => [key, cloneValue(record[key] ?? '')])));
	const updates = useMemo(() => Object.fromEntries(editableFields.filter(([key]) => !sameValue(values[key], record[key] ?? '')).map(([key]) => [key, values[key]])), [editableFields, record, values]);
	const isDirty = Object.keys(updates).length > 0;

	// Every keystroke re-renders the preview through the shell, so the page shows
	// unsaved edits exactly as they will look once saved. `onDraftChange` is the
	// shell's `setDraft` state setter, so both effects are keyed on `updates` alone.
	useEffect(() => {
		onDraftChange(updates);
	}, [updates, onDraftChange]);
	useEffect(() => () => onDraftChange(null), [onDraftChange]);

	return <aside className='editor-panel'>
		<div className='panel-header'>
			<div><span className='eyebrow'>{RESOURCE_CONFIGS[resource].singular.toUpperCase()}</span><h2>{recordLabel(resource, record)}</h2><code>{recordSlug(resource, record)}</code></div>
			<button className='icon-button' type='button' onClick={onClose} aria-label='Close editor panel'>×</button>
		</div>
		<form className='editor-form' onSubmit={(event) => { event.preventDefault(); if (isDirty) void onSave(resource, record._id, updates); }}>
			<div className='fields'>
				{editableFields.length ? editableFields.map(([field, fieldSchema]) => (
					<label className='field' key={field}><span>{fieldSchema.label || humanize(field)}{fieldSchema.isRequired ? <em>Required</em> : null}</span>
						<FieldControl field={field} schema={fieldSchema} value={values[field]} data={data} onChange={(next) => setValues((current) => ({ ...current, [field]: next }))} />
						{fieldSchema.helperText ? <small>{fieldSchema.helperText}</small> : null}
					</label>
				)) : <p className='panel-empty-copy'>This resource did not expose an editable field schema.</p>}
			</div>
			{error ? <p className='form-error' role='alert'>{error}</p> : null}
			<div className='form-actions'><button className='secondary-button' type='button' onClick={onClose}>Cancel</button><button className='primary-button' type='submit' disabled={!isDirty || isSaving}>{isSaving ? 'Saving…' : 'Save changes'}</button></div>
		</form>
	</aside>;
}

function HomepageSelectionEditor({ definition, data, isSaving, error, onClose, onSave }: {
	definition: HomepageCollection;
	data: WorkspaceData;
	isSaving: boolean;
	error: string;
	onClose: () => void;
	onSave: Props['onSaveHomepage'];
}) {
	const content = data.contents.find((record) => record.slug === definition.contentSlug);
	const stored = Array.isArray(content?.list) ? content.list.filter((item): item is string => typeof item === 'string') : [];
	const available = prioritySorted(data[definition.resource]);
	const initial = stored.length ? stored.filter((id) => available.some((record) => record._id === id)) : available.filter((record) => record.isVisible !== false && record.isActive !== false).slice(0, definition.defaultLimit).map((record) => record._id);
	const [selected, setSelected] = useState(initial);
	const [search, setSearch] = useState('');
	const [dragged, setDragged] = useState<string | null>(null);
	const filtered = available.filter((record) => recordLabel(definition.resource, record).toLowerCase().includes(search.trim().toLowerCase()));
	const selectedRecords = selected.map((id) => available.find((record) => record._id === id)).filter((record): record is EditorRecord => Boolean(record));
	const dirty = !sameValue(selected, stored.length ? stored : initial);

	return <aside className='editor-panel'>
		<div className='panel-header'><div><span className='eyebrow'>HOMEPAGE DISPLAY</span><h2>{definition.label}</h2><code>{definition.contentSlug}</code></div><button className='icon-button' type='button' onClick={onClose} aria-label='Close editor panel'>×</button></div>
		<div className='selection-panel-body'>
			<p className='selection-help'>Choose records already created in Admin. The checked items appear on the homepage; drag selected items to set their display order.</p>
			<label className='field'><span>Find {definition.resource}</span><input type='search' value={search} onChange={(event) => setSearch(event.target.value)} placeholder='Search records…' /></label>
			<div className='selection-list' aria-label={`Available ${definition.resource}`}>
				{filtered.map((record) => {
					const checked = selected.includes(record._id);
					return <label key={record._id} className={`selection-option ${checked ? 'is-checked' : ''}`}><input type='checkbox' checked={checked} onChange={() => setSelected((current) => checked ? current.filter((id) => id !== record._id) : [...current, record._id])} /><span><strong>{recordLabel(definition.resource, record)}</strong><small>{recordSlug(definition.resource, record)}</small></span></label>;
				})}
			</div>
			<div className='selected-order'><div className='selected-order-heading'><strong>Homepage order</strong><span>{selected.length} selected</span></div>
				{selectedRecords.map((record, index) => <div
					key={record._id}
					className='selected-order-item'
					draggable
					onDragStart={() => setDragged(record._id)}
					onDragOver={(event) => event.preventDefault()}
					onDrop={() => {
						if (!dragged || dragged === record._id) return;
						setSelected((current) => {
							const next = [...current];
							const from = next.indexOf(dragged);
							const to = next.indexOf(record._id);
							next.splice(to, 0, next.splice(from, 1)[0]);
							return next;
						});
						setDragged(null);
					}}
				><span>⠿</span><b>{index + 1}</b><strong>{recordLabel(definition.resource, record)}</strong><button type='button' onClick={() => setSelected((current) => current.filter((id) => id !== record._id))} aria-label={`Remove ${recordLabel(definition.resource, record)}`}>×</button></div>)}
			</div>
			{selected.length === 0 ? <p className='form-error'>Choose at least one record for this homepage section.</p> : null}
			{error ? <p className='form-error' role='alert'>{error}</p> : null}
		</div>
		<div className='form-actions'><button className='secondary-button' type='button' onClick={onClose}>Cancel</button><button className='primary-button' type='button' disabled={!dirty || !selected.length || isSaving} onClick={() => void onSave(definition, selected)}>{isSaving ? 'Saving…' : 'Save selection'}</button></div>
	</aside>;
}

export function EditorPanel(props: Props) {
	if (props.selection.kind === 'homepage') {
		return <HomepageSelectionEditor key={`${props.selection.definition.resource}:${props.data.contents.length}`} definition={props.selection.definition} data={props.data} isSaving={props.isSaving} error={props.error} onClose={props.onClose} onSave={props.onSaveHomepage} />;
	}
	const selection = props.selection;
	const record = props.data[selection.resource].find((item) => item._id === selection.id);
	if (!record) return <aside className='editor-panel panel-message'>That record is no longer available.</aside>;
	return <RecordEditor key={`${selection.resource}:${record._id}:${record.updatedAt || ''}`} resource={selection.resource} record={record} schema={props.schemas[selection.resource]} data={props.data} isSaving={props.isSaving} error={props.error} onClose={props.onClose} onSave={props.onSaveRecord} onDraftChange={props.onDraftChange} />;
}
