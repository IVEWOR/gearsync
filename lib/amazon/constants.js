export const US_MARKETPLACE_ID = "ATVPDKIKX0DER";

export const LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token";

export function getBaseUrl() {
  return process.env.AMAZON_ENV === "sandbox"
    ? "https://sandbox.sellingpartnerapi-na.amazon.com"
    : "https://sellingpartnerapi-na.amazon.com";
}

export function getSandboxOAuthUrl() {
  return process.env.AMAZON_ENV === "sandbox"
    ? "https://sellercentral.sandbox.amazon.com/apps/authorize/consent"
    : "https://sellercentral.amazon.com/apps/authorize/consent";
}
