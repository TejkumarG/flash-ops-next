'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Database, Trash2, Plug, CheckCircle, XCircle, Loader2, MoreVertical, Edit2 } from 'lucide-react';
import { toast } from 'sonner';

interface Connection {
  _id: string;
  name: string;
  connectionType: string;
  host: string;
  port: number;
  username: string;
  createdAt: string;
  createdBy?: {
    name: string;
    email: string;
  };
}

/**
 * Premium connections management page
 */
export default function ConnectionsPage() {
  const { data: session } = useSession();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    connectionType: 'mssql',
    host: '',
    port: 1433,
    username: '',
    password: '',
  });

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      const response = await fetch('/api/connections');
      if (response.ok) {
        const data = await response.json();
        setConnections(data.data || []);
      }
    } catch (error) {
      toast.error('Failed to fetch connections');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!formData.host || !formData.username || !formData.password) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsTesting(true);
    try {
      const response = await fetch('/api/connections/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || 'Connection test successful!');
      } else {
        toast.error(data.error || 'Connection test failed');
      }
    } catch (error) {
      toast.error('Failed to test connection');
    } finally {
      setIsTesting(false);
    }
  };

  const handleEdit = (connection: Connection) => {
    setEditingConnection(connection);
    setFormData({
      name: connection.name,
      connectionType: connection.connectionType,
      host: connection.host,
      port: connection.port,
      username: connection.username,
      password: '', // Don't pre-fill password for security
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = editingConnection
        ? `/api/connections/${editingConnection._id}`
        : '/api/connections';
      const method = editingConnection ? 'PUT' : 'POST';

      // Only include password if it's provided
      const payload: any = {
        name: formData.name,
        connectionType: formData.connectionType,
        host: formData.host,
        port: formData.port,
        username: formData.username,
      };

      // Include password if it's provided (required for new, optional for edit)
      if (formData.password) {
        payload.password = formData.password;
      } else if (!editingConnection) {
        toast.error('Password is required for new connections');
        setIsSubmitting(false);
        return;
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || `Connection ${editingConnection ? 'updated' : 'created'} successfully!`);
        setShowForm(false);
        setEditingConnection(null);
        setFormData({
          name: '',
          connectionType: 'mssql',
          host: '',
          port: 1433,
          username: '',
          password: '',
        });
        fetchConnections();
      } else {
        toast.error(data.error || `Failed to ${editingConnection ? 'update' : 'create'} connection`);
      }
    } catch (error) {
      toast.error(`Failed to ${editingConnection ? 'update' : 'create'} connection`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure? This will delete the connection and all associated databases.')) {
      return;
    }

    try {
      const response = await fetch(`/api/connections/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Connection deleted successfully');
        fetchConnections();
      } else {
        toast.error('Failed to delete connection');
      }
    } catch (error) {
      toast.error('Failed to delete connection');
    }
  };

  const handlePortChange = (type: string) => {
    const defaultPorts: Record<string, number> = {
      mysql: 3306,
      postgresql: 5432,
      mongodb: 27017,
      mssql: 1433,
    };
    setFormData({ ...formData, connectionType: type, port: defaultPorts[type] || 5432 });
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
            Connections
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Manage your database connections
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            setEditingConnection(null);
            setFormData({
              name: '',
              connectionType: 'mssql',
              host: '',
              port: 1433,
              username: '',
              password: '',
            });
            setShowForm(!showForm);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/25 transition-all"
        >
          <Plus className="w-5 h-5" />
          Add Connection
        </motion.button>
      </div>

      {/* Connection Form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg"
        >
          <h2 className="text-xl font-semibold mb-6 text-slate-900 dark:text-white">
            {editingConnection ? 'Edit Connection' : 'New Connection'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Connection Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="My Production DB"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Database Type
                </label>
                <select
                  value={formData.connectionType}
                  onChange={(e) => handlePortChange(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="mssql">SQL Server</option>
                  <option value="postgresql">PostgreSQL</option>
                  <option value="mysql">MySQL</option>
                  <option value="mongodb">MongoDB</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Host
                </label>
                <input
                  type="text"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="localhost or db.example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Port
                </label>
                <input
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Password {editingConnection && <span className="text-slate-500">(leave blank to keep current)</span>}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required={!editingConnection}
                  placeholder={editingConnection ? '••••••••' : ''}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Plug className="w-4 h-4" />
                    Test Connection
                  </>
                )}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold disabled:opacity-50 transition-all"
              >
                {isSubmitting
                  ? (editingConnection ? 'Updating...' : 'Creating...')
                  : (editingConnection ? 'Update Connection' : 'Create Connection')
                }
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingConnection(null);
                }}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Connections List */}
      {connections.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <Database className="w-16 h-16 mx-auto text-slate-400 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            No connections yet
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Add your first database connection to get started
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {connections.map((connection, index) => (
            <motion.div
              key={connection._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="relative p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all shadow-sm hover:shadow-lg group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                  <Database className="w-6 h-6 text-white" />
                </div>
                <div className="relative">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === connection._id ? null : connection._id);
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </motion.button>

                  <AnimatePresence>
                    {openMenuId === connection._id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setOpenMenuId(null)}
                        />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          transition={{ duration: 0.1 }}
                          className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-200 py-1 z-20 overflow-hidden"
                        >
                          <button
                            onClick={() => {
                              handleEdit(connection);
                              setOpenMenuId(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                            <span className="font-medium">Edit Connection</span>
                          </button>
                          <div className="h-px bg-gray-100 my-1" />
                          <button
                            onClick={() => {
                              handleDelete(connection._id);
                              setOpenMenuId(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="font-medium">Delete Connection</span>
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                {connection.name}
              </h3>
              <div className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                <p className="flex items-center gap-2">
                  <span className="font-medium uppercase text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                    {connection.connectionType}
                  </span>
                </p>
                <p>{connection.host}:{connection.port}</p>
                <p className="text-xs">User: {connection.username}</p>
              </div>

              {connection.createdBy && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  Created by {connection.createdBy.name}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
