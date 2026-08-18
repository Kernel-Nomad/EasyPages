import { useState } from 'react';
import { Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SupportModal from '../ui/SupportModal';

const Footer = () => {
  const { t } = useTranslation();
  const [supportOpen, setSupportOpen] = useState(false);
  // Separate from `supportOpen` on purpose: the modal is only mounted after the first click,
  // so a visitor who never asks for it never sends a request to ko-fi.com.
  const [supportMounted, setSupportMounted] = useState(false);

  const openSupport = () => {
    setSupportMounted(true);
    setSupportOpen(true);
  };

  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="text-gray-400 text-sm font-medium text-center md:text-left order-2 md:order-1">
          <p>
            &copy; {new Date().getFullYear()}{' '}
            <a
              href="https://kn990x.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 font-semibold hover:underline hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-400 rounded-sm"
            >
              KN990x
            </a>
          </p>
        </div>

        <div className="flex flex-row flex-wrap justify-center items-center gap-4 md:gap-6 order-1 md:order-2">
          <button
            type="button"
            onClick={openSupport}
            aria-haspopup="dialog"
            className="inline-flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 px-3.5 py-1.5 text-sm font-semibold text-orange-700 shadow-sm transition-colors hover:bg-orange-100 hover:text-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
          >
            <Heart className="h-3.5 w-3.5 shrink-0 fill-current" aria-hidden="true" />
            <span>{t('support_title')}</span>
          </button>
        </div>
      </div>

      {supportMounted && (
        <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />
      )}
    </footer>
  );
};

export default Footer;
