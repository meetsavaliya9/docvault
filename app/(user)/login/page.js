import AuthForm from "@/components/User/Auth/AuthForm";

const ERROR_MESSAGES = {
  confirmation: "That sign-in link has expired. Please sign in again.",
};

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const error = params?.error;

  return (
    <AuthForm
      mode="login"
      initialError={ERROR_MESSAGES[error] || ""}
    />
  );
}
