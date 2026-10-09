import ManagerUserFilesClient from "@/components/Manager/ManagerUserFilesClient";

export default async function ManagerUserFilesPage({ params }) {
  const { id } = await params;
  return <ManagerUserFilesClient userId={id} panelPath="/manager/users" />;
}
