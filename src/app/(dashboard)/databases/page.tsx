'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Database as DatabaseIcon, Trash2, Loader2, CheckCircle, XCircle, AlertCircle, RefreshCw, Plug, Shield, X, MoreVertical, Edit2, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface Database {
  _id: string;
  databaseName: string;
  displayName?: string;
  enabled: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'error';
  syncStatus: 'synced' | 'yet_to_sync' | 'syncing' | 'error';
  syncLastAt?: string;
  lastConnectionTest?: string;
  connectionId: {
    _id: string;
    name: string;
    connectionType: string;
    host: string;
    port: number;
  };
  createdBy?: {
    name: string;
  };
}

interface Connection {
  _id: string;
  name: string;
  connectionType: string;
}

interface Team {
  _id: string;
  name: string;
  memberCount?: number;
}

interface User {
  _id: string;
  name: string;
  email: string;
}

interface AccessRecord {
  id: string;
  databaseId: any;
  accessType: 'team' | 'individual';
  teamId?: Team;
  userId?: User;
}

/**
 * Premium databases management page
 */
export default function DatabasesPage() {
  const router = useRouter();
  const [databases, setDatabases] = useState<Database[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingDatabases, setIsFetchingDatabases] = useState(false);
  const [availableDatabases, setAvailableDatabases] = useState<any[]>([]);
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set());
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [editingDatabase, setEditingDatabase] = useState<Database | null>(null);
  const [formData, setFormData] = useState({
    connectionId: '',
    databaseName: '',
    displayName: '',
  });

  // Access management state
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [selectedDatabase, setSelectedDatabase] = useState<Database | null>(null);
  const [accessRecords, setAccessRecords] = useState<AccessRecord[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingAccess, setIsLoadingAccess] = useState(false);
  const [accessForm, setAccessForm] = useState({
    accessType: 'team' as 'team' | 'individual',
    selectedIds: [] as string[],
  });

  useEffect(() => {
    fetchDatabases();
    fetchConnections();

    // Refetch databases when window gains focus (e.g., navigating back from another page)
    const handleFocus = () => {
      fetchDatabases();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        fetchDatabases();
      }
    });

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const fetchDatabases = async () => {
    try {
      const response = await fetch('/api/databases');
      if (response.ok) {
        const result = await response.json();
        setDatabases(result.data?.databases || []);
      }
    } catch (error) {
      toast.error('Failed to fetch databases');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchConnections = async () => {
    try {
      const response = await fetch('/api/connections');
      if (response.ok) {
        const data = await response.json();
        setConnections(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch connections:', error);
    }
  };

  const fetchAvailableDatabases = async (connectionId: string) => {
    if (!connectionId) return;

    setIsFetchingDatabases(true);
    try {
      const response = await fetch(`/api/connections/${connectionId}/databases`);
      if (response.ok) {
        const data = await response.json();
        setAvailableDatabases(data.data.databases || []);
      } else {
        toast.error('Failed to fetch databases from connection');
      }
    } catch (error) {
      toast.error('Failed to fetch databases');
    } finally {
      setIsFetchingDatabases(false);
    }
  };

  const handleConnectionChange = (connectionId: string) => {
    setFormData({ ...formData, connectionId, databaseName: '', displayName: '' });
    fetchAvailableDatabases(connectionId);
  };

  const handleEdit = (database: Database) => {
    setEditingDatabase(database);
    setFormData({
      connectionId: database.connectionId._id,
      databaseName: database.databaseName,
      displayName: database.displayName || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = editingDatabase
        ? `/api/databases/${editingDatabase._id}`
        : '/api/databases';
      const method = editingDatabase ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || `Database ${editingDatabase ? 'updated' : 'added'} successfully!`);
        setShowForm(false);
        setEditingDatabase(null);
        setFormData({ connectionId: '', databaseName: '', displayName: '' });
        setAvailableDatabases([]);
        fetchDatabases();
      } else {
        toast.error(data.error || `Failed to ${editingDatabase ? 'update' : 'add'} database`);
      }
    } catch (error) {
      toast.error(`Failed to ${editingDatabase ? 'update' : 'add'} database`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTest = async (databaseId: string) => {
    setTestingIds(prev => new Set(prev).add(databaseId));

    try {
      const response = await fetch('/api/databases/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ databaseId }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || 'Connection test successful!');
        fetchDatabases();
      } else {
        toast.error(data.error || 'Connection test failed');
      }
    } catch (error) {
      toast.error('Failed to test connection');
    } finally {
      setTestingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(databaseId);
        return newSet;
      });
    }
  };

  const handleSync = async (databaseId: string, forceRegenerate: boolean = false) => {
    setSyncingIds(prev => new Set(prev).add(databaseId));

    try {
      const response = await fetch('/api/databases/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          databaseId,
          forceRegenerate
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const message = forceRegenerate
          ? 'Force re-sync completed successfully!'
          : data.message || 'Sync started successfully!';
        toast.success(message);
        fetchDatabases();
        // Poll for updates
        const interval = setInterval(() => {
          fetchDatabases();
        }, 2000);
        setTimeout(() => clearInterval(interval), 10000);
      } else {
        toast.error(data.error || 'Sync failed');
      }
    } catch (error) {
      toast.error('Failed to sync database');
    } finally {
      setSyncingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(databaseId);
        return newSet;
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this database?')) {
      return;
    }

    try {
      const response = await fetch(`/api/databases/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Database deleted successfully');
        fetchDatabases();
      } else {
        toast.error('Failed to delete database');
      }
    } catch (error) {
      toast.error('Failed to delete database');
    }
  };

  // Access Management Functions
  const handleManageAccess = async (database: Database) => {
    setSelectedDatabase(database);
    setShowAccessModal(true);
    setIsLoadingAccess(true);
    setAccessForm({ accessType: 'team', selectedIds: [] });

    try {
      // Fetch access records for this database
      const [accessRes, teamsRes, usersRes] = await Promise.all([
        fetch(`/api/access?databaseId=${database._id}`),
        fetch('/api/teams'),
        fetch('/api/users'),
      ]);

      if (accessRes.ok) {
        const accessData = await accessRes.json();
        setAccessRecords(accessData.data.access || []);
      }

      if (teamsRes.ok) {
        const teamsData = await teamsRes.json();
        // Map id to _id to match Team interface
        const mappedTeams = (teamsData.data.teams || []).map((team: any) => ({
          _id: String(team.id),
          name: team.name,
          memberCount: team.memberCount,
        }));
        setTeams(mappedTeams);
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        // Map id to _id to match User interface
        const mappedUsers = (usersData.data.users || []).map((user: any) => ({
          _id: String(user.id),
          name: user.name,
          email: user.email,
        }));
        setUsers(mappedUsers);
      }
    } catch (error) {
      console.error('Error fetching access data:', error);
      toast.error('Failed to load access information');
    } finally {
      setIsLoadingAccess(false);
    }
  };

  const handleGrantAccess = async () => {
    if (!selectedDatabase || accessForm.selectedIds.length === 0) {
      toast.error('Please select at least one team or user');
      return;
    }

    const payload = {
      databaseIds: [selectedDatabase._id],
      accessType: accessForm.accessType,
      ...(accessForm.accessType === 'team'
        ? { teamId: accessForm.selectedIds[0] }
        : { userId: accessForm.selectedIds[0] }
      ),
    };

    console.log('Granting access with payload:', payload);

    try {
      const response = await fetch('/api/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Access granted successfully');
        setAccessForm({ accessType: 'team', selectedIds: [] });
        // Refresh access records
        if (selectedDatabase) {
          handleManageAccess(selectedDatabase);
        }
      } else {
        toast.error(data.message || 'Failed to grant access');
      }
    } catch (error) {
      console.error('Error granting access:', error);
      toast.error('Failed to grant access');
    }
  };

  const handleRevokeAccess = async (accessId: string) => {
    if (!confirm('Are you sure you want to revoke this access?')) {
      return;
    }

    try {
      const response = await fetch(`/api/access/${accessId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Access revoked successfully');
        // Refresh access records
        if (selectedDatabase) {
          handleManageAccess(selectedDatabase);
        }
      } else {
        toast.error(data.message || 'Failed to revoke access');
      }
    } catch (error) {
      console.error('Error revoking access:', error);
      toast.error('Failed to revoke access');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
      case 'synced':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'disconnected':
      case 'yet_to_sync':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'syncing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Databases
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Manage your database instances
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            setEditingDatabase(null);
            setFormData({ connectionId: '', databaseName: '', displayName: '' });
            setAvailableDatabases([]);
            setShowForm(!showForm);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/25 transition-all"
        >
          <Plus className="w-5 h-5" />
          Add Database
        </motion.button>
      </div>

      {/* Add Database Form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg"
        >
          <h2 className="text-xl font-semibold mb-6 text-slate-900 dark:text-white">
            {editingDatabase ? 'Edit Database' : 'Add Database'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Connection
              </label>
              <select
                value={formData.connectionId}
                onChange={(e) => handleConnectionChange(e.target.value)}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={!!editingDatabase}
              >
                <option value="">Select a connection</option>
                {connections.map((conn) => (
                  <option key={conn._id} value={conn._id}>
                    {conn.name} ({conn.connectionType})
                  </option>
                ))}
              </select>
              {editingDatabase && (
                <p className="mt-1 text-xs text-slate-500">Connection cannot be changed when editing</p>
              )}
            </div>

            {formData.connectionId && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Database Name
                    {isFetchingDatabases && (
                      <span className="ml-2 text-xs text-blue-500">
                        <Loader2 className="inline w-3 h-3 animate-spin mr-1" />
                        Fetching...
                      </span>
                    )}
                  </label>
                  {editingDatabase ? (
                    <>
                      <input
                        type="text"
                        value={formData.databaseName}
                        className="w-full px-4 py-2.5 bg-gray-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-gray-600 dark:text-gray-400"
                        disabled
                      />
                      <p className="mt-1 text-xs text-slate-500">Database name cannot be changed when editing</p>
                    </>
                  ) : availableDatabases.length > 0 ? (
                    <select
                      value={formData.databaseName}
                      onChange={(e) => setFormData({ ...formData, databaseName: e.target.value, displayName: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select a database</option>
                      {availableDatabases.map((db) => (
                        <option key={db.name} value={db.name}>
                          {db.displayName || db.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData.databaseName}
                      onChange={(e) => setFormData({ ...formData, databaseName: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="database_name"
                      required
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Display Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Friendly name"
                  />
                </div>
              </>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold disabled:opacity-50 transition-all"
              >
                {isSubmitting
                  ? (editingDatabase ? 'Updating...' : 'Adding...')
                  : (editingDatabase ? 'Update Database' : 'Add Database')
                }
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingDatabase(null);
                  setFormData({ connectionId: '', databaseName: '', displayName: '' });
                  setAvailableDatabases([]);
                }}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Databases List */}
      {databases.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <DatabaseIcon className="w-16 h-16 mx-auto text-slate-400 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            No databases yet
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Add databases from your connections to get started
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {databases.map((database, index) => (
            <motion.div
              key={database._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all shadow-sm hover:shadow-lg group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                      <DatabaseIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        {database.displayName || database.databaseName}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {database.connectionId.name} · {database.databaseName}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500 dark:text-slate-400">Connection:</span>
                      <span className="flex items-center gap-2">
                        {getStatusIcon(database.connectionStatus)}
                        <span className="text-sm font-medium capitalize text-slate-900 dark:text-white">
                          {database.connectionStatus}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500 dark:text-slate-400">Sync:</span>
                      <span className="flex items-center gap-2">
                        {getStatusIcon(database.syncStatus)}
                        <span className="text-sm font-medium capitalize text-slate-900 dark:text-white">
                          {database.syncStatus.replace('_', ' ')}
                        </span>
                      </span>
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {database.syncLastAt && (
                        <>Last synced: {new Date(database.syncLastAt).toLocaleDateString()}</>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTest(database._id)}
                      disabled={testingIds.has(database._id)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {testingIds.has(database._id) ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <Plug className="w-4 h-4" />
                          Test
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleSync(database._id, false)}
                      disabled={
                        database.connectionStatus !== 'connected' ||
                        syncingIds.has(database._id) ||
                        database.syncStatus === 'syncing' ||
                        database.syncStatus === 'synced'
                      }
                      className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      title="Incremental sync - only updates if needed"
                    >
                      {syncingIds.has(database._id) || database.syncStatus === 'syncing' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          Sync
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Force re-sync will regenerate all embeddings. This may take longer. Continue?')) {
                          handleSync(database._id, true);
                        }
                      }}
                      disabled={syncingIds.has(database._id) || database.syncStatus === 'syncing'}
                      className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      title="Force re-sync - regenerate all embeddings"
                    >
                      {syncingIds.has(database._id) || database.syncStatus === 'syncing' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Re-syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          Force Re-sync
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleManageAccess(database)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Shield className="w-4 h-4" />
                      Manage Access
                    </button>
                    <button
                      onClick={() => router.push(`/databases/${database._id}/vectors`)}
                      disabled={database.syncStatus !== 'synced'}
                      className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 dark:bg-violet-900/20 hover:bg-violet-100 dark:hover:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      title={database.syncStatus !== 'synced' ? 'Sync the database first to view data' : 'View database schema and metadata'}
                    >
                      <Eye className="w-4 h-4" />
                      View Data
                    </button>
                  </div>
                </div>

                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      setMenuPosition({
                        top: rect.bottom + 8,
                        left: rect.right - 192, // 192 = w-48 (12rem)
                      });
                      setOpenMenuId(openMenuId === database._id ? null : database._id);
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-all"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </motion.button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Access Management Modal */}
      <AnimatePresence>
        {showAccessModal && selectedDatabase && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setShowAccessModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Manage Access
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {selectedDatabase.displayName || selectedDatabase.databaseName}
                  </p>
                </div>
                <button
                  onClick={() => setShowAccessModal(false)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {isLoadingAccess ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : (
                <>
                  {/* Current Access */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                      Current Access
                    </h3>
                    {accessRecords.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
                        No access granted yet
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {accessRecords.map((record) => (
                          <div
                            key={record.id}
                            className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`px-2 py-1 rounded text-xs font-medium ${
                                record.accessType === 'team'
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                  : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                              }`}>
                                {record.accessType}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-slate-900 dark:text-white">
                                  {record.accessType === 'team'
                                    ? record.teamId?.name
                                    : record.userId?.name
                                  }
                                </p>
                                {record.accessType === 'individual' && record.userId && (
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {record.userId.email}
                                  </p>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handleRevokeAccess(record.id)}
                              className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Grant New Access */}
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                      Grant New Access
                    </h3>
                    <div className="space-y-4">
                      {/* Access Type Selector */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          Access Type
                        </label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setAccessForm({ accessType: 'team', selectedIds: [] })}
                            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                              accessForm.accessType === 'team'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            Team
                          </button>
                          <button
                            onClick={() => setAccessForm({ accessType: 'individual', selectedIds: [] })}
                            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                              accessForm.accessType === 'individual'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            Individual User
                          </button>
                        </div>
                      </div>

                      {/* Team/User Selector */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          {accessForm.accessType === 'team' ? 'Select Team' : 'Select User'}
                        </label>
                        <select
                          value={accessForm.selectedIds[0] || ''}
                          onChange={(e) => setAccessForm({ ...accessForm, selectedIds: [e.target.value] })}
                          className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">
                            {accessForm.accessType === 'team' ? 'Select a team' : 'Select a user'}
                          </option>
                          {accessForm.accessType === 'team'
                            ? teams.map((team) => (
                                <option key={team._id} value={team._id}>
                                  {team.name} {team.memberCount ? `(${team.memberCount} members)` : ''}
                                </option>
                              ))
                            : users.map((user) => (
                                <option key={user._id} value={user._id}>
                                  {user.name} ({user.email})
                                </option>
                              ))
                          }
                        </select>
                      </div>

                      <button
                        onClick={handleGrantAccess}
                        disabled={accessForm.selectedIds.length === 0}
                        className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        Grant Access
                      </button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dropdown Menu - Fixed position */}
      <AnimatePresence>
        {openMenuId && menuPosition && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => {
                setOpenMenuId(null);
                setMenuPosition(null);
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.1 }}
              className="fixed w-48 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 py-1 z-50"
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
              }}
            >
              <button
                onClick={() => {
                  const db = databases.find(d => d._id === openMenuId);
                  if (db) handleEdit(db);
                  setOpenMenuId(null);
                  setMenuPosition(null);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                <span className="font-medium">Edit Database</span>
              </button>
              <div className="h-px bg-gray-100 dark:bg-slate-700 my-1" />
              <button
                onClick={() => {
                  if (openMenuId) handleDelete(openMenuId);
                  setOpenMenuId(null);
                  setMenuPosition(null);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span className="font-medium">Delete Database</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
