declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    TWO_FACTOR_REQUIRED?: string;
    TWILIO_ACCOUNT_SID?: string;
    TWILIO_AUTH_TOKEN?: string;
    TWILIO_VERIFY_SERVICE_SID?: string;
    BUCKET?: R2Bucket;
    COST_ADMIN_USER_IDS?: string;
    HUBSPOT_ACCESS_TOKEN?: string;
    HUBSPOT_CREDENTIAL_KEY?: string;
    EWAY_CREDENTIAL_KEY?: string;
    PAYPAL_CREDENTIAL_KEY?: string;
    COST_SHEET_ID?: string;
    COST_SHEET_TAB?: string;
    COST_SOURCE_MODE?: string;
  }
}
