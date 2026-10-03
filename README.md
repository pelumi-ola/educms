# EduCMS – Educational Content Management System (Backend API)

Node.js + Express + PostgreSQL REST API for managing courses, articles, announcements and resources, with JWT auth,
role-based access control, content versioning, comment moderation, media uploads, search and an analytics endpoint.

**Live API:** `https://<your-app>.herokuapp.com`  ← replace after deploying
**Repo:** `https://github.com/<your-username>/educms-backend`  ← replace after pushing

## Features
- JWT auth (access + refresh tokens), bcrypt hashing, email verification token
- Roles: `admin`, `editor`, `author`, `subscriber`
- CRUD for posts, categories, tags, comments, media, users
- Content versioning (every content edit is snapshotted; restore any version)
- Drafts / published / archived workflow (authors write drafts; editors & admins publish)
- Full-text search + filtering (category, tag, author, featured, status) + sorting + pagination
- Media upload (Multer, type & size validated) · Optional Redis caching · Activity log
- Analytics overview, rate limiting, Helmet, CORS, structured logging, centralised error handling

## Local setup
```bash
npm install
cp .env.example .env            # edit DB_PASSWORD and the JWT secrets
createdb educms_db
npm run migrate                 # creates tables; SEED=true also adds sample data
npm run dev                     # http://localhost:5000
npm test
```
`npm run migrate:fresh` drops and recreates everything (refused in production).
Seed users: `admin`, `editor`, `author` — all with password `ADMIN_PASSWORD` (default `admin123`; **change it**).

## API (base `/api/v1`)
| Area | Endpoints | Access |
|---|---|---|
| Auth | `POST /auth/register` `POST /auth/login` `POST /auth/refresh` `GET/PUT /auth/me` `POST /auth/change-password` `GET /auth/verify-email/:token` | public / logged in |
| Posts | `GET /posts` (`q, category, tag, author, featured, status, sort, order, page, limit`) · `GET /posts/:idOrSlug` | public (drafts: owner/staff) |
| | `POST /posts` · `PUT /posts/:id` · `DELETE /posts/:id` | author+ (own posts; staff any) |
| | `GET /posts/:id/versions` · `POST /posts/:id/versions/:versionId/restore` | author+ |
| | `POST /posts/:id/like` | public |
| Comments | `GET /posts/:id/comments` | public (approved only) |
| | `POST /posts/:id/comments` | logged in (pending until approved; staff auto-approved) |
| | `GET /comments` · `PATCH /comments/:id/status` | editor+ |
| Categories | `GET /categories` · `POST/PUT/DELETE /categories/:id` | public / editor+ |
| Tags | `GET /tags` · `POST/PUT/DELETE /tags/:id` | public / editor+ |
| Media | `POST /media` (multipart field `file`) · `GET/PATCH/DELETE /media/:id` | author+ |
| Users | `GET/POST /users` · `GET/PUT/DELETE /users/:id` | admin |
| Analytics | `GET /analytics/overview` | editor+ |
| Health | `GET /health` | public |

Responses: `{ "success": true, "message": "...", "data": ... }` / `{ "success": false, "message": "...", "errors": [...] }`.
Send `Authorization: Bearer <access_token>`.

## Deploy to Heroku
```bash
heroku login
heroku create educms-api                     # pick a unique name if taken
heroku addons:create heroku-postgresql:essential-0   # 'mini' has been retired; use the current cheapest plan
heroku config:set NODE_ENV=production \
  JWT_SECRET=$(openssl rand -hex 32) JWT_REFRESH_SECRET=$(openssl rand -hex 32) \
  FRONTEND_URL=https://your-frontend.example.com
# optional: seed an admin + sample data
heroku config:set SEED=true ADMIN_PASSWORD='a-strong-password'
git push heroku main        # the Procfile 'release' phase runs `npm run migrate` automatically
heroku open                 # then check /health
```
`DATABASE_URL` is provided by the add-on and used automatically (SSL enabled in production).
Heroku's filesystem is ephemeral — uploaded files vanish on restart; move uploads to S3 for production (see Next Steps).

## Push to GitHub
```bash
git remote add origin https://github.com/<your-username>/educms-backend.git
git push -u origin main                                    # repo must be Public
```

## Project structure
`src/config` (db, redis) · `src/models` · `src/controllers` · `src/routes` · `src/middleware` (auth, validation, upload, errors) ·
`src/services` (email, cache, activity) · `src/database` (schema.sql, migrate.js) · `tests/`

## Next steps (Master's project)
React admin panel · S3 uploads · Elasticsearch · Redis caching (`REDIS_ENABLED=true`) · WebSockets · more tests · Swagger docs ·
extra security hardening · analytics dashboard · research paper.
