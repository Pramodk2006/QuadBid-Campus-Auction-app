import React from 'react';
import { Bike, Calculator, BookOpen, Laptop, Sparkles, Clock, Tag } from 'lucide-react';

const CATEGORIES = [
  { id: 'all', label: 'All Items', icon: Sparkles },
  { id: 'cycle', label: 'Cycles & Mobility', icon: Bike },
  { id: 'calculator', label: 'Calculators', icon: Calculator },
  { id: 'books', label: 'Books & Notes', icon: BookOpen },
  { id: 'electronics', label: 'Electronics', icon: Laptop },
  { id: 'other', label: 'Other Essentials', icon: Tag },
];

const CONDITIONS = [
  { id: 'all', label: 'All Conditions' },
  { id: 'new', label: 'Brand New' },
  { id: 'like_new', label: 'Like New' },
  { id: 'good', label: 'Good' },
  { id: 'fair', label: 'Fair' },
  { id: 'needs_repair', label: 'Needs Repair' },
];

export default function FilterBar({
  category,
  setCategory,
  condition,
  setCondition,
  closingSoon,
  setClosingSoon,
}) {
  return (
    <div className="space-y-4">
      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = category === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Secondary Bar: Condition & Closing Soon */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-white border border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Condition:</span>
          {CONDITIONS.map((cond) => {
            const isActive = condition === cond.id;
            return (
              <button
                key={cond.id}
                onClick={() => setCondition(cond.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                }`}
              >
                {cond.label}
              </button>
            );
          })}
        </div>

        {/* Closing Soon Toggle */}
        <button
          onClick={() => setClosingSoon(!closingSoon)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            closingSoon
              ? 'bg-rose-50 border border-rose-200 text-rose-600 ring-2 ring-rose-500/20'
              : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock className={`w-3.5 h-3.5 ${closingSoon ? 'text-rose-500 animate-pulse' : 'text-slate-400'}`} />
          <span>Closing in &lt; 24h</span>
        </button>
      </div>
    </div>
  );
}
