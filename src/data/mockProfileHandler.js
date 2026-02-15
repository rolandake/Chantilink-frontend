// src/utils/mockProfileHandler.js - VERSION COMPLÈTE AVEC INTERACTIONS
// ✅ Gestion complète des interactions : likes, comments, follow, save
import { MOCK_USERS, MOCK_POSTS } from '../data/mockPosts';

/**
 * Récupère un utilisateur mock par son ID
 */
export const getMockUserById = (userId) => {
  if (!userId) return null;
  
  const user = MOCK_USERS.find(u => u._id === userId || u.id === userId);
  if (user) return user;
  
  const postWithUser = MOCK_POSTS.find(p => {
    const postUserId = p.user?._id || p.user?.id || p.userId;
    return postUserId === userId;
  });
  
  return postWithUser?.user || null;
};

/**
 * Récupère tous les posts d'un utilisateur mock
 */
export const getMockUserPosts = (userId) => {
  if (!userId) return [];
  
  return MOCK_POSTS.filter(post => {
    const postUserId = post.user?._id || post.user?.id || post.userId;
    return postUserId === userId;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

/**
 * Vérifie si un ID correspond à un utilisateur mock
 */
export const isMockUser = (userId) => {
  if (!userId) return false;
  return userId.toString().startsWith('user_') || 
         MOCK_USERS.some(u => u._id === userId || u.id === userId);
};

/**
 * Vérifie si un ID correspond à un post mock
 */
export const isMockPost = (postId) => {
  if (!postId) return false;
  return postId.toString().startsWith('post_') ||
         MOCK_POSTS.some(p => p._id === postId);
};

/**
 * ✅ NOUVEAU : Simule un like/unlike sur un post mock
 */
export const mockLikePost = (postId, currentUserId) => {
  const postIndex = MOCK_POSTS.findIndex(p => p._id === postId);
  if (postIndex === -1) return null;
  
  const post = MOCK_POSTS[postIndex];
  const likes = Array.isArray(post.likes) ? [...post.likes] : [];
  
  const userLikedIndex = likes.findIndex(id => id === currentUserId);
  
  if (userLikedIndex > -1) {
    // Unlike
    likes.splice(userLikedIndex, 1);
  } else {
    // Like
    likes.push(currentUserId);
  }
  
  const updatedPost = {
    ...post,
    likes,
    likesCount: likes.length
  };
  
  MOCK_POSTS[postIndex] = updatedPost;
  return updatedPost;
};

/**
 * ✅ NOUVEAU : Ajoute un commentaire à un post mock
 */
export const mockCommentPost = (postId, currentUserId, text) => {
  const postIndex = MOCK_POSTS.findIndex(p => p._id === postId);
  if (postIndex === -1) return null;
  
  const post = MOCK_POSTS[postIndex];
  const comments = Array.isArray(post.comments) ? [...post.comments] : [];
  
  // Récupérer l'utilisateur actuel
  const currentUser = getMockUserById(currentUserId);
  if (!currentUser) return null;
  
  const newComment = {
    _id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    user: {
      _id: currentUser._id || currentUser.id,
      fullName: currentUser.fullName,
      username: currentUser.username,
      profilePicture: currentUser.profilePicture || currentUser.profilePhoto,
    },
    text,
    likes: [],
    createdAt: new Date(),
  };
  
  comments.push(newComment);
  
  const updatedPost = {
    ...post,
    comments,
    commentsCount: comments.length
  };
  
  MOCK_POSTS[postIndex] = updatedPost;
  return updatedPost;
};

/**
 * ✅ NOUVEAU : Supprime un commentaire d'un post mock
 */
export const mockDeleteComment = (postId, commentId) => {
  const postIndex = MOCK_POSTS.findIndex(p => p._id === postId);
  if (postIndex === -1) return null;
  
  const post = MOCK_POSTS[postIndex];
  const comments = Array.isArray(post.comments) ? [...post.comments] : [];
  
  const filteredComments = comments.filter(c => c._id !== commentId);
  
  const updatedPost = {
    ...post,
    comments: filteredComments,
    commentsCount: filteredComments.length
  };
  
  MOCK_POSTS[postIndex] = updatedPost;
  return updatedPost;
};

/**
 * ✅ NOUVEAU : Like/unlike un commentaire
 */
export const mockLikeComment = (postId, commentId, currentUserId) => {
  const postIndex = MOCK_POSTS.findIndex(p => p._id === postId);
  if (postIndex === -1) return null;
  
  const post = MOCK_POSTS[postIndex];
  const comments = Array.isArray(post.comments) ? [...post.comments] : [];
  
  const commentIndex = comments.findIndex(c => c._id === commentId);
  if (commentIndex === -1) return null;
  
  const comment = comments[commentIndex];
  const likes = Array.isArray(comment.likes) ? [...comment.likes] : [];
  
  const userLikedIndex = likes.findIndex(id => id === currentUserId);
  
  if (userLikedIndex > -1) {
    likes.splice(userLikedIndex, 1);
  } else {
    likes.push(currentUserId);
  }
  
  comments[commentIndex] = {
    ...comment,
    likes
  };
  
  const updatedPost = {
    ...post,
    comments
  };
  
  MOCK_POSTS[postIndex] = updatedPost;
  return updatedPost;
};

/**
 * ✅ NOUVEAU : Sauvegarde/unsave un post mock
 */
export const mockSavePost = (postId, currentUserId) => {
  const postIndex = MOCK_POSTS.findIndex(p => p._id === postId);
  if (postIndex === -1) return null;
  
  const post = MOCK_POSTS[postIndex];
  
  // Simuler la sauvegarde (on pourrait stocker ça dans localStorage)
  const savedPosts = JSON.parse(localStorage.getItem('savedMockPosts') || '{}');
  const userSaved = savedPosts[currentUserId] || [];
  
  const isSaved = userSaved.includes(postId);
  
  if (isSaved) {
    savedPosts[currentUserId] = userSaved.filter(id => id !== postId);
  } else {
    savedPosts[currentUserId] = [...userSaved, postId];
  }
  
  localStorage.setItem('savedMockPosts', JSON.stringify(savedPosts));
  
  return {
    ...post,
    saved: !isSaved
  };
};

/**
 * Simule un follow/unfollow pour un utilisateur mock
 */
export const mockFollowUser = (currentUserId, targetUserId, action = 'follow') => {
  const mockUser = getMockUserById(targetUserId);
  if (!mockUser) return null;
  
  const currentFollowersCount = mockUser.followersCount || 0;
  const newFollowersCount = action === 'follow' 
    ? currentFollowersCount + 1 
    : Math.max(0, currentFollowersCount - 1);
  
  const followers = Array.isArray(mockUser.followers) ? [...mockUser.followers] : [];
  
  const updatedFollowers = action === 'follow'
    ? [...followers, currentUserId]
    : followers.filter(id => id !== currentUserId);
  
  const updatedUser = {
    ...mockUser,
    followersCount: newFollowersCount,
    followers: updatedFollowers
  };
  
  // Mettre à jour dans MOCK_USERS
  const userIndex = MOCK_USERS.findIndex(u => 
    (u._id === targetUserId || u.id === targetUserId)
  );
  
  if (userIndex !== -1) {
    MOCK_USERS[userIndex] = updatedUser;
  }
  
  return updatedUser;
};

/**
 * Récupère des suggestions d'utilisateurs mock
 */
export const getMockUserSuggestions = (currentUserId, limit = 5) => {
  return MOCK_USERS
    .filter(u => (u._id || u.id) !== currentUserId)
    .sort((a, b) => (b.followersCount || 0) - (a.followersCount || 0))
    .slice(0, limit);
};

/**
 * Recherche des utilisateurs mock par nom
 */
export const searchMockUsers = (query, limit = 10) => {
  if (!query || query.trim().length === 0) return [];
  
  const searchTerm = query.toLowerCase();
  
  return MOCK_USERS
    .filter(u => 
      u.fullName?.toLowerCase().includes(searchTerm) ||
      u.username?.toLowerCase().includes(searchTerm) ||
      u.bio?.toLowerCase().includes(searchTerm)
    )
    .slice(0, limit);
};

/**
 * Simule la mise à jour d'un profil mock (en mémoire uniquement)
 */
export const updateMockUserProfile = (userId, updates) => {
  const userIndex = MOCK_USERS.findIndex(u => u._id === userId || u.id === userId);
  if (userIndex === -1) return null;
  
  const updatedUser = {
    ...MOCK_USERS[userIndex],
    ...updates,
    _id: MOCK_USERS[userIndex]._id,
    id: MOCK_USERS[userIndex].id,
    isMockUser: true
  };
  
  MOCK_USERS[userIndex] = updatedUser;
  
  return updatedUser;
};

/**
 * Export d'un utilisateur mock au format compatible API
 */
export const formatMockUserForAPI = (mockUser) => {
  if (!mockUser) return null;
  
  return {
    _id: mockUser._id || mockUser.id,
    id: mockUser.id || mockUser._id,
    fullName: mockUser.fullName,
    username: mockUser.username,
    email: mockUser.email,
    profilePicture: mockUser.profilePicture || mockUser.profilePhoto,
    profilePhoto: mockUser.profilePhoto || mockUser.profilePicture,
    coverPhoto: mockUser.coverPhoto,
    bio: mockUser.bio,
    location: mockUser.location,
    website: mockUser.website,
    verified: mockUser.verified || mockUser.isVerified,
    isVerified: mockUser.isVerified || mockUser.verified,
    isPremium: mockUser.isPremium,
    followers: mockUser.followers || [],
    following: mockUser.following || [],
    followersCount: mockUser.followersCount || mockUser.followers?.length || 0,
    followingCount: mockUser.followingCount || mockUser.following?.length || 0,
    postsCount: mockUser.postsCount || 0,
    createdAt: mockUser.createdAt,
    isMockUser: true
  };
};

/**
 * Vérifie si un post est sauvegardé par l'utilisateur
 */
export const isMockPostSaved = (postId, currentUserId) => {
  const savedPosts = JSON.parse(localStorage.getItem('savedMockPosts') || '{}');
  const userSaved = savedPosts[currentUserId] || [];
  return userSaved.includes(postId);
};

/**
 * Récupère tous les posts sauvegardés d'un utilisateur
 */
export const getMockSavedPosts = (currentUserId) => {
  const savedPosts = JSON.parse(localStorage.getItem('savedMockPosts') || '{}');
  const userSaved = savedPosts[currentUserId] || [];
  
  return MOCK_POSTS.filter(p => userSaved.includes(p._id));
};

/**
 * Statistiques globales des utilisateurs mock
 */
export const getMockUsersStats = () => {
  return {
    totalUsers: MOCK_USERS.length,
    totalPosts: MOCK_POSTS.length,
    verifiedUsers: MOCK_USERS.filter(u => u.verified || u.isVerified).length,
    premiumUsers: MOCK_USERS.filter(u => u.isPremium).length,
    avgFollowers: Math.floor(
      MOCK_USERS.reduce((sum, u) => sum + (u.followersCount || 0), 0) / MOCK_USERS.length
    ),
    avgPosts: Math.floor(MOCK_POSTS.length / MOCK_USERS.length)
  };
};

export default {
  getMockUserById,
  getMockUserPosts,
  isMockUser,
  isMockPost,
  mockLikePost,
  mockCommentPost,
  mockDeleteComment,
  mockLikeComment,
  mockSavePost,
  mockFollowUser,
  getMockUserSuggestions,
  searchMockUsers,
  updateMockUserProfile,
  formatMockUserForAPI,
  isMockPostSaved,
  getMockSavedPosts,
  getMockUsersStats
};