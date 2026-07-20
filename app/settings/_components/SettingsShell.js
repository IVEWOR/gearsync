"use client";

import {
  AppProvider,
  Frame,
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Button,
  Divider,
} from "@shopify/polaris";
import { NavMenu } from "@shopify/app-bridge-react";
import enTranslations from "@shopify/polaris/locales/en.json";

export default function SettingsShell() {
  return (
    <AppProvider i18n={enTranslations}>
      <NavMenu>
        <a href="/" rel="home">Dashboard</a>
        <a href="/products">Products</a>
        <a href="/fitment-templates">Fitment Templates</a>
        <a href="/settings">Settings</a>
        <a href="/settings/ebay-categories">eBay Categories</a>
        <a href="/amazon">Amazon</a>
      </NavMenu>
      <Frame>
        <Page title="Settings" subtitle="Configure marketplace connections and listing rules.">
          <Layout>
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center" wrap={false}>
                    <BlockStack gap="100">
                      <Text as="h2" variant="headingMd">eBay Motors</Text>
                      <Text tone="subdued" variant="bodySm">
                        Map Shopify product types to eBay Motors leaf categories for accurate listings.
                      </Text>
                    </BlockStack>
                    <Button url="/settings/ebay-categories" variant="primary">
                      Configure
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center" wrap={false}>
                    <BlockStack gap="100">
                      <InlineStack gap="200" blockAlign="center">
                        <Text as="h2" variant="headingMd">Amazon</Text>
                        <Badge tone="attention">Coming soon</Badge>
                      </InlineStack>
                      <Text tone="subdued" variant="bodySm">
                        Amazon SP-API integration is pending approval. Category mapping will be
                        available once connected.
                      </Text>
                    </BlockStack>
                    <Button disabled>Configure</Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>
        </Page>
      </Frame>
    </AppProvider>
  );
}
