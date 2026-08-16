import { Heart } from 'lucide-react';
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
            href="https://ko-fi.com/kn990x"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-[#FF5E5B] px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#e54e4b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5E5B] focus-visible:ring-offset-2"
            title={t('tip_me')}
          >
            <Heart className="h-3.5 w-3.5 shrink-0 fill-current" aria-hidden="true" />
            <span>{t('tip_me')}</span>
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
