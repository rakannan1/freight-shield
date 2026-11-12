import { AuthShell } from "@/components/AuthShell";
import AuthForm from "./AuthForm";

export const metadata = { title: "Sign in | FreightShield" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <AuthShell>
      <AuthForm
        initialMode="login"
        initialError={
          error ? "That link didn't work. Open it in the same browser you requested it from, or request a new one." : ""
        }
      />
    </AuthShell>
  );
}
