import "@shopify/polaris/build/esm/styles.css";
import "./globals.css";

export const metadata = {
  title: "GearSync",
  description: "Sync auto parts to eBay Motors and Amazon",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script
          src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
          data-api-key={process.env.SHOPIFY_API_KEY}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
