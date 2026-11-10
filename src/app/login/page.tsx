import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in | Freight Watch" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="narrow">
      <a href="/" className="brand-link">
        Freight Watch
      </a>
      <h1>Sign in</h1>
      <p className="muted">Enter your email and we&apos;ll send you a sign-in link. No password needed.</p>
      <LoginForm initialError={error ? "That sign-in link didn't work. Open it in the same browser you requested it from, or request a new one." : ""} />
    </main>
  );
}
