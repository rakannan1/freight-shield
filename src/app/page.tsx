import { Logo } from "@/components/Logo";
import SampleReport from "@/components/SampleReport";

export const metadata = {
  title: "FreightShield | Know when a carrier on your board goes bad",
  description:
    "FreightShield watches FMCSA authority, insurance and contact records for every carrier you book, and tells you in plain English what changed and what to do about it.",
};

const FEATURES = [
  {
    title: "Authority, insurance and status",
    body: "Active authority, liability coverage and operating status checked against FMCSA records every morning.",
  },
  {
    title: "Identity-takeover signals",
    body: "A carrier whose name, address and phone change together is flagged critical, the classic pattern behind stolen identities.",
  },
  {
    title: "AI-written, rule-checked",
    body: "Fixed rules decide what is an alert. AI then explains it in plain English and says what to do next, so it never invents an alert.",
  },
  {
    title: "Import your whole book",
    body: "Paste MC or DOT numbers, or upload an Excel or CSV file. Each new carrier gets an instant risk summary.",
  },
];

const ICON = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, width: 24, height: 24, viewBox: "0 0 24 24" } as const;

const HIGHLIGHTS = [
  {
    title: "Check any carrier in seconds",
    body: "Enter an MC or DOT number and get a plain-English report you can act on while the load is still open.",
    icon: (
      <svg {...ICON}>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    ),
    visual: (
      <div className="mk-v-search">
        <span>MC 900002</span>
        <b>Check</b>
      </div>
    ),
  },
  {
    title: "Evidence, not just a warning",
    body: "Every finding shows where it came from, when it was checked, and what the records can't tell you.",
    icon: (
      <svg {...ICON}>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5M9 13h6M9 17h4" />
      </svg>
    ),
    visual: (
      <div className="mk-v-tags">
        <span>Source: FMCSA record</span>
        <span>Checked 6:02 AM</span>
        <span className="warn">Not verified: who is calling</span>
      </div>
    ),
  },
  {
    title: "Know what to do next",
    body: "Each finding comes with a suggested step, such as calling the number you already have on file before booking.",
    icon: (
      <svg {...ICON}>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    ),
    visual: (
      <div className="mk-v-next">
        <strong>What to do next</strong>
        <p>Call the carrier on the number you already had, not the new one.</p>
      </div>
    ),
  },
  {
    title: "See exactly what changed",
    body: "A timeline of before and after values shows what moved in a carrier's record and why it deserves a look.",
    icon: (
      <svg {...ICON}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
    visual: (
      <div className="mk-v-change">
        <small>2 days ago · Authority</small>
        <div className="mk-change">
          <span className="mk-from">Active</span>
          <span aria-hidden>→</span>
          <span className="mk-to">Inactive</span>
        </div>
      </div>
    ),
  },
];

const FAQ = [
  ["Where does the data come from?", "FMCSA public records. We compare each carrier's record to the day before and alert on changes."],
  ["Can it stop double brokering?", "No. It cannot see a double-brokered load or a fake pickup in progress. It flags changes to a carrier's record, so treat it as an early warning, not a guarantee."],
  ["How do alerts arrive?", "By email, with what changed, why it matters and what to do before your next load. A dashboard shows every alert and the carriers you watch."],
  ["Can I cancel?", "Any time, from the billing page in your dashboard."],
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
            <a href="#demo">Try a sample</a>
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

      <section id="why" className="mk-section">
        <div>
          <h2>More than a filing-changed alert</h2>
          <p className="mk-sub mk-center">Four things that turn a carrier record into a decision you can make quickly.</p>
        </div>
        <div className="mk-highlights">
          {HIGHLIGHTS.map((h) => (
            <article key={h.title} className="mk-hl">
              <span className="mk-hl-icon">{h.icon}</span>
              <h3>{h.title}</h3>
              <p>{h.body}</p>
              <div className="mk-hl-visual">{h.visual}</div>
              <a href="#demo" className="mk-hl-link">
                See it on a sample carrier ↓
              </a>
            </article>
          ))}
        </div>
      </section>

      <section id="demo" className="mk-section alt">
        <div>
          <h2>See a carrier report before you sign up</h2>
          <p className="mk-sub mk-center">
            Enter one of the made-up sample numbers below. Every finding shows its source, when it was checked and what
            to do next. No sign-up needed.
          </p>
        </div>
        <SampleReport />
      </section>

      <section id="how" className="mk-section">
        <h2>From your carrier list to a clear alert</h2>
        <div className="mk-steps">
          {[
            ["1", "Add your carriers", "Paste MC or DOT numbers or upload a spreadsheet. You get a risk summary for each one straight away."],
            ["2", "We check every morning", "Each record is compared with the day before. Fixed rules decide what counts as a change that matters."],
            ["3", "You get the call", "An email says what changed, why it matters and what to do before your next load."],
          ].map(([n, t, b]) => (
            <div key={n} className="mk-step">
              <span className="mk-num">{n}</span>
              <h3>{t}</h3>
              <p>{b}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mk-section alt">
        <h2>Built for brokers who book fast</h2>
        <div className="mk-features">
          {FEATURES.map((f) => (
            <div key={f.title} className="mk-feature">
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
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
