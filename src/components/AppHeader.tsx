import { Logo } from "@/components/Logo";

/** Top bar for signed-in pages. */
export function AppHeader({ email, active }: { email?: string | null; active: "dashboard" | "settings" }) {
  const cur = (k: string) => (active === k ? ({ "aria-current": "page" } as const) : {});
  return (
    <header className="topbar">
      <div className="wrap topbar-in">
        <Logo href="/dashboard" />
        <nav aria-label="Main" className="nav">
          <a href="/dashboard#alerts" {...cur("dashboard")}>
            Alerts
          </a>
          <a href="/dashboard#watchlist">Watchlist</a>
          <a href="/dashboard#add">Add carriers</a>
          <a href="/dashboard/settings" {...cur("settings")}>
            Settings
          </a>
        </nav>
        <div className="row">
          {email ? <span className="muted small">{email}</span> : null}
          <form action="/auth/signout" method="post">
            <button type="submit" className="btn quiet">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
