# AGS Visual Editor

A standalone, authenticated visual content editor for Akashbari Global Services. It owns its complete preview renderer and does not embed, import, or modify `ags-frontend`.

## Status

Feature-complete and verified locally against the AGS backend: type-check, lint, and a production build are clean, and every page and collection in the sidebar renders. The repository has **no git remote** — create the GitHub repo and add `origin` before the first push.

## Local setup

1. Copy `.env.example` to `.env.local` and configure the backend, admin/editor origins, and a strong session secret.
2. Keep `NEXT_PUBLIC_EDITOR_ORIGIN` configured in `ags-admin` so its `/visual-editor` launcher can transfer the current admin session.
3. Run the backend on port 5000, admin on port 3001, and this project with `npm run dev` on port 3002.
4. Sign in to AGS admin, visit `/visual-editor`, and open the editor.

The public frontend does not need to run for the visual editor to work.

The preview is an editor-owned rendering of the content, not a pixel-for-pixel copy of every public-site page. Saving updates existing backend records. New homepage selection settings (especially `/home-courses`) affect the public website only when that frontend reads those settings; this project does not install that integration or change the frontend.

## What can be edited

Image fields (including nested cards and image arrays) provide a shared photo-library picker. Browse/search uploaded photos, filter by folder, upload images up to 10 MB, or paste HTTP(S) URLs and local image paths. The gallery uses the same backend file collection as Admin. Inserting an image updates the draft; saving the record persists the field. Uploading itself immediately creates a shared file, even if you later cancel the record edit.

- Edit CMS content blocks; browse and arrange banners, courses, services, countries, universities, success stories, blog posts, galleries, partners, reviews, team members, and FAQ groups.
- All 15 public pages have a preview, including the sitewide top bar (the `/topbar` doc that backs the site's phone number and WhatsApp link), the logo and the footer.
- The left sidebar's All content library exposes every loaded record, including records that are not placed on a preview page.
- CMS drawer controls use the backend Content schema, filtered by the frontend section's actual field usage in `src/lib/content-fields.ts`. Nested cards are filtered too. Unused fields and unmapped content are hidden without deleting stored values.
- Records from other APIs (including courses, banners, services, and universities) are read-only in the editor. Clicking them opens a priority list with drag/drop and move buttons. Update their data in Admin; the editor API rejects direct edits.
- Image fields upload through the editor's own `/api/upload` route, which checks the session, rejects non-images and anything over 10 MB, then forwards to the backend's S3 upload. Pasting a URL still works, and gallery fields accept a multi-file upload that appends to the list.
- Existing endpoint records can be reordered with drag handles; the order is persisted through their existing `priority` field.
- Homepage courses, universities, and countries can be selected and ordered independently. Selection IDs are stored in the relevant Content document's existing `list` field. `/home-courses` is created on first save if needed; courses themselves continue to be created only from Admin.

## Security model

- There is no separate editor login. The admin launcher transfers the bearer token with an exact-origin `postMessage` handshake; the token is never placed in the URL.
- The editor validates the admin account and requires view/edit Contents access before creating a session.
- The bearer is encrypted into a short-lived `HttpOnly`, `SameSite=Lax` cookie and is used only by server-side editor routes.
- Write routes use exact-origin checks, resource allowlists, backend schema field allowlists, payload bounds, and the existing backend permission middleware.
- The backend itself still enforces the collection-specific permissions for courses, services, countries, and other resources.

## Editor behavior

Page navigation exists only in the editor's left sidebar. Every link and CTA rendered inside the preview is an inert button. Hovering editable content reveals a gold rectangle and an `endpoint · slug` tooltip; clicking it opens the right sidebar.

Editing is live: every keystroke in the right sidebar re-renders that record in the preview, so unsaved changes are visible on the page before you commit them. Cancel discards the draft and the preview returns to the saved values; nothing reaches the backend until Save. Desktop, tablet, and mobile preview widths use container-responsive layouts to prevent cards and long content from breaking the editor shell.
