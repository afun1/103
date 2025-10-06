# API Routes

This project still ships a small collection of Next.js API routes that power Vimeo
uploads, folder listings, and customer summaries used by the static dashboard in
`public/`.

Key entry points:

- `POST /api/upload-vimeo` – provisions a Vimeo resumable upload session or falls
	back to the legacy base64 workflow.
- `POST /api/finalize-vimeo` – stamps metadata on the video and moves it into the
	target folder.
- `GET /api/all-user-videos` and `GET /api/all-user-videos/[email]` – return videos
	recorded by a specific team member.
- `GET /api/vimeo-folder/[id]` – lists all videos (with parsed metadata) for a
	Vimeo folder.
- `GET /api/get-all-customers` / `GET /api/customers` – derive unique customers
	from Vimeo descriptions for quick lookup.

The implementations share a helper module in `lib/vimeo.js` that handles the API
pagination, metadata parsing, and default folder IDs. These routes are invoked by
TUS uploads and customer search widgets inside `public/index.html`.