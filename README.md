# Frame Studio — Video to Image Extractor

A small, production-ready web app that lets you upload a video, choose extraction
options (FPS, quality, format, resize), watch a live progress bar, browse the
extracted frames in a gallery, and download any subset of them as a ZIP.

Built with Express 5, Sequelize 6 (PostgreSQL), EJS, Bootstrap 5, and
`fluent-ffmpeg` powered by the bundled `@ffmpeg-installer/ffmpeg` binary — so you
don't need to install FFmpeg system-wide.

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

# 2. Edit .env to match your PostgreSQL credentials
#    (defaults: localhost:5432, user/pass = kumolus_dev, db = vdo_to_img_web_dev)

# 3. Create the database (one-time)
npm run db:create

# 4. Run migrations
npm run db:migrate

# 5. Start the dev server (auto-reload via nodemon)
npm run dev
```

Then open <http://localhost:3000>.

For production-style start (no auto-reload):

```bash
npm start
```

---

## How to use

1. **Upload** — drag a video onto the home page or click to browse. Supported
   formats: MP4, MOV, AVI, MKV, WEBM. Max size is set in `.env` (default 500 MB).
2. **Options** — choose frames-per-second (0.1–30), image quality (1–10),
   output format (JPG/PNG), and an optional resize width.
3. **Progress** — watch the bar fill as FFmpeg extracts. The page polls the
   server once a second.
4. **Gallery** — when extraction finishes you're redirected to a grid view.
   Click cards to select, "Load more" to paginate, and "Download selected
   (ZIP)" to grab a zipped archive of just the frames you want.

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

---

## License

MIT
