import { useId, useState } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  PASSWORD_MAX_LEN,
  PASSWORD_MIN_LEN,
  USERNAME_CHARSET_PATTERN,
  USERNAME_MAX_LEN,
  USERNAME_MIN_LEN,
} from '../../../../shared/authPolicy.js';
import { authErrorMessage } from '../../../shared/i18n/authErrors.js';
import { useFocusTrap } from '../../../shared/hooks/useFocusTrap';

const FIELD_CLASS =
  'w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500';

const AccountModal = ({ onClose, onSubmit, username }) => {
  const { t } = useTranslation();
  const dialogId = useId();
  const currentId = useId();
  const usernameId = useId();
  const passwordId = useId();
  const { dialogRef, initialFocusRef } = useFocusTrap({ open: true, onClose });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nextUsername = String(data.get('username') ?? '').trim();
    const nextPassword = String(data.get('new_password') ?? '');

    if (!nextUsername && !nextPassword) {
      setError(t('account_nothing_to_change'));
      return;
    }

    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      await onSubmit({
        currentPassword: data.get('current_password'),
        // Omitted rather than empty: the server reads "absent" as "leave it alone".
        ...(nextUsername ? { username: nextUsername } : {}),
        ...(nextPassword ? { newPassword: nextPassword } : {}),
      });
      event.target.reset();
      setSuccess(t('account_success'));
    } catch (submitError) {
      // "Wrong current password" stays here; only a genuinely expired session leaves the
      // screen. The API client tells them apart by code.
      setError(authErrorMessage(submitError, t));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogId}
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
      >
        <h3 id={dialogId} className="text-lg font-semibold text-gray-900">
          {t('account_title')}
        </h3>
        {username && <p className="mt-1 text-sm text-gray-500">{username}</p>}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {/* Up front, not after the fact: this is the surprising part of saving. */}
          <p className="flex gap-2 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-800">
            <ShieldAlert size={16} className="mt-px shrink-0" />
            <span>{t('account_warning')}</span>
          </p>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {success && (
            <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              {success}
            </p>
          )}

          <div>
            <label htmlFor={currentId} className="mb-1 block text-sm font-medium text-gray-700">
              {t('account_current_password')}
            </label>
            <input
              id={currentId}
              ref={initialFocusRef}
              name="current_password"
              type="password"
              autoComplete="current-password"
              maxLength={PASSWORD_MAX_LEN}
              required
              className={FIELD_CLASS}
            />
          </div>

          <div>
            <label htmlFor={usernameId} className="mb-1 block text-sm font-medium text-gray-700">
              {t('account_new_username')}
            </label>
            <input
              id={usernameId}
              name="username"
              type="text"
              autoComplete="username"
              minLength={USERNAME_MIN_LEN}
              maxLength={USERNAME_MAX_LEN}
              pattern={USERNAME_CHARSET_PATTERN}
              className={FIELD_CLASS}
            />
          </div>

          <div>
            <label htmlFor={passwordId} className="mb-1 block text-sm font-medium text-gray-700">
              {t('account_new_password')}
            </label>
            <input
              id={passwordId}
              name="new_password"
              type="password"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LEN}
              maxLength={PASSWORD_MAX_LEN}
              className={FIELD_CLASS}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              {submitting ? t('account_submitting') : t('account_submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AccountModal;
