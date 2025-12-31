import React, { useState, useEffect } from 'react';
import { GitBranch, Clock, ExternalLink, Hash, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import StatusBadge from './ui/StatusBadge';

const DeploymentItem = ({ deployment, isSelected, onToggle, isProduction }) => {
  const { t } = useTranslation();
  
  return (
    <div className={`flex items-center justify-between p-4 border-b border-gray-100 last:border-0 transition-colors group ${isSelected ? 'bg-orange-50' : 'hover:bg-gray-50'}`}>
      <div className="flex items-center gap-4">
        <input 
            type="checkbox" 
            checked={isSelected}
            onChange={() => onToggle(deployment.id)}
            // Hemos eliminado 'disabled={isProduction}'. Ahora todo es seleccionable.
            className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-50 cursor-pointer"
        />

        <div className={`mt-0.5 w-2.5 h-2.5 rounded-full ring-4 ring-opacity-20 ${
            deployment.status === 'success' ? 'bg-emerald-500 ring-emerald-500' : 
            deployment.status === 'active' ? 'bg-blue-500 ring-blue-500' : 'bg-red-500 ring-red-500'
        }`} />
        
        <div>
          <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-gray-900 text-sm">
                  {deployment.deployment_trigger?.metadata?.commit_message || deployment.message || t('manual_deploy')}
              </span>
              {isProduction && (
                 <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">
                    Production
                 </span>
              )}
          </div>
          
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            <span className="flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
              <GitBranch size={10} />
              {deployment.deployment_trigger?.metadata?.branch || deployment.branch || 'main'}
            </span>
            
            <span className="flex items-center gap-1 font-mono">
              <Hash size={10} />
              {deployment.deployment_trigger?.metadata?.commit_hash?.substring(0,7) || deployment.commit_hash?.substring(0,7) || '----'}
            </span>

            <span className="flex items-center gap-1">
              <Clock size={10} /> 
              {new Date(deployment.created_on).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <StatusBadge status={deployment.status} />
        
        {deployment.url && (
            <a 
              href={deployment.url} 
              target="_blank" 
              rel="noreferrer"
              className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-full"
              title={t('view_deploy')}
            >
              <ExternalLink size={18} />
            </a>
        )}
      </div>
    </div>
  );
};

const DeploymentList = ({ deployments, projectName, csrfToken, onRefresh }) => {
    const { t } = useTranslation();
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [isDeleting, setIsDeleting] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    useEffect(() => {
        setSelectedIds(new Set());
    }, [deployments]);

    const handleToggle = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            // Selecciona TODOS los IDs, el backend se encargará de ignorar el activo.
            const ids = deployments.map(d => d.id);
            setSelectedIds(new Set(ids));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleDeleteSelected = async () => {
        if (!confirm(t('confirm_delete_selected', { count: selectedIds.size }))) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/projects/${projectName}/deployments`, {
                method: 'DELETE',
                headers: { 
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify({ deploymentIds: Array.from(selectedIds) })
            });
            if (res.ok) {
                onRefresh();
            } else {
                alert("Error al eliminar");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteAll = async () => {
        if (!confirm(t('confirm_delete_all'))) return;
        
        setIsDeleting(true);
        setProgress({ current: 0, total: 100 }); // Indeterminado inicial

        try {
            // 1. Obtener lista de candidatos (Backend escanea todo excepto activo)
            const candRes = await fetch(`/api/projects/${projectName}/deployments/candidates`);
            if (!candRes.ok) throw new Error("Error obteniendo candidatos");
            
            const data = await candRes.json();
            const idsToDelete = data.ids || [];

            if (idsToDelete.length === 0) {
                alert("No hay nada que borrar");
                setIsDeleting(false);
                return;
            }

            setProgress({ current: 0, total: idsToDelete.length });

            // 2. Procesar borrado en lotes pequeños (Chunking) para actualizar la barra de progreso
            const chunkSize = 5; 
            for (let i = 0; i < idsToDelete.length; i += chunkSize) {
                const chunk = idsToDelete.slice(i, i + chunkSize);
                
                await fetch(`/api/projects/${projectName}/deployments`, {
                    method: 'DELETE',
                    headers: { 
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken
                    },
                    body: JSON.stringify({ deploymentIds: chunk })
                });

                setProgress(prev => ({ ...prev, current: Math.min(prev.current + chunk.length, prev.total) }));
            }

            onRefresh();

        } catch (e) {
            console.error(e);
            alert("Error crítico durante el proceso de eliminación");
        } finally {
            setIsDeleting(false);
            setProgress({ current: 0, total: 0 });
        }
    };

    return (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden animate-in fade-in duration-300 shadow-sm relative">
            
            {/* Barra de Progreso Overlay */}
            {isDeleting && progress.total > 0 && (
                <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-8 gap-4">
                    <Loader2 size={40} className="animate-spin text-orange-600" />
                    <div className="w-full max-w-md space-y-2">
                        <div className="flex justify-between text-sm font-medium text-gray-600">
                            <span>{t('deleting_msg')}</span>
                            <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                            <div 
                                className="bg-orange-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                                style={{ width: `${(progress.current / progress.total) * 100}%` }}
                            ></div>
                        </div>
                        <p className="text-xs text-center text-gray-400">
                            {progress.current} / {progress.total}
                        </p>
                    </div>
                </div>
            )}

            <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center flex-wrap gap-4">
                <div className="flex items-center gap-3">
                     <h3 className="font-semibold text-gray-800">{t('history_title')}</h3>
                     <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">{deployments?.length || 0}</span>
                </div>

                <div className="flex items-center gap-3">
                    {selectedIds.size > 0 && (
                        <button 
                            onClick={handleDeleteSelected}
                            disabled={isDeleting}
                            className="text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-colors"
                        >
                            {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            {t('delete_selected', { count: selectedIds.size })}
                        </button>
                    )}
                    
                    {deployments?.length > 1 && (
                         <button 
                            onClick={handleDeleteAll}
                            disabled={isDeleting}
                            className="text-red-600 hover:bg-red-50 border border-red-200 hover:border-red-300 px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-colors"
                         >
                            <AlertTriangle size={14} />
                            {t('delete_all_history')}
                         </button>
                    )}
                </div>
            </div>
            
            {deployments?.length > 0 && (
                <div className="px-4 py-2 bg-gray-50/50 border-b border-gray-100 flex items-center gap-4">
                    <input 
                        type="checkbox" 
                        onChange={handleSelectAll}
                        checked={selectedIds.size > 0 && selectedIds.size >= deployments.length}
                        className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-50 cursor-pointer"
                    />
                    <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{t('actions')}</span>
                </div>
            )}

            <div className="max-h-[600px] overflow-y-auto">
                {Array.isArray(deployments) && deployments.length > 0 ? (
                    deployments.map(dep => {
                        const isProduction = dep.aliases && dep.aliases.length > 0; 
                        return (
                            <DeploymentItem 
                                key={dep.id} 
                                deployment={dep} 
                                isSelected={selectedIds.has(dep.id)}
                                onToggle={handleToggle}
                                isProduction={isProduction}
                            />
                        );
                    })
                ) : (
                    <div className="p-12 text-center text-gray-500 flex flex-col items-center gap-2">
                        <Clock size={32} className="text-gray-300" />
                        <p>{t('no_history')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DeploymentList;