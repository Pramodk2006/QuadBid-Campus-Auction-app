import React, { useState } from 'react';
import { X, ShieldCheck, User, AlertCircle } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0e1a]/85 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative bg-[#0f1524] text-[#e0e8f0] w-full max-w-md rounded-2xl shadow-2xl border border-[#2a3a48] overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a3a48] bg-[#111828]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#7dd3fc]/10 text-[#7dd3fc] flex items-center justify-center font-bold border border-[#7dd3fc]/20">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-headline">Student Verification</h2>
              <p className="text-[11px] text-[#88b4cc]">Sign in with Kongu College ID</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#a0b4c4] hover:text-white hover:bg-[#1a2438] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-[#3d1414]/80 border border-[#ff6b6b]/40 text-[#ff6b6b] text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Profile Selection */}
          <div>
            <label className="block text-[11px] font-bold text-[#88b4cc] uppercase tracking-wider mb-2">
              Select Campus Profile
            </label>
            <div className="grid grid-cols-1 gap-2">
              {DEMO_STUDENTS.map((st) => (
                <button
                  key={st.roll_number}
                  type="button"
                  onClick={() => setFormData(st)}
                  className={`p-2.5 rounded-xl border text-left text-xs transition-all flex items-center justify-between cursor-pointer ${
                    formData.roll_number === st.roll_number
                      ? 'bg-[#1a2438] border-[#7dd3fc] text-white ring-1 ring-[#7dd3fc]/50'
                      : 'bg-[#111828] hover:bg-[#141c2e] border-[#2a3a48] text-[#a0b4c4]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[#1a2438] text-[#7dd3fc] font-bold flex items-center justify-center text-xs border border-[#7dd3fc]/20">
                      {st.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-white">{st.name}</div>
                      <div className="text-[11px] text-[#88b4cc] font-mono">
                        {st.roll_number} • {st.department} (Year {st.year})
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-[#7dd3fc]">Use</span>
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleDevSubmit} className="space-y-3 pt-2 border-t border-[#2a3a48]">
            <div>
              <label className="block text-xs font-bold text-[#88b4cc] mb-1">Student Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-[#111828] border border-[#2a3a48] text-xs text-white focus:border-[#7dd3fc] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-[#88b4cc] mb-1">Roll Number</label>
                <input
                  type="text"
                  required
                  placeholder="23ALR070"
                  value={formData.roll_number}
                  onChange={(e) => setFormData({ ...formData, roll_number: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-xl bg-[#111828] border border-[#2a3a48] text-xs text-white uppercase font-mono font-bold focus:border-[#7dd3fc] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#88b4cc] mb-1">Department</label>
                <input
                  type="text"
                  required
                  placeholder="AIM"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-xl bg-[#111828] border border-[#2a3a48] text-xs text-white uppercase font-bold focus:border-[#7dd3fc] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#88b4cc] mb-1">College Email (@kongu.edu)</label>
              <input
                type="email"
                required
                placeholder="student.23aim@kongu.edu"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-[#111828] border border-[#2a3a48] text-xs text-white focus:border-[#7dd3fc] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-3 py-3 px-4 bg-[#7dd3fc] hover:bg-[#c8eaff] text-[#001f2e] font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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
