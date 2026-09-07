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
};

export const HOMEPAGE_COLLECTIONS: HomepageCollection[] = [
	{
		resource: 'universities',
		contentSlug: 'top-universities',
		label: 'Homepage universities',
		defaultLimit: 6,
		defaultName: 'Top Universities We Work With',
	},
	{
		resource: 'countries',
		contentSlug: '/home-countries',
		label: 'Homepage countries',
		defaultLimit: 8,
		defaultName: 'Home Countries Carousel',
	},
	{
		resource: 'courses',
		contentSlug: '/home-courses',
		label: 'Homepage courses',
		defaultLimit: 6,
		defaultName: 'Homepage Courses',
	},
];

export function emptyWorkspaceData(): WorkspaceData {
	return Object.fromEntries(RESOURCE_NAMES.map((resource) => [resource, []])) as unknown as WorkspaceData;
}

export function emptyWorkspaceSchemas(): WorkspaceSchemas {
	return Object.fromEntries(RESOURCE_NAMES.map((resource) => [resource, {}])) as unknown as WorkspaceSchemas;
}
