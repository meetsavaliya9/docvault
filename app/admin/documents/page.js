import AdminDataTable from "@/components/Admin/AdminDataTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Documents — DocVault Admin",
};

export default async function AdminDocumentsPage({ searchParams }) {
  const params = await searchParams;
  const selectedUserId = Object.hasOwn(params || {}, "userId")
    ? typeof params.userId === "string"
      ? params.userId
      : ""
    : null;

  return (
    <AdminDataTable
      key={selectedUserId ?? "all-users"}
      resource="documents"
      initialSearch={params?.search || ""}
      selectedUserId={selectedUserId}
    />
  );
}
