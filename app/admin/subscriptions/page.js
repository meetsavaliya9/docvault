import AdminDataTable from "@/components/Admin/AdminDataTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Subscriptions — DocVault Admin",
};

export default async function AdminSubscriptionsPage({ searchParams }) {
  const params = await searchParams;
  return <AdminDataTable resource="subscriptions" initialSearch={params?.search || ""} />;
}
