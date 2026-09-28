# eWAY Sandbox checkout

Version 127 connects approved, saved quotes to eWAY Responsive Shared Page for test card payments. Payment entry is on eWAY's secure page. No card number or CVV is collected by this application.

## Test
1. In Workspace Connections → eWAY, select Test (Sandbox) and save a Sandbox Rapid API Key and API Password. Live account credentials cannot be used in Sandbox. Magento's existing configuration is not changed.
2. While signed in, open a saved Ready quote → Customer view → Accept quote & checkout now. Public demos cannot initiate payments.
3. Complete the required checkout fields. Refresh freight if the delivery address changed. Select Credit / debit card and Continue to secure test payment.
4. On the eWAY page use Visa 4444333322221111, name Eway Test, any future expiry, CVV 123.
5. After payment, the return screen queries eWAY and shows the verified Sandbox result and transaction ID. No real money, paid quote, Magento order or EXO order is created.

Sandbox accounts can be configured to simulate declines based on the cents value. Check Sandbox transaction response settings if a test is declined. To start again after a completed/failed test, return to checkout and use Save checkout details to create a new saved version before continuing.

## Implementation boundaries
- Live initiation is hard blocked on the server. No live payment enablement setting is exposed.
- Existing authenticated workspace access and sendQuotes permission are required; this is an internal test flow, not anonymous customer sharing.
- Server-owned totals include discounts, selected extras, freight, handling and GST; client amounts are ignored.
- Unique D1 key (quote_id, quote_version) prevents concurrent session creation for the same saved version. A retry reuses the existing shared page.
- Result verification uses the stored AccessCode, checks the invoice number, attempt reference and amount, and requires an explicit TransactionStatus. Browser return parameters never prove payment.
- eway_test_payments stores only session metadata and safe transaction result fields. Sandbox records never alter quote acceptance or paid status. No card details are stored.
- Connection replacement/disconnection can prevent old attempt verification; results can also be checked in the original Sandbox account.
- Responsive Shared Page redirects back to /payment-result. Returning or selecting Check payment result performs server verification. Webhook/background reconciliation and live order fulfilment are not part of this Sandbox release.

Sources: https://eway.io/api-v3/ (Responsive Shared Page), https://go.eway.io/s/article/Test-Credit-Card-Numbers

Validation: scripts/test-eway-payment.cjs uses SQLite and mocked eWAY responses for success, decline, pending, mismatch, duplicate initiation, access controls and guards. scripts/test-eway.cjs verifies encrypted credential storage and read-only credential probes. No real card transaction is performed by these tests.
