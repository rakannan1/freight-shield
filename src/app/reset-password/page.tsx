import { AuthShell } from "@/components/AuthShell";
import ResetForm from "./ResetForm";

export const metadata = { title: "Choose a new password | FreightShield" };

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <ResetForm />
    </AuthShell>
  );
}
