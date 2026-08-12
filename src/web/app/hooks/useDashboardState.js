import { useEffect, useRef, useState } from 'react';
import { easyPagesClient } from '../../../api/client/easyPagesApi.js';

/** Delay before re-fetching deployments so Cloudflare can register the new deployment. */
const DEPLOYMENTS_LIST_REFRESH_DELAY_MS = 2000;

const DASHBOARD_I18N_ERROR_CODES = new Set([
  'validation_error',
  'invalid_domain',
  'rate_limited',
]);

/** Prefer a translated string when the backend sent a known stable code. */
const dashboardErrorMessage = (error, fallbackKey, t) => {
  if (error?.code && DASHBOARD_I18N_ERROR_CODES.has(error.code)) {
    return t(error.code);
  }
  return error.message || t(fallbackKey);
};

export const useDashboardState = ({ csrfToken, isSecurityError, onNotify, t }) => {
  const [view, setView] = useState('list');
  const [selectedProject, setSelectedProject] = useState(null);
  const [activeTab, setActiveTab] = useState('deployments');
  const [projects, setProjects] = useState([]);
  const [deployments, setDeployments] = useState([]);
  const [productionDeploymentId, setProductionDeploymentId] = useState(null);
  const [deploymentsPage, setDeploymentsPage] = useState(1);
  const [deploymentsHasMore, setDeploymentsHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingDeployments, setLoadingDeployments] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creating, setCreating] = useState(false);
  const deploymentsAbortControllerRef = useRef(null);
  const deploymentsRefreshTimeoutRef = useRef(null);

  const clearScheduledDeploymentsRefresh = () => {
    if (deploymentsRefreshTimeoutRef.current) {
      clearTimeout(deploymentsRefreshTimeoutRef.current);
      deploymentsRefreshTimeoutRef.current = null;
    }
  };

  const loadProjects = async () => {
    setLoading(true);

    try {
      const data = await easyPagesClient.fetchProjects();
      setProjects(data);
    } catch (error) {
      if (!isSecurityError(error)) {
        console.error(error);
        onNotify('error', dashboardErrorMessage(error, 'project_list_error', t));
      }
    } finally {
      setLoading(false);
    }
  };

  const loadDeployments = async (projectName, { append = false, page = 1, signal } = {}) => {
    setLoadingDeployments(true);

    try {
      const data = await easyPagesClient.fetchDeployments(projectName, { page, signal });
      if (signal?.aborted) {
        return;
      }

      const nextDeployments = data?.deployments || [];
      setDeployments((current) => (append ? [...current, ...nextDeployments] : nextDeployments));
      setProductionDeploymentId(data?.productionDeploymentId ?? null);
      setDeploymentsPage(data?.page || page);
      setDeploymentsHasMore(Boolean(data?.hasMore));
    } catch (error) {
      if (error?.name === 'AbortError') {
        return;
      }
      if (!isSecurityError(error)) {
        console.error('Error loading deployments:', error);
        onNotify('error', dashboardErrorMessage(error, 'deploy_load_error', t));
      }
    } finally {
      if (!signal?.aborted) {
        setLoadingDeployments(false);
      }
    }
  };

  const loadMoreDeployments = async () => {
    if (!selectedProject || !deploymentsHasMore || loadingDeployments) {
      return;
    }

    await loadDeployments(selectedProject.name, {
      append: true,
      page: deploymentsPage + 1,
    });
  };

  useEffect(() => {
    if (selectedProject && view === 'detail') {
      deploymentsAbortControllerRef.current?.abort();
      const nextController = new AbortController();
      deploymentsAbortControllerRef.current = nextController;
      setDeployments([]);
      setProductionDeploymentId(null);
      setDeploymentsPage(1);
      setDeploymentsHasMore(false);
      loadDeployments(selectedProject.name, { signal: nextController.signal });

      return () => {
        nextController.abort();
        if (deploymentsAbortControllerRef.current === nextController) {
          deploymentsAbortControllerRef.current = null;
        }
      };
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadDeployments is recreated each render
  }, [selectedProject, view]);

  useEffect(() => () => {
    deploymentsAbortControllerRef.current?.abort();
    clearScheduledDeploymentsRefresh();
  }, []);

  const handleTriggerDeploy = async () => {
    if (!selectedProject) {
      return;
    }
    const projectName = selectedProject.name;

    setIsDeploying(true);

    try {
      await easyPagesClient.triggerDeployment({
        projectName,
        csrfToken,
      });

      onNotify('success', t('deploy_success'));
      clearScheduledDeploymentsRefresh();
      deploymentsRefreshTimeoutRef.current = setTimeout(() => {
        loadDeployments(projectName);
      }, DEPLOYMENTS_LIST_REFRESH_DELAY_MS);
    } catch (error) {
      if (!isSecurityError(error)) {
        onNotify('error', dashboardErrorMessage(error, 'deploy_error', t));
      }
    } finally {
      setIsDeploying(false);
    }
  };

  const handleCreateProject = async (event) => {
    event.preventDefault();
    setCreating(true);

    try {
      await easyPagesClient.createProject({
        csrfToken,
        name: newProjectName,
      });

      onNotify('success', t('create_success'));
      setShowCreateModal(false);
      setNewProjectName('');
      await loadProjects();
    } catch (error) {
      if (!isSecurityError(error)) {
        onNotify('error', dashboardErrorMessage(error, 'create_error', t));
      }
    } finally {
      setCreating(false);
    }
  };

  const handleProjectClick = (project) => {
    setSelectedProject(project);
    setView('detail');
    setActiveTab('deployments');
  };

  const handleBack = () => {
    clearScheduledDeploymentsRefresh();
    setSelectedProject(null);
    setView('list');
    setDeployments([]);
    setProductionDeploymentId(null);
    setDeploymentsPage(1);
    setDeploymentsHasMore(false);
  };

  const handleUploadSuccess = () => {
    if (!selectedProject) {
      return;
    }

    clearScheduledDeploymentsRefresh();
    loadDeployments(selectedProject.name);
    setActiveTab('deployments');
    onNotify('success', t('upload_success_msg'));
  };

  return {
    activeTab,
    creating,
    deployments,
    deploymentsHasMore,
    handleBack,
    handleCreateProject,
    handleProjectClick,
    handleTriggerDeploy,
    handleUploadSuccess,
    isDeploying,
    loadDeployments,
    loadMoreDeployments,
    loadProjects,
    loading,
    loadingDeployments,
    newProjectName,
    productionDeploymentId,
    projects,
    selectedProject,
    setActiveTab,
    setNewProjectName,
    setShowCreateModal,
    showCreateModal,
    view,
  };
};
