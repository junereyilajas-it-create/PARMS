import React, { useEffect, useState, useMemo } from 'react';
import { Camera, Edit3, FileCheck, ShieldCheck } from 'lucide-react';
import { DataTable } from '../components/common/DataTable';
import { useModal } from '../contexts/ModalContext';
import api, { ensureSession } from '../lib/api';
import { AssessmentSubmissionModal, type AssessmentTarget } from '../components/common/AssessmentSubmissionModal';
import { AssessmentReviewModal, type AssessmentReviewRecord } from '../components/common/AssessmentReviewModal';
import { useSearchParams } from 'react-router-dom';

type Assessment = {
  type: 'lot' | 'building' | 'property';
  assessment_id: number;
  target_id: string;
  property_id: string;
  assessor_user_id: number;
  first_name?: string;
  last_name?: string;
  market_value: number;
  assessed_value: number;
  assessment_date: string;
  remarks: string;
  assessment_status: string;
  rejection_reason?: string;
  property_photo?: string | null;
  owner?: string;
};

export const PropertyAssessments: React.FC = () => {
  const { showError } = useModal();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [pendingAssessments, setPendingAssessments] = useState<Assessment[]>([]);
  const [query, setQuery] = useState('');
  const [userRole, setUserRole] = useState('');
  const [searchParams] = useSearchParams();
  const filterStatus = searchParams.get('status');

  // Modals
  const [submissionTarget, setSubmissionTarget] = useState<AssessmentTarget | null>(null);
  const [reviewRecord, setReviewRecord] = useState<AssessmentReviewRecord | null>(null);

  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      await ensureSession();
      const profileRes = await api.get('/profile');
      setUserRole(profileRes.data.role);

      if (['admin', 'super_admin'].includes(profileRes.data.role)) {
        try {
          const pendingRes = await api.get('/assessments/pending');
          setPendingAssessments(pendingRes.data.properties || []);
        } catch (pendingErr: any) {
          console.warn('Failed to load pending reviews:', pendingErr);
          setPendingAssessments([]);
        }
      }
      
      const { data } = await api.get('/assessments');
      setAssessments(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load assessments:', err);
      showError(err.response?.data?.message || 'Unable to load assessments. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const displayedAssessments = useMemo(() => assessments.filter(a => {
    if (filterStatus && a.assessment_status !== filterStatus) return false;
    if (query && !String(a.target_id).toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  }), [assessments, query, filterStatus]);
  
  const displayedPending = useMemo(() => pendingAssessments.filter(a => !query || String(a.target_id).toLowerCase().includes(query.toLowerCase())), [pendingAssessments, query]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': 
        return <span className="px-2.5 py-1 bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 rounded-full text-xs font-semibold uppercase">Approved</span>;
      case 'submitted': 
        return <span className="px-2.5 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 rounded-full text-xs font-semibold uppercase">Pending Review</span>;
      case 'returned': 
      case 'returned_for_correction':
        return <span className="px-2.5 py-1 bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 rounded-full text-xs font-semibold uppercase">Returned for Correction</span>;
      case 'rejected': 
        return <span className="px-2.5 py-1 bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 rounded-full text-xs font-semibold uppercase">Rejected</span>;
      case 'assigned': 
        return <span className="px-2.5 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 rounded-full text-xs font-semibold uppercase">Assigned</span>;
      default: 
        return <span className="px-2.5 py-1 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 rounded-full text-xs font-semibold uppercase">{status || 'Draft'}</span>;
    }
  };

  const columns = [
    { 
      key: 'target_id', 
      label: 'TARGET ID', 
      render: (_: any, row: Assessment) => (
        <div className="flex flex-col">
          <span className="font-semibold text-gray-900 dark:text-white">{row.target_id}</span>
          <span className="text-xs text-gray-500 uppercase">{row.type}</span>
        </div>
      )
    },
    { 
      key: 'assessor', 
      label: 'ASSESSOR', 
      render: (_: any, row: any) => `${row.first_name || ''} ${row.last_name || ''}`.trim() || `ID: ${row.assessor_user_id}` 
    },
    { 
      key: 'market_value', 
      label: 'MARKET VALUE', 
      render: (val: number) => Number(val) > 0 ? `₱${Number(val).toLocaleString()}` : '-' 
    },
    { 
      key: 'assessed_value', 
      label: 'ASSESSED VALUE', 
      render: (val: number) => Number(val) > 0 ? `₱${Number(val).toLocaleString()}` : '-' 
    },
    {
      key: 'property_photo',
      label: 'PHOTO',
      render: (_: any, row: Assessment) => row.property_photo ? (
        <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400 font-semibold bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded">
          <Camera size={13} /> Attached
        </span>
      ) : (
        <span className="text-xs text-gray-400">None</span>
      )
    },
    { 
      key: 'assessment_status', 
      label: 'STATUS', 
      render: (val: string) => getStatusBadge(val) 
    },
    { 
      key: 'assessment_date', 
      label: 'DATE', 
      render: (val: string) => val ? new Date(val).toLocaleDateString() : '-' 
    }
  ];

  const adminPendingColumns = [
    { 
      key: 'target_id', 
      label: 'TARGET ID', 
      render: (_: any, row: Assessment) => (
        <div className="flex flex-col">
          <span className="font-bold text-gray-900 dark:text-white">{row.target_id}</span>
          <span className="text-xs text-gray-500 uppercase">{row.type}</span>
        </div>
      ) 
    },
    { 
      key: 'assessor', 
      label: 'SUBMITTED BY', 
      render: (_: any, row: any) => `${row.first_name || ''} ${row.last_name || ''}`.trim() || `ID: ${row.assessor_user_id}` 
    },
    { 
      key: 'market_value', 
      label: 'MARKET VALUE', 
      render: (val: number) => `₱${Number(val).toLocaleString()}` 
    },
    { 
      key: 'assessed_value', 
      label: 'ASSESSED VALUE', 
      render: (val: number) => `₱${Number(val).toLocaleString()}` 
    },
    {
      key: 'photo',
      label: 'PHOTO',
      render: (_: any, row: Assessment) => row.property_photo ? (
        <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400 font-semibold bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded">
          <Camera size={13} /> Attached
        </span>
      ) : (
        <span className="text-xs text-gray-400">None</span>
      )
    },
    { 
      key: 'assessment_date', 
      label: 'DATE SUBMITTED', 
      render: (val: string) => new Date(val).toLocaleDateString() 
    },
    {
      key: 'actions', 
      label: 'REVIEW ACTION', 
      render: (_: any, row: Assessment) => (
        <button 
          onClick={() => setReviewRecord({
            type: row.type,
            assessment_id: row.assessment_id,
            target_id: row.target_id,
            property_id: row.property_id,
            assessor_user_id: row.assessor_user_id,
            first_name: row.first_name,
            last_name: row.last_name,
            market_value: row.market_value,
            assessed_value: row.assessed_value,
            assessment_date: row.assessment_date,
            remarks: row.remarks,
            assessment_status: row.assessment_status,
            rejection_reason: row.rejection_reason,
            property_photo: row.property_photo,
            owner: row.owner
          })} 
          id={`review-assessment-btn-${row.target_id}`}
          data-testid={`review-assessment-btn-${row.target_id}`}
          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
        >
          <ShieldCheck size={14} /> Review Assessment
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Assessment Management
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {userRole === 'assessor' 
              ? 'View your submitted assessments and check review status.' 
              : 'Review and officially approve property assessments submitted by assessors.'}
          </p>
        </div>
      </div>

      <div className="glass-panel p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
        <input 
          id="search-assessments-input"
          data-testid="search-assessments-input"
          type="text" 
          placeholder="Search by Target ID (e.g. 15, BLDG-15, LP-P1-A1)..." 
          value={query} 
          onChange={e => setQuery(e.target.value)} 
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-900 dark:border-gray-700 text-gray-900 dark:text-white" 
        />
      </div>

      {['admin', 'super_admin'].includes(userRole) && (
        <div className="glass-panel p-6 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-green-700 dark:text-green-400 flex items-center gap-2">
              <ShieldCheck size={20} /> Requires Head Assessor Review
            </h2>
            <span className="px-2.5 py-0.5 text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">
              {displayedPending.length} Pending
            </span>
          </div>
          {displayedPending.length > 0 ? (
            <DataTable columns={adminPendingColumns} data={displayedPending} />
          ) : (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
              No assessments are currently awaiting review.
            </div>
          )}
        </div>
      )}

      <div className="glass-panel p-6 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
        <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">
          {userRole === 'assessor' ? 'My Submitted Assessments' : 'All Assessments Database'}
        </h2>
        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">Loading assessments...</div>
        ) : (
          <DataTable
            columns={columns}
            data={displayedAssessments}
          onView={(record) => {
            setReviewRecord({
              type: record.type,
              assessment_id: record.assessment_id,
              target_id: record.target_id,
              property_id: record.property_id,
              assessor_user_id: record.assessor_user_id,
              first_name: record.first_name,
              last_name: record.last_name,
              market_value: record.market_value,
              assessed_value: record.assessed_value,
              assessment_date: record.assessment_date,
              remarks: record.remarks,
              assessment_status: record.assessment_status,
              rejection_reason: record.rejection_reason,
              property_photo: record.property_photo,
              owner: record.owner
            });
          }}
          showActions={true}
          customActions={(record) => {
            if (userRole === 'assessor') {
              if (record.assessment_status === 'returned' || record.assessment_status === 'returned_for_correction') {
                return (
                  <button 
                    id={`update-assessment-btn-${record.target_id}`}
                    data-testid={`update-assessment-btn-${record.target_id}`}
                    onClick={() => setSubmissionTarget({
                      type: record.type,
                      target_id: record.target_id,
                      property_id: record.property_id,
                      owner_name: `${record.first_name || ''} ${record.last_name || ''}`.trim(),
                      market_value: record.market_value,
                      assessed_value: record.assessed_value,
                      remarks: record.remarks || '',
                      property_photo: record.property_photo,
                      rejection_reason: record.rejection_reason,
                      assessment_id: record.assessment_id,
                      assessment_status: 'returned'
                    })} 
                    className="flex items-center gap-1 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold shadow-sm transition"
                    title="Correct and resubmit this assessment"
                  >
                    <Edit3 size={13} /> Update Assessment
                  </button>
                );
              }
              if (record.assessment_status === 'assigned') {
                return (
                  <button 
                    id={`assess-property-btn-${record.target_id}`}
                    data-testid={`assess-property-btn-${record.target_id}`}
                    onClick={() => setSubmissionTarget({
                      type: record.type,
                      target_id: record.target_id,
                      property_id: record.property_id,
                      market_value: '',
                      assessed_value: '',
                      remarks: record.remarks || '',
                      assessment_status: 'assigned'
                    })} 
                    className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-semibold shadow-sm transition"
                    title="Conduct Assessment"
                  >
                    <FileCheck size={13} /> Assess
                  </button>
                );
              }
            }
            return null;
          }}
        />
        )}
      </div>

      {/* Assessor Submission / Update Modal */}
      <AssessmentSubmissionModal
        isOpen={Boolean(submissionTarget)}
        onClose={() => setSubmissionTarget(null)}
        target={submissionTarget}
        onSuccess={load}
      />

      {/* Admin Review / View Modal */}
      <AssessmentReviewModal
        isOpen={Boolean(reviewRecord)}
        onClose={() => setReviewRecord(null)}
        record={reviewRecord}
        onSuccess={load}
      />
    </div>
  );
};
