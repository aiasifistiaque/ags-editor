import type { EditorRecord, ResourceName, ResourceSchema } from './resources';

// Audited against ags-frontend consumers and the Content model/admin form.
// Keep this explicit: an unused CMS column must not appear just because it has data.
const hero = ['content', 'subContent'];
const sectionHero = ['section', ...hero];
const cta = [...hero, 'btnText', 'url'];
export const CONTENT_FIELDS: Record<string, string[]> = {
	logo: ['image', 'content', 'subContent'],
	'/topbar': ['content', 'subContent', 'phone', 'url'],
	'footer-left': ['subContent', 'list', 'card'],
	stats: ['card', 'isActive', 'isVisible', 'status'],
	about: ['section', 'content', 'subContent', 'description', 'image', 'card', 'btnText', 'url'],
	'study-process': [...sectionHero, 'card', 'btnText', 'url'],
	partners: ['content'],
	'top-universities': ['content', 'name', 'subContent'],
	'/home-countries': ['section', 'content', 'btnText'],
	'finder-teaser': ['content', 'name', 'subContent', 'list'],
	'finder-teaser-matches': ['card'],
	'video-section': ['section', ...cta, 'list'],
	'photo-gallery': ['content', 'name', 'gallery'],
	'why-ags': ['content', 'name', 'subContent', 'list', 'card'],
	testimonials: ['content', 'name'],
	'success-videos': ['content', 'name'],
	'visit-us': [...sectionHero, 'card'],
	cta: ['section', ...cta, 'list'],
	'/about-hero': [...hero, 'description', 'card'],
	'/about-story': ['section', 'content', 'description', 'card'],
	'/about-mission': ['section', 'content', 'card'],
	'/about-timeline': [...sectionHero, 'card'],
	'/about-team': [...sectionHero, 'card'],
	'/about-offices': [...sectionHero, 'card'],
	'/about-sister': [...sectionHero, 'card'],
	'/about-cta': cta,
	'/services-hero': sectionHero,
	'/services-process': sectionHero,
	'/services-cta': cta,
	'/countries-hero': sectionHero,
	'/countries-cta': ['section', ...cta],
	'/courses-hero': hero,
	'/university-hero': sectionHero,
	'/eligibility-hero': sectionHero,
	'/finder-steps': ['card'],
	'/finder-result-hero': ['content'],
	'/success-stories-hero': hero,
	'/success-stories-cta': cta,
	'/success-videos-hero': hero,
	'/blog-hero': hero,
	'/faq-hero': hero,
	'/faq-cta': cta,
	'/apply-hero': [...sectionHero, 'list', 'card'],
	'/apply-form-panel': hero,
	'/contact-hero': hero,
	'/contact-form-panel': hero,
	'/contact-info': [...hero, 'list', 'card'],
	'/privacy': ['name', ...hero, 'card'],
	'/terms-services': ['name', ...hero, 'card'],
};

export function contentCardFields(slug: string): string[] {
	if (slug === 'finder-teaser-matches' || slug === '/apply-hero') return ['title', 'subTitle', 'description'];
	if (slug === '/about-sister') return ['image', 'title', 'description'];
	// Footer.tsx renders each office card's image alongside its title/description.
	if (slug === 'footer-left') return ['image', 'title', 'description'];
	return ['title', 'description'];
}

export function drawerSchema(resource: ResourceName, record: EditorRecord, schema: ResourceSchema): ResourceSchema {
	if (resource !== 'contents') return {};
	const slug = String(record.slug || '');
	return Object.fromEntries((CONTENT_FIELDS[slug] || []).filter((key) => schema[key]).map((key) => {
		if (key !== 'card') return [key, schema[key]];
		const allowed = contentCardFields(slug);
		const fields = schema.card.section?.dataModel || [];
		return [key, { ...schema.card, section: { ...schema.card.section, dataModel: allowed.map((name) =>
			fields.find((field) => field.name === name) || { name, label: name, type: name === 'image' ? 'image' : name === 'description' ? 'textarea' : 'string' }
		) } }];
	}));
}
