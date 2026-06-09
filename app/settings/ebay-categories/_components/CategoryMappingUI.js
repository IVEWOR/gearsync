"use client";

import { useState, useCallback, useEffect } from "react";
import {
  AppProvider,
  Frame,
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Banner,
  Button,
  Autocomplete,
  EmptyState,
  Spinner,
  Badge,
  Divider,
} from "@shopify/polaris";
import { NavMenu } from "@shopify/app-bridge-react";
import { useAppBridge } from "@shopify/app-bridge-react";
import enTranslations from "@shopify/polaris/locales/en.json";

export default function CategoryMappingUI({ productTypes, initialMappings }) {
  const shopify = useAppBridge();

  // Delays API calls until after client-side hydration when App Bridge is ready.
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);

  // Map from productType → { categoryId, categoryName }
  const [mappings, setMappings] = useState(() => {
    const m = {};
    for (const im of initialMappings) {
      m[im.shopifyProductType] = {
        categoryId: im.externalCategoryId,
        categoryName: im.externalCategoryName,
      };
    }
    return m;
  });

  // All eBay leaf categories fetched once: [{ id, name, fullPath }]
  const [allCategories, setAllCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true); // show spinner until fetch resolves
  const [categoriesError, setCategoriesError] = useState(null);

  // Per-row Autocomplete state: { [productType]: { inputValue, options } }
  const [autocomplete, setAutocomplete] = useState(() => {
    const s = {};
    for (const pt of productTypes) {
      const existing = initialMappings.find((m) => m.shopifyProductType === pt);
      s[pt] = { inputValue: existing?.externalCategoryName ?? "" };
    }
    return s;
  });

  // Per-row saving state
  const [saving, setSaving] = useState({});
  const [saved, setSaved] = useState({});
  const [saveError, setSaveError] = useState({});

  const authedFetch = useCallback(
    async (url, options = {}) => {
      let token;
      try {
        token = await shopify.idToken();
      } catch {
        // App Bridge may not be fully initialized on the first call; retry once.
        await new Promise((r) => setTimeout(r, 500));
        token = await shopify.idToken();
      }
      return fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      });
    },
    [shopify],
  );

  // Load categories once App Bridge is ready (gated on ready to avoid idToken errors at SSR)
  useEffect(() => {
    if (!ready) return;
    setCategoriesLoading(true);
    setCategoriesError(null);
    authedFetch("/api/ebay/categories")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setAllCategories(data);
        } else {
          setCategoriesError(data.error ?? "Failed to load categories");
        }
      })
      .catch(() => setCategoriesError("Network error loading categories"))
      .finally(() => setCategoriesLoading(false));
  }, [ready, authedFetch]);

  // Build filtered options for a given product type based on its input value
  const getOptions = useCallback(
    (productType) => {
      const input = (autocomplete[productType]?.inputValue ?? "").toLowerCase().trim();
      const filtered = input
        ? allCategories.filter((c) => c.fullPath.toLowerCase().includes(input))
        : allCategories;
      return filtered.slice(0, 100).map((c) => ({
        value: c.id,
        label: c.fullPath,
      }));
    },
    [allCategories, autocomplete],
  );

  const handleInputChange = useCallback((productType, value) => {
    setAutocomplete((prev) => ({
      ...prev,
      [productType]: { ...prev[productType], inputValue: value },
    }));
    // Clear the mapping if the user clears the input
    if (!value) {
      setMappings((prev) => {
        const next = { ...prev };
        delete next[productType];
        return next;
      });
    }
  }, []);

  const handleSelect = useCallback(
    (productType, selected) => {
      const categoryId = selected[0];
      const category = allCategories.find((c) => c.id === categoryId);
      if (!category) return;
      setMappings((prev) => ({
        ...prev,
        [productType]: { categoryId: category.id, categoryName: category.fullPath },
      }));
      setAutocomplete((prev) => ({
        ...prev,
        [productType]: { inputValue: category.fullPath },
      }));
      setSaved((prev) => { const n = { ...prev }; delete n[productType]; return n; });
      setSaveError((prev) => { const n = { ...prev }; delete n[productType]; return n; });
    },
    [allCategories],
  );

  const handleSave = useCallback(
    async (productType) => {
      const mapping = mappings[productType];
      if (!mapping) return;
      setSaving((prev) => ({ ...prev, [productType]: true }));
      setSaveError((prev) => { const n = { ...prev }; delete n[productType]; return n; });
      try {
        const res = await authedFetch("/api/ebay/category-mappings", {
          method: "POST",
          body: JSON.stringify({
            shopifyProductType: productType,
            externalCategoryId: mapping.categoryId,
            externalCategoryName: mapping.categoryName,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          setSaveError((prev) => ({ ...prev, [productType]: err.error ?? "Save failed" }));
        } else {
          setSaved((prev) => ({ ...prev, [productType]: true }));
        }
      } catch {
        setSaveError((prev) => ({ ...prev, [productType]: "Network error" }));
      } finally {
        setSaving((prev) => { const n = { ...prev }; delete n[productType]; return n; });
      }
    },
    [mappings, authedFetch],
  );

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
        <Page
          title="eBay Category Mapping"
          backAction={{ content: "Settings", url: "/settings" }}
          subtitle="Map each Shopify product type to an eBay Motors leaf category."
        >
          <Layout>
            {categoriesError && (
              <Layout.Section>
                <Banner tone="critical">{categoriesError}</Banner>
              </Layout.Section>
            )}

            {(!ready || categoriesLoading) && (
              <Layout.Section>
                <Card>
                  <InlineStack gap="300" blockAlign="center">
                    <Spinner size="small" />
                    <Text tone="subdued">
                      {!ready ? "Initializing…" : "Loading eBay categories…"}
                    </Text>
                  </InlineStack>
                </Card>
              </Layout.Section>
            )}

            {ready && (
            <Layout.Section>
              <Card padding="0">
                {productTypes.length === 0 ? (
                  <EmptyState heading="No product types found" image="">
                    <Text tone="subdued">
                      Sync products from Shopify first. Product types are set in
                      your Shopify product editor.
                    </Text>
                  </EmptyState>
                ) : (
                  <BlockStack>
                    {productTypes.map((pt, idx) => {
                      const mapping = mappings[pt];
                      const isSaving = !!saving[pt];
                      const isSaved = !!saved[pt];
                      const rowError = saveError[pt];
                      const options = getOptions(pt);
                      const inputValue = autocomplete[pt]?.inputValue ?? "";

                      return (
                        <div key={pt}>
                          {idx > 0 && <Divider />}
                          <div style={{ padding: "1rem 1.25rem" }}>
                            <BlockStack gap="300">
                              <InlineStack align="space-between" blockAlign="center" wrap={false}>
                                <BlockStack gap="100">
                                  <Text variant="bodyMd" fontWeight="semibold">{pt}</Text>
                                  {mapping && !isSaved && (
                                    <Text variant="bodySm" tone="subdued">
                                      {mapping.categoryName}
                                    </Text>
                                  )}
                                  {isSaved && (
                                    <Badge tone="success">Saved</Badge>
                                  )}
                                  {rowError && (
                                    <Text tone="critical" variant="bodySm">{rowError}</Text>
                                  )}
                                </BlockStack>
                                <Button
                                  variant="primary"
                                  size="slim"
                                  onClick={() => handleSave(pt)}
                                  disabled={!mapping || isSaving}
                                  loading={isSaving}
                                >
                                  Save
                                </Button>
                              </InlineStack>

                              <Autocomplete
                                options={options}
                                selected={mapping ? [mapping.categoryId] : []}
                                onSelect={(sel) => handleSelect(pt, sel)}
                                loading={categoriesLoading}
                                emptyState={
                                  <Text tone="subdued">
                                    {categoriesLoading ? "Loading…" : "No categories match"}
                                  </Text>
                                }
                                textField={
                                  <Autocomplete.TextField
                                    label="eBay category"
                                    labelHidden
                                    value={inputValue}
                                    onChange={(v) => handleInputChange(pt, v)}
                                    placeholder="Search eBay Motors categories…"
                                    autoComplete="off"
                                  />
                                }
                              />
                            </BlockStack>
                          </div>
                        </div>
                      );
                    })}
                  </BlockStack>
                )}
              </Card>
            </Layout.Section>
            )}
          </Layout>
        </Page>
      </Frame>
    </AppProvider>
  );
}
