import { X, Printer } from 'lucide-react';
import type { Property } from '../../types/property';

interface CertificationPrintModalProps {
  property: Property;
  close: () => void;
}

export function CertificationPrintModal({ property, close }: CertificationPrintModalProps) {
  const handlePrint = () => {
    window.print();
  };

  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:inset-auto">
      {/* Modal Container */}
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col print:shadow-none print:max-w-none print:w-full print:h-auto print:max-h-none print:block">

        {/* Modal Header (Hidden on Print) */}
        <div className="p-4 border-b border-gray-100 flex justify-between items-center print:hidden">
          <h2 className="text-xl font-bold text-gray-900">Print Certification</h2>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition flex items-center gap-2"
            >
              <Printer size={18} />
              Print Document
            </button>
            <button
              onClick={close}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-8 print:p-0 print:overflow-visible bg-gray-50 print:bg-white">

          {/* A4 Paper Wrapper */}
          <div className="bg-white mx-auto shadow-sm print:shadow-none p-12 w-[210mm] min-h-[297mm] font-serif text-gray-900 border border-gray-200 print:border-none print:p-0 print:w-full">

            {/* Document Header */}
            <div className="flex items-center justify-between mb-8 border-b-2 border-gray-800 pb-6">
              <div className="w-24 h-24">
                <img src="/logo.png" alt="Official Seal" className="w-full h-full object-contain grayscale" />
              </div>
              <div className="text-center flex-1">
                <p className="text-sm">Republic of the Philippines</p>
                <p className="text-sm">Province of Misamis Oriental</p>
                <p className="text-sm font-bold">MUNICIPALITY OF LAGONGLONG</p>
                <p className="mt-2 text-md italic font-semibold">Office of the Municipal Assessor</p>
              </div>
              <div className="w-24 h-24">
                {/* Optional right logo */}
                <img src="/assessor-logo.png" alt="Assessor Seal" className="w-full h-full object-contain grayscale" />
              </div>
            </div>

            {/* Date */}
            <div className="text-right mb-10 text-sm">
              {formattedDate}
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-center tracking-widest mb-10 underline underline-offset-4">
              C E R T I F I C A T I O N
            </h1>

            {/* Salutation */}
            <p className="mb-6 font-semibold">TO WHOM IT MAY CONCERN:</p>

            {/* Body */}
            <p className="mb-8 leading-relaxed text-justify indent-8">
              THIS IS TO CERTIFY that according to the records in this Office, <span className="font-bold uppercase underline underline-offset-2">{property.owner}</span>, resident of <span className="capitalize">{property.location.split(',')[0]}</span>, Lagonglong, Mis. Or. has/have real properties declared in her/his name for taxation purposes in this municipality as follows:
            </p>

            {/* Data Table */}
            <table className="w-full border-collapse border border-gray-800 mb-8 text-sm">
              <thead>
                <tr>
                  <th className="border border-gray-800 p-2 font-semibold">T/D NO.</th>
                  <th className="border border-gray-800 p-2 font-semibold">LOCATION OF PROPERTY</th>
                  <th className="border border-gray-800 p-2 font-semibold">KIND OF LAND</th>
                  <th className="border border-gray-800 p-2 font-semibold">AREA</th>
                  <th className="border border-gray-800 p-2 font-semibold">ASSESSED VALUE</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-800 p-2 text-center">{property.id.replace('PROPERTY-', '23-09000')}</td>
                  <td className="border border-gray-800 p-2 text-center capitalize">{property.location.split(',')[0]}</td>
                  <td className="border border-gray-800 p-2 text-center capitalize">{property.type}</td>
                  <td className="border border-gray-800 p-2 text-center">2,400 sq m</td>
                  <td className="border border-gray-800 p-2 text-center">{property.assessed}</td>
                </tr>
                {/* Empty rows for layout */}
                <tr>
                  <td className="border border-gray-800 p-2 text-center text-gray-400">XXXXXX</td>
                  <td className="border border-gray-800 p-2 text-center text-gray-400">XXXXXX</td>
                  <td className="border border-gray-800 p-2 text-center text-gray-400">XXXXXX</td>
                  <td className="border border-gray-800 p-2 text-center text-gray-400">XXXXXX</td>
                  <td className="border border-gray-800 p-2 text-center text-gray-400">XXXXXX</td>
                </tr>
              </tbody>
            </table>

            {/* Closing text */}
            <p className="mb-4">
              Issued upon request of <span className="font-bold underline underline-offset-2 capitalize">{property.owner}</span>.
            </p>
            <p className="mb-16">
              Purpose: For any legal purpose it may serve.
            </p>

            {/* Signature Block */}
            <div className="flex justify-end mb-16">
              <div className="text-center">
                <p className="font-bold uppercase">MARIE MAE P. UBALDE</p>
                <p>OIC - Municipal Assessor</p>
              </div>
            </div>

            {/* Footer / Receipt info */}
            <div className="text-sm mt-auto">
              <table className="w-64">
                <tbody>
                  <tr>
                    <td className="py-1">Paid under:</td>
                    <td className="py-1 font-semibold">4567695</td>
                  </tr>
                  <tr>
                    <td className="py-1">Issued at:</td>
                    <td className="py-1 font-semibold">Lagonglong</td>
                  </tr>
                  <tr>
                    <td className="py-1">Issued on:</td>
                    <td className="py-1 font-semibold">{formattedDate}</td>
                  </tr>
                  <tr>
                    <td className="py-1">Amount:</td>
                    <td className="py-1 font-semibold">Php 60.50</td>
                  </tr>
                  <tr>
                    <td className="py-1">Doc. Stamp:</td>
                    <td className="py-1 font-semibold">Php 30.00</td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
