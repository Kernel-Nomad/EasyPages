import { useEffect, useState } from 'react';
import { Loader2, Terminal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { easyPagesClient } from '../../../../api/client/easyPagesApi.js';
import { isSecurityError } from '../../../app/hooks/useAuthSession.js';
import { dashboardErrorMessage } from '../../../shared/i18n/dashboardErrors.js';

const SettingsTab = ({ project, csrfToken, onNotify }) => {
  const { t } = useTranslation();
  const [buildConfig, setBuildConfig] = useState({ command: '', output_dir: '' });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [savingBuild, setSavingBuild] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const loadSettings = async () => {
      setLoading(true);
      setLoadError(false);

      try {
        const data = await easyPagesClient.fetchProjectSettings(project.name, {
          signal: controller.signal,
        });
        if (cancelled || controller.signal.aborted) {
          return;
        }
        setBuildConfig({
          command: data.build_config?.command || '',
          output_dir: data.build_config?.output_dir || '',
        });
      } catch (error) {
        if (cancelled || controller.signal.aborted || error?.name === 'AbortError') {
          return;
        }
        if (!isSecurityError(error)) {
          console.error(error);
          setLoadError(true);
          onNotify('error', dashboardErrorMessage(error, 'config_load_error', t));
        }
      } finally {
        if (!cancelled && !controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadSettings();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the project changes or retry is requested
  }, [project.name, reloadNonce]);

  const handleSaveBuild = async (event) => {
    event.preventDefault();
    if (loadError) {
      return;
    }

    setSavingBuild(true);

    try {
      await easyPagesClient.updateProjectBuildConfig({
        projectName: project.name,
        csrfToken,
        buildConfig,
      });
      onNotify('success', t('config_saved'));
    } catch (error) {
      if (!isSecurityError(error)) {
        onNotify('error', dashboardErrorMessage(error, 'config_save_error', t));
      }
    } finally {
      setSavingBuild(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center flex flex-col items-center gap-3" role="status">
        <Loader2 className="animate-spin text-orange-500" size={32} />
        <p className="text-gray-500 text-sm">{t('loading_config')}</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-12 text-center space-y-3">
        <p className="text-sm text-gray-600">{t('config_load_error')}</p>
        <button
          type="button"
          onClick={() => setReloadNonce((current) => current + 1)}
          className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded hover:bg-black transition-colors"
        >
          {t('auth_retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <form
        onSubmit={handleSaveBuild}
        className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm"
      >
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Terminal size={18} aria-hidden="true" /> {t('build_config_title')}
          </h3>
          <button
            type="submit"
            disabled={savingBuild}
            className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded hover:bg-black disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {savingBuild && <Loader2 size={14} className="animate-spin" />}
            {t('save')}
          </button>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label htmlFor="build-command" className="text-sm font-medium text-gray-700">{t('build_command_label')}</label>
            <input
              id="build-command"
              type="text"
              value={buildConfig.command}
              onChange={(event) => setBuildConfig({ ...buildConfig, command: event.target.value })}
              placeholder={t('build_command_placeholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="output-dir" className="text-sm font-medium text-gray-700">{t('output_dir_label')}</label>
            <input
              id="output-dir"
              type="text"
              value={buildConfig.output_dir}
              onChange={(event) => setBuildConfig({ ...buildConfig, output_dir: event.target.value })}
              placeholder={t('output_dir_placeholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>
        </div>
      </form>
    </div>
  );
};

export default SettingsTab;
