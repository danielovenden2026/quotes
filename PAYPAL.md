# PayPal connection

Workspace Connections → PayPal payments is available to Super Administrators.

## Setup
1. Sign in at https://developer.paypal.com/dashboard/ using the PayPal Business account that will receive Verdex payments.
2. Open Apps & Credentials and select Sandbox for testing.
3. Create a separate REST app named Verdex Quotes, associated with a Sandbox business (merchant) account.
4. Copy Client ID and Client Secret. In the quoting software select Test (Sandbox), paste both, and choose Verify & save connection.
5. A successful connection test displays a confirmation and saved mode. Test saved connection rechecks the stored credentials; Disconnect removes them.
6. For eventual production use, obtain the credentials under Live and select Live in the quoting software. Sandbox and Live credentials are different. A failed replacement preserves the existing saved connection.

API credentials are not your PayPal login email/password, a legacy API username/password/signature, or an OAuth access token. Keep Client Secret private and enter it only in Workspace Connections.

Saving credentials does not enable PayPal payment checkout yet. The existing PayPal checkout option remains a saved preference. Once payment checkout is integrated, buyer test logins are found under Testing Tools → Sandbox Accounts → personal account → View/Edit Account; they are different from merchant app credentials.

## Server implementation
- POST /api/admin/paypal supports connect, test, disconnect; GET exposes safe status only.
- Super Administrator access, same-origin JSON POSTs, bounded request body, no-store responses.
- Verification exchanges Client ID/Client Secret for an OAuth token at /v1/oauth2/token on the fixed selected PayPal host. No order creation, payment capture or customer data transfer occurs during verification. The token is discarded, never returned or stored.
- Credentials are AES-GCM encrypted in R2 at integrations/paypal/credential-v1, with HKDF domain separation from other connectors. Uses optional PAYPAL_CREDENTIAL_KEY or existing HUBSPOT_CREDENTIAL_KEY. Changing encryption keys requires re-entering credentials.
- eWAY, HubSpot and Magento settings are independent and unchanged.
- scripts/test-paypal.cjs uses mocked provider responses to verify encryption, redaction, token non-disclosure, rejected credentials/redirects, preservation on failed replacement, authentication/origin restrictions and connector isolation. No real PayPal credentials are used by the test.

Official instructions: https://developer.paypal.com/api/get-started/
Authentication: https://developer.paypal.com/api/rest/authentication
Production: https://developer.paypal.com/api/rest/production/
