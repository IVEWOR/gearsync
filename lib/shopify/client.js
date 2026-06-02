import "@shopify/shopify-api/adapters/web-api";
import { shopifyApi } from "@shopify/shopify-api";

export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: process.env.SHOPIFY_SCOPES.split(","),
  hostName: process.env.SHOPIFY_APP_URL.replace(/https?:\/\//, ""),
  apiVersion: "2026-04",
  isEmbeddedApp: true,
});
