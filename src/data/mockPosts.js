// Mock Posts Generator - 5000+ users and 10000+ posts
// Optimized for performance with progressive loading

const PEXELS_IMAGES = {
  food: [
    'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg',
    'https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg',
    'https://images.pexels.com/photos/1352199/pexels-photo-1352199.jpeg',
    'https://images.pexels.com/photos/376464/pexels-photo-376464.jpeg',
  ],
  beach: [
    'https://images.pexels.com/photos/457882/pexels-photo-457882.jpeg',
    'https://images.pexels.com/photos/1450353/pexels-photo-1450353.jpeg',
    'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg',
  ],
  city: [
    'https://images.pexels.com/photos/466685/pexels-photo-466685.jpeg',
    'https://images.pexels.com/photos/313782/pexels-photo-313782.jpeg',
    'https://images.pexels.com/photos/1486222/pexels-photo-1486222.jpeg',
  ],
  people: [
    'https://images.pexels.com/photos/1065084/pexels-photo-1065084.jpeg',
    'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg',
    'https://images.pexels.com/photos/1520760/pexels-photo-1520760.jpeg',
  ],
  nature: [
    'https://images.pexels.com/photos/1423600/pexels-photo-1423600.jpeg',
    'https://images.pexels.com/photos/1430676/pexels-photo-1430676.jpeg',
    'https://images.pexels.com/photos/1761279/pexels-photo-1761279.jpeg',
  ],
  fitness: [
    'https://images.pexels.com/photos/416778/pexels-photo-416778.jpeg',
    'https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg',
  ],
  fashion: [
    'https://images.pexels.com/photos/1926769/pexels-photo-1926769.jpeg',
    'https://images.pexels.com/photos/1381556/pexels-photo-1381556.jpeg',
  ],
  travel: [
    'https://images.pexels.com/photos/1268855/pexels-photo-1268855.jpeg',
    'https://images.pexels.com/photos/1450360/pexels-photo-1450360.jpeg',
  ],
  tech: [
    'https://images.pexels.com/photos/577585/pexels-photo-577585.jpeg',
    'https://images.pexels.com/photos/1229861/pexels-photo-1229861.jpeg',
  ],
  pets: [
    'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg',
    'https://images.pexels.com/photos/1805164/pexels-photo-1805164.jpeg',
  ]
};

function getPexelsImage(category, seed = 0, width = 640, priority = false) {
  const images = PEXELS_IMAGES[category] || PEXELS_IMAGES.nature;
  const index = seed % images.length;
  const baseUrl = images[index];
  const quality = priority ? 'q=80' : 'q=60';
  return `${baseUrl}?auto=compress,format&cs=tinysrgb&fit=crop&w=${width}&h=${width}&${quality}`;
}

const DIVERSE_NAMES = {
  african: {
    first: ["Kouame", "Kouassi", "Konan", "Yao", "Koffi", "Aya", "Adjoua", "Akissi", "Mamadou", "Fatou", "Aminata", "Ousmane", "Ibrahim", "Aissatou", "Mariam"],
    last: ["Kone", "Coulibaly", "Sanogo", "Ouattara", "Diomande", "Traore", "Toure", "Diallo", "Diop", "Ba"]
  },
  french: {
    first: ["Marie", "Jean", "Pierre", "Sophie", "Antoine", "Camille", "Lucas", "Emma", "Louis", "Lea", "Thomas", "Chloe", "Nicolas", "Julie"],
    last: ["Dupont", "Martin", "Bernard", "Dubois", "Moreau", "Laurent", "Simon", "Michel"]
  },
  english: {
    first: ["Alex", "Sam", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Avery", "James", "Emma", "Michael", "Olivia"],
    last: ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis"]
  },
  arabic: {
    first: ["Mohamed", "Ahmed", "Hassan", "Ali", "Omar", "Youssef", "Fatima", "Aisha", "Zainab", "Nour"],
    last: ["Al-Mansour", "Al-Hassan", "Al-Rashid", "El-Masri", "Farouk", "Mahmoud"]
  },
  asian: {
    first: ["Wei", "Ming", "Yuki", "Kenji", "Mei", "Hiro", "Sakura", "Priya", "Raj", "Ananya"],
    last: ["Chen", "Wang", "Li", "Zhang", "Tanaka", "Kumar", "Singh", "Patel"]
  },
  latino: {
    first: ["Carlos", "Maria", "Luis", "Ana", "Diego", "Sofia", "Miguel", "Isabella"],
    last: ["Rodriguez", "Gonzalez", "Martinez", "Lopez", "Hernandez", "Garcia"]
  }
};

const POST_TEMPLATES = [
  {
    category: 'food',
    texts: [
      "Who wants to eat with me?",
      "Meal of the day! So good",
      "Homemade cooking",
      "Best meal ever!",
      "Brunch goals!",
      "Food is life!",
      "Cooking with love today",
      "Petit-dejeuner parfait",
      "Diner entre amis"
    ],
    hashtags: ['#Food', '#Foodie', '#Yummy', '#Delicious', '#Instafood']
  },
  {
    category: 'beach',
    texts: [
      "Day at the beach!",
      "Amazing ocean view",
      "Perfect relaxation moment",
      "Beach vibes only!",
      "Sunset paradise",
      "Living my best beach life",
      "Ocean therapy",
      "Vitamin Sea",
      "Paradise found"
    ],
    hashtags: ['#Beach', '#Ocean', '#Paradise', '#Sunset', '#BeachLife']
  },
  {
    category: 'city',
    texts: [
      "The city is beautiful today",
      "Amazing urban view",
      "Modern architecture",
      "City lights at night",
      "Downtown vibes",
      "Urban exploration",
      "Skyline goals",
      "Concrete jungle"
    ],
    hashtags: ['#City', '#Urban', '#Architecture', '#Cityscape']
  },
  {
    category: 'people',
    texts: [
      "Captured moment",
      "Selfie of the day",
      "Unforgettable memories",
      "Good vibes only!",
      "Squad goals!",
      "Making memories",
      "Life is beautiful",
      "Blessed and grateful",
      "Living my best life!"
    ],
    hashtags: ['#Portrait', '#Selfie', '#GoodVibes', '#Friends', '#Memories']
  },
  {
    category: 'nature',
    texts: [
      "Magnificent nature",
      "Dream landscape",
      "Reconnecting with nature",
      "Mother Nature at her best",
      "Hiking adventures",
      "Wild and free",
      "Lost in nature",
      "Mountain therapy",
      "Fresh air, clear mind"
    ],
    hashtags: ['#Nature', '#Landscape', '#NatureLovers', '#Hiking']
  },
  {
    category: 'fitness',
    texts: [
      "No pain, no gain!",
      "Workout done!",
      "Gym time",
      "Getting stronger every day",
      "Fitness is my therapy",
      "Push yourself!",
      "Yoga vibes",
      "Beast mode activated"
    ],
    hashtags: ['#Fitness', '#Gym', '#Workout', '#Motivation']
  },
  {
    category: 'fashion',
    texts: [
      "Outfit of the day!",
      "Fashion is art",
      "New style, new me",
      "Shopping therapy",
      "Style on point!",
      "Fashion addict",
      "Dressed to impress"
    ],
    hashtags: ['#Fashion', '#Style', '#OOTD', '#FashionBlogger']
  },
  {
    category: 'travel',
    texts: [
      "Wanderlust!",
      "Adventure time",
      "Exploring new places",
      "Travel is life!",
      "Vacation mode ON",
      "New destination unlocked",
      "Passport full of memories"
    ],
    hashtags: ['#Travel', '#Wanderlust', '#Adventure', '#TravelGram']
  },
  {
    category: 'tech',
    texts: [
      "Tech lover!",
      "Coding life",
      "New gadget unlocked",
      "Innovation is key",
      "Gamer for life",
      "Future is now!"
    ],
    hashtags: ['#Tech', '#Technology', '#Gadgets', '#Coding']
  },
  {
    category: 'pets',
    texts: [
      "My best friend",
      "Cute overload!",
      "Pet love",
      "Furry friend goals",
      "Unconditional love",
      "Pawsome!",
      "Too cute to handle"
    ],
    hashtags: ['#Pets', '#DogsOfInstagram', '#CatsOfInstagram', '#PetLove']
  }
];

const PROFESSIONAL_BIOS = [
  "CEO & Founder | Building the future",
  "Entrepreneur | Innovator | Dreamer",
  "Content Creator | Influencer",
  "Digital Creator | Photography",
  "Artist | Creative mind",
  "Musician | Producer",
  "Marketing Professional",
  "Software Engineer | Tech lover",
  "Fitness coach | Healthy living",
  "Fashion blogger | Style icon",
  "Travel addict | 50+ countries",
  "Foodie | Restaurant reviewer",
  "Living my best life",
  "Just enjoying the journey",
  "Blessed & grateful",
  "Positive vibes only",
  null,
  null,
  null
];

const LOCATIONS = [
  "Abidjan, Cote d'Ivoire", "Yamoussoukro, CI", "Bouake, CI",
  "Dakar, Senegal", "Accra, Ghana", "Lagos, Nigeria",
  "Paris, France", "Lyon, France", "Marseille, France",
  "New York, USA", "Los Angeles, USA", "Miami, USA",
  "London, UK", "Dubai, UAE", "Toronto, Canada",
  null, null, null
];

class MassiveRealisticGenerator {
  constructor() {
    this.users = [];
    this.posts = [];
    this.usedUsernames = new Set();
  }

  random(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  randomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  }

  generateRealisticLikes() {
    const rand = Math.random();
    if (rand < 0.50) return this.randomInt(5, 100);
    else if (rand < 0.80) return this.randomInt(100, 500);
    else if (rand < 0.95) return this.randomInt(500, 2000);
    else if (rand < 0.99) return this.randomInt(2000, 10000);
    else return this.randomInt(10000, 50000);
  }

  generateRealisticComments(likesCount) {
    const ratio = 0.05 + Math.random() * 0.10;
    return Math.floor(likesCount * ratio);
  }

  generateRealisticFollowers() {
    const rand = Math.random();
    if (rand < 0.60) return this.randomInt(50, 1000);
    else if (rand < 0.85) return this.randomInt(1000, 5000);
    else if (rand < 0.95) return this.randomInt(5000, 50000);
    else return this.randomInt(50000, 500000);
  }

  generateUsername(firstName, lastName) {
    const base = `${firstName}${lastName}`.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, '');
    
    let username = base;
    let attempt = 0;
    
    while (this.usedUsernames.has(username) && attempt < 100) {
      const suffix = this.randomInt(1, 9999);
      username = `${base}${suffix}`;
      attempt++;
    }
    
    this.usedUsernames.add(username);
    return username;
  }

  generateUser(index) {
    const cultures = Object.keys(DIVERSE_NAMES);
    const culture = this.random(cultures);
    const names = DIVERSE_NAMES[culture];
    
    const firstName = this.random(names.first);
    const lastName = this.random(names.last);
    const fullName = `${firstName} ${lastName}`;
    const username = this.generateUsername(firstName, lastName);
    
    const followers = this.generateRealisticFollowers();
    const following = this.randomInt(Math.floor(followers * 0.1), Math.floor(followers * 0.5));
    
    const profilePic = getPexelsImage('people', index, 150);
    const coverPic = getPexelsImage(this.random(['beach', 'city', 'nature']), index, 1200);
    
    return {
      _id: `user_${index}_${Date.now()}_${this.randomInt(10000, 99999)}`,
      id: `user_${index}_${Date.now()}_${this.randomInt(10000, 99999)}`,
      fullName,
      username,
      email: `${username}@example.com`,
      profilePicture: profilePic,
      profilePhoto: profilePic,
      coverPhoto: coverPic,
      bio: this.random(PROFESSIONAL_BIOS),
      location: this.random(LOCATIONS),
      verified: followers > 10000 ? (Math.random() > 0.7) : (Math.random() > 0.95),
      isVerified: followers > 10000 ? (Math.random() > 0.7) : (Math.random() > 0.95),
      isPremium: Math.random() > 0.85,
      followers: [],
      following: [],
      followersCount: followers,
      followingCount: following,
      postsCount: 0,
      culture,
      createdAt: this.randomDate(new Date(2020, 0, 1), new Date(2024, 0, 1)),
      website: Math.random() > 0.7 ? `https://${username}.com` : null,
      isMockUser: true,
    };
  }

  generatePost(index, user, allUsers, isPriority = false) {
    const template = this.random(POST_TEMPLATES);
    
    const baseText = this.random(template.texts);
    const useHashtags = Math.random() > 0.3;
    
    let finalContent = baseText;
    if (useHashtags) {
      const hashtagCount = this.randomInt(1, Math.min(3, template.hashtags.length));
      const selectedHashtags = [];
      const availableHashtags = [...template.hashtags];
      
      for (let i = 0; i < hashtagCount; i++) {
        if (availableHashtags.length === 0) break;
        const idx = this.randomInt(0, availableHashtags.length - 1);
        selectedHashtags.push(availableHashtags[idx]);
        availableHashtags.splice(idx, 1);
      }
      
      finalContent = `${baseText}\n\n${selectedHashtags.join(' ')}`;
    }
    
    let images = [];
    if (Math.random() > 0.20) {
      const imageCount = this.randomInt(1, 3);
      
      for (let i = 0; i < imageCount; i++) {
        const seed = index * 100 + i;
        const imageUrl = getPexelsImage(template.category, seed, 640, isPriority && i === 0);
        const thumbnailUrl = getPexelsImage(template.category, seed, 400);
        
        images.push({
          url: imageUrl,
          thumbnail: thumbnailUrl,
          type: 'image'
        });
      }
    }
    
    const likesCount = this.generateRealisticLikes();
    const commentsCount = this.generateRealisticComments(likesCount);
    
    const likeCount = Math.min(likesCount, 100);
    const likeIds = [];
    const usedUsers = new Set([user._id]);
    
    for (let i = 0; i < likeCount; i++) {
      let randomUser;
      let attempts = 0;
      do {
        randomUser = this.random(allUsers);
        attempts++;
      } while (usedUsers.has(randomUser._id) && attempts < 50);
      
      if (!usedUsers.has(randomUser._id)) {
        likeIds.push(randomUser._id);
        usedUsers.add(randomUser._id);
      }
    }
    
    const post = {
      _id: `post_${index}_${Date.now()}_${this.randomInt(10000, 99999)}`,
      user: {
        _id: user._id,
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        profilePhoto: user.profilePhoto,
        verified: user.verified,
        isVerified: user.isVerified,
        isPremium: user.isPremium,
        bio: user.bio,
        location: user.location,
        followers: [],
        following: [],
        followersCount: user.followersCount,
        followingCount: user.followingCount,
        isMockUser: true,
      },
      userId: user._id,
      author: user,
      content: finalContent,
      images,
      media: images,
      likes: likeIds,
      likesCount: likesCount,
      commentsCount: commentsCount,
      comments: [],
      shares: this.randomInt(Math.floor(likesCount * 0.01), Math.floor(likesCount * 0.05)),
      saved: false,
      liked: false,
      createdAt: this.randomDate(new Date(2024, 0, 1), new Date()),
      category: template.category,
      allowRealInteractions: true,
      isMockPost: true,
    };

    const visibleCommentCount = Math.min(commentsCount, this.randomInt(5, 15));
    const COMMENTS = [
      "Amazing!", "Love this!", "So cool!", "Wow!", "Beautiful!",
      "Trop beau!", "J'adore", "Super!", "Magnifique!", "Incroyable!",
      "Goals!", "Inspiring!", "Perfect!", "Awesome!", "Nice!",
    ];
    
    for (let i = 0; i < visibleCommentCount; i++) {
      const commenter = this.random(allUsers.filter(u => u._id !== user._id));
      post.comments.push({
        _id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user: {
          _id: commenter._id,
          fullName: commenter.fullName,
          username: commenter.username,
          profilePicture: commenter.profilePicture,
        },
        text: this.random(COMMENTS),
        likes: this.randomInt(0, Math.floor(likesCount * 0.1)),
        createdAt: this.randomDate(post.createdAt, new Date()),
      });
    }

    return post;
  }

  generate(userCount = 5000, postCount = 10000) {
    console.log(`Generating ${userCount} users...`);
    this.users = Array.from({ length: userCount }, (_, i) => this.generateUser(i));
    
    console.log(`Generating ${postCount} posts...`);
    this.posts = [];
    
    const postsPerUser = new Map();
    this.users.forEach(u => postsPerUser.set(u._id, 0));
    
    for (let i = 0; i < postCount; i++) {
      const weightedUsers = this.users.filter(u => {
        const currentPosts = postsPerUser.get(u._id);
        const maxPosts = Math.floor(u.followersCount / 100) + 5;
        return currentPosts < maxPosts;
      });
      
      const user = weightedUsers.length > 0 
        ? this.random(weightedUsers) 
        : this.random(this.users);
      
      postsPerUser.set(user._id, postsPerUser.get(user._id) + 1);
      
      const post = this.generatePost(i, user, this.users, i === 0);
      this.posts.push(post);
      
      if ((i + 1) % 1000 === 0) {
        console.log(`   ${i + 1}/${postCount} posts generated`);
      }
    }
    
    this.users.forEach(u => {
      u.postsCount = postsPerUser.get(u._id) || 0;
    });
    
    this.posts.sort((a, b) => b.createdAt - a.createdAt);
    
    return { users: this.users, posts: this.posts };
  }
}

class ProgressiveGenerator {
  constructor() {
    this.generator = new MassiveRealisticGenerator();
    this.isGenerating = false;
    this.generationProgress = 0;
  }

  async generateProgressively(userCount = 5000, postCount = 10000, options = {}) {
    const {
      userBatchSize = 100,
      postBatchSize = 100,
      onProgress = null
    } = options;

    if (this.isGenerating) {
      console.warn('⚠️ Generation already in progress...');
      return { 
        users: this.generator.users, 
        posts: this.generator.posts,
        stats: this.getStats()
      };
    }

    this.isGenerating = true;
    this.generationProgress = 0;

    console.log(`🚀 Progressive generation: ${userCount.toLocaleString()} users + ${postCount.toLocaleString()} posts`);
    
    const scheduleWork = (callback) => {
      if (typeof requestIdleCallback !== 'undefined') {
        return new Promise(resolve => {
          requestIdleCallback(() => {
            callback();
            resolve();
          }, { timeout: 2000 });
        });
      } else {
        return new Promise(resolve => {
          setTimeout(() => {
            callback();
            resolve();
          }, 0);
        });
      }
    };
    
    // GÉNÉRATION DES USERS
    const userBatches = Math.ceil(userCount / userBatchSize);
    for (let batch = 0; batch < userBatches; batch++) {
      await scheduleWork(() => {
        const start = batch * userBatchSize;
        const end = Math.min(start + userBatchSize, userCount);
        
        for (let i = start; i < end; i++) {
          this.generator.users.push(this.generator.generateUser(i));
        }

        this.generationProgress = ((batch + 1) / userBatches) * 40;
        
        if (onProgress) {
          onProgress({
            phase: 'users',
            current: end,
            total: userCount,
            percent: this.generationProgress
          });
        }
      });
    }

    console.log(`✅ ${this.generator.users.length.toLocaleString()} users generated`);

    // GÉNÉRATION DES POSTS
    const postsPerUser = new Map();
    this.generator.users.forEach(u => postsPerUser.set(u._id, 0));
    
    const postBatches = Math.ceil(postCount / postBatchSize);
    for (let batch = 0; batch < postBatches; batch++) {
      await scheduleWork(() => {
        const start = batch * postBatchSize;
        const end = Math.min(start + postBatchSize, postCount);
        
        for (let i = start; i < end; i++) {
          const weightedUsers = this.generator.users.filter(u => {
            const currentPosts = postsPerUser.get(u._id);
            const maxPosts = Math.floor(u.followersCount / 100) + 5;
            return currentPosts < maxPosts;
          });
          
          const user = weightedUsers.length > 0 
            ? this.generator.random(weightedUsers) 
            : this.generator.random(this.generator.users);
          
          postsPerUser.set(user._id, postsPerUser.get(user._id) + 1);
          this.generator.posts.push(this.generator.generatePost(i, user, this.generator.users, i === 0));
        }

        this.generationProgress = 40 + ((batch + 1) / postBatches) * 60;
        
        if (onProgress) {
          onProgress({
            phase: 'posts',
            current: end,
            total: postCount,
            percent: this.generationProgress
          });
        }
      });
    }
    
    // FINALISATION
    this.generator.users.forEach(u => {
      u.postsCount = postsPerUser.get(u._id) || 0;
    });

    this.generator.posts.sort((a, b) => b.createdAt - a.createdAt);
    console.log(`✅ ${this.generator.posts.length.toLocaleString()} posts generated and sorted`);

    this.isGenerating = false;
    this.generationProgress = 100;

    return {
      users: this.generator.users,
      posts: this.generator.posts,
      stats: this.getStats()
    };
  }

  getStats() {
    const posts = this.generator.posts;
    const users = this.generator.users;
    
    if (!users || users.length === 0 || !posts || posts.length === 0) {
      return {
        totalUsers: 0,
        totalPosts: 0,
        postsWithImages: 0,
        totalLikes: 0,
        totalComments: 0,
        avgLikes: 0,
        avgComments: 0,
        verifiedUsers: 0,
        premiumUsers: 0,
        cultures: {},
        categories: {},
      };
    }
    
    const cultureCounts = {};
    users.forEach(u => {
      cultureCounts[u.culture] = (cultureCounts[u.culture] || 0) + 1;
    });
    
    const categoryCounts = {};
    posts.forEach(p => {
      categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
    });
    
    return {
      totalUsers: users.length,
      totalPosts: posts.length,
      postsWithImages: posts.filter(p => p.images && p.images.length > 0).length,
      totalLikes: posts.reduce((sum, p) => sum + (p.likesCount || 0), 0),
      totalComments: posts.reduce((sum, p) => sum + (p.commentsCount || 0), 0),
      avgLikes: Math.floor(posts.reduce((sum, p) => sum + (p.likesCount || 0), 0) / posts.length) || 0,
      avgComments: Math.floor(posts.reduce((sum, p) => sum + (p.commentsCount || 0), 0) / posts.length) || 0,
      verifiedUsers: users.filter(u => u.verified).length,
      premiumUsers: users.filter(u => u.isPremium).length,
      cultures: cultureCounts,
      categories: categoryCounts,
    };
  }
}

// ============================================
// INITIALISATION RAPIDE (10 users, 10 posts)
// ============================================
const progressiveGen = new ProgressiveGenerator();

console.log('⚡ Ultra-fast generation (10 users, 10 posts)...');
const initialGenerator = new MassiveRealisticGenerator();
const initialData = initialGenerator.generate(10, 10);

export let MOCK_USERS = initialData.users;
export let MOCK_POSTS = initialData.posts;
export let MOCK_STATS = {
  totalUsers: MOCK_USERS.length,
  totalPosts: MOCK_POSTS.length,
  postsWithImages: MOCK_POSTS.filter(p => p.images && p.images.length > 0).length,
  totalLikes: MOCK_POSTS.reduce((sum, p) => sum + (p.likesCount || 0), 0),
  totalComments: MOCK_POSTS.reduce((sum, p) => sum + (p.commentsCount || 0), 0),
  avgLikes: Math.floor(MOCK_POSTS.reduce((sum, p) => sum + (p.likesCount || 0), 0) / MOCK_POSTS.length) || 0,
  avgComments: Math.floor(MOCK_POSTS.reduce((sum, p) => sum + (p.commentsCount || 0), 0) / MOCK_POSTS.length) || 0,
};

// ============================================
// FONCTION DE GÉNÉRATION COMPLÈTE (ASYNC)
// ============================================
export const generateFullDataset = async (onProgress) => {
  try {
    console.log('🚀 Starting MASSIVE generation in background...');
    
    const fullData = await progressiveGen.generateProgressively(5000, 10000, {
      userBatchSize: 100,
      postBatchSize: 100,
      onProgress
    });

    // PROTECTION CONTRE UNDEFINED
    if (!fullData || !fullData.stats) {
      console.error('❌ Generation failed - no stats returned');
      return null;
    }

    // MISE À JOUR DES EXPORTS
    MOCK_USERS = fullData.users;
    MOCK_POSTS = fullData.posts;
    MOCK_STATS = fullData.stats;

    // LOGS DE SUCCÈS (AVEC PROTECTION)
    console.log('========================================');
    console.log('✅ MASSIVE SOCIAL NETWORK - GENERATION COMPLETE');
    console.log('========================================');
    console.log('Users:', MOCK_STATS.totalUsers?.toLocaleString() || 'N/A');
    console.log('Posts:', MOCK_STATS.totalPosts?.toLocaleString() || 'N/A');
    console.log('Posts with images:', MOCK_STATS.postsWithImages?.toLocaleString() || 'N/A');
    console.log('Total likes:', MOCK_STATS.totalLikes?.toLocaleString() || 'N/A');
    console.log('Total comments:', MOCK_STATS.totalComments?.toLocaleString() || 'N/A');
    console.log('Verified accounts:', MOCK_STATS.verifiedUsers?.toLocaleString() || 'N/A');
    console.log('Premium accounts:', MOCK_STATS.premiumUsers?.toLocaleString() || 'N/A');
    
    if (MOCK_STATS.cultures && Object.keys(MOCK_STATS.cultures).length > 0) {
      console.log('Cultural diversity:');
      Object.entries(MOCK_STATS.cultures).forEach(([culture, count]) => {
        const total = MOCK_STATS.totalUsers || 1;
        console.log(`   ${culture}: ${count.toLocaleString()} (${((count/total)*100).toFixed(1)}%)`);
      });
    }
    console.log('========================================');

    return fullData;
    
  } catch (error) {
    console.error('❌ Error during generation:', error);
    return null;
  }
};

export default MOCK_POSTS;

console.log('✅ Initial data ready (10 users, 10 posts) - LCP optimized');
console.log('💡 Call generateFullDataset() manually to load 5000+ profiles');