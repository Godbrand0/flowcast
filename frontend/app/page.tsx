import Link from "next/link";

const steps = [
  {
    n: "01",
    title: "Deposit once",
    body: "Fund your FlowCast vault with USDC on Arc. One deposit covers your whole team.",
  },
  {
    n: "02",
    title: "Streams flow per-second",
    body: "Set who gets paid, how much, and over what period. USDC accrues to every recipient every second — no keepers, no bots.",
  },
  {
    n: "03",
    title: "Withdraw & cash out anywhere",
    body: "Recipients pull their earnings anytime and offramp to a bank account in 180+ countries. Gas is paid in their own USDC.",
  },
];

const arcPoints = [
  ["Gas token", "USDC — recipients' own earnings pay gas"],
  ["Finality", "< 500ms, no reorgs, single confirmation"],
  ["Withdrawal cost", "~$0.01 per transaction"],
  ["Offramp", "Native USDC → wire/ACH/SWIFT globally"],
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4">
      {/* Hero */}
      <section className="py-24 text-center">
        <p className="mb-4 inline-block rounded-full border border-accent/40 bg-accent/10 px-4 py-1 text-sm font-medium text-primary">
          Built on Arc · Settled in USDC
        </p>
        <h1 className="mx-auto max-w-3xl text-5xl font-bold leading-tight tracking-tight">
          Payroll that <span className="text-accent">flows</span>, not payday
          that waits.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
          FlowCast is programmable USDC payroll and payment streaming for global
          teams. Deposit once — every employee, contractor, and grantee is paid
          per second, with a bank offramp built in.
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <Link
            href="/business"
            className="rounded-lg bg-primary px-6 py-3 font-medium text-white hover:bg-primary-dark"
          >
            I&apos;m paying people →
          </Link>
          <Link
            href="/recipient"
            className="rounded-lg border border-border bg-surface px-6 py-3 font-medium hover:border-primary"
          >
            I&apos;m getting paid →
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="grid gap-6 pb-24 md:grid-cols-3">
        {steps.map((s) => (
          <div
            key={s.n}
            className="rounded-xl border border-border bg-surface p-6"
          >
            <div className="amount mb-3 text-sm font-bold text-accent">{s.n}</div>
            <h3 className="mb-2 text-lg font-semibold">{s.title}</h3>
            <p className="text-sm leading-6 text-muted">{s.body}</p>
          </div>
        ))}
      </section>

      {/* Why Arc */}
      <section className="mb-24 rounded-2xl bg-primary p-10 text-white">
        <h2 className="mb-6 text-2xl font-bold">Why this only works on Arc</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {arcPoints.map(([k, v]) => (
            <div key={k}>
              <div className="text-sm font-medium uppercase tracking-wide text-white/60">
                {k}
              </div>
              <div className="mt-1 font-medium">{v}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
