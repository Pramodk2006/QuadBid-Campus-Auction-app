import React, { useState } from 'react';
import { X, ShieldCheck, User, AlertCircle, ArrowRight } from 'lucide-react';
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

  const selectQuickStudent = (student) => {
    setFormData(student);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 font-headline">Student Verification</h2>
              <p className="text-[11px] text-slate-500">Sign in with Kongu College ID</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Select Buttons */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Quick Select Campus Profile
            </label>
            <div className="grid grid-cols-1 gap-2">
              {DEMO_STUDENTS.map((st) => (
                <button
                  key={st.roll_number}
                  type="button"
                  onClick={() => selectQuickStudent(st)}
                  className={`p-2.5 rounded-xl border text-left text-xs transition-all flex items-center justify-between cursor-pointer ${
                    formData.roll_number === st.roll_number
                      ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20 text-indigo-950'
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs">
                      {st.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold">{st.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {st.roll_number} • {st.department} (Year {st.year})
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-600">Use</span>
                </button>
              ))}
            </div>
          </div>

          {/* Form Details */}
          <form onSubmit={handleDevSubmit} className="space-y-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Student Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Roll Number</label>
                <input
                  type="text"
                  required
                  placeholder="23ALR070"
                  value={formData.roll_number}
                  onChange={(e) => setFormData({ ...formData, roll_number: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs uppercase font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                <input
                  type="text"
                  required
                  placeholder="AIM"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs uppercase font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">College Email (@kongu.edu)</label>
              <input
                type="email"
                required
                placeholder="student.23aim@kongu.edu"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-3 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <User className="w-4 h-4" />
              <span>{submitting ? 'Authenticating...' : `Sign In as ${formData.name} (${formData.roll_number})`}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

