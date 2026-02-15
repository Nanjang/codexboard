# CodexBoard Architecture

## Stack
- API: NestJS + Prisma + MariaDB + Redis session
- Web: Next.js SSR
- Storage: local filesystem (`uploads`)

## Key Policies
- Single site only (no tenant split)
- Gnuboard-style permissions and route compatibility
- UUIDv7 stored filename + original filename metadata
- SHA-256 hash for uploaded files

## API Modules
- `AuthModule`: login/logout/me
- `BbsModule`: list/read/write/reply/comment/delete/download/good/search/password
- `AdminModule`: group and board policy management

## Data Modeling
- Core tables: `users`, `groups`, `boards`, `posts`, `board_files`, `points`
- Flexible board extension:
  - `custom_fields` JSON in `posts`
  - `board_field_schemas` per-board field schema

## File Layout
- Physical path: `uploads/{board_id}/{yy}/{mm}/{dd}/{uuidv7}.{ext}`
- DB fields:
  - `original_filename`
  - `stored_filename` (date subpath + unique filename)
  - `sha256`, mime, ext, size
