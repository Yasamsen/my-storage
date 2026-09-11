# MyStorage

Personal cloud file storage — like a simplified Google Drive.

**Stack:** HTML/CSS/JS (vanilla) · Node.js · Express · MongoDB · Object storage (R2 / S3 / local)

---

## Features

- Register / Login (JWT + httpOnly cookie, bcrypt passwords)
- Upload files (multi-file, drag & drop, progress)
- Folders (create, navigate, breadcrumb)
- Download, rename, soft-delete → Trash, restore, permanent delete
- File preview (image, video, audio, PDF, text/JSON)
- Share links (public page, optional expiry)
- Search, sort, filter by type
- Grid / list view, multi-select
- Storage quota (default 20 GB) with usage stats
- Dark / light theme
- Responsive (desktop + mobile)
- Activity feed on dashboard

---

## Quick start

### 1. Requirements

- Node.js 18+
- MongoDB (local or Atlas)

### 2. Install

```bash
cd my-storage
cp .env.example .env
npm install
```

### 3. Configure `.env`

Minimal local development:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/mystorage
JWT_SECRET=change-this-to-a-long-random-secret-key
STORAGE_PROVIDER=local
LOCAL_STORAGE_PATH=./uploads
DEFAULT_STORAGE_LIMIT_GB=20
APP_URL=http://localhost:3000
```

### 4. Run MongoDB

**Local:**

```bash
# macOS (Homebrew)
brew services start mongodb-community

# Docker
docker run -d -p 27017:27017 --name mongo mongo:7
```

**Atlas:** create a free cluster and paste the connection string into `MONGODB_URI`.

### 5. Start the server

```bash
npm start
# or with auto-reload
npm run dev
```

Open **http://localhost:3000**

---

## Storage providers

`STORAGE_PROVIDER` can be:

| Value   | Description                                      |
|---------|--------------------------------------------------|
| `local` | Files on disk under `LOCAL_STORAGE_PATH` (dev)   |
| `r2`    | Cloudflare R2                                    |
| `s3`    | AWS S3                                           |

### Cloudflare R2

```env
STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=mystorage
R2_PUBLIC_URL=https://pub-xxx.r2.dev   # optional
```

Create an R2 bucket and an API token with Object Read & Write.

### AWS S3

```env
STORAGE_PROVIDER=s3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET=mystorage
```

The storage layer is abstracted in `_lib/storage.js` — switching providers does not require frontend changes.

---

## Project structure

```
my-storage/
├── public/           # Frontend (HTML, CSS, JS)
├── api/              # Express route modules
├── _lib/             # database, auth, storage, upload, response
├── models/           # Mongoose models
├── server.js
├── package.json
└── .env.example
```

---

## API overview

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Current user |
| GET | `/api/files` | List files/folders |
| POST | `/api/files/upload` | Upload |
| GET | `/api/files/:id` | File info |
| GET | `/api/files/:id/download` | Download |
| GET | `/api/files/:id/stream` | Stream (preview) |
| PATCH | `/api/files/:id/rename` | Rename |
| PATCH | `/api/files/:id/move` | Move |
| DELETE | `/api/files/:id` | Soft delete |
| DELETE | `/api/files/:id/permanent` | Permanent delete |
| POST | `/api/files/:id/restore` | Restore from trash |
| GET/POST | `/api/folders` | List / create folders |
| PATCH/DELETE | `/api/folders/:id` | Rename / delete folder |
| POST | `/api/share/:fileId` | Create share link |
| GET | `/api/share/:token` | Public share info |
| GET | `/api/storage` | Storage usage |
| GET | `/api/activity` | Recent activity |

All JSON responses:

```json
{ "success": true, "message": "...", "data": {} }
```

---

## Deployment notes

- Prefer **object storage** (`r2` or `s3`) in production — never rely on local disk for permanent files on serverless hosts.
- Set a strong `JWT_SECRET` and `NODE_ENV=production`.
- Use MongoDB Atlas for managed DB.
- For Vercel/similar: the Express app needs a serverless adapter or a long-running host (Railway, Render, Fly.io, VPS). Static frontend can be served by the same Express process.
- Configure CORS / `APP_URL` to your public domain.

---

## Security highlights

- Passwords hashed with bcrypt (12 rounds)
- JWT in httpOnly cookie (+ Bearer fallback)
- Auth middleware on all private routes
- Ownership checks on every file/folder operation
- Filename sanitization, UUID storage keys
- Rate limiting on auth and general API
- Helmet, CORS, no secrets in frontend

---

## License

MIT
