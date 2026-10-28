import React from 'react';

const CATEGORIES = [
  { id: 'all', label: 'All Items', icon: null },
  { id: 'cycle', label: 'Cycles & Mobility', icon: 'pedal_bike' },
  { id: 'calculator', label: 'Calculators', icon: 'calculate' },
  { id: 'books', label: 'Textbooks & Notes', icon: 'menu_book' },
  { id: 'electronics', label: 'Dorm Tech', icon: 'desktop_windows' },
  { id: 'other', label: 'Lab Equipment & Other', icon: 'science' },
];

export default function FilterBar({
  category,
  setCategory,
  condition,
  setCondition,
  closingSoon,
  setClosingSoon,
  under500,
  setUnder500,
  sortBy = 'closing_soon',
  setSortBy,
  itemsCount = 0,
}) {
  return (
    <section className="space-y-4">
      {/* Category Pills (Restrained, Spacious) */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1.5 pt-0.5 px-0.5 touch-pan-x">
        {CATEGORIES.map((c) => {
          const isActive = category === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 sm:gap-2 shrink-0 ${
                isActive
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 font-medium shadow-xs'
              }`}
            >
              {c.icon && (
                <span className={`material-symbols-outlined text-[16px] ${isActive ? 'text-white' : 'text-slate-500'}`}>
                  {c.icon}
                </span>
              )}
              <span>{c.label}</span>
            </button>
          );
        })}
      </div>

      {/* Secondary Filters & Sort */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Filters:</span>

          {/* Closing Soon Filter */}
          <button
            onClick={() => setClosingSoon(!closingSoon)}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
              closingSoon
                ? 'bg-rose-100 border border-rose-300 text-rose-800'
                : 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">timer</span>
            <span>&lt; 15 mins</span>
          </button>

          {/* Under ₹500 Filter */}
          <button
            onClick={() => setUnder500(!under500)}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer shrink-0 ${
              under500
                ? 'bg-indigo-50 border border-indigo-300 text-indigo-700 font-semibold'
                : 'bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 font-medium'
            }`}
          >
            Under ₹500
          </button>

          {/* Condition Filter */}
          <button
            onClick={() => setCondition(condition === 'all' ? 'like_new' : 'all')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${
              condition !== 'all'
                ? 'bg-emerald-100 border border-emerald-300 text-emerald-800 font-semibold'
                : 'bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 font-medium'
            }`}
          >
            <span className="material-symbols-outlined text-[14px] text-emerald-600">verified</span>
            <span>Mint / Good</span>
          </button>
        </div>

        {/* Sort selector */}
        <div className="flex items-center justify-between sm:justify-start gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 sm:ml-auto">
          <span className="text-xs text-slate-500 font-medium">Sort:</span>
          <div className="relative flex-1 sm:flex-initial">
            <select
              value={sortBy}
              onChange={(e) => setSortBy && setSortBy(e.target.value)}
              className="w-full sm:w-auto bg-slate-50 text-slate-800 text-xs font-semibold py-1.5 pl-3 pr-8 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-900 cursor-pointer appearance-none"
            >
              <option value="closing_soon">Closing Soonest</option>
              <option value="most_active">Most Active Bids</option>
              <option value="lowest_price">Lowest Price</option>
            </select>
            <span className="material-symbols-outlined absolute right-2.5 top-2 text-slate-400 pointer-events-none text-[16px]">
              expand_more
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
