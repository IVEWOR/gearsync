"use client";

import {
  AppProvider,
  Frame,
  Page,
  Layout,
  Card,
  ResourceList,
  ResourceItem,
  Text,
  Badge,
  EmptyState,
  BlockStack,
  InlineStack,
} from "@shopify/polaris";
import { NavMenu } from "@shopify/app-bridge-react";
import enTranslations from "@shopify/polaris/locales/en.json";

function statusTone(status) {
  if (!status) return undefined;
  const s = status.toUpperCase();
  if (s === "ACTIVE") return "success";
  if (s === "ARCHIVED") return "critical";
  return "attention";
}

export default function ProductsShell({ products }) {
  return (
    <AppProvider i18n={enTranslations}>
      <NavMenu>
        <a href="/" rel="home">Dashboard</a>
        <a href="/products">Products</a>
        <a href="/fitment-templates">Fitment Templates</a>
        <a href="/settings">Settings</a>
        <a href="/settings/ebay-categories">eBay Categories</a>
      </NavMenu>
      <Frame>
        <Page title="Products">
          <Layout>
            <Layout.Section>
              <Card padding="0">
                {products.length === 0 ? (
                  <EmptyState heading="No products synced yet" image="">
                    <Text tone="subdued">
                      Products appear here after the first Shopify webhook sync.
                      Update a product in Shopify to trigger it.
                    </Text>
                  </EmptyState>
                ) : (
                  <ResourceList
                    resourceName={{ singular: "product", plural: "products" }}
                    items={products}
                    renderItem={(product) => (
                      <ResourceItem
                        id={product.id}
                        url={`/products/${product.id}`}
                        name={product.title || "Untitled"}
                      >
                        <BlockStack gap="100">
                          <InlineStack gap="200" blockAlign="center">
                            <Text variant="bodyMd" fontWeight="bold">
                              {product.title || "Untitled"}
                            </Text>
                            {product.status && (
                              <Badge tone={statusTone(product.status)}>
                                {product.status}
                              </Badge>
                            )}
                            <Badge tone={product._count.fitments > 0 ? "info" : undefined}>
                              {product._count.fitments} fitment{product._count.fitments !== 1 ? "s" : ""}
                            </Badge>
                          </InlineStack>
                          {(product.vendor || product.productType) && (
                            <Text tone="subdued" variant="bodySm">
                              {[product.vendor, product.productType].filter(Boolean).join(" · ")}
                            </Text>
                          )}
                        </BlockStack>
                      </ResourceItem>
                    )}
                  />
                )}
              </Card>
            </Layout.Section>
          </Layout>
        </Page>
      </Frame>
    </AppProvider>
  );
}
