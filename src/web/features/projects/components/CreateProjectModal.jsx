import React, { useEffect, useId, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const CreateProjectModal = ({
  creating,
  newProjectName,
  onClose,
  onNameChange,
  onSubmit,
}) => {
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
    previousFocusRef.current = document.activeElement;
    const focusableElements = getFocusableElements();
    focusableElements[0]?.focus();

    return () => {
      previousFocusRef.current?.focus?.();
    };
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
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
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogId}
        onKeyDown={handleKeyDown}
        className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200"
      >
        <h3 id={dialogId} className="text-lg font-bold text-gray-900 mb-4">{t('new_project_title')}</h3>
        <form onSubmit={onSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('project_name_label')}</label>
              <input
                autoFocus
                type="text"
                placeholder="mi-sitio-increible"
                value={newProjectName}
                onChange={(event) => onNameChange(event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                required
              />
              <p className="text-xs text-gray-500 mt-1">{t('project_create_hint')}</p>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
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
