# Verdex Quotes — test application

A working quotation prototype based on Daniel Ovenden's customer quote mockup. Built with React/TypeScript, Vinext and a Cloudflare Worker, with durable D1 quote storage.

## Test workflow

1. Open the site: a sample quote is created for the signed-in owner.
2. Customer view: select extras, save notes, adjust quantities, request a review, download a PDF or record test acceptance.
3. Sales workspace: create a quote, choose Verdex feed products, change prices/freight, save and approve it.
4. Approving stores a revision snapshot. Customer increases and standard-price reductions save directly. Reductions on discounted standard items create a revision requiring sales approval.
5. Return to Customer view and record checkout or PO acceptance. No external order or payment is created.
6. All quotations opens the saved quote list. Create a fresh sample to repeat a scenario.

## What works

Persistent per-owner quotes; editable line pricing and freight; integer-cent GST arithmetic; optional extras; quantity-change approval; immutable snapshots within quote history; optimistic concurrency; expiry checks; customer/team messages; PO reference; PDF download with online link; email text preview; acceptance and decline.

## Intentionally not connected

- Magento product/customer API and live stock/freight/tax services.
- Negotiated-price Magento cart handoff and session transfer.
- HubSpot UI extension, contacts/deals and order event sync.
- Email sending, customer authentication or external customer sharing.
- PO file uploads, margin controls and staff quote-approval roles.

The site is public. `/demo` uses an isolated in-memory quote store that resets on refresh and cannot access account quote records. Normal quote routes require sign-in for saved records. The Customer view is a preview, not a customer-authorised security boundary. API records are scoped to the platform's trusted authenticated user ID; development-only requests use a local preview owner. Do not use it as a production customer portal without staff authorisation and separate expiring/revocable customer access tokens. Staff/customer route separation alone is not authorisation.

## Data and validation

D1 holds quote documents with a version counter. All mutations require the expected version, and updates are conditional on that version. Server-side validation rejects invalid quantities/prices, duplicate SKUs, inappropriate status transitions, expired approval/acceptance and cross-origin writes. Totals use integer cents and aggregate 10% GST for the test Australian taxable-goods scenario. Production tax handling must come from Magento.

No browser storage is used as authoritative data. Production schema is maintained in `db/schema.ts` and generated Drizzle migrations. Customer edits cannot override quoted unit prices or freight.

The initial ABC sample retains mockup prices. The Add product picker reads `https://www.verdex.com.au/media/feed/quotefeed.xml` through the server, with a 15-minute successful-fetch cache. Refresh occurs on catalogue requests, not on a background schedule. Fetch failure uses the last in-memory result or the bundled dated snapshot, with a visible warning; fallback retries after one minute. Regular AUD ex-GST prices are the default, with active-sale-price selection. Zero-price products can be added and are highlighted red in the staff editor. Every item, including optional extras, must have a positive unit price before saving or approval; the shared action validator enforces this for both server and demo quotes. Quoted items are copied and never silently repriced by feed updates. Availability remains unconfirmed; category, stock and grouped/related links are absent from this feed. PDFs use standard Helvetica with Latin character transliteration; Unicode font embedding should be added before use with multilingual customer records. PDF output is a quotation, not a tax invoice.

## Production integration tasks

- Add server-side staff roles/approval policy and customer token access, with revocation/expiry/rate limiting.
- Add a backend Magento catalogue adapter and narrowly scoped custom Magento module that validates approved quote revision, custom prices, shipping and expiry; establish a customer cart session without exposing integration credentials.
- Make acceptance/cart creation idempotent using quote ID + accepted revision. A failed cart handoff must remain retryable. Record a Magento order only from verified order events, not from acceptance.
- Map HubSpot contacts/companies/deals and expose a supported UI extension. Update Closed Won according to the agreed order/payment policy.
- Add a mail provider, production customer URLs, immutable sent PDFs and delivery audit events. Do not send the private test URLs to customers.
- Replace sample catalogue, freight and tax assumptions with authenticated live sources. Validate configurable/grouped products and existing checkout.
- Add attachment storage, appropriate retention/backups, queue/retry handling and operational monitoring.

## Developer commands

Use the repository lockfile and installed package manager. `npm run dev` runs local development; `npm run build` creates the Worker artifact; `npm run db:generate` generates schema migrations; `node node_modules/typescript/bin/tsc --noEmit` type-checks.

Hosted values belong in server-side secret configuration, never frontend variables or source control. No production credentials are included.

The staff item table shows current feed sale prices (ex GST) and sale end dates as read-only references, including on previously saved quotes. They never overwrite negotiated unit prices. Dates are displayed in Australia/Sydney; absent dates show "Not supplied", and expired or future sales are omitted. Missing SKUs and catalogue fetch failures are explicitly identified.

Each item captures its standard unit price when added. Existing server quotes acquire missing standard prices from the catalogue; missing/zero catalogue prices fall back to the quoted price. Customer changes cannot override standard or quoted prices. Successful self-service quantity changes update the saved quantity baseline; reducing a discounted standard line below that baseline requires review. Optional extras retain their existing opt-in behaviour.

Sales workspace separates read-only Unit price (captured standard price), live Sale price, and editable Quoted price. Quote totals use Quoted price; all three are ex GST.

Draft and changes-requested quote rows can be reordered with drag handles, up/down buttons, or arrow keys on a focused handle. Save order uses the normal validated draft save, including other draft changes and optimistic concurrency. Customer standard items and optional extras each follow their saved relative order within the existing grouping; the PDF follows saved included-item order. Approved/accepted quotes require a revision before reordering.

## Restricted product costs

The Sales workspace includes a read-only Unit Cost column. Costs have a separate server-enforced admin allowlist; being signed in or opening Sales workspace does not grant cost access. `/admin/access` starts platform sign-in and displays the signed-in user's site-scoped ID. Configure approved IDs in the server-only `COST_ADMIN_USER_IDS` comma-separated environment value, then deploy to apply it. Unset/empty denies everyone, including the local preview. This allowlist controls costs only; the existing quote preview is not a production customer portal.

`COST_SHEET_ID`, `COST_SHEET_TAB=Costs` and `COST_SOURCE_MODE=public-sheet` configure the source. The sheet identifier is a hosted secret, absent from client code. No service account or OAuth credentials are in source. A sheet shared as Anyone with the link remains publicly readable independently of this app; restricting app access does not secure the original sheet.

The server fetches columns A:C by tab name and verifies SKU / Average Cost / Latest Cost headers. Both costs are imported into a server-only map, using trimmed uppercase SKUs. Only products matched to the Magento catalogue can display costs. Average Cost is displayed in AUD to two decimal places; the unrounded source values and Latest Cost stay on the server. No tax conversion is applied. Missing/invalid values and duplicate normalised SKUs display N/A; genuine zero costs display $0.00. Refresh failures display Unavailable, never a fabricated zero or silently expired cached cost.

Successful loads are cached for 15 minutes per Worker instance with concurrent requests coalesced. Refresh is on demand, not scheduled. Failed loads retry after one minute. There is no cost snapshot in source, D1 quotes, public assets or the catalogue response. Runtime restart clears the in-memory cache. Costs reflect the latest successfully loaded sheet, not historical cost-at-quote snapshots.

Authenticated, explicitly allowed admins receive one server-rendered HTML cell per product at `/admin/unit-cost?sku=...`. Both this endpoint and the access check revalidate identity on every request. Responses are private/no-store and deny framing by external sites. The iframe has an opaque sandbox origin and no scripts; cost values are not placed into React state, hydration props, quote JSON or JavaScript bundles. The public demo and customer view do not load cost cells. PDFs, email previews and revision history contain no costs. The admin browser necessarily receives the displayed value as HTML, but customer/public JavaScript does not receive a cost dataset. A trusted admin can still read/copy displayed costs. The `/api/admin/access` endpoint returns permission only, never costs.

`CostSource.load()` is the provider boundary for later authenticated Google access. Add a Google Sheets API provider using server-side credentials/token refresh and the read-only spreadsheets scope; keep rendering, SKU mapping, cache and allowlist unchanged. Google API reference: https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/get . Switch the configured provider explicitly; unsupported provider modes fail closed rather than falling back to public access. Change the original sheet to Restricted when authenticated access is configured.

Run `node scripts/test-costs.cjs` for parser/cache/authorisation/disclosure checks, plus the normal typecheck and production build. The test uses synthetic costs and identities; never embed real cost exports as fixtures.


Main and optional quote items have View details buttons. They open a white dialog with a same-origin, script-free iframe of public product information from the Magento feed, with sample fallback where available. Optional detail controls are outside checkbox labels so opening details never selects the extra. Full Verdex website embedding is currently blocked by its SAMEORIGIN framing header; the preview does not proxy website HTML or bypass that restriction. View product on website opens the canonical product URL in a new tab. Product previews contain name, SKU, image and sanitised description only; no private costs or quote data. HTML from feed descriptions is sanitised server-side with an explicit formatting-tag allowlist and no attributes, and embedded pages have a restrictive CSP and iframe sandbox.


## Admin gross profit

Sales workspace includes Line GP% and an Overall product GP% panel directly above Approve for customer. GP is `(quoted product revenue - Average Cost × quantity) / quoted product revenue × 100`, excluding freight, handling and GST. Overall GP is revenue-weighted, not the average of line percentages, and includes standard lines plus selected optional extras with positive quantity. Each optional line still shows its own potential GP even while unselected. Zero-quantity lines do not affect overall GP. Missing/ambiguous/unmatched costs or zero quoted prices on included products make the overall result N/A, with a reason; zero cost is valid. Low GP is a visual warning only and does not impose a new approval block. Raw percentages below 40 are orange; exactly 40 is not. A missing quoted price retains the existing red-row priority.

GP recalculates after a 350ms pause when quoted prices, quantities, selections or items change, using unsaved draft inputs. Old highlighting and figures are suppressed while inputs change. Inputs contain no costs. Calculation and numeric output stay server-side in authenticated script-free iframe responses submitted via POST, with private/no-store headers. Only authenticated threshold flags (low SKUs) reach parent JavaScript for row colouring. Neither costs nor numeric GP are added to quote records, customer responses, PDFs, history or public demos. Server-side allowlist checks apply to both GP endpoints on every request, with same-origin checks and bounded item validation.

Product detail descriptions preserve paragraphs, bulleted/numbered lists, emphasis, headings and basic tables from HTML inside XML CDATA. Scripts, event handlers, inline styles, embedded content and unsafe elements are removed with sanitize-html before rendering. No post-sanitisation entity decoding is performed. The existing script-free iframe sandbox and CSP remain in place.
