import React, { useState } from "react";
import type { ConfigDoc } from "../api";

export default function ConfigPanel({
  config,
  onSave,
}: {
  config: ConfigDoc | null;
  onSave: (config: Partial<ConfigDoc>) => Promise<void>;
}) {
  const [threshold, setThreshold] = useState<string>(() =>
    config ? config.threshold.toString() : "0.70"
  );
  const [duration, setDuration] = useState<string>(() =>
    config ? config.block_duration_sec.toString() : "600"
  );
  const [blockingEnabled, setBlockingEnabled] = useState<boolean>(() =>
    config ? config.blocking_enabled !== false : true
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  React.useEffect(() => {
    if (config) {
      setThreshold(config.threshold.toString());
      setDuration(config.block_duration_sec.toString());
      setBlockingEnabled(config.blocking_enabled !== false);
    }
  }, [config?.threshold, config?.block_duration_sec, config?.blocking_enabled]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const parsedThreshold = Number(threshold);
    const parsedDuration = Number(duration);
    if (Number.isNaN(parsedThreshold) || parsedThreshold < 0 || parsedThreshold > 1) {
      setError("Threshold must be between 0 and 1");
      return;
    }
    if (Number.isNaN(parsedDuration) || parsedDuration <= 0) {
      setError("Block duration must be positive");
      return;
    }
    try {
      setSaving(true);
      await onSave({
        threshold: parsedThreshold,
        block_duration_sec: parsedDuration,
        blocking_enabled: blockingEnabled,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const thresholdNum = Number(threshold);
  const thresholdLevel = thresholdNum >= 0.8 ? 'strict' : thresholdNum >= 0.5 ? 'moderate' : 'permissive';

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-800/50 glass p-5 space-y-5 animate-fade-in-up">
      {/* Blocking Toggle */}
      <div className={`
        flex items-center justify-between rounded-lg p-4 transition-all duration-300
        ${blockingEnabled
          ? 'bg-emerald-500/10 border border-emerald-500/30'
          : 'bg-slate-800/50 border border-slate-700/50'}
      `}>
        <div className="flex items-center gap-3">
          <div className={`
            p-2 rounded-lg transition-colors duration-300
            ${blockingEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/50 text-slate-500'}
          `}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h3 className={`text-sm font-semibold ${blockingEnabled ? 'text-emerald-300' : 'text-slate-300'}`}>
              Auto IP Blocking
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {blockingEnabled ? 'Attacks will be automatically blocked' : 'Blocking is disabled - alerts only'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setBlockingEnabled(!blockingEnabled)}
          className={`
            relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300
            ${blockingEnabled ? 'bg-emerald-600 shadow-glow-emerald' : 'bg-slate-700'}
          `}
        >
          <span
            className={`
              inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300
              ${blockingEnabled ? 'translate-x-6' : 'translate-x-1'}
            `}
          />
        </button>
      </div>

      {/* Threshold setting */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Detection Threshold
          </label>
          <span className={`
            text-xs font-medium px-2 py-0.5 rounded-full
            ${thresholdLevel === 'strict'
              ? 'bg-rose-500/20 text-rose-400'
              : thresholdLevel === 'moderate'
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-emerald-500/20 text-emerald-400'}
          `}>
            {thresholdLevel === 'strict' ? 'Strict' : thresholdLevel === 'moderate' ? 'Moderate' : 'Permissive'}
          </span>
        </div>

        <div className="relative">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="w-full h-2 bg-slate-800 rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-4
              [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:bg-sky-500
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:shadow-glow-sm
              [&::-webkit-slider-thumb]:transition-all
              [&::-webkit-slider-thumb]:hover:scale-110
            "
          />
          <div className="flex justify-between text-xs text-slate-600 mt-1">
            <span>0.0</span>
            <span>0.5</span>
            <span>1.0</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="w-24 rounded-lg border border-slate-700/50 bg-slate-900/50 px-3 py-2 text-sm font-medium text-slate-100 text-center focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/30"
          />
          <p className="text-xs text-slate-500">
            Score threshold to trigger alerts and blocks
          </p>
        </div>
      </div>

      {/* Block duration */}
      <div className="space-y-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Block Duration
        </label>
        <div className="grid grid-cols-4 gap-2">
          {[
            { value: 300, label: '5m' },
            { value: 600, label: '10m' },
            { value: 1800, label: '30m' },
            { value: 3600, label: '1h' },
          ].map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => setDuration(preset.value.toString())}
              className={`
                px-3 py-2 text-sm font-medium rounded-lg transition-all
                ${Number(duration) === preset.value
                  ? 'bg-sky-600 text-white shadow-glow-sm'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-slate-300 border border-slate-700/50'}
              `}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-24 rounded-lg border border-slate-700/50 bg-slate-900/50 px-3 py-2 text-sm font-medium text-slate-100 text-center focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/30"
          />
          <p className="text-xs text-slate-500">seconds</p>
        </div>
      </div>

      {/* Error/Success messages */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm animate-fade-in">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm animate-fade-in">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Policy saved successfully!
        </div>
      )}

      {/* Submit button */}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={saving}
          className={`
            flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold
            bg-gradient-to-r from-sky-600 to-sky-500 text-white
            hover:from-sky-500 hover:to-sky-400 hover:shadow-glow-sm
            transition-all duration-200
            disabled:opacity-60 disabled:cursor-not-allowed
          `}
        >
          {saving ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Save Policy
            </>
          )}
        </button>
      </div>
    </form>
  );
}
