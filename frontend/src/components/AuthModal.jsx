import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

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

export default function AuthModal({ onClose, setupTokenData = null }) {
  const { loginWithDev, loginWithToken } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [oauthConfig, setOauthConfig] = useState(null);
  const [showConfigNotice, setShowConfigNotice] = useState(false);
  const [activeTab, setActiveTab] = useState(setupTokenData ? 'complete_profile' : 'google');

  // Complete profile state for post-Google OAuth first-time students
  const [profileData, setProfileData] = useState({
    setup_token: setupTokenData?.setup_token || '',
    name: setupTokenData?.name || '',
    email: setupTokenData?.email || '',
    roll_number: '',
    department: 'AIM',
    year: 3,
  });

  // Dev / demo sign-in state
  const [formData, setFormData] = useState({
    name: 'Pramod K',
    email: 'pramodk.23aim@kongu.edu',
    roll_number: '23ALR070',
    department: 'AIM',
    year: 3,
  });

  // Query Google OAuth status on mount
  useEffect(() => {
    api.getGoogleAuthUrl()
      .then((res) => {
        setOauthConfig(res);
      })
      .catch((err) => {
        console.warn('Could not query Google OAuth configuration:', err.message);
      });
  }, []);

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      const res = await api.getGoogleAuthUrl();
      if (res.is_configured && res.auth_url) {
        // Redirect browser to Google OAuth consent screen
        window.location.href = res.auth_url;
      } else {
        // Google Client ID is still placeholder — show configuration dialog
        setShowConfigNotice(true);
      }
    } catch (err) {
      setError(err.message || 'Failed to initiate Google OAuth flow.');
    }
  };

  const handleCompleteProfileSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.completeProfile({
        setup_token: profileData.setup_token,
        roll_number: profileData.roll_number.trim().toUpperCase(),
        department: profileData.department.trim().toUpperCase(),
        year: parseInt(profileData.year, 10),
      });
      await loginWithToken(res.access_token);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      <div className="relative bg-white text-slate-800 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[95vh] sm:max-h-[90vh] flex flex-col animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4.5 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="w-8 sm:w-9 h-8 sm:h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shadow-xs shrink-0">
              <span className="material-symbols-outlined text-base sm:text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                verified_user
              </span>
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 font-headline">Kongu Campus Authentication</h2>
              <p className="text-[11px] sm:text-xs text-slate-500">Requires verified @kongu.edu institutional account</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2.5">
              <span className="material-symbols-outlined text-rose-600 text-base shrink-0 mt-0.5">error</span>
              <span className="flex-1 leading-relaxed">{error}</span>
            </div>
          )}

          {/* Mode Tabs */}
          {!setupTokenData && (
            <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('google')}
                className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'google'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-sm">lock</span>
                <span>Google OAuth 2.0</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('demo')}
                className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'demo'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-sm">badge</span>
                <span>1-Click Student Sign-In</span>
              </button>
            </div>
          )}

          {/* TAB 1: GOOGLE OAUTH 2.0 */}
          {activeTab === 'google' && !setupTokenData && (
            <div className="space-y-4 pt-1">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Kongu Institutional Single Sign-On</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Sign in using your official <code className="px-1 py-0.5 rounded bg-slate-200 text-slate-800 font-mono font-semibold">@kongu.edu</code> Google Workspace account. Unauthorized personal Gmail accounts are automatically rejected.
                </p>
              </div>

              {/* Official Google Workspace Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm border-2 border-slate-200 hover:border-indigo-600 shadow-xs transition-all flex items-center justify-center gap-3 cursor-pointer group"
              >
                {/* SVG Google 'G' Icon */}
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span className="text-slate-900 group-hover:text-indigo-600 transition-colors">
                  Continue with Google Workspace (@kongu.edu)
                </span>
              </button>

              {/* Google OAuth Credentials Notice Dialog */}
              {showConfigNotice && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2.5 animate-fadeIn">
                  <div className="flex items-center gap-2 font-bold text-amber-800">
                    <span className="material-symbols-outlined text-base">info</span>
                    <span>Google OAuth Configuration Status</span>
                  </div>
                  <p className="text-amber-800/90 leading-relaxed">
                    The backend OAuth authorization endpoints (<code className="font-mono bg-amber-100 px-1 py-0.5 rounded">/api/auth/google</code> and <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">/api/auth/google/callback</code>) are fully implemented.
                  </p>
                  <p className="text-amber-800/90 leading-relaxed">
                    To connect to live Google accounts, configure your Google Cloud OAuth Client ID & Secret in <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">backend/.env</code>:
                  </p>
                  <div className="p-2.5 rounded-lg bg-amber-100/70 font-mono text-[11px] text-amber-950 space-y-1">
                    <div>GOOGLE_CLIENT_ID=your_id.apps.googleusercontent.com</div>
                    <div>GOOGLE_CLIENT_SECRET=your_secret</div>
                  </div>
                  <div className="pt-1 flex items-center justify-between">
                    <span className="font-semibold text-amber-900">Want to test right now?</span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowConfigNotice(false);
                        setActiveTab('demo');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-bold text-xs shadow-xs hover:bg-slate-800 cursor-pointer"
                    >
                      Use 1-Click Student Sign-In →
                    </button>
                  </div>
                </div>
              )}

              <div className="text-center">
                <span className="text-xs text-slate-400">or</span>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('demo')}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-200"
              >
                <span className="material-symbols-outlined text-base text-slate-600">badge</span>
                <span>Select Verified Student Demo Profile (Pramod K, Ravi S, Karthik M)</span>
              </button>
            </div>
          )}

          {/* TAB 2: 1-CLICK VERIFIED STUDENT SIGN IN */}
          {activeTab === 'demo' && !setupTokenData && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Select Verified Student Profile:
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
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-xs ring-1 ring-indigo-600'
                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold truncate">{st.name}</div>
                        <div className="text-[10px] font-mono text-indigo-700 font-semibold">{st.roll_number}</div>
                        <div className="text-[10px] text-slate-400 truncate">{st.department} • Yr {st.year}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Form details */}
              <form onSubmit={handleDevSubmit} className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Student Full Name
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
                  <span>{submitting ? 'Authenticating Identity...' : `Sign In as ${formData.name}`}</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: COMPLETE PROFILE (Post-Google OAuth first-time registration) */}
          {(activeTab === 'complete_profile' || setupTokenData) && (
            <form onSubmit={handleCompleteProfileSubmit} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs">
                <span className="font-bold">Google Authentication Successful!</span>
                <p className="mt-1 text-indigo-800">
                  Please link your verified campus roll number to activate bidding and listing rights.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Google Email
                </label>
                <input
                  type="text"
                  disabled
                  value={profileData.email}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-sm text-slate-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Roll Number (e.g. 23ALR070)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="23ALR070"
                    value={profileData.roll_number}
                    onChange={(e) => setProfileData({ ...profileData, roll_number: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 font-mono focus:border-indigo-600 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Department (e.g. AIM)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="AIM"
                    value={profileData.department}
                    onChange={(e) => setProfileData({ ...profileData, department: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:border-indigo-600 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Academic Year
                </label>
                <select
                  value={profileData.year}
                  onChange={(e) => setProfileData({ ...profileData, year: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:border-indigo-600 focus:bg-white focus:outline-none cursor-pointer"
                >
                  <option value={1}>1st Year (Junior)</option>
                  <option value={2}>2nd Year (Sophomore)</option>
                  <option value={3}>3rd Year (Pre-final)</option>
                  <option value={4}>4th Year (Graduating Senior)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-lg">check_circle</span>
                <span>{submitting ? 'Linking Profile...' : 'Complete Registration & Enter CampusSwap'}</span>
              </button>
            </form>
          )}

          <p className="text-[11px] text-center text-slate-400">
            Immutable physical quad handover protection • Verified Student Network
          </p>
        </div>
      </div>
    </div>
  );
}
