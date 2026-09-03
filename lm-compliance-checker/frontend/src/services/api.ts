export interface Finding {
  rule_code: string;
  rule_name: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'SKIP';
  extracted_value: string | null;
  message: string;
}

export interface Summary {
  total_rules: number;
  PASS: number;
  FAIL: number;
  WARN: number;
  SKIP: number;
  compliance_score: number;
}

export interface AnalysisResponse {
  analysis_id: number;
  upload_id: number;
  ocr_text: string;
  ocr_confidence: number;
  image_quality_confidence: number;
  company_name?: string | null;
  product_name?: string | null;
  auditor_notes?: string | null;
  annotated_image_path?: string | null;
  findings: Finding[];
  summary: Summary;
}

export interface ReportSummary {
  analysis_id: number;
  upload_id: number;
  original_filename: string;
  upload_status: string;
  ocr_confidence: number | null;
  image_quality_confidence: number | null;
  created_at: string;
  total_rules: number;
  passed: number;
  failed: number;
  warned: number;
  compliance_score: number;
}

export interface BatchItem {
  item_id: number;
  upload_id: number | null;
  analysis_id: number | null;
  filename: string;
  status: string;
  compliance_score: number | null;
  pass_count: number | null;
  fail_count: number | null;
  warn_count: number | null;
  error_message: string | null;
}

export interface BatchJob {
  batch_id: number;
  batch_name: string | null;
  status: string;
  total_images: number;
  processed_images: number;
  failed_images: number;
  avg_compliance_score: number | null;
  created_at: string | null;
  items: BatchItem[];
}

export interface BatchSummary {
  batch_id: number;
  batch_name: string | null;
  status: string;
  total_images: number;
  processed_images: number;
  failed_images: number;
  avg_compliance_score: number | null;
  created_at: string | null;
}

export interface ViolationPenalty {
  rule_code: string;
  rule_name: string;
  act_section: string;
  description: string;
  fine_min: number;
  fine_max: number;
  imprisonment_months: number;
  is_repeat_offense: boolean;
  notes?: string;
}

export interface PenaltyResult {
  analysis_id: number;
  record_id: number | null;
  is_repeat_offense: boolean;
  violation_count: number;
  total_fine_min: number;
  total_fine_max: number;
  violations: ViolationPenalty[];
  summary_text: string;
  applicable_act: string;
}

export interface PenaltyMatrixEntry {
  rule_code: string;
  act_section: string;
  description: string;
  first_offense_min: number;
  first_offense_max: number;
  repeat_offense_min: number;
  repeat_offense_max: number;
  notes?: string;
}

export interface USPValidationResult {
  status: 'PASS' | 'FAIL' | 'WARN' | 'SKIP';
  mrp: number | null;
  net_quantity: number | null;
  quantity_unit: string | null;
  quantity_base_unit: string | null;
  printed_usp: number | null;
  computed_usp: number | null;
  difference_pct: number | null;
  tolerance_pct: number;
  message: string;
  confidence: number;
}

export interface DashboardStats {
  period_days: number;
  summary: {
    total_scans: number;
    total_batches: number;
    avg_compliance_score: number;
    compliant_count: number;
    partial_count: number;
    non_compliant_count: number;
    total_violations: number;
  };
  top_violations: { rule_name: string; count: number }[];
  daily_trend: { date: string; scans: number; avg_score: number; failed: number }[];
  score_distribution: { [key: string]: number };
  recent_scans: {
    analysis_id: number;
    filename: string;
    compliance_score: number;
    passed: number;
    failed: number;
    created_at: string;
  }[];
}

const API_BASE = 'https://REPLACE_WITH_YOUR_NEW_PINGGY_URL/api';

export const api = {
  // ── Existing endpoints ─────────────────────────────────────────────────
  uploadImage: async (file: File): Promise<{ upload_id: number; message: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  },

  analyzeUpload: async (uploadId: number): Promise<AnalysisResponse> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      const res = await fetch(`${API_BASE}/analyze/${uploadId}`, {
        method: 'POST',
        signal: controller.signal,
      });
      if (!res.ok) throw new Error('Analysis failed');
      return await res.json();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('Analysis timed out. The OCR engine might be initialising.');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  getReports: async (skip = 0, limit = 20): Promise<ReportSummary[]> => {
    const res = await fetch(`${API_BASE}/reports?skip=${skip}&limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch reports');
    return res.json();
  },

  checkHealth: async (): Promise<boolean> => {
    try {
      const res = await fetch(API_BASE.replace('/api', '/health'));
      return res.ok;
    } catch {
      return false;
    }
  },

  // ── Dashboard ─────────────────────────────────────────────────────────
  getDashboardStats: async (days = 30): Promise<DashboardStats> => {
    const res = await fetch(`${API_BASE}/dashboard/stats?days=${days}`);
    if (!res.ok) throw new Error('Failed to fetch dashboard stats');
    return res.json();
  },

  // ── Batch ─────────────────────────────────────────────────────────────
  uploadBatch: async (
    files: File[],
    batchName?: string
  ): Promise<{ batch_id: number; message: string; total_images: number }> => {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    if (batchName) formData.append('batch_name', batchName);
    const res = await fetch(`${API_BASE}/batch/upload`, { method: 'POST', body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(err.detail || 'Batch upload failed');
    }
    return res.json();
  },

  processBatch: async (batchId: number): Promise<BatchJob> => {
    const res = await fetch(`${API_BASE}/batch/${batchId}/process`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Processing failed' }));
      throw new Error(err.detail || 'Batch processing failed');
    }
    return res.json();
  },

  getBatch: async (batchId: number): Promise<BatchJob> => {
    const res = await fetch(`${API_BASE}/batch/${batchId}`);
    if (!res.ok) throw new Error('Failed to fetch batch');
    return res.json();
  },

  listBatches: async (skip = 0, limit = 20): Promise<BatchSummary[]> => {
    const res = await fetch(`${API_BASE}/batch?skip=${skip}&limit=${limit}`);
    if (!res.ok) throw new Error('Failed to list batches');
    return res.json();
  },

  // ── Penalties ─────────────────────────────────────────────────────────
  calculatePenalty: async (
    analysisId: number,
    isRepeatOffense: boolean,
    customViolations?: string[]
  ): Promise<PenaltyResult> => {
    const res = await fetch(`${API_BASE}/penalties/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        analysis_id: analysisId,
        is_repeat_offense: isRepeatOffense,
        custom_violations: customViolations || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Calculation failed' }));
      throw new Error(err.detail || 'Penalty calculation failed');
    }
    return res.json();
  },

  getPenaltyMatrix: async (): Promise<PenaltyMatrixEntry[]> => {
    const res = await fetch(`${API_BASE}/penalties/matrix`);
    if (!res.ok) throw new Error('Failed to fetch penalty matrix');
    return res.json();
  },

  // ── USP Validator ─────────────────────────────────────────────────────
  validateUSP: async (
    mrp: number,
    netQuantity: number,
    quantityUnit: string,
    printedUsp?: number
  ): Promise<USPValidationResult> => {
    const res = await fetch(`${API_BASE}/usp/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mrp,
        net_quantity: netQuantity,
        quantity_unit: quantityUnit,
        printed_usp: printedUsp || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Validation failed' }));
      throw new Error(err.detail || 'USP validation failed');
    }
    return res.json();
  },

  extractValidateUSP: async (analysisId: number): Promise<USPValidationResult> => {
    const res = await fetch(`${API_BASE}/usp/extract-validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysis_id: analysisId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Extraction failed' }));
      throw new Error(err.detail || 'USP extraction failed');
    }
    return res.json();
  },

  updateMetadata: async (analysisId: number, metadata: { company_name?: string; product_name?: string; auditor_notes?: string }) => {
    const res = await fetch(`${API_BASE}/analyze/${analysisId}/metadata`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to update metadata' }));
      throw new Error(err.detail || 'Failed to update metadata');
    }
    return res.json();
  },

  // ── Export ────────────────────────────────────────────────────────────
  downloadPDF: (analysisId: number, includePenalty = false, isRepeat = false): void => {
    const url = `${API_BASE}/export/pdf/${analysisId}?include_penalty=${includePenalty}&is_repeat_offense=${isRepeat}`;
    window.open(url, '_blank');
  },

  downloadBatchCSV: (batchId: number): void => {
    window.open(`${API_BASE}/export/csv/batch/${batchId}`, '_blank');
  },

  downloadAllCSV: (limit = 100): void => {
    window.open(`${API_BASE}/export/csv/all?limit=${limit}`, '_blank');
  },
};export interface DashboardStats {
  total_scans?: number;
  compliant?: number;
  non_compliant?: number;
  total_violations?: number;
  total_penalties_inr?: number;
  [key: string]: any;
}

export interface DashboardStats {
  total_scans?: number;
  compliant?: number;
  non_compliant?: number;
  total_violations?: number;
  total_penalties_inr?: number;
  [key: string]: any;
}

export const DashboardStats = {};

export const BatchItem = {};
export const PenaltyMatrix = {};
export const Violation = {};
