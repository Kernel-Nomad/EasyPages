import React, { useEffect, useId, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ConfirmDialog = ({ confirmation, onCancel, onConfirm }) => {
  const { t } = useTranslation();
  const dialogId = useId();
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  const getFocusableElements = () => {
    if (!dialogRef.current) {
      return [];
    }

    return Array.from(
      dialogRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hasAttribute('disabled'));
  };

  useEffect(() => {
    if (!confirmation) {
      return undefined;
    }

    previousFocusRef.current = document.activeElement;
    const focusableElements = getFocusableElements();
    focusableElements[0]?.focus();

    return () => {
      previousFocusRef.current?.focus?.();
    };
  }, [confirmation]);

  if (!confirmation) {
    return null;
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusableElements = getFocusableElements();
    if (focusableElements.length === 0) {
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogId}
        onKeyDown={handleKeyDown}
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-start gap-3">
          <div className={`rounded-full p-2 ${confirmation.destructive ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
            <AlertTriangle size={18} />
          </div>
          <div className="space-y-2">
            <h3 id={dialogId} className="text-lg font-semibold text-gray-900">{confirmation.title}</h3>
            <p className="whitespace-pre-line text-sm text-gray-600">{confirmation.message}</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
          >
            {confirmation.cancelLabel || t('cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
              confirmation.destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'
            }`}
          >
            {confirmation.confirmLabel || t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
