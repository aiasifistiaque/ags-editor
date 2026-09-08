export const RESOURCE_NAMES = [
	'contents',
	'banners',
	'courses',
	'services',
	'countries',
	'universities',
	'successstories',
	'blogposts',
	'gallerys',
	'partners',
	'reviews',
	'teams',
	'faqs',
] as const;

export type ResourceName = (typeof RESOURCE_NAMES)[number];

export type EditorRecord = {
	_id: string;
	id?: string;
	slug?: string;
	name?: string;
	title?: string;
	priority?: number;
	isActive?: boolean;
	isVisible?: boolean;
	status?: string;
	[key: string]: unknown;
};

export type SelectOption = {
	label: string;
	value: string;
};

export type BackendFieldSchema = {
	label?: string;
	type?: string;
	model?: string;
	isRequired?: boolean;
	helperText?: string;
	placeholder?: string;
	hasImage?: boolean;
	options?: SelectOption[];
	section?: {
		dataModel?: Array<BackendFieldSchema & { name: string }>;
	};
	[key: string]: unknown;
};

export type ResourceSchema = Record<string, BackendFieldSchema>;
export type WorkspaceData = Record<ResourceName, EditorRecord[]>;
export type WorkspaceSchemas = Record<ResourceName, ResourceSchema>;

export type ResourceConfig = {
	label: string;
	singular: string;
	titleField: string;
	subtitleField?: string;
	imageField?: string;
	reorderable: boolean;
};

export const RESOURCE_CONFIGS: Record<ResourceName, ResourceConfig> = {
	contents: {
		label: 'Content blocks',
		singular: 'Content block',
		titleField: 'name',
		subtitleField: 'content',
		imageField: 'image',
		reorderable: true,
	},
	banners: {
		label: 'Hero banners',
		singular: 'Banner',
		titleField: 'name',
		subtitleField: 'subContent',
		imageField: 'image',
		reorderable: true,
	},
	courses: {
		label: 'Courses',
		singular: 'Course',
		titleField: 'name',
		subtitleField: 'universityName',
		reorderable: true,
	},
	services: {
		label: 'Services',
		singular: 'Service',
		titleField: 'name',
		subtitleField: 'description',
		imageField: 'image',
		reorderable: true,
	},
	countries: {
		label: 'Countries',
		singular: 'Country',
		titleField: 'name',
		subtitleField: 'overviewSubContent',
		imageField: 'coverImage',
		reorderable: true,
	},
	universities: {
		label: 'Universities',
		singular: 'University',
		titleField: 'name',
		subtitleField: 'overviewSubContent',
		imageField: 'coverImage',
		reorderable: true,
	},
	successstories: {
		label: 'Success stories',
		singular: 'Success story',
		titleField: 'authorName',
		subtitleField: 'message',
		imageField: 'coverImage',
		reorderable: true,
	},
	blogposts: {
		label: 'Blog posts',
		singular: 'Blog post',
		titleField: 'title',
		subtitleField: 'excerpt',
		imageField: 'image',
		reorderable: true,
	},
	gallerys: {
		label: 'Gallery',
		singular: 'Gallery item',
		titleField: 'name',
		imageField: 'image',
		reorderable: true,
	},
	partners: {
		label: 'Partners',
		singular: 'Partner',
		titleField: 'name',
		subtitleField: 'description',
		imageField: 'logo',
		reorderable: true,
	},
	reviews: {
		label: 'Reviews',
		singular: 'Review',
		titleField: 'name',
		subtitleField: 'reviewText',
		imageField: 'image',
		reorderable: true,
	},
	teams: {
		label: 'Team members',
		singular: 'Team member',
		titleField: 'name',
		subtitleField: 'designation',
		imageField: 'image',
		reorderable: true,
	},
	faqs: {
		label: 'FAQs',
		singular: 'FAQ group',
		titleField: 'slug',
		reorderable: true,
	},
};

export type EditorPage = {
	label: string;
	path: string;
	group: 'Main pages' | 'Student journey' | 'Resources';
};

export const EDITOR_PAGES: EditorPage[] = [
	{ label: 'Home', path: '/', group: 'Main pages' },
	{ label: 'About', path: '/about', group: 'Main pages' },
	{ label: 'Services', path: '/services', group: 'Main pages' },
	{ label: 'Countries', path: '/countries', group: 'Student journey' },
	{ label: 'Courses', path: '/courses', group: 'Student journey' },
	{ label: 'Universities', path: '/universities', group: 'Student journey' },
	{ label: 'Eligibility', path: '/eligibility', group: 'Student journey' },
	{ label: 'University Finder', path: '/finder', group: 'Student journey' },
	{ label: 'Success Stories', path: '/success-stories', group: 'Resources' },
	{ label: 'Blog', path: '/blog', group: 'Resources' },
	{ label: 'FAQ', path: '/faq', group: 'Resources' },
	{ label: 'Apply', path: '/apply', group: 'Resources' },
	{ label: 'Contact', path: '/contact', group: 'Resources' },
	{ label: 'Privacy', path: '/privacy', group: 'Resources' },
	{ label: 'Terms', path: '/terms', group: 'Resources' },
];

export const IMMUTABLE_FIELDS = new Set([
	'_id',
	'id',
	'__v',
	'code',
	'slug',
	'createdAt',
	'updatedAt',
	'universityName',
	'countryName',
]);

const RESOURCE_READ_ONLY_FIELDS: Partial<Record<ResourceName, Set<string>>> = {
	courses: new Set(['country']),
};

export function isEditableField(resource: ResourceName, key: string): boolean {
	return !IMMUTABLE_FIELDS.has(key) && !RESOURCE_READ_ONLY_FIELDS[resource]?.has(key);
}

export function isResourceName(value: string): value is ResourceName {
	return (RESOURCE_NAMES as readonly string[]).includes(value);
}

export function recordLabel(resource: ResourceName, record: EditorRecord): string {
	const config = RESOURCE_CONFIGS[resource];
	const value = record[config.titleField];
	return typeof value === 'string' && value.trim() ? value : config.singular;
}

export function recordSlug(resource: ResourceName, record: EditorRecord): string {
	if (typeof record.slug === 'string' && record.slug) return record.slug;
	if (typeof record.code === 'string' && record.code) return record.code;
	return `${resource}/${record._id}`;
}

export function prioritySorted(records: EditorRecord[]): EditorRecord[] {
	return [...records].sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
}

export function visibleRecords(records: EditorRecord[]): EditorRecord[] {
	return prioritySorted(records).filter((record) =>
		record.isActive !== false && record.isVisible !== false && record.status !== 'deleted'
	);
}

export type HomepageCollection = {
	resource: 'courses' | 'universities' | 'countries';
	contentSlug: string;
	label: string;
	defaultLimit: number;
	defaultName: string;
	/**
	 * Which Content field the frontend renders as this rail's <h2>.
	 * TopUniversitiesSection uses `name`; CountriesCarousel uses `content`.
	 */
	headingField: 'name' | 'content';
};

export const HOMEPAGE_COLLECTIONS: HomepageCollection[] = [
	{
		resource: 'universities',
		contentSlug: 'top-universities',
		label: 'Partner Universities',
		defaultLimit: 6,
		defaultName: 'Top Universities We Work With',
		headingField: 'name',
	},
	{
		resource: 'countries',
		contentSlug: '/home-countries',
		label: 'Destinations',
		defaultLimit: 8,
		defaultName: 'Where Will\nYou Study?',
		headingField: 'content',
	},
];

/**
 * How each public page is composed, mirroring the corresponding component in
 * `ags-frontend/src/components`. The order here is the order the site renders,
 * and `prefix` is the fallback that catches any block added in Admin under the
 * page's slug namespace that isn't listed explicitly.
 */
export type PageBlock =
	// `cards: false` where the Content row's `card[]` is the page body rather
	// than hero stat cards — /privacy and /terms share one row for both.
	| { type: 'hero'; slug: string; cards?: boolean }
	| { type: 'content'; slug: string }
	| { type: 'collection'; resource: ResourceName; title?: string }
	| { type: 'form'; slug: string; infoSlug?: string }
	| { type: 'steps'; slug: string; title?: string }
	| { type: 'legal'; slug: string };

export type PageLayout = {
	title: string;
	prefix?: string;
	blocks: PageBlock[];
};

export const PAGE_LAYOUTS: Record<string, PageLayout> = {
	// AboutPage.tsx — hero, story, mission, timeline, team, offices, sister, CTA.
	'/about': {
		title: 'About AGS',
		prefix: '/about-',
		blocks: [
			{ type: 'hero', slug: '/about-hero' },
			{ type: 'content', slug: '/about-story' },
			{ type: 'content', slug: '/about-mission' },
			{ type: 'content', slug: '/about-timeline' },
			{ type: 'content', slug: '/about-team' },
			{ type: 'content', slug: '/about-offices' },
			{ type: 'content', slug: '/about-sister' },
			{ type: 'content', slug: '/about-cta' },
		],
	},
	// ServicesPage.tsx — hero, the services list, the process block, CTA.
	'/services': {
		title: 'Our Services',
		prefix: '/services-',
		blocks: [
			{ type: 'hero', slug: '/services-hero' },
			{ type: 'collection', resource: 'services', title: 'What We Do' },
			{ type: 'content', slug: '/services-process' },
			{ type: 'content', slug: '/services-cta' },
		],
	},
	'/countries': {
		title: 'Study Destinations',
		prefix: '/countries-',
		blocks: [
			{ type: 'hero', slug: '/countries-hero' },
			{ type: 'collection', resource: 'countries', title: 'Choose Your Destination' },
			{ type: 'content', slug: '/countries-cta' },
		],
	},
	'/courses': {
		title: 'Courses & Programmes',
		prefix: '/courses-',
		blocks: [
			{ type: 'hero', slug: '/courses-hero' },
			{ type: 'collection', resource: 'courses', title: 'Browse Courses' },
		],
	},
	'/universities': {
		title: 'Partner Universities',
		prefix: '/university-',
		blocks: [
			{ type: 'hero', slug: '/university-hero' },
			{ type: 'collection', resource: 'universities', title: 'Browse Universities' },
		],
	},
	'/eligibility': {
		title: 'Check Your Eligibility',
		prefix: '/eligibility-',
		blocks: [{ type: 'hero', slug: '/eligibility-hero' }],
	},
	// FinderPage.tsx renders one step at a time from `/finder-steps.card`;
	// the result page's heading lives in `/finder-result-hero`.
	'/finder': {
		title: 'University Finder',
		prefix: '/finder-',
		blocks: [
			{ type: 'steps', slug: '/finder-steps', title: 'Finder questions' },
			{ type: 'hero', slug: '/finder-result-hero' },
		],
	},
	'/success-stories': {
		title: 'Success Stories',
		prefix: '/success-stories-',
		blocks: [
			{ type: 'hero', slug: '/success-stories-hero' },
			{ type: 'collection', resource: 'successstories', title: 'Student Stories' },
			{ type: 'content', slug: '/success-stories-cta' },
		],
	},
	'/blog': {
		title: 'AGS Insights',
		prefix: '/blog-',
		blocks: [
			{ type: 'hero', slug: '/blog-hero' },
			{ type: 'collection', resource: 'blogposts', title: 'Latest Articles' },
		],
	},
	'/faq': {
		title: 'Frequently Asked Questions',
		prefix: '/faq-',
		blocks: [
			{ type: 'hero', slug: '/faq-hero' },
			{ type: 'collection', resource: 'faqs', title: 'Questions by Topic' },
			{ type: 'content', slug: '/faq-cta' },
		],
	},
	'/apply': {
		title: 'Start Your Application',
		prefix: '/apply-',
		blocks: [
			{ type: 'hero', slug: '/apply-hero' },
			{ type: 'form', slug: '/apply-form-panel' },
		],
	},
	'/contact': {
		title: 'Contact AGS',
		prefix: '/contact-',
		blocks: [
			{ type: 'hero', slug: '/contact-hero' },
			{ type: 'form', slug: '/contact-form-panel', infoSlug: '/contact-info' },
		],
	},
	'/privacy': {
		title: 'Privacy Policy',
		blocks: [
			{ type: 'hero', slug: '/privacy', cards: false },
			{ type: 'legal', slug: '/privacy' },
		],
	},
	'/terms': {
		title: 'Terms of Service',
		blocks: [
			{ type: 'hero', slug: '/terms-services', cards: false },
			{ type: 'legal', slug: '/terms-services' },
		],
	},
};

export function emptyWorkspaceData(): WorkspaceData {
	return Object.fromEntries(RESOURCE_NAMES.map((resource) => [resource, []])) as unknown as WorkspaceData;
}

export function emptyWorkspaceSchemas(): WorkspaceSchemas {
	return Object.fromEntries(RESOURCE_NAMES.map((resource) => [resource, {}])) as unknown as WorkspaceSchemas;
}
