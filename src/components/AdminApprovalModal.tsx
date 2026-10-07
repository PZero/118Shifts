import React, { useState } from 'react';
import { X, ShieldCheck, UserCheck, UserX, UserPlus, Search, CheckCircle2, Clock } from 'lucide-react';
import { useAuth, SUPER_ADMIN_EMAIL } from '../context/AuthContext';
import { useSchedule } from '../context/ScheduleContext';

interface AdminApprovalModalProps {
  onClose: () => void;
}

export const AdminApprovalModal: React.FC<AdminApprovalModalProps> = ({ onClose }) => {
  const { allUsers, approveUser, rejectUser, toggleApproverRole, updateDoctorMapping, isSuperAdmin } = useAuth();
  const { allDoctors } = useSchedule();

  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');
  const [searchTerm, setSearchTerm] = useState('');

  const pendingUsers = allUsers.filter(u => u.status === 'pending');
  const approvedUsers = allUsers.filter(u => u.status === 'approved');

  const filteredApproved = approvedUsers.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.doctorName && u.doctorName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white m-0">
                Pannello Gestione Accessi 118
              </h3>
              <p className="text-xs text-slate-400 m-0">
                Approva le richieste dei medici e assegna i ruoli di approvatore
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-1">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'pending'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock size={14} />
            <span>In Attesa di Approvazione ({pendingUsers.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'approved'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckCircle2 size={14} />
            <span>Medici Autorizzati ({approvedUsers.length})</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
          {activeTab === 'pending' ? (
            pendingUsers.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm">
                Nessuna richiesta di accesso in sospeso al momento.
              </div>
            ) : (
              pendingUsers.map((user) => (
                <div
                  key={user.uid}
                  className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-sm font-bold text-slate-100">{user.displayName}</div>
                    <div className="text-xs text-sky-400 font-mono">{user.email}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Richiesto il: {new Date(user.createdAt).toLocaleDateString('it-IT')}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      defaultValue={user.doctorName || ''}
                      onChange={(e) => updateDoctorMapping(user.uid, e.target.value)}
                      aria-label="Associa a Medico Turni"
                      className="bg-slate-900 text-xs font-bold text-sky-400 rounded-lg px-2.5 py-1.5 border border-slate-700 outline-none"
                    >
                      <option value="">Associa a Medico Turni...</option>
                      {allDoctors.map(doc => (
                        <option key={doc} value={doc}>
                          Dr. {doc}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => approveUser(user.uid, user.doctorName)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer"
                    >
                      <UserCheck size={14} />
                      <span>Approva</span>
                    </button>

                    <button
                      onClick={() => rejectUser(user.uid)}
                      className="p-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 transition cursor-pointer"
                      title="Rifiuta richiesta"
                    >
                      <UserX size={16} />
                    </button>
                  </div>
                </div>
              ))
            )
          ) : (
            <div className="space-y-3">
              {/* Search filter */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cerca medico o email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950/60 border border-slate-700/60 rounded-xl text-xs text-slate-200 outline-none focus:border-sky-500"
                />
              </div>

              {filteredApproved.map((user) => {
                const isSuper = user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
                const isApprover = user.role === 'approver' || isSuper;

                return (
                  <div
                    key={user.uid}
                    className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-100 flex items-center gap-1.5">
                        <span>{user.displayName}</span>
                        {isSuper && (
                          <span className="text-[10px] bg-red-500/20 text-red-300 px-1.5 py-0.2 rounded border border-red-500/40">
                            Super Admin
                          </span>
                        )}
                        {user.role === 'approver' && !isSuper && (
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/40">
                            Approvatore
                          </span>
                        )}
                      </div>
                      <div className="text-slate-400 font-mono text-[11px]">{user.email}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Doctor Mapping */}
                      <select
                        value={user.doctorName || ''}
                        onChange={(e) => updateDoctorMapping(user.uid, e.target.value)}
                        aria-label="Medico nei turni"
                        className="bg-slate-900 text-xs font-semibold text-sky-400 rounded-lg px-2 py-1 border border-slate-700 outline-none"
                      >
                        <option value="">Nessuna associazione</option>
                        {allDoctors.map(doc => (
                          <option key={doc} value={doc}>
                            Dr. {doc}
                          </option>
                        ))}
                      </select>

                      {/* Toggle Approver Permission */}
                      {isSuperAdmin && !isSuper && (
                        <button
                          onClick={() => toggleApproverRole(user.uid, user.role !== 'approver')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                            user.role === 'approver'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                          }`}
                        >
                          {user.role === 'approver' ? '✓ Può Approvare' : '+ Rendi Approvatore'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-900/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
          >
            Chiudi
          </button>
        </div>

      </div>
    </div>
  );
};
