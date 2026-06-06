"use client";

import { useState, useCallback, useEffect } from "react";
import { Select, InlineGrid } from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";

const START_YEAR = 1995;
const CURRENT_YEAR = new Date().getFullYear();

const YEAR_OPTIONS = [
  { label: "Select year", value: "" },
  ...Array.from({ length: CURRENT_YEAR - START_YEAR + 1 }, (_, i) => {
    const y = String(CURRENT_YEAR - i);
    return { label: y, value: y };
  }),
];

// Cascading year/make/model dropdowns.
// Calls onVehicleSelected({ vehicleId, year, make, model }) when all three are chosen.
// Calls onVehicleSelected(null) when selection is cleared.
// Mount with a new `key` to reset state (React will remount cleanly).
export function VehicleSelector({ onVehicleSelected, disabled = false }) {
  const shopify = useAppBridge();

  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [makes, setMakes] = useState([]);
  const [models, setModels] = useState([]);
  const [makesLoading, setMakesLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);

  const authedFetch = useCallback(
    async (url) => {
      const token = await shopify.idToken();
      return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    },
    [shopify],
  );

  useEffect(() => {
    if (!year) {
      setMakes([]);
      setMake("");
      setModels([]);
      setModel("");
      onVehicleSelected(null);
      return;
    }
    let cancelled = false;
    setMakesLoading(true);
    setMake("");
    setModels([]);
    setModel("");
    onVehicleSelected(null);

    authedFetch(`/api/vehicles/makes?year=${year}`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setMakes(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setMakes([]); })
      .finally(() => { if (!cancelled) setMakesLoading(false); });

    return () => { cancelled = true; };
  }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!year || !make) {
      setModels([]);
      setModel("");
      onVehicleSelected(null);
      return;
    }
    let cancelled = false;
    setModelsLoading(true);
    setModel("");
    onVehicleSelected(null);

    authedFetch(`/api/vehicles/models?year=${year}&make=${encodeURIComponent(make)}`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setModels(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setModels([]); })
      .finally(() => { if (!cancelled) setModelsLoading(false); });

    return () => { cancelled = true; };
  }, [year, make]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleModelChange = useCallback(
    (value) => {
      setModel(value);
      if (!value) { onVehicleSelected(null); return; }
      const entry = models.find((m) => String(m.id) === value);
      if (entry) {
        onVehicleSelected({ vehicleId: entry.id, year: Number(year), make, model: entry.model });
      }
    },
    [models, year, make, onVehicleSelected],
  );

  const makeOptions = [
    { label: makesLoading ? "Loading…" : "Select make", value: "" },
    ...makes.map((m) => ({ label: m, value: m })),
  ];

  const modelOptions = [
    { label: modelsLoading ? "Loading…" : "Select model", value: "" },
    ...models.map((m) => ({ label: m.model, value: String(m.id) })),
  ];

  return (
    <InlineGrid columns={3} gap="300">
      <Select
        label="Year"
        options={YEAR_OPTIONS}
        value={year}
        onChange={setYear}
        disabled={disabled}
      />
      <Select
        label="Make"
        options={makeOptions}
        value={make}
        onChange={setMake}
        disabled={disabled || !year || makesLoading}
      />
      <Select
        label="Model"
        options={modelOptions}
        value={model}
        onChange={handleModelChange}
        disabled={disabled || !make || modelsLoading}
      />
    </InlineGrid>
  );
}
