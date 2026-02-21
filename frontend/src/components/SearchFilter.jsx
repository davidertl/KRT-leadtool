import React from 'react';
import { useMissionStore } from '../stores/missionStore';
import { STATUS_OPTIONS } from '../lib/constants';

export default function SearchFilter() {
  const { searchQuery, statusFilter, setSearchQuery, setStatusFilter } = useMissionStore();

  return (
    <div className="p-3 border-b border-krt-border space-y-2">
      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search units / ships…"
          className="w-full bg-krt-bg border border-krt-border rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-krt-accent"
        />
        <svg className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2 top-1.5 text-gray-500 hover:text-white text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setStatusFilter(null)}
          className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
            !statusFilter
              ? 'bg-krt-accent text-white'
              : 'bg-krt-bg text-gray-400 hover:text-white'
          }`}
        >
          All
        </button>
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? null : s)}
            className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
              statusFilter === s
                ? 'bg-krt-accent text-white'
                : 'bg-krt-bg text-gray-400 hover:text-white'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
