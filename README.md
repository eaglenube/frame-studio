# Frame Studio — Video to Image Extractor

A small, production-ready web app that lets you upload a video, choose extraction
options (FPS, quality, format, resize), watch a live progress bar, browse the
extracted frames in a gallery, download any subset as a ZIP, **or save selected
frames directly to a folder in your Google Drive**.

Built with Express 5, Sequelize 6 (PostgreSQL), EJS, Bootstrap 5, Passport
("Sign in with Google"), the Google Drive API, and `fluent-ffmpeg` powered by the
bundled `@ffmpeg-installer/ffmpeg` binary — so you don't need to install FFmpeg
system-wide.

---

## Prerequisites

- **Node.js 18 or newer** (this project was built and tested on Node 22)
- **PostgreSQL** running locally (or anywhere you can reach over the network)

That's it. FFmpeg ships inside `node_modules` automatically.

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Edit .env to match your PostgreSQL credentials and (optionally) Google
#    OAuth credentials. See "Connecting Google Drive" below.

# 3. Create the database (one-time)
npm run db:create

# 4. Run migrations
npm run db:migrate

# 5. Start the dev server (auto-reload via nodemon)
npm run dev
```

Then open <http://localhost:3000>. You'll be redirected to the sign-in page —
click **Continue with Google** to sign in. (If Google OAuth isn't configured yet,
the sign-in page tells you what's missing.)

For production-style start (no auto-reload):

```bash
npm start
```

---

## Connecting Google Drive (one-time setup)

Frame Studio uses "Sign in with Google" as the login method, and the **same
authorization** also grants the app permission to save files to your Drive. You
must register the app once in Google Cloud Console to get the credentials.

### 1. Create a Google Cloud project

1. Go to <https://console.cloud.google.com/projectcreate> and create a new
   project (any name, e.g. *Frame Studio*).

### 2. Enable the required APIs

In the new project, open **APIs & Services → Library** and enable:

- **Google Drive API**

### 3. Configure the OAuth consent screen

**APIs & Services → OAuth consent screen**:

- User type: **External** (or Internal if you have Google Workspace)
- App name: *Frame Studio*
- User support email: your email
- Developer contact: your email
- **Scopes**: add
  - `openid`
  - `.../auth/userinfo.email`
  - `.../auth/userinfo.profile`
  - `https://www.googleapis.com/auth/drive.file`
  - `https://www.googleapis.com/auth/drive.metadata.readonly`
- **Test users**: add your own Google account email (required while the app is
  in *Testing* mode)

### 4. Create an OAuth 2.0 client ID

**APIs & Services → Credentials → + Create credentials → OAuth client ID**:

- Application type: **Web application**
- Name: *Frame Studio Web Client*
- **Authorized JavaScript origins**: `http://localhost:3000`
- **Authorized redirect URIs**: `http://localhost:3000/auth/google/callback`

Copy the **Client ID** and **Client secret** that appear.

### 5. Drop the values into `.env`

```env
APP_URL=http://localhost:3000
GOOGLE_CLIENT_ID=<paste step 4 client id>
GOOGLE_CLIENT_SECRET=<paste step 4 client secret>
```

`GOOGLE_API_KEY` and `GOOGLE_APP_ID` are no longer required — Frame Studio
ships its own in-app folder explorer.

Then restart the server. Visit <http://localhost:3000>, sign in with Google,
extract some frames, select a few, and click **Save to Drive** in the gallery —
a folder explorer opens where you can navigate, create new folders, and pick a
destination, then the images upload there.

---

## How to use

No account needed for the core flow — just open the site and start uploading.
Sign-in is only required if you want to **save to Drive**.

1. **Upload** — drag a video onto the home page or click to browse. Supported
   formats: MP4, MOV, AVI, MKV, WEBM. Max size is set in `.env` (default 500 MB).
3. **Options** — choose frames-per-second (0.1–30), image quality (1–10),
   output format (JPG/PNG), and an optional resize width.
4. **Progress** — watch the bar fill as FFmpeg extracts. The page polls the
   server once a second.
5. **Gallery** — when extraction finishes you're redirected to a grid view.
   - Click thumbnail cards to select them.
   - Click the fullscreen icon on any thumbnail to open the **lightbox preview**
     (use ←/→ to navigate, `Esc` to close, `Space` to select).
   - **Download selected (ZIP)** — zips the selection and saves locally.
   - **Save to Drive** — first click takes you through "Sign in with Google"
     (one time), then opens the Google Picker so you can choose a folder.
     Subsequent clicks skip straight to the picker.
   - In the lightbox, **Download** saves the single frame; **Save to Drive**
     saves just that one image (also triggers sign-in if needed).

---

## Project layout

```
video-to-image-app/
├── config/                  # Sequelize config
├── controllers/             # upload, process, download controllers
├── middleware/              # error handler
├── migrations/              # Sequelize migrations
├── models/                  # Job, Image
├── public/
│   ├── css/style.css        # Custom design system on top of Bootstrap 5
│   ├── js/                  # upload, options, progress, gallery scripts
│   ├── uploads/             # Uploaded videos (gitignored)
│   └── extracted/           # Extracted frames, organised by jobId (gitignored)
├── routes/                  # Route definitions
├── services/videoProcessor.js  # fluent-ffmpeg extraction + progress
├── views/                   # EJS templates (layout + pages)
├── server.js                # Express app entry point
├── .env / .env.example
└── package.json
```

---

## npm scripts

| Script              | What it does                                            |
| ------------------- | ------------------------------------------------------- |
| `npm run dev`       | Start with nodemon (auto-reload on file change)         |
| `npm start`         | Plain `node server.js`                                  |
| `npm run db:create` | Create the database named in `.env`                     |
| `npm run db:migrate`| Run all pending migrations                              |
| `npm run db:rollback` | Roll back **all** migrations (drops tables!)           |
| `npm run db:reset`  | Rollback + migrate                                      |

---

## Troubleshooting

### "Database … does not exist" / connection refused
- Make sure `postgres` is running (`pg_isready`).
- Check `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_HOST`, `DB_PORT` in `.env`.
- Run `npm run db:create` once before `npm run db:migrate`.

### Upload fails with "Unsupported file type"
- Only MP4, MOV, AVI, MKV, WEBM are accepted. Use HandBrake or `ffmpeg` to
  convert other formats first.

### Upload fails with "File is too large"
- Raise `MAX_UPLOAD_MB` in `.env` and restart the server.

### Extraction status stays `failed`
- Open the `/progress/:jobId` page — the error message from FFmpeg is shown
  in the red banner. Most failures are bad/corrupt input files.
- The server logs the full FFmpeg stderr — check the terminal where you ran
  `npm run dev`.

### Where are the files on disk?
- Uploaded videos: `public/uploads/{uuid}.{ext}`
- Extracted frames: `public/extracted/{jobId}/frame-XXXXXX.{jpg|png}`
- Both directories are git-ignored — safe to delete to reclaim space.

### "Sign in with Google" loops or shows "access_denied"
- Confirm the OAuth client's **Authorized redirect URI** exactly matches
  `http://localhost:3000/auth/google/callback` (scheme, host, port, path).
- While the consent screen is in *Testing* mode, only the **Test users** you
  added in the consent screen step can sign in.
- Make sure the **Google Drive API** is enabled.

### Folder explorer says "Insufficient Permission" or lists nothing
- After adding the new `drive.metadata.readonly` scope, **sign out and sign in
  again** so Google grants the broader access. The new consent screen will
  mention "See information about your Google Drive files".

### Drive upload fails with "Login Required" or 401
- The stored access token may have expired and your account has no refresh
  token. Sign out, then sign in again — the consent screen will mint a new
  refresh token.

---

## License

MIT
