import { useId } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

const ConfirmDialog = ({ confirmation, onCancel, onConfirm }) => {
  const { t } = useTranslation();
  const dialogId = useId();
  const descriptionId = useId();
  // Unconditional: the early return below happens after every hook has run.
  const { dialogRef } = useFocusTrap({ open: Boolean(confirmation), onClose: onCancel });
  useBodyScrollLock(Boolean(confirmation));

  if (!confirmation) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogId}
        aria-describedby={descriptionId}
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <div className={`rounded-full p-2 ${confirmation.destructive ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
            <AlertTriangle size={18} />
          </div>
          <div className="space-y-2">
            <h3 id={dialogId} className="text-lg font-semibold text-gray-900">{confirmation.title}</h3>
            <p id={descriptionId} className="whitespace-pre-line text-sm text-gray-600">{confirmation.message}</p>
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
