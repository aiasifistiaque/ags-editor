import test from 'node:test';
import assert from 'node:assert/strict';
import { drawerSchema } from '../src/lib/content-fields.ts';

const schema = Object.fromEntries(['name', 'content', 'subContent', 'image', 'gallery', 'note', 'refImage', 'card', 'isActive', 'isVisible', 'status', 'priority'].map((key) => [key, { label: key }]));
schema.card = { type: 'array', section: { dataModel: ['title', 'subTitle', 'description', 'image'].map((name) => ({ name })) } };
test('photo gallery exposes only the actual text and gallery inputs', () => {
	assert.deepEqual(Object.keys(drawerSchema('contents', { _id: 'x', slug: 'photo-gallery' }, schema)), ['content', 'name', 'gallery']);
});
test('stats card controls omit unused image and subtitle without altering the shared CMS schema', () => {
	const result = drawerSchema('contents', { _id: 'x', slug: 'stats' }, schema);
	assert.deepEqual(Object.keys(result), ['card', 'isActive', 'isVisible', 'status']);
	assert.deepEqual(result.card.section.dataModel.map((field) => field.name), ['title', 'description']);
	assert.equal(schema.card.section.dataModel.length, 4);
});
// Since the record-authoring work order, these resources ARE writable — just
// not through the contents drawer. `CONTENT_FIELDS`/`drawerSchema` govern
// `contents` alone; every other resource's create/edit form comes from
// `get/config` instead (see `ConfigFormEditor` in EditorPanel.tsx).
test('collection resources are not driven by the content drawer', () => {
	for (const resource of ['courses', 'universities', 'services', 'banners', 'countries', 'faqs']) assert.deepEqual(drawerSchema(resource, { _id: 'x' }, schema), {});
});
test('unplaced content fails closed even if it has values', () => {
	assert.deepEqual(drawerSchema('contents', { _id: 'x', slug: 'unused', image: 'example.jpg' }, schema), {});
});
test('only sections that consume card images expose them', () => {
	const result = drawerSchema('contents', { _id: 'x', slug: '/about-sister' }, schema);
	assert.deepEqual(result.card.section.dataModel.map((field) => field.name), ['image', 'title', 'description']);
});
