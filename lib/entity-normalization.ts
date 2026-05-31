export type EntityKind = "project" | "person";

export type NormalizedEntity = {
  canonicalName: string;
  displayName: string;
  sourceValue: string;
};

export type MetadataKind =
  | "topic"
  | "tool"
  | "event"
  | "media"
  | "observation"
  | "emotion"
  | "action_item";

function stripAccents(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeLookupKey(value: string) {
  return collapseWhitespace(
    stripAccents(value)
      .toLowerCase()
      .replace(/[“”"']/g, "")
      .replace(/[^\w\s-]+/g, " ")
      .replace(/[_-]+/g, " ")
  );
}

export function toCanonicalSlug(value: string) {
  return normalizeLookupKey(value).replace(/\s+/g, "_");
}

export function normalizeDisplayName(value: string) {
  const cleaned = collapseWhitespace(
    stripAccents(value)
      .replace(/[“”"]/g, "")
      .replace(/\s+/g, " ")
  );

  if (!cleaned) {
    return "";
  }

  if (/^[A-Za-z]+(?:[A-Z][a-z]+|[A-Z]{2,})/.test(cleaned) && !cleaned.includes(" ")) {
    return cleaned;
  }

  return cleaned
    .split(" ")
    .map((word) =>
      word
        .split("-")
        .map((piece) => piece.charAt(0).toUpperCase() + piece.slice(1).toLowerCase())
        .join("-")
    )
    .join(" ");
}

export function normalizeCanonicalName(value: string): string {
  const lookupKey = normalizeLookupKey(value);

  if (!lookupKey) {
    return "";
  }

  return toCanonicalSlug(value);
}

export function dedupeNormalizedEntities(values: NormalizedEntity[]): NormalizedEntity[] {
  const byCanonical = new Map<string, NormalizedEntity>();

  values.forEach((value) => {
    if (!value.canonicalName) {
      return;
    }

    const existing = byCanonical.get(value.canonicalName);

    if (!existing || value.displayName.length < existing.displayName.length) {
      byCanonical.set(value.canonicalName, value);
    }
  });

  return Array.from(byCanonical.values());
}

export function normalizeEntityList(values: string[]): NormalizedEntity[] {
  return dedupeNormalizedEntities(
    values
      .filter((value): value is string => typeof value === "string")
      .map((value) => collapseWhitespace(value))
      .filter(Boolean)
      .map((value) => ({
        canonicalName: normalizeCanonicalName(value),
        displayName: normalizeDisplayName(value),
        sourceValue: value
      }))
      .filter((value) => value.canonicalName && value.displayName)
  );
}

export function normalizeMetadataList(values: string[], _kind: MetadataKind) {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => collapseWhitespace(value))
        .filter(Boolean)
        .map((value) => toCanonicalSlug(value))
        .filter(Boolean)
    )
  );
}
