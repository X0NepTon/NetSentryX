import React from "react";
import { getSeverity, isAlertAttack, type AlertDoc, type SeverityLevel } from "../api";

type Playbook = {
  type: string;
  severity: SeverityLevel;
  summary: string;
  actions: string[];
  evidence: string[];
};

const playbooks: Playbook[] = [
  {
    type: "DDoS",
    severity: "critical",
    summary: "High traffic volume from one or more sources can affect service availability.",
    actions: [
      "Keep automatic blocking enabled for high-score sources.",
      "Review top source IPs and repeated IP ranges.",
      "Export the incident report for the supervisor review.",
      "Lower the threshold only during the demo, then restore the policy.",
    ],
    evidence: ["High packets/sec", "High bytes/sec", "Repeated SYN activity"],
  },
  {
    type: "Port Scan",
    severity: "high",
    summary: "Repeated connection attempts across many ports can indicate reconnaissance.",
    actions: [
      "Check the targeted destination ports.",
      "Block the source IP if it is not a trusted scanner.",
      "Add known trusted scanner IPs to the whitelist.",
      "Review firewall exposure for open services.",
    ],
    evidence: ["High unique destination ports", "Short duration", "Raised SYN count"],
  },
  {
    type: "Brute Force",
    severity: "high",
    summary: "Repeated authentication-style attempts can indicate password guessing.",
    actions: [
      "Block the suspicious IP for a short window.",
      "Check authentication logs on the target service.",
      "Increase monitoring on the targeted host.",
      "Create a report with score and flow features.",
    ],
    evidence: ["Many repeated flows", "Raised packet count", "Consistent target service"],
  },
  {
    type: "Web Attack",
    severity: "medium",
    summary: "Suspicious web traffic can indicate scanning or exploitation attempts.",
    actions: [
      "Check web server logs around the detection time.",
      "Review user-agent and request paths if available.",
      "Keep the source blocked if repeated alerts appear.",
      "Escalate only when score and repetition are high.",
    ],
    evidence: ["Raised request rate", "Repeated source", "Model score above threshold"],
  },
  {
    type: "Benign",
    severity: "low",
    summary: "Normal traffic should stay visible for baseline comparison.",
    actions: [
      "Do not block normal traffic.",
      "Use benign flows to explain false-positive control.",
      "Whitelist stable trusted systems if they appear often.",
    ],
    evidence: ["Low score", "Low packet rate", "Normal flow duration"],
  },
];

function pickPlaybook(alert: AlertDoc) {
  const type = (alert.attack_type || "").toLowerCase();

  return (
    playbooks.find((item) => type.includes(item.type.toLowerCase())) ||
    playbooks.find((item) => item.type === "DDoS")!
  );
}

export default function PlaybooksPage({ alerts }: { alerts: AlertDoc[] }) {
  const attackAlerts = alerts.filter(isAlertAttack);
  const latestAttack = attackAlerts[0];
  const recommended = latestAttack ? pickPlaybook(latestAttack) : null;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Response Playbooks</h1>
        <p className="mt-1 text-sm text-slate-500">
          Recommended response steps based on attack type, score, and severity.
        </p>
      </div>

      {recommended && latestAttack && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-rose-300">Recommended now</p>
              <h2 className="mt-1 text-xl font-bold text-slate-100">
                {recommended.type} playbook for {latestAttack.src_ip}
              </h2>
              <p className="mt-2 text-sm text-slate-400">{recommended.summary}</p>
            </div>
            <span className="rounded-full border border-rose-500/40 bg-rose-500/20 px-3 py-1 text-xs font-bold uppercase text-rose-200">
              {getSeverity(latestAttack.score)}
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {recommended.actions.slice(0, 4).map((action, index) => (
              <div key={action} className="rounded-lg bg-slate-950/40 p-3 text-sm text-slate-300">
                <span className="mr-2 font-bold text-rose-300">{index + 1}.</span>
                {action}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {playbooks.map((playbook) => (
          <div key={playbook.type} className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 hover:border-sky-500/30">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-100">{playbook.type}</h3>
                <p className="mt-2 text-sm text-slate-400">{playbook.summary}</p>
              </div>
              <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs font-semibold uppercase text-slate-300">
                {playbook.severity}
              </span>
            </div>

            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recommended actions</p>
              <ul className="mt-2 space-y-2">
                {playbook.actions.map((action) => (
                  <li key={action} className="flex gap-2 text-sm text-slate-300">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-400" />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {playbook.evidence.map((item) => (
                <span key={item} className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-400">
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
