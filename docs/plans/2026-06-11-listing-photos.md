# Listing photo management + mobile upload — Plan

**Goal:** console listings show the ref code; tapping a row opens the editor with an image manager
(reorder via up/down, Make cover, remove, add) and photo upload works from a phone's camera/gallery.

## Group A — backend (TDD)
- **Security fix:** owner-scope `POST /api/properties/:id/photos` (currently only checks uuid+exists —
  add `ownedListing(c,id)` → 403 for foreign/none). Keep multipart upload + `addPropertyPhotos`.
- core `setPropertyPhotos(db, id, photos: string[])` in listings.ts — `db.update(...).set({photos})`.
- web `POST /api/listings/:id/photos` `{ photos: string[] }` (owner-scoped, bodyLimit): validate the
  array is a **subset/permutation of the listing's existing photos** (so this endpoint can only
  reorder/remove, never inject arbitrary URLs — new photos come only via the upload endpoint);
  `setPropertyPhotos`; return updated. 400 on non-subset.
- The upload endpoint returns `{ photos }` (full updated array) — already does.
- Tests (api.test.ts): upload to a foreign agency's listing → 403; reorder with a permutation persists
  new order; reorder/remove with a URL not in existing → 400; remove (subset) works; owner-only.
- Commit `feat(web): owner-scope photo upload + reorder/remove listing photos`.

## Group B — console (apps/app)
- `lib/api.ts`: `uploadListingPhotos(token,id,files:File[])` (multipart → `/api/properties/:id/photos`,
  field name `file`, returns `{photos}`); `setListingPhotos(token,id,photos:string[])` (POST
  `/api/listings/:id/photos`). 
- `lib/files.ts` (web): `pickImages(): Promise<File[]>` — create a hidden `<input type="file"
  accept="image/*" multiple>`, click it, resolve File[] on change (opens camera/gallery on mobile).
- `agency.tsx`:
  - `ListingRow`: show the **ref code** (e.g. `ST-1230`) as a small chip near the title; keep the
    thumbnail (cover = photos[0]) + title + city. Make the whole row pressable → opens the editor
    (same as Izmijeni). Keep Edit/Delete buttons.
  - `EditModal`: add an **Images** section above the fields. Local `photos` state seeded from the
    listing. Render each photo thumbnail in order with: ↑/↓ move (or ←/→), **Make cover** (move to
    index 0), **✕ remove**; the first is labelled "cover". Each reorder/remove calls
    `setListingPhotos(token,id,newOrder)` and updates state (persists immediately). An **Add photos**
    button → `pickImages()` → `uploadListingPhotos` → set state to returned photos. Show a busy state.
  - Add-listing form: an **Add photos** button collecting `File[]` into local state (preview count);
    on create: `createListing(...)` → if files, `uploadListingPhotos(token, created.id, files)` →
    refresh. (Upload needs the new id, so create first.)
  - i18n keys (en+sr): `listings.images`, `listings.addPhotos`, `listings.cover`, `listings.makeCover`,
    `listings.removePhoto`, `listings.uploading`, `listings.noPhotos`.
- Verify typecheck + expo export + `pnpm check:i18n`.
- Commit `feat(app): listing image manager (reorder/cover/remove/upload) + ref code in rows`.

## Group C — deploy
- Merge, push. Backend image rebuild + roll. Console rebuild (`--clear`) + SWA deploy. Verify on a
  phone/narrow: row shows ST-code; tap → editor; add a photo from gallery; reorder + make cover +
  remove; the cover shows on the row + the white-label card. Use a throwaway/draft listing; revert.

## Notes
- Photo paths stay `properties/<id>/photo-N.<ext>`; uploads get the immutable Cache-Control (storage).
- Reorder endpoint is subset-validated → no arbitrary-URL injection. Upload endpoint now owner-scoped.
- File picker is web-only (console is web) via document.createElement — no expo-image-picker dep.
