# 🎬 Sparky Screen Recorder

Feature-rich screen recording suite with Vimeo publishing, CRM-style customer lookup, and Supabase-backed authentication.

## ✨ Highlights

- **Screen + Audio Capture** — Modern recording UX with live meters, device persistence, and quick reset flows.
- **Vimeo Workflow** — Resumable TUS uploads, automatic metadata tagging, and folder routing for ID `26555277`.
- **Customer Intelligence** — Customer list, per-user recording history, and rich filtering sourced from Vimeo descriptions.
- **Role-Based Access** — Supabase auth drives navigation, admin controls, and read-only customer views.
- **Static + Next.js Hybrid** — High-performance static dashboards served alongside Next.js API routes.

## 🗂️ Project Structure

| Path | Purpose |
| --- | --- |
| `public/` | Static dashboard, recorder UI, helper scripts, and shared header. |
| `pages/api/` | Serverless API routes for Vimeo + Supabase integrations. |
| `routes/`, `server*.js` | Express utilities used for local testing and scripting. |
| `.env.example` | Template for required runtime secrets. |

## 🚀 Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` (or `.env`) and set:

```
VIMEO_ACCESS_TOKEN=your_token
VIMEO_CLIENT_ID=your_client_id
VIMEO_CLIENT_SECRET=your_client_secret
VIMEO_FOLDER_ID=26555277
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=service_role_key
SUPABASE_ANON_KEY=public_anon_key
``` 

> ℹ️  The Supabase anon key is used in the browser, while the service key powers server-side writes in the Express helpers.

### 3. Run the app

```bash
npm run dev
```

The static dashboard is available at `http://localhost:3000/public/index.html`, while API endpoints live under `http://localhost:3000/api/*`.

### 4. Deploy to Vercel (optional)

```bash
npx vercel
```

After the first deploy, wire up the same environment variables in the Vercel dashboard (`npm run lint`/`build` still apply locally).

### 5. Recommended checks

```bash
npm run lint
npm run build
```

## 🧰 Available Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Next.js dev server (Turbopack) with access to static assets. |
| `npm run build` | Production build for Next.js APIs. |
| `npm run start` | Run the production server locally. |
| `npm run lint` | Lints the API routes and config. |
| `npm run serve` | (Optional) Launch Express helper `server.js` for full-stack local testing. |

## 🌐 Deployment

The project deploys cleanly to Vercel. After `vercel link`, ensure the following environment variables are added in the Vercel dashboard:

- `VIMEO_ACCESS_TOKEN`
- `VIMEO_CLIENT_ID`
- `VIMEO_CLIENT_SECRET`
- `VIMEO_FOLDER_ID`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Optionally add `SUPABASE_SERVICE_KEY` if you deploy the Express helpers separately.

## 🎯 Key API Routes

| Endpoint | Description |
| --- | --- |
| `POST /api/upload-vimeo` | Creates a Vimeo TUS upload session. |
| `POST /api/finalize-vimeo` | Applies metadata + folder assignment after upload. |
| `GET /api/vimeo-folder/[id]` | Lists fully tagged videos for a folder. |
| `GET /api/all-user-videos/[email]` | Filters Vimeo folder videos by recorder email. |
| `GET /api/get-all-customers` | Extracts unique customers from Vimeo metadata. |

## 🛡️ Security Notes

- Never commit raw `.env` files—use the provided template.
- Supabase keys should be rotated if leaked; service keys must stay server-side.
- Vimeo uploads rely on HTTPS—ensure browsers requesting `/api/upload-vimeo` are on trusted origins.

## 📚 Further Reading

- [Vimeo Upload API (TUS)](https://developer.vimeo.com/api/upload/videos#resumable-uploads)
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Next.js API Routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes)

Happy recording! 🎥
