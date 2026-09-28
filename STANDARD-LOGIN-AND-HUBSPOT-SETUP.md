# Verdex Quotes — standard login rollout and HubSpot secure storage

## Standard email/password login — safe rollout order

This release no longer trusts Cloudflare Access identity headers for application access. Cloudflare Access can remain in front of the site temporarily while you initialise the new login.

1. In Cloudflare Worker **Runtime variables and secrets**, keep `COST_ADMIN_USER_IDS` set to your Super Administrator email.
2. Add a temporary **Secret** named `VERDEX_INITIAL_ADMIN_PASSWORD`. Use a strong password of at least 10 characters. This is only used to initialise the original Super Administrator if they do not have an application password yet.
3. Deploy this source while Cloudflare Access is still enabled.
4. Run `cloudflare-production-migration-0008-standard-login.sql` against the `verdex-quotes` D1 database.
5. Open `https://quotations.verdex.com.au/login`. You may still pass through Cloudflare Access first while it is enabled. Then sign in to the Verdex login using your Super Administrator email and the temporary password from step 2. The first successful login hashes that password into D1 and creates the application session.
6. Open **Users**. Set/reset passwords for every other user who should be able to sign in. New users require an initial password.
7. Test another user in an Incognito/InPrivate browser at `/login`.
8. In Cloudflare Zero Trust, disable/remove the Access application/policy protecting `quotations.verdex.com.au`.
9. Remove the `VERDEX_INITIAL_ADMIN_PASSWORD` runtime secret after your Super Administrator application password has been initialised.
10. Open `https://quotations.verdex.com.au`. Anyone without an application session is redirected to the Verdex `/login` page.

## Login security

- Passwords are never stored as plain text. They are salted and hashed with PBKDF2-SHA-256.
- Login sessions use random tokens; only SHA-256 token hashes are stored in D1.
- Session cookies are Secure, HttpOnly and SameSite=Lax and last 12 hours.
- Eight failed attempts lock that email for 15 minutes.
- Disabling a user or resetting their password revokes their application sessions.
- Cloudflare/ChatGPT identity headers are not accepted as an application login after this release.

## HubSpot error: "HubSpot secure storage is not configured yet"

The existing R2 `BUCKET` binding is present, but the app also needs an encryption key before it can save a HubSpot private-app token from Workspace Connections.

Add a Cloudflare **Runtime secret** named:

`HUBSPOT_CREDENTIAL_KEY`

Its value must be a Base64-encoded 32-byte random key (AES-256). Do not put the value in GitHub or source control.

After adding the secret, redeploy the Worker and enter the HubSpot private-app token again. The app encrypts the token with AES-GCM before writing it to R2.

If `HUBSPOT_CREDENTIAL_KEY` is changed after a token has been saved, reconnect HubSpot because the previous encrypted token cannot be decrypted with a different key.
