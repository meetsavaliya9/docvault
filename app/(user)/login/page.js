import AuthForm from "@/components/User/Auth/AuthForm";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/app/lib/auth/session";
import { getAuthenticatedAdmin } from "@/lib/auth/admin";

const ERROR_MESSAGES = {
  confirmation: "That sign-in link has expired. Please sign in again.",
};

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const error = params?.error;
  if (params?.source !== "root") {
    const [admin, user] = await Promise.all([
      getAuthenticatedAdmin(),
      getAuthenticatedUser(),
    ]);
    if (admin) redirect("/admin");
    if (user) redirect("/dashboard");
  }

  return (
    <AuthForm
      mode="login"
      initialError={ERROR_MESSAGES[error] || ""}
    />
  );
}
