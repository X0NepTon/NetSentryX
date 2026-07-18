import React, { useState } from "react";
import { buildDemoAttackPayload } from "../api";
import type { DetectPreview } from "../api";

export default function ManualControls({
  onPreview,
  onBlock,
}: {
  onPreview: (payload: Record<string, unknown>) => Promise<DetectPreview>;
  onBlock: (ip: string, duration?: number, note?: string) => Promise<void>;
}) {
  const [ip, setIp] = useState("10.0.0.90");
  const [duration, setDuration] = useState("600");
  const [note, setNote] = useState("Manual block");
  const [preview, setPreview] = useState<DetectPreview | null>(null);
  const [loading, setLoading] = useState<"preview" | "demo" | "block" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runPayload(payload: Record<string, unknown>, mode: "preview" | "demo") {
    setError(null);

    try {
      setLoading(mode);
      const res = await onPreview(payload);
      setPreview(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(null);
    }
  }

  async function handlePreview() {
    const payload = {
      src_ip: ip,
      total_packets: 200,
      total_bytes: 40000,
      duration: 1,
      pkts_per_sec: 200,
      bytes_per_sec: 40000,
      syn_count: 10,
      unique_dst_ports: 1,
    };

    await runPayload(payload, "preview");
  }

  async function handleDemoAttack() {
    await runPayload(buildDemoAttackPayload(ip || "10.0.0.90"), "demo");
  }

  async function handleBlock() {
    setError(null);

    try {
      setLoading("block");
      await onBlock(ip, Number(duration) || undefined, note || undefined);
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(null);
    }
  }

  const isLoading = loading !== null;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Quick Actions
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Test detection safely, run a demo attack flow, or block an IP manually.
          </p>
        </div>

        <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[11px] font-semibold text-sky-300">
          Safe demo
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs uppercase tracking-wide text-slate-500">
          Target IP
          <input
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
          />
        </label>

        <label className="text-xs uppercase tracking-wide text-slate-500">
          Block duration (sec)
          <input
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
          />
        </label>
      </div>

      <label className="mt-3 block text-xs uppercase tracking-wide text-slate-500">
        Note (optional)
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
        />
      </label>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handlePreview}
          disabled={isLoading}
          className="rounded-md border border-sky-500/50 px-4 py-2 text-sm text-sky-300 hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading === "preview" ? "Testing..." : "Preview detection"}
        </button>

        <button
          type="button"
          onClick={handleDemoAttack}
          disabled={isLoading}
          className="rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading === "demo" ? "Running..." : "Run Demo Attack"}
        </button>

        <button
          type="button"
          onClick={handleBlock}
          disabled={isLoading}
          className="rounded-md border border-rose-500/50 px-4 py-2 text-sm text-rose-200 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading === "block" ? "Blocking..." : "Block IP"}
        </button>
      </div>

      {preview ? (
        <div
          className={`mt-4 rounded-md border p-3 text-xs ${
            preview.alert
              ? "border-rose-500/40 bg-rose-500/10 text-rose-100"
              : "border-slate-800 bg-slate-900/70 text-slate-300"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">
              Alert: {preview.alert ? "Yes" : "No"}
            </p>
            {preview.attack_type ? (
              <span className="rounded-full bg-slate-950/70 px-2 py-1 text-[11px] text-slate-300">
                {preview.attack_type}
              </span>
            ) : null}
          </div>

          <p className="mt-1">
            Score: {preview.score.toFixed(3)} (threshold {preview.threshold.toFixed(2)})
          </p>

          {preview.blocked !== undefined ? (
            <p>Blocked: {preview.blocked ? "Yes" : "No"}</p>
          ) : null}

          {preview.note ? <p>Note: {preview.note}</p> : null}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
