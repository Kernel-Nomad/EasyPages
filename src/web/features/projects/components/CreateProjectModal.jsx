import { useId } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '../../../shared/hooks/useFocusTrap';
import { useBodyScrollLock } from '../../../shared/hooks/useBodyScrollLock';

const CreateProjectModal = ({
  creating,
  createError,
  newProjectName,
  onClose,
  onNameChange,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const dialogId = useId();
  const nameId = useId();
  const errorId = useId();
  // The trap focuses `initialFocusRef` on open, replacing `autoFocus`.
  const { dialogRef, initialFocusRef } = useFocusTrap({ open: true, onClose });
  useBodyScrollLock(true);

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogId}
        aria-describedby={createError ? errorId : undefined}
        className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
      >
        <h3 id={dialogId} className="text-lg font-bold text-gray-900 mb-4">{t('new_project_title')}</h3>
        <form onSubmit={onSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor={nameId} className="block text-sm font-medium text-gray-700 mb-1">
                {t('project_name_label')}
              </label>
              <input
                id={nameId}
                ref={initialFocusRef}
                type="text"
                placeholder={t('project_name_placeholder')}
                value={newProjectName}
                onChange={(event) => onNameChange(event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                required
                spellCheck={false}
                autoComplete="off"
                disabled={creating}
              />
              <p className="text-xs text-gray-500 mt-1">{t('project_create_hint')}</p>
            </div>
            {createError && (
              <p id={errorId} role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {createError}
              </p>
            )}
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium disabled:opacity-50"
                disabled={creating}
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
              >
                {creating && <Loader2 size={16} className="animate-spin" />}
                {t('create_btn')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProjectModal;
