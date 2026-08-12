import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** Shared shell for every screen shown before the dashboard: setup, login and offline. */
const AuthLayout = ({ children, onToggleLanguage, subtitle, title }) => {
  const { i18n, t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12 font-sans text-gray-900">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-3">
          <img src="/logo.svg" alt="" className="h-10 w-10" />
          <span className="text-2xl font-bold tracking-tight">
            Easy<span className="font-light text-gray-500">Pages</span>
          </span>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={onToggleLanguage}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-orange-50 hover:text-orange-600"
            title={t('toggle_language')}
            aria-label={t('toggle_language')}
          >
            <Languages size={16} />
            <span className="font-medium uppercase">{i18n.language?.split('-')[0]}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
