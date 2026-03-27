import React, { useRef, useState } from 'react';
import { Loader2, UploadCloud } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { easyPagesClient } from '../../../../api/client/easyPagesApi.js';
import { isSecurityError } from '../../../app/hooks/useCsrfSession.js';

const UploadTab = ({ project, csrfToken, onNotify, onUploadSuccess }) => {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const acceptZip = (next) => {
    if (!next) {
      setFile(null);
      return;
    }

    const name = next.name || '';
    if (!name.toLowerCase().endsWith('.zip')) {
      onNotify('error', t('upload_zip_only'));
      return;
    }

    setFile(next);
  };

  const handleFileChange = (event) => {
    const next = event.target.files?.[0];
    acceptZip(next);
    event.target.value = '';
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const next = event.dataTransfer.files?.[0];
    acceptZip(next);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleDeploy = async () => {
    if (!file) {
      return;
    }

    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      await easyPagesClient.uploadProjectFiles({
        projectName: project.name,
        csrfToken,
        formData,
      });
      setFile(null);
      onUploadSuccess();
    } catch (error) {
      if (!isSecurityError(error)) {
        onNotify('error', error.message || t('upload_error_msg'));
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <section className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <UploadCloud size={18} />
            {t('upload_title')}
          </h3>
        </div>
        <div className="p-6 space-y-6">
          <input
            ref={inputRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="w-full border-2 border-dashed border-gray-300 rounded-lg py-12 px-4 text-center text-sm text-gray-600 hover:border-orange-400 hover:bg-orange-50/40 transition-colors"
          >
            <UploadCloud className="mx-auto mb-3 text-gray-400" size={36} />
            <p className="font-medium text-gray-800">{t('drop_hint')}</p>
            <p className="mt-1 text-xs text-gray-500">{t('drop_subhint')}</p>
            {file && (
              <p className="mt-4 text-xs font-mono text-orange-700 break-all">{file.name}</p>
            )}
          </button>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleDeploy}
              disabled={!file || uploading}
              className="text-sm bg-gray-900 text-white px-4 py-2 rounded hover:bg-black disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {uploading && <Loader2 size={16} className="animate-spin" />}
              {t('upload_btn')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default UploadTab;
