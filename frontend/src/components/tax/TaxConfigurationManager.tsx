import React, { useState, useEffect } from 'react';
import { 
  Scale, 
  Plus, 
  Edit3, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck, 
  X, 
  Trash2
} from 'lucide-react';
import api, { ensureSession } from '../../lib/api';
import { useModal } from '../../contexts/ModalContext';

interface TaxRule {
  config_id: number;
  category: 'smv' | 'assessment_level' | 'tax_rate' | 'sef_levy' | 'discount' | 'penalty_interest' | 'numbering_format';
  rule_code: string;
  rule_name: string;
  property_classification: string;
  actual_use?: string;
  value_numeric: number | string;
  tax_year?: number;
  legal_reference?: string;
  source_document?: string;
  verification_status: string;
  effective_start_date: string;
  effective_end_date?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

interface ReadinessItem {
  id: number;
  title: string;
  description: string;
  category: string;
  status: string;
  legal_reference: string;
  configured_count: number;
  is_ready: boolean;
}

export const TaxConfigurationManager: React.FC = () => {
  const { showSuccess, showError, showConfirm } = useModal();
  const [rules, setRules] = useState<TaxRule[]>([]);
  const [readinessChecklist, setReadinessChecklist] = useState<ReadinessItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'rules' | 'readiness'>('rules');

  // Add / Edit Modal state (Assessor only)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<TaxRule | null>(null);
  const [formCategory, setFormCategory] = useState<string>('assessment_level');
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formClassification, setFormClassification] = useState('ALL');
  const [formValue, setFormValue] = useState('');
  const [formTaxYear, setFormTaxYear] = useState(String(new Date().getFullYear()));
  const [formLegalRef, setFormLegalRef] = useState('');
  const [formSourceDoc, setFormSourceDoc] = useState('');
  const [formStartDate, setFormStartDate] = useState(`${new Date().getFullYear()}-01-01`);
  const [formEndDate, setFormEndDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reject / Return Modal state (Admin only)
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingRule, setRejectingRule] = useState<TaxRule | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  const userRole = (localStorage.getItem('accessor_role') || '').toLowerCase();
  const isAssessor = userRole === 'assessor';
  const isAdmin = userRole === 'admin';
  const hasActions = isAssessor || isAdmin;

  const fetchTaxConfigs = async () => {
    try {
      setLoading(true);
      await ensureSession();
      const [rulesRes, readyRes] = await Promise.all([
        api.get('/tax-configurations'),
        api.get('/tax-configurations/readiness')
      ]);
      setRules(Array.isArray(rulesRes.data) ? rulesRes.data : []);
      setReadinessChecklist(readyRes.data?.checklist || []);
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to load tax configurations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTaxConfigs();
  }, []);

  const openAddModal = (presetCategory?: string) => {
    setEditingRule(null);
    setFormCategory(presetCategory || 'assessment_level');
    setFormCode('');
    setFormName('');
    setFormClassification('ALL');
    setFormValue('');
    setFormTaxYear(String(new Date().getFullYear()));
    setFormLegalRef('RA 7160 / Municipal Ordinance');
    setFormSourceDoc('');
    setFormStartDate(`${new Date().getFullYear()}-01-01`);
    setFormEndDate('');
    setFormNotes('');
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (rule: TaxRule) => {
    setEditingRule(rule);
    setFormCategory(rule.category);
    setFormCode(rule.rule_code);
    setFormName(rule.rule_name);
    setFormClassification(rule.property_classification || 'ALL');
    setFormValue(String(rule.value_numeric));
    setFormTaxYear(rule.tax_year ? String(rule.tax_year) : String(new Date().getFullYear()));
    setFormLegalRef(rule.legal_reference || '');
    setFormSourceDoc(rule.source_document || '');
    setFormStartDate(rule.effective_start_date ? rule.effective_start_date.substring(0, 10) : `${new Date().getFullYear()}-01-01`);
    setFormEndDate(rule.effective_end_date ? rule.effective_end_date.substring(0, 10) : '');
    setFormNotes(rule.notes || '');
    setFormError('');
    setModalOpen(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const val = parseFloat(formValue);
    if (isNaN(val)) {
      setFormError('Numeric value must be a valid number.');
      return;
    }
    if (val < 0) {
      setFormError('Invalid rate or percentage: Negative values are strictly forbidden.');
      return;
    }

    if (formEndDate && new Date(formEndDate) < new Date(formStartDate)) {
      setFormError('Effective end date cannot precede effective start date.');
      return;
    }

    setIsSubmitting(true);
    try {
      await ensureSession();
      const payload = {
        category: formCategory,
        rule_code: formCode.trim().toUpperCase(),
        rule_name: formName.trim(),
        property_classification: formClassification,
        value_numeric: val,
        tax_year: formTaxYear ? parseInt(formTaxYear, 10) : undefined,
        legal_reference: formLegalRef.trim(),
        source_document: formSourceDoc.trim(),
        effective_start_date: formStartDate,
        effective_end_date: formEndDate || null,
        notes: formNotes.trim()
      };

      if (editingRule) {
        await api.put(`/tax-configurations/${editingRule.config_id}`, payload);
        showSuccess(`Tax rule '${payload.rule_name}' updated successfully.`);
      } else {
        await api.post('/tax-configurations', payload);
        showSuccess(`Tax rule '${payload.rule_name}' created successfully.`);
      }

      setModalOpen(false);
      fetchTaxConfigs();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save configuration rule.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyApprove = (rule: TaxRule) => {
    showConfirm(
      `Officially verify and approve '${rule.rule_name}' for municipal assessment and tax computation?`,
      async () => {
        try {
          await ensureSession();
          await api.post(`/tax-configurations/${rule.config_id}/verify`);
          showSuccess(`Tax rule '${rule.rule_name}' officially verified and approved.`);
          fetchTaxConfigs();
        } catch (err: any) {
          showError(err.response?.data?.message || 'Failed to approve rule.');
        }
      },
      'Confirm Rule Approval'
    );
  };

  const openRejectModal = (rule: TaxRule) => {
    setRejectingRule(rule);
    setRejectionReason('');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingRule) return;
    if (!rejectionReason.trim()) {
      showError('Please provide a reason or comment for returning/rejecting this rule.');
      return;
    }
    try {
      setIsRejecting(true);
      await ensureSession();
      await api.post(`/tax-configurations/${rejectingRule.config_id}/reject`, {
        rejection_reason: rejectionReason.trim()
      });
      showSuccess(`Rule '${rejectingRule.rule_name}' rejected and returned to Assessor with feedback.`);
      setRejectModalOpen(false);
      fetchTaxConfigs();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to reject rule.');
    } finally {
      setIsRejecting(false);
    }
  };

  const handleDeactivate = (rule: TaxRule) => {
    showConfirm(
      `Deactivate/expire '${rule.rule_name}'? It will no longer apply to future tax calculations.`,
      async () => {
        try {
          await ensureSession();
          await api.post(`/tax-configurations/${rule.config_id}/deactivate`);
          showSuccess(`Rule '${rule.rule_name}' deactivated.`);
          fetchTaxConfigs();
        } catch (err: any) {
          showError(err.response?.data?.message || 'Failed to deactivate rule.');
        }
      },
      'Confirm Rule Deactivation'
    );
  };

  const handleDelete = (rule: TaxRule) => {
    showConfirm(
      `Permanently delete configuration rule '${rule.rule_name}'?`,
      async () => {
        try {
          await ensureSession();
          await api.delete(`/tax-configurations/${rule.config_id}`);
          showSuccess(`Rule '${rule.rule_name}' deleted.`);
          fetchTaxConfigs();
        } catch (err: any) {
          showError(err.response?.data?.message || 'Failed to delete rule.');
        }
      },
      'Confirm Deletion'
    );
  };

  const categories = [
    { key: 'ALL', label: 'All Settings' },
    { key: 'assessment_level', label: 'Assessment Levels' },
    { key: 'tax_rate', label: 'Basic Tax Rate' },
    { key: 'sef_levy', label: 'SEF Levy' },
    { key: 'discount', label: 'Discounts & Exemptions' },
    { key: 'penalty_interest', label: 'Penalties & Interest' },
    { key: 'smv', label: 'Market Values (SMV)' },
    { key: 'numbering_format', label: 'Billing Formats' },
  ];

  const filteredRules = rules.filter(r => activeCategory === 'ALL' || r.category === activeCategory);

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'tax_rate':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">Basic RPT</span>;
      case 'sef_levy':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">SEF Levy</span>;
      case 'assessment_level':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">Assessment Level</span>;
      case 'discount':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Discount</span>;
      case 'penalty_interest':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">Penalty & Interest</span>;
      case 'smv':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">SMV Schedule</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">{cat}</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    const s = String(status).toLowerCase();
    if (s === 'approved' || s === 'active') {
      return (
        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 size={13} /> Approved & Active
        </span>
      );
    }
    if (s === 'pending_verification' || s === 'pending verification') {
      return (
        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          <Clock size={13} /> Pending Verification
        </span>
      );
    }
    if (s === 'rejected' || s === 'returned') {
      return (
        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          <AlertCircle size={13} /> Returned / Rejected
        </span>
      );
    }
    if (s === 'expired' || s === 'superseded') {
      return (
        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">
          Expired / Superseded
        </span>
      );
    }
    return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">{status}</span>;
  };

  // Compute key statutory figures for quick display
  const basicRate = rules.find(r => r.category === 'tax_rate' && (r.verification_status === 'approved' || r.verification_status === 'active'))?.value_numeric || '0.0100';
  const sefRate = rules.find(r => r.category === 'sef_levy' && (r.verification_status === 'approved' || r.verification_status === 'active'))?.value_numeric || '0.0100';
  const discountRate = rules.find(r => r.category === 'discount' && (r.verification_status === 'approved' || r.verification_status === 'active'))?.value_numeric || '0.1000';
  const penaltyRate = rules.find(r => r.category === 'penalty_interest' && (r.verification_status === 'approved' || r.verification_status === 'active'))?.value_numeric || '0.0200';

  return (
    <div className="space-y-6">
      {/* Top Banner / Summary */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg">
                <Scale size={22} />
              </span>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Municipal Tax & Assessment Configuration
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
              Centralized property assessment levels, schedule of market values, basic tax rates, SEF levies, discounts, and delinquency interest rules for the Municipality of Lagonglong. Managed exclusively by the Municipal Assessor; reviewed and verified by Admin.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setViewMode(viewMode === 'rules' ? 'readiness' : 'rules')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer border ${
                viewMode === 'readiness'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-50'
              }`}
            >
              <ShieldCheck size={14} />
              <span>{viewMode === 'readiness' ? 'View Tax Rules' : 'Statutory Readiness Checklist'}</span>
            </button>

            {isAssessor && (
              <button
                id="add-tax-rule-btn"
                data-testid="add-tax-rule-btn"
                onClick={() => openAddModal()}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus size={15} /> Add Tax Rule
              </button>
            )}

            {isAdmin && (
              <span className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-semibold">
                Admin Review Mode
              </span>
            )}

            <button
              onClick={fetchTaxConfigs}
              disabled={loading}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 rounded-lg transition cursor-pointer"
              title="Refresh configurations"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Quick Rate Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-gray-100 dark:border-gray-800">
          <div className="bg-gray-50 dark:bg-gray-850 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Basic RPT Levy</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-lg font-bold text-gray-900 dark:text-white">{(Number(basicRate) * 100).toFixed(1)}%</span>
              <span className="text-[10px] text-gray-400">RA 7160 Sec. 233</span>
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-850 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase">SEF Levy</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-lg font-bold text-gray-900 dark:text-white">{(Number(sefRate) * 100).toFixed(1)}%</span>
              <span className="text-[10px] text-gray-400">Local School Board</span>
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-850 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Q1 Prompt Discount</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{(Number(discountRate) * 100).toFixed(1)}%</span>
              <span className="text-[10px] text-gray-400">Sec. 251</span>
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-850 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Monthly Delinquency</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-lg font-bold text-rose-600 dark:text-rose-400">{(Number(penaltyRate) * 100).toFixed(1)}%</span>
              <span className="text-[10px] text-gray-400">Max 72%</span>
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'readiness' ? (
        /* Statutory Readiness Checklist */
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="text-emerald-600" size={18} />
                Lagonglong Municipal Statutory Checklist (RA 7160 & RA 12001)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Statutory readiness requirements before issuing official tax declarations and computations.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              {readinessChecklist.filter(i => i.is_ready).length} / {readinessChecklist.length} Requirements Ready
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {readinessChecklist.map((item) => (
              <div 
                key={item.id}
                className={`p-4 rounded-xl border transition ${
                  item.is_ready 
                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                    : 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      {item.is_ready ? (
                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                      ) : (
                        <Clock size={16} className="text-amber-600 shrink-0" />
                      )}
                      <h4 className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white">
                        {item.title}
                      </h4>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      {item.description}
                    </p>
                    <div className="flex items-center gap-2 pt-1 text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                      <span>Legal: {item.legal_reference}</span>
                      <span>•</span>
                      <span>Configured: {item.configured_count}</span>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                    item.is_ready 
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                  }`}>
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Configuration Rules Table & Tabs */
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 p-3 border-b border-gray-200 dark:border-gray-800 overflow-x-auto custom-scrollbar">
            {categories.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  activeCategory === key
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-850/70 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Rule Code & Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Classification</th>
                  <th className="py-3 px-4">Numeric Rate / Value</th>
                  <th className="py-3 px-4">Effective Dates</th>
                  <th className="py-3 px-4">Legal Reference</th>
                  <th className="py-3 px-4">Status</th>
                  {hasActions && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredRules.length === 0 ? (
                  <tr>
                    <td colSpan={hasActions ? 8 : 7} className="py-8 text-center text-gray-500">
                      No tax configuration rules found for the selected category.
                    </td>
                  </tr>
                ) : (
                  filteredRules.map((rule) => {
                    const numVal = parseFloat(String(rule.value_numeric));
                    const isPercentage = ['tax_rate', 'sef_levy', 'assessment_level', 'discount', 'penalty_interest'].includes(rule.category);
                    const formattedValue = isPercentage
                      ? `${(numVal * 100).toFixed(2)}%`
                      : numVal.toLocaleString();

                    return (
                      <tr 
                        key={rule.config_id}
                        className="hover:bg-gray-50/60 dark:hover:bg-gray-850/60 transition"
                      >
                        <td className="py-3 px-4">
                          <div className="font-bold text-gray-900 dark:text-white">
                            {rule.rule_name}
                          </div>
                          <div className="font-mono text-[10px] text-gray-400">
                            {rule.rule_code}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {getCategoryBadge(rule.category)}
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                          {rule.property_classification || 'ALL'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded font-mono">
                            {formattedValue}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                          <div>From: {rule.effective_start_date ? rule.effective_start_date.substring(0, 10) : '—'}</div>
                          {rule.effective_end_date && (
                            <div className="text-[10px] text-gray-400">To: {rule.effective_end_date.substring(0, 10)}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-500 dark:text-gray-400 max-w-[200px] truncate" title={rule.legal_reference}>
                          {rule.legal_reference || '—'}
                        </td>
                        <td className="py-3 px-4">
                          {getStatusBadge(rule.verification_status)}
                        </td>
                        {hasActions && (
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Admin review controls: Approve & Return/Reject */}
                              {isAdmin && (rule.verification_status === 'pending_verification' || rule.verification_status === 'pending verification') && (
                                <>
                                  <button
                                    onClick={() => handleVerifyApprove(rule)}
                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold transition cursor-pointer"
                                    title="Approve for official calculations"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => openRejectModal(rule)}
                                    className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-semibold transition cursor-pointer"
                                    title="Return / Reject with reason"
                                  >
                                    Return
                                  </button>
                                </>
                              )}

                              {/* Assessor management controls: Edit, Deactivate, Delete */}
                              {isAssessor && (
                                <>
                                  <button
                                    onClick={() => openEditModal(rule)}
                                    className="p-1 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition cursor-pointer"
                                    title="Edit Rule"
                                  >
                                    <Edit3 size={14} />
                                  </button>
                                  {(rule.verification_status === 'approved' || rule.verification_status === 'active') && (
                                    <button
                                      onClick={() => handleDeactivate(rule)}
                                      className="p-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded transition cursor-pointer"
                                      title="Deactivate / Expire Rule"
                                    >
                                      <Clock size={14} />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDelete(rule)}
                                    className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition cursor-pointer"
                                    title="Delete Rule"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Tax Rule Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
                  <Scale size={18} />
                </span>
                <h3 className="font-bold text-gray-900 dark:text-white text-base">
                  {editingRule ? 'Edit Tax Configuration Rule' : 'New Municipal Tax Rule'}
                </h3>
              </div>
              <button 
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 font-medium flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="assessment_level">Approved Assessment Level</option>
                    <option value="tax_rate">Basic Property Tax Rate</option>
                    <option value="sef_levy">Special Education Fund (SEF)</option>
                    <option value="discount">Discount / Exemption</option>
                    <option value="penalty_interest">Penalty & Delinquency Interest</option>
                    <option value="smv">Schedule of Market Values (SMV)</option>
                    <option value="numbering_format">Billing Numbering Format</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Classification <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formClassification}
                    onChange={(e) => setFormClassification(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="ALL">ALL Classifications</option>
                    <option value="Residential">Residential</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Agricultural">Agricultural</option>
                    <option value="Industrial">Industrial</option>
                    <option value="Mineral">Mineral</option>
                    <option value="Special">Special / Government</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Rule Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AL_RESIDENTIAL_LAND"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Rule Name / Description <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Residential Land Statutory Assessment Level"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-gray-700 dark:text-gray-300">
                      Rate / Value <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[10px] text-gray-400">Cannot be negative</span>
                  </div>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    placeholder="e.g. 0.20 for 20%"
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Tax Year Applicable
                  </label>
                  <input
                    type="number"
                    min="2020"
                    max="2050"
                    value={formTaxYear}
                    onChange={(e) => setFormTaxYear(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Effective Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Effective End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Legal Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. RA 7160 Sec. 218 / Municipal Ordinance No. 2024-01"
                  value={formLegalRef}
                  onChange={(e) => setFormLegalRef(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Notes / Ordinance Details
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional context or notes..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : (editingRule ? 'Update Rule' : 'Save Rule')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Rejection / Return Modal */}
      {rejectModalOpen && rejectingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600">
                  <AlertCircle size={18} />
                </span>
                <h3 className="font-bold text-gray-900 dark:text-white text-base">
                  Return / Reject Tax Rule
                </h3>
              </div>
              <button 
                onClick={() => setRejectModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmReject} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-1">
                <div className="font-bold text-gray-900 dark:text-white">{rejectingRule.rule_name}</div>
                <div className="text-[11px] text-gray-500 font-mono">{rejectingRule.rule_code}</div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Rejection Reason / Assessor Feedback <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Specify why this tax rule is being returned or corrected..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRejecting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isRejecting ? 'Rejecting...' : 'Confirm Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
