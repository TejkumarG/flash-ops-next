'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Search,
  Database,
  Filter,
  Download,
  RefreshCw,
  Loader2,
  AlertCircle,
  Table as TableIcon,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

interface VectorData {
  id: string;
  table_name: string;
  column_name?: string;
  description: string;
  embedding_dimension?: number;
  metadata?: Record<string, any>;
  created_at?: string;
}

interface VectorStoreViewerProps {
  isOpen: boolean;
  onClose: () => void;
  databaseId: string;
  databaseName: string;
}

export default function VectorStoreViewer({
  isOpen,
  onClose,
  databaseId,
  databaseName,
}: VectorStoreViewerProps) {
  const [vectors, setVectors] = useState<VectorData[]>([]);
  const [filteredVectors, setFilteredVectors] = useState<VectorData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasData, setHasData] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTable, setSelectedTable] = useState<string>('all');
  const [tables, setTables] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [metadata, setMetadata] = useState<any>({});

  useEffect(() => {
    if (isOpen) {
      fetchVectorData();
    }
  }, [isOpen, databaseId]);

  useEffect(() => {
    // Filter vectors based on search and table selection
    let filtered = vectors;

    if (searchQuery) {
      filtered = filtered.filter(
        (v) =>
          v.table_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.column_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedTable !== 'all') {
      filtered = filtered.filter((v) => v.table_name === selectedTable);
    }

    setFilteredVectors(filtered);
  }, [searchQuery, selectedTable, vectors]);

  const fetchVectorData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/databases/${databaseId}/vectors?limit=1000`
      );
      const result = await response.json();

      if (response.ok && result.success) {
        setVectors(result.data.vectors || []);
        setFilteredVectors(result.data.vectors || []);
        setHasData(result.data.hasData);
        setTotal(result.data.total || 0);
        setMetadata(result.data.metadata || {});

        // Extract unique table names
        const uniqueTables = [
          ...new Set(result.data.vectors?.map((v: VectorData) => v.table_name)),
        ] as string[];
        setTables(uniqueTables);

        if (!result.data.hasData) {
          toast.info(result.data.message || 'No vector data available');
        }
      } else {
        toast.error(result.message || 'Failed to fetch vector data');
        setHasData(false);
      }
    } catch (error) {
      console.error('Error fetching vectors:', error);
      toast.error('Failed to load vector store data');
      setHasData(false);
    } finally {
      setIsLoading(false);
    }
  };

  const exportToJSON = () => {
    const dataStr = JSON.stringify(filteredVectors, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${databaseName}_vectors_${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Exported vector data');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden border border-slate-700"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-700 bg-slate-900/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Database className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  Vector Store Data
                </h2>
                <p className="text-sm text-slate-400">{databaseName}</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Content */}
          <div className="flex flex-col h-[calc(90vh-100px)]">
            {/* Filters and Actions */}
            <div className="p-4 border-b border-slate-700 bg-slate-900/30">
              <div className="flex flex-wrap gap-3">
                {/* Search */}
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search tables, columns, descriptions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Table Filter */}
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  disabled={!hasData}
                >
                  <option value="all">All Tables ({tables.length})</option>
                  {tables.map((table) => (
                    <option key={table} value={table}>
                      {table}
                    </option>
                  ))}
                </select>

                {/* Actions */}
                <button
                  onClick={fetchVectorData}
                  disabled={isLoading}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-white transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
                  />
                  Refresh
                </button>

                <button
                  onClick={exportToJSON}
                  disabled={!hasData || filteredVectors.length === 0}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>

              {/* Stats */}
              {hasData && (
                <div className="mt-3 flex items-center gap-6 text-sm text-slate-400">
                  <span>Total Vectors: {total}</span>
                  <span>Filtered: {filteredVectors.length}</span>
                  <span>Tables: {tables.length}</span>
                </div>
              )}
            </div>

            {/* Data Display */}
            <div className="flex-1 overflow-auto p-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                    <p className="text-slate-400">Loading vector data...</p>
                  </div>
                </div>
              ) : !hasData ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center max-w-md">
                    <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">
                      No Vector Data Available
                    </h3>
                    <p className="text-slate-400 mb-4">
                      This database hasn't been synced yet. Please sync the
                      database to generate embeddings.
                    </p>
                    <button
                      onClick={onClose}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : filteredVectors.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Search className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400">
                      No vectors match your filters
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredVectors.map((vector, index) => (
                    <motion.div
                      key={vector.id || index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 hover:border-blue-500/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <TableIcon className="w-4 h-4 text-blue-400" />
                            <h4 className="font-semibold text-white">
                              {vector.table_name}
                            </h4>
                            {vector.column_name && (
                              <>
                                <span className="text-slate-600">•</span>
                                <span className="text-sm text-slate-400">
                                  {vector.column_name}
                                </span>
                              </>
                            )}
                          </div>

                          <p className="text-sm text-slate-300 mb-3">
                            {vector.description}
                          </p>

                          {vector.metadata && (
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(vector.metadata).map(
                                ([key, value]) => (
                                  <span
                                    key={key}
                                    className="px-2 py-1 bg-slate-700/50 rounded text-xs text-slate-400"
                                  >
                                    {key}: {String(value)}
                                  </span>
                                )
                              )}
                            </div>
                          )}
                        </div>

                        {vector.embedding_dimension && (
                          <div className="text-right">
                            <div className="text-xs text-slate-400">
                              Dimensions
                            </div>
                            <div className="text-lg font-semibold text-blue-400">
                              {vector.embedding_dimension}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
