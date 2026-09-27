declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    COST_ADMIN_USER_IDS?: string;
    COST_SHEET_ID?: string;
    COST_SHEET_TAB?: string;
    COST_SOURCE_MODE?: string;
  }
}
