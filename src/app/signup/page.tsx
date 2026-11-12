import { AuthShell } from "@/components/AuthShell";
import AuthForm from "../login/AuthForm";

export const metadata = { title: "Start your free trial | FreightShield" };

export default function SignupPage() {
  return (
    <AuthShell>
      <AuthForm initialMode="signup" />
    </AuthShell>
  );
}
