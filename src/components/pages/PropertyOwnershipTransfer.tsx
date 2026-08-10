import React, { useState } from 'react';
import { CheckCircle2, Upload, FileText } from 'lucide-react';

interface WorkflowStep {
  id: number;
  title: string;
  completed: boolean;
  current: boolean;
}

export const PropertyOwnershipTransfer: React.FC = () => {
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([
    'Certified_Deed_Transfer_882B.pdf',
    'Scan_Tax_Clearance_Cert.jpg',
  ]);

  const steps: WorkflowStep[] = [
    { id: 1, title: 'Entity Match', completed: true, current: false },
    { id: 2, title: 'Details & Data', completed: true, current: true },
    { id: 3, title: 'Documents', completed: false, current: false },
    { id: 4, title: 'Review', completed: false, current: false },
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file) => {
        setUploadedFiles((prev) => [...prev, file.name]);
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Property Ownership Transfer</h1>
        <p className="text-gray-600 mt-1">
          Official workflow for legal title deed updates and assessor record reconciliation.
        </p>
      </div>

      {/* Workflow Steps */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-8">
          {steps.map((step, idx) => (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold transition ${
                    step.completed
                      ? 'bg-green-600 text-white'
                      : step.current
                        ? 'bg-blue-600 text-white ring-4 ring-blue-200'
                        : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {step.completed ? <CheckCircle2 size={24} /> : step.id}
                </div>
                <p className="text-sm font-medium mt-2 text-gray-900">{step.title}</p>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`h-1 w-24 mx-4 ${step.completed ? 'bg-green-600' : 'bg-gray-300'}`}
                ></div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Ownership & Transfer Details */}
        <div className="col-span-2 space-y-6">
          {/* Current Ownership Information */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Current Ownership Information</h2>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Primary Owner</span>
                <span className="font-semibold text-gray-900">Evergreen Development Group LLC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tax ID</span>
                <span className="font-semibold text-gray-900">44-902-1136</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Property Parcel ID</span>
                <span className="font-semibold text-gray-900">LOT-882-B-201NE-G</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Property Address</span>
                <span className="font-semibold text-gray-900">1422 Pine Needle Way, North District</span>
              </div>
            </div>
          </div>

          {/* Transfer Details */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Transfer Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search New Owner Entity
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter Name, TIN, or Entity ID..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
                    Alt+E
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 size={18} />
                <span className="text-sm font-medium">Entity Verified</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Effective Date of Transfer
                </label>
                <input
                  type="date"
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transaction Type
                </label>
                <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option>Standard Sale / Purchase</option>
                  <option>Gift Transfer</option>
                  <option>Inheritance</option>
                  <option>Foreclosure</option>
                </select>
              </div>
            </div>
          </div>

          {/* Supporting Documentation */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Supporting Documentation</h2>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-4">
              <Upload size={32} className="mx-auto text-gray-400 mb-2" />
              <p className="text-gray-600 text-sm">Drag and drop legal files</p>
              <p className="text-gray-500 text-xs">
                Upload Deed of Sale, Notarized Agreements, and Tax Clearances (PDF, JPG, PNG)
              </p>
              <label className="inline-block mt-4">
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".pdf,.jpg,.png"
                />
                <button className="px-6 py-2 bg-green-800 text-white rounded-lg hover:bg-green-900 transition cursor-pointer">
                  Select Files From Local Disk
                </button>
              </label>
            </div>

            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                {uploadedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <FileText size={18} className="text-gray-600" />
                      <span className="text-sm text-gray-900">{file}</span>
                    </div>
                    <button className="text-red-600 hover:text-red-800">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Policy Check & Guidelines */}
        <div className="space-y-6">
          {/* AI Policy Check */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={24} className="text-green-600" />
              <h3 className="font-semibold text-green-900">AI Policy Check</h3>
            </div>
            <p className="text-sm text-green-800 mb-4">
              Our AI pre-verified the current tax status. No outstanding liens detected for Parcel
              LOT-882-B.
            </p>
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 size={18} />
              <span className="text-sm font-medium">Compliance Check Passed</span>
            </div>
          </div>

          {/* Workflow Guidelines */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-semibold text-gray-900 mb-4">Workflow Guidelines</h3>
            <ul className="space-y-3 text-sm text-gray-700">
              <li className="flex gap-2">
                <span className="text-gray-600 flex-shrink-0">•</span>
                <span>Ensure all legal names exactly match the submitted Deed of Sale.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-600 flex-shrink-0">•</span>
                <span>The Effective Date cannot be more than 180 days in the past without late fee penalty.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-600 flex-shrink-0">•</span>
                <span>Dual-signature authentication is required for corporate entities.</span>
              </li>
            </ul>
            <a href="#" className="text-green-600 text-sm font-medium mt-4 inline-block hover:text-green-700">
              Read Transfer Ordinances →
            </a>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-center">
        <button className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">
          Cancel
        </button>
        <button className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">
          Previous Step
        </button>
        <button className="px-6 py-3 bg-green-700 text-white rounded-lg hover:bg-green-800 transition flex items-center gap-2">
          Save and Continue
          <span>→</span>
        </button>
      </div>
    </div>
  );
};
