"use client";

import { useState, useCallback } from "react";
import {
  AppProvider,
  Frame,
  Page,
  Layout,
  Card,
  ResourceList,
  ResourceItem,
  Text,
  BlockStack,
  InlineStack,
  Banner,
  EmptyState,
  Button,
  TextField,
  FormLayout,
} from "@shopify/polaris";
import { DeleteIcon } from "@shopify/polaris-icons";
import { NavMenu } from "@shopify/app-bridge-react";
import { useAppBridge } from "@shopify/app-bridge-react";
import enTranslations from "@shopify/polaris/locales/en.json";
import { VehicleSelector } from "@/app/_components/VehicleSelector";

export default function TemplateEditor({ template, initialVehicles }) {
  const shopify = useAppBridge();

  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description || "");
  const [vehicles, setVehicles] = useState(initialVehicles);
  const [vehicleIds, setVehicleIds] = useState(template.vehicleIds);

  const [selected, setSelected] = useState(null); // { vehicleId, year, make, model }
  const [selectorKey, setSelectorKey] = useState(0);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
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

  const patchTemplate = useCallback(
    async (data) => {
      const res = await authedFetch(`/api/fitment-templates/${template.id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Update failed");
      return res.json();
    },
    [template.id, authedFetch],
  );

  const handleAddVehicle = useCallback(async () => {
    if (!selected || adding) return;
    if (vehicleIds.includes(selected.vehicleId)) {
      setError("That vehicle is already in this template.");
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const newIds = [...vehicleIds, selected.vehicleId];
      await patchTemplate({ vehicleIds: newIds });
      setVehicleIds(newIds);
      setVehicles((prev) => [
        ...prev,
        { id: selected.vehicleId, year: selected.year, make: selected.make, model: selected.model },
      ]);
      setSelected(null);
      setSelectorKey((k) => k + 1);
    } catch {
      setError("Failed to add vehicle. Please try again.");
    } finally {
      setAdding(false);
    }
  }, [selected, adding, vehicleIds, patchTemplate]);

  const handleRemoveVehicle = useCallback(
    async (vehicleId) => {
      setDeletingId(vehicleId);
      setError(null);
      try {
        const newIds = vehicleIds.filter((id) => id !== vehicleId);
        await patchTemplate({ vehicleIds: newIds });
        setVehicleIds(newIds);
        setVehicles((prev) => prev.filter((v) => v.id !== vehicleId));
      } catch {
        setError("Failed to remove vehicle. Please try again.");
      } finally {
        setDeletingId(null);
      }
    },
    [vehicleIds, patchTemplate],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    try {
      await patchTemplate({ name: name.trim(), description: description.trim() || null });
      setSaveSuccess(true);
    } catch {
      setError("Failed to save template details.");
    } finally {
      setSaving(false);
    }
  }, [name, description, patchTemplate]);

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
          title={template.name}
          backAction={{ content: "Fitment Templates", url: "/fitment-templates" }}
        >
          <Layout>
            {/* Name / description */}
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Template details</Text>
                  {error && (
                    <Banner tone="critical" onDismiss={() => setError(null)}>{error}</Banner>
                  )}
                  {saveSuccess && (
                    <Banner tone="success" onDismiss={() => setSaveSuccess(false)}>Saved.</Banner>
                  )}
                  <FormLayout>
                    <TextField label="Name" value={name} onChange={setName} autoComplete="off" />
                    <TextField
                      label="Description (optional)"
                      value={description}
                      onChange={setDescription}
                      multiline={3}
                      autoComplete="off"
                    />
                  </FormLayout>
                  <InlineStack align="end">
                    <Button variant="primary" onClick={handleSave} loading={saving}>
                      Save details
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>

            {/* Add vehicle */}
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Add vehicle</Text>
                  <VehicleSelector key={selectorKey} onVehicleSelected={setSelected} />
                  <InlineStack align="end">
                    <Button
                      variant="primary"
                      onClick={handleAddVehicle}
                      disabled={!selected || adding}
                      loading={adding}
                    >
                      Add vehicle
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>

            {/* Vehicle list */}
            <Layout.Section>
              <Card padding="0">
                {vehicles.length === 0 ? (
                  <EmptyState heading="No vehicles in this template" image="">
                    <Text tone="subdued">Add vehicles using the selector above.</Text>
                  </EmptyState>
                ) : (
                  <ResourceList
                    resourceName={{ singular: "vehicle", plural: "vehicles" }}
                    items={vehicles}
                    renderItem={(v) => {
                      const label = `${v.year} ${v.make} ${v.model}`;
                      const isDeleting = deletingId === v.id;
                      return (
                        <ResourceItem
                          id={String(v.id)}
                          name={label}
                          shortcutActions={[
                            {
                              content: isDeleting ? "Removing…" : "Remove",
                              destructive: true,
                              disabled: isDeleting,
                              icon: DeleteIcon,
                              onAction: () => handleRemoveVehicle(v.id),
                            },
                          ]}
                        >
                          <Text variant="bodyMd" fontWeight="bold">{label}</Text>
                        </ResourceItem>
                      );
                    }}
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
