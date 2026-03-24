import React, { useEffect, useState } from 'react';
import { Loader2, Terminal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { easyPagesClient } from '../../../../api/client/easyPagesApi.js';

const SettingsTab = ({ project, csrfToken, onNotify }) => {
  const { t } = useTranslation();
  const [buildConfig, setBuildConfig] = useState({ command: '', output_dir: '' });
  const [loading, setLoading] = useState(true);
  const [savingBuild, setSavingBuild] = useState(false);

  const loadSettings = async () => {
    setLoading(true);

    try {
      const data = await easyPagesClient.fetchProjectSettings(project.name);
      setBuildConfig({
        command: data.build_config?.command || '',
        output_dir: data.build_config?.output_dir || '',
      });
    } catch (error) {
      console.error(error);
      onNotify('error', error.message || t('config_load_error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [project.name]);

  const handleSaveBuild = async () => {
    setSavingBuild(true);

    try {
      await easyPagesClient.updateProjectBuildConfig({
        projectName: project.name,
        csrfToken,
        buildConfig,
      });
      onNotify('success', t('config_saved'));
    } catch (error) {
      onNotify('error', error.message || t('config_save_error'));
    } finally {
      setSavingBuild(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center flex flex-col items-center gap-3">
        <Loader2 className="animate-spin text-orange-500" size={32} />
        <p className="text-gray-500 text-sm">{t('loading_config')}</p>
      </div>
    );
  }

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
              onChange={(event) => setBuildConfig({ ...buildConfig, command: event.target.value })}
              placeholder="npm run build"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">{t('output_dir_label')}</label>
            <input
              type="text"
              value={buildConfig.output_dir}
              onChange={(event) => setBuildConfig({ ...buildConfig, output_dir: event.target.value })}
              placeholder="dist"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>
        </div>
      </section>
    </div>
  );
};

export default SettingsTab;
