import React, { useState, useEffect } from 'react';
import { Terminal, Loader2, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SettingsTab = ({ project, csrfToken }) => {
  const { t } = useTranslation();
  const [buildConfig, setBuildConfig] = useState({ command: '', output_dir: '' });
  
  const [loading, setLoading] = useState(true);
  const [savingBuild, setSavingBuild] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    fetchSettings();
  }, [project]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
        const res = await fetch(`/api/projects/${project.name}/env`);
        if (res.ok) {
            const data = await res.json();
            setBuildConfig({
                command: data.build_config?.command || '',
                output_dir: data.build_config?.output_dir || ''
            });
        }
    } catch (e) { 
        console.error(e);
        setMsg({ type: 'error', text: t('config_save_error') });
    } finally { 
        setLoading(false); 
    }
  };

  const handleSaveBuild = async () => {
    setSavingBuild(true);
    try {
      await fetch(`/api/projects/${project.name}`, {
        method: 'PATCH',
        headers: { 
            'Content-Type': 'application/json',
            'CSRF-Token': csrfToken
        },
        body: JSON.stringify({ build_config: buildConfig })
      });
      setMsg({ type: 'success', text: t('config_saved') });
    } catch (e) { setMsg({ type: 'error', text: t('config_save_error') }); }
    finally { setSavingBuild(false); }
  };

  if (loading) return (
      <div className="p-12 text-center flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-orange-500" size={32} />
          <p className="text-gray-500 text-sm">{t('loading_config')}</p>
      </div>
  );

  return (
    <div className="space-y-8 pb-10">
      
      <section className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Terminal size={18} /> {t('build_config_title')}
          </h3>
          <button 
            onClick={handleSaveBuild}
            disabled={savingBuild}
            className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded hover:bg-black disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {savingBuild && <Loader2 size={14} className="animate-spin" />}
            {t('save')}
          </button>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">{t('build_command_label')}</label>
            <input 
              type="text" 
              value={buildConfig.command}
              onChange={e => setBuildConfig({...buildConfig, command: e.target.value})}
              placeholder="npm run build"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">{t('output_dir_label')}</label>
            <input 
              type="text" 
              value={buildConfig.output_dir}
              onChange={e => setBuildConfig({...buildConfig, output_dir: e.target.value})}
              placeholder="dist"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>
        </div>
      </section>

      {msg && (
        <div className={`fixed bottom-4 right-4 px-4 py-2 rounded shadow-lg text-sm font-medium animate-in slide-in-from-bottom-2 flex items-center gap-2 ${msg.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
            {msg.text}
            <button onClick={() => setMsg(null)} className="ml-2 hover:opacity-70"><Trash2 size={12}/></button>
        </div>
      )}
    </div>
  );
};

export default SettingsTab;
