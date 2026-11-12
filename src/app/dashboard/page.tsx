import { Logo } from "@/components/Logo";
import { redirect } from "next/navigation";
import { billingEnabled, getSubscription, isActiveStatus } from "@/lib/billing";
import {
  buildDashboard,
  type AlertRow,
  type DeliveryRow,
  type SnapRow,
  type WatchRow,
} from "@/lib/dashboard/model";
import { relativeDay, shortDate } from "@/lib/format";
import { userClient } from "@/lib/supabase-user";
import AddCarriers from "./AddCarriers";
import { markReviewed, removeCarrier } from "./actions";

export const metadata = { title: "Dashboard | FreightShield" };
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const { billing } = await searchParams;
  const db = await userClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");

  const [watches, snaps, alerts, deliveries, reviews, sub] = await Promise.all([
    db.from("watches").select("dot_number, carriers(legal_name, mc_number)").eq("active", true),
    db.from("latest_snapshots").select("dot_number, data, fetched_at"),
    db.from("alerts").select("*").order("created_at", { ascending: false }).limit(200),
    db.from("alert_deliveries").select("alert_id, summary"),
    db.from("alert_reviews").select("alert_id"),
    getSubscription(db, user.id),
  ]);
  const loadFailed = [watches, snaps, alerts, deliveries, reviews].some((r) => r.error);

  const model = buildDashboard({
    watches: (watches.data ?? []) as unknown as WatchRow[],
    snapshots: (snaps.data ?? []) as unknown as SnapRow[],
    alerts: (alerts.data ?? []) as unknown as AlertRow[],
    deliveries: (deliveries.data ?? []) as unknown as DeliveryRow[],
    reviewedAlertIds: (reviews.data ?? []).map((r) => r.alert_id as string),
  });

  const enforced = billingEnabled();
  const subscribed = isActiveStatus(sub.status);
  const locked = enforced && !subscribed;
  const open = model.groups.filter((g) => !g.reviewed);
  const done = model.groups.filter((g) => g.reviewed);

  const tiles = [
    { label: "Carriers watched", value: String(model.stats.watched), note: "Checked daily", tone: "" },
    { label: "Open alerts", value: String(model.stats.openAlerts), note: "Not yet reviewed", tone: "" },
    {
      label: "Critical",
      value: String(model.stats.critical),
      note: "Review before tendering loads",
      tone: model.stats.critical > 0 ? "critical" : "",
    },
    { label: "Last check", value: relativeDay(model.stats.lastCheckAt), note: "Runs every morning", tone: "" },
  ];

  return (
    <div className="shell">
      <header className="topbar">
        <div className="wrap topbar-in">
          <Logo href="/dashboard" />
          <nav aria-label="Main" className="nav">
            <a href="#alerts">Alerts</a>
            <a href="#watchlist">Watchlist</a>
            <a href="#add">Add carriers</a>
          </nav>
          <div className="row">
            <span className="muted small">{user.email}</span>
            <form action="/auth/signout" method="post">
              <button type="submit" className="btn quiet">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="wrap page">
        {billing === "success" ? (
          <p role="status" className="banner ok">
            Thanks. Your subscription is being activated and may take a few seconds to show here.
          </p>
        ) : null}
        {billing === "cancelled" ? (
          <p role="status" className="banner">
            Checkout was cancelled. You can subscribe whenever you&apos;re ready.
          </p>
        ) : null}
        {loadFailed ? (
          <p role="alert" className="banner warn">
            Some data couldn&apos;t be loaded. Refresh the page, and contact support if this keeps happening.
          </p>
        ) : null}

        {locked ? (
          <section className="card banner-card" aria-label="Subscription">
            <div>
              <strong>
                {sub.status === "none" ? "Start your subscription to begin monitoring." : "Your subscription is not active."}
              </strong>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                {sub.status === "none"
                  ? "Add carriers and get daily change alerts by email."
                  : "Monitoring and alerts are paused until it is active again."}
              </p>
            </div>
            <form action="/api/billing/checkout" method="post">
              <button type="submit" className="btn primary">
                Subscribe
              </button>
            </form>
          </section>
        ) : null}

        <div className="title-row">
          <h1>Carrier watchlist</h1>
          {enforced && subscribed ? (
            <form action="/api/billing/portal" method="post" className="row">
              <span className="muted small">
                Subscription active{sub.currentPeriodEnd ? `, current period ends ${shortDate(sub.currentPeriodEnd)}` : ""}
              </span>
              <button type="submit" className="btn quiet">
                Manage billing
              </button>
            </form>
          ) : null}
        </div>

        <section aria-label="Summary" className="tiles">
          {tiles.map((t) => (
            <div key={t.label} className="tile">
              <div className="small muted">{t.label}</div>
              <div className={`tile-value ${t.tone}`}>{t.value}</div>
              <div className="small muted">{t.note}</div>
            </div>
          ))}
        </section>

        <section id="alerts" aria-labelledby="alerts-h" className="stack-lg">
          <h2 id="alerts-h">Needs attention</h2>
          {open.length === 0 ? (
            <div className="card empty">
              <strong>No open alerts.</strong>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                {model.stats.watched === 0
                  ? "Add carriers below and we'll watch them for you."
                  : "We check every carrier each morning and will email you when something changes."}
              </p>
            </div>
          ) : (
            open.map((g) => (
              <article key={g.key} className="card alert">
                <div className="alert-main">
                  <div className="row">
                    <span className={`chip ${g.severity === "critical" ? "critical" : "warning"}`}>
                      {g.severity === "critical" ? "Critical" : g.severity === "warning" ? "Warning" : "Notice"}
                    </span>
                    <span className="mono muted small">
                      {g.carrierName}, DOT {g.dot}
                    </span>
                  </div>
                  <h3>{g.title}</h3>
                  <p className="body">{g.summary}</p>
                  <form action={markReviewed}>
                    <input type="hidden" name="ids" value={g.alertIds.join(",")} />
                    <button type="submit" className="btn">
                      Mark reviewed
                    </button>
                  </form>
                </div>
                <div className="alert-side">
                  <div className="small strong muted">WHAT CHANGED</div>
                  {g.changes.map((c, i) => (
                    <div key={i} className="change">
                      <div className="small muted">{c.label}</div>
                      <div className="mono was">{c.before}</div>
                      <div className="mono now">{c.after}</div>
                    </div>
                  ))}
                  <div className="small muted side-foot">Detected {relativeDay(g.createdAt)}</div>
                </div>
              </article>
            ))
          )}
          {done.length ? (
            <details className="card">
              <summary>Reviewed alerts ({done.length})</summary>
              <ul className="reviewed">
                {done.map((g) => (
                  <li key={g.key}>
                    <span className="strong">{g.title}</span>
                    <span className="muted small">
                      {" "}
                      {g.carrierName}, {relativeDay(g.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>

        <section id="watchlist" aria-labelledby="watch-h" className="stack-lg">
          <h2 id="watch-h">All carriers</h2>
          {model.rows.length === 0 ? (
            <div className="card empty">
              <strong>No carriers yet.</strong>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                Add MC or DOT numbers below to start monitoring.
              </p>
            </div>
          ) : (
            <div className="card table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Carrier</th>
                    <th scope="col">Status</th>
                    <th scope="col">Authority</th>
                    <th scope="col">Liability insurance</th>
                    <th scope="col">Last change</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {model.rows.map((r) => (
                    <tr key={r.dot}>
                      <td>
                        <div className="strong">{r.name}</div>
                        <div className="mono muted small">DOT {r.dot}</div>
                      </td>
                      <td>
                        <span className={`chip ${r.status}`}>{r.statusLabel}</span>
                      </td>
                      <td>{r.authority}</td>
                      <td>{r.insurance}</td>
                      <td className="muted">{relativeDay(r.lastChangeAt)}</td>
                      <td>
                        <form action={removeCarrier}>
                          <input type="hidden" name="dot" value={r.dot} />
                          <button type="submit" className="btn quiet" aria-label={`Stop watching ${r.name}`}>
                            Stop watching
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="small muted">
            Based on FMCSA public records. Alerts are monitoring signals, not a guarantee that a carrier is safe or
            unsafe.
          </p>
        </section>

        <section id="add" aria-labelledby="add-h" className="stack-lg">
          <h2 id="add-h">Add carriers</h2>
          <div className="card pad">
            <AddCarriers locked={locked} />
          </div>
        </section>
      </main>
    </div>
  );
}
