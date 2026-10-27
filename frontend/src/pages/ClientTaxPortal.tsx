import { useState, useEffect } from 'react';
import { 
  Receipt, Printer, AlertCircle, X
} from 'lucide-react';
import api from '../lib/api';
import { useModal } from '../contexts/ModalContext';

interface ClientTaxSummary {
  total_declarations: number;
  total_bills: number;
  total_outstanding: number;
  pending_bills_count: number;
  total_paid_this_year: number;
}

export function ClientTaxPortal() {
  const { showError } = useModal();
  const [activeTab, setActiveTab] = useState<'declarations' | 'bills' | 'receipts'>('declarations');
  const [summary, setSummary] = useState<ClientTaxSummary | null>(null);
  const [declarations, setDeclarations] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal for view/print
  const [viewingItem, setViewingItem] = useState<{ type: 'td' | 'bill' | 'receipt'; data: any } | null>(null);

  const fetchClientData = async () => {
    try {
      setLoading(true);
      const [sumRes, tdRes, billRes, recRes] = await Promise.all([
        api.get('/client/tax-summary'),
        api.get('/client/tax-declarations'),
        api.get('/client/tax-bills'),
        api.get('/client/receipts')
      ]);
      setSummary(sumRes.data);
      setDeclarations(tdRes.data || []);
      setBills(billRes.data || []);
      setReceipts(recRes.data || []);
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to load your property tax records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientData();
  }, []);

  const formatCurrency = (val: number | string) => {
    const n = Number(val) || 0;
    return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-1">
        <div className="flex items-center gap-2">
          <span className="p-2 bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 rounded-lg">
            <Receipt size={22} />
          </span>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            My Property Taxes, Declarations & Receipts
          </h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          View your registered Tax Declarations, verified Real Property Tax bills, and official treasury payment receipts for the Municipality of Lagonglong.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="text-xs text-gray-500 uppercase font-semibold">Active Declarations</div>
          <div className="text-2xl font-black font-mono mt-1 text-gray-900 dark:text-white">
            {summary?.total_declarations || 0}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">Issued by Municipal Assessor</div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="text-xs text-gray-500 uppercase font-semibold">Tax Bills Issued</div>
          <div className="text-2xl font-black font-mono mt-1 text-blue-600 dark:text-blue-400">
            {summary?.total_bills || 0}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">{summary?.pending_bills_count || 0} bills pending payment</div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="text-xs text-gray-500 uppercase font-semibold">Outstanding Balance</div>
          <div className="text-2xl font-black font-mono mt-1 text-amber-600 dark:text-amber-400">
            {formatCurrency(summary?.total_outstanding || 0)}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">Total pending real property tax</div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="text-xs text-gray-500 uppercase font-semibold">Total Paid ({new Date().getFullYear()})</div>
          <div className="text-2xl font-black font-mono mt-1 text-emerald-600 dark:text-emerald-400">
            {formatCurrency(summary?.total_paid_this_year || 0)}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">Official payments this year</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200 dark:border-gray-800 text-sm font-medium">
          <button
            onClick={() => setActiveTab('declarations')}
            className={`py-3 px-5 border-b-2 transition ${
              activeTab === 'declarations'
                ? 'border-green-600 text-green-600 dark:text-green-400 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            My Tax Declarations ({declarations.length})
          </button>
          <button
            onClick={() => setActiveTab('bills')}
            className={`py-3 px-5 border-b-2 transition ${
              activeTab === 'bills'
                ? 'border-green-600 text-green-600 dark:text-green-400 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            My Tax Bills ({bills.length})
          </button>
          <button
            onClick={() => setActiveTab('receipts')}
            className={`py-3 px-5 border-b-2 transition ${
              activeTab === 'receipts'
                ? 'border-green-600 text-green-600 dark:text-green-400 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            My Official Receipts ({receipts.length})
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="py-16 text-center text-sm text-gray-500">Loading your tax records...</div>
          ) : activeTab === 'declarations' ? (
            declarations.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-sm">
                No issued tax declarations found linked to your property owner account yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 font-semibold text-gray-600 uppercase">
                      <th className="py-2.5 px-3">TD Number</th>
                      <th className="py-2.5 px-3">Property Identifier</th>
                      <th className="py-2.5 px-3">Location</th>
                      <th className="py-2.5 px-3 text-right">Market Value</th>
                      <th className="py-2.5 px-3 text-right">Assessed Value</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {declarations.map((td) => (
                      <tr key={td.tax_declaration_id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
                        <td className="py-2.5 px-3 font-mono font-bold text-gray-900 dark:text-white">
                          {td.declaration_number}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold">{td.target_id_str}</span> ({td.property_type})
                        </td>
                        <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300">
                          Brgy. {td.barangay}, Lagonglong
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(td.market_value)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-green-700 dark:text-green-400">
                          {formatCurrency(td.assessed_value)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            {td.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => setViewingItem({ type: 'td', data: td })}
                            className="px-2.5 py-1 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded font-medium transition"
                          >
                            View Declaration
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : activeTab === 'bills' ? (
            bills.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-sm">
                No real property tax bills generated for your properties yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 font-semibold text-gray-600 uppercase">
                      <th className="py-2.5 px-3">Bill Number</th>
                      <th className="py-2.5 px-3">Tax Year</th>
                      <th className="py-2.5 px-3">Tax Declaration</th>
                      <th className="py-2.5 px-3 text-right">Total Due</th>
                      <th className="py-2.5 px-3 text-right">Amount Paid</th>
                      <th className="py-2.5 px-3 text-right">Balance Due</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {bills.map((b) => (
                      <tr key={b.bill_id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
                        <td className="py-2.5 px-3 font-mono font-bold text-gray-900 dark:text-white">
                          {b.bill_number}
                        </td>
                        <td className="py-2.5 px-3 font-bold">{b.tax_year}</td>
                        <td className="py-2.5 px-3 font-mono text-gray-600 dark:text-gray-300">
                          {b.declaration_number}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(b.total_amount_due)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-bold">
                          {formatCurrency(b.amount_paid)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-amber-700 dark:text-amber-400">
                          {formatCurrency(b.remaining_balance)}
                        </td>
                        <td className="py-2.5 px-3 uppercase text-[10px] font-bold text-gray-600">
                          {b.bill_status.replace('_', ' ')}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => setViewingItem({ type: 'bill', data: b })}
                            className="px-2.5 py-1 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded font-medium transition"
                          >
                            View Statement
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            receipts.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-sm">
                No recorded official payments or receipts found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 font-semibold text-gray-600 uppercase">
                      <th className="py-2.5 px-3">Official Receipt (OR)</th>
                      <th className="py-2.5 px-3">Payment Date</th>
                      <th className="py-2.5 px-3">Bill / Year</th>
                      <th className="py-2.5 px-3">Method</th>
                      <th className="py-2.5 px-3 text-right">Amount Paid</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {receipts.map((r) => (
                      <tr key={r.transaction_id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-800 dark:text-emerald-300">
                          {r.or_number}
                        </td>
                        <td className="py-2.5 px-3">{r.payment_date}</td>
                        <td className="py-2.5 px-3 font-mono">{r.bill_number} ({r.tax_year})</td>
                        <td className="py-2.5 px-3 uppercase">{r.payment_method}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-700">
                          {formatCurrency(r.amount_paid)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => setViewingItem({ type: 'receipt', data: r })}
                            className="px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded font-semibold transition"
                          >
                            Print Receipt
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </div>

      {/* Notice Card for Payment Collection */}
      <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 p-4 rounded-xl flex items-start gap-3 text-xs text-blue-900 dark:text-blue-200">
        <AlertCircle size={18} className="shrink-0 text-blue-600 mt-0.5" />
        <div>
          <strong className="font-semibold">Official Payment Location:</strong>
          <p className="mt-0.5">
            Real Property Tax payments are officially received and verified at the Municipal Treasury / Cashier Office of Lagonglong, Misamis Oriental. Official receipts (Form 56) are issued upon verification of payment.
          </p>
        </div>
      </div>

      {/* MODAL: View Item */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 print:hidden">
              <span className="font-bold text-gray-900 dark:text-white capitalize">
                {viewingItem.type === 'td' ? 'Tax Declaration Document' : viewingItem.type === 'bill' ? 'Tax Billing Statement' : 'Official Receipt (Form 56)'}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg"
                >
                  <Printer size={14} />
                  <span>Print</span>
                </button>
                <button
                  onClick={() => setViewingItem(null)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-8 space-y-4 bg-white text-gray-900 text-xs overflow-y-auto">
              <div className="text-center space-y-0.5 border-b-2 border-gray-900 pb-3">
                <div className="text-[10px] uppercase text-gray-600">Republic of the Philippines</div>
                <div className="text-xs font-bold uppercase">Province of Misamis Oriental</div>
                <div className="text-sm font-black uppercase text-gray-900">Municipality of Lagonglong</div>
                <div className="text-base font-extrabold uppercase mt-2 pt-1 border-t border-gray-300">
                  {viewingItem.type === 'td' ? 'REAL PROPERTY TAX DECLARATION' : viewingItem.type === 'bill' ? 'TAX NOTICE & STATEMENT OF ACCOUNT' : 'OFFICIAL RECEIPT (FORM NO. 56)'}
                </div>
              </div>

              {viewingItem.type === 'td' && (
                <div className="space-y-3">
                  <div><strong>TD NO.:</strong> <span className="font-mono text-sm font-bold">{viewingItem.data.declaration_number}</span></div>
                  <div><strong>PIN:</strong> <span className="font-mono">{viewingItem.data.property_code}</span></div>
                  <div><strong>TARGET:</strong> {viewingItem.data.target_id_str} ({viewingItem.data.property_type})</div>
                  <div><strong>LOCATION:</strong> {viewingItem.data.property_address}</div>
                  <div className="border border-gray-900 p-3 space-y-1 mt-2">
                    <div>Market Value: <strong>{formatCurrency(viewingItem.data.market_value)}</strong></div>
                    <div>Assessment Level: <strong>{viewingItem.data.assessment_level}%</strong></div>
                    <div>Assessed Value: <strong className="text-green-800 font-mono text-sm">{formatCurrency(viewingItem.data.assessed_value)}</strong></div>
                  </div>
                </div>
              )}

              {viewingItem.type === 'bill' && (
                <div className="space-y-3">
                  <div><strong>BILL NO.:</strong> <span className="font-mono text-sm font-bold">{viewingItem.data.bill_number}</span></div>
                  <div><strong>TAX YEAR:</strong> {viewingItem.data.tax_year}</div>
                  <div><strong>TAX DECLARATION:</strong> <span className="font-mono">{viewingItem.data.declaration_number}</span></div>
                  <div className="border border-gray-900 p-3 space-y-1 mt-2">
                    <div>Total Amount Due: <strong>{formatCurrency(viewingItem.data.total_amount_due)}</strong></div>
                    <div>Amount Paid: <strong className="text-emerald-700">{formatCurrency(viewingItem.data.amount_paid)}</strong></div>
                    <div>Remaining Balance: <strong className="text-amber-800 text-sm font-mono">{formatCurrency(viewingItem.data.remaining_balance)}</strong></div>
                  </div>
                </div>
              )}

              {viewingItem.type === 'receipt' && (
                <div className="space-y-3">
                  <div><strong>OFFICIAL RECEIPT NO.:</strong> <span className="font-mono text-base font-extrabold text-emerald-900">{viewingItem.data.or_number}</span></div>
                  <div><strong>DATE OF PAYMENT:</strong> {viewingItem.data.payment_date}</div>
                  <div><strong>FOR BILL:</strong> {viewingItem.data.bill_number} (Year {viewingItem.data.tax_year})</div>
                  <div className="border border-gray-900 p-3 space-y-1 mt-2">
                    <div>Payment Method: <strong className="uppercase">{viewingItem.data.payment_method}</strong></div>
                    <div>Amount Received: <strong className="text-emerald-800 text-sm font-mono">{formatCurrency(viewingItem.data.amount_paid)}</strong></div>
                    <div>Collecting Officer: <strong>{viewingItem.data.cashier_first_name ? `${viewingItem.data.cashier_first_name} ${viewingItem.data.cashier_last_name}` : 'MUNICIPAL CASHIER'}</strong></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
