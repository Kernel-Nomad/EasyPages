import React from 'react';
import { useTranslation } from 'react-i18next';

const Footer = () => {
  const { t } = useTranslation();
  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 flex flex-col md:flex-row justify-between items-center gap-6">
          
          <div className="text-gray-400 text-sm font-medium text-center md:text-left order-2 md:order-1">
              <p>&copy; {new Date().getFullYear()} <span className="text-gray-600 font-semibold">KN</span></p>
          </div>

          <div className="flex flex-row flex-wrap justify-center items-center gap-4 md:gap-6 order-1 md:order-2">
              
              <a 
                href="https://ko-fi.com/F2F81PNZRL" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-1 rounded-full text-white text-sm font-bold transition-all hover:opacity-90 hover:scale-105 active:scale-95 shadow-sm h-[28px] whitespace-nowrap"
                style={{ backgroundColor: '#7700ff' }}
                title="Support me on Ko-fi"
              >
                 <img 
                   src="https://storage.ko-fi.com/cdn/cup-border.png" 
                   alt="Ko-fi donation" 
                   className="w-4 h-auto animate-[spin_3s_linear_infinite]" 
                   style={{ animationName: 'none' }} 
                 />
                 <span style={{ fontFamily: 'inherit' }}>{t('tip_me')}</span>
              </a>
              
          </div>

      </div>
    </footer>
  );
};

export default Footer;
