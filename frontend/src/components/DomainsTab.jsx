import React, { useState, useEffect } from 'react';
import { Globe, Plus, Trash2, Loader2, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const DomainsTab = ({ project, csrfToken }) => {
    const { t } = useTranslation();
    const [domains, setDomains] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newDomain, setNewDomain] = useState('');
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        fetchDomains();
    }, [project]);

    const fetchDomains = async () => {
        try {
            const res = await fetch(`/api/projects/${project.name}/domains`);
            if (res.ok) setDomains(await res.json());
        } catch (e) { console.error(e); } 
        finally { setLoading(false); }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newDomain) return;
        setAdding(true);
        try {
            const res = await fetch(`/api/projects/${project.name}/domains`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify({ name: newDomain })
            });
            if (res.ok) {
                setNewDomain('');
                fetchDomains();
            }
        } catch (e) { alert(t('error_add_domain')); }
        finally { setAdding(false); }
    };

    const handleDelete = async (domainName) => {
        if (!confirm(t('confirm_delete_domain', { domain: domainName }))) return;
        try {
            await fetch(`/api/projects/${project.name}/domains/${domainName}`, { 
                method: 'DELETE',
                headers: { 'CSRF-Token': csrfToken }
            });
            setDomains(domains.filter(d => d.name !== domainName));
        } catch (e) { alert(t('error_delete_domain')); }
    };

    if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-orange-500" /></div>;

    return (
        <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                        <Globe size={18} /> {t('domains_title')}
                    </h3>
                </div>
                
                <div className="divide-y divide-gray-100">
                    {domains.map(dom => (
                        <div key={dom.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                            <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${dom.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                <span className="font-mono text-sm text-gray-700">{dom.name}</span>
                                <a href={`https://${dom.name}`} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-orange-600">
                                    <ExternalLink size={14} />
                                </a>
                            </div>
                            <button onClick={() => handleDelete(dom.name)} className="text-gray-400 hover:text-red-600 p-2">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                    {domains.length === 0 && <p className="p-6 text-center text-sm text-gray-500">{t('no_domains')}</p>}
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-200">
                    <form onSubmit={handleAdd} className="flex gap-2">
                        <input 
                            type="text" 
                            value={newDomain}
                            onChange={(e) => setNewDomain(e.target.value)}
                            placeholder={t('domain_placeholder')}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                        />
                        <button 
                            type="submit" 
                            disabled={adding || !newDomain}
                            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                        >
                            {adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                            {t('add')}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default DomainsTab;
