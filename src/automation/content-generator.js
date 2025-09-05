import { SupabaseClient } from '../database/supabase-client.js';
import { Logger } from '../utils/logger.js';
import OpenAI from 'openai';

export class ContentGenerator {
  constructor() {
    this.logger = new Logger();
    this.db = new SupabaseClient();
    const apiKey = process.env.OPENAI_API_KEY;
    this.openai = apiKey ? new OpenAI({ apiKey }) : null;
    // Optional run context shared across accounts to enforce cross-account variety
    this.runContext = { usedImageIds: new Set() };
  }

  /**
   * Generate 3 posts with 5 images each for all active accounts
   */
  async generateDailyContent(accountUsernames = null) {
    this.logger.info('🎨 Starting daily content generation...');
    
    try {
      // Get active accounts to generate for
      const accounts = accountUsernames || await this.getActiveAccounts();
      
      if (accounts.length === 0) {
        this.logger.info('ℹ️ No active accounts found for content generation');
        return { success: true, message: 'No active accounts' };
      }

      const results = [];

      for (const account of accounts) {
        this.logger.info(`🎯 Generating content for account: ${account.username}`);
        
        try {
          const accountResults = await this.generateContentForAccount(account);
          results.push({
            account: account.username,
            success: true,
            posts: accountResults
          });
        } catch (error) {
          this.logger.error(`❌ Failed to generate content for ${account.username}: ${error.message}`);
          results.push({
            account: account.username,
            success: false,
            error: error.message
          });
        }
      }

      this.logger.info('🎉 Daily content generation complete!');
      return { success: true, results };

    } catch (error) {
      this.logger.error(`❌ Content generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate 3 posts for a specific account
   */
  async generateContentForAccount(account, options = {}) {
    const posts = [];
    
    // Get account's content strategy and preferences
    const strategy = await this.getAccountStrategy(account.username);
    const selectionMode = 'anchor_only';
    const runTag = options?.runId ? `[run:${options.runId}] ` : '';
    
    // Generate 3 different posts
    for (let i = 1; i <= 3; i++) {
      this.logger.info(`${runTag}📝 Generating post ${i}/3 for ${account.username}`);
      try {
        const post = await this.generateSinglePost(account, strategy, i, options);
        // Track image usage per source (best-effort)
        try {
          const { SupabaseClient } = await import('../database/supabase-client.js');
          const db = new SupabaseClient();
          const updates = post.images.map(img => ({
            image_id: img.id,
            source_username: img.username || img.account_username || account.username,
            used_count: 1,
            last_used: new Date().toISOString()
          }));
          for (const u of updates) {
            await db.client.from('image_usage').upsert({ image_id: u.image_id, source_username: u.source_username, last_used: u.last_used, used_count: u.used_count }, { onConflict: 'image_id' });
            await db.client.rpc('increment_image_usage', { img_id: u.image_id });
          }
        } catch (trackErr) {
          this.logger.warn(`⚠️ Image usage tracking best-effort failed: ${trackErr.message}`);
        }
        posts.push(post);
        // Track for cross-account variety within a run
        try {
          for (const img of post.images){ this.runContext.usedImageIds.add(img.id); }
        } catch(_){}
      } catch (postErr) {
        // Log and continue with next post instead of failing the entire account
        this.logger.error(`❌ Post ${i} failed for ${account.username}: ${postErr.message}`);
        continue;
      }
      // Small delay between posts to vary content
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    return posts;
  }

  /**
   * Generate a single post with 5 images
   */
  async generateSinglePost(account, strategy, postNumber, options = {}) {
    const runTag = options?.runId ? `[run:${options.runId}] ` : '';
    this.logger.info(`${runTag}🎯 Starting single post generation for ${account.username}, post ${postNumber}`);
    
    try {
      // Enforce: anchor + gender only (no fallbacks)
      const inspo = Array.isArray(strategy?.content_strategy?.inspoAccounts) ? strategy.content_strategy.inspoAccounts : [];
      const imagesPerPost = Number(strategy?.content_strategy?.selection?.imagesPerPost || 6);
      let images = [];
      let anchorVector = null;
      if (inspo.length === 0) {
        const err = `No inspoAccounts configured for @${account.username}. Please add 1-3 inspo accounts in Managed → Inspo.`;
        this.logger.error(`${runTag}❌ ${err}`);
        throw new Error(err);
      }
      this.logger.info(`${runTag}🎯 Using inspo anchors for ${account.username} (post ${postNumber}). inspo=${inspo.join(', ')}`);
      const result = await this.selectWithAnchors(account.username, strategy, imagesPerPost, postNumber, options);
      images = result.selected;
      anchorVector = result.anchor;
      if (options?.preview === true) {
        // Attach extra debug info for UI preview only
        options.__anchorExamples = result.anchorExamples;
        options.__anchorDebug = result.debug;
      }
      
      this.logger.info(`${runTag}📊 Retrieved ${images.length} selected images`);
      
      if (images.length < imagesPerPost) {
        const errorMsg = `Not enough suitable images found for ${account.username}. Found ${images.length}, need ${imagesPerPost}. Ensure inspo winners exist and source genders are labeled.`;
        this.logger.error(`❌ ${errorMsg}`);
        throw new Error(errorMsg);
      }

      let content;
      if (options?.preview === true) {
        this.logger.info(`🧪 Preview mode: skipping caption generation`);
        content = {
          theme: 'preview',
          caption: '',
          primaryAesthetic: images[0]?.aesthetic || '',
          hashtags: ''
        };
      } else {
        if (!this.openai) {
          this.logger.warn(`⚠️ OPENAI_API_KEY missing; skipping caption generation in non-preview mode`);
          content = {
            theme: 'no-ai-key',
            caption: '',
            primaryAesthetic: images[0]?.aesthetic || '',
            hashtags: ''
          };
        } else {
          this.logger.info(`🤖 Generating content with AI for ${images.length} images...`);
          // Generate caption and hashtags
          content = await this.generatePostContent(images, strategy, postNumber);
        }
      }
      
      this.logger.info(`✅ AI content generated successfully - Theme: ${content.theme}`);
      
      // Create post object
      const post = {
        accountUsername: account.username,
        postNumber,
        images: images.map(img => ({
          id: img.id,
          imagePath: img.image_path,
          aesthetic: img.aesthetic,
          colors: img.colors,
          season: img.season,
          dist: (typeof img.dist === 'number') ? img.dist : undefined
        })),
        caption: content.caption,
        hashtags: content.hashtags,
        strategy: {
          theme: content.theme,
          aesthetic: content.primaryAesthetic,
          targetAudience: strategy.target_audience
        },
        generatedAt: new Date().toISOString()
      };
      if (options?.preview === true && Array.isArray(anchorVector)) {
        post.anchor = anchorVector;
        if (Array.isArray(options.__anchorExamples)) post.anchorExamples = options.__anchorExamples;
        if (options.__anchorDebug) post.anchorDebug = options.__anchorDebug;
      }

      this.logger.info(`💾 Saving generated post to database...`);
      
      // Save to database unless preview mode
      if (!options?.preview) {
        await this.saveGeneratedPost(post);
      }
      
      this.logger.info(`${runTag}✅ Post ${postNumber} generated: ${content.theme} (${images.length} images)`);
      return post;
      
    } catch (error) {
      this.logger.error(`${runTag}❌ Failed to generate single post for ${account.username}: ${error.message}`);
      this.logger.error(`${runTag}❌ Stack trace: ${error.stack}`);
      throw error; // Re-throw to be caught by the calling function
    }
  }

  /**
   * Get curated images based on account strategy with deduplication rules
   */
  async getCuratedImages(username, strategy, count = 5, opts = {}) {
    this.logger.info(`🔍 Curating ${count} images for ${username} with deduplication rules...`);
    
    try {
      const selectionMode = opts?.selectionMode || 'rerollish';
      // Get recently used images for this account (within last 6 posts)
      this.logger.info(`📋 Checking for recently used images...`);
      const recentlyUsedImages = await this.getRecentlyUsedImages(username);
      this.logger.info(`🚫 Found ${recentlyUsedImages.length} recently used images to exclude`);
      
      // Build query based on account strategy
      this.logger.info(`🗄️ Building database query for images...`);
      let query = this.db.client
        .from('images')
        .select('id, image_path, aesthetic, colors, season, occasion, username, post_id, additional')
        .not('image_path', 'is', null); // Ensure we have valid image paths

      // Exclude recently used images (numeric IDs only) – build proper SQL list: (1,2,3)
      if (recentlyUsedImages.length > 0) {
        const numericIds = recentlyUsedImages
          .map(v => (typeof v === 'number' || /^\d+$/.test(String(v))) ? Number(v) : null)
          .filter(v => Number.isFinite(v));
        if (numericIds.length > 0) {
          const idList = `(${numericIds.join(',')})`;
          query = query.not('id', 'in', idList);
          this.logger.info(`🚫 Excluding ${numericIds.length} recently used images`);
        }
      }

      // Apply aesthetic filters if specified AND there are aesthetics available
      if (strategy.content_strategy?.aestheticFocus?.length > 0) {
        const aesthetics = strategy.content_strategy.aestheticFocus.filter(a => a && a.trim() !== '');
        if (aesthetics.length > 0) {
          this.logger.info(`🎨 Applying aesthetic filters: ${aesthetics.join(', ')}`);
          // Use direct aesthetic field matching - but don't require it to be non-null
          const aestheticConditions = aesthetics.map(a => `aesthetic.ilike.%${a}%`).join(',');
          query = query.or(`aesthetic.is.null,${aestheticConditions}`);
        }
      }

      // Apply gender preference via source account tags
      const preferredGender = (strategy?.content_strategy?.preferredGender || 'any').toLowerCase();
      if (preferredGender === 'men' || preferredGender === 'women') {
        // Join images to accounts by username and require accounts.tags @> '{preferredGender}'
        // Supabase JS can't do join directly here, so we filter by username list from accounts
        try {
          const { data: genderAccounts, error: gaErr } = await this.db.client
            .from('accounts')
            .select('username')
            .contains('tags', [preferredGender]);
          if (gaErr) throw gaErr;
          const allowedUsernames = (genderAccounts || []).map(a => a.username);
          if (allowedUsernames.length > 0) {
            query = query.in('username', allowedUsernames);
            this.logger.info(`🚻 Applied gender filter: ${preferredGender} (${allowedUsernames.length} source accounts)`);
          } else {
            this.logger.warn(`🚻 No source accounts tagged with ${preferredGender}; results may be empty`);
            // Force empty result fast to avoid misleading picks
            query = query.eq('username', '__none__');
          }
        } catch (gErr) {
          this.logger.warn(`⚠️ Gender filter lookup failed: ${gErr.message}`);
        }
      }

      // Apply color preferences if specified AND there are colors available
      if (strategy.content_strategy?.colorPalette?.length > 0) {
        const colors = strategy.content_strategy.colorPalette.filter(c => c && c.trim() !== '');
        if (colors.length > 0) {
          this.logger.info(`🌈 Applying color filters: ${colors.join(', ')}`);
          // Use direct colors field matching (array field) - but don't require it to be non-null
          const colorConditions = colors.map(c => `colors.cs.{${c}}`).join(',');
          query = query.or(`colors.is.null,${colorConditions}`);
        }
      }

      // Get recent, high-quality images
      query = query.order('created_at', { ascending: false });

      this.logger.info(`🔍 Executing database query...`);
      const { data: images, error } = await query;
      
      if (error) {
        this.logger.error(`❌ Database query failed: ${error.message}`);
        throw new Error(`Failed to fetch images: ${error.message}`);
      }

      this.logger.info(`📊 Found ${images?.length || 0} potential images for curation`);

      // Fail fast if we don't have enough images with proper filters
      if (!images || images.length < count) {
        const errorMsg = `Not enough images found with strategy filters (${images?.length || 0}/${count}). This indicates either:
1. Not enough content has been scraped and analyzed
2. The content strategy filters are too restrictive
3. Images don't match the account's aesthetic/color preferences

Please run the content pipeline to scrape more content or adjust the account's content strategy.`;
        this.logger.error(`❌ ${errorMsg}`);
        throw new Error(errorMsg);
      }

      // Selection strategy
      const selectedImages = selectionMode === 'rerollish'
        ? this.selectAlternates(images, strategy, count)
        : this.selectVariedImages(images.map(img => ({ ...img, score: this.scoreImageForAccount(img, strategy) })).sort((a,b)=>b.score-a.score), count);

      // Cross-account de-duplication within the same run
      const runUsed = this.runContext?.usedImageIds || new Set();
      const filtered = selectedImages.filter(img => !runUsed.has(img.id));
      const finalImages = filtered.length >= count ? filtered.slice(0, count) : selectedImages.slice(0, count);

      this.logger.info(`✅ Selected ${finalImages.length} images (mode=${selectionMode})`);
      return finalImages;
      
    } catch (error) {
      this.logger.error(`❌ Error in getCuratedImages: ${error.message}`);
      this.logger.error(`❌ Stack trace: ${error.stack}`);
      throw error;
    }
  }

  /**
   * Anchor-driven selection using inspo accounts' recent winners
   */
  async selectWithAnchors(username, strategy, count = 6, postNumber = 1, options = {}){
    const inspo = (strategy?.content_strategy?.inspoAccounts||[]).map(s=>String(s).replace('@',''));
    const windowDays = Number(strategy?.content_strategy?.anchorSettings?.windowDays || 90);
    const minDist = Number(strategy?.content_strategy?.selection?.minIntraPostDistance || 0.18);
    const runTag = options?.runId ? `[run:${options.runId}] ` : '';

    // Build anchor via helper (includes cover filtering and weighting)
    const { AnchorBuilder } = await import('./anchors.js');
    const ab = new AnchorBuilder();
    const { anchor, candidates } = await ab.buildAnchorsFromInspo(inspo, windowDays);
    const candidateCount = (candidates||[]).length;
    this.logger.info(`${runTag}🧱 Anchor build: inspo=${inspo.length}, windowDays=${windowDays}, candidates=${candidateCount}, anchor=${anchor? 'yes':'no'}`);
    if (!anchor) {
      const msg = `Anchor could not be built (no candidates). Ensure inspo winners exist in the last ${windowDays} days.`;
      this.logger.error(`${runTag}❌ ${msg}`);
      throw new Error(msg);
    }
    // Gender filter REQUIRED when men/women
    const preferredGender = (strategy?.content_strategy?.preferredGender || 'any').toLowerCase();
    let usernamesFilter = null;
    if (preferredGender === 'men' || preferredGender === 'women') {
      try {
        const { data: genderAccounts } = await this.db.client
          .from('accounts')
          .select('username')
          .contains('tags', [preferredGender]);
        const cnt = Array.isArray(genderAccounts) ? genderAccounts.length : 0;
        this.logger.info(`${runTag}🚻 Gender filter: preferred=${preferredGender}, matchedSources=${cnt}`);
        if (!cnt) {
          const msg = `No source accounts tagged with '${preferredGender}'. Label sources in Sources → Gender.`;
          this.logger.error(`${runTag}❌ ${msg}`);
          throw new Error(msg);
        }
        usernamesFilter = genderAccounts.map(a => a.username);
      } catch(_) {}
    }
    const nn = await ab.nearestBySql(anchor, 120, usernamesFilter);
    this.logger.info(`${runTag}🔎 Nearest search: k=120, usernamesFilter=${Array.isArray(usernamesFilter)?usernamesFilter.length:'—'}, returned=${Array.isArray(nn)?nn.length:0}`);
    // Fetch embeddings for spacing if not present
    const ids = (nn||[]).map(r => r.id);
    let embMap = new Map();
    if (ids.length) {
      const { data: embRows } = await this.db.client
        .from('images')
        .select('id, embedding, username')
        .in('id', ids);
      for (const row of (embRows||[])) {
        if (Array.isArray(row.embedding)) embMap.set(row.id, row.embedding);
      }
    }
    // Enforce spacing
    function cosine(a,b){ let s=0; for (let i=0;i<a.length;i++) s+= a[i]*b[i]; return s; }
    const used = [];
    function distOf(a,b){ return 1 - cosine(a,b); }
    for (const r of (nn||[])){
      if (used.length >= count) break;
      const rEmb = embMap.get(r.id);
      if (!Array.isArray(rEmb)) continue;
      if (!used.some(u => distOf(u._embedding, rEmb) < minDist)) used.push({ ...r, _embedding: rEmb, dist: distOf(anchor, rEmb) });
    }
    // No fallback fill — strict mode
    // Build top-weighted examples that formed the anchor
    const examples = (candidates||[])
      .map(r => ({ id: r.id, image_path: r.image_path, username: r.username, dist: distOf(anchor, r.embedding), weight: ab.weightFor(r._post.created_at, r._post.engagement_rate) }))
      .sort((a,b) => b.weight - a.weight)
      .slice(0, 12);
    // Debug stats for UI
    const dists = used.map(u => u.dist).filter(x => typeof x === 'number' && isFinite(x));
    const dbg = {
      runId: options?.runId || null,
      windowDays,
      preferredGender,
      usernamesFilterCount: Array.isArray(usernamesFilter)?usernamesFilter.length:0,
      candidateCount: (candidates||[]).length,
      nnCount: (nn||[]).length,
      selectedCount: used.length,
      minDist: dists.length? Math.min(...dists): null,
      maxDist: dists.length? Math.max(...dists): null,
      avgDist: dists.length? dists.reduce((s,v)=>s+v,0)/dists.length: null
    };
    this.logger.info(`${runTag}✅ Selected ${used.length}/${count} images (minDist=${dbg.minDist?.toFixed?.(3) ?? '-'}, avg=${dbg.avgDist?.toFixed?.(3) ?? '-'}, max=${dbg.maxDist?.toFixed?.(3) ?? '-'})`);
    return { selected: used.slice(0, count).map(({ _embedding, ...rest }) => rest), anchor, anchorExamples: examples, debug: dbg };
  }

  /**
   * Get recently used images for an account (within last 6 posts worth)
   */
  async getRecentlyUsedImages(username) {
    try {
      // Get the last 6 generations for this account
      // Handle both old schema (image_paths) and new schema (images)
      const { data: recentGenerations, error: genError } = await this.db.client
        .from('generated_posts')
        .select('images, image_paths')
        .eq('account_username', username)
        .order('created_at', { ascending: false })
        .limit(6);

      if (genError) {
        this.logger.error(`Error fetching recent generations: ${genError.message}`);
        return [];
      }

      // Extract all image IDs from recent posts
      const usedImageIds = new Set();
      recentGenerations?.forEach(generation => {
        // Try new schema first (images column with full objects)
        if (generation.images && Array.isArray(generation.images)) {
          generation.images.forEach(img => {
            if (img.id) usedImageIds.add(img.id);
          });
        }
        // Fallback to old schema (image_paths column with just paths)
        else if (generation.image_paths && Array.isArray(generation.image_paths)) {
          // For image_paths, we can't get IDs directly, so this is less effective
          // but still prevents some duplication
          generation.image_paths.forEach(path => {
            // Try to extract a unique identifier from the path if possible
            const pathId = path.split('/').pop()?.split('.')[0];
            if (pathId) usedImageIds.add(pathId);
          });
        }
      });

      return Array.from(usedImageIds);
    } catch (error) {
      this.logger.error(`Error getting recently used images: ${error.message}`);
      return [];
    }
  }

  /**
   * Score an image based on how well it fits the account strategy
   */
  scoreImageForAccount(image, strategy) {
    let score = 0;

    // Base score for having a valid image
    score += 10;

    // Aesthetic matching (require aesthetic data for proper scoring)
    if (strategy.content_strategy?.aestheticFocus?.length > 0) {
      const aesthetics = (strategy.content_strategy.aestheticFocus || []).filter(a => a && a.trim() !== '');
      if (aesthetics.length > 0) {
        if (!image.aesthetic) {
          // Fail fast - image missing required aesthetic data
          throw new Error(`Image ${image.id} is missing aesthetic data, which is required for proper content strategy matching. Please re-analyze this image.`);
        }
        if (aesthetics.some(a => image.aesthetic.toLowerCase().includes(a.toLowerCase()))) {
          score += 20;
        }
      }
    }

    // Color matching (require color data for proper scoring)
    if (strategy.content_strategy?.colorPalette?.length > 0) {
      const colors = (strategy.content_strategy.colorPalette || []).filter(c => c && c.trim() !== '');
      if (colors.length > 0) {
        if (!image.colors || !Array.isArray(image.colors)) {
          // Fail fast - image missing required color data
          throw new Error(`Image ${image.id} is missing color data, which is required for proper content strategy matching. Please re-analyze this image.`);
        }
        if (colors.some(c => image.colors.some(imgColor => imgColor.toLowerCase().includes(c.toLowerCase())))) {
          score += 15;
        }
      }
    }

    // Season relevance (require season data for proper scoring)
    const currentMonth = new Date().getMonth();
    const currentSeason = this.getCurrentSeason(currentMonth);
    if (!image.season) {
      // Fail fast - image missing required season data
      throw new Error(`Image ${image.id} is missing season data, which is required for proper content strategy matching. Please re-analyze this image.`);
    }
    if (image.season.toLowerCase().includes(currentSeason.toLowerCase())) {
      score += 10;
    }

    // Additional traits matching (require additional data for proper scoring)
    if (strategy.content_strategy?.aestheticFocus?.length > 0) {
      if (!image.additional || !Array.isArray(image.additional)) {
        // Fail fast - image missing required additional traits data
        throw new Error(`Image ${image.id} is missing additional traits data, which is required for proper content strategy matching. Please re-analyze this image.`);
      }
      const additionalTraits = image.additional.map(trait => trait.toLowerCase());
      const aesthetics = strategy.content_strategy.aestheticFocus.filter(a => a && a.trim() !== '');
      if (aesthetics.some(aesthetic => additionalTraits.some(trait => trait.includes(aesthetic.toLowerCase())))) {
        score += 5;
      }
    }

    // Bonus for recent images (more likely to be current trends)
    if (image.created_at) {
      const imageDate = new Date(image.created_at);
      const now = new Date();
      const daysDiff = (now - imageDate) / (1000 * 60 * 60 * 24);
      
      if (daysDiff < 30) {
        score += 5; // Recent images get bonus
      } else if (daysDiff < 90) {
        score += 2; // Somewhat recent images get smaller bonus
      }
    }

    return score;
  }

  /**
   * Select varied images to avoid repetition - RULE: Never use same image twice in one post
   */
  selectVariedImages(scoredImages, count) {
    const selected = [];
    const usedImageIds = new Set();
    const usedAesthetics = new Set();
    const usedAccounts = new Set();

    for (const image of scoredImages) {
      if (selected.length >= count) break;

      // RULE 1: Never use the same image twice in one post
      if (usedImageIds.has(image.id)) continue;

      // Avoid too many from same aesthetic or account for variety
      const aesthetic = image.aesthetic?.toLowerCase() || 'unknown';
      const account = image.username;

      if (usedAesthetics.has(aesthetic) && usedAesthetics.size < 3) continue;
      if (usedAccounts.has(account) && usedAccounts.size < 2) continue;

      selected.push(image);
      usedImageIds.add(image.id);
      usedAesthetics.add(aesthetic);
      usedAccounts.add(account);
    }

    // Fill remaining slots if needed (still respecting no-duplicate rule)
    while (selected.length < count && selected.length < scoredImages.length) {
      for (const image of scoredImages) {
        if (selected.length >= count) break;
        if (!usedImageIds.has(image.id)) {
          selected.push(image);
          usedImageIds.add(image.id);
        }
      }
    }

    return selected;
  }

  /**
   * Reroll-like selector: lightly shuffle, then bias by score and enforce variety/uniqueness
   */
  selectAlternates(baseImages, strategy, count){
    const scored = baseImages.map(img => ({ ...img, score: this.safeScore(img, strategy) }));
    // Light shuffle to avoid deterministic top-N sameness
    const shuffled = scored.sort(()=> Math.random() - 0.35);
    // Sort with bias but retain some shuffle ordering
    const ranked = shuffled.sort((a,b)=> (b.score + Math.random()*5) - (a.score + Math.random()*5));
    return this.selectVariedImages(ranked, count);
  }

  safeScore(image, strategy){
    try { return this.scoreImageForAccount(image, strategy); } catch { return 0; }
  }

  /**
   * Generate caption and hashtags using AI
   */
  async generatePostContent(images, strategy, postNumber) {
    const aesthetics = [...new Set(images.map(img => img.aesthetic).filter(Boolean))];
    const colors = [...new Set(images.map(img => img.colors).filter(Boolean))];
    const seasons = [...new Set(images.map(img => img.season).filter(Boolean))];

    const prompt = `Create TikTok content for post ${postNumber} featuring these fashion elements:

AESTHETICS: ${aesthetics.join(', ')}
COLORS: ${colors.join(', ')}
SEASONS: ${seasons.join(', ')}

ACCOUNT STRATEGY:
- Target Audience: ${JSON.stringify(strategy.target_audience)}
- Content Focus: ${JSON.stringify(strategy.content_strategy)}
- Performance Goals: ${JSON.stringify(strategy.performance_goals)}

Instructions:
- Write a very short, simple caption (1-2 sentences, very basic, easy to read, with 1-2 emojis that match the theme)
- At the end of the caption, add all hashtags as one block (not as a separate list)
- Hashtags must match the theme and ALWAYS include: #pinterest #aestheticmoodboard #fashionmoodboard
- Make sure both caption and hashtags are appropriate for the theme and target audience

Return JSON with:
- theme: A catchy theme/concept for the post
- caption: Short, simple caption (1-2 sentences, 1-2 emojis, with all hashtags at the end as one block)
- primaryAesthetic: The main aesthetic this post focuses on

Be authentic, fun, and keep it very simple for TikTok teens.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 300
    });

    return JSON.parse(response.choices[0].message.content);
  }

  /**
   * Get account strategy from database
   */
  async getAccountStrategy(username) {
    const { data: profile, error } = await this.db.client
      .from('account_profiles')
      .select('*')
      .eq('username', username)
      .single();

    if (error) {
      throw new Error(`Database error fetching account strategy for ${username}: ${error.message}`);
    }

    if (!profile) {
      throw new Error(`No account profile found for ${username}. This indicates either:
1. The account profile hasn't been created yet
2. The account username is incorrect
3. The account profile was deleted

Please create an account profile for ${username} through the web interface or API.`);
    }

    return profile;
  }

  /**
   * Get active accounts for content generation
   */
  async getActiveAccounts() {
    const { data: accounts, error } = await this.db.client
      .from('account_profiles')
      .select('username, display_name, content_strategy, target_audience, performance_goals')
      .eq('is_active', true)
      .eq('account_type', 'owned');

    if (error) {
      throw new Error(`Database error fetching active accounts: ${error.message}`);
    }

    if (!accounts || accounts.length === 0) {
      throw new Error(`No active accounts found. This indicates either:
1. No account profiles have been created yet
2. All account profiles are set to inactive (is_active = false)
3. All account profiles are not set to 'owned' type

Please create at least one active account profile through the web interface or API.`);
    }

    return accounts;
  }

  /**
   * Save generated post to database and track image usage
   */
  async saveGeneratedPost(post) {
    const generationId = `daily_${Date.now()}_${post.postNumber}`;
    
    try {
      // Prepare the basic post data that should always work
      const basePostData = {
        account_username: post.accountUsername,
        generation_id: generationId,
        post_number: post.postNumber,
        image_paths: post.images.map(img => img.imagePath),
        caption: post.caption,
        hashtags: post.hashtags,
        status: 'generated',
        platform: 'pending',
        created_at: post.generatedAt
      };

      // Try to save with the images column first
      let saveError = null;
      try {
        const { error } = await this.db.client
          .from('generated_posts')
          .insert({
            ...basePostData,
            images: post.images // Try to include full image data
          });
        
        saveError = error;
      } catch (err) {
        saveError = err;
      }

      // If that failed due to the images column, try without it
      if (saveError && (
        saveError.message.includes('images') || 
        saveError.message.includes('column') ||
        saveError.message.includes('schema cache')
      )) {
        this.logger.warn('⚠️ Images column issue detected, saving without full image data');
        
        const { error: retryError } = await this.db.client
          .from('generated_posts')
          .insert(basePostData);
        
        if (retryError) {
          throw new Error(`Failed to save post (retry): ${retryError.message}`);
        }
      } else if (saveError) {
        throw new Error(`Failed to save post: ${saveError.message}`);
      }

      this.logger.info(`💾 Saved generated post ${generationId} to database`);

      // Track image usage for the 6-post cooldown rule (optional, don't fail if this breaks)
      try {
        await this.trackImageUsage(post.accountUsername, generationId, post.images, post.postNumber);
      } catch (trackingError) {
        this.logger.warn(`⚠️ Image usage tracking failed: ${trackingError.message}`);
        // Don't fail the whole operation if tracking fails
      }
      
    } catch (error) {
      this.logger.error(`❌ Error saving generated post: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get current season based on month
   */
  getCurrentSeason(month) {
    if (month >= 11 || month <= 1) {
      return 'winter';
    } else if (month >= 2 && month <= 4) {
      return 'spring';
    } else if (month >= 5 && month <= 7) {
      return 'summer';
    } else {
      return 'autumn';
    }
  }

  /**
   * Track image usage for cooldown enforcement - RULE: 6 post cooldown before reuse
   */
  async trackImageUsage(accountUsername, generationId, images, postNumber) {
    try {
      // Check if image_usage table exists, if not skip tracking for now
      const usageRecords = images.map(img => ({
        image_id: img.id,
        account_username: accountUsername,
        generation_id: generationId,
        post_number: postNumber,
        used_at: new Date().toISOString()
      }));

      // Try to insert usage records
      const { error } = await this.db.client
        .from('image_usage')
        .insert(usageRecords);

      if (error && !error.message.includes('relation "image_usage" does not exist')) {
        this.logger.error(`Failed to track image usage: ${error.message}`);
      } else if (!error) {
        this.logger.info(`✅ Tracked usage of ${images.length} images for ${accountUsername}`);
      }
    } catch (error) {
      // Don't fail the whole generation if tracking fails
      this.logger.error(`Image usage tracking error: ${error.message}`);
    }
  }
} 