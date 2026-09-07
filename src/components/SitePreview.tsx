'use client';

/* eslint-disable @next/next/no-img-element -- CMS URLs are arbitrary and this editor must preview them without a deployment-time host allowlist. */

import { useMemo, useState, type ReactNode } from 'react';
import {
	HOMEPAGE_COLLECTIONS,
	RESOURCE_CONFIGS,
	isResourceName,
	recordLabel,
	recordSlug,
	prioritySorted,
	type EditorRecord,
	type HomepageCollection,
	type ResourceName,
	type WorkspaceData,
} from '@/lib/resources';

type Props = {
	activePath: string;
	data: WorkspaceData;
	selectionKey: string;
	onSelectRecord: (resource: ResourceName, id: string) => void;
	onSelectHomepage: (definition: HomepageCollection) => void;
	onReorder: (resource: ResourceName, orderedIds: string[]) => Promise<void>;
};

type EditableTargetProps = {
	resource: ResourceName;
	record: EditorRecord;
	selectionKey: string;
	onSelect: (resource: ResourceName, id: string) => void;
	children: ReactNode;
	className?: string;
	drag?: {
		onDragStart: () => void;
		onDrop: () => void;
	};
};

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

function selectionKey(resource: ResourceName, id: string): string {
	return `record:${resource}:${id}`;
}

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

function SiteHeader({ data, selectionKey: currentSelection, onSelect }: Pick<Props, 'data' | 'selectionKey'> & { onSelect: Props['onSelectRecord'] }) {
	const logo = data.contents.find((record) => record.slug === 'logo');
	const brand = (
		<div className='site-brand'>
			{value(logo, 'image') ? <img src={value(logo, 'image')} alt='' /> : <span className='site-logo-mark'>AGS</span>}
			<span><strong>{value(logo, 'content', 'AGS')}</strong><small>{value(logo, 'subContent', 'Global Services')}</small></span>
		</div>
	);

	const topbar = data.contents.find((record) => record.slug === '/topbar');
	const topbarRow = (
		<div className='site-topbar'>
			<span>{value(topbar, 'content', "Bangladesh's #1 Study Abroad Consultancy · Est. 2022")}</span>
			<span>{value(topbar, 'phone', '+880 1711 984257')} &nbsp; <b>{value(topbar, 'subContent', 'WhatsApp Us →')}</b></span>
		</div>
	);

	return (
		<header className='site-header'>
			{topbar ? (
				<EditableTarget resource='contents' record={topbar} selectionKey={currentSelection} onSelect={onSelect} className='topbar-edit-target'>
					{topbarRow}
				</EditableTarget>
			) : topbarRow}
			<div className='site-navbar'>
				{logo ? (
					<EditableTarget resource='contents' record={logo} selectionKey={currentSelection} onSelect={onSelect} className='logo-edit-target'>
						{brand}
					</EditableTarget>
				) : brand}
				<nav aria-label='Preview navigation'>
					{['Home', 'About', 'Services', 'Countries', 'Universities', 'Success Stories'].map((item) => (
						<button type='button' className='dummy-link' key={item} title='Navigation is disabled inside the editor'>{item}</button>
					))}
				</nav>
				<button type='button' className='site-cta dummy-link' title='Links are disabled inside the editor'>Free Consultation</button>
			</div>
		</header>
	);
}

function SiteFooter({ data, selectionKey: currentSelection, onSelect }: Pick<Props, 'data' | 'selectionKey'> & { onSelect: Props['onSelectRecord'] }) {
	const footer = data.contents.find((record) => record.slug === 'footer-left');
	const content = (
		<div className='site-footer-inner'>
			<div className='footer-brand'>
				<strong>AGS</strong>
				<small>Akashbari Global Services</small>
				<p>{value(footer, 'subContent', 'Expert guidance for your study abroad journey, from application to arrival.')}</p>
			</div>
			{['Services', 'Destinations', 'Quick links'].map((heading) => (
				<div key={heading}><h4>{heading}</h4><span>Explore options</span><span>Student support</span><span>Contact AGS</span></div>
			))}
		</div>
	);
	return (
		<footer className='site-footer'>
			{footer ? <EditableTarget resource='contents' record={footer} selectionKey={currentSelection} onSelect={onSelect}>{content}</EditableTarget> : content}
			<div className='site-copyright'>© {new Date().getFullYear()} Akashbari Global Services. All rights reserved.</div>
		</footer>
	);
}

function ContentBlock({ record, index, selectionKey: currentSelection, onSelect }: {
	record: EditorRecord;
	index: number;
	selectionKey: string;
	onSelect: Props['onSelectRecord'];
}) {
	const cards = objectList(record, 'card');
	const list = stringList(record, 'list');
	const gallery = stringList(record, 'gallery');
	const image = value(record, 'image');
	const heading = value(record, 'name', value(record, 'content', 'Content section'));
	const primary = value(record, 'content');
	const description = cleanText(record.subContent || record.description || record.richContent);
	const dark = record.slug === 'cta' || String(record.slug || '').endsWith('-cta');

	return (
		<EditableTarget resource='contents' record={record} selectionKey={currentSelection} onSelect={onSelect} className={`site-section-target ${dark ? 'is-dark' : ''}`}>
			<section className={`site-section ${index % 2 ? 'section-tint' : ''} ${dark ? 'section-dark' : ''}`}>
				<div className={`site-container ${image ? 'split-section' : ''}`}>
					<div className='section-copy'>
						<p className='site-eyebrow'>{value(record, 'section', primary || 'AGS Global Services')}</p>
						<h2>{heading}</h2>
						{description ? <p className='site-description'>{description}</p> : null}
						{list.length > 0 ? <ul className='site-list'>{list.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{item}</li>)}</ul> : null}
						{value(record, 'btnText') ? <button type='button' className='site-button dummy-link'>{value(record, 'btnText').split(',')[0]}</button> : null}
					</div>
					{image ? <div className='section-image'><img src={image} alt='' /></div> : null}
				</div>
				{cards.length > 0 ? (
					<div className='site-container mini-card-grid'>
						{cards.map((card, cardIndex) => (
							<div className='mini-card' key={String(card._id || cardIndex)}>
								{typeof card.image === 'string' && card.image ? <img src={card.image} alt='' /> : <span className='mini-card-icon'>{String(cardIndex + 1).padStart(2, '0')}</span>}
								<h3>{String(card.title || card.subTitle || `Item ${cardIndex + 1}`)}</h3>
								<p>{String(card.description || '')}</p>
							</div>
						))}
					</div>
				) : null}
				{gallery.length > 0 ? <div className='site-container gallery-strip'>{gallery.map((source, imageIndex) => <img src={source} alt='' key={`${source}-${imageIndex}`} />)}</div> : null}
			</section>
		</EditableTarget>
	);
}

function PageHero({ record, fallbackTitle, selectionKey: currentSelection, onSelect }: {
	record?: EditorRecord;
	fallbackTitle: string;
	selectionKey: string;
	onSelect: Props['onSelectRecord'];
}) {
	const hero = (
		<section className='page-hero'>
			<div className='site-container'>
				<span className='hero-pill'>{value(record, 'section', 'Study abroad with confidence')}</span>
				<h1>{value(record, 'content', value(record, 'name', fallbackTitle))}</h1>
				<p>{value(record, 'subContent', value(record, 'description', 'Expert, end-to-end support for your global education journey.'))}</p>
			</div>
		</section>
	);
	return record ? <EditableTarget resource='contents' record={record} selectionKey={currentSelection} onSelect={onSelect}>{hero}</EditableTarget> : hero;
}

function HeroBanners({ records, selectionKey: currentSelection, onSelect, onReorder }: {
	records: EditorRecord[];
	selectionKey: string;
	onSelect: Props['onSelectRecord'];
	onReorder: Props['onReorder'];
}) {
	const ordered = prioritySorted(records);
	const first = ordered[0];
	const [dragged, setDragged] = useState<string | null>(null);
	if (!first) return <PageHero fallbackTitle='Study Abroad, Done Right.' selectionKey={currentSelection} onSelect={onSelect} />;
	const image = value(first, 'image');
	return (
		<section className='home-hero' style={image ? { backgroundImage: `linear-gradient(90deg, rgba(28,25,23,.88), rgba(28,25,23,.30)), url("${image.replace(/"/g, '%22')}")` } : undefined}>
			<EditableTarget resource='banners' record={first} selectionKey={currentSelection} onSelect={onSelect} className='hero-primary-target'>
				<div className='site-container hero-copy'>
					<p className='site-eyebrow'>{value(first, 'content', 'Start your global journey')}</p>
					<h1>{value(first, 'name', 'Study Abroad, Done Right.')}</h1>
					<p>{value(first, 'subContent', 'Personal guidance from application to arrival.')}</p>
					<button type='button' className='site-button dummy-link'>{value(first, 'btnText', 'Book Free Consultation').split(',')[0]}</button>
				</div>
			</EditableTarget>
			<div className='banner-tabs' aria-label='Hero banners'>
				{ordered.map((banner, index) => (
					<EditableTarget
						key={banner._id}
						resource='banners'
						record={banner}
						selectionKey={currentSelection}
						onSelect={onSelect}
						className='banner-tab-target'
						drag={{
							onDragStart: () => setDragged(banner._id),
							onDrop: () => {
								if (!dragged || dragged === banner._id) return;
								const ids = ordered.map((item) => item._id);
								const from = ids.indexOf(dragged);
								const to = ids.indexOf(banner._id);
								ids.splice(to, 0, ids.splice(from, 1)[0]);
								setDragged(null);
								void onReorder('banners', ids);
							},
						}}
					>
						<div className={`banner-tab ${index === 0 ? 'active' : ''}`}><span>{String(index + 1).padStart(2, '0')}</span><strong>{recordLabel('banners', banner)}</strong></div>
					</EditableTarget>
				))}
			</div>
		</section>
	);
}

function RecordCard({ resource, record }: { resource: ResourceName; record: EditorRecord }) {
	const imageField = RESOURCE_CONFIGS[resource].imageField;
	const image = imageField ? value(record, imageField) : '';
	const description = cleanText(record[RESOURCE_CONFIGS[resource].subtitleField || 'description']);

	if (resource === 'courses') {
		return <div className='record-card course-card'>
			<div className='card-symbol'>🎓</div><span className='card-badge'>{value(record, 'level', 'Course')}</span>
			<h3>{recordLabel(resource, record)}</h3><p className='card-accent'>{value(record, 'universityName', 'Partner University')}</p>
			<p className='card-muted'>⌖ {value(record, 'country', 'Global')}</p>
			<div className='card-stats'><span><small>Duration</small><b>{value(record, 'duration', 'N/A')}</b></span><span><small>Tuition/yr</small><b>{value(record, 'tuitionPerYear', 'N/A')}</b></span></div>
			<div className='card-footer'><span>IELTS <b>{value(record, 'minIelts', 'N/A')}</b></span><button type='button' className='dummy-link'>View course →</button></div>
		</div>;
	}

	if (resource === 'countries') {
		return <div className='record-card country-card'>
			<div className='image-card-head' style={image ? { backgroundImage: `linear-gradient(0deg, rgba(28,25,23,.75), transparent), url("${image.replace(/"/g, '%22')}")` } : undefined}><h3>{recordLabel(resource, record)}</h3><span>{value(record, 'region')}</span></div>
			<div className='image-card-body'><p>{description}</p><div className='progress-label'><span>AGS Visa Success</span><b>{value(record, 'agsSuccess', 'N/A')}</b></div><div className='progress'><i style={{ width: value(record, 'agsSuccess', '0%') }} /></div><div className='card-stats'><span><small>Processing</small><b>{value(record, 'processTime', 'N/A')}</b></span><span><small>Avg. tuition</small><b>{value(record, 'avgTuitionFee', 'N/A')}</b></span></div></div>
		</div>;
	}

	if (resource === 'universities') {
		return <div className='record-card university-card'>
			<div className='university-image'>{image ? <img src={image} alt='' /> : <span>U</span>}</div>
			<div className='card-badges'>{record.isPartner ? <span>Partner</span> : null}{record.isFeatured ? <span>Featured</span> : null}</div>
			<h3>{recordLabel(resource, record)}</h3><p className='card-muted'>⌖ {value(record, 'countryName', value(record, 'country'))}</p><p>{description}</p>
			<div className='card-stats three'><span><small>IELTS</small><b>{value(record, 'minIelts', 'N/A')}</b></span><span><small>Success</small><b>{value(record, 'agsSuccess', 'N/A')}</b></span><span><small>Tuition</small><b>{value(record, 'tuitionRange', 'N/A')}</b></span></div>
		</div>;
	}

	if (resource === 'services') {
		return <div className='record-card service-card'><div className='service-stripe' /><span className='card-step'>{value(record, 'section', 'AGS SERVICE')}</span><h3>{recordLabel(resource, record)}</h3><p>{description || value(record, 'content')}</p><ul>{objectList(record, 'whatWeProvideCards').slice(0, 3).map((card, index) => <li key={String(card._id || index)}>✓ {String(card.title || card.description || '')}</li>)}</ul><button type='button' className='dummy-link'>Learn more →</button></div>;
	}

	if (resource === 'successstories' || resource === 'reviews') {
		return <div className='record-card story-card'>{image ? <img src={image} alt='' /> : <div className='story-avatar'>{recordLabel(resource, record).charAt(0)}</div>}<div className='stars'>★★★★★</div><p>“{description || value(record, 'message')}”</p><h3>{recordLabel(resource, record)}</h3><small>{value(record, 'universityName', value(record, 'location'))}</small></div>;
	}

	if (resource === 'blogposts' || resource === 'gallerys') {
		return <div className='record-card media-card'>{image ? <img src={image} alt='' /> : <div className='media-placeholder'>AGS</div>}<div><span className='card-step'>{value(record, 'category', resource === 'blogposts' ? 'Insights' : 'Gallery')}</span><h3>{recordLabel(resource, record)}</h3><p>{description}</p></div></div>;
	}

	if (resource === 'teams' || resource === 'partners') {
		return <div className='record-card person-card'>{image ? <img src={image} alt='' /> : <div className='story-avatar'>{recordLabel(resource, record).charAt(0)}</div>}<h3>{recordLabel(resource, record)}</h3><p>{description || value(record, 'designation')}</p></div>;
	}

	if (resource === 'faqs') {
		return <div className='record-card faq-card'><h3>{recordLabel(resource, record)}</h3>{stringList(record, 'list').slice(0, 4).map((item, index) => <p key={`${item}-${index}`}>{item}</p>)}</div>;
	}

	return <div className='record-card'><h3>{recordLabel(resource, record)}</h3><p>{description}</p></div>;
}

function CollectionSection({
	resource,
	records,
	selectionKey: currentSelection,
	onSelect,
	onReorder,
	title,
	subtitle,
}: {
	resource: ResourceName;
	records: EditorRecord[];
	selectionKey: string;
	onSelect: Props['onSelectRecord'];
	onReorder: Props['onReorder'];
	title?: string;
	subtitle?: string;
}) {
	const ordered = useMemo(() => prioritySorted(records), [records]);
	const [dragged, setDragged] = useState<string | null>(null);
	return (
		<section className='site-section section-tint collection-section'>
			<div className='site-container'>
				<div className='section-heading-row'><div><p className='site-eyebrow'>{RESOURCE_CONFIGS[resource].label}</p><h2>{title || `Explore ${RESOURCE_CONFIGS[resource].label}`}</h2><p className='site-description'>{subtitle || 'Click any outlined card to edit it. Drag the handle to change its priority.'}</p></div><span className='record-count'>{ordered.length} records</span></div>
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
				) : <div className='empty-collection'>No records yet. Add them from the admin panel, then reload this editor.</div>}
			</div>
		</section>
	);
}

function HomepageCollectionSection({ definition, data, selectionKey: currentSelection, onSelect, onManage }: {
	definition: HomepageCollection;
	data: WorkspaceData;
	selectionKey: string;
	onSelect: Props['onSelectRecord'];
	onManage: Props['onSelectHomepage'];
}) {
	const content = data.contents.find((record) => record.slug === definition.contentSlug);
	const storedIds = stringList(content, 'list');
	const available = prioritySorted(data[definition.resource]);
	const records = storedIds.length
		? storedIds.map((id) => available.find((record) => record._id === id)).filter((record): record is EditorRecord => Boolean(record))
		: available.filter((record) => record.isVisible !== false && record.isActive !== false).slice(0, definition.defaultLimit);

	return (
		<section className='site-section homepage-collection'>
			<div className='site-container'>
				<div className='section-heading-row'>
					{content ? (
						<EditableTarget resource='contents' record={content} selectionKey={currentSelection} onSelect={onSelect} className='section-heading-edit-target'>
							<div><p className='site-eyebrow'>{value(content, 'content', definition.label)}</p><h2>{value(content, 'name', definition.defaultName)}</h2><p className='site-description'>{value(content, 'subContent', `Choose which ${definition.resource} appear here.`)}</p></div>
						</EditableTarget>
					) : <div><p className='site-eyebrow'>{definition.label}</p><h2>{definition.defaultName}</h2><p className='site-description'>Choose which {definition.resource} appear here.</p></div>}
					<button type='button' className='manage-selection-button' onClick={(event) => { event.stopPropagation(); onManage(definition); }}>Choose &amp; order</button>
				</div>
				<div className={`records-grid records-${definition.resource} homepage-records`}>
					{records.map((record) => (
						<EditableTarget key={record._id} resource={definition.resource} record={record} selectionKey={currentSelection} onSelect={onSelect} className='record-card-target'>
							<RecordCard resource={definition.resource} record={record} />
						</EditableTarget>
					))}
				</div>
			</div>
		</section>
	);
}

function HomePreview(props: Props) {
	const { data, selectionKey: currentSelection, onSelectRecord, onSelectHomepage, onReorder } = props;
	const contentOrder = ['stats', 'about', 'study-process', 'partners'];
	const closingOrder = ['finder-teaser', 'finder-teaser-matches', 'video-section', 'photo-gallery', 'why-ags', 'testimonials', 'visit-us', 'cta'];
	const bySlug = (slug: string) => data.contents.find((record) => record.slug === slug);
	return <>
		<HeroBanners records={data.banners} selectionKey={currentSelection} onSelect={onSelectRecord} onReorder={onReorder} />
		{contentOrder.map(bySlug).filter((record): record is EditorRecord => Boolean(record)).map((record, index) => <ContentBlock key={record._id} record={record} index={index} selectionKey={currentSelection} onSelect={onSelectRecord} />)}
		{HOMEPAGE_COLLECTIONS.map((definition) => <HomepageCollectionSection key={definition.resource} definition={definition} data={data} selectionKey={currentSelection} onSelect={onSelectRecord} onManage={onSelectHomepage} />)}
		{closingOrder.map(bySlug).filter((record): record is EditorRecord => Boolean(record)).map((record, index) => <ContentBlock key={record._id} record={record} index={index + contentOrder.length} selectionKey={currentSelection} onSelect={onSelectRecord} />)}
	</>;
}

function StandardPagePreview(props: Props) {
	const { activePath, data, selectionKey: currentSelection, onSelectRecord, onReorder } = props;
	const config: Record<string, { title: string; prefix?: string; hero?: string; resource?: ResourceName }> = {
		'/about': { title: 'About AGS', prefix: '/about-', hero: '/about-hero', resource: 'teams' },
		'/services': { title: 'Our Services', prefix: '/services-', hero: '/services-hero', resource: 'services' },
		'/countries': { title: 'Study Destinations', prefix: '/countries-', hero: '/countries-hero', resource: 'countries' },
		'/courses': { title: 'Courses & Programmes', prefix: '/courses-', hero: '/courses-hero', resource: 'courses' },
		'/universities': { title: 'Partner Universities', prefix: '/university-', hero: '/university-hero', resource: 'universities' },
		'/eligibility': { title: 'Check Your Eligibility', prefix: '/eligibility-', hero: '/eligibility-hero' },
		'/finder': { title: 'University Finder', prefix: '/finder-', hero: '/finder-steps' },
		'/success-stories': { title: 'Success Stories', prefix: '/success-stories-', hero: '/success-stories-hero', resource: 'successstories' },
		'/blog': { title: 'AGS Insights', prefix: '/blog-', hero: '/blog-hero', resource: 'blogposts' },
		'/faq': { title: 'Frequently Asked Questions', prefix: '/faq-', hero: '/faq-hero', resource: 'faqs' },
		'/apply': { title: 'Start Your Application', prefix: '/apply-', hero: '/apply-hero' },
		'/contact': { title: 'Contact AGS', prefix: '/contact-', hero: '/contact-hero' },
		'/privacy': { title: 'Privacy Policy', hero: '/privacy' },
		'/terms': { title: 'Terms of Service', hero: '/terms-services' },
	};
	const page = config[activePath] || config['/about'];
	const hero = data.contents.find((record) => record.slug === page.hero);
	const blocks = page.prefix
		? data.contents.filter((record) => record._id !== hero?._id && String(record.slug || '').startsWith(page.prefix as string))
		: [];

	return <>
		<PageHero record={hero} fallbackTitle={page.title} selectionKey={currentSelection} onSelect={onSelectRecord} />
		{page.resource ? <CollectionSection resource={page.resource} records={data[page.resource]} selectionKey={currentSelection} onSelect={onSelectRecord} onReorder={onReorder} title={RESOURCE_CONFIGS[page.resource].label} /> : null}
		{blocks.map((record, index) => <ContentBlock key={record._id} record={record} index={index} selectionKey={currentSelection} onSelect={onSelectRecord} />)}
	</>;
}

export function SitePreview(props: Props) {
	const collection = props.activePath.startsWith('/collections/') ? props.activePath.slice('/collections/'.length) : '';
	if (isResourceName(collection)) {
		return <div className='site-preview-document'>
			<CollectionSection resource={collection} records={props.data[collection]} selectionKey={props.selectionKey} onSelect={props.onSelectRecord} onReorder={props.onReorder} subtitle='Every record in this collection is available here, including content that is not placed on a preview page.' />
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
