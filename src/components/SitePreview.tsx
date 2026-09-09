'use client';

/* eslint-disable @next/next/no-img-element -- CMS URLs are arbitrary and this editor must preview them without a deployment-time host allowlist. */

import { useMemo, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { AboutPreview } from './AboutPreview';

const RichTextPreview = dynamic(() => import('./RichTextPreview'), { ssr: false });
import {
	HOMEPAGE_COLLECTIONS,
	PAGE_LAYOUTS,
	RESOURCE_CONFIGS,
	isResourceName,
	recordLabel,
	recordSlug,
	prioritySorted,
	visibleRecords,
	type EditorRecord,
	type HomepageCollection,
	type PageBlock,
	type ResourceName,
	type ResourcePermissionMap,
	type WorkspaceData,
} from '@/lib/resources';

type Props = {
	activePath: string;
	data: WorkspaceData;
	selectionKey: string;
	permissions: ResourcePermissionMap;
	onSelectRecord: (resource: ResourceName, id: string) => void;
	onSelectHomepage: (definition: HomepageCollection) => void;
	onReorder: (resource: ResourceName, orderedIds: string[]) => Promise<void>;
	onCreateRecord: (resource: ResourceName) => void;
	onOpenPriority: (resource: ResourceName) => void;
};

type SelectHandler = Props['onSelectRecord'];

type EditableTargetProps = {
	resource: ResourceName;
	record: EditorRecord;
	selectionKey: string;
	onSelect: SelectHandler;
	children: ReactNode;
	className?: string;
	drag?: {
		onDragStart: () => void;
		onDrop: () => void;
	};
};

// ── value helpers ────────────────────────────────────────────────────

function value(record: EditorRecord | undefined, key: string, fallback = ''): string {
	const candidate = record?.[key];
	return typeof candidate === 'string' && candidate.trim() ? candidate : fallback;
}

function stringList(record: EditorRecord | undefined, key: string): string[] {
	const candidate = record?.[key];
	return Array.isArray(candidate) ? candidate.filter((item): item is string => typeof item === 'string') : [];
}

function objectList(record: EditorRecord | undefined, key: string): Array<Record<string, unknown>> {
	const candidate = record?.[key];
	return Array.isArray(candidate)
		? candidate.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
		: [];
}

function cleanText(input: unknown): string {
	if (typeof input !== 'string') return '';
	return input.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Several fields arrive as newline-separated blobs the frontend splits before rendering. */
function lines(input: string): string[] {
	return input.split('\n').map((line) => line.trim()).filter(Boolean);
}

/** Renders a multi-line heading the way the frontend does — one <br> per newline. */
function MultilineHeading({ text, fallback }: { text: string; fallback?: string }) {
	const parts = lines(text || fallback || '');
	if (!parts.length) return null;
	return <>{parts.map((line, index) => <span key={index}>{line}{index < parts.length - 1 ? <br /> : null}</span>)}</>;
}

/** `btnText`/`url` are comma-separated and zipped by index across the site. */
function buttonPairs(record: EditorRecord | undefined): Array<{ label: string; href: string }> {
	const labels = value(record, 'btnText').split(',').map((item) => item.trim()).filter(Boolean);
	const urls = value(record, 'url').split(',').map((item) => item.trim());
	return labels.map((label, index) => ({ label, href: urls[index] || '' }));
}

function countryName(raw: string): string {
	const parts = String(raw || '').split(',');
	return (parts[parts.length - 1] || '').trim();
}

function selectionKey(resource: ResourceName, id: string): string {
	return `record:${resource}:${id}`;
}

// ── editing chrome ───────────────────────────────────────────────────

function EditableTarget({
	resource,
	record,
	selectionKey: currentSelection,
	onSelect,
	children,
	className = '',
	drag,
}: EditableTargetProps) {
	const label = `${resource} · ${recordSlug(resource, record)}`;
	const isSelected = currentSelection === selectionKey(resource, record._id);
	return (
		<div
			className={`editable-target ${isSelected ? 'is-selected' : ''} ${record.isVisible === false ? 'is-hidden-content' : ''} ${className}`}
			data-editor-label={label}
			onDragOver={drag ? (event) => event.preventDefault() : undefined}
			onDrop={drag ? (event) => {
				event.preventDefault();
				event.stopPropagation();
				drag.onDrop();
			} : undefined}
		>
			{drag ? (
				<span
					className='drag-handle'
					draggable
					role='button'
					tabIndex={-1}
					aria-label={`Drag to reorder ${recordLabel(resource, record)}`}
					onClick={(event) => event.stopPropagation()}
					onDragStart={(event) => {
						event.stopPropagation();
						event.dataTransfer.effectAllowed = 'move';
						event.dataTransfer.setData('text/plain', record._id);
						drag.onDragStart();
					}}
				>
					<span aria-hidden='true'>⠿</span>
				</span>
			) : null}
			<button
				type='button'
				className='editable-hit-area'
				aria-label={`Edit ${label}`}
				onClick={(event) => {
					event.preventDefault();
					event.stopPropagation();
					onSelect(resource, record._id);
				}}
			/>
			{record.isVisible === false ? <span className='hidden-badge'>Hidden</span> : null}
			{children}
		</div>
	);
}

/** Wraps a section in an EditableTarget only when the Content row backing it exists. */
function Editable({
	record,
	selectionKey: currentSelection,
	onSelect,
	className,
	children,
}: {
	record?: EditorRecord;
	selectionKey: string;
	onSelect: SelectHandler;
	className?: string;
	children: ReactNode;
}) {
	if (!record) return <>{children}</>;
	return (
		<EditableTarget resource='contents' record={record} selectionKey={currentSelection} onSelect={onSelect} className={className}>
			{children}
		</EditableTarget>
	);
}

// ── icons (the frontend picks lucide icons by position) ──────────────

const Icon = ({ path, className = '' }: { path: string; className?: string }) => (
	<svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
		{path.split('|').map((segment, index) => <path d={segment} key={index} />)}
	</svg>
);

const CHECK = 'M22 11.08V12a10 10 0 1 1-5.93-9.14|m9 11 3 3L22 4';
const ARROW = 'M5 12h14m-6-6 6 6-6 6';
const PIN = 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0|M12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4';
const CLOCK = 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20|M12 6v6l4 2';
const PHONE = 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92';
const STEP_ICONS = [
	'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
	'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2|M9 2h6v4H9z',
	'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|m9 15 2 2 4-4',
	'M22 10 12 5 2 10l10 5 10-5z|M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5',
	'M17.8 19.2 16 11l3.5-3.5a2.1 2.1 0 0 0-3-3L13 8 4.8 6.2a1 1 0 0 0-.9 1.7l6 3.4-2.6 2.6-2.6-.6a1 1 0 0 0-.9 1.7L6 17l1 2.4a1 1 0 0 0 1.7-.9l-.6-2.6 2.6-2.6 3.4 6a1 1 0 0 0 1.7-.9z',
];
const FEATURE_ICONS = [
	'm9 12 2 2 4-4|M12 3 4 7v6c0 4.4 3.4 8.5 8 9 4.6-.5 8-4.6 8-9V7z',
	'M12 2 15 8l7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z',
	'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2|M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8|M22 21v-2a4 4 0 0 0-3-3.87',
	'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20|M2 12h20|M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20',
	'M20.4 4.6a5.4 5.4 0 0 0-7.6 0L12 5.4l-.8-.8a5.4 5.4 0 0 0-7.6 7.6l8.4 8.4 8.4-8.4a5.4 5.4 0 0 0 0-7.6z',
	'M12 3 4 7v6c0 4.4 3.4 8.5 8 9 4.6-.5 8-4.6 8-9V7z',
];

// ── site shell ───────────────────────────────────────────────────────

function SiteHeader({ data, selectionKey: currentSelection, onSelect }: Pick<Props, 'data' | 'selectionKey'> & { onSelect: SelectHandler }) {
	const logo = data.contents.find((record) => record.slug === 'logo');
	const topbar = data.contents.find((record) => record.slug === '/topbar');

	const topbarRow = (
		<div className='site-topbar'>
			<p>{value(topbar, 'content', "Bangladesh's #1 Study Abroad Consultancy · Est. 2022")}</p>
			<div>
				<span><Icon path={PHONE} />{value(topbar, 'phone', '+880 1701294451')}</span>
				<b>{value(topbar, 'subContent', 'WhatsApp Us →')}</b>
			</div>
		</div>
	);

	const brand = (
		<div className='site-brand'>
			{value(logo, 'image') ? <img src={value(logo, 'image')} alt='' /> : <span className='site-logo-mark'>AGS</span>}
			<span><strong>{value(logo, 'content', 'AGS')}</strong><small>{value(logo, 'subContent', 'Akashbari Global Services')}</small></span>
		</div>
	);

	return (
		<header className='site-header'>
			<Editable record={topbar} selectionKey={currentSelection} onSelect={onSelect} className='topbar-edit-target'>{topbarRow}</Editable>
			<div className='site-navbar'>
				<Editable record={logo} selectionKey={currentSelection} onSelect={onSelect} className='logo-edit-target'>{brand}</Editable>
				<nav aria-label='Preview navigation'>
					{['Countries', 'Universities', 'Find My Fit', 'Services', 'About', 'FAQ', 'Contact'].map((item) => (
						<button type='button' className='dummy-link' key={item} title='Navigation is disabled inside the editor'>{item}</button>
					))}
				</nav>
				<button type='button' className='site-cta dummy-link' title='Links are disabled inside the editor'>Apply Now</button>
			</div>
		</header>
	);
}

/** Footer.tsx reads `footer-left.list` as a fixed 7-slot array. */
const FOOTER_SLOTS = ['Phone', 'Email', 'Address', 'Facebook', 'Instagram', 'LinkedIn', 'WhatsApp'];

function SiteFooter({ data, selectionKey: currentSelection, onSelect }: Pick<Props, 'data' | 'selectionKey'> & { onSelect: SelectHandler }) {
	const footer = data.contents.find((record) => record.slug === 'footer-left');
	const logo = data.contents.find((record) => record.slug === 'logo');
	const contact = stringList(footer, 'list');
	const offices = objectList(footer, 'card');

	const content = (
		<div className='site-footer-inner'>
			<div className='footer-brand'>
				<div className='footer-logo'>
					{value(logo, 'image') ? <img src={value(logo, 'image')} alt='' /> : <span className='site-logo-mark'>AGS</span>}
					<span><strong>{value(logo, 'content', 'AGS')}</strong><small>{value(logo, 'subContent', 'Akashbari Global Services')}</small></span>
				</div>
				<p>{value(footer, 'subContent', 'Expert guidance for your study abroad journey, from application to arrival.')}</p>
				<ul className='footer-contact'>
					{FOOTER_SLOTS.map((slot, index) => contact[index]?.trim() ? (
						<li key={slot}><em>{slot}</em><span>{contact[index]}</span></li>
					) : null)}
				</ul>
			</div>
			<div className='footer-links'>
				<h4>Services</h4>
				{['Admission Guidance', 'Visa Processing', 'Scholarships', 'Pre-departure'].map((item) => <span key={item}>{item}</span>)}
			</div>
			<div className='footer-links'>
				<h4>Destinations</h4>
				{['United Kingdom', 'Canada', 'Australia', 'Malaysia'].map((item) => <span key={item}>{item}</span>)}
			</div>
			<div className='footer-links'>
				<h4>Offices</h4>
				{offices.length
					? offices.map((office, index) => (
						<span key={String(office._id || index)}><b>{String(office.title || '')}</b>{lines(String(office.description || ''))[0] || ''}</span>
					))
					: <span>Add office cards to `footer-left`</span>}
			</div>
		</div>
	);

	return (
		<footer className='site-footer'>
			<Editable record={footer} selectionKey={currentSelection} onSelect={onSelect}>{content}</Editable>
			<div className='site-copyright'>© {new Date().getFullYear()} Akashbari Global Services. All rights reserved.</div>
		</footer>
	);
}

// ── home sections ────────────────────────────────────────────────────

function HeroCarousel({ records, selectionKey: currentSelection, onSelect, onReorder }: {
	records: EditorRecord[];
	selectionKey: string;
	onSelect: SelectHandler;
	onReorder: Props['onReorder'];
}) {
	const ordered = visibleRecords(records);
	const [dragged, setDragged] = useState<string | null>(null);
	const first = ordered[0];
	if (!first) return null;
	const image = value(first, 'image').replace(/&quot;?$/i, '').trim();
	const buttons = buttonPairs(first);

	return (
		<section className='home-hero' style={image ? { backgroundImage: `url("${image.replace(/"/g, '%22')}")` } : undefined}>
			<div className='home-hero-scrim' />
			<EditableTarget resource='banners' record={first} selectionKey={currentSelection} onSelect={onSelect} className='hero-primary-target'>
				<div className='site-container hero-copy'>
					{value(first, 'content') ? <p className='hero-eyebrow'>{value(first, 'content')}</p> : null}
					<h1><MultilineHeading text={value(first, 'name')} fallback='Study Abroad, Done Right.' /></h1>
					{value(first, 'subContent') ? <p className='hero-sub'>{value(first, 'subContent')}</p> : null}
					<div className='hero-buttons'>
						{(buttons.length ? buttons : [{ label: 'Book Free Consultation', href: '' }]).map((button, index) => (
							<button type='button' key={`${button.label}-${index}`} className={index === 0 ? 'btn-accent dummy-link' : 'btn-ghost dummy-link'}>
								{button.label}{index === 0 ? <Icon path={ARROW} /> : null}
							</button>
						))}
					</div>
				</div>
			</EditableTarget>

			<div className='hero-slides' aria-label='Hero banners'>
				{ordered.map((banner, index) => (
					<EditableTarget
						key={banner._id}
						resource='banners'
						record={banner}
						selectionKey={currentSelection}
						onSelect={onSelect}
						className='hero-slide-target'
						drag={{
							onDragStart: () => setDragged(banner._id),
							onDrop: () => {
								if (!dragged || dragged === banner._id) return;
								const ids = ordered.map((item) => item._id);
								const from = ids.indexOf(dragged);
								const to = ids.indexOf(banner._id);
								if (from < 0 || to < 0) return;
								ids.splice(to, 0, ids.splice(from, 1)[0]);
								setDragged(null);
								void onReorder('banners', ids);
							},
						}}
					>
						<div className={`hero-slide ${index === 0 ? 'is-active' : ''}`}>
							<span>{String(index + 1).padStart(2, '0')}</span>
							<strong>{recordLabel('banners', banner)}</strong>
						</div>
					</EditableTarget>
				))}
			</div>
			<div className='hero-counter'>01 / {String(ordered.length).padStart(2, '0')}</div>
		</section>
	);
}

function StatsStrip({ record, selectionKey: currentSelection, onSelect }: { record?: EditorRecord; selectionKey: string; onSelect: SelectHandler }) {
	const stats = objectList(record, 'card').filter((card) => card.title);
	if (!stats.length) return null;
	return (
		<Editable record={record} selectionKey={currentSelection} onSelect={onSelect} className='section-target'>
			<section className='stats-strip'>
				<div className='site-container'>
					<div className='stats-grid'>
						{stats.map((stat, index) => (
							<div key={String(stat._id || index)}>
								<p>{String(stat.title || '')}</p>
								<small>{String(stat.description || '')}</small>
							</div>
						))}
					</div>
				</div>
			</section>
		</Editable>
	);
}

function HowItWorks({ record, selectionKey: currentSelection, onSelect }: { record?: EditorRecord; selectionKey: string; onSelect: SelectHandler }) {
	const steps = objectList(record, 'card');
	return (
		<Editable record={record} selectionKey={currentSelection} onSelect={onSelect} className='section-target'>
			<section className='site-section section-tint'>
				<div className='site-container'>
					<div className='section-heading-centred'>
						<p className='label-tag'>{value(record, 'section', 'How it works')}</p>
						<h2><MultilineHeading text={value(record, 'content')} fallback='Your Journey, Step by Step' /></h2>
						{lines(value(record, 'subContent')).map((line, index) => <p className='section-sub' key={index}>{line}</p>)}
					</div>
					<div className='process-grid'>
						{steps.map((step, index) => {
							const title = String(step.title || '');
							const match = title.match(/^(\d+)\s+(.*)$/);
							const number = match ? match[1] : String(index + 1).padStart(2, '0');
							const label = match ? match[2] : title;
							return (
								<div className='process-step' key={String(step._id || index)}>
									{index < steps.length - 1 ? <i className='process-connector' /> : null}
									<span className='process-icon'><Icon path={STEP_ICONS[index % STEP_ICONS.length]} /></span>
									<div className='process-title'><b>{number}</b><h3>{label}</h3></div>
									<p>{String(step.description || '')}</p>
								</div>
							);
						})}
					</div>
					{value(record, 'btnText') ? (
						<div className='section-footer-cta'><button type='button' className='btn-primary dummy-link'>{value(record, 'btnText').split(',')[0]}</button></div>
					) : null}
				</div>
			</section>
		</Editable>
	);
}

function AffiliationsMarquee({ record, universities, selectionKey: currentSelection, onSelect }: {
	record?: EditorRecord;
	universities: EditorRecord[];
	selectionKey: string;
	onSelect: SelectHandler;
}) {
	const list = visibleRecords(universities);
	if (!list.length) return null;
	const half = Math.ceil(list.length / 2);
	const rows = [list.slice(0, half), list.slice(half)];
	return (
		<section className='affiliations'>
			<Editable record={record} selectionKey={currentSelection} onSelect={onSelect} className='affiliations-heading-target'>
				<p className='affiliations-heading'>{value(record, 'content', `Our ${list.length}+ University Partners & Institutions`)}</p>
			</Editable>
			{rows.map((row, rowIndex) => (
				<div className='affiliation-row' key={rowIndex}>
					{row.map((uni) => (
						<div className='affiliation-chip' key={uni._id}>
							<span>{recordLabel('universities', uni).charAt(0)}</span>
							<b>{recordLabel('universities', uni)}</b>
							{value(uni, 'countryName', countryName(value(uni, 'country'))) ? <small>{value(uni, 'countryName', countryName(value(uni, 'country')))}</small> : null}
							{uni.isPartner ? <em>Partner</em> : null}
						</div>
					))}
				</div>
			))}
		</section>
	);
}

function FinderTeaser({ record, matches, selectionKey: currentSelection, onSelect }: {
	record?: EditorRecord;
	matches?: EditorRecord;
	selectionKey: string;
	onSelect: SelectHandler;
}) {
	const benefits = stringList(record, 'list');
	const previews = objectList(matches, 'card');
	return (
		<section className='site-section finder-teaser'>
			<div className='site-container split-grid'>
				<Editable record={record} selectionKey={currentSelection} onSelect={onSelect} className='section-target'>
					<div className='finder-copy'>
						<p className='label-tag'>{value(record, 'content', 'University Finder')}</p>
						<h2>{value(record, 'name', 'Find Your Perfect University Match')}</h2>
						<p className='section-sub'>{value(record, 'subContent')}</p>
						<ul className='check-list'>
							{benefits.map((item, index) => <li key={index}><Icon path={CHECK} />{item}</li>)}
						</ul>
						<button type='button' className='btn-dark dummy-link'>Find My University Match<Icon path={ARROW} /></button>
					</div>
				</Editable>
				<Editable record={matches} selectionKey={currentSelection} onSelect={onSelect} className='section-target'>
					<div className='finder-quiz'>
						<div className='finder-quiz-card'>
							<div className='finder-step-row'>
								<span>Step 1 of 4</span>
								<div>{[0, 1, 2, 3].map((index) => <i key={index} className={index === 0 ? 'is-active' : ''} />)}</div>
							</div>
							<h3>What level do you want to study?</h3>
							<div className='finder-options'>
								{["Bachelor's", "Master's", 'PhD', 'Foundation'].map((level, index) => (
									<span key={level} className={index === 1 ? 'is-selected' : ''}>{level}</span>
								))}
							</div>
							<div className='finder-matches'>
								<span>Top matches for Master&apos;s</span>
								{previews.map((card, index) => (
									<div key={String(card._id || index)}>
										<b>{String(card.subTitle || '')} {String(card.title || '')}</b>
										<em>{String(card.description || '')}% match</em>
									</div>
								))}
							</div>
							<button type='button' className='btn-accent full dummy-link'>Start the Quiz<Icon path={ARROW} /></button>
						</div>
						<div className='finder-badge'><Icon path={CLOCK} /> 2 min quiz</div>
					</div>
				</Editable>
			</div>
		</section>
	);
}

function VideoSection({ record, selectionKey: currentSelection, onSelect }: { record?: EditorRecord; selectionKey: string; onSelect: SelectHandler }) {
	if (!record || record.isVisible === false) return null;
	const link = stringList(record, 'list')[0] || '';
	return (
		<Editable record={record} selectionKey={currentSelection} onSelect={onSelect} className='section-target'>
			<section className='video-section'>
				<div className='video-container'>
					<div className='section-heading-centred'>
						{value(record, 'section') ? <p className='label-tag on-dark'>{value(record, 'section')}</p> : null}
						<h2>{value(record, 'content')}</h2>
						{value(record, 'subContent') ? <p className='section-sub on-dark'>{value(record, 'subContent')}</p> : null}
					</div>
					<div className='video-frame'>
						<span>▶</span>
						<small>{link || 'Add a YouTube link to the list field'}</small>
					</div>
					{value(record, 'btnText') ? (
						<div className='video-cta'>
							<p>Ready to write your own success story?</p>
							<button type='button' className='btn-accent dummy-link'>{value(record, 'btnText').split(',')[0]}</button>
						</div>
					) : null}
				</div>
			</section>
		</Editable>
	);
}

function PhotoGallery({ record, selectionKey: currentSelection, onSelect }: { record?: EditorRecord; selectionKey: string; onSelect: SelectHandler }) {
	const photos = stringList(record, 'gallery');
	return (
		<Editable record={record} selectionKey={currentSelection} onSelect={onSelect} className='section-target'>
			<section className='site-section section-tint'>
				<div className='site-container'>
					<div className='section-heading-row'>
						<div>
							<p className='label-tag'>{value(record, 'content', 'Student Life')}</p>
							<h2>{value(record, 'name', 'Life Abroad with AGS')}</h2>
						</div>
						<button type='button' className='link-cta dummy-link'>Success Stories →</button>
					</div>
					<div className='photo-mosaic'>
						{photos.map((source, index) => <div className={`mosaic-tile tile-${index % 6}`} key={`${source}-${index}`}><img src={source} alt='' /></div>)}
					</div>
				</div>
			</section>
		</Editable>
	);
}

function WhyAgs({ record, selectionKey: currentSelection, onSelect }: { record?: EditorRecord; selectionKey: string; onSelect: SelectHandler }) {
	const stats = stringList(record, 'list');
	const cards = objectList(record, 'card');
	if (!stats.length && !cards.length) return null;
	return (
		<Editable record={record} selectionKey={currentSelection} onSelect={onSelect} className='section-target'>
			<section className='site-section'>
				<div className='site-container why-grid'>
					<div className='why-intro'>
						<p className='label-tag'>{value(record, 'content')}</p>
						<h2>{value(record, 'name', 'Why 500+ Students Chose Us')}</h2>
						<p className='section-sub'>{value(record, 'subContent')}</p>
						<div className='why-stats'>
							{stats.map((entry, index) => {
								const parts = lines(entry);
								return <div key={`${entry}-${index}`}><p>{parts[0] || ''}</p><small>{parts[1] || ''}</small></div>;
							})}
						</div>
					</div>
					<div className='why-features'>
						{cards.map((card, index) => (
							<div className='why-feature' key={String(card._id || index)}>
								<span><Icon path={FEATURE_ICONS[index % FEATURE_ICONS.length]} /></span>
								<div><h4>{String(card.title || '')}</h4><p>{String(card.description || '')}</p></div>
							</div>
						))}
					</div>
				</div>
			</section>
		</Editable>
	);
}

function LocationsSection({ record, selectionKey: currentSelection, onSelect }: { record?: EditorRecord; selectionKey: string; onSelect: SelectHandler }) {
	const offices = objectList(record, 'card');
	if (!offices.length) return null;
	return (
		<Editable record={record} selectionKey={currentSelection} onSelect={onSelect} className='section-target'>
			<section className='site-section'>
				<div className='site-container'>
					<div className='section-heading-row'>
						<div>
							<p className='label-tag'>{value(record, 'section')}</p>
							<h2><MultilineHeading text={value(record, 'content')} fallback='Visit Us' /></h2>
							<p className='section-sub'>{value(record, 'subContent')}</p>
						</div>
					</div>
					<div className='office-grid'>
						{offices.map((office, index) => {
							const parts = lines(String(office.description || ''));
							const title = String(office.title || '');
							return (
								<div className={`office-card ${title.toLowerCase().includes('head office') ? 'is-head' : ''}`} key={String(office._id || index)}>
									{title.toLowerCase().includes('head office') ? <span className='office-badge'>Head Office</span> : null}
									<h3>{title}</h3>
									<div className='office-line'><Icon path={PIN} /><span>{parts[0] || ''}</span></div>
									<div className='office-line'><Icon path={PHONE} /><span>{parts[1] || ''}</span></div>
									<div className='office-line'><Icon path={CLOCK} /><span>{parts[2] || ''}</span></div>
									{parts[3] ? <button type='button' className='link-cta dummy-link'>Get Directions ↗</button> : null}
								</div>
							);
						})}
					</div>
				</div>
			</section>
		</Editable>
	);
}

function FinalCta({ record, selectionKey: currentSelection, onSelect }: { record?: EditorRecord; selectionKey: string; onSelect: SelectHandler }) {
	const buttons = buttonPairs(record);
	const signals = stringList(record, 'list');
	return (
		<Editable record={record} selectionKey={currentSelection} onSelect={onSelect} className='section-target'>
			<section className='final-cta'>
				<div className='cta-container'>
					<span className='cta-eyebrow'>{value(record, 'section')}</span>
					<h2><MultilineHeading text={value(record, 'content')} fallback='Your Study Abroad Journey Starts Here.' /></h2>
					<p>{value(record, 'subContent')}</p>
					<div className='cta-buttons'>
						{buttons.map((button, index) => (
							<button type='button' key={`${button.label}-${index}`} className={index === 0 ? 'btn-accent dummy-link' : 'btn-ghost dummy-link'}>
								{button.label}{index === 0 ? <Icon path={ARROW} /> : null}
							</button>
						))}
					</div>
					{signals.length ? <div className='cta-signals'>{signals.map((signal, index) => <span key={index}>{signal}</span>)}</div> : null}
				</div>
			</section>
		</Editable>
	);
}

// ── record cards (collection grids) ──────────────────────────────────

function RecordCard({ resource, record }: { resource: ResourceName; record: EditorRecord }) {
	const imageField = RESOURCE_CONFIGS[resource].imageField;
	const image = imageField ? value(record, imageField) : '';
	const description = cleanText(record[RESOURCE_CONFIGS[resource].subtitleField || 'description']);

	if (resource === 'universities') {
		const country = value(record, 'countryName', countryName(value(record, 'country')));
		const tuition = value(record, 'minTuitionCostUsd', value(record, 'tuitionRange', 'N/A')).split(/[-–]/)[0].trim();
		return <div className='record-card university-card'>
			<div className='university-cover' style={image ? { backgroundImage: `url("${image.replace(/"/g, '%22')}")` } : undefined}>
				<div className='cover-scrim' />
				<div className='cover-badges'>
					{record.isPartner ? <span className='badge-solid'>AGS Partner</span> : null}
					{value(record, 'qsWorldRanking') ? <span className='badge-light'>QS #{value(record, 'qsWorldRanking')}</span> : null}
				</div>
				<p className='cover-country'><Icon path={PIN} />{country}</p>
			</div>
			<div className='university-body'>
				<h3>{recordLabel(resource, record)}</h3>
				<div className='card-stats three'>
					<span><small>IELTS</small><b>{value(record, 'minIelts', 'N/A')}</b></span>
					<span><small>Success</small><b>{value(record, 'agsSuccess', 'N/A')}</b></span>
					<span><small>From</small><b>{tuition || 'N/A'}</b></span>
				</div>
			</div>
		</div>;
	}

	if (resource === 'countries') {
		const success = value(record, 'agsSuccess', value(record, 'visaSuccessRate') ? `${value(record, 'visaSuccessRate')}%` : '');
		return <div className='record-card country-card'>
			<div>
				<h3>{recordLabel(resource, record)}</h3>
				<p>{cleanText(record.whyStudyShortDescription) || description}</p>
			</div>
			{success ? <span className='country-pill'>{success} visa success</span> : null}
		</div>;
	}

	if (resource === 'courses') {
		return <div className='record-card course-card'>
			<span className='card-badge'>{value(record, 'level', 'Course')}</span>
			<h3>{recordLabel(resource, record)}</h3>
			<p className='card-accent'>{value(record, 'universityName', 'Partner University')}</p>
			<p className='card-muted'><Icon path={PIN} />{countryName(value(record, 'country')) || 'Global'}</p>
			<div className='card-stats'>
				<span><small>Duration</small><b>{value(record, 'duration', 'N/A')}</b></span>
				<span><small>Tuition/yr</small><b>{value(record, 'tuitionPerYear', 'N/A')}</b></span>
			</div>
			<div className='card-footer'><span>IELTS <b>{value(record, 'minIelts', 'N/A')}</b></span><button type='button' className='dummy-link'>View course →</button></div>
		</div>;
	}

	if (resource === 'services') {
		return <div className='record-card service-card'>
			<div className='service-stripe' />
			<span className='card-step'>{value(record, 'section', 'AGS SERVICE')}</span>
			<h3>{recordLabel(resource, record)}</h3>
			<p>{description || value(record, 'content')}</p>
			<ul>{objectList(record, 'whatWeProvideCards').slice(0, 3).map((card, index) => <li key={String(card._id || index)}><Icon path={CHECK} />{String(card.title || card.description || '')}</li>)}</ul>
			<button type='button' className='link-cta dummy-link'>Learn More →</button>
		</div>;
	}

	if (resource === 'successstories' || resource === 'reviews') {
		return <div className='record-card story-card'>
			<div className='stars'>★★★★★</div>
			<p>“{description || value(record, 'message')}”</p>
			<div className='story-person'>
				{image ? <img src={image} alt='' /> : <div className='story-avatar'>{recordLabel(resource, record).charAt(0)}</div>}
				<div><h3>{recordLabel(resource, record)}</h3><small>{value(record, 'universityName', value(record, 'location'))}</small></div>
			</div>
		</div>;
	}

	if (resource === 'blogposts' || resource === 'gallerys') {
		return <div className='record-card media-card'>
			{image ? <img src={image} alt='' /> : <div className='media-placeholder'>AGS</div>}
			<div>
				<span className='card-step'>{value(record, 'category', resource === 'blogposts' ? 'Insights' : 'Gallery')}</span>
				<h3>{recordLabel(resource, record)}</h3>
				<p>{description}</p>
			</div>
		</div>;
	}

	if (resource === 'teams' || resource === 'partners') {
		return <div className='record-card person-card'>
			{image ? <img src={image} alt='' /> : <div className='story-avatar'>{recordLabel(resource, record).charAt(0)}</div>}
			<h3>{recordLabel(resource, record)}</h3>
			<p>{description || value(record, 'designation')}</p>
		</div>;
	}

	if (resource === 'faqs') {
		// A FAQ group's `list` is [{ title, description }] — the questions.
		const questions = objectList(record, 'list');
		return <div className='record-card faq-card'>
			<h3>{recordLabel(resource, record)}</h3>
			<span className='faq-count'>{questions.length} question{questions.length === 1 ? '' : 's'}</span>
			{questions.slice(0, 4).map((item, index) => <p key={String(item._id || index)}>{String(item.title || item.description || '')}</p>)}
		</div>;
	}

	return <div className='record-card generic-card'><h3>{recordLabel(resource, record)}</h3><p>{description}</p></div>;
}

function CollectionSection({
	resource,
	records,
	selectionKey: currentSelection,
	onSelect,
	onReorder,
	onCreate,
	onOpenPriority,
	canCreate,
	title,
	eyebrow,
	subtitle,
	tint = true,
}: {
	resource: ResourceName;
	records: EditorRecord[];
	selectionKey: string;
	onSelect: SelectHandler;
	onReorder: Props['onReorder'];
	onCreate?: Props['onCreateRecord'];
	onOpenPriority?: Props['onOpenPriority'];
	canCreate?: boolean;
	title?: string;
	eyebrow?: string;
	subtitle?: string;
	tint?: boolean;
}) {
	const ordered = useMemo(() => prioritySorted(records), [records]);
	const [dragged, setDragged] = useState<string | null>(null);
	const addLabel = `+ Add ${RESOURCE_CONFIGS[resource].singular}`;
	return (
		<section className={`site-section ${tint ? 'section-tint' : ''} collection-section`}>
			<div className='site-container'>
				<div className='section-heading-row'>
					<div>
						<p className='label-tag'>{eyebrow || RESOURCE_CONFIGS[resource].label}</p>
						<h2>{title || `Explore ${RESOURCE_CONFIGS[resource].label}`}</h2>
						<p className='section-sub'>{subtitle || 'Click a card to edit it, drag its handle to reorder, or use Arrange order.'}</p>
					</div>
					<div className='collection-actions'>
						<span className='record-count'>{ordered.length} records</span>
						{onOpenPriority ? <button type='button' className='secondary-button' onClick={() => onOpenPriority(resource)}>Arrange order</button> : null}
						{onCreate && canCreate ? <button type='button' className='primary-button' onClick={() => onCreate(resource)}>{addLabel}</button> : null}
					</div>
				</div>
				{ordered.length ? (
					<div className={`records-grid records-${resource}`}>
						{ordered.map((record) => (
							<EditableTarget
								key={record._id}
								resource={resource}
								record={record}
								selectionKey={currentSelection}
								onSelect={onSelect}
								className='record-card-target'
								drag={{
									onDragStart: () => setDragged(record._id),
									onDrop: () => {
										if (!dragged || dragged === record._id) return;
										const ids = ordered.map((item) => item._id);
										const from = ids.indexOf(dragged);
										const to = ids.indexOf(record._id);
										if (from < 0 || to < 0) return;
										ids.splice(to, 0, ids.splice(from, 1)[0]);
										setDragged(null);
										void onReorder(resource, ids);
									},
								}}
							>
								<RecordCard resource={resource} record={record} />
							</EditableTarget>
						))}
					</div>
				) : <div className='empty-collection'>
					<p>No {RESOURCE_CONFIGS[resource].label.toLowerCase()} yet.</p>
					{onCreate && canCreate ? <button type='button' className='primary-button' onClick={() => onCreate(resource)}>{addLabel}</button> : null}
				</div>}
			</div>
		</section>
	);
}

/**
 * The homepage's curated university/country rails. Unlike a collection page
 * these render the selection stored on the Content row's `list` field, with a
 * button that opens the picker.
 */
function HomepageCollectionSection({ definition, data, selectionKey: currentSelection, onSelect, onManage }: {
	definition: HomepageCollection;
	data: WorkspaceData;
	selectionKey: string;
	onSelect: SelectHandler;
	onManage: Props['onSelectHomepage'];
}) {
	const content = data.contents.find((record) => record.slug === definition.contentSlug);
	const storedIds = stringList(content, 'list');
	const available = prioritySorted(data[definition.resource]);
	const records = storedIds.length
		? storedIds.map((id) => available.find((record) => record._id === id)).filter((record): record is EditorRecord => Boolean(record))
		: available.filter((record) => record.isVisible !== false && record.isActive !== false).slice(0, definition.defaultLimit);

	const eyebrow = definition.resource === 'countries'
		? `${data.countries.length} ${value(content, 'section', 'Destinations')}`
		: value(content, 'content', definition.label);

	return (
		<section className={`site-section ${definition.resource === 'countries' ? '' : 'section-tint'}`}>
			<div className='site-container'>
				<div className='section-heading-row'>
					<Editable record={content} selectionKey={currentSelection} onSelect={onSelect} className='section-heading-edit-target'>
						<div>
							<p className='label-tag'>{eyebrow}</p>
							<h2><MultilineHeading text={value(content, definition.headingField)} fallback={definition.defaultName} /></h2>
							{value(content, 'subContent') ? <p className='section-sub'>{value(content, 'subContent')}</p> : null}
						</div>
					</Editable>
					<button type='button' className='manage-selection-button' onClick={(event) => { event.stopPropagation(); onManage(definition); }}>Choose &amp; order</button>
				</div>
				<div className={`records-grid records-${definition.resource} homepage-records`}>
					{records.map((record) => (
						<EditableTarget key={record._id} resource={definition.resource} record={record} selectionKey={currentSelection} onSelect={onSelect} className='record-card-target'>
							<RecordCard resource={definition.resource} record={record} />
						</EditableTarget>
					))}
				</div>
				<div className='section-footer-cta'>
					<button type='button' className='btn-outline dummy-link'>{value(content, 'btnText', `View All ${RESOURCE_CONFIGS[definition.resource].label}`).split(',')[0]}</button>
				</div>
			</div>
		</section>
	);
}

// ── inner-page section renderers ─────────────────────────────────────

/** The dark banner every inner page opens with. */
function PageHero({ record, fallbackTitle, showCards = true, selectionKey: currentSelection, onSelect }: {
	record?: EditorRecord;
	fallbackTitle: string;
	showCards?: boolean;
	selectionKey: string;
	onSelect: SelectHandler;
}) {
	const cards = showCards ? objectList(record, 'card') : [];
	const benefits = stringList(record, 'list');
	const hasSplit = Boolean(benefits.length || cards.length);
	return (
		<Editable record={record} selectionKey={currentSelection} onSelect={onSelect} className='section-target'>
			<section className={`page-hero ${hasSplit ? 'is-split' : ''}`}>
				<div className='site-container'>
					<div className={hasSplit ? 'page-hero-grid' : ''}>
						<div className='page-hero-copy'>
							{value(record, 'section') ? <span className='hero-pill'>{value(record, 'section')}</span> : null}
							<h1><MultilineHeading text={value(record, 'content') || value(record, 'name')} fallback={fallbackTitle} /></h1>
							{value(record, 'subContent') ? <p>{value(record, 'subContent')}</p> : null}
							{value(record, 'description') ? <RichTextPreview html={value(record, 'description')} /> : null}
							{benefits.length ? (
								<ul className='check-list on-dark'>{benefits.map((item, index) => <li key={index}><Icon path={CHECK} />{item}</li>)}</ul>
							) : null}
						</div>
						{cards.length ? (
							<div className='hero-stat-cards'>
								{cards.map((card, index) => (
									<div className='hero-stat-card' key={String(card._id || index)}>
										{card.subTitle ? <small>{String(card.subTitle)}</small> : null}
										<p>{String(card.title || '')}</p>
										<span>{String(card.description || '')}</span>
									</div>
								))}
							</div>
						) : null}
					</div>
				</div>
			</section>
		</Editable>
	);
}

/** section + heading + optional rich body + card grid — the shape most inner-page blocks share. */
function ContentSection({ record, index, selectionKey: currentSelection, onSelect }: {
	record: EditorRecord;
	index: number;
	selectionKey: string;
	onSelect: SelectHandler;
}) {
	const slug = String(record.slug || '');
	if (slug === 'about') {
		return <Editable record={record} selectionKey={currentSelection} onSelect={onSelect} className='section-target'><AboutPreview record={record} /></Editable>;
	}

	const cards = objectList(record, 'card');
	const list = stringList(record, 'list');
	const gallery = stringList(record, 'gallery');
	const image = value(record, 'image');
	const buttons = buttonPairs(record);
	const isCta = slug === 'cta' || slug.endsWith('-cta');

	if (isCta) return <FinalCta record={record} selectionKey={currentSelection} onSelect={onSelect} />;

	return (
		<Editable record={record} selectionKey={currentSelection} onSelect={onSelect} className='section-target'>
			<section className={`site-section ${index % 2 ? 'section-tint' : ''}`}>
				<div className={`site-container ${image ? 'split-grid' : ''}`}>
					<div className='section-copy'>
						{value(record, 'section') ? <p className='label-tag'>{value(record, 'section')}</p> : null}
						<h2><MultilineHeading text={value(record, 'content') || value(record, 'name')} fallback='Content section' /></h2>
						{value(record, 'subContent') ? <p className='section-sub'>{value(record, 'subContent')}</p> : null}
						{value(record, 'description') ? <RichTextPreview html={value(record, 'description')} /> : null}
						{value(record, 'richContent') ? <RichTextPreview html={value(record, 'richContent')} /> : null}
						{list.length ? <ul className='check-list'>{list.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}><Icon path={CHECK} />{item}</li>)}</ul> : null}
						{buttons.length ? <button type='button' className='btn-primary dummy-link'>{buttons[0].label}</button> : null}
					</div>
					{image ? <div className='section-image'><img src={image} alt='' /></div> : null}
				</div>
				{cards.length ? (
					<div className='site-container feature-grid'>
						{cards.map((card, cardIndex) => (
							<div className='feature-card' key={String(card._id || cardIndex)}>
								{typeof card.image === 'string' && card.image
									? <img src={card.image} alt='' />
									: <span className='feature-index'>{String(cardIndex + 1).padStart(2, '0')}</span>}
								<h3>{String(card.title || card.subTitle || `Item ${cardIndex + 1}`)}</h3>
								<p>{String(card.description || '')}</p>
							</div>
						))}
					</div>
				) : null}
				{gallery.length ? <div className='site-container gallery-strip'>{gallery.map((source, imageIndex) => <img src={source} alt='' key={`${source}-${imageIndex}`} />)}</div> : null}
			</section>
		</Editable>
	);
}

/** The two-column "panel + form" blocks on /contact and /apply. */
function FormPanelSection({ panel, info, selectionKey: currentSelection, onSelect }: {
	panel?: EditorRecord;
	info?: EditorRecord;
	selectionKey: string;
	onSelect: SelectHandler;
}) {
	const contactLines = stringList(info, 'list');
	const offices = objectList(info, 'card');
	return (
		<section className='site-section section-tint'>
			<div className='site-container split-grid'>
				<Editable record={panel} selectionKey={currentSelection} onSelect={onSelect} className='section-target'>
					<div className='form-panel'>
						<h2>{value(panel, 'content', 'Send Us a Message')}</h2>
						<p>{value(panel, 'subContent', 'We respond within 24 hours on business days.')}</p>
						<div className='form-mock'>
							{['Full Name *', 'Email Address *', 'Phone Number', 'Subject'].map((label) => (
								<label key={label}>{label}<span /></label>
							))}
							<label className='form-mock-area'>Message<span /></label>
							<button type='button' className='btn-primary full dummy-link'>Send Message</button>
						</div>
					</div>
				</Editable>
				{info ? (
					<Editable record={info} selectionKey={currentSelection} onSelect={onSelect} className='section-target'>
						<div className='info-column'>
							{contactLines.length ? (
								<div className='info-card'>
									<h3>{value(info, 'content', 'Direct Contact')}</h3>
									{contactLines.map((item, index) => {
										const [label, ...rest] = item.split(':');
										return (
											<div className='info-line' key={index}>
												<span className='info-icon'><Icon path={PHONE} /></span>
												<div><small>{rest.length ? label.trim() : ''}</small><b>{rest.length ? rest.join(':').trim() : item}</b></div>
											</div>
										);
									})}
								</div>
							) : null}
							{offices.length ? (
								<div className='info-card'>
									<h3>{value(info, 'subContent', 'Our Offices')}</h3>
									{offices.map((office, index) => (
										<div className='info-office' key={String(office._id || index)}>
											<b><Icon path={PIN} />{String(office.title || '')}</b>
											{lines(String(office.description || '')).map((line, lineIndex) => <span key={lineIndex}>{line}</span>)}
										</div>
									))}
								</div>
							) : null}
						</div>
					</Editable>
				) : null}
			</div>
		</section>
	);
}

/** /finder's step cards and /eligibility's quiz shell. */
function StepsSection({ record, selectionKey: currentSelection, onSelect, title }: {
	record?: EditorRecord;
	selectionKey: string;
	onSelect: SelectHandler;
	title: string;
}) {
	const steps = objectList(record, 'card');
	return (
		<Editable record={record} selectionKey={currentSelection} onSelect={onSelect} className='section-target'>
			<section className='site-section section-tint'>
				<div className='site-container'>
					<div className='section-heading-centred'><p className='label-tag'>{title}</p><h2>{steps.length} steps</h2></div>
					<div className='quiz-steps'>
						{steps.map((step, index) => (
							<div className={`quiz-step ${index === 0 ? 'is-active' : ''}`} key={String(step._id || index)}>
								<b>Step {index + 1}</b>
								<h3>{String(step.title || step.subTitle || '')}</h3>
								<p>{String(step.description || '')}</p>
							</div>
						))}
					</div>
				</div>
			</section>
		</Editable>
	);
}

/** /privacy and /terms: a heading plus one card per clause. */
function LegalSection({ record, selectionKey: currentSelection, onSelect }: { record?: EditorRecord; selectionKey: string; onSelect: SelectHandler }) {
	const clauses = objectList(record, 'card');
	return (
		<Editable record={record} selectionKey={currentSelection} onSelect={onSelect} className='section-target'>
			<section className='site-section section-tint'>
				<div className='site-container legal-column'>
					{clauses.map((clause, index) => (
						<article className='legal-card' key={String(clause._id || index)}>
							<h3>{String(clause.title || '')}</h3>
							<p>{String(clause.description || '')}</p>
						</article>
					))}
				</div>
			</section>
		</Editable>
	);
}

// ── page compositions ────────────────────────────────────────────────

function HomePreview(props: Props) {
	const { data, selectionKey: currentSelection, onSelectRecord, onSelectHomepage, onReorder, onCreateRecord, onOpenPriority, permissions } = props;
	const bySlug = (slug: string) => data.contents.find((record) => record.slug === slug);
	const universities = HOMEPAGE_COLLECTIONS.find((definition) => definition.resource === 'universities');
	const countries = HOMEPAGE_COLLECTIONS.find((definition) => definition.resource === 'countries');

	// Order mirrors ags-frontend/src/components/sections/home/HomePage.tsx.
	return <>
		<HeroCarousel records={data.banners} selectionKey={currentSelection} onSelect={onSelectRecord} onReorder={onReorder} />
		<StatsStrip record={bySlug('stats')} selectionKey={currentSelection} onSelect={onSelectRecord} />
		{bySlug('about') ? <ContentSection record={bySlug('about')!} index={0} selectionKey={currentSelection} onSelect={onSelectRecord} /> : null}
		<HowItWorks record={bySlug('study-process')} selectionKey={currentSelection} onSelect={onSelectRecord} />
		<AffiliationsMarquee record={bySlug('partners')} universities={data.universities} selectionKey={currentSelection} onSelect={onSelectRecord} />
		{universities ? <HomepageCollectionSection definition={universities} data={data} selectionKey={currentSelection} onSelect={onSelectRecord} onManage={onSelectHomepage} /> : null}
		{countries ? <HomepageCollectionSection definition={countries} data={data} selectionKey={currentSelection} onSelect={onSelectRecord} onManage={onSelectHomepage} /> : null}
		<FinderTeaser record={bySlug('finder-teaser')} matches={bySlug('finder-teaser-matches')} selectionKey={currentSelection} onSelect={onSelectRecord} />
		<VideoSection record={bySlug('video-section')} selectionKey={currentSelection} onSelect={onSelectRecord} />
		<PhotoGallery record={bySlug('photo-gallery')} selectionKey={currentSelection} onSelect={onSelectRecord} />
		<WhyAgs record={bySlug('why-ags')} selectionKey={currentSelection} onSelect={onSelectRecord} />
		<CollectionSection
			resource='successstories'
			records={visibleRecords(data.successstories).slice(0, 3)}
			selectionKey={currentSelection}
			onSelect={onSelectRecord}
			onReorder={onReorder}
			onCreate={onCreateRecord}
			onOpenPriority={onOpenPriority}
			canCreate={permissions.successstories.create}
			eyebrow={value(bySlug('testimonials'), 'content', 'Student Stories')}
			title={value(bySlug('testimonials'), 'name', 'Real Students, Real Results')}
			subtitle='The three newest stories appear here. Click the heading block in All content to edit its wording.'
		/>
		<LocationsSection record={bySlug('visit-us')} selectionKey={currentSelection} onSelect={onSelectRecord} />
		<FinalCta record={bySlug('cta')} selectionKey={currentSelection} onSelect={onSelectRecord} />
	</>;
}

function StandardPagePreview(props: Props) {
	const { activePath, data, selectionKey: currentSelection, onSelectRecord, onReorder, onCreateRecord, onOpenPriority, permissions } = props;
	const layout = PAGE_LAYOUTS[activePath];
	if (!layout) return null;
	const bySlug = (slug: string) => data.contents.find((record) => record.slug === slug);
	const placed = new Set(layout.blocks.flatMap((block) => 'slug' in block && block.slug ? [block.slug] : []));

	const renderBlock = (block: PageBlock, index: number): ReactNode => {
		// Two blocks may reference the same Content row (/privacy is its own hero
		// and body), so the key is the position, not the slug.
		const key = `${block.type}-${index}`;
		switch (block.type) {
			case 'hero':
				return <PageHero key={key} record={bySlug(block.slug)} fallbackTitle={layout.title} showCards={block.cards !== false} selectionKey={currentSelection} onSelect={onSelectRecord} />;
			case 'collection':
				return <CollectionSection
					key={key}
					resource={block.resource}
					records={data[block.resource]}
					selectionKey={currentSelection}
					onSelect={onSelectRecord}
					onReorder={onReorder}
					onCreate={onCreateRecord}
					onOpenPriority={onOpenPriority}
					canCreate={permissions[block.resource].create}
					title={block.title || RESOURCE_CONFIGS[block.resource].label}
					tint={index % 2 === 1}
				/>;
			case 'form': {
				const panel = bySlug(block.slug);
				const info = block.infoSlug ? bySlug(block.infoSlug) : undefined;
				if (!panel && !info) return null;
				return <FormPanelSection key={key} panel={panel} info={info} selectionKey={currentSelection} onSelect={onSelectRecord} />;
			}
			case 'steps': {
				const record = bySlug(block.slug);
				if (!record) return null;
				return <StepsSection key={key} record={record} selectionKey={currentSelection} onSelect={onSelectRecord} title={block.title || 'Steps'} />;
			}
			case 'legal': {
				const record = bySlug(block.slug);
				if (!record) return null;
				return <LegalSection key={key} record={record} selectionKey={currentSelection} onSelect={onSelectRecord} />;
			}
			case 'content':
			default: {
				const record = bySlug(block.slug);
				if (!record) return null;
				return <ContentSection key={key} record={record} index={index} selectionKey={currentSelection} onSelect={onSelectRecord} />;
			}
		}
	};

	// Anything else stored under this page's slug prefix still gets a section,
	// so a block added in Admin never silently disappears from the editor.
	const extras = layout.prefix
		? data.contents.filter((record) => String(record.slug || '').startsWith(layout.prefix as string) && !placed.has(String(record.slug)))
		: [];

	return <>
		{layout.blocks.map(renderBlock)}
		{extras.map((record, index) => <ContentSection key={record._id} record={record} index={layout.blocks.length + index} selectionKey={currentSelection} onSelect={onSelectRecord} />)}
	</>;
}

export function SitePreview(props: Props) {
	const collection = props.activePath.startsWith('/collections/') ? props.activePath.slice('/collections/'.length) : '';
	if (isResourceName(collection)) {
		return <div className='site-preview-document'>
			<CollectionSection
				resource={collection}
				records={props.data[collection]}
				selectionKey={props.selectionKey}
				onSelect={props.onSelectRecord}
				onReorder={props.onReorder}
				onCreate={collection === 'contents' ? undefined : props.onCreateRecord}
				onOpenPriority={props.onOpenPriority}
				canCreate={collection !== 'contents' && props.permissions[collection].create}
				subtitle='Every record in this collection is available here, including content that is not placed on a preview page.'
			/>
		</div>;
	}
	return (
		<div className='site-preview-document' key={props.activePath}>
			<SiteHeader data={props.data} selectionKey={props.selectionKey} onSelect={props.onSelectRecord} />
			{props.activePath === '/' ? <HomePreview {...props} /> : <StandardPagePreview {...props} />}
			<SiteFooter data={props.data} selectionKey={props.selectionKey} onSelect={props.onSelectRecord} />
		</div>
	);
}
