import React, { useEffect, useMemo, useState } from "react";
import { fetchBlockedHistory, formatLocalDateKey, formatLocalDateTime, formatLocalTime, parseApiDate } from "../api";
import type { BlockDoc } from "../api";

interface BlockedHistoryProps {
  onClose: () => void;
}

type ViewMode = "daily" | "list";

function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseLocalInput(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function blockTime(block: BlockDoc) {
  return block.blocked_at || new Date().toISOString();
}

function toDate(value: string) {
  return parseApiDate(value);
}

function formatDateTime(value: string) {
  return formatLocalDateTime(value);
}

function formatTime(value: string) {
  return formatLocalTime(value);
}

function dayKey(value: string) {
  return formatLocalDateKey(value);
}

function groupBlocksByDay(blocks: BlockDoc[]) {
  const groups: Record<string, BlockDoc[]> = {};

  blocks.forEach((block) => {
    const key = dayKey(blockTime(block));
    if (!groups[key]) groups[key] = [];
    groups[key].push(block);
  });

  return groups;
}

function displayReason(block: BlockDoc) {
  return block.reason || block.attack_type || "auto-detect";
}

function unblockTime(block: BlockDoc) {
  return block.unblock_at || block.expires_at || "";
}

export default function BlockedHistory({ onClose }: BlockedHistoryProps) {
  const [blocks, setBlocks] = useState<BlockDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("daily");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    setEndDate(toLocalInputValue(now));
    setStartDate(toLocalInputValue(lastWeek));
  }, []);

  async function loadBlocks() {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchBlockedHistory(5000);
      const start = parseLocalInput(startDate)?.getTime();
      const end = parseLocalInput(endDate)?.getTime();

      const filtered = data.filter((block) => {
        const time = toDate(blockTime(block)).getTime();
        if (start !== undefined && start !== null && time < start) return false;
        if (end !== undefined && end !== null && time > end) return false;
        return true;
      });

      setBlocks(filtered);
    } catch (err) {
      console.error("Failed to fetch blocked IPs history:", err);
      setBlocks([]);
      setError("Failed to load blocked IPs history from API");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (startDate && endDate) loadBlocks();
  }, [startDate, endDate]);

  const groupedBlocks = useMemo(
    () => (viewMode === "daily" ? groupBlocksByDay(blocks) : null),
    [blocks, viewMode]
  );

  const sortedDays = groupedBlocks ? Object.keys(groupedBlocks).sort().reverse() : [];
  const totalBlocks = blocks.length;
  const uniqueIPs = new Set(blocks.map((b) => b.ip).filter(Boolean)).size;

  const attackTypeCounts: Record<string, number> = {};
  blocks.forEach((block) => {
    const reason = displayReason(block);
    if (reason && reason !== "auto-detect") {
      attackTypeCounts[reason] = (attackTypeCounts[reason] || 0) + 1;
    }
  });

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="border-b border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-100">Blocked IPs History</h2>
              {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 text-2xl leading-none"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-400">Total Blocks</div>
              <div className="text-2xl font-bold text-rose-400">{totalBlocks}</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-400">Unique IPs</div>
              <div className="text-2xl font-bold text-amber-400">{uniqueIPs}</div>
            </div>
            {Object.entries(attackTypeCounts)
              .slice(0, 2)
              .map(([type, count]) => (
                <div key={type} className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-xs text-slate-400">{type}</div>
                  <div className="text-2xl font-bold text-sky-400">{count}</div>
                </div>
              ))}
          </div>

          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-slate-400 mb-1">Start Date/Time</label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-slate-400 mb-1">End Date/Time</label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode("daily")}
                className={`px-4 py-2 text-sm rounded ${
                  viewMode === "daily"
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                Daily View
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-4 py-2 text-sm rounded ${
                  viewMode === "list"
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                List View
              </button>
            </div>
            <button
              onClick={loadBlocks}
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded disabled:opacity-50"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12 text-slate-400">Loading blocked IPs...</div>
          ) : blocks.length === 0 ? (
            <div className="text-center py-12 text-slate-400">No blocked IPs found in this time range</div>
          ) : viewMode === "daily" ? (
            <div className="space-y-6">
              {sortedDays.map((day) => {
                const dayBlocks = groupedBlocks![day];
                const dayUniqueIPs = new Set(dayBlocks.map((b) => b.ip).filter(Boolean)).size;

                return (
                  <div key={day} className="border border-slate-800 rounded-lg overflow-hidden">
                    <div className="bg-slate-800/50 px-4 py-3 flex items-center justify-between">
                      <h3 className="font-semibold text-slate-100">
                        {toDate(day).toLocaleDateString(undefined, {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </h3>
                      <div className="flex gap-4 text-sm">
                        <span className="text-slate-400">{dayBlocks.length} blocks</span>
                        <span className="text-rose-400">{dayUniqueIPs} unique IPs</span>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-800">
                      {dayBlocks.map((block, idx) => {
                        const until = unblockTime(block);
                        return (
                          <div
                            key={block._id || block.id || `${block.ip}-${idx}`}
                            className="px-4 py-3 hover:bg-slate-800/30 flex items-center justify-between"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-slate-500">{formatTime(blockTime(block))}</span>
                                <span className="font-mono text-rose-400">{block.ip || "unknown"}</span>
                                {displayReason(block) !== "auto-detect" && (
                                  <span className="text-xs px-2 py-0.5 rounded bg-rose-500/20 text-rose-300">
                                    {displayReason(block)}
                                  </span>
                                )}
                                {block.actor === "admin" && (
                                  <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                                    Manual
                                  </span>
                                )}
                              </div>
                              {block.note && <div className="text-xs text-slate-500 mt-1">Note: {block.note}</div>}
                            </div>

                            <div className="text-right">
                              <div className="text-sm text-slate-300">
                                Duration: {Math.floor((block.duration_sec || 300) / 60)}m
                              </div>
                              {until && <div className="text-xs text-slate-500">Until: {formatTime(until)}</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="border border-slate-800 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-slate-800 bg-slate-900/60 text-sm">
                <thead className="bg-slate-900/80 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-3 text-left">Blocked At</th>
                    <th className="px-4 py-3 text-left">IP Address</th>
                    <th className="px-4 py-3 text-left">Reason</th>
                    <th className="px-4 py-3 text-left">Actor</th>
                    <th className="px-4 py-3 text-right">Until</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800">
                  {blocks.map((block, idx) => {
                    const until = unblockTime(block);
                    return (
                      <tr key={block._id || block.id || `${block.ip}-${idx}`} className="hover:bg-slate-800/30">
                        <td className="px-4 py-3 text-slate-400">{formatDateTime(blockTime(block))}</td>
                        <td className="px-4 py-3 font-mono text-rose-400">{block.ip || "unknown"}</td>
                        <td className="px-4 py-3 text-slate-300">{displayReason(block)}</td>
                        <td className="px-4 py-3 text-slate-400">{block.actor || "system"}</td>
                        <td className="px-4 py-3 text-right text-slate-400">{until ? formatDateTime(until) : "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between text-sm text-slate-400">
          <span>Showing {blocks.length} blocked IPs</span>
          <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
