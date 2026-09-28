# Magento freight connection

Open the authenticated workspace, select Workspace connections, then Magento Freight. The site is fixed to `https://www.verdex.com.au`, default store code `default`. Test & enable connection runs on the hosted server using V4020 × 1 to NSW 2121. The recorded benchmark is Carrier Delivery (B), $81.82 excluding GST / $90 including GST. A successful available carrier estimate saves and enables the connection; a different current amount is explicitly flagged for comparison. Failure preserves the previously saved configuration. No credential or browser cookie is requested.

Sales workspace → Shipping options → Calculate freight uses active quote lines (including selected optional products) and the quote address. Duplicate SKUs are summed for the single shipment while quote lines remain separate. Edited catalogue products use sourceSku. Ad hoc items with no Magento SKU require manual freight for the entire shipment. This release calculates one shipment per quote; dividers do not define additional destinations. Maximum 40 distinct SKUs and 10,000 combined quantity per SKU. Pick up / Own Freight continue to use existing rules. Site handling remains separately editable and is not overwritten.

Use this rate fills the freight field and records the source, calculation time and shipment fingerprint on the draft. Save the draft to retain it. Quantity, selected extras, destination, SKU or quoted-price changes invalidate the recorded calculation. Approval and customer acceptance are blocked for stale calculated delivery freight. Customer changes retain quoted unit prices and can be followed by customer freight refresh; only discounted quantity reductions require sales approval. Pickup and Own Freight do not use calculated delivery rates. Typing a manual freight price or choosing Confirm entered freight manually clears the calculation reference. Existing manually priced quotes retain their prior behaviour.

The service uses Magento's current storefront prices and cart rules, not negotiated quote prices. The current cubic carrier must be verified against actual storefront examples before regular use. No freight formula or rates are duplicated in this application.

## Server implementation

`/api/admin/magento-freight` GET and POST require the exact existing COST_ADMIN_USER_IDS allowlist and authenticated ID/email. Writes require same-origin JSON and a bounded 20 KB request. Responses are private/no-store. Anonymous and ordinary non-allowlisted accounts cannot create Magento carts through this endpoint. Public demos do not show or invoke these controls.

Settings persist in private R2 `integrations/magento-freight/settings-v1`. Default is disabled. Test success stores storeCode/enabled/testedAt/testAmount; disconnect disables without touching quote prices. The destination host is fixed, store codes allow only letters/digits/underscore, redirects are refused, the total request timeout is 55 seconds, and responses are limited to 1 MB. In-flight calculations are limited to one per admin per Worker isolate (not a global rate limiter).

Requests: AU directory lookup → create isolated guest cart → verify AUD cart currency → add all SKU quantities → estimate shipping methods. Only available, error-free `carriertablerate` methods with valid `price_excl_tax` are offered, converted once to integer cents. Failed additions or quantity mismatches abort before estimation. No order, payment, shipping-information, customer-account, email or checkout call is made. The calculation leaves an unsubmitted guest cart; Magento's existing quote retention/cleanup policy applies. Browser cart identifiers and session cookies are never reused or exposed. No retries create duplicate carts automatically.

## Live verification and blocked requests

The prior development-environment directory request returned HTTP 403 with an upstream 1010 error. That does not establish whether the hosted Worker is blocked. The user-facing test must be run from the authenticated deployed workspace to determine its actual access. Errors include the operation, HTTP status, UTC time and safe Cloudflare Ray ID when available, without raw upstream content, cookies or cart IDs. If blocked, locate that exact event in Cloudflare and identify the matching rule. Do not disable site security or broadly allow `/rest/`. Infrastructure/security configuration is outside this change.

Run `node scripts/test-magento-freight.cjs` for mocked API, failure, authorization, currency, tax and stale-rate coverage. Live connectivity and current carrier pricing are deliberately not claimed by these tests.

## Customer freight refresh

The customer Shipping options section includes **Refresh freight cost**. It validates the customer quantity/selection changes against the stored quote, calculates the complete delivery shipment server-side and saves both changes and the returned rate in one version-checked update. The stored carrier/method is retained when present; if unavailable, the rate is not replaced silently. Handling remains separate. Failures retain the saved quote and the customer's unsaved selections.

Saving a quantity change alone keeps an otherwise Ready quote Ready, with acceptance blocked until calculated freight is refreshed. Discounted quantity reductions still enter Changes requested and require sales approval even after a successful freight refresh. A narrowly identified legacy freight-only hold can be cleared by customer refresh; other holds cannot.

Shared demos calculate only the explicitly shared products, prices and public demo address (or the generic sample). Only freight result metadata is returned; no saved quote is mutated. Edited demo shipments outside that scope must use the saved workspace quote. No Magento connection settings, costs or private addresses are returned.
