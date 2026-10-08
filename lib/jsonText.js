export function parseJsonText(value, fallback = null) {
  if (typeof value !== "string") return value ?? fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function stringifyJsonText(value) {
  return JSON.stringify(value);
}