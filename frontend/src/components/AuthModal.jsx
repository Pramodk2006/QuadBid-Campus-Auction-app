import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const DEMO_STUDENTS = [
  {
    name: 'Pramod K',
    email: 'pramodk.23aim@kongu.edu',
    roll_number: '23ALR070',
    department: 'AIM',
    year: 3,
  },
  {
    name: 'Ravi S',
    email: 'ravis.21cse@kongu.edu',
    roll_number: '21CSE045',
    department: 'CSE',
    year: 4,
  },
  {
    name: 'Karthik M',
    email: 'karthikm.22itr@kongu.edu',
    roll_number: '22ITR012',
    department: 'IT',
    year: 3,
  },
];

export default function AuthModal({ onClose }) {
  const { loginWithDev } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    name: 'Pramod K',
    email: 'pramodk.23aim@kongu.edu',
    roll_number: '23ALR070',
    department: 'AIM',
    year: 3,
  });

  const handleDevSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await loginWithDev(formData);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative bg-white text-slate-800 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-base">verified</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 font-headline">Campus Identity Sign In</h2>
              <p className="text-xs text-slate-500">Requires @kongu.edu student account</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-rose-600 text-base">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Quick Switch Preset Students */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Select Demo Student Profile:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {DEMO_STUDENTS.map((st) => {
                const isSelected = formData.roll_number === st.roll_number;
                return (
                  <button
                    key={st.roll_number}
                    type="button"
                    onClick={() => setFormData(st)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-xs'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold truncate">{st.name}</div>
                    <div className="text-[10px] font-mono text-slate-500">{st.roll_number}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sign In Form */}
          <form onSubmit={handleDevSubmit} className="space-y-3.5 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:border-indigo-600 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                College Email (@kongu.edu)
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:border-indigo-600 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Roll Number
                </label>
                <input
                  type="text"
                  required
                  value={formData.roll_number}
                  onChange={(e) => setFormData({ ...formData, roll_number: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 font-mono focus:border-indigo-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Department
                </label>
                <input
                  type="text"
                  required
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:border-indigo-600 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-lg">login</span>
              <span>{submitting ? 'Verifying Identity...' : 'Sign In as Student'}</span>
            </button>
          </form>

          <p className="text-[11px] text-center text-slate-400">
            All bids and listings publicly display your verified Name and Roll Number.
          </p>
        </div>
      </div>
    </div>
  );
}
