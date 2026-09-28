# Verdex Quotes v129 — Cloudflare production merge

This package starts from the fresh v129 Work export and keeps the production changes needed for the independent Cloudflare deployment at `quotations.verdex.com.au`.

## Preserved production changes

- Production D1 database ID in `vite.config.ts`:
  `a55a5bcb-f093-498f-a315-5a45c9789a0a`
- Standard Verdex email/password authentication backed by D1 sessions.
- Cloudflare Access can remain temporarily during rollout, then should be removed after application login is tested.
- R2 is now optional at deploy time. Set `VERDEX_R2_BUCKET_NAME` in the Cloudflare build environment after creating the production R2 bucket; it will bind as `BUCKET`.
- Original v129 UI, API, integrations, migrations and assets are otherwise retained.

## Before deploying v129

### 1. Upgrade the existing D1 database

The live database already has migrations 0000 and 0001. Run the included file:

`cloudflare-production-migrations-0002-to-0007.sql`

in Cloudflare D1 Console for the existing Verdex Quotes database. Do this once only.

### 2. Set the bootstrap administrator

The v129 workspace permissions system needs one trusted bootstrap Super Administrator.
In Cloudflare Worker runtime environment variables, set:

`COST_ADMIN_USER_IDS=<the exact email address of the protected bootstrap Super Administrator>`

This value protects the original Super Administrator record and enables the one-time password bootstrap described below.

Do not set this to a whole domain. Use only the trusted administrator email(s), comma-separated if needed.

### 3. R2 storage (recommended for full v129 functionality)

Create an R2 bucket, for example `verdex-quotes-storage`, then add this **build-time** environment variable to the Cloudflare Git build configuration:

`VERDEX_R2_BUCKET_NAME=verdex-quotes-storage`

R2 is used by v129 for saved workspace settings, integration credentials, custom product images, freight settings, payment connection data and other runtime storage. The Worker can deploy without R2, but those features will report storage/configuration errors until the binding exists.

### 4. Runtime secrets / variables

Preserve or recreate any production values already in Cloudflare. Depending on the features you enable, v129 supports:

- `HUBSPOT_ACCESS_TOKEN`
- `HUBSPOT_CREDENTIAL_KEY`
- `EWAY_CREDENTIAL_KEY`
- `PAYPAL_CREDENTIAL_KEY`
- `COST_SHEET_ID`
- `COST_SHEET_TAB`
- `COST_SOURCE_MODE`
- `TWO_FACTOR_REQUIRED`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFY_SERVICE_SID`

Do not commit secrets to GitHub.

## GitHub deployment

Replace the contents of the existing private `quotes` repository with the contents of this folder, commit, and push to `main`. Cloudflare Git integration should then build and deploy automatically.

Before replacing the repo, keep a copy/commit of the currently working production version so it is easy to roll back.

## Important database note

Do not create a new D1 database. The configured ID above points to the existing production database. The source package contains schema/migrations only; live quote records remain in D1 and are not in this ZIP.

## Validation performed on this merged package

The modified TypeScript files passed a TypeScript transpile/syntax check. A full dependency install/build could not be run in the packaging environment because outbound package-registry access was unavailable. Cloudflare's connected Git build is therefore the final full build verification step.

## Standard Verdex login
See `STANDARD-LOGIN-AND-HUBSPOT-SETUP.md`. Apply `cloudflare-production-migration-0008-standard-login.sql`, set passwords in Users while Cloudflare Access is still enabled, test `/login`, then disable Cloudflare Access for the quotations hostname.

## HubSpot credential storage
The in-app HubSpot token connection requires the runtime secret `HUBSPOT_CREDENTIAL_KEY` plus the existing `BUCKET` R2 binding.
