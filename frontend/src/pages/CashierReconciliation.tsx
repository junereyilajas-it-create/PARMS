import React, { useState, useEffect } from 'react';
import { 
  FileCheck2, Printer, RotateCcw, CheckCircle2, X
} from 'lucide-react';
import api from '../lib/api';
import { useModal } from '../contexts/ModalContext';

interface Transaction {
  transaction_id: number;
  transaction_number: string;
  bill_id: number;
  bill_number: string;
  tax_year: number;
  declaration_number: string;
  target_id_str: string;
  owner_name: string;
  payment_date: string;
  payment_method: string;
  amount_paid: number;
  or_number: string;
  check_number?: string;
  check_bank?: string;
  status: 'completed' | 'reversed' | 'voided';
  cashier_first_name?: string;
  cashier_last_name?: string;
}

export function CashierReconciliation() {
  const { showSuccess, showError } = useModal();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [methodFilter, setMethodFilter] = useState('ALL');

  // Daily Reconciliation summary for date
  const [dailyReport, setDailyReport] = useState<any>(null);

  // Close Day / Balance Drawer Modal
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [physicalCash, setPhysicalCash] = useState<number>(0);
  const [reconciliationNotes, setReconciliationNotes] = useState('');
  const [submittingReconcile, setSubmittingReconcile] = useState(false);

  // Reversal Request Modal
  const [showReversalModal, setShowReversalModal] = useState(false);
  const [targetTransaction, setTargetTransaction] = useState<Transaction | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [submittingReversal, setSubmittingReversal] = useState(false);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (dateFilter) params.date = dateFilter;
      if (methodFilter !== 'ALL') params.method = methodFilter;

      const res = await api.get('/cashier/transactions', { params });
      setTransactions(res.data || []);
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyReport = async () => {
    try {
      const res = await api.get('/cashier/daily-report', { params: { date: dateFilter } });
      setDailyReport(res.data);
      setPhysicalCash(Number(res.data?.breakdown?.cash || 0));
    } catch {
      setDailyReport(null);
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchDailyReport();
  }, [dateFilter, methodFilter]);

  // Handle Daily Reconciliation submission
  const handleConfirmReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingReconcile(true);
      await api.post('/cashier/reconcile', {
        reconciliation_date: dateFilter,
        physical_cash_count: Number(physicalCash),
        notes: reconciliationNotes.trim()
      });
      showSuccess(`Daily close-day reconciliation for ${dateFilter} submitted successfully.`);
      setShowReconcileModal(false);
      fetchDailyReport();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Reconciliation submission failed');
    } finally {
      setSubmittingReconcile(false);
    }
  };

  // Open Reversal Modal
  const openReversalModal = (t: Transaction) => {
    setTargetTransaction(t);
    setReversalReason('');
    setShowReversalModal(true);
  };

  const handleConfirmReversal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTransaction || !reversalReason.trim()) {
      showError('Formal reason for reversal is required.');
      return;
    }

    try {
      setSubmittingReversal(true);
      await api.post('/cashier/reverse', {
        transaction_id: targetTransaction.transaction_id,
        reason: reversalReason.trim()
      });
      showSuccess(`Transaction #${targetTransaction.transaction_number} reversed. Bill balance restored.`);
      setShowReversalModal(false);
      fetchTransactions();
      fetchDailyReport();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Reversal failed');
    } finally {
      setSubmittingReversal(false);
    }
  };

  const formatCurrency = (val: number | string) => {
    const n = Number(val) || 0;
    return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <FileCheck2 size={22} />
            </span>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Cashier Reconciliation & Daily Audit
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Audit daily payment transactions, reconcile physical remittance with registered receipts, and generate official daily collection summaries.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg text-xs font-semibold transition"
          >
            <Printer size={15} />
            <span>Print Report</span>
          </button>
          <button
            onClick={() => setShowReconcileModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
          >
            <CheckCircle2 size={15} />
            <span>Close Day & Reconcile</span>
          </button>
        </div>
      </div>

      {/* Date & Filter Bar */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Reconciliation Date:</label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs outline-none"
          >
            <option value="ALL">All Payment Methods</option>
            <option value="cash">Cash Only</option>
            <option value="check">Check Only</option>
            <option value="bank_transfer">Bank Transfer</option>
          </select>
        </div>
      </div>

      {/* Daily Summary Cards */}
      {dailyReport && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="text-xs text-gray-500">Total Transactions</div>
            <div className="text-xl font-black font-mono mt-1 text-gray-900 dark:text-white">
              {dailyReport.summary?.total_transactions || 0}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="text-xs text-gray-500">Gross Collections</div>
            <div className="text-xl font-black font-mono mt-1 text-emerald-600 dark:text-emerald-400">
              {formatCurrency(dailyReport.summary?.gross_collection || 0)}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="text-xs text-gray-500">Reversals / Deductions</div>
            <div className="text-xl font-black font-mono mt-1 text-rose-600 dark:text-rose-400">
              {formatCurrency(dailyReport.summary?.total_reversed || 0)}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="text-xs text-gray-500 font-semibold">Net Municipal Remittance</div>
            <div className="text-xl font-black font-mono mt-1 text-green-700 dark:text-green-300">
              {formatCurrency(dailyReport.summary?.net_collection || 0)}
            </div>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 dark:text-white text-sm">
            Transactions Recorded on {dateFilter}
          </h3>
          <span className="text-xs text-gray-500">{transactions.length} record(s)</span>
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-500 text-sm">Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div className="py-16 text-center text-gray-500 text-sm">No transactions found for this date.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  <th className="py-3 px-3">OR Number</th>
                  <th className="py-3 px-3">Transaction No.</th>
                  <th className="py-3 px-3">Bill / TD No.</th>
                  <th className="py-3 px-3">Taxpayer</th>
                  <th className="py-3 px-3">Method</th>
                  <th className="py-3 px-3 text-right">Amount Paid</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {transactions.map((t) => (
                  <tr key={t.transaction_id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-800 dark:text-emerald-300">
                      {t.or_number}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-gray-600 dark:text-gray-300">{t.transaction_number}</td>
                    <td className="py-2.5 px-3 font-mono text-gray-700 dark:text-gray-300">
                      <div>{t.bill_number}</div>
                      <div className="text-[10px] text-gray-500">{t.declaration_number}</div>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-white">{t.owner_name}</td>
                    <td className="py-2.5 px-3 uppercase text-gray-600 dark:text-gray-300">
                      {t.payment_method} {t.check_number ? `(${t.check_bank} #${t.check_number})` : ''}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                      {formatCurrency(t.amount_paid)}
                    </td>
                    <td className="py-2.5 px-3">
                      {t.status === 'completed' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          Completed
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                          Reversed
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {t.status === 'completed' && (
                        <button
                          onClick={() => openReversalModal(t)}
                          className="px-2 py-1 text-[11px] text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950 rounded font-medium transition"
                        >
                          Request Reversal
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: Close Day & Reconcile */}
      {showReconcileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="text-emerald-600" size={18} />
                <span>Daily Close-Day Reconciliation</span>
              </h3>
              <button onClick={() => setShowReconcileModal(false)} className="text-gray-400">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleConfirmReconciliation} className="p-5 space-y-4 text-xs">
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg space-y-1">
                <div>Date: <strong>{dateFilter}</strong></div>
                <div>Registered Cash Collections: <strong>{formatCurrency(dailyReport?.breakdown?.cash || 0)}</strong></div>
                <div>Registered Check Collections: <strong>{formatCurrency(dailyReport?.breakdown?.check || 0)}</strong></div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  Actual Physical Cash Remitted (₱) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={physicalCash}
                  onChange={(e) => setPhysicalCash(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border text-sm font-mono font-bold bg-white dark:bg-gray-800"
                />
                <div className="text-[11px] text-gray-500 mt-1">
                  Variance: {formatCurrency(Number(physicalCash) - Number(dailyReport?.breakdown?.cash || 0))}
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  Reconciliation Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. All checks bundled with deposit slips; Drawer balanced."
                  value={reconciliationNotes}
                  onChange={(e) => setReconciliationNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReconcileModal(false)}
                  className="px-3 py-1.5 text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReconcile}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition"
                >
                  {submittingReconcile ? 'Saving...' : 'Submit Daily Reconciliation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Transaction Reversal */}
      {showReversalModal && targetTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <RotateCcw className="text-rose-600" size={18} />
                <span>Reverse Payment Transaction</span>
              </h3>
              <button onClick={() => setShowReversalModal(false)} className="text-gray-400">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleConfirmReversal} className="p-5 space-y-4 text-xs">
              <p className="text-gray-600 dark:text-gray-400">
                Reversing transaction <strong className="font-mono">{targetTransaction.transaction_number}</strong> (OR #{targetTransaction.or_number}) for <strong>{formatCurrency(targetTransaction.amount_paid)}</strong>. The bill balance will be automatically restored.
              </p>

              <div>
                <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  Authorized Reason for Reversal *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Encoded wrong OR number; Check bounced/cancelled by issuing bank."
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 text-xs outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReversalModal(false)}
                  className="px-3 py-1.5 text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReversal}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition"
                >
                  {submittingReversal ? 'Reversing...' : 'Confirm Reversal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
