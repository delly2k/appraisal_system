export function getFileIcon(mimeType: string | null) {
  const m = (mimeType ?? "").toLowerCase();
  if (m.includes("pdf"))
    return { bg: "#fff1f2", border: "#fecaca", stroke: "#dc2626", icon: "pdf" };
  if (m.includes("spreadsheet") || m.includes("excel"))
    return { bg: "#f0fdf4", border: "#86efac", stroke: "#16a34a", icon: "grid" };
  if (m.includes("word") || m.includes("document"))
    return { bg: "#eff6ff", border: "#bfdbfe", stroke: "#1d4ed8", icon: "doc" };
  if (m.includes("image"))
    return { bg: "#fdf4ff", border: "#e9d5ff", stroke: "#7c3aed", icon: "image" };
  if (m.includes("zip"))
    return { bg: "#fffbeb", border: "#fcd34d", stroke: "#d97706", icon: "archive" };
  return { bg: "#f8faff", border: "#dde5f5", stroke: "#4a5a82", icon: "file" };
}
