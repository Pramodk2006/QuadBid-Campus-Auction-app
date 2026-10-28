import React from 'react';
import { Bike, Calculator, BookOpen, Laptop, Sparkles, Clock, Tag, ChevronDown, CheckCircle } from 'lucide-react';

const CATEGORIES = [
  { id: 'all', label: 'All Items', icon: Sparkles },
  { id: 'cycle', label: 'Cycles & Mobility', icon: Bike },
  { id: 'calculator', label: 'Calculators', icon: Calculator },
  { id: 'books', label: 'Textbooks & Notes', icon: BookOpen },
  { id: 'electronics', label: 'Dorm Tech', icon: Laptop },
  { id: 'other', label: 'Lab Equipment & Other', icon: Tag },
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
}) {
  return (
    <section className="space-y-4">
      {/* Category Pills */}
      <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-1">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = category === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                isActive
                  ? 'bg-[#7dd3fc] text-[#001f2e] shadow-sm font-bold'
                  : 'bg-[#111828] hover:bg-[#1a2438] border border-[#2a3a48]/70 text-[#a0b4c4] hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Secondary Filters & Sort Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-[#111828] border border-[#2a3a48]/50">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[11px] font-semibold text-[#4a6070] uppercase tracking-wider">Filters:</span>

          {/* Closing soon < 15 mins filter */}
          <button
            onClick={() => setClosingSoon(!closingSoon)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              closingSoon
                ? 'bg-[#3d1414]/80 border-[#ff6b6b] text-[#ff6b6b]'
                : 'bg-[#3d1414]/30 border-[#ff6b6b]/30 text-[#ff6b6b] hover:bg-[#3d1414]/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Closing in &lt; 24h</span>
          </button>

          {/* Under ₹500 filter */}
          <button
            onClick={() => setUnder500(!under500)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
              under500
                ? 'bg-[#7dd3fc]/20 border-[#7dd3fc] text-[#7dd3fc]'
                : 'bg-[#141c2e] hover:bg-[#1a2438] border-[#2a3a48] text-[#a0b4c4] hover:text-white'
            }`}
          >
            Under ₹500
          </button>

          {/* Condition toggle */}
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="bg-[#141c2e] hover:bg-[#1a2438] border border-[#2a3a48] text-[#a0b4c4] hover:text-white text-xs font-medium py-1.5 px-3 rounded-lg focus:outline-none focus:border-[#7dd3fc] cursor-pointer"
          >
            <option value="all">Condition: All</option>
            <option value="new">Brand New</option>
            <option value="like_new">Like New</option>
            <option value="good">Good Condition</option>
            <option value="fair">Fair Wear</option>
            <option value="needs_repair">Needs Repair</option>
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#a0b4c4]">
          <CheckCircle className="w-4 h-4 text-[#7dd3fc]" />
          <span className="hidden sm:inline">Handover protected by Quad verification</span>
        </div>
      </div>
    </section>
  );
}
