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
  Loader2,
  AlertCircle,
  Table as TableIcon,
  RefreshCw,
  Download,
  Edit2,
  Ban,
  ChevronDown,
  Code2,
  FileText,
  Check,
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
  const [isLoading, setIsLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tables, setTables] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedDescriptions, setEditedDescriptions] = useState<{ [key: string]: string }>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [tableSkipStatus, setTableSkipStatus] = useState<TableSkipStatus>({});
  const [togglingTables, setTogglingTables] = useState<Set<string>>(new Set());
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalVectors, setTotalVectors] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const itemsPerPage = 50;

  const totalPages = Math.ceil(totalVectors / itemsPerPage);

  useEffect(() => {
    fetchDatabase();
    fetchVectorData();
  }, [databaseId]);

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

  /**
   * Fetch vector data from API - NO PAGE RELOAD!
   * This function ONLY calls the API and updates React state
   * The page stays on the same route, no navigation happens
   */
  const fetchVectorData = async (page: number = 1, search: string = '') => {
    setIsLoading(true);
    try {
      // Calculate offset for pagination
      const offset = (page - 1) * itemsPerPage;
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';

      // API call ONLY - no page navigation
      const response = await fetch(`/api/databases/${databaseId}/vectors?limit=${itemsPerPage}&offset=${offset}${searchParam}`);
      const result = await response.json();

      if (response.ok && result.success) {
        const vectorsData = result.data.vectors || [];

        // Update state ONLY - no page reload
        setVectors(vectorsData);
        setHasData(result.data.hasData);
        setTotalVectors(result.data.total || 0);

        // Extract unique table names
        const uniqueTables = [...new Set(vectorsData.map((v: VectorData) => v.table_name))] as string[];
        setTables(uniqueTables);

        // Initialize skip status
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
        toast.error(result.message || 'Failed to fetch vector data');
        setHasData(false);
      }
    } catch (error) {
      console.error('Error fetching vectors:', error);
      toast.error('Failed to load vector data');
      setHasData(false);
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  };

  /**
   * Handle search - NO PAGE RELOAD!
   * Calls API and updates state only
   */
  const handleSearch = async () => {
    // Prevent any accidental form submission
    setIsSearching(true);
    setCurrentPage(1);

    // API call only - no navigation
    await fetchVectorData(1, searchQuery);
  };

  /**
   * Handle page change (Next/Previous/Page Number) - NO PAGE RELOAD!
   * This is CLIENT-SIDE ONLY pagination
   * Only calls API and updates React state
   * Zero page navigation or refresh
   */
  const handlePageChange = (newPage: number) => {
    // Update page number in state
    setCurrentPage(newPage);

    // Fetch new data via API - NO PAGE RELOAD
    fetchVectorData(newPage, searchQuery);

    // Smooth scroll to top (visual effect only)
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
        setVectors((prev) =>
          prev.map((v) =>
            v.id === vector.id
              ? { ...v, description: newDescription, needs_sync: true }
              : v
          )
        );
        setEditingId(null);
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
        setTableSkipStatus({
          ...tableSkipStatus,
          [tableName]: newSkipStatus,
        });
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

  const toggleSchema = (vectorId: string) => {
    setExpandedSchemas((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(vectorId)) {
        newSet.delete(vectorId);
      } else {
        newSet.add(vectorId);
      }
      return newSet;
    });
  };

  const exportToJSON = () => {
    const dataStr = JSON.stringify(vectors, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${database?.name || 'database'}_vectors_${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Exported vector data');
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  if (isLoading && currentPage === 1) {
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
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/databases" className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Databases
        </Link>
        <ChevronRight className="w-4 h-4 text-slate-400" />
        <span className="text-slate-600 dark:text-slate-400">{database?.name || 'Database'}</span>
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

      {/* Header Card */}
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
                  {database.name}
                </h2>
                <p className="text-slate-600 dark:text-slate-400">
                  Page {currentPage} of {totalPages} • {totalVectors} total embeddings
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => fetchVectorData(currentPage, searchQuery)}
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
                disabled={!hasData || vectors.length === 0}
                className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50"
              >
                <Download className="w-5 h-5" />
                Export
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}

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
      ) : (
        <>
          {/* Stats Row - Horizontal Full Width - Individual Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Total Tables */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg">
                  <TableIcon className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Total Tables</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{totalVectors}</p>
                </div>
              </div>
            </motion.div>

            {/* Skipped */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg">
                  <Ban className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Skipped</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    {vectors.filter((v) => v.skipped).length}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Needs Sync */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg">
                  <AlertCircle className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Needs Sync</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    {vectors.filter((v) => v.needs_sync).length}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Current Page */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                  <FileText className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Current Page</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    {currentPage} / {totalPages}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Search Bar */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search tables by name or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    Search
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Table Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="wait">
              {isLoading ? (
                <div className="col-span-full flex justify-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
              ) : (
                vectors.map((vector, index) => (
                  <motion.div
                    key={vector.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.03 }}
                    className="group bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 transition-all hover:shadow-xl hover:shadow-blue-500/10 overflow-hidden"
                  >
                    {/* Card Header */}
                    <div className="p-5 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-800 dark:to-blue-900/20 border-b border-slate-200 dark:border-slate-700">
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                          <TableIcon className="w-5 h-5 text-white" />
                        </div>

                        {/* Toggle Switch */}
                        <button
                          onClick={() => handleToggleTableSkip(vector.table_name)}
                          disabled={togglingTables.has(vector.table_name)}
                          className="relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none disabled:opacity-50"
                          style={{
                            backgroundColor: !vector.skipped ? '#22c55e' : '#94a3b8'
                          }}
                        >
                          {togglingTables.has(vector.table_name) ? (
                            <span className="absolute left-1/2 -translate-x-1/2">
                              <Loader2 className="w-3 h-3 animate-spin text-white" />
                            </span>
                          ) : (
                            <span
                              className="inline-block w-4 h-4 transform bg-white rounded-full shadow-lg transition-transform"
                              style={{
                                transform: !vector.skipped ? 'translateX(24px)' : 'translateX(4px)'
                              }}
                            />
                          )}
                        </button>
                      </div>

                      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 truncate">
                        {vector.table_name}
                      </h3>

                      {/* Status Badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {vector.skipped && (
                          <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-medium rounded">
                            Skipped
                          </span>
                        )}
                        {vector.needs_sync && (
                          <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-medium rounded">
                            Needs Sync
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-5">
                      {editingId === vector.id ? (
                        <div className="space-y-3">
                          <textarea
                            value={editedDescriptions[vector.id] || ''}
                            onChange={(e) => handleDescriptionChange(vector.id, e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            rows={6}
                            placeholder="Enter description..."
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveDescription(vector)}
                              disabled={savingIds.has(vector.id)}
                              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                            >
                              {savingIds.has(vector.id) ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Save className="w-4 h-4" />
                              )}
                              Save
                            </button>
                            <button
                              onClick={() => handleEditCancel(vector.id)}
                              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors"
                            >
                              <X className="w-4 h-4" />
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="mb-4">
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                              Description
                            </p>
                            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-3">
                              {vector.description || 'No description available'}
                            </p>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditStart(vector)}
                              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-medium transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                              Edit
                            </button>

                            {vector.metadata?.columnsLine && (
                              <button
                                onClick={() => toggleSchema(vector.id)}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-indigo-100 dark:bg-indigo-900/30 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm font-medium transition-colors"
                              >
                                <Code2 className="w-4 h-4" />
                                {expandedSchemas.has(vector.id) ? 'Hide' : 'View'} Schema
                              </button>
                            )}
                          </div>

                          {/* Expanded Schema */}
                          <AnimatePresence>
                            {expandedSchemas.has(vector.id) && vector.metadata?.columnsLine && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="mt-4 overflow-hidden"
                              >
                                <div className="p-3 bg-slate-900 dark:bg-slate-950 rounded-lg">
                                  <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                                    {vector.metadata.columnsLine}
                                  </pre>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8 pb-4">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || isLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              <div className="flex items-center gap-1">
                {getPageNumbers().map((page, index) => (
                  typeof page === 'number' ? (
                    <button
                      key={index}
                      onClick={() => handlePageChange(page)}
                      disabled={isLoading}
                      className={`w-10 h-10 rounded-lg font-semibold transition-all ${
                        currentPage === page
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {page}
                    </button>
                  ) : (
                    <span key={index} className="px-2 text-slate-400">
                      {page}
                    </span>
                  )
                ))}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || isLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
