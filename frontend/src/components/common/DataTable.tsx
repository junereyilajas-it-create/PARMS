import React from 'react';
import { ChevronLeft, ChevronRight, Eye, Edit, Trash2 } from 'lucide-react';

interface Column {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
}

interface DataTableProps {
  columns: Column[];
  data: any[];
  onView?: (row: any) => void;
  onEdit?: (row: any) => void;
  onDelete?: (row: any) => void;
  onRowClick?: (row: any) => void;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  showActions?: boolean;
  customActions?: (row: any) => React.ReactNode;
  userRole?: string;
}

export const DataTable: React.FC<DataTableProps> = ({
  columns,
  data,
  onView,
  onEdit,
  onDelete,
  onRowClick,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  showActions = true,
  customActions,
  userRole,
}) => {
  const [selectedRowIndex, setSelectedRowIndex] = React.useState<number | null>(null);
  const isAssessor = userRole === 'assessor';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border border-gray-200 dark:border-gray-700">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-900 dark:bg-gray-950 text-white dark:text-gray-200">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-3 text-sm font-semibold whitespace-nowrap">
                  {col.label}
                </th>
              ))}
              {showActions && (onView || onEdit || onDelete || customActions) && (
                <th className="px-4 py-3 text-right text-sm font-semibold sticky right-0 bg-gray-900 dark:bg-gray-950 z-10 whitespace-nowrap">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIdx) => {
              const isSelected = selectedRowIndex === rowIdx;
              let rowClasses = "border-t border-gray-200 dark:border-gray-700 transition ";
              if (onRowClick) {
                rowClasses += " cursor-pointer hover:bg-green-50/70 dark:hover:bg-green-900/20 active:bg-green-100/60";
              } else if (isAssessor) {
                rowClasses += " " + (isSelected ? "bg-green-50/50 dark:bg-green-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-700/50");
              } else {
                rowClasses += " hover:bg-gray-50 dark:hover:bg-gray-700";
              }

              return (
                <React.Fragment key={rowIdx}>
                  <tr
                    className={rowClasses}
                    onClick={() => {
                      if (onRowClick) {
                        onRowClick(row);
                      } else if (isAssessor) {
                        setSelectedRowIndex(isSelected ? null : rowIdx);
                      }
                    }}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {col.render ? col.render(row[col.key], row) : row[col.key]}
                      </td>
                    ))}
                    {showActions && (onView || onEdit || onDelete || customActions) && (
                      <td className="px-4 py-3 text-sm text-right sticky right-0 bg-white dark:bg-gray-800 z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                        <div className="flex gap-2 items-center justify-end whitespace-nowrap">
                          {onView && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onView(row); }}
                              className="text-blue-600 hover:text-blue-800 transition"
                              title="View"
                            >
                              <Eye size={18} />
                            </button>
                          )}
                          {onEdit && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onEdit(row); }}
                              className="text-green-600 hover:text-green-800 transition"
                              title="Edit"
                            >
                              <Edit size={18} />
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onDelete(row); }}
                              className="text-red-600 hover:text-red-800 transition"
                              title="Delete"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                          {customActions && customActions(row)}
                        </div>
                      </td>
                    )}
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Showing page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange?.(currentPage - 1)}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const page = i + 1;
              return (
                <button
                  key={page}
                  onClick={() => onPageChange?.(page)}
                  className={`px-3 py-2 rounded-lg ${currentPage === page
                      ? 'bg-gray-900 dark:bg-gray-700 text-white'
                      : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
                    } transition`}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => onPageChange?.(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
