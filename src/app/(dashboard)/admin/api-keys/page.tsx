'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Key, Shield, Clock, Activity, Check, X, Copy, AlertCircle } from 'lucide-react';
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
    email: string;
  };
  expiresAt: string;
  lastUsedAt?: string;
  usageCount: number;
  isActive: boolean;
  metadata?: {
    lastUsedBy?: string;
    lastQuery?: string;
    ipAddress?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface Statistics {
  totalKeys: number;
  activeKeys: number;
  totalUsage: number;
  expiredKeys: number;
}

export default function AdminApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    fetchApiKeys();
  }, [filter]);

  const fetchApiKeys = async () => {
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') {
        params.append('isActive', filter === 'active' ? 'true' : 'false');
      }

      const response = await fetch(`/api/admin/api-keys?${params}`);
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data.data.apiKeys || []);
        setStatistics(data.data.statistics);
      }
    } catch (error) {
      toast.error('Failed to fetch API keys');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
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
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
          API Keys Administration
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Monitor and manage all API keys across teams
        </p>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Key className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Total Keys</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {statistics.totalKeys}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Active Keys</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {statistics.activeKeys}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Activity className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Total Usage</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {statistics.totalUsage.toLocaleString()}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Clock className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Expired Keys</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {statistics.expiredKeys}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex gap-3">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          All Keys
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'active'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          Active
        </button>
        <button
          onClick={() => setFilter('inactive')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'inactive'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          Inactive
        </button>
      </div>

      {/* API Keys Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Key / Team
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Created By
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Usage
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Last Used
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Expires
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {apiKeys.map((apiKey, index) => (
                <motion.tr
                  key={apiKey._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <td className="px-6 py-4">
                    <div>
                      <code className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-xs font-mono rounded inline-block mb-2">
                        {apiKey.keyPrefix}***
                      </code>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {apiKey.name}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Team: {apiKey.teamId.name}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-900 dark:text-white">
                      {apiKey.createdBy.name}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {apiKey.createdBy.email}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      {apiKey.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium rounded">
                          <Check className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-medium rounded">
                          <X className="w-3 h-3" />
                          Revoked
                        </span>
                      )}
                      {isExpired(apiKey.expiresAt) && apiKey.isActive && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-medium rounded">
                          <AlertCircle className="w-3 h-3" />
                          Expired
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {apiKey.usageCount.toLocaleString()} calls
                    </p>
                    {apiKey.metadata?.lastQuery && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-[200px]" title={apiKey.metadata.lastQuery}>
                        Last: {apiKey.metadata.lastQuery}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {apiKey.lastUsedAt ? (
                      <div>
                        <p className="text-sm text-slate-900 dark:text-white">
                          {formatDistanceToNow(new Date(apiKey.lastUsedAt), { addSuffix: true })}
                        </p>
                        {apiKey.metadata?.ipAddress && (
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            IP: {apiKey.metadata.ipAddress}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        Never used
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-900 dark:text-white">
                      {formatDistanceToNow(new Date(apiKey.expiresAt), { addSuffix: true })}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {new Date(apiKey.expiresAt).toLocaleDateString()}
                    </p>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {apiKeys.length === 0 && (
          <div className="text-center py-12">
            <Key className="w-12 h-12 mx-auto text-slate-400 mb-3" />
            <p className="text-slate-600 dark:text-slate-400">
              No API keys found
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
