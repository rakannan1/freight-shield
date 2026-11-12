import { Logo } from "@/components/Logo";

/** Two-panel layout for sign in, sign up and reset pages. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mk-auth">
      <aside className="mk-auth-side">
        <Logo light />
        <div>
          <h2>Know when a carrier on your board goes bad.</h2>
          <ul>
            <li>FMCSA authority, insurance and contact records, checked every morning</li>
            <li>AI-written alerts that say what changed and what to do next</li>
            <li>$25/month flat, up to 100 carriers</li>
          </ul>
        </div>
        <p className="mk-fine">Based on FMCSA public records. Not a guarantee a carrier is safe.</p>
      </aside>
      <main className="mk-auth-main">
        <div className="mk-auth-mobilelogo">
          <Logo />
        </div>
        <div className="mk-auth-card">{children}</div>
      </main>
    </div>
  );
}
