import { requirePagePermission } from "@/lib/permissions";

export default async function FoldersLayout({ children }) {
  await requirePagePermission("VIEW_FOLDERS");
  return children;
}