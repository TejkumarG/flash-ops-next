'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  Search,
  Save,
  X,
  Check,
  Loader2,
  AlertCircle,
  Table as TableIcon,
  Filter,
  RefreshCw,
  Download,
  Edit2,
  Ban,
} from 'lucide-react';
import { toast } from 'sonner';

interface VectorData {
  id: string;
  table_name: string;
  description: string;
  metadata?: {
    fullText?: string;
    tableLine?: string;
    descriptionLine?: string;
    columnsLine?: string;
  };
  needs_sync?: boolean;
  skipped?: boolean;
}

interface DatabaseInfo {
  _id: string;
  name: string;
  description?: string;
  syncStatus?: string;
}

interface TableSkipStatus {
  [tableName: string]: boolean;
}

export default function VectorsPage() {
  const params = useParams();
  const router = useRouter();
  const databaseId = params.id as string;

  const [database, setDatabase] = useState<DatabaseInfo | null>(null);
  const [vectors, setVectors] = useState<VectorData[]>([]);
  const [filteredVectors, setFilteredVectors] = useState<VectorData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTable, setSelectedTable] = useState<string>('all');
  const [tables, setTables] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedDescriptions, setEditedDescriptions] = useState<{ [key: string]: string }>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [tableSkipStatus, setTableSkipStatus] = useState<TableSkipStatus>({});
  const [togglingTables, setTogglingTables] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchDatabase();
    fetchVectorData();
  }, [databaseId]);

  useEffect(() => {
    // Filter vectors based on search and table selection
    let filtered = vectors;

    if (searchQuery) {
      filtered = filtered.filter(
        (v) =>
          v.table_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedTable !== 'all') {
      filtered = filtered.filter((v) => v.table_name === selectedTable);
    }

    // Sort vectors: skipped tables first, then active tables
    filtered = filtered.sort((a, b) => {
      const aSkipped = tableSkipStatus[a.table_name] || false;
      const bSkipped = tableSkipStatus[b.table_name] || false;
      // Sort skipped (true) before active (false)
      if (aSkipped && !bSkipped) return -1;
      if (!aSkipped && bSkipped) return 1;
      // Within same skip status, keep original order
      return 0;
    });

    setFilteredVectors(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchQuery, selectedTable, vectors, tableSkipStatus]);

  const fetchDatabase = async () => {
    try {
      const response = await fetch(`/api/databases/${databaseId}`);
      if (response.ok) {
        const data = await response.json();
        setDatabase(data.data.database || data.database);
      }
    } catch (error) {
      console.error('Failed to fetch database:', error);
      toast.error('Failed to load database information');
    }
  };

  const fetchVectorData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/databases/${databaseId}/vectors?limit=5000`);
      const result = await response.json();

      console.log('Vector API Response:', result);
      console.log('Has data:', result.data?.hasData);
      console.log('Total vectors:', result.data?.total);
      console.log('Vectors count:', result.data?.vectors?.length);

      if (response.ok && result.success) {
        const vectorsData = result.data.vectors || [];
        setVectors(vectorsData);
        setFilteredVectors(vectorsData);
        setHasData(result.data.hasData);
        setTotal(result.data.total || 0);

        // Extract unique table names
        const uniqueTables = [...new Set(vectorsData.map((v: VectorData) => v.table_name))] as string[];
        setTables(uniqueTables);

        // Initialize skip status from actual vector data
        const skipStatus: TableSkipStatus = {};
        uniqueTables.forEach((table) => {
          const tableVector = vectorsData.find((v: VectorData) => v.table_name === table);
          skipStatus[table] = tableVector?.skipped || false;
        });
        setTableSkipStatus(skipStatus);

        if (!result.data.hasData) {
          toast.info(result.data.message || 'No vector data available');
        }
      } else {
        console.error('API error:', result);
        toast.error(result.message || 'Failed to fetch vector data');
        setHasData(false);
      }
    } catch (error) {
      console.error('Error fetching vectors:', error);
      toast.error('Failed to load vector data');
      setHasData(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditStart = (vector: VectorData) => {
    setEditingId(vector.id);
    setEditedDescriptions({
      ...editedDescriptions,
      [vector.id]: vector.description || '',
    });
  };

  const handleEditCancel = (vectorId: string) => {
    setEditingId(null);
    const newDescriptions = { ...editedDescriptions };
    delete newDescriptions[vectorId];
    setEditedDescriptions(newDescriptions);
  };

  const handleDescriptionChange = (vectorId: string, value: string) => {
    setEditedDescriptions({
      ...editedDescriptions,
      [vectorId]: value,
    });
  };

  const handleSaveDescription = async (vector: VectorData) => {
    const newDescription = editedDescriptions[vector.id];
    if (!newDescription || newDescription === vector.description) {
      setEditingId(null);
      return;
    }

    setSavingIds(new Set(savingIds).add(vector.id));

    try {
      const response = await fetch(`/api/databases/${databaseId}/vectors/${vector.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: newDescription,
          table_name: vector.table_name,
          database_id: databaseId
        }),
      });

      if (response.ok) {
        toast.success('Description updated successfully');

        // Update local state
        setVectors((prev) =>
          prev.map((v) =>
            v.id === vector.id
              ? { ...v, description: newDescription, needs_sync: true }
              : v
          )
        );
        setEditingId(null);

        // Remove from edited descriptions
        const newDescriptions = { ...editedDescriptions };
        delete newDescriptions[vector.id];
        setEditedDescriptions(newDescriptions);
      } else {
        const result = await response.json();
        toast.error(result.message || 'Failed to update description');
      }
    } catch (error) {
      console.error('Error updating description:', error);
      toast.error('Failed to update description');
    } finally {
      setSavingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(vector.id);
        return newSet;
      });
    }
  };

  const handleToggleTableSkip = async (tableName: string) => {
    setTogglingTables(new Set(togglingTables).add(tableName));

    const newSkipStatus = !tableSkipStatus[tableName];

    try {
      const encodedTableName = encodeURIComponent(tableName);
      const response = await fetch(`/api/databases/${databaseId}/vectors/tables/${encodedTableName}/skip`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skipped: newSkipStatus }),
      });

      if (response.ok) {
        toast.success(`Table ${newSkipStatus ? 'skipped' : 'unskipped'} successfully`);

        // Update table skip status
        setTableSkipStatus({
          ...tableSkipStatus,
          [tableName]: newSkipStatus,
        });

        // Update vectors state to reflect the change
        setVectors((prev) =>
          prev.map((v) =>
            v.table_name === tableName
              ? { ...v, skipped: newSkipStatus }
              : v
          )
        );
      } else {
        const result = await response.json();
        toast.error(result.message || 'Failed to update skip status');
      }
    } catch (error) {
      console.error('Error toggling skip status:', error);
      toast.error('Failed to update skip status');
    } finally {
      setTogglingTables((prev) => {
        const newSet = new Set(prev);
        newSet.delete(tableName);
        return newSet;
      });
    }
  };

  const exportToJSON = () => {
    const dataStr = JSON.stringify(filteredVectors, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${database?.name || 'database'}_vectors_${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Exported vector data');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Loading vector data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/databases"
          className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          Databases
        </Link>
        <ChevronRight className="w-4 h-4 text-slate-400" />
        <span className="text-slate-600 dark:text-slate-400">
          {database?.name || 'Database'}
        </span>
        <ChevronRight className="w-4 h-4 text-slate-400" />
        <span className="text-slate-900 dark:text-white font-medium">View Data</span>
      </div>

      {/* Back Button */}
      <motion.button
        whileHover={{ x: -4 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => router.push('/databases')}
        className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm font-medium">Back to Databases</span>
      </motion.button>

      {/* Database Info Card */}
      {database && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
                <Database className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                  {database.name} - View Data
                </h2>
                <p className="text-slate-600 dark:text-slate-400">
                  View and manage table embeddings, schemas, and metadata
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={fetchVectorData}
                disabled={isLoading}
                className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold transition-all"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={exportToJSON}
                disabled={!hasData || filteredVectors.length === 0}
                className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50"
              >
                <Download className="w-5 h-5" />
                Export Data
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats Row */}
      {hasData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <TableIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Total Tables</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{tables.length}</p>
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
              <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Ban className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Skipped</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {vectors.filter((v) => v.skipped).length}
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
              <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Needs Sync</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {vectors.filter((v) => v.needs_sync).length}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Filters Bar */}
      {hasData && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search tables, descriptions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* Table Filter */}
            <select
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">All Tables ({tables.length})</option>
              {tables.map((table) => (
                <option key={table} value={table}>
                  {table} ({vectors.filter((v) => v.table_name === table).length})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Vectors List */}
      <div className="space-y-4">
        {!hasData ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <AlertCircle className="w-16 h-16 mx-auto text-yellow-500 mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              No Vector Data Available
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              This database hasn't been synced yet. Please sync the database to generate embeddings.
            </p>
            <button
              onClick={() => router.push('/databases')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
            >
              Back to Databases
            </button>
          </div>
        ) : filteredVectors.length === 0 && (searchQuery || selectedTable !== 'all') ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <Search className="w-16 h-16 mx-auto text-slate-400 mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              No Results Found
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              No vectors match your current filters. Try adjusting your search or table selection.
            </p>
          </div>
        ) : (
          <>
            {/* Group by table */}
            {(() => {
              // Calculate pagination
              const startIndex = (currentPage - 1) * itemsPerPage;
              const endIndex = startIndex + itemsPerPage;
              const paginatedVectors = filteredVectors.slice(startIndex, endIndex);
              const totalPages = Math.ceil(filteredVectors.length / itemsPerPage);

              return (
                <>
                  {tables
                    .filter((table) => selectedTable === 'all' || table === selectedTable)
                    .map((table) => {
                      const tableVectors = paginatedVectors.filter((v) => v.table_name === table);
                      if (tableVectors.length === 0) return null;

                return (
                  <motion.div
                    key={table}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
                  >
                    {/* Table Header */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                          <TableIcon className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex items-center gap-2">
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                              {table}
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              Table Embedding
                            </p>
                          </div>
                          {tableSkipStatus[table] && (
                            <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-medium rounded">
                              Skipped
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleTableSkip(table)}
                        disabled={togglingTables.has(table)}
                        className="relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                        style={{
                          backgroundColor: !tableSkipStatus[table] ? '#22c55e' : '#94a3b8'
                        }}
                        title={tableSkipStatus[table] ? 'Skipped - Click to activate' : 'Active - Click to skip'}
                      >
                        {togglingTables.has(table) ? (
                          <span className="absolute left-1/2 -translate-x-1/2">
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                          </span>
                        ) : (
                          <span
                            className="inline-block w-4 h-4 transform bg-white rounded-full shadow-lg transition-transform"
                            style={{
                              transform: !tableSkipStatus[table] ? 'translateX(24px)' : 'translateX(4px)'
                            }}
                          />
                        )}
                      </button>
                    </div>

                    {/* Table Data */}
                    <div className="divide-y divide-slate-200 dark:divide-slate-700">
                      {tableVectors.map((vector) => (
                        <div key={vector.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <div className="flex items-start gap-4">
                            <div className="flex-1">
                              {editingId === vector.id ? (
                                <div className="space-y-2">
                                  <textarea
                                    value={editedDescriptions[vector.id] || ''}
                                    onChange={(e) => handleDescriptionChange(vector.id, e.target.value)}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-blue-500 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    rows={8}
                                    placeholder="Enter description..."
                                  />
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleSaveDescription(vector)}
                                      disabled={savingIds.has(vector.id)}
                                      className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                    >
                                      {savingIds.has(vector.id) ? (
                                        <>
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                          Saving...
                                        </>
                                      ) : (
                                        <>
                                          <Save className="w-4 h-4" />
                                          Save
                                        </>
                                      )}
                                    </button>
                                    <button
                                      onClick={() => handleEditCancel(vector.id)}
                                      disabled={savingIds.has(vector.id)}
                                      className="flex items-center gap-2 px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                    >
                                      <X className="w-4 h-4" />
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start justify-between gap-4">
                                  <p className="text-sm text-slate-600 dark:text-slate-300 flex-1">
                                    {vector.description || 'No description available'}
                                  </p>
                                  <button
                                    onClick={() => handleEditStart(vector)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-medium transition-colors"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                    Edit
                                  </button>
                                </div>
                              )}

                              {vector.metadata?.columnsLine && (
                                <div className="mt-3">
                                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                      Schema
                                    </p>
                                    <p className="text-xs text-slate-700 dark:text-slate-300 font-mono break-all">
                                      {vector.metadata.columnsLine}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                );
              })}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6 pb-4">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>

                  <div className="flex items-center gap-2">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                            currentPage === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Page Info */}
              {filteredVectors.length > 0 && (
                <div className="text-center text-sm text-slate-600 dark:text-slate-400 pb-4">
                  Showing {startIndex + 1}-{Math.min(endIndex, filteredVectors.length)} of {filteredVectors.length} vectors
                </div>
              )}
            </>
          );
        })()}
          </>
        )}
      </div>
    </div>
  );
}
