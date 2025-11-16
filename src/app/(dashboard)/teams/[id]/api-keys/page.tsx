'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Key, Trash2, Copy, Check, X, Eye, EyeOff, AlertCircle, ChevronRight, Users, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface ApiKey {
  _id: string;
  keyPrefix: string;
  name: string;
  teamId: {
    _id: string;
    name: string;
  };
  createdBy: {
    _id: string;
    name: string;
  };
  expiresAt: string;
  lastUsedAt?: string;
  usageCount: number;
  isActive: boolean;
  createdAt: string;
}

interface Team {
  _id: string;
  name: string;
  description?: string;
}

export default function TeamApiKeysPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.id as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newApiKey, setNewApiKey] = useState<{key: string; details: ApiKey} | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    expiresInDays: 90,
  });

  useEffect(() => {
    fetchTeam();
    fetchApiKeys();
  }, [teamId]);

  const fetchTeam = async () => {
    try {
      const response = await fetch(`/api/teams/${teamId}`);
      if (response.ok) {
        const data = await response.json();
        setTeam(data.data.team || data.team);
      }
    } catch (error) {
      console.error('Failed to fetch team:', error);
    }
  };

  const fetchApiKeys = async () => {
    try {
      const response = await fetch(`/api/teams/${teamId}/api-keys`);
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data.data.apiKeys || []);
      }
    } catch (error) {
      toast.error('Failed to fetch API keys');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch(`/api/teams/${teamId}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('API Response:', data);
        console.log('Full API Key:', data.data.apiKey.fullKey);

        setNewApiKey({
          key: data.data.apiKey.fullKey,
          details: data.data.apiKey,
        });
        toast.success('API key created successfully!');
        setShowCreateModal(false);
        setFormData({ name: '', expiresInDays: 90 });
        fetchApiKeys();
      } else {
        toast.error(data.error || data.message || 'Failed to create API key');
      }
    } catch (error) {
      console.error('Create API key error:', error);
      toast.error('Failed to create API key');
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/teams/${teamId}/api-keys/${keyId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('API key revoked successfully');
        fetchApiKeys();
      } else {
        toast.error('Failed to revoke API key');
      }
    } catch (error) {
      toast.error('Failed to revoke API key');
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/teams" className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Teams
        </Link>
        <ChevronRight className="w-4 h-4 text-slate-400" />
        {team ? (
          <>
            <span className="text-slate-600 dark:text-slate-400">{team.name}</span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </>
        ) : (
          <>
            <span className="text-slate-400">Loading...</span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </>
        )}
        <span className="text-slate-900 dark:text-white font-medium">API Keys</span>
      </div>

      {/* Back Button */}
      <motion.button
        whileHover={{ x: -4 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => router.push('/teams')}
        className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm font-medium">Back to Teams</span>
      </motion.button>

      {/* Team Info Card */}
      {team && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
                <Users className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                  {team.name}
                </h2>
                <p className="text-slate-600 dark:text-slate-400">
                  Manage API keys for programmatic access to this team's resources
                </p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/25 transition-all"
            >
              <Plus className="w-5 h-5" />
              Generate API Key
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Stats Row */}
      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Key className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Total Keys</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{apiKeys.length}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Active Keys</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {apiKeys.filter(k => k.isActive && !isExpired(k.expiresAt)).length}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Total Usage</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {apiKeys.reduce((acc, k) => acc + k.usageCount, 0).toLocaleString()}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* API Keys List */}
      <div className="space-y-4">
        {apiKeys.map((apiKey, index) => (
          <motion.div
            key={apiKey._id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                    <Key className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      {apiKey.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-sm font-mono rounded">
                        {apiKey.keyPrefix}***
                      </code>
                      <button
                        onClick={() => copyToClipboard(apiKey.keyPrefix)}
                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                        title="Copy prefix"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Status</p>
                    {apiKey.isActive && !isExpired(apiKey.expiresAt) ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium rounded">
                        <Check className="w-3 h-3" />
                        Active
                      </span>
                    ) : isExpired(apiKey.expiresAt) ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-medium rounded">
                        <AlertCircle className="w-3 h-3" />
                        Expired
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-medium rounded">
                        <X className="w-3 h-3" />
                        Revoked
                      </span>
                    )}
                  </div>

                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Usage</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {apiKey.usageCount.toLocaleString()} calls
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Last Used</p>
                    <p className="text-sm text-slate-900 dark:text-white">
                      {apiKey.lastUsedAt
                        ? formatDistanceToNow(new Date(apiKey.lastUsedAt), { addSuffix: true })
                        : 'Never'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Expires</p>
                    <p className="text-sm text-slate-900 dark:text-white">
                      {formatDistanceToNow(new Date(apiKey.expiresAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleRevoke(apiKey._id)}
                disabled={!apiKey.isActive}
                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Revoke API key"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        ))}

        {apiKeys.length === 0 && (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <Key className="w-16 h-16 mx-auto text-slate-400 mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              No API keys yet
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Generate an API key to access the query API programmatically
            </p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                Generate New API Key
              </h2>
              {team && (
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  This key will be created for team: <span className="font-semibold text-blue-600 dark:text-blue-400">{team.name}</span>
                </p>
              )}

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Key Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Production API Key"
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Expires In
                  </label>
                  <select
                    value={formData.expiresInDays}
                    onChange={(e) => setFormData({ ...formData, expiresInDays: parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={30}>30 days</option>
                    <option value={90}>90 days</option>
                    <option value={180}>180 days</option>
                    <option value={365}>1 year</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold"
                  >
                    Generate Key
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New API Key Modal */}
      <AnimatePresence>
        {newApiKey && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-2xl w-full border border-slate-200 dark:border-slate-800"
            >
              <div className="mb-6">
                <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                  <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                  API Key Created Successfully!
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Please copy and save this API key securely. For security reasons, it will not be shown again.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Your API Key:
                  </label>
                  <button
                    onClick={async () => {
                      console.log('Copying key:', newApiKey.key);
                      console.log('Key length:', newApiKey.key?.length);
                      await copyToClipboard(newApiKey.key);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Key
                  </button>
                </div>
                <code className="block p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-sm break-all select-all">
                  {newApiKey.key}
                </code>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Key length: {newApiKey.key?.length || 0} characters
                </p>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 mb-6">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200 mb-1">
                      Important Security Notice
                    </p>
                    <p className="text-sm text-yellow-800 dark:text-yellow-300">
                      Store this key securely (e.g., in environment variables or a secrets manager).
                      Anyone with this key can access your resources.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setNewApiKey(null)}
                className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium"
              >
                I've Saved the Key
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
