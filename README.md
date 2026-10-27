# E-library

E-library is a standalone private reading workspace based on the Library POC. SANAD is a separate app. Readers can browse Duas, Hadiths, and Quotes; upload PDF or DOCX books with one of six cover palettes; and keep notes, favourites, collections, and reading reflections across devices.

## Stack

- Next.js App Router and React
- Neon Postgres for accounts and library data
- Better Auth for email or username login, password hashes, and sessions
- Private Vercel Blob storage for book files
- Vercel hosting connected to `Omars64/E-library`

## Local setup

1. Run `npm install`.
2. Link the existing Vercel project: `vercel link --scope fred-tactical-corporation-ftc --project e-library`.
3. Copy `.env.example` to `.env.local`. Set `DATABASE_URL` from the dedicated Neon database, `BLOB_READ_WRITE_TOKEN` from the private Blob connection, a generated `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL=http://localhost:3000`. Never commit these values.
4. Create Better Auth's tables first: `npx @better-auth/cli@1.4.22 migrate --config src/lib/auth.ts --yes`.
5. Run `npm run db:migrate` and `npm run db:seed` for the app tables and starter catalog.
6. For a new database only, run `npm run db:bootstrap-admin` and enter the initial admin password at its prompt. The script creates `omarsolanki46@gmail.com` with username `omar`, refuses to overwrite an existing account, and stores a Better Auth password hash.
7. Run `npm run dev` and open `http://localhost:3000`.

The database and storage connections for the FTC Vercel project have already been provisioned. Do not rerun the admin bootstrap on the existing production database.

## Access and data

There is no public sign-up. An administrator creates reader accounts in **People & access**. Readers sign in with an email address or username and a password of 8–128 characters containing at least one special character. Books, notes, folders, favourites, collections, and progress are scoped to the signed-in user. Uploaded files are kept in a private Blob store and served through authenticated routes.

PDFs open in the built-in reader. DOCX files can be opened or downloaded in a Word-capable app. Uploads are limited to 50 MB and validated by file type and signature. Users are responsible for having the right to upload and store their documents.

## Deployment

The Vercel project is `fred-tactical-corporation-ftc/e-library`, connected to the `Omars64/E-library` GitHub repository. Production and Preview have Neon and private Blob connections. Set `BETTER_AUTH_SECRET` for both environments and the production `BETTER_AUTH_URL` to the deployed HTTPS origin. Database migrations are run separately before deployment; they are not part of the build.

Run `npm run typecheck` and `npm run build` before pushing. A push to the connected repository triggers deployment. Verify admin sign-in, reader creation and sign-in, book upload and private download, notes, collections, and mobile layout on the deployed URL.
