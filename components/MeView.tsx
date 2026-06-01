"use client";

import { useEffect, useState } from "react";

type Profile = {
  birthDate: string | null;
  profession: string | null;
  personalityType: string | null;
  country: string | null;
  city: string | null;
  languages: string | null;
  pronouns: string | null;
  bio: string | null;
  notes: string | null;
};

type FormState = {
  birthDate: string;
  profession: string;
  personalityType: string;
  country: string;
  city: string;
  languages: string;
  pronouns: string;
  bio: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  birthDate: "",
  profession: "",
  personalityType: "",
  country: "",
  city: "",
  languages: "",
  pronouns: "",
  bio: "",
  notes: ""
};

function toFormState(profile: Profile): FormState {
  return {
    birthDate: profile.birthDate ?? "",
    profession: profile.profession ?? "",
    personalityType: profile.personalityType ?? "",
    country: profile.country ?? "",
    city: profile.city ?? "",
    languages: profile.languages ?? "",
    pronouns: profile.pronouns ?? "",
    bio: profile.bio ?? "",
    notes: profile.notes ?? ""
  };
}

export function MeView() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [personalityOptions, setPersonalityOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/profile", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to load profile.");
        const data = (await response.json()) as {
          profile: Profile;
          personalityOptions: string[];
        };
        if (cancelled) return;
        setForm(toFormState(data.profile));
        setPersonalityOptions(data.personalityOptions);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (!response.ok) throw new Error("Failed to save profile.");
      const data = (await response.json()) as { profile: Profile };
      setForm(toFormState(data.profile));
      setStatus("Guardado");
      window.setTimeout(() => setStatus(null), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "rounded-2xl border border-sand-200 bg-white px-4 py-2.5 text-sm text-sand-900 outline-none focus:border-sand-400";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold text-sand-900">Me</h1>
      <p className="mt-1 text-sm text-sand-600">
        Información personal opcional que el asistente puede usar para responder con más contexto.
        Todos los campos son opcionales.
      </p>

      {loading ? (
        <p className="mt-6 text-sm text-sand-500">Cargando…</p>
      ) : (
        <form onSubmit={handleSave} className="mt-6 grid gap-4">
          <div className="grid gap-2 text-sm text-sand-700">
            <label htmlFor="birthDate">Fecha de nacimiento</label>
            <input
              id="birthDate"
              type="date"
              value={form.birthDate}
              onChange={(e) => update("birthDate", e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="grid gap-2 text-sm text-sand-700">
            <label htmlFor="profession">Profesión</label>
            <input
              id="profession"
              type="text"
              value={form.profession}
              onChange={(e) => update("profession", e.target.value)}
              placeholder="Ej. ingeniero de software, diseñadora UX, estudiante…"
              className={inputClass}
            />
          </div>

          <div className="grid gap-2 text-sm text-sand-700">
            <label htmlFor="personalityType">Tipo de personalidad</label>
            <select
              id="personalityType"
              value={form.personalityType}
              onChange={(e) => update("personalityType", e.target.value)}
              className={inputClass}
            >
              <option value="">— Sin especificar —</option>
              {personalityOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <span className="text-xs text-sand-500">
              MBTI o Eneagrama. Déjalo vacío si no lo sabes.
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 text-sm text-sand-700">
              <label htmlFor="country">País de residencia</label>
              <input
                id="country"
                type="text"
                value={form.country}
                onChange={(e) => update("country", e.target.value)}
                placeholder="Ej. México"
                className={inputClass}
              />
            </div>
            <div className="grid gap-2 text-sm text-sand-700">
              <label htmlFor="city">Ciudad</label>
              <input
                id="city"
                type="text"
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
                placeholder="Ej. Ciudad de México"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 text-sm text-sand-700">
              <label htmlFor="languages">Idiomas</label>
              <input
                id="languages"
                type="text"
                value={form.languages}
                onChange={(e) => update("languages", e.target.value)}
                placeholder="Ej. español, inglés"
                className={inputClass}
              />
            </div>
            <div className="grid gap-2 text-sm text-sand-700">
              <label htmlFor="pronouns">Pronombres</label>
              <input
                id="pronouns"
                type="text"
                value={form.pronouns}
                onChange={(e) => update("pronouns", e.target.value)}
                placeholder="Ej. él, ella, elle"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid gap-2 text-sm text-sand-700">
            <label htmlFor="bio">Bio breve</label>
            <textarea
              id="bio"
              value={form.bio}
              onChange={(e) => update("bio", e.target.value)}
              rows={3}
              placeholder="Una descripción corta sobre ti."
              className={inputClass}
            />
          </div>

          <div className="grid gap-2 text-sm text-sand-700">
            <label htmlFor="notes">Otras notas</label>
            <textarea
              id="notes"
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={6}
              placeholder="Cualquier cosa que ayude al asistente: contexto familiar, salud, objetivos, valores, preferencias, etc."
              className={inputClass}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(99,102,241,0.6)] transition-all hover:from-indigo-400 hover:to-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
            {status ? <span className="text-sm text-sand-600">{status}</span> : null}
            {error ? <span className="text-sm text-red-600">{error}</span> : null}
          </div>
        </form>
      )}
    </div>
  );
}
