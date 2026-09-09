import test from 'node:test';
import assert from 'node:assert/strict';
import {
	OPTION_MODELS,
	invalidRecordWriteKeys,
	hasResourcePermission,
	writableFormFields,
} from '../src/lib/resources.ts';

// A `get/config` response shape, as `convertToFormFields.ts` returns it —
// `form` is already flat (a `[a, b]` row in a model's `config.ts` layout
// becomes two separate entries, not a nested pair) by the time it reaches
// the editor, so `writableFormFields`/`invalidRecordWriteKeys` never see
// nesting themselves.
function configWith(fields) {
	return { form: fields, schema: {} };
}

test('writableFormFields flattens a get/config form array to its field names', () => {
	const config = configWith([
		{ name: 'title', sectionTitle: 'Info' },
		{ name: 'slug' },
		{ name: 'excerpt' },
	]);
	assert.deepEqual([...writableFormFields(config)].sort(), ['excerpt', 'slug', 'title']);
});

test('writableFormFields drops fields marked isExcluded', () => {
	const config = configWith([
		{ name: 'title' },
		{ name: 'internalNote', isExcluded: true },
	]);
	assert.deepEqual([...writableFormFields(config)], ['title']);
});

test('writableFormFields flattens a [a, b] row exactly like two standalone fields', () => {
	// convertToFormFields.ts pushes one entry per sub-field of a `[a, b]` row,
	// so the flattened result is indistinguishable from two plain fields.
	const rowConfig = configWith([{ name: 'startDate' }, { name: 'endDate' }]);
	const plainConfig = configWith([{ name: 'startDate' }, { name: 'endDate' }]);
	assert.deepEqual([...writableFormFields(rowConfig)].sort(), [...writableFormFields(plainConfig)].sort());
});

test('invalidRecordWriteKeys rejects a key absent from the form', () => {
	const config = configWith([{ name: 'title' }, { name: 'slug' }]);
	assert.deepEqual(invalidRecordWriteKeys(['title', 'notAField'], config, false), ['notAField']);
});

test('invalidRecordWriteKeys rejects code/_id/createdAt on create even when present in the form', () => {
	const config = configWith([{ name: 'title' }, { name: 'code' }, { name: '_id' }, { name: 'createdAt' }]);
	assert.deepEqual(
		invalidRecordWriteKeys(['title', 'code', '_id', 'createdAt'], config, true).sort(),
		['_id', 'code', 'createdAt'],
	);
});

test('invalidRecordWriteKeys allows code/_id/createdAt on edit if the form lists them', () => {
	// Editing is a different guard from creating — nothing in the work order
	// blocks these on update, only on create (blockedOnCreate).
	const config = configWith([{ name: 'title' }, { name: 'code' }]);
	assert.deepEqual(invalidRecordWriteKeys(['title', 'code'], config, false), []);
});

test('invalidRecordWriteKeys allows a required field like slug on create (D3)', () => {
	// The old fixed IMMUTABLE_FIELDS set wrongly blocked `slug` on create; the
	// config-form allowlist must not repeat that mistake.
	const config = configWith([{ name: 'title' }, { name: 'slug', isRequired: true }]);
	assert.deepEqual(invalidRecordWriteKeys(['title', 'slug'], config, true), []);
});

test('hasResourcePermission honours the wildcard', () => {
	assert.equal(hasResourcePermission(['*'], 'create', 'blogposts'), true);
	assert.equal(hasResourcePermission(['*'], 'delete', 'universities'), true);
});

test('hasResourcePermission checks the exact create-<permission> string', () => {
	assert.equal(hasResourcePermission(['create-blogposts'], 'create', 'blogposts'), true);
	assert.equal(hasResourcePermission(['create-blogposts'], 'edit', 'blogposts'), false);
	assert.equal(hasResourcePermission(['create-blogposts'], 'create', 'universities'), false);
	assert.equal(hasResourcePermission([], 'create', 'blogposts'), false);
});

test('the options-route model allowlist rejects an unlisted model', () => {
	assert.equal(OPTION_MODELS.has('universities'), true);
	assert.equal(OPTION_MODELS.has('destinations'), true);
	assert.equal(OPTION_MODELS.has('packages'), true);
	assert.equal(OPTION_MODELS.has('admins'), false);
	assert.equal(OPTION_MODELS.has('../../etc/passwd'), false);
});
