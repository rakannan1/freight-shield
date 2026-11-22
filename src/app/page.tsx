import { Logo } from "@/components/Logo";

export const metadata = {
  title: "FreightShield | Know when a carrier on your board goes bad",
  description:
    "FreightShield watches FMCSA authority, insurance and contact records for every carrier you book, and tells you in plain English what changed and what to do about it.",
};

const FAQ = [
  ["Where does the data come from?", "FMCSA public records. We compare each carrier's record to the day before and alert on changes."],
  ["Can it stop double brokering?", "No. It cannot see a double-brokered load or a fake pickup in progress. It flags changes to a carrier's record, so treat it as an early warning, not a guarantee."],
  ["How do alerts arrive?", "By email, with what changed, why it matters and what to do before your next load. A dashboard shows every alert and the carriers you watch."],
  ["Can I cancel?", "Any time, from the billing page in your dashboard."],
];

const I = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, width: 28, height: 28, viewBox: "0 0 24 24" } as const;

const STEPS: { title: string; text: string; badge?: string; icon: React.ReactNode }[] = [
  {
    title: "Add your carriers",
    text: "Paste MC or DOT numbers.",
    icon: (
      <svg {...I}>
        <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
      </svg>
    ),
  },
  {
    title: "We watch FMCSA daily",
    text: "Authority, insurance and identity.",
    icon: (
      <svg {...I}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    title: "Get a clear alert",
    text: "What changed and what to do next.",
    badge: "AI-powered",
    icon: (
      <svg {...I}>
        <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
        <path d="M19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z" />
      </svg>
    ),
  },
  {
    title: "Weekly digest",
    text: "Every change across your carriers, in one email.",
    icon: (
      <svg {...I}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 7l9 6 9-6" />
      </svg>
    ),
  },
];

function AlertPreview() {
  return (
    <div className="mk-preview" aria-label="Example alert">
      <div className="mk-preview-bar">
        <span className="mk-dot" /> <span className="mk-dot" /> <span className="mk-dot" />
        <span className="mk-preview-label">Example alert</span>
      </div>
      <div className="mk-preview-body">
        <div className="mk-chip crit">Critical</div>
        <h3>Common authority is no longer active for ACME HAULING LLC</h3>
        <p className="mk-mono">MC 123456 · DOT 1234567</p>
        <div className="mk-change">
          <span>Authority</span>
          <span className="mk-from">Active</span>
          <span aria-hidden>→</span>
          <span className="mk-to">Inactive</span>
        </div>
        <div className="mk-ai">
          <div className="mk-ai-tag">AI analysis</div>
          <p>
            FMCSA shows this carrier can no longer haul freight for others. Don&apos;t tender loads. Ask the carrier for
            current authority paperwork, and check any load already booked with them.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="mk">
      <section className="mk-hero">
        <header className="mk-nav">
          <Logo light />
          <nav className="mk-nav-links" aria-label="Main">
            <a href="#how">How it works</a>
            <a href="#pricing">Pricing</a>
            <a href="/login" className="mk-link">
              Sign in
            </a>
            <a href="/signup" className="mk-btn sm">
              Start free trial
            </a>
          </nav>
        </header>

        <div className="mk-hero-grid">
          <div className="mk-hero-copy">
            <span className="mk-pill">AI-powered carrier analysis</span>
            <h1>Know when a carrier on your board goes bad.</h1>
            <p className="mk-lead">
              FreightShield watches FMCSA authority, insurance, and contact records for every carrier you book, and
              tells you in plain English what changed and what to do about it.
            </p>
            <ul className="mk-points">
              <li>What to do before your next load, not just a filing-changed alert</li>
              {/* NOT BUILT YET: chameleon detection (recycled phone or email across carriers). */}
              <li>Catches chameleons: new MCs that recycle a revoked carrier&apos;s phone or email</li>
              {/* NOT BUILT YET: forwarding an email to build the watch list. File and paste import exist. */}
              <li>Forward one email from your inbox and your book is on the watch list</li>
            </ul>
            <div className="mk-cta">
              <a href="/signup" className="mk-btn">
                Start your free trial
              </a>
              <a href="/login" className="mk-btn ghost">
                Sign in
              </a>
            </div>
            <p className="mk-price-line">
              <strong>$25/month</strong> flat · up to 100 carriers
            </p>
            <p className="mk-fine">14-day trial. No card required. Half the price of the $49 screeners.</p>
          </div>
          <AlertPreview />
        </div>
      </section>

      <section id="how" className="mk-section alt">
        <h2>How it works</h2>
        <p className="mk-steps-sub">Set up in two minutes. Then it runs itself.</p>
        <ol className="mk-steps">
          {STEPS.map((st, i) => (
            <li key={st.title} className="mk-step">
              <div className="mk-step-top">
                <span className="mk-step-icon">{st.icon}</span>
                {st.badge ? <span className="mk-step-badge">{st.badge}</span> : null}
              </div>
              <span className="mk-flow-n">Step {i + 1}</span>
              <h3>{st.title}</h3>
              <p>{st.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="pricing" className="mk-section">
        <div className="mk-pricing">
          <div>
            <h2>One plan. No tiers to decode.</h2>
            <p className="mk-sub">Everything included: daily checks, AI analysis, email alerts and the dashboard.</p>
          </div>
          <div className="mk-plan">
            <div className="mk-amount">
              $25<span>/month</span>
            </div>
            <p>Flat price · up to 100 carriers</p>
            <a href="/signup" className="mk-btn block">
              Start your free trial
            </a>
            <p className="mk-fine dark">14-day trial. No card required.</p>
          </div>
        </div>
      </section>

      <section className="mk-section alt">
        <h2>Questions</h2>
        <div className="mk-faq">
          {FAQ.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="mk-footer">
        <Logo light />
        <p>
          Based on FMCSA public records. FreightShield flags changes to a carrier&apos;s record. It is not a guarantee
          that a carrier is safe or unsafe, and it cannot see a double-brokered load or a fake pickup in progress.
        </p>
      </footer>
    </div>
  );
}
