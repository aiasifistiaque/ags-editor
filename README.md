# AGS Visual Editor

A standalone, authenticated visual content editor for Akashbari Global Services. It owns its complete preview renderer and does not embed, import, or modify `ags-frontend`.

## Status

Feature-complete and verified locally against the AGS backend: type-check, lint, and a production build are clean, and every page and collection in the sidebar renders.

Since 2026-09-08, every collection resource — not just `contents` — can be created and edited from the editor, not only reordered. Live-verified the same day (real create/edit/delete against Atlas — see "What actually shipped" in the work order doc). See "What can be edited" below and `docs-for-agents/akashbari-global-services/work-orders/ags-editor-record-authoring.md` for the work order this shipped from.

## Local setup

1. Copy `.env.example` to `.env.local` and configure the backend, admin/editor origins, and a strong session secret.
2. Keep `NEXT_PUBLIC_EDITOR_ORIGIN` configured in `ags-admin` so its `/visual-editor` launcher can transfer the current admin session.
3. Run the backend on port 5000, admin on port 3001, and this project with `npm run dev` on port 3002.
4. Sign in to AGS admin, visit `/visual-editor`, and open the editor.

The public frontend does not need to run for the visual editor to work.

The preview is an editor-owned rendering of the content. Since 2026-09-08 it mirrors the public site section by section: each page's composition is an explicit ordered block list (`PAGE_LAYOUTS` in `src/lib/resources.ts`, and `HomePreview` in `SitePreview.tsx` for the homepage) matching the corresponding component in `ags-frontend/src/components`, and the section markup and styling follow the storefront's own design. It is still an approximation of a live page, not a rendering of it — carousels are static, links are inert, and a section only shows what the CMS actually stores rather than the frontend's hardcoded fallbacks.

Saving updates existing backend records.

## What can be edited

Image fields (including nested cards and image arrays) provide a shared photo-library picker. Browse/search uploaded photos, filter by folder, upload images up to 10 MB, or paste HTTP(S) URLs and local image paths. The gallery uses the same backend file collection as Admin — and, since the Media Library work order (2026-09-09), the same folder/usage rules Admin's own screen enforces. Inserting an image updates the draft; saving the record persists the field. Uploading itself immediately creates a shared file, even if you later cancel the record edit. The picker's photo grid and folder filter are server-paged/server-filtered (`GET /api/upload?search=&folder=&page=&limit=`), not fetched-whole-then-filtered-client-side as before — that stopped scaling once the backend's `GET /api/upload` started honouring pagination for real; `?folders=1` on the same route returns the distinct folder list.

- Edit CMS content blocks; browse, arrange, **create, and edit** banners, courses, services, countries, universities, success stories, success videos, blog posts, gallery items, partners, reviews, team members, and FAQ groups.
- All 16 public pages have a preview, including the sitewide top bar (the `/topbar` doc that backs the site's phone number and WhatsApp link), the logo and the footer.
- The left sidebar's All content library exposes every loaded record, including records that are not placed on a preview page.
- CMS drawer controls (`contents` only) use the backend Content schema, filtered by the frontend section's actual field usage in `src/lib/content-fields.ts`. Nested cards are filtered too. Unused fields and unmapped content are hidden without deleting stored values. That list is audited against the frontend's consumers — when a frontend section starts reading a new field, add it there in the same piece of work or it stays uneditable here.
- **Every other resource's create/edit form is rendered directly from the backend**, not hand-built in the editor: `GET /<resource>/get/config` returns the exact `form` array Admin's `FormMain` renders, built from that model's `config.ts` + `settings.ts`. A field added there appears in the editor with no editor change. Clicking a record's card opens its edit form (`ConfigFormEditor` in `EditorPanel.tsx`); the collection heading row's **"+ Add …"** button (shown only when the admin's role has `create-<resource>`) opens the same component in create mode. **Arrange order** opens the priority list — reordering, and the priority list's own **Edit** button, are unchanged.
  - The write allowlist is exactly the flattened set of `form[].name` from `get/config`, minus any field with `isExcluded` — precisely what Admin itself posts (`writableFormFields`/`invalidRecordWriteKeys` in `src/lib/resources.ts`; enforced server-side in `src/app/api/resources/[resource]/route.ts` and `.../[resource]/[id]/route.ts`, which also check the admin's own `create-`/`edit-<resource>` permission via `can()` in `src/lib/auth.ts` before ever calling the backend — the backend enforces the same permission again regardless).
  - `data-menu`/`data-tag` fields (a course's `university`, a gallery item's legacy `destination`/`package`) get their options from `data[model]` when the model is one of our 14 resources, or from `GET /api/resources/options/[model]` otherwise — that route only ever proxies a hardcoded model allowlist (`OPTION_MODELS`), never an arbitrary path.
  - A field's `renderCondition` (the backend serializes it with `.toString()`) and `getValue` (a function) are never evaluated or used — both arrive unusable/unsafe over the wire. Fields with a `renderCondition` render unconditionally; none of the 13 resources' forms carry one as of 2026-09-08.
  - The `seo` sub-document spread into most models gets a dedicated subform (`SeoControl`) — the core fields, `ogImage` through the photo library, `keywords` as a list, `ogType`/`twitterCard` as selects, and `robots`/`sitemap` behind a disclosure — not a raw JSON textarea.
  - A blog post's `slug` has no pre-save generator (course/country/university/service/success-story all do); its field gets a "Generate from title" button mirroring the models' own slugify algorithm.
- Image fields (including nested cards and image arrays) provide a shared photo-library picker. Browse/search uploaded photos, filter by folder, upload images up to 10 MB, or paste HTTP(S) URLs and local image paths. The gallery uses the same backend file collection as Admin — and, since the Media Library work order (2026-09-09), the same folder/usage rules Admin's own screen enforces. Inserting an image updates the draft; saving the record persists the field. Uploading itself immediately creates a shared file, even if you later cancel the record edit. The picker's photo grid and folder filter are server-paged/server-filtered (`GET /api/upload?search=&folder=&page=&limit=`), not fetched-whole-then-filtered-client-side as before — that stopped scaling once the backend's `GET /api/upload` started honouring pagination for real; `?folders=1` on the same route returns the distinct folder list. Image fields upload through the editor's own `/api/upload` route, which checks the session, rejects non-images and anything over 10 MB, then forwards to the backend's S3 upload.
- Existing endpoint records can be reordered with drag handles or the Arrange order priority list; the order is persisted through their existing `priority` field.
- Homepage universities and countries can be selected and ordered independently. Selection IDs are stored in the relevant Content document's existing `list` field (`top-universities` and `/home-countries`), both of which the public homepage reads.
- There is deliberately **no homepage courses rail**. `/home-courses` used to appear here, but the public homepage has no courses section, so it was editing a setting nothing consumed. Courses remain fully editable and re-orderable on the `/courses` page preview and in the All content library. If a home courses section is ever built on the frontend, add a `HOMEPAGE_COLLECTIONS` entry back in `src/lib/resources.ts`.

## Security model

- There is no separate editor login. The admin launcher transfers the bearer token with an exact-origin `postMessage` handshake; the token is never placed in the URL.
- The editor validates the admin account and requires view/edit Contents access before creating a session.
- The bearer is encrypted into a short-lived `HttpOnly`, `SameSite=Lax` cookie and is used only by server-side editor routes.
- Write routes use exact-origin checks, resource allowlists, a per-field write guard (the `contents` schema minus immutable fields for the drawer; every other resource's `get/config` form minus `isExcluded` fields — see "What can be edited"), payload bounds, and the existing backend permission middleware.
- The editor also checks the admin's own `create-`/`edit-<resource>` permission before forwarding a create/edit request, so the UI doesn't offer an action a role can't use — but this is a UI nicety, not the enforcement boundary: the backend independently enforces the same collection-specific permission on every request regardless of what the editor checked.

## Editor behavior

Page navigation exists only in the editor's left sidebar. Every link and CTA rendered inside the preview is an inert button. Hovering editable content reveals a gold rectangle and an `endpoint · slug` tooltip; clicking it opens the right sidebar.

Editing is live: every keystroke in the right sidebar re-renders that record in the preview, so unsaved changes are visible on the page before you commit them. Cancel discards the draft and the preview returns to the saved values; nothing reaches the backend until Save. Desktop, tablet, and mobile preview widths use container-responsive layouts to prevent cards and long content from breaking the editor shell.
