"use client";

import { useState } from "react";
import { DEMO_CARRIERS, findDemoCarrier, type DemoCarrier, type DemoSeverity } from "@/lib/demo-data";

const LABEL: Record<DemoSeverity, string> = { critical: "Critical", warning: "Review", ok: "OK" };

function Report({ c }: { c: DemoCarrier }) {
  return (
    <div className="mk-report" aria-live="polite">
      <div className="mk-report-head">
        <div>
          <h3>{c.name}</h3>
          <p className="mk-mono">
            MC {c.mc} · DOT {c.dot} · {c.location}
          </p>
        </div>
        <span className="mk-sample-badge">Sample data</span>
      </div>

      <div className={`mk-verdict ${c.verdict.level}`}>{c.verdict.text}</div>

      <h4>Findings</h4>
      <p className="mk-hint">Open any finding to see the evidence and what to do next.</p>
      <div className="mk-findings">
        {c.findings.map((f, i) => (
          <details key={f.title} open={i === 0 && f.severity !== "ok"}>
            <summary>
              <span className={`mk-chip ${f.severity}`}>{LABEL[f.severity]}</span>
              <span>{f.title}</span>
            </summary>
            <p>{f.detail}</p>
            <dl className="mk-evidence">
              <div>
                <dt>Source</dt>
                <dd>{f.source}</dd>
              </div>
              <div>
                <dt>Record shows</dt>
                <dd>{f.value}</dd>
              </div>
              <div>
                <dt>Checked</dt>
                <dd>{f.checked}</dd>
              </div>
            </dl>
            <div className="mk-next">
              <strong>What to do next</strong>
              <p>{f.next}</p>
            </div>
          </details>
        ))}
      </div>

      <div className="mk-unverified">
        <strong>Not verified by these records</strong>
        <ul>
          {c.unverified.map((u) => (
            <li key={u}>{u}</li>
          ))}
        </ul>
      </div>

      <h4>Change history</h4>
      {c.history.length ? (
        <ol className="mk-timeline">
          {c.history.map((h) => (
            <li key={h.when + h.field}>
              <span className="mk-when">{h.when}</span>
              <strong>{h.field}</strong>
              <div className="mk-change">
                <span className="mk-from">{h.before}</span>
                <span aria-hidden>→</span>
                <span className="mk-to">{h.after}</span>
              </div>
              <p>{h.why}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mk-hint">No changes since we started watching this carrier.</p>
      )}
      <p className="mk-fine dark">Made-up carrier and data, shown to demonstrate the report. It is not a real company.</p>
    </div>
  );
}

export default function SampleReport() {
  const [value, setValue] = useState("");
  const [selected, setSelected] = useState<DemoCarrier>(DEMO_CARRIERS[1]);
  const [miss, setMiss] = useState(false);

  function pick(c: DemoCarrier) {
    setSelected(c);
    setValue(`MC ${c.mc}`);
    setMiss(false);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const hit = findDemoCarrier(value);
    if (hit) pick(hit);
    else setMiss(true);
  }

  return (
    <div className="mk-demo">
      <form onSubmit={onSubmit} className="mk-demo-form" role="search">
        <label htmlFor="demo-mc" className="sr-only">
          MC or DOT number
        </label>
        <input
          id="demo-mc"
          className="input"
          inputMode="numeric"
          placeholder="Enter an MC or DOT number"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setMiss(false);
          }}
        />
        <button type="submit" className="mk-btn">
          Check a carrier
        </button>
      </form>

      <div className="mk-demo-chips">
        <span className="muted small">Try a sample:</span>
        {DEMO_CARRIERS.map((c) => (
          <button key={c.mc} type="button" className={`mk-sample${selected.mc === c.mc ? " on" : ""}`} onClick={() => pick(c)}>
            MC {c.mc} · {c.blurb}
          </button>
        ))}
      </div>

      {miss ? (
        <p className="mk-miss" role="status">
          This demo only knows the three made-up carriers above. <a href="/signup">Create an account</a> to check real
          carriers.
        </p>
      ) : null}

      <Report c={selected} />
    </div>
  );
}
