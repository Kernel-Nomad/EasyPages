import { useId, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PASSWORD_MAX_LEN, USERNAME_MAX_LEN } from '../../../../shared/authPolicy.js';
import { authErrorMessage } from '../../../shared/i18n/authErrors.js';
import AuthLayout from '../components/AuthLayout';

const FIELD_CLASS =
  'w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500';

const LoginView = ({ onSubmit, onToggleLanguage }) => {
  const { t } = useTranslation();
  const usernameId = useId();
  const passwordId = useId();
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    // Uncontrolled: the password lives in the DOM node and the request body only, never
    // in React state where a devtools snapshot would hold on to it.
    const data = new FormData(event.currentTarget);
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        password: data.get('password'),
        username: data.get('username'),
      });
    } catch (submitError) {
      // A 401 here means wrong credentials, so it stays on the form: the session-expired
      // path would only redraw this same screen.
      setError(authErrorMessage(submitError, t));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title={t('auth_title')}
      subtitle={t('auth_subtitle')}
      onToggleLanguage={onToggleLanguage}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
            maxLength={USERNAME_MAX_LEN}
            required
            className={FIELD_CLASS}
          />
        </div>

        <div>
          <label htmlFor={passwordId} className="mb-1 block text-sm font-medium text-gray-700">
            {t('auth_password')}
          </label>
          <input
            id={passwordId}
            name="password"
            type="password"
            autoComplete="current-password"
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
          {submitting ? t('auth_submitting') : t('auth_submit')}
        </button>
      </form>
    </AuthLayout>
  );
};

export default LoginView;
