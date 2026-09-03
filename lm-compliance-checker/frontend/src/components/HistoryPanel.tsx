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
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
        <History size={20} color="var(--accent-primary)" />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Scan History</h3>
      </div>
      
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
          <div className="loader"></div>
        </div>
      ) : reports.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '32px 0', fontSize: '0.9rem' }}>No past scans found.</p>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <div style={{ padding: '6px', background: 'var(--bg-primary)', borderRadius: '6px' }}>
                      <FileImage size={16} color="var(--text-secondary)" />
                    </div>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px', color: 'var(--text-primary)' }}>
                      {report.original_filename}
                    </span>
                  </div>
                  <div style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, background: isPass ? 'var(--success-bg)' : 'var(--danger-bg)', color: isPass ? 'var(--success)' : 'var(--danger)' }}>
                    {isPass ? 'PASS' : 'FAIL'}
                  </div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '4px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} />
                    {new Date(report.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{report.compliance_score}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
