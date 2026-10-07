import AdminDataTable from "@/components/Admin/AdminDataTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Payments — DocVault Admin",
};

export default async function AdminPaymentsPage({ searchParams }) {
  const params = await searchParams;
  return <AdminDataTable resource="payments" initialSearch={params?.search || ""} />;
}
