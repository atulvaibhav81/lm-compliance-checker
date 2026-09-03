import React, { useEffect, useState } from 'react';
import { Clock, History, FileImage } from 'lucide-react';
import { api } from '../services/api';
import type { ReportSummary } from '../services/api';

interface HistoryPanelProps {
  onSelectReport: (uploadId: number) => void;
  refreshTrigger: number;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ onSelectReport, refreshTrigger }) => {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const data = await api.getReports(0, 10);
        if (isMounted) {
          setReports(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to load history', err);
        if (isMounted) setReports([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchHistory();
    return () => { isMounted = false; };
  }, [refreshTrigger]);

  return (
    <div className="glass-panel flex flex-col gap-4 h-full max-h-[calc(100vh-120px)] overflow-y-auto p-4 md:p-5">
      <div className="flex items-center gap-2 border-b border-[var(--border)] pb-4">
        <History size={20} className="text-[var(--accent)]" />
        <h3 className="text-[1.1rem] font-semibold text-[var(--text-primary)] m-0">Scan History</h3>
      </div>
      
      {loading ? (
        <div className="flex justify-center p-8">
          <div className="loader"></div>
        </div>
      ) : reports.length === 0 ? (
        <p className="text-[var(--text-secondary)] text-center py-8 text-[0.9rem] m-0">No past scans found.</p>
      ) : (
        <div className="history-list">
          {reports.map((report) => {
            const isPass = report.failed === 0;
            return (
              <div 
                key={report.analysis_id} 
                className="history-card"
                onClick={() => onSelectReport(report.upload_id)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="p-1.5 bg-[var(--surface-high)] rounded-md shrink-0">
                      <FileImage size={16} className="text-[var(--text-secondary)]" />
                    </div>
                    <span className="font-semibold text-[0.9rem] whitespace-nowrap overflow-hidden text-ellipsis max-w-[140px] text-[var(--text-primary)]">
                      {report.original_filename}
                    </span>
                  </div>
                  <div className={`px-2 py-1 rounded text-[0.7rem] font-bold ${isPass ? 'bg-[var(--success-bg)] text-[var(--success)]' : 'bg-[var(--danger-bg)] text-[var(--danger)]'}`}>
                    {isPass ? 'PASS' : 'FAIL'}
                  </div>
                </div>
                
                <div className="flex justify-between items-center text-[var(--text-secondary)] text-[0.8rem] mt-1">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {new Date(report.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="font-medium text-[var(--text-primary)]">{report.compliance_score}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
