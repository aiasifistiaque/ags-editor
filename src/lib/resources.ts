export const RESOURCE_NAMES = [
	'contents',
	'banners',
	'courses',
	'services',
	'countries',
	'universities',
	'successstories',
	'successvideos',
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
		title?: string;
		addBtnText?: string;
		display?: { title?: string };
		dataModel?: Array<BackendFieldSchema & { name: string }>;
	};
	[key: string]: unknown;
};

export type ResourceSchema = Record<string, BackendFieldSchema>;
export type WorkspaceData = Record<ResourceName, EditorRecord[]>;
export type WorkspaceSchemas = Record<ResourceName, ResourceSchema>;

/**
 * One entry of the `form` array returned by the backend's `GET
 * /<resource>/get/config` — produced by `convertToFormFields.ts` from a
 * model's `config.ts` layout and `settings.ts` schema. This is the layout
 * contract for every resource except `contents` (see `ConfigFormEditor`).
 */
export type ConfigFormField = {
	name: string;
	label?: string;
	type?: string;
	isRequired?: boolean;
	placeholder?: string;
	helper?: string;
	options?: SelectOption[];
	model?: string;
	dataModel?: unknown;
	section?: {
		title?: string;
		addBtnText?: string;
		display?: { title?: string };
		dataModel?: Array<BackendFieldSchema & { name: string }>;
	};
	hasImage?: boolean;
	limit?: number;
	folder?: string;
	/** Backend serializes this with `.toString()`; never `eval`d here — see D5 in the work order. Rendered unconditionally. */
	renderCondition?: string;
	value?: unknown;
	/** Arrives as an unusable string over the wire (it's a function); ignored, same reasoning as `renderCondition`. */
	getValue?: unknown;
	isExcluded?: boolean;
	sectionTitle?: string;
	description?: string;
	collapsible?: boolean;
	endOfSection?: boolean;
	span?: number;
};

export type ResourceFormConfig = {
	form: ConfigFormField[];
	schema: ResourceSchema;
	route?: { title?: string; button?: { title?: string } };
};

/**
 * Models proxyable through `/api/resources/options/[model]`, for `data-menu`/
 * `data-tag` fields whose options aren't one of our 13 editor resources.
 * `universities` is also a `ResourceName` (so `data[model]` already has it),
 * but courses' `university` field and this route both need to work the same
 * way; `destinations`/`packages` are legacy fields `gallerys`/`reviews` still
 * carry from the travel-agency lineage (see the work order §4). Hardcoded
 * rather than discovered, since the editor has no static view of every
 * backend `config.ts`— extend this set if a 14th model relation appears.
 */
export const OPTION_MODELS = new Set(['universities', 'destinations', 'packages']);

/**
 * Precisely what the admin posts: the flattened set of `form[].name`, minus
 * any field whose `isExcluded` is true (D3 in the work order). No
 * `server-only` import here — both the server write guard
 * (`resource-api.ts`) and the client form (`ConfigFormEditor`, to keep its
 * submitted diff aligned with what the server will actually accept) need it.
 */
export function writableFormFields(config: ResourceFormConfig): Set<string> {
	return new Set(config.form.filter((field) => !field.isExcluded && field.name).map((field) => field.name));
}

// `_id`/`id`/`__v` are Mongo/Mongoose internals; `code` is counter-generated
// in a pre-save hook and appears in no form config; `createdAt`/`updatedAt`
// are timestamps. None of the 13 resources' create forms should ever post
// these, whichever allowlist governs the rest of the payload.
export const BLOCKED_ON_CREATE_FIELDS = new Set(['_id', 'id', '__v', 'code', 'createdAt', 'updatedAt']);

/**
 * The decision logic behind `validateRecordWrite` in `resource-api.ts`,
 * pulled out as a pure function so it's testable without a network fetch:
 * that file imports `server-only` and can't be loaded outside a Next.js
 * server context (including in `node --test`).
 */
export function invalidRecordWriteKeys(keys: string[], config: ResourceFormConfig, creating: boolean): string[] {
	const allowed = writableFormFields(config);
	return keys.filter((key) => !allowed.has(key) || (creating && BLOCKED_ON_CREATE_FIELDS.has(key)));
}

/** Per-resource create/edit/delete rights, computed once per page load from the admin's role (see `permissionMapFor` in `auth.ts`) and passed down so the shell can render buttons conditionally rather than discovering a role's limits by a 403. */
export type ResourceAbility = { create: boolean; edit: boolean; delete: boolean };
export type ResourcePermissionMap = Record<ResourceName, ResourceAbility>;

/**
 * The decision logic behind `can()` in `auth.ts`, pulled out as a pure
 * function for the same reason as `invalidRecordWriteKeys` — `auth.ts`
 * imports `server-only`.
 */
export function hasResourcePermission(
	permissions: Iterable<string>,
	action: 'create' | 'edit' | 'delete' | 'view',
	resource: ResourceName,
): boolean {
	const set = permissions instanceof Set ? permissions : new Set(permissions);
	if (set.has('*')) return true;
	return set.has(`${action}-${RESOURCE_CONFIGS[resource].permission}`);
}

export type ResourceConfig = {
	label: string;
	singular: string;
	titleField: string;
	subtitleField?: string;
	imageField?: string;
	reorderable: boolean;
	/** Backend permission id, e.g. `create-blogposts`/`edit-blogposts`. Equal to the route path for all 13 resources — set explicitly rather than derived, so a future mismatch is visible. */
	permission: string;
	/** Whether this resource can be created from the editor. All 13 are today; exists so one can be opted out later without touching route code. */
	creatable: boolean;
};

export const RESOURCE_CONFIGS: Record<ResourceName, ResourceConfig> = {
	contents: {
		label: 'Content blocks',
		singular: 'Content block',
		titleField: 'name',
		subtitleField: 'content',
		imageField: 'image',
		reorderable: true,
		permission: 'contents',
		creatable: true,
	},
	banners: {
		label: 'Hero banners',
		singular: 'Banner',
		titleField: 'name',
		subtitleField: 'subContent',
		imageField: 'image',
		reorderable: true,
		permission: 'banners',
		creatable: true,
	},
	courses: {
		label: 'Courses',
		singular: 'Course',
		titleField: 'name',
		subtitleField: 'universityName',
		reorderable: true,
		permission: 'courses',
		creatable: true,
	},
	services: {
		label: 'Services',
		singular: 'Service',
		titleField: 'name',
		subtitleField: 'description',
		imageField: 'image',
		reorderable: true,
		permission: 'services',
		creatable: true,
	},
	countries: {
		label: 'Countries',
		singular: 'Country',
		titleField: 'name',
		subtitleField: 'overviewSubContent',
		imageField: 'coverImage',
		reorderable: true,
		permission: 'countries',
		creatable: true,
	},
	universities: {
		label: 'Universities',
		singular: 'University',
		titleField: 'name',
		subtitleField: 'overviewSubContent',
		imageField: 'coverImage',
		reorderable: true,
		permission: 'universities',
		creatable: true,
	},
	successstories: {
		label: 'Success stories',
		singular: 'Success story',
		titleField: 'authorName',
		subtitleField: 'message',
		imageField: 'coverImage',
		reorderable: true,
		permission: 'successstories',
		creatable: true,
	},
	successvideos: {
		label: 'Success videos',
		singular: 'Success video',
		titleField: 'title',
		subtitleField: 'countryName',
		imageField: 'thumbnail',
		reorderable: true,
		permission: 'successvideos',
		creatable: true,
	},
	blogposts: {
		label: 'Blog posts',
		singular: 'Blog post',
		titleField: 'title',
		subtitleField: 'excerpt',
		imageField: 'image',
		reorderable: true,
		permission: 'blogposts',
		creatable: true,
	},
	gallerys: {
		label: 'Gallery',
		singular: 'Gallery item',
		titleField: 'name',
		imageField: 'image',
		reorderable: true,
		permission: 'gallerys',
		creatable: true,
	},
	partners: {
		label: 'Partners',
		singular: 'Partner',
		titleField: 'name',
		subtitleField: 'description',
		imageField: 'logo',
		reorderable: true,
		permission: 'partners',
		creatable: true,
	},
	reviews: {
		label: 'Reviews',
		singular: 'Review',
		titleField: 'name',
		subtitleField: 'reviewText',
		imageField: 'image',
		reorderable: true,
		permission: 'reviews',
		creatable: true,
	},
	teams: {
		label: 'Team members',
		singular: 'Team member',
		titleField: 'name',
		subtitleField: 'designation',
		imageField: 'image',
		reorderable: true,
		permission: 'teams',
		creatable: true,
	},
	faqs: {
		label: 'FAQs',
		singular: 'FAQ group',
		titleField: 'slug',
		reorderable: true,
		permission: 'faqs',
		creatable: true,
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
	{ label: 'Success Videos', path: '/success-videos', group: 'Resources' },
	{ label: 'Blog', path: '/blog', group: 'Resources' },
	{ label: 'FAQ', path: '/faq', group: 'Resources' },
	{ label: 'Apply', path: '/apply', group: 'Resources' },
	{ label: 'Contact', path: '/contact', group: 'Resources' },
	{ label: 'Privacy', path: '/privacy', group: 'Resources' },
	{ label: 'Terms', path: '/terms', group: 'Resources' },
];

// `contents`-only: the drawer's write guard. Every other resource's write
// allowlist is derived from its `get/config` form instead (see
// `writableFields` in resource-api.ts) — a blog post's `slug` is required on
// create, for instance, which this fixed set would wrongly block.
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
	// Slugs under `prefix` that should never surface via the extras catch-all
	// below — a block deliberately removed from the page, not one Admin added
	// unexpectedly. The Content row itself is left alone (still editable from
	// All content library); it's just no longer part of this page's preview.
	excludeSlugs?: string[];
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
	'/success-videos': {
		title: 'Success Videos',
		prefix: '/success-videos-',
		blocks: [
			{ type: 'hero', slug: '/success-videos-hero' },
			{ type: 'collection', resource: 'successvideos', title: 'Visa Success Stories' },
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
		// The hero was removed from ApplyPage.tsx; keep it out of the extras
		// catch-all rather than have it reappear as a generic block.
		excludeSlugs: ['/apply-hero'],
		blocks: [
			{ type: 'form', slug: '/apply-form-panel' },
		],
	},
	'/contact': {
		title: 'Contact AGS',
		prefix: '/contact-',
		// The hero was removed from ContactPage.tsx; keep it out of the
		// extras catch-all rather than have it reappear as a generic block.
		excludeSlugs: ['/contact-hero'],
		blocks: [
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
