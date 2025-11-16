'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Users, Plus, Edit, Trash2, Check, X, Search, MoreVertical, Key } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface User {
  _id: string;
  name: string;
  email: string;
}

interface Team {
  id: string;
  name: string;
  description: string;
  members: User[];
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function TeamsPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    members: [] as string[],
  });

  // Fetch teams
  const fetchTeams = async () => {
    try {
      const response = await fetch('/api/teams');
      const data = await response.json();

      if (data.success) {
        setTeams(data.data.teams);
      } else {
        toast.error(data.message || 'Failed to fetch teams');
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
      toast.error('Failed to fetch teams');
    } finally {
      setLoading(false);
    }
  };

  // Fetch users for member selection
  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      const data = await response.json();

      if (data.success) {
        const mappedUsers = data.data.users.map((user: any) => ({
          _id: String(user.id),
          name: user.name,
          email: user.email,
        }));
        setUsers(mappedUsers);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  useEffect(() => {
    fetchTeams();
    fetchUsers();
  }, []);

  const handleAddClick = () => {
    setEditingTeam(null);
    setFormData({ name: '', description: '', members: [] });
    setSearchQuery('');
    setShowModal(true);
  };

  const handleEditClick = (team: Team) => {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      description: team.description,
      members: team.members.map((m) => m._id),
    });
    setSearchQuery('');
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this team? All database access assigned to this team will be removed.')) {
      return;
    }

    try {
      const response = await fetch(`/api/teams/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Team deleted successfully');
        fetchTeams();
      } else {
        toast.error(data.message || 'Failed to delete team');
      }
    } catch (error) {
      console.error('Error deleting team:', error);
      toast.error('Failed to delete team');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingTeam ? `/api/teams/${editingTeam.id}` : '/api/teams';
      const method = editingTeam ? 'PUT' : 'POST';

      const memberObjectIds = formData.members
        .map(memberId => {
          const user = users.find(u => u._id === memberId);
          return user ? user._id : null;
        })
        .filter(Boolean);

      const payload = {
        name: formData.name,
        description: formData.description,
        members: memberObjectIds
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message || `Team ${editingTeam ? 'updated' : 'created'} successfully`);
        setShowModal(false);
        fetchTeams();
      } else {
        toast.error(data.message || `Failed to ${editingTeam ? 'update' : 'create'} team`);
      }
    } catch (error) {
      console.error('Error saving team:', error);
      toast.error(`Failed to ${editingTeam ? 'update' : 'create'} team`);
    }
  };

  // Filter users based on search
  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-gray-600 font-medium">Loading teams...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent">
              Teams
            </h1>
            <p className="text-gray-600 mt-2 text-lg">Manage teams and assign database access</p>
          </motion.div>
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleAddClick}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40"
          >
            <Plus className="w-5 h-5" />
            <span className="font-semibold">Create Team</span>
          </motion.button>
        </div>

        {/* Teams Grid */}
        {teams.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="text-center py-20 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-xl"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            >
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-6" />
            </motion.div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">No teams yet</h3>
            <p className="text-gray-500 mb-8 text-lg">Get started by creating your first team</p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleAddClick}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-500/30"
            >
              <Plus className="w-5 h-5" />
              <span className="font-semibold">Create Your First Team</span>
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.1
                }
              }
            }}
          >
            {teams.map((team, index) => (
              <motion.div
                key={team.id}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0 }
                }}
                whileHover={{ y: -8, transition: { duration: 0.2 } }}
                className="group bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200 p-6 hover:shadow-2xl hover:border-blue-300 transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {team.name}
                    </h3>
                    {team.description && (
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">{team.description}</p>
                    )}
                  </div>

                  {/* Dropdown Menu */}
                  <div className="relative">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === team.id ? null : team.id);
                      }}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </motion.button>

                    <AnimatePresence>
                      {openMenuId === team.id && (
                        <>
                          {/* Backdrop to close menu */}
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setOpenMenuId(null)}
                          />

                          {/* Dropdown */}
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            transition={{ duration: 0.1 }}
                            className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-gray-200 py-1 z-20 overflow-hidden"
                          >
                            <button
                              onClick={() => {
                                router.push(`/teams/${team.id}/api-keys`);
                                setOpenMenuId(null);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            >
                              <Key className="w-4 h-4" />
                              <span className="font-medium">API Keys</span>
                            </button>
                            <div className="h-px bg-gray-100 my-1" />
                            <button
                              onClick={() => {
                                handleEditClick(team);
                                setOpenMenuId(null);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                              <span className="font-medium">Edit Team</span>
                            </button>
                            <div className="h-px bg-gray-100 my-1" />
                            <button
                              onClick={() => {
                                handleDelete(team.id);
                                setOpenMenuId(null);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span className="font-medium">Delete Team</span>
                            </button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span className="font-medium">
                    {team.memberCount} {team.memberCount === 1 ? 'member' : 'members'}
                  </span>
                </div>

                {team.members.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex flex-wrap gap-2">
                      {team.members.slice(0, 3).map((member) => (
                        <motion.div
                          key={member._id}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          whileHover={{ scale: 1.05 }}
                          className="px-3 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 text-xs font-medium rounded-full border border-blue-200"
                        >
                          {member.name}
                        </motion.div>
                      ))}
                      {team.members.length > 3 && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-full"
                        >
                          +{team.members.length - 3} more
                        </motion.div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setShowModal(false)}
          >
            {/* Backdrop with blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/60 to-black/70 backdrop-blur-md"
            />

            {/* Modal Content */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 30, stiffness: 400 }}
              className="relative bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header with Gradient */}
              <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-8 py-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-white">
                      {editingTeam ? 'Edit Team' : 'Create New Team'}
                    </h2>
                    <p className="text-blue-100 mt-1">
                      {editingTeam ? 'Update team details and members' : 'Build your team and assign members'}
                    </p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowModal(false)}
                    className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-all"
                  >
                    <X className="w-6 h-6" />
                  </motion.button>
                </div>
              </div>

              {/* Scrollable Form Content */}
              <div className="overflow-y-auto max-h-[calc(90vh-140px)]"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#3B82F6 #F3F4F6'
                }}
              >
                <form onSubmit={handleSubmit} className="px-8 py-6 space-y-6">
                {/* Team Name */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <label className="block text-sm font-bold text-gray-900 mb-3">
                    Team Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all outline-none text-gray-900 font-medium placeholder:text-gray-400"
                    placeholder="e.g., Engineering Team"
                    required
                  />
                </motion.div>

                {/* Description */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <label className="block text-sm font-bold text-gray-900 mb-3">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all outline-none resize-none text-gray-900 placeholder:text-gray-400"
                    placeholder="Brief description of the team..."
                  />
                </motion.div>

                {/* Team Members */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Team Members
                  </label>

                  {/* Search */}
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search users by name or email..."
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                    />
                  </div>

                  {/* Selected Count */}
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      {formData.members.length} {formData.members.length === 1 ? 'member' : 'members'} selected
                    </p>
                    {formData.members.length > 0 && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, members: [] }))}
                        className="text-sm text-red-600 hover:text-red-700 font-medium"
                      >
                        Clear all
                      </motion.button>
                    )}
                  </div>

                  {/* User List */}
                  <div className="border-2 border-gray-200 rounded-xl p-4 max-h-[320px] overflow-y-auto bg-gray-50">
                    {filteredUsers.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-8">
                        {searchQuery ? 'No users found matching your search' : 'No users available'}
                      </p>
                    ) : (
                      <motion.div
                        className="space-y-2"
                        initial="hidden"
                        animate="visible"
                        variants={{
                          hidden: { opacity: 0 },
                          visible: {
                            opacity: 1,
                            transition: { staggerChildren: 0.03 }
                          }
                        }}
                      >
                        {filteredUsers.map((user, index) => {
                          const userId = String(user._id);
                          const memberIds = formData.members.map(id => String(id));
                          const isSelected = memberIds.includes(userId);

                          return (
                            <motion.div
                              key={`user-${index}-${userId}`}
                              variants={{
                                hidden: { opacity: 0, x: -10 },
                                visible: { opacity: 1, x: 0 }
                              }}
                              whileHover={{ x: 4, transition: { duration: 0.2 } }}
                              onClick={() => {
                                setFormData(currentFormData => {
                                  const currentMemberIds = currentFormData.members.map(id => String(id));
                                  const isCurrentlySelected = currentMemberIds.includes(userId);

                                  const newMembers = isCurrentlySelected
                                    ? currentMemberIds.filter(id => id !== userId)
                                    : [...currentMemberIds, userId];

                                  return {
                                    name: currentFormData.name,
                                    description: currentFormData.description,
                                    members: newMembers
                                  };
                                });
                              }}
                              className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all duration-200 ${
                                isSelected
                                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30'
                                  : 'bg-white hover:bg-gray-50 border-2 border-gray-200 hover:border-blue-300'
                              }`}
                            >
                              <motion.div
                                animate={{
                                  scale: isSelected ? 1 : 0.9,
                                  opacity: isSelected ? 1 : 0.5
                                }}
                                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                                  isSelected
                                    ? 'bg-white text-blue-600'
                                    : 'bg-gray-200 text-gray-600'
                                }`}
                              >
                                {user.name.charAt(0).toUpperCase()}
                              </motion.div>

                              <div className="flex-1 min-w-0">
                                <div className={`font-semibold truncate ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                                  {user.name}
                                </div>
                                <div className={`text-sm truncate ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                                  {user.email}
                                </div>
                              </div>

                              <motion.div
                                initial={false}
                                animate={{
                                  scale: isSelected ? 1 : 0,
                                  rotate: isSelected ? 0 : -180
                                }}
                                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                className="flex-shrink-0"
                              >
                                <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                                  <Check className="w-4 h-4 text-blue-600" />
                                </div>
                              </motion.div>
                            </motion.div>
                          );
                        })}
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-6 py-3 text-gray-700 font-semibold hover:bg-gray-100 rounded-xl transition-all"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40"
                  >
                    {editingTeam ? 'Update Team' : 'Create Team'}
                  </motion.button>
                </div>
              </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
