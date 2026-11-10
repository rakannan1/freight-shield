export default function Home() {
  return (
    <main>
      <section className="hero">
        <span className="brand-link">Freight Watch</span>
        <h1>Know when a carrier&apos;s record changes before you tender the load.</h1>
        <p className="lead">
          We check your carriers&apos; FMCSA records every morning and email you when authority, insurance, name or
          address changes, with a plain-English explanation of why it matters.
        </p>
        <div className="row">
          <a href="/login" className="btn primary">
            Get started
          </a>
          <a href="/login" className="btn">
            Sign in
          </a>
        </div>
      </section>

      <section className="steps" aria-label="How it works">
        <div className="card pad">
          <div className="strong">1. Add your carriers</div>
          <p className="muted">Paste a list of MC or DOT numbers.</p>
        </div>
        <div className="card pad">
          <div className="strong">2. We check daily</div>
          <p className="muted">Every morning we compare each record to the day before.</p>
        </div>
        <div className="card pad">
          <div className="strong">3. You get the alert</div>
          <p className="muted">Critical changes arrive by email, with what changed and what to do next.</p>
        </div>
      </section>

      <section className="price-card" aria-label="Pricing">
        <div className="card">
          <div>
            <div className="price">$25/month</div>
            <p className="muted">Founding price. Cancel any time.</p>
          </div>
          <a href="/login" className="btn primary">
            Start monitoring
          </a>
        </div>
        <p className="small muted" style={{ marginTop: 16 }}>
          Based on FMCSA public records. Freight Watch flags changes to a carrier&apos;s record. It cannot see a
          double-brokered load or a fake pickup in progress, and it is not a guarantee that a carrier is safe or unsafe.
        </p>
      </section>
    </main>
  );
}
