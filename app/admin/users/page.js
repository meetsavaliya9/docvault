import AdminDataTable from "@/components/Admin/AdminDataTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Users — DocVault Admin",
};

export default async function AdminUsersPage({ searchParams }) {
  const params = await searchParams;
  return <AdminDataTable resource="users" initialSearch={params?.search || ""} />;
}
