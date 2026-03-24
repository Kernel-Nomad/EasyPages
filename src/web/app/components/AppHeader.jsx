import React from 'react';
import { Languages, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const AppHeader = ({ language, onToggleLanguage, onLogout }) => {
  const { t } = useTranslation();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="EasyPages Logo" className="w-8 h-8" />
          <h1 className="font-bold text-xl tracking-tight text-gray-900">
            Easy<span className="font-light text-gray-500">Pages</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleLanguage}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-orange-600 hover:bg-orange-50 px-3 py-2 rounded-lg transition-colors"
            title="Cambiar idioma / Change language"
          >
            <Languages size={18} />
            <span className="font-medium uppercase">{language}</span>
          </button>

          <button
            onClick={onLogout}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-orange-600 hover:bg-orange-50 px-3 py-2 rounded-lg transition-colors"
            title={t('logout')}
          >
            <span className="hidden sm:block font-medium">{t('logout')}</span>
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
