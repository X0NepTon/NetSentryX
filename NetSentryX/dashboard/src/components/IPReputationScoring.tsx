import React, { useState, useEffect } from 'react';
import { formatLocalDateTime } from "../utils/time";
import type { AlertDoc } from '../api';
import type { BlockDoc } from '../api';

interface IPReputation {
  ip: string;
  totalBlocks: number;
  firstSeen: string;
  lastSeen: string;
  reputation: 'Frequent' | 'Moderate' | 'Rare';
  reputationColor: string;
  suggestion: string;
}

export default function IPReputationScoring({ blockedHistory }: { blockedHistory: BlockDoc[] }) {
  const [reputations, setReputations] = useState<IPReputation[]>([]);
  const [filterReputation, setFilterReputation] = useState<'all' | 'Frequent' | 'Moderate' | 'Rare'>('all');

  useEffect(() => {
    // Group blocks by IP
    const ipMap: Record<string, BlockDoc[]> = {};
    blockedHistory.forEach(block => {
      if (!ipMap[block.ip]) {
        ipMap[block.ip] = [];
      }
      ipMap[block.ip].push(block);
    });

    // Calculate reputation for each IP
    const reps: IPReputation[] = Object.entries(ipMap).map(([ip, ipBlocks]) => {
      const totalBlocks = ipBlocks.length;
      const firstSeen = ipBlocks[ipBlocks.length - 1]?.blocked_at || '';
      const lastSeen = ipBlocks[0]?.blocked_at || '';

      let reputation: 'Frequent' | 'Moderate' | 'Rare';
      let reputationColor: string;
      let suggestion: string;

      if (totalBlocks >= 10) {
        reputation = 'Frequent';
        reputationColor = 'text-rose-400';
        suggestion = 'Persistent threat - consider permanent block';
      } else if (totalBlocks >= 3) {
        reputation = 'Moderate';
        reputationColor = 'text-amber-400';
        suggestion = 'Recurring threat - monitor closely';
      } else {
        reputation = 'Rare';
        reputationColor = 'text-emerald-400';
        suggestion = 'Isolated incident';
      }

      return {
        ip,
        totalBlocks,
        firstSeen,
        lastSeen,
        reputation,
        reputationColor,
        suggestion,
      };
    });

    // Sort by total blocks (descending)
    reps.sort((a, b) => b.totalBlocks - a.totalBlocks);

    setReputations(reps);
  }, [blockedHistory]);

  const filteredReps = filterReputation === 'all' 
    ? reputations 
    : reputations.filter(r => r.reputation === filterReputation);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-100">IP Reputation Scoring</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterReputation('all')}
            className={`px-3 py-1 text-xs rounded ${
              filterReputation === 'all' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterReputation('Frequent')}
            className={`px-3 py-1 text-xs rounded ${
              filterReputation === 'Frequent' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            Frequent
          </button>
          <button
            onClick={() => setFilterReputation('Moderate')}
            className={`px-3 py-1 text-xs rounded ${
              filterReputation === 'Moderate' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            Moderate
          </button>
          <button
            onClick={() => setFilterReputation('Rare')}
            className={`px-3 py-1 text-xs rounded ${
              filterReputation === 'Rare' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            Rare
          </button>
        </div>
      </div>

      {filteredReps.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          No IPs with {filterReputation === 'all' ? 'any' : filterReputation.toLowerCase()} reputation
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredReps.slice(0, 20).map((rep, idx) => (
            <div key={idx} className="border border-slate-800 rounded-lg p-3 hover:bg-slate-800/30">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-mono text-sky-400">{rep.ip}</div>
                  <div className={`text-sm font-semibold ${rep.reputationColor}`}>
                    {rep.reputation}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-300">
                    {rep.totalBlocks} blocks
                  </div>
                  <div className="text-xs text-slate-500">
                    {rep.firstSeen && new Date(rep.firstSeen).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-400 italic">
                {rep.suggestion}
              </div>

              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="text-slate-500">Last seen:</span>
                <span className="text-slate-300">
                  {rep.lastSeen && formatLocalDateTime(rep.lastSeen)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
