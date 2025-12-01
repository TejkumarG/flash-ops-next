'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ChevronRight,
  Save,
  Loader2,
  AlertCircle,
  Table as TableIcon,
  Key,
  Hash,
  Type,
} from 'lucide-react';
import { toast } from 'sonner';

interface SchemaField {
  name: string;
  type: string;
  nullable?: boolean;
  is_primary_key?: boolean;
  max_length?: number;
  description?: string;
}

interface FieldDescription {
  field_name: string;
  description: string;
}

export default function FieldsDescriptionsPage() {
  const params = useParams();
  const router = useRouter();
  const databaseId = params.id as string;
  const tableName = decodeURIComponent(params.tableName as string);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [schemaFields, setSchemaFields] = useState<SchemaField[]>([]);
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [originalDescriptions, setOriginalDescriptions] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchFieldsDescriptions();
  }, [databaseId, tableName]);

  const fetchFieldsDescriptions = async () => {
    setIsLoading(true);
    try {
      const encodedTableName = encodeURIComponent(tableName);
      const response = await fetch(`/api/databases/${databaseId}/vectors/tables/${encodedTableName}/fields`);
      const result = await response.json();

      if (response.ok && result.success) {
        // Parse schema - it's stored as JSON string
        let schema: SchemaField[] = [];
        const schemaData = result.data.schema;

        console.log('[Fields] Raw schema data:', schemaData);
        console.log('[Fields] Schema data type:', typeof schemaData);

        if (schemaData) {
          if (typeof schemaData === 'string') {
            try {
              const parsed = JSON.parse(schemaData);
              // Handle both array and object with columns property
              if (Array.isArray(parsed)) {
                schema = parsed;
              } else if (parsed.columns && Array.isArray(parsed.columns)) {
                schema = parsed.columns;
              }
              console.log('[Fields] Parsed schema:', schema.length, 'fields');
            } catch (e) {
              console.error('[Fields] Schema parse error:', e);
              schema = [];
            }
          } else if (Array.isArray(schemaData)) {
            schema = schemaData;
          }
        }

        // If schema is still empty, try to build from field_descriptions
        const fieldDescs = result.data.field_descriptions || [];
        console.log('[Fields] field_descriptions count:', fieldDescs.length);

        if (schema.length === 0 && fieldDescs.length > 0) {
          // Build minimal schema from field_descriptions
          schema = fieldDescs.map((fd: FieldDescription) => ({
            name: fd.field_name,
            type: 'UNKNOWN',
            nullable: true,
            description: fd.description,
          }));
          console.log('[Fields] Built schema from field_descriptions:', schema.length);
        }

        setSchemaFields(schema);

        // Build descriptions map
        const descMap: Record<string, string> = {};

        // First, add descriptions from field_descriptions
        fieldDescs.forEach((fd: FieldDescription) => {
          descMap[fd.field_name] = fd.description || '';
        });

        // Also check schema for any descriptions embedded there
        schema.forEach((field: SchemaField) => {
          if (field.description && !descMap[field.name]) {
            descMap[field.name] = field.description;
          }
          // Ensure all fields have an entry
          if (!(field.name in descMap)) {
            descMap[field.name] = '';
          }
        });

        setDescriptions(descMap);
        setOriginalDescriptions({ ...descMap });
        console.log('[Fields] Total fields to display:', schema.length);
      } else {
        toast.error(result.message || 'Failed to load field descriptions');
      }
    } catch (error) {
      console.error('Error fetching field descriptions:', error);
      toast.error('Failed to load field descriptions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDescriptionChange = (fieldName: string, value: string) => {
    const newDescriptions = { ...descriptions, [fieldName]: value };
    setDescriptions(newDescriptions);

    // Check if there are changes
    const changed = Object.keys(newDescriptions).some(
      key => newDescriptions[key] !== originalDescriptions[key]
    );
    setHasChanges(changed);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Convert to array format: [{field_name, description}, ...]
      const fieldDescriptions = Object.entries(descriptions).map(([field_name, description]) => ({
        field_name,
        description,
      }));

      const encodedTableName = encodeURIComponent(tableName);
      const response = await fetch(`/api/databases/${databaseId}/vectors/tables/${encodedTableName}/fields`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field_descriptions: fieldDescriptions }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success('Field descriptions saved successfully');
        setOriginalDescriptions({ ...descriptions });
        setHasChanges(false);
      } else {
        toast.error(result.message || 'Failed to save field descriptions');
      }
    } catch (error) {
      console.error('Error saving field descriptions:', error);
      toast.error('Failed to save field descriptions');
    } finally {
      setIsSaving(false);
    }
  };

  const getTypeColor = (type: string) => {
    const t = type.toUpperCase();
    if (t.includes('INT') || t.includes('DECIMAL') || t.includes('FLOAT') || t.includes('DOUBLE')) {
      return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30';
    }
    if (t.includes('VARCHAR') || t.includes('TEXT') || t.includes('CHAR')) {
      return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30';
    }
    if (t.includes('DATE') || t.includes('TIME')) {
      return 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30';
    }
    if (t.includes('BOOL')) {
      return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30';
    }
    return 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Loading field descriptions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <Link href="/databases" className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Databases
        </Link>
        <ChevronRight className="w-4 h-4 text-slate-400" />
        <Link href={`/databases/${databaseId}/vectors`} className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          View Data
        </Link>
        <ChevronRight className="w-4 h-4 text-slate-400" />
        <span className="text-slate-900 dark:text-white font-medium">{tableName} - Fields</span>
      </div>

      {/* Back Button */}
      <motion.button
        whileHover={{ x: -4 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => router.push(`/databases/${databaseId}/vectors`)}
        className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm font-medium">Back to View Data</span>
      </motion.button>

      {/* Header Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl p-6 border border-indigo-200 dark:border-indigo-800"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
              <TableIcon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                {tableName}
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                {schemaFields.length} Fields - Edit descriptions only
              </p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-semibold shadow-lg shadow-green-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Changes
              </>
            )}
          </motion.button>
        </div>
      </motion.div>

      {/* Fields Table */}
      {schemaFields.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <AlertCircle className="w-12 h-12 mx-auto text-slate-400 mb-4" />
          <p className="text-slate-600 dark:text-slate-400">
            No schema information available for this table.
          </p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide w-8">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Field Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide w-32">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide w-24">
                    Nullable
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex-1">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                {schemaFields.map((field, index) => (
                  <motion.tr
                    key={field.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {field.is_primary_key && (
                          <Key className="w-4 h-4 text-amber-500" title="Primary Key" />
                        )}
                        <span className="font-mono text-sm font-medium text-slate-900 dark:text-white">
                          {field.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-mono font-medium ${getTypeColor(field.type)}`}>
                        {field.type}
                        {field.max_length && field.max_length > 0 && (
                          <span className="opacity-70">({field.max_length})</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${field.nullable ? 'text-slate-400' : 'text-red-500 dark:text-red-400'}`}>
                        {field.nullable ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={descriptions[field.name] || ''}
                        onChange={(e) => handleDescriptionChange(field.name, e.target.value)}
                        placeholder="Enter description..."
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                      />
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Unsaved Changes Warning */}
      {hasChanges && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 right-6 bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 rounded-xl p-4 shadow-lg"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
              You have unsaved changes
            </span>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              disabled={isSaving}
              className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save Now'}
            </motion.button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
