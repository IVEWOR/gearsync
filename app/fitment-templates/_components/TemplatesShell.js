"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  Modal,
  FormLayout,
  TextField,
  Button,
  Banner,
} from "@shopify/polaris";
import { NavMenu } from "@shopify/app-bridge-react";
import { useAppBridge } from "@shopify/app-bridge-react";
import enTranslations from "@shopify/polaris/locales/en.json";

export default function TemplatesShell({ templates: initialTemplates }) {
  const shopify = useAppBridge();
  const router = useRouter();

  const [templates, setTemplates] = useState(initialTemplates);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  const [deletingId, setDeletingId] = useState(null);

  const authedFetch = useCallback(
    async (url, options = {}) => {
      const token = await shopify.idToken();
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

  const handleCreate = useCallback(async () => {
    if (!createName.trim()) { setCreateError("Name is required"); return; }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await authedFetch("/api/fitment-templates", {
        method: "POST",
        body: JSON.stringify({ name: createName.trim(), description: createDesc.trim() || undefined }),
      });
      if (res.status === 409) { setCreateError("A template with that name already exists"); return; }
      if (!res.ok) { setCreateError("Failed to create template"); return; }
      const template = await res.json();
      setShowCreate(false);
      setCreateName("");
      setCreateDesc("");
      router.push(`/fitment-templates/${template.id}`);
    } finally {
      setCreating(false);
    }
  }, [createName, createDesc, authedFetch, router]);

  const handleDelete = useCallback(
    async (id) => {
      setDeletingId(id);
      try {
        await authedFetch(`/api/fitment-templates/${id}`, { method: "DELETE" });
        setTemplates((prev) => prev.filter((t) => t.id !== id));
      } finally {
        setDeletingId(null);
      }
    },
    [authedFetch],
  );

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
        <Page
          title="Fitment Templates"
          primaryAction={{ content: "New template", onAction: () => setShowCreate(true) }}
        >
          <Layout>
            <Layout.Section>
              <Card padding="0">
                {templates.length === 0 ? (
                  <EmptyState heading="No templates yet" image="">
                    <Text tone="subdued">
                      Templates let you save a named set of vehicles and apply them to
                      multiple products at once.
                    </Text>
                  </EmptyState>
                ) : (
                  <ResourceList
                    resourceName={{ singular: "template", plural: "templates" }}
                    items={templates}
                    renderItem={(t) => (
                      <ResourceItem
                        id={t.id}
                        url={`/fitment-templates/${t.id}`}
                        name={t.name}
                        shortcutActions={[
                          {
                            content: deletingId === t.id ? "Deleting…" : "Delete",
                            destructive: true,
                            disabled: deletingId === t.id,
                            onAction: () => handleDelete(t.id),
                          },
                        ]}
                      >
                        <BlockStack gap="100">
                          <InlineStack gap="200" align="start">
                            <Text variant="bodyMd" fontWeight="bold">{t.name}</Text>
                            <Badge>{t.vehicleCount} vehicle{t.vehicleCount !== 1 ? "s" : ""}</Badge>
                          </InlineStack>
                          {t.description && (
                            <Text tone="subdued">{t.description}</Text>
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

        <Modal
          open={showCreate}
          onClose={() => { setShowCreate(false); setCreateError(null); setCreateName(""); setCreateDesc(""); }}
          title="New fitment template"
          primaryAction={{ content: "Create", onAction: handleCreate, loading: creating }}
          secondaryActions={[{ content: "Cancel", onAction: () => setShowCreate(false) }]}
        >
          <Modal.Section>
            {createError && (
              <Banner tone="critical" onDismiss={() => setCreateError(null)}>
                {createError}
              </Banner>
            )}
            <FormLayout>
              <TextField
                label="Name"
                value={createName}
                onChange={setCreateName}
                autoComplete="off"
              />
              <TextField
                label="Description (optional)"
                value={createDesc}
                onChange={setCreateDesc}
                multiline={3}
                autoComplete="off"
              />
            </FormLayout>
          </Modal.Section>
        </Modal>
      </Frame>
    </AppProvider>
  );
}
