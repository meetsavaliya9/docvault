import { requirePagePermission } from "@/lib/permissions";

export default async function FilesLayout({ children }) {
  await requirePagePermission("VIEW_DOCUMENTS");
  return children;
}