import { useState, useEffect } from 'react';
import { 
  AlertCircle, CheckCircle2, Clock, 
  BookOpen, Scale, RefreshCw
} from 'lucide-react';
import api from '../lib/api';
import { useModal } from '../contexts/ModalContext';

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

interface TaxRule {
  config_id: number;
  category: string;
  rule_key: string;
  property_classification?: string;
  actual_use?: string;
  rule_value_decimal: number;
  rule_value_json?: string;
  effective_start_date: string;
  effective_end_date?: string;
  legal_reference: string;
  verification_status: string;
  verified_by_user_id?: number;
  approved_by_user_id?: number;
  is_active: boolean | number;
  is_demo: boolean | number;
}

export function TaxConfigurationReadiness() {
  const { showSuccess, showError, showConfirm } = useModal();
  const [readinessChecklist, setReadinessChecklist] = useState<ReadinessItem[]>([]);
  const [rules, setRules] = useState<TaxRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'checklist' | 'rules'>('checklist');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const userRole = localStorage.getItem('accessor_role') || 'staff';
  const isAdminOrSuper = userRole === 'admin' || userRole === 'super_admin';

  const fetchData = async () => {
    try {
      setLoading(true);
      const [readinessRes, rulesRes] = await Promise.all([
        api.get('/tax-configurations/readiness'),
        api.get('/tax-configurations')
      ]);
      setReadinessChecklist(readinessRes.data.checklist || []);
      setRules(rulesRes.data || []);
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to load configuration status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleVerifyRule = async (configId: number) => {
    showConfirm('Mark this municipal tax configuration as verified against the official Municipal Ordinance / BLGF Schedule?', async () => {
      try {
        await api.post(`/tax-configurations/${configId}/verify`);
        showSuccess('Rule marked as verified.');
        fetchData();
      } catch (err: any) {
        showError(err.response?.data?.message || 'Verification failed');
      }
    });
  };

  const handleApproveRule = async (configId: number) => {
    showConfirm('Officially approve this rule for municipal RPT calculations in Lagonglong?', async () => {
      try {
        await api.post(`/tax-configurations/${configId}/approve`);
        showSuccess('Rule officially approved and active.');
        fetchData();
      } catch (err: any) {
        showError(err.response?.data?.message || 'Approval failed');
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
      case 'active':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <CheckCircle2 size={13} />
            <span>Approved & Active</span>
          </span>
        );
      case 'pending verification':
      case 'pending_verification':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            <Clock size={13} />
            <span>Pending Verification</span>
          </span>
        );
      case 'not configured':
      case 'not_configured':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
            <AlertCircle size={13} />
            <span>Not Configured</span>
          </span>
        );
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  const filteredRules = rules.filter(r => selectedCategory === 'ALL' || r.category === selectedCategory);
  const readyCount = readinessChecklist.filter(item => item.is_ready).length;
  const readinessPercentage = readinessChecklist.length > 0 
    ? Math.round((readyCount / readinessChecklist.length) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 rounded-lg">
                <Scale size={22} />
              </span>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Municipal Tax Configuration & Statutory Readiness
              </h1>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Statutory verification checklist for the Municipal Assessor & Treasurer of Lagonglong, Misamis Oriental under RA 7160 and RA 12001 (RPVARA).
            </p>
          </div>

          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3.5 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-medium transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh Status</span>
          </button>
        </div>

        {/* Readiness Meter */}
        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Municipal Compliance & Statutory Readiness
            </div>
            <div className="text-base font-bold text-gray-900 dark:text-white">
              {readyCount} of {readinessChecklist.length} Required Statutory Elements Verified
            </div>
            <div className="text-xs text-gray-500">
              {readinessPercentage === 100 
                ? 'All mandatory municipal statutory ordinances and schedules have been formally verified.'
                : 'Pending items must be verified against official municipal ordinances before issuing official legal bills.'}
            </div>
          </div>

          <div className="w-full md:w-64 space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-gray-600 dark:text-gray-300">Readiness Score</span>
              <span className="text-green-600 dark:text-green-400">{readinessPercentage}%</span>
            </div>
            <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${readinessPercentage === 100 ? 'bg-emerald-600' : 'bg-green-600'}`}
                style={{ width: `${readinessPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 text-sm font-medium">
          <button
            onClick={() => setActiveTab('checklist')}
            className={`py-2 px-4 border-b-2 transition ${
              activeTab === 'checklist'
                ? 'border-green-600 text-green-600 dark:text-green-400 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            10-Point Municipal Readiness Checklist
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`py-2 px-4 border-b-2 transition ${
              activeTab === 'rules'
                ? 'border-green-600 text-green-600 dark:text-green-400 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Configured Statutory Rules ({rules.length})
          </button>
        </div>
      </div>

      {/* TAB 1: 10-Point Readiness Checklist */}
      {activeTab === 'checklist' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {readinessChecklist.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 text-xs font-bold flex items-center justify-center shrink-0">
                      {item.id}
                    </span>
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                      {item.title}
                    </h3>
                  </div>
                  <div>{getStatusBadge(item.status)}</div>
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {item.description}
                </p>
              </div>

              <div className="pt-3 border-t border-gray-100 dark:border-gray-800 text-[11px] flex items-center justify-between text-gray-500">
                <div className="flex items-center gap-1">
                  <BookOpen size={13} />
                  <span className="truncate max-w-[220px]" title={item.legal_reference}>
                    {item.legal_reference}
                  </span>
                </div>
                <span>{item.configured_count} rule(s) configured</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: Configured Statutory Rules */}
      {activeTab === 'rules' && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Active Rule Database</h3>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs outline-none"
            >
              <option value="ALL">All Categories</option>
              <option value="tax_rate">Tax Rates</option>
              <option value="sef_levy">SEF Levies</option>
              <option value="assessment_level">Assessment Levels</option>
              <option value="smv">Schedule of Market Values</option>
              <option value="discount">Discounts</option>
              <option value="penalty_interest">Penalties & Interest</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Rule Identifier</th>
                  <th className="py-2.5 px-3">Classification</th>
                  <th className="py-2.5 px-3 text-right">Value / Rate</th>
                  <th className="py-2.5 px-3">Legal Reference</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredRules.map((r) => (
                  <tr key={r.config_id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
                    <td className="py-2.5 px-3 font-mono capitalize">{r.category.replace('_', ' ')}</td>
                    <td className="py-2.5 px-3 font-semibold text-gray-900 dark:text-white">{r.rule_key}</td>
                    <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300">{r.property_classification || 'All'}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-green-700 dark:text-green-400">
                      {Number(r.rule_value_decimal) < 1 
                        ? `${(Number(r.rule_value_decimal) * 100).toFixed(2)}%` 
                        : Number(r.rule_value_decimal).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 max-w-xs truncate" title={r.legal_reference}>
                      {r.legal_reference}
                    </td>
                    <td className="py-2.5 px-3">
                      {getStatusBadge(r.verification_status)}
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-1">
                      {isAdminOrSuper && r.verification_status === 'draft' && (
                        <button
                          onClick={() => handleVerifyRule(r.config_id)}
                          className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 rounded font-medium text-[11px]"
                        >
                          Verify
                        </button>
                      )}
                      {isAdminOrSuper && r.verification_status === 'pending_verification' && (
                        <button
                          onClick={() => handleApproveRule(r.config_id)}
                          className="px-2 py-0.5 bg-green-50 hover:bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 rounded font-medium text-[11px]"
                        >
                          Approve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
