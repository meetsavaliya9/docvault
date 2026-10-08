import { requirePagePermission } from "@/lib/permissions";

export default async function SubscriptionLayout({ children }) {
  await requirePagePermission("VIEW_SUBSCRIPTION");
  return children;
}