import React, { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, Receipt, Search, CheckCircle2, 
  Clock, Banknote, ShieldAlert, 
  Printer, X
} from 'lucide-react';
import api from '../lib/api';
import { useModal } from '../contexts/ModalContext';

interface QueueBill {
  bill_id: number;
  bill_number: string;
  tax_declaration_id: number;
  declaration_number: string;
  property_id: number;
  property_code: string;
  property_type: 'land' | 'building';
  target_id_str: string;
  owner_id: number;
  owner_name: string;
  owner_contact?: string;
  barangay: string;
  property_address: string;
  classification: string;
  tax_year: number;
  due_date: string;
  assessed_value: number;
  total_amount_due: number;
  amount_paid: number;
  remaining_balance: number;
  bill_status: string;
  is_demo: number | boolean;
}

interface CashierStats {
  today_stats: {
    transactions_today?: number;
    total_collected_today?: number;
    cash_collected_today?: number;
    check_collected_today?: number;
    other_collected_today?: number;
  };
  queue_stats: {
    bills_in_queue?: number;
    total_outstanding_balance?: number;
    partially_paid_count?: number;
    overdue_count?: number;
  };
  reconciliation?: any;
  server_date?: string;
}

export function CashierDashboard() {
  const { showSuccess, showError } = useModal();
  const [stats, setStats] = useState<CashierStats | null>(null);
  const [queueBills, setQueueBills] = useState<QueueBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [yearFilter, setYearFilter] = useState('ALL');
  const [barangayFilter, setBarangayFilter] = useState('ALL');

  // Record Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentBill, setPaymentBill] = useState<QueueBill | null>(null);
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'check' | 'bank_transfer' | 'online_remittance'>('cash');
  const [checkNumber, setCheckNumber] = useState('');
  const [checkBank, setCheckBank] = useState('');
  const [checkDate, setCheckDate] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [orNumber, setOrNumber] = useState('');
  const [remarks, setRemarks] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Official Receipt Print Modal
  const [completedPaymentReceipt, setCompletedPaymentReceipt] = useState<any | null>(null);

  // Fetch Dashboard Stats & Queue
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (yearFilter !== 'ALL') params.year = yearFilter;
      if (barangayFilter !== 'ALL') params.barangay = barangayFilter;
      if (searchQuery.trim()) params.q = searchQuery.trim();

      const [statsRes, queueRes] = await Promise.all([
        api.get('/cashier/stats'),
        api.get('/cashier/queue', { params })
      ]);
      setStats(statsRes.data);
      setQueueBills(queueRes.data || []);
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to fetch cashier data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [yearFilter, barangayFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDashboardData();
  };

  // Open Payment Modal
  const openPaymentModal = async (b: QueueBill) => {
    setPaymentBill(b);
    setAmountReceived(String(b.remaining_balance));
    setPaymentMethod('cash');
    setCheckNumber('');
    setCheckBank('');
    setCheckDate('');
    setTransactionRef('');
    setRemarks('');
    // Generate UUID idempotency key for this payment session
    setIdempotencyKey(`PAY-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

    try {
      // Auto-fetch next sequential municipal OR number
      const res = await api.get('/cashier/next-or');
      setOrNumber(res.data.next_or_number || '');
    } catch {
      setOrNumber('');
    }

    setShowPaymentModal(true);
  };

  // Submit Payment Record
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentBill) return;

    const numAmount = parseFloat(amountReceived);
    if (isNaN(numAmount) || numAmount <= 0) {
      showError('Please enter a valid payment amount greater than zero.');
      return;
    }

    if (numAmount > Number(paymentBill.remaining_balance)) {
      showError(`Amount received (₱${numAmount.toLocaleString()}) exceeds the authoritative outstanding balance (₱${Number(paymentBill.remaining_balance).toLocaleString()}). Overpayments are not allowed.`);
      return;
    }

    if (!orNumber.trim()) {
      showError('Official Receipt (OR) Number is required.');
      return;
    }

    if (paymentMethod === 'check' && (!checkNumber.trim() || !checkBank.trim())) {
      showError('Check number and issuing bank are required for check payments.');
      return;
    }

    try {
      setSubmittingPayment(true);
      const payload = {
        bill_id: paymentBill.bill_id,
        amount_paid: numAmount,
        payment_method: paymentMethod,
        or_number: orNumber.trim(),
        check_number: checkNumber.trim() || null,
        check_bank: checkBank.trim() || null,
        check_date: checkDate || null,
        transaction_reference: transactionRef.trim() || null,
        remarks: remarks.trim() || null,
        idempotency_key: idempotencyKey
      };

      const res = await api.post('/cashier/pay', payload);
      showSuccess(`Payment of ₱${numAmount.toLocaleString()} recorded successfully under OR #${orNumber}.`);
      setShowPaymentModal(false);

      // Load receipt for immediate printing
      if (res.data.transaction_id) {
        const transRes = await api.get(`/cashier/transactions/${res.data.transaction_id}`);
        setCompletedPaymentReceipt(transRes.data);
      }

      fetchDashboardData();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const formatCurrency = (val: number | string) => {
    const n = Number(val) || 0;
    return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const barangays = useMemo(() => {
    const set = new Set<string>();
    queueBills.forEach(b => { if (b.barangay) set.add(b.barangay); });
    return Array.from(set).sort();
  }, [queueBills]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-1">
        <div className="flex items-center gap-2">
          <span className="p-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <Banknote size={22} />
          </span>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Municipal Cashier & Real Property Tax Collections
          </h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Official Treasury Collection Queue for the Municipality of Lagonglong, Misamis Oriental. Record payments, issue Official Receipts (Form 56), and balance daily collections.
        </p>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Collections */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider">
            <span>Today's Collections</span>
            <span className="p-1.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded">
              <DollarSign size={16} />
            </span>
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white font-mono">
            {formatCurrency(stats?.today_stats?.total_collected_today || 0)}
          </div>
          <div className="text-xs text-gray-500 flex justify-between pt-1 border-t border-gray-100 dark:border-gray-800">
            <span>Cash: {formatCurrency(stats?.today_stats?.cash_collected_today || 0)}</span>
            <span>Check: {formatCurrency(stats?.today_stats?.check_collected_today || 0)}</span>
          </div>
        </div>

        {/* Bills Awaiting Collection */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider">
            <span>Bills in Queue</span>
            <span className="p-1.5 bg-blue-50 dark:bg-blue-950 text-blue-600 rounded">
              <Receipt size={16} />
            </span>
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
            {stats?.queue_stats?.bills_in_queue || 0}
          </div>
          <div className="text-xs text-gray-500 pt-1 border-t border-gray-100 dark:border-gray-800">
            Approved & authorized for collection
          </div>
        </div>

        {/* Total Outstanding Balance */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider">
            <span>Total Outstanding</span>
            <span className="p-1.5 bg-amber-50 dark:bg-amber-950 text-amber-600 rounded">
              <Clock size={16} />
            </span>
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
            {formatCurrency(stats?.queue_stats?.total_outstanding_balance || 0)}
          </div>
          <div className="text-xs text-gray-500 pt-1 border-t border-gray-100 dark:border-gray-800">
            {stats?.queue_stats?.partially_paid_count || 0} partially paid bills
          </div>
        </div>

        {/* Overdue Receivables */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider">
            <span>Overdue Bills</span>
            <span className="p-1.5 bg-rose-50 dark:bg-rose-950 text-rose-600 rounded">
              <ShieldAlert size={16} />
            </span>
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
            {stats?.queue_stats?.overdue_count || 0}
          </div>
          <div className="text-xs text-gray-500 pt-1 border-t border-gray-100 dark:border-gray-800">
            Past statutory due date
          </div>
        </div>
      </div>

      {/* Collection Queue Search & Table */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by Bill No., Tax Declaration, Owner Name, PIN, or Lot/Bldg..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-green-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm outline-none"
            >
              <option value="ALL">All Tax Years</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
            </select>

            <select
              value={barangayFilter}
              onChange={(e) => setBarangayFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm outline-none"
            >
              <option value="ALL">All Barangays</option>
              {barangays.map(b => <option key={b} value={b}>{b}</option>)}
            </select>

            <button
              type="submit"
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition"
            >
              Filter Queue
            </button>
          </div>
        </form>
      </div>

      {/* Queue Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="text-green-600" size={18} />
            <h3 className="font-bold text-gray-900 dark:text-white text-sm">Payable Bills Collection Queue</h3>
          </div>
          <span className="text-xs text-gray-500">{queueBills.length} approved bills ready for payment</span>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-3 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading collection queue...</p>
          </div>
        ) : queueBills.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Collection Queue is Clear</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto mt-1">
              There are currently no approved bills awaiting payment matching your filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Bill No. / Year</th>
                  <th className="py-3 px-4">Tax Declaration</th>
                  <th className="py-3 px-4">Owner Name</th>
                  <th className="py-3 px-4">Barangay</th>
                  <th className="py-3 px-4 text-right">Total Due</th>
                  <th className="py-3 px-4 text-right">Amount Paid</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {queueBills.map((b) => (
                  <tr key={b.bill_id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
                    <td className="py-3 px-4 font-mono font-medium text-gray-900 dark:text-white">
                      <div>{b.bill_number}</div>
                      <div className="text-[11px] font-sans text-gray-500">Year {b.tax_year}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-gray-700 dark:text-gray-300">
                      <div>{b.declaration_number}</div>
                      <div className="text-[11px] font-sans text-gray-500">{b.target_id_str}</div>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-100">
                      {b.owner_name}
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300">
                      {b.barangay}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-gray-700 dark:text-gray-300">
                      {formatCurrency(b.total_amount_due)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(b.amount_paid)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-700 dark:text-amber-400">
                      {formatCurrency(b.remaining_balance)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => openPaymentModal(b)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
                      >
                        Record Payment
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: Record Payment */}
      {showPaymentModal && paymentBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-850">
              <div className="flex items-center gap-2">
                <Banknote className="text-emerald-600" size={22} />
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">Record Cashier Payment</h3>
                  <span className="text-xs text-gray-500">Bill #{paymentBill.bill_number} • Year {paymentBill.tax_year}</span>
                </div>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-6 space-y-5">
              {/* Bill Summary Banner */}
              <div className="bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-600 dark:text-gray-300">Declared Owner:</div>
                  <div className="font-bold text-gray-900 dark:text-white text-sm">{paymentBill.owner_name}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{paymentBill.declaration_number} • {paymentBill.barangay}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-600 dark:text-gray-300">Authoritative Balance:</div>
                  <div className="text-xl font-black font-mono text-emerald-800 dark:text-emerald-300">
                    {formatCurrency(paymentBill.remaining_balance)}
                  </div>
                </div>
              </div>

              {/* Payment Details Input */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Official Receipt (OR) Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. OR-2026-0001"
                    value={orNumber}
                    onChange={(e) => setOrNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <span className="text-[10px] text-gray-500">Must be unique per official municipal receipt series.</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Amount Received (₱) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={Number(paymentBill.remaining_balance)}
                    required
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-base font-mono font-black text-emerald-700 dark:text-emerald-400 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Payment Method Selection */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'cash', label: 'Cash' },
                    { id: 'check', label: 'Check' },
                    { id: 'bank_transfer', label: 'Bank Transfer' },
                    { id: 'online_remittance', label: 'Online Remittance' },
                  ].map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id as any)}
                      className={`p-2.5 rounded-lg border text-xs font-medium transition text-center ${
                        paymentMethod === m.id
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold'
                          : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Check details fields */}
              {paymentMethod === 'check' && (
                <div className="p-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">Check Number *</label>
                    <input
                      type="text"
                      required
                      value={checkNumber}
                      onChange={(e) => setCheckNumber(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-md border text-xs bg-white dark:bg-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">Drawee Bank *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. LandBank"
                      value={checkBank}
                      onChange={(e) => setCheckBank(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-md border text-xs bg-white dark:bg-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">Check Date</label>
                    <input
                      type="date"
                      value={checkDate}
                      onChange={(e) => setCheckDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-md border text-xs bg-white dark:bg-gray-800"
                    />
                  </div>
                </div>
              )}

              {/* Remarks */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Cashier Remarks (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid in full by authorized representative"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="px-5 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition shadow-sm"
                >
                  {submittingPayment ? 'Processing...' : 'Confirm & Issue Official Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Official Receipt Form 56 Preview & Print */}
      {completedPaymentReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 print:hidden">
              <span className="font-bold text-gray-900 dark:text-white">Official Receipt Issued (Form 56)</span>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg"
                >
                  <Printer size={14} />
                  <span>Print Receipt</span>
                </button>
                <button
                  onClick={() => setCompletedPaymentReceipt(null)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Printable Form 56 Receipt */}
            <div className="p-8 space-y-5 bg-white text-gray-900 text-xs print:p-0">
              <div className="text-center space-y-0.5 border-b-2 border-gray-900 pb-3">
                <div className="text-[10px] uppercase text-gray-600">Republic of the Philippines</div>
                <div className="text-xs font-bold uppercase">Province of Misamis Oriental</div>
                <div className="text-sm font-black uppercase text-gray-900">Municipality of Lagonglong</div>
                <div className="text-xs font-semibold uppercase text-emerald-900">Office of the Municipal Treasurer</div>
                <div className="text-base font-extrabold uppercase mt-2 pt-1 border-t border-gray-400">
                  OFFICIAL RECEIPT OF THE REPUBLIC OF THE PHILIPPINES
                </div>
                <div className="text-[10px] text-gray-600">(Real Property Tax - Accountable Form No. 56)</div>
              </div>

              <div className="flex justify-between items-center text-xs">
                <div>
                  <strong>DATE:</strong> <span>{completedPaymentReceipt.payment_date}</span>
                </div>
                <div>
                  <strong>OFFICIAL RECEIPT NO.:</strong> <span className="font-mono text-base font-extrabold text-emerald-900">{completedPaymentReceipt.or_number}</span>
                </div>
              </div>

              <div className="border border-gray-900 p-3 space-y-2">
                <div><strong>RECEIVED FROM:</strong> <span className="font-bold text-sm uppercase">{completedPaymentReceipt.owner_name}</span></div>
                <div><strong>PAYMENT FOR:</strong> Real Property Tax (Tax Year {completedPaymentReceipt.tax_year})</div>
                <div><strong>TAX DECLARATION NO.:</strong> <span className="font-mono">{completedPaymentReceipt.declaration_number}</span></div>
                <div><strong>BILL REFERENCE:</strong> <span className="font-mono">{completedPaymentReceipt.bill_number}</span></div>
              </div>

              <table className="w-full border border-gray-900 text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-900">
                    <th className="p-2 border-r border-gray-900">Particulars</th>
                    <th className="p-2 text-right">Amount (PHP)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-300">
                    <td className="p-2 border-r border-gray-900">
                      Amount Paid (Payment Method: {completedPaymentReceipt.payment_method?.toUpperCase()})
                    </td>
                    <td className="p-2 text-right font-mono font-bold">
                      {formatCurrency(completedPaymentReceipt.amount_paid)}
                    </td>
                  </tr>
                  <tr className="bg-gray-50 font-black">
                    <td className="p-2 border-r border-gray-900 uppercase">Total Amount Received:</td>
                    <td className="p-2 text-right font-mono text-sm text-emerald-900">
                      {formatCurrency(completedPaymentReceipt.amount_paid)}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="grid grid-cols-2 gap-8 pt-6">
                <div></div>
                <div className="text-center space-y-6">
                  <div>Collected & Received By:</div>
                  <div className="border-b border-gray-900 pb-1 font-bold">
                    {completedPaymentReceipt.cashier_first_name 
                      ? `${completedPaymentReceipt.cashier_first_name} ${completedPaymentReceipt.cashier_last_name}`
                      : 'MUNICIPAL CASHIER'}
                  </div>
                  <div className="text-[10px] text-gray-600 -mt-5">Authorized Cashier / Collecting Officer</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
