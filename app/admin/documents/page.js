import AdminDataTable from "@/components/Admin/AdminDataTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Documents — DocVault Admin",
};

export default async function AdminDocumentsPage({ searchParams }) {
  const params = await searchParams;
  return <AdminDataTable resource="documents" initialSearch={params?.search || ""} />;
}
