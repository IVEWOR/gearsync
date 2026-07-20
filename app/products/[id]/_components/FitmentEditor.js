"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  AppProvider,
  Frame,
  Page,
  Layout,
  Card,
  Select,
  Button,
  DropZone,
  List,
  IndexTable,
  Text,
  BlockStack,
  InlineStack,
  Banner,
  EmptyState,
  Badge,
  Collapsible,
  FormLayout,
} from "@shopify/polaris";
import { DeleteIcon, ChevronDownIcon, ChevronUpIcon } from "@shopify/polaris-icons";
import { NavMenu } from "@shopify/app-bridge-react";
import { useAppBridge } from "@shopify/app-bridge-react";
import enTranslations from "@shopify/polaris/locales/en.json";
import { VehicleSelector } from "@/app/_components/VehicleSelector";

function statusTone(status) {
  if (!status) return undefined;
  const s = status.toUpperCase();
  if (s === "ACTIVE") return "success";
  if (s === "ARCHIVED") return "critical";
  return "attention"; // DRAFT
}

function FitmentEditorInner({ product, initialFitments }) {
  const shopify = useAppBridge();
  const router = useRouter();

  const [fitments, setFitments] = useState(initialFitments);
  const [selected, setSelected] = useState(null);
  const [selectorKey, setSelectorKey] = useState(0);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);

  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState(null);

  const [csvFile, setCsvFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [csvOpen, setCsvOpen] = useState(false);

  useEffect(() => {
    setFitments(initialFitments);
  }, [initialFitments]);

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

  useEffect(() => {
    let cancelled = false;
    authedFetch("/api/fitment-templates")
      .then((r) => r.json())
      .then((data) => { if (!cancelled && Array.isArray(data)) setTemplates(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [authedFetch]);

  const handleAddFitment = useCallback(async () => {
    if (!selected) return;
    setAdding(true);
    setError(null);
    try {
      const res = await authedFetch("/api/fitments", {
        method: "POST",
        body: JSON.stringify({ productId: product.id, vehicleId: selected.vehicleId }),
      });
      if (res.status === 409) { setError("That vehicle is already attached to this product."); return; }
      if (!res.ok) { setError("Failed to add fitment. Please try again."); return; }
      const fitment = await res.json();
      setFitments((prev) => [...prev, fitment]);
      setSelected(null);
      setSelectorKey((k) => k + 1);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setAdding(false);
    }
  }, [selected, product.id, authedFetch]);

  const handleApplyTemplate = useCallback(async () => {
    if (!templateId) return;
    setApplying(true);
    setApplyResult(null);
    setError(null);
    try {
      const res = await authedFetch(`/api/fitment-templates/${templateId}/apply`, {
        method: "POST",
        body: JSON.stringify({ productId: product.id }),
      });
      const result = await res.json();
      if (!res.ok) { setError(result.error || "Apply failed"); return; }
      setApplyResult(result);
      if (result.imported > 0) router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setApplying(false);
    }
  }, [templateId, product.id, authedFetch, router]);

  const handleDeleteFitment = useCallback(async (fitmentId) => {
    setDeletingId(fitmentId);
    setError(null);
    try {
      const res = await authedFetch("/api/fitments", {
        method: "DELETE",
        body: JSON.stringify({ fitmentId }),
      });
      if (!res.ok) { setError("Failed to remove fitment. Please try again."); return; }
      setFitments((prev) => prev.filter((f) => f.id !== fitmentId));
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }, [authedFetch]);

  const handleDrop = useCallback((_files, accepted) => {
    if (accepted.length > 0) { setCsvFile(accepted[0]); setImportResult(null); }
  }, []);

  const handleImport = useCallback(async () => {
    if (!csvFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const token = await shopify.idToken();
      const fd = new FormData();
      fd.append("file", csvFile);
      fd.append("productId", product.id);
      const res = await fetch("/api/fitments/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const result = await res.json();
      setImportResult(result);
      if (result.imported > 0) router.refresh();
    } catch {
      setImportResult({ imported: 0, skipped: 0, errors: [{ row: 0, message: "Network error" }] });
    } finally {
      setImporting(false);
      setCsvFile(null);
    }
  }, [csvFile, product.id, shopify, router]);

  const templateOptions = [
    { label: "Select template", value: "" },
    ...templates.map((t) => ({ label: `${t.name} (${t.vehicleCount} vehicles)`, value: t.id })),
  ];

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
          title={product.title || "Untitled product"}
          backAction={{ content: "Products", url: "/products" }}
          titleMetadata={product.status ? <Badge tone={statusTone(product.status)}>{product.status}</Badge> : undefined}
        >
          <Layout>
            {/* Add vehicle fitment */}
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Add vehicle fitment</Text>
                  {error && (
                    <Banner tone="critical" onDismiss={() => setError(null)}>{error}</Banner>
                  )}
                  <InlineStack gap="300" blockAlign="end" wrap={false}>
                    <div style={{ flex: 1 }}>
                      <VehicleSelector key={selectorKey} onVehicleSelected={setSelected} />
                    </div>
                    <Button
                      variant="primary"
                      onClick={handleAddFitment}
                      disabled={!selected || adding}
                      loading={adding}
                    >
                      Add fitment
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>

            {/* Apply fitment template */}
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Apply fitment template</Text>
                  {applyResult && (
                    <Banner
                      tone={applyResult.imported > 0 ? "success" : "info"}
                      onDismiss={() => setApplyResult(null)}
                    >
                      Applied: {applyResult.imported} added · {applyResult.skipped} already present
                    </Banner>
                  )}
                  <InlineStack gap="300" blockAlign="end" wrap={false}>
                    <div style={{ flex: 1 }}>
                      <Select
                        label="Template"
                        options={templateOptions}
                        value={templateId}
                        onChange={(v) => { setTemplateId(v); setApplyResult(null); }}
                      />
                    </div>
                    <Button
                      variant="primary"
                      onClick={handleApplyTemplate}
                      disabled={!templateId || applying}
                      loading={applying}
                    >
                      Apply template
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>

            {/* CSV import — collapsed by default */}
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">Import from CSV</Text>
                    <Button
                      variant="plain"
                      icon={csvOpen ? ChevronUpIcon : ChevronDownIcon}
                      onClick={() => setCsvOpen((v) => !v)}
                      accessibilityLabel={csvOpen ? "Collapse CSV import" : "Expand CSV import"}
                    >
                      {csvOpen ? "Hide" : "Show"}
                    </Button>
                  </InlineStack>
                  <Collapsible open={csvOpen} id="csv-import-section">
                    <BlockStack gap="400">
                      <Text tone="subdued">
                        Columns: <Text as="span" fontWeight="semibold">year, make, model</Text> (header row optional; sku column ignored). Max 1,000 rows.
                      </Text>
                      <DropZone accept=".csv" allowMultiple={false} onDrop={handleDrop} label="CSV file">
                        <DropZone.FileUpload actionTitle="Add CSV" actionHint="or drop file here" />
                      </DropZone>
                      {csvFile && <Text tone="subdued">{csvFile.name}</Text>}
                      {importResult && (
                        <Banner
                          tone={importResult.errors?.length > 0 ? "warning" : "success"}
                          onDismiss={() => setImportResult(null)}
                        >
                          <BlockStack gap="200">
                            <Text>
                              Imported <Text as="span" fontWeight="semibold">{importResult.imported}</Text>
                              {" · "}Skipped <Text as="span" fontWeight="semibold">{importResult.skipped}</Text> duplicates
                              {importResult.errors?.length > 0 && (
                                <> · <Text as="span" fontWeight="semibold">{importResult.errors.length}</Text> errors</>
                              )}
                            </Text>
                            {importResult.errors?.length > 0 && (
                              <List>
                                {importResult.errors.slice(0, 5).map((e, i) => (
                                  <List.Item key={i}>Row {e.row}: {e.message}</List.Item>
                                ))}
                                {importResult.errors.length > 5 && (
                                  <List.Item>…and {importResult.errors.length - 5} more</List.Item>
                                )}
                              </List>
                            )}
                          </BlockStack>
                        </Banner>
                      )}
                      <InlineStack align="end">
                        <Button
                          variant="primary"
                          onClick={handleImport}
                          disabled={!csvFile || importing}
                          loading={importing}
                        >
                          Import CSV
                        </Button>
                      </InlineStack>
                    </BlockStack>
                  </Collapsible>
                </BlockStack>
              </Card>
            </Layout.Section>

            {/* Fitment list */}
            <Layout.Section>
              <Card padding="0">
                {fitments.length === 0 ? (
                  <EmptyState heading="No vehicles attached" image="">
                    <Text tone="subdued">Use the form above to attach vehicle fitment to this product.</Text>
                  </EmptyState>
                ) : (
                  <IndexTable
                    resourceName={{ singular: "fitment", plural: "fitments" }}
                    itemCount={fitments.length}
                    headings={[
                      { title: "Year" },
                      { title: "Make" },
                      { title: "Model" },
                      { title: "Source" },
                      { title: "" },
                    ]}
                    selectable={false}
                  >
                    {fitments.map((fitment, index) => {
                      const v = fitment.vehicle;
                      const isDeleting = deletingId === fitment.id;
                      return (
                        <IndexTable.Row id={fitment.id} key={fitment.id} position={index}>
                          <IndexTable.Cell>
                            <Text variant="bodyMd" fontWeight="semibold">{v.year}</Text>
                          </IndexTable.Cell>
                          <IndexTable.Cell>{v.make}</IndexTable.Cell>
                          <IndexTable.Cell>{v.model}</IndexTable.Cell>
                          <IndexTable.Cell>
                            <Badge>{fitment.source || "MANUAL"}</Badge>
                          </IndexTable.Cell>
                          <IndexTable.Cell>
                            <Button
                              variant="plain"
                              tone="critical"
                              icon={DeleteIcon}
                              onClick={() => handleDeleteFitment(fitment.id)}
                              loading={isDeleting}
                              disabled={isDeleting}
                              accessibilityLabel={`Remove ${v.year} ${v.make} ${v.model}`}
                            />
                          </IndexTable.Cell>
                        </IndexTable.Row>
                      );
                    })}
                  </IndexTable>
                )}
              </Card>
            </Layout.Section>
          </Layout>
        </Page>
      </Frame>
    </AppProvider>
  );
}

export default function FitmentEditor(props) {
  return <FitmentEditorInner {...props} />;
}
