import { Landmark, Loader2, RotateCcw } from 'lucide-react'

export function SystemLoadingScreen({ error, onRetry }: { error?: string; onRetry?: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      <div className="flex flex-col items-center max-w-sm w-full p-8 text-center animate-in fade-in zoom-in duration-500">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white shadow-xl mb-6">
          <Landmark size={32} />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight mb-1">
          ASSESSOR OFFICE
        </h1>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-12">
          System
        </p>
        
        <div className="h-24 flex flex-col items-center justify-center">
          {error ? (
            <div className="animate-in slide-in-from-bottom-2 fade-in duration-300">
              <p className="text-sm text-red-600 dark:text-red-400 mb-4 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-800">
                {error}
              </p>
              {onRetry && (
                <button 
                  onClick={onRetry}
                  className="flex items-center gap-2 px-4 py-2 mx-auto text-sm font-medium text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
                >
                  <RotateCcw size={16} /> Retry Connection
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-blue-600" size={28} />
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Loading...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
