import React from 'react';
import { Coffee } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="text-gray-400 text-sm font-medium text-center md:text-left order-2 md:order-1">
          <p>
            &copy; {new Date().getFullYear()}{' '}
            <a
              href="https://github.com/KN990x"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 font-semibold hover:underline hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-400 rounded-sm"
            >
              KN
            </a>
          </p>
        </div>

        <div className="flex flex-row flex-wrap justify-center items-center gap-4 md:gap-6 order-1 md:order-2">
          <a
            href="https://buymeacoffee.com/kn990x"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold text-gray-900 transition-all hover:opacity-90 hover:scale-105 active:scale-95 shadow-sm h-[28px] whitespace-nowrap"
            style={{ backgroundColor: '#FFDD00' }}
            title={t('tip_me')}
          >
            <Coffee className="w-4 h-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            <span style={{ fontFamily: 'inherit' }}>{t('tip_me')}</span>
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
