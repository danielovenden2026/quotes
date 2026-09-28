# eWAY checkout

Verdex Quotes supports eWAY Rapid API Responsive Shared Page in both Sandbox and Live (Production) modes. Card details are entered on eWAY's hosted payment page and are not collected by Verdex Quotes.

## Live payments
1. In Workspace Connections → eWAY, select **Live (Production)** and save the production Rapid API Key and API Password.
2. Open an approved, saved quote in Customer view → **Accept quote & checkout now**.
3. Complete checkout details and select **Credit / debit card**.
4. Continue to eWAY's secure hosted page and complete the payment.
5. Verdex Quotes verifies the transaction with eWAY before treating it as successful.
6. A verified successful Live payment marks the quote as accepted and records the eWAY transaction reference in quote activity.
7. Magento / EXO order creation is not performed automatically by this payment integration.

## Sandbox
Select **Test (Sandbox)** in Workspace Connections and save separate Sandbox Rapid API credentials. Sandbox transactions do not take real money and do not mark quotes accepted.

Use eWAY's published Sandbox test-card details when testing. Live and Sandbox credentials are separate.

## Security
- API credentials are encrypted in the configured Cloudflare R2 secure storage.
- Card numbers and CVV are entered only on eWAY's hosted Responsive Shared Page.
- Verdex Quotes calculates the payable amount from the saved quote and verifies the returned access code, invoice reference and amount before accepting the result.
- Live requests use `https://api.ewaypayments.com`; Sandbox requests use `https://api.sandbox.ewaypayments.com`.
