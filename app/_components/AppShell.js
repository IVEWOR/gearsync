"use client";

import {
  AppProvider,
  Frame,
  Page,
  Layout,
  Card,
  Button,
  Text,
  BlockStack,
  InlineStack,
  Divider,
} from "@shopify/polaris";
import { NavMenu } from "@shopify/app-bridge-react";
import enTranslations from "@shopify/polaris/locales/en.json";
import "./dashboard.css";

function formatRelative(isoString) {
  if (!isoString) return null;
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function AppShell({
  shopId,
  shopDomain,
  shopEmail,
  planName,
  stats,
  connections,
}) {
  const {
    productsCount = 0,
    activeListings = 0,
    lastSyncAt = null,
  } = stats ?? {};
  const ebayConnected = connections?.ebay ?? false;
  const amazonConnected = connections?.amazon ?? false;
  const lastSyncDisplay = formatRelative(lastSyncAt);

  return (
    <AppProvider i18n={enTranslations}>
      <NavMenu>
        <a href="/" rel="home">
          Dashboard
        </a>
        <a href="/products">Products</a>
        <a href="/fitment-templates">Fitment Templates</a>
        <a href="/settings">Settings</a>
      </NavMenu>
      <Frame>
        <Page>
          <Layout>
            {/* ── Hero ── */}
            <Layout.Section>
              <div className="gs-hero">
                <div className="gs-wordmark">
                  GEAR<strong>SYNC</strong>
                </div>
                <div className="gs-tagline">
                  Auto parts. Every marketplace. One sync.
                </div>
                <div className="gs-shop-pill">
                  <span className="gs-shop-dot" />
                  {shopDomain}
                  {planName && <> · {planName}</>}
                </div>
              </div>
            </Layout.Section>

            {/* ── Stats row ── */}
            <Layout.Section>
              <div className="gs-stats-grid">
                <div className="gs-stat">
                  <div className="gs-stat-value">
                    {productsCount.toLocaleString()}
                  </div>
                  <div className="gs-stat-label">Products synced</div>
                </div>
                <div className="gs-stat">
                  <div className="gs-stat-value">
                    {activeListings.toLocaleString()}
                  </div>
                  <div className="gs-stat-label">Active listings</div>
                </div>
                <div className="gs-stat">
                  <div
                    className="gs-stat-value"
                    style={{ fontSize: lastSyncDisplay ? "1.25rem" : "2rem" }}
                  >
                    {lastSyncDisplay ?? "—"}
                  </div>
                  <div className="gs-stat-label">Last sync</div>
                  {lastSyncAt && (
                    <div className="gs-stat-sub">
                      {new Date(lastSyncAt).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </div>
                  )}
                </div>
              </div>
            </Layout.Section>

            {/* ── Marketplaces ── */}
            <Layout.Section>
              <div className="gs-section-title">Marketplace connections</div>
              <div className="gs-mkt-grid">
                {/* eBay Motors */}
                <div className="gs-mkt-card">
                  <div
                    className={`gs-mkt-bar${ebayConnected ? " connected" : ""}`}
                  />
                  <div className="gs-mkt-body">
                    <div className="gs-mkt-status">
                      <span
                        className={`gs-status-dot ${ebayConnected ? "on" : "off"}`}
                      />
                      <span
                        className={`gs-status-text ${ebayConnected ? "on" : "off"}`}
                      >
                        {ebayConnected ? "Connected" : "Not connected"}
                      </span>
                    </div>
                    <div className="gs-ebay">
                      <span className="gs-ebay-e">e</span>
                      <span className="gs-ebay-b">B</span>
                      <span className="gs-ebay-a">a</span>
                      <span className="gs-ebay-y">y</span>
                    </div>
                    <div className="gs-mkt-sub">Motors</div>
                    <Button
                      variant={ebayConnected ? "secondary" : "primary"}
                      url={
                        ebayConnected
                          ? "/settings"
                          : `/api/ebay/auth?shopId=${shopId}`
                      }
                      external
                      fullWidth
                    >
                      {ebayConnected ? "Manage connection" : "Connect eBay"}
                    </Button>
                  </div>
                </div>

                {/* Amazon */}
                <div className="gs-mkt-card">
                  <div
                    className={`gs-mkt-bar${amazonConnected ? " connected" : ""}`}
                  />
                  <div className="gs-mkt-body">
                    <div className="gs-mkt-status">
                      <span
                        className={`gs-status-dot ${amazonConnected ? "on" : "off"}`}
                      />
                      <span
                        className={`gs-status-text ${amazonConnected ? "on" : "off"}`}
                      >
                        {amazonConnected ? "Connected" : "Not connected"}
                      </span>
                    </div>
                    <div className="gs-amazon">
                      amazon
                      <span className="gs-amazon-arrow" />
                    </div>
                    <div className="gs-mkt-sub">Seller Central</div>
                    <Button
                      variant={amazonConnected ? "secondary" : "primary"}
                      url="/settings"
                      fullWidth
                    >
                      {amazonConnected ? "Manage connection" : "Connect Amazon"}
                    </Button>
                  </div>
                </div>
              </div>
            </Layout.Section>

            {/* ── Quick links ── */}
            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Get started
                  </Text>
                  <Divider />
                  <InlineStack gap="300" wrap>
                    <Button url="/products" variant="secondary">
                      View products
                    </Button>
                    <Button url="/fitment-templates" variant="secondary">
                      Manage fitment templates
                    </Button>
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
