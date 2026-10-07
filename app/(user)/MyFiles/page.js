import { redirect } from "next/navigation";

export default function MyFilesRedirect() {
  redirect("/dashboard/files");
}
