import React, { useState } from 'react';
import { UploadCloud, Loader2, FileArchive } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const UploadTab = ({ project, onUploadSuccess, csrfToken }) => {
    const { t } = useTranslation();
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [msg, setMsg] = useState(null);

    const handleFileChange = (e) => {
        if (e.target.files[0]) setFile(e.target.files[0]);
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`/api/projects/${project.name}/upload`, {
                method: 'POST',
                headers: {
                    'CSRF-Token': csrfToken
                },
                body: formData
            });
            
            if (res.ok) {
                setFile(null);
                if (onUploadSuccess) onUploadSuccess();
            } else {
                throw new Error('Falló la subida');
            }
        } catch (error) {
            setMsg({ type: 'error', text: t('upload_error_msg') });
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-2xl mx-auto mt-4">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <UploadCloud /> {t('upload_title')}
            </h3>
            
            <form onSubmit={handleUpload} className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors">
                    <input 
                        type="file" 
                        accept=".zip,.tar.gz"
                        onChange={handleFileChange}
                        className="hidden" 
                        id="file-upload"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
                        <FileArchive size={32} className="text-gray-400" />
                        <span className="text-sm text-gray-600 font-medium">
                            {file ? file.name : t('drop_hint')}
                        </span>
                        <span className="text-xs text-gray-400">{t('drop_subhint')}</span>
                    </label>
                </div>

                <div className="flex justify-end">
                    <button 
                        type="submit" 
                        disabled={!file || uploading}
                        className="bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50 hover:bg-orange-700"
                    >
                        {uploading ? <Loader2 className="animate-spin" /> : <UploadCloud size={18} />}
                        {t('upload_btn')}
                    </button>
                </div>
            </form>

            {msg && (
                <div className={`mt-4 p-3 rounded text-sm ${msg.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                    {msg.text}
                </div>
            )}
        </div>
    );
};

export default UploadTab;
