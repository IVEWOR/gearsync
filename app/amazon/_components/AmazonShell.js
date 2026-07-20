"use client";

import { useState, useEffect, useCallback } from "react";
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
  TextField,
  DataTable,
  Banner,
  Spinner,
} from "@shopify/polaris";
import { NavMenu } from "@shopify/app-bridge-react";
import enTranslations from "@shopify/polaris/locales/en.json";

function NavLinks() {
  return (
    <NavMenu>
      <a href="/" rel="home">
        Dashboard
      </a>
      <a href="/products">Products</a>
      <a href="/fitment-templates">Fitment Templates</a>
      <a href="/settings">Settings</a>
      <a href="/settings/ebay-categories">eBay Categories</a>
      <a href="/amazon">Amazon</a>
    </NavMenu>
  );
}

export default function AmazonShell() {
  const [status, setStatus] = useState(null); // null = loading
  const [loadingConnect, setLoadingConnect] = useState(false);
  const [loadingDisconnect, setLoadingDisconnect] = useState(false);
  const [loadingSync, setLoadingSync] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const [banner, setBanner] = useState(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/amazon/status", {
        headers: {
          Authorization: `Bearer ${window.__SHOPIFY_SESSION_TOKEN__}`,
        },
      });
      const data = await res.json();
      setStatus(data.status ?? "NOT_CONNECTED");
    } catch {
      setStatus("NOT_CONNECTED");
    }
  }, []);

  // Read session token via app-bridge and store on window for easy access
  useEffect(() => {
    async function init() {
      // App bridge attaches session token via shopify.idToken()
      try {
        const token = await window.shopify?.idToken?.();
        if (token) window.__SHOPIFY_SESSION_TOKEN__ = token;
      } catch {
        // standalone / dev mode — no session token
      }
      await fetchStatus();
    }
    init();

    // Check ?connected=true in URL after OAuth callback
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      setBanner({
        tone: "success",
        message: "Amazon Seller Central connected!",
      });
      window.history.replaceState({}, "", "/amazon");
    }
  }, [fetchStatus]);

  async function handleConnect() {
    setLoadingConnect(true);
    try {
      const res = await fetch("/api/amazon/auth", {
        headers: {
          Authorization: `Bearer ${window.__SHOPIFY_SESSION_TOKEN__}`,
        },
      });
      const data = await res.json();
      if (data.oauthUrl) window.open(data.oauthUrl, "_blank");
    } catch (err) {
      setBanner({
        tone: "critical",
        message: `Connect failed: ${err.message}`,
      });
    } finally {
      setLoadingConnect(false);
    }
  }

  async function handleDisconnect() {
    setLoadingDisconnect(true);
    try {
      await fetch("/api/amazon/disconnect", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${window.__SHOPIFY_SESSION_TOKEN__}`,
        },
      });
      setStatus("DISCONNECTED");
      setBanner({ tone: "success", message: "Amazon disconnected." });
    } catch (err) {
      setBanner({
        tone: "critical",
        message: `Disconnect failed: ${err.message}`,
      });
    } finally {
      setLoadingDisconnect(false);
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults(null);
    setSearchError(null);
    try {
      const res = await fetch(
        `/api/amazon/catalog/search?q=${encodeURIComponent(searchQuery)}`,
        {
          headers: {
            Authorization: `Bearer ${window.__SHOPIFY_SESSION_TOKEN__}`,
          },
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setSearchResults(data.items ?? []);
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setSearching(false);
    }
  }

  async function handleTestSync() {
    setLoadingSync(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/sync/amazon/test", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${window.__SHOPIFY_SESSION_TOKEN__}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setSyncResult(`Queued: "${data.productTitle}"`);
    } catch (err) {
      setSyncResult(`Error: ${err.message}`);
    } finally {
      setLoadingSync(false);
    }
  }

  const isConnected = status === "CONNECTED";

  const searchRows = (searchResults ?? []).map((item) => [
    item.asin ?? "—",
    item.summaries?.[0]?.itemName ?? "—",
    item.summaries?.[0]?.brand ?? "—",
  ]);

  return (
    <AppProvider i18n={enTranslations}>
      <NavLinks />
      <Frame>
        <Page
          title="Amazon"
          subtitle="Manage your Amazon Seller Central connection and listings."
        >
          <Layout>
            {banner && (
              <Layout.Section>
                <Banner tone={banner.tone} onDismiss={() => setBanner(null)}>
                  {banner.message}
                </Banner>
              </Layout.Section>
            )}

            {/* ── Connection Card ── */}
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <InlineStack
                    align="space-between"
                    blockAlign="center"
                    wrap={false}
                  >
                    <BlockStack gap="100">
                      <Text as="h2" variant="headingMd">
                        Amazon Seller Central
                      </Text>
                      <Text tone="subdued" variant="bodySm">
                        Connect your Amazon Seller account to sync auto parts
                        listings.
                      </Text>
                    </BlockStack>
                    {status === null ? (
                      <Spinner size="small" />
                    ) : isConnected ? (
                      <Badge tone="success">Connected</Badge>
                    ) : (
                      <Badge tone="attention">Not connected</Badge>
                    )}
                  </InlineStack>

                  {isConnected ? (
                    <Button
                      variant="secondary"
                      tone="critical"
                      onClick={handleDisconnect}
                      loading={loadingDisconnect}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={handleConnect}
                      loading={loadingConnect}
                      disabled={status === null}
                    >
                      Connect Amazon Seller Account
                    </Button>
                  )}
                </BlockStack>
              </Card>
            </Layout.Section>

            {/* ── ASIN Search Card (connected only) ── */}
            {isConnected && (
              <Layout.Section>
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">
                      ASIN Search
                    </Text>
                    <InlineStack gap="200" blockAlign="end">
                      <div style={{ flexGrow: 1 }}>
                        <TextField
                          label="Keywords or part number"
                          value={searchQuery}
                          onChange={setSearchQuery}
                          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                          autoComplete="off"
                          placeholder="e.g. brake pads honda civic"
                        />
                      </div>
                      <Button onClick={handleSearch} loading={searching}>
                        Search
                      </Button>
                    </InlineStack>

                    {searchError && (
                      <Banner tone="critical">{searchError}</Banner>
                    )}

                    {searchResults !== null &&
                      (searchResults.length === 0 ? (
                        <Text tone="subdued">No results found.</Text>
                      ) : (
                        <DataTable
                          columnContentTypes={["text", "text", "text"]}
                          headings={["ASIN", "Title", "Brand"]}
                          rows={searchRows}
                        />
                      ))}
                  </BlockStack>
                </Card>
              </Layout.Section>
            )}

            {/* ── Test Sync Card (connected only) ── */}
            {isConnected && (
              <Layout.Section>
                <Card>
                  <BlockStack gap="400">
                    <BlockStack gap="100">
                      <Text as="h2" variant="headingMd">
                        Test Sync
                      </Text>
                      <Text tone="subdued" variant="bodySm">
                        Queue the first product in your catalog for a test
                        Amazon sync.
                      </Text>
                    </BlockStack>
                    <Button onClick={handleTestSync} loading={loadingSync}>
                      Sync first product to Amazon
                    </Button>
                    {syncResult && (
                      <Text
                        tone={
                          syncResult.startsWith("Error")
                            ? "critical"
                            : "success"
                        }
                      >
                        {syncResult}
                      </Text>
                    )}
                  </BlockStack>
                </Card>
              </Layout.Section>
            )}
          </Layout>
        </Page>
      </Frame>
    </AppProvider>
  );
}
