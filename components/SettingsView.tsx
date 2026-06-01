"use client";

import { useEffect, useState } from "react";

type UsageRow = {
  yearMonth: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  requestCount: number;
  estimatedUsd: number | null;
};

type ResetScope = "people" | "projects" | "insights" | "journal-entries";

const RESET_OPTIONS: Array<{ scope: ResetScope; label: string; description: string }> = [
  {
    scope: "people",
    label: "Reset personas",
    description: "Elimina todas las personas, sus tags y sus alias."
  },
  {
    scope: "projects",
    label: "Reset proyectos",
    description: "Elimina todos los proyectos y sus alias."
  },
  {
    scope: "insights",
    label: "Reset user insights",
    description: "Elimina todos los insights guardados sobre el usuario."
  },
  {
    scope: "journal-entries",
    label: "Reset journal entries",
    description: "Elimina todas las entradas del diario y sus relaciones."
  }
];

function formatUsd(value: number | null): string {
  if (value === null) return "—";
  if (value < 0.01) return `$${value.toFixed(5)}`;
  return `$${value.toFixed(2)}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export function SettingsView() {
  const [usages, setUsages] = useState<UsageRow[]>([]);
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [busyScope, setBusyScope] = useState<ResetScope | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function loadUsage() {
    setLoadingUsage(true);
    setUsageError(null);
    try {
      const response = await fetch("/api/usage", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load usage.");
      }
      const data = (await response.json()) as { usages: UsageRow[] };
      setUsages(data.usages);
    } catch (error) {
      setUsageError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoadingUsage(false);
    }
  }

  useEffect(() => {
    void loadUsage();
  }, []);

  async function handleReset(scope: ResetScope, label: string) {
    const confirmed = window.confirm(
      `Vas a borrar permanentemente los datos de "${label}". Esta acción NO se puede deshacer. ¿Continuar?`
    );
    if (!confirmed) return;

    setBusyScope(scope);
    setStatusMessage(null);
    try {
      const response = await fetch("/api/settings/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope })
      });
      if (!response.ok) {
        throw new Error("Reset failed");
      }
      const data = (await response.json()) as { deleted: number };
      setStatusMessage(`${label}: ${data.deleted} registros eliminados.`);
    } catch (error) {
      setStatusMessage(
        `Error al hacer reset de ${label}: ${error instanceof Error ? error.message : "desconocido"}`
      );
    } finally {
      setBusyScope(null);
    }
  }

  const byMonth = new Map<string, UsageRow[]>();
  for (const row of usages) {
    const list = byMonth.get(row.yearMonth) ?? [];
    list.push(row);
    byMonth.set(row.yearMonth, list);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold text-sand-900">Settings</h1>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-sand-900">Uso de IA por mes</h2>
        <p className="mt-1 text-sm text-sand-600">
          Tokens consumidos por modelo y costo estimado en USD.
        </p>

        {loadingUsage ? (
          <p className="mt-4 text-sm text-sand-500">Cargando…</p>
        ) : usageError ? (
          <p className="mt-4 text-sm text-red-600">{usageError}</p>
        ) : byMonth.size === 0 ? (
          <p className="mt-4 text-sm text-sand-500">Aún no se ha registrado uso.</p>
        ) : (
          <div className="mt-4 space-y-6">
            {Array.from(byMonth.entries()).map(([yearMonth, rows]) => {
              const totalInput = rows.reduce((sum, row) => sum + row.inputTokens, 0);
              const totalOutput = rows.reduce((sum, row) => sum + row.outputTokens, 0);
              const totalRequests = rows.reduce((sum, row) => sum + row.requestCount, 0);
              const totalCost = rows.reduce(
                (sum, row) => sum + (row.estimatedUsd ?? 0),
                0
              );
              const hasUnpricedModel = rows.some((row) => row.estimatedUsd === null);

              return (
                <div
                  key={yearMonth}
                  className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-sand-200 bg-sand-50 px-4 py-3">
                    <span className="text-sm font-semibold text-sand-900">{yearMonth}</span>
                    <span className="text-xs text-sand-600">
                      {formatNumber(totalRequests)} requests · {formatNumber(totalInput)} in ·{" "}
                      {formatNumber(totalOutput)} out ·{" "}
                      <span className="font-semibold text-sand-900">
                        {formatUsd(totalCost)}
                        {hasUnpricedModel ? "*" : ""}
                      </span>
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-left text-sm">
                      <thead className="bg-sand-50 text-xs uppercase tracking-wide text-sand-600">
                        <tr>
                          <th className="px-4 py-2 font-medium">Modelo</th>
                          <th className="px-4 py-2 font-medium text-right">Input</th>
                          <th className="px-4 py-2 font-medium text-right">Output</th>
                          <th className="px-4 py-2 font-medium text-right">Requests</th>
                          <th className="px-4 py-2 font-medium text-right">Costo est.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-sand-100">
                        {rows.map((row) => (
                          <tr key={`${row.yearMonth}-${row.model}`}>
                            <td className="px-4 py-2 font-mono text-xs text-sand-800 whitespace-nowrap">{row.model}</td>
                            <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">
                              {formatNumber(row.inputTokens)}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">
                              {formatNumber(row.outputTokens)}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">
                              {formatNumber(row.requestCount)}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">
                              {formatUsd(row.estimatedUsd)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-sand-500">
              * Precio no disponible para algún modelo; el total puede estar subestimado.
            </p>
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold text-sand-900">Zona peligrosa</h2>
        <p className="mt-1 text-sm text-sand-600">
          Borrar datos es permanente y no se puede deshacer.
        </p>

        <ul className="mt-4 space-y-3">
          {RESET_OPTIONS.map((option) => (
            <li
              key={option.scope}
              className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50/40 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-semibold text-sand-900">{option.label}</p>
                <p className="text-xs text-sand-600">{option.description}</p>
              </div>
              <button
                type="button"
                onClick={() => handleReset(option.scope, option.label)}
                disabled={busyScope !== null}
                className="inline-flex items-center justify-center rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:border-red-400 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyScope === option.scope ? "Borrando…" : "Borrar"}
              </button>
            </li>
          ))}
        </ul>

        {statusMessage ? (
          <p className="mt-4 text-sm text-sand-700">{statusMessage}</p>
        ) : null}
      </section>
    </div>
  );
}
