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
import AuthLayout from '../components/AuthLayout';

const FIELD_CLASS =
  'w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500';
// text-gray-500 on white is the lightest that still clears 4.5:1 at this size.
const HINT_CLASS = 'mt-1 text-xs text-gray-500';

const SetupView = ({ onSubmit, onToggleLanguage }) => {
  const { t } = useTranslation();
  const usernameId = useId();
  const passwordId = useId();
  const repeatId = useId();
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = data.get('password');

    // Caught here, not server-side: the backend deliberately never reflects a submitted
    // password back, so it could not say which field was wrong.
    if (password !== data.get('password_repeat')) {
      setError(t('setup_password_mismatch'));
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ password, username: data.get('username') });
    } catch (submitError) {
      setError(authErrorMessage(submitError, t));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title={t('setup_title')}
      subtitle={t('setup_subtitle')}
      onToggleLanguage={onToggleLanguage}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="flex gap-2 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-800">
          <ShieldAlert size={16} className="mt-px shrink-0" />
          <span>{t('setup_warning')}</span>
        </p>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div>
          <label htmlFor={usernameId} className="mb-1 block text-sm font-medium text-gray-700">
            {t('auth_username')}
          </label>
          <input
            id={usernameId}
            name="username"
            type="text"
            autoComplete="username"
            minLength={USERNAME_MIN_LEN}
            maxLength={USERNAME_MAX_LEN}
            pattern={USERNAME_CHARSET_PATTERN}
            required
            className={FIELD_CLASS}
          />
          <p className={HINT_CLASS}>
            {t('setup_username_hint', { max: USERNAME_MAX_LEN, min: USERNAME_MIN_LEN })}
          </p>
        </div>

        <div>
          <label htmlFor={passwordId} className="mb-1 block text-sm font-medium text-gray-700">
            {t('setup_password')}
          </label>
          <input
            id={passwordId}
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LEN}
            maxLength={PASSWORD_MAX_LEN}
            required
            className={FIELD_CLASS}
          />
          <p className={HINT_CLASS}>{t('setup_password_hint', { min: PASSWORD_MIN_LEN })}</p>
        </div>

        <div>
          <label htmlFor={repeatId} className="mb-1 block text-sm font-medium text-gray-700">
            {t('setup_password_repeat')}
          </label>
          <input
            id={repeatId}
            name="password_repeat"
            type="password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LEN}
            maxLength={PASSWORD_MAX_LEN}
            required
            className={FIELD_CLASS}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          {submitting ? t('setup_submitting') : t('setup_submit')}
        </button>
      </form>
    </AuthLayout>
  );
};

export default SetupView;
