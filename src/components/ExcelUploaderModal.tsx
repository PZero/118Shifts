import React, { useState } from 'react';
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useSchedule } from '../context/ScheduleContext';
import { useAuth } from '../context/AuthContext';

interface ExcelUploaderModalProps {
  onClose: () => void;
}

export const ExcelUploaderModal: React.FC<ExcelUploaderModalProps> = ({ onClose }) => {
  const { uploadExcelFile, isUploading } = useSchedule();
  const { userProfile } = useAuth();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setFeedback(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    const result = await uploadExcelFile(selectedFile);
    setFeedback(result);
    if (result.success) {
      setTimeout(() => {
        onClose();
      }, 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white m-0">
                Carica Turni Excel
              </h3>
              <p className="text-xs text-slate-400 m-0">
                I turni caricati saranno immediatamente disponibili per tutti i colleghi
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

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-2xl p-6 text-center transition bg-slate-950/40">
            <FileSpreadsheet size={36} className="mx-auto text-emerald-400 mb-2 opacity-80" />
            <p className="text-sm font-semibold text-slate-200 mb-1">
              Seleziona il file .xlsx dei turni
            </p>
            <p className="text-xs text-slate-400 mb-4">
              Formato standard 118: fogli mensili, 2 righe per medico, codici M, P, N, RN, RG, e, F, C
            </p>

            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shadow-lg shadow-emerald-900/20">
              <Upload size={14} />
              <span>Sfoglia File</span>
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {selectedFile && (
              <div className="mt-4 p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 flex items-center justify-between">
                <span className="font-semibold truncate max-w-[250px]">{selectedFile.name}</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </span>
              </div>
            )}
          </div>

          {feedback && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              feedback.success 
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' 
                : 'bg-red-950/40 border-red-500/40 text-red-300'
            }`}>
              {feedback.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{feedback.message}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isUploading}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
          >
            Annulla
          </button>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition shadow-lg cursor-pointer"
          >
            {isUploading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Elaborazione...</span>
              </>
            ) : (
              <>
                <Upload size={14} />
                <span>Conferma e Sovrascrivi</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
