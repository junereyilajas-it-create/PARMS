import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { MessageModal } from '../components/common/MessageModal';

type ModalType = 'success' | 'error' | 'confirm' | 'info' | 'warning';

interface ModalOptions {
  title: string;
  message: string;
  type: ModalType;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface ModalContextType {
  showModal: (options: ModalOptions) => void;
  showSuccess: (message: string, title?: string) => void;
  showError: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  showConfirm: (message: string, onConfirm: () => void, title?: string) => void;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modalState, setModalState] = useState<ModalOptions | null>(null);

  const showModal = useCallback((options: ModalOptions) => {
    setModalState(options);
  }, []);

  const closeModal = useCallback(() => {
    if (modalState?.onCancel) {
        modalState.onCancel();
    }
    setModalState(null);
  }, [modalState]);

  const handleConfirm = useCallback(() => {
    if (modalState?.onConfirm) {
      modalState.onConfirm();
    }
    setModalState(null);
  }, [modalState]);

  const showSuccess = useCallback((message: string, title = 'Success') => {
    showModal({ title, message, type: 'success' });
  }, [showModal]);

  const showError = useCallback((message: string, title = 'Error') => {
    showModal({ title, message, type: 'error' });
  }, [showModal]);

  const showInfo = useCallback((message: string, title = 'Info') => {
    showModal({ title, message, type: 'info' });
  }, [showModal]);

  const showConfirm = useCallback((message: string, onConfirm: () => void, title = 'Confirm Action') => {
    showModal({ title, message, type: 'confirm', onConfirm });
  }, [showModal]);

  return (
    <ModalContext.Provider value={{ showModal, showSuccess, showError, showInfo, showConfirm, closeModal }}>
      {children}
      {modalState && (
        <MessageModal
          title={modalState.title}
          message={modalState.message}
          type={modalState.type}
          onClose={closeModal}
          onConfirm={modalState.type === 'confirm' ? handleConfirm : undefined}
        />
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}
