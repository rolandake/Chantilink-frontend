const HIDDEN_POSTS_KEY = "chantilink_hidden_posts_v1";
const AUTHOR_NOTIFS_KEY = "chantilink_author_post_notifications_v1";
const NOTIFIED_POSTS_KEY = "chantilink_notified_posts_v1";

const readArray = (key) => {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage?.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeArray = (key, values, max = 500) => {
  if (typeof window === "undefined") return;
  try {
    const unique = [...new Set(values.filter(Boolean).map(String))].slice(-max);
    window.localStorage?.setItem(key, JSON.stringify(unique));
  } catch {}
};

export const getPostAuthor = (post) => {
  const user = post?.user || post?.author || {};
  const id = user._id || user.id || post?.userId || post?.authorId || post?.author?._id || null;
  const name = user.fullName || user.name || user.username || post?.fullName || post?.userName || "Un utilisateur";
  return { id: id ? String(id) : "", name };
};

export const getHiddenPostIds = () => new Set(readArray(HIDDEN_POSTS_KEY));

export const isPostHidden = (postOrId) => {
  const id = typeof postOrId === "object" ? postOrId?._id : postOrId;
  return !!id && getHiddenPostIds().has(String(id));
};

export const hidePostPreference = (postOrId) => {
  const id = typeof postOrId === "object" ? postOrId?._id : postOrId;
  if (!id) return;
  writeArray(HIDDEN_POSTS_KEY, [...readArray(HIDDEN_POSTS_KEY), String(id)], 1000);
};

export const getAuthorNotificationIds = () => new Set(readArray(AUTHOR_NOTIFS_KEY));

export const isAuthorNotificationEnabled = (authorId) => {
  return !!authorId && getAuthorNotificationIds().has(String(authorId));
};

export const setAuthorNotificationEnabled = (authorId, enabled) => {
  if (!authorId) return false;
  const current = getAuthorNotificationIds();
  enabled ? current.add(String(authorId)) : current.delete(String(authorId));
  writeArray(AUTHOR_NOTIFS_KEY, [...current], 500);
  return enabled;
};

export const wasPostAlreadyNotified = (postId) => {
  return !!postId && new Set(readArray(NOTIFIED_POSTS_KEY)).has(String(postId));
};

export const markPostNotified = (postId) => {
  if (!postId) return;
  writeArray(NOTIFIED_POSTS_KEY, [...readArray(NOTIFIED_POSTS_KEY), String(postId)], 1000);
};

export const shouldNotifyForPost = (post, currentUser) => {
  if (!post?._id || wasPostAlreadyNotified(post._id) || isPostHidden(post)) return null;
  const createdAt = post.createdAt || post.updatedAt || post.publishedAt;
  if (createdAt) {
    const age = Date.now() - new Date(createdAt).getTime();
    if (Number.isFinite(age) && age > 15 * 60 * 1000) return null;
  }
  const author = getPostAuthor(post);
  if (!author.id || author.id === String(currentUser?._id || currentUser?.id || "")) return null;

  if (isAuthorNotificationEnabled(author.id)) {
    return {
      type: "post",
      reason: "author",
      message: `${author.name} a publié du nouveau contenu`,
    };
  }

  const topics = [
    post.category,
    ...(Array.isArray(post.hashtags) ? post.hashtags : []),
    ...(Array.isArray(post.tags) ? post.tags : []),
  ].filter(Boolean);

  if (post._score >= 35 || post.isBoosted || topics.length > 0) {
    return {
      type: "post_suggestion",
      reason: "suggestion",
      message: `${author.name} a publié quelque chose qui pourrait vous intéresser`,
    };
  }

  return null;
};
