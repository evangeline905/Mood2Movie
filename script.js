const textarea = document.getElementById('wish');
const chips = document.getElementById('chips');
const goBtn = document.getElementById('go');
const stopBtn = document.getElementById('stop');
const toast = document.getElementById('toast');
const resultsCard = document.getElementById('results-card');
const statusEl = document.getElementById('status');
const downloadEl = document.getElementById('download');
const barInner = document.getElementById('bar-inner');
const pctEl = document.getElementById('download-pct');
const resultEl = document.getElementById('result');
const cardsEl = document.getElementById('cards');
const countEl = document.getElementById('count');
const refreshBtn = document.getElementById('refresh');
const userBadgeEl = document.getElementById('user-badge');
const wishLabelEl = document.querySelector('label[for="wish"]');
const DEFAULT_WISH_LABEL = 'Describe the genre, plot, or mood you’re interested in, and I’ll match movies to it.';
const accountLink = document.getElementById('account-link');

const genQuotesEl = document.getElementById('gen-quotes');
const genQuoteEl = document.getElementById('gen-quote');
const GEN_QUOTES = [
  "Popcorn’s popping, mood’s loading…",
  "Cue the lights… matching your vibe now.",
  "Matching your movie energy — this might take a few magic seconds.",
  "Finding a story that understands you takes a little patience.",
  "Every emotion deserves a scene — we’re finding yours."
];
let genQuoteTimer = null;
let genQuoteEndHandler = null;
function showGenQuotes() {
  try { if (genQuotesEl) genQuotesEl.hidden = false; } catch {}
}
function hideGenQuotes() {
  try { if (genQuotesEl) genQuotesEl.hidden = true; } catch {}
}
function applyMarqueeOnce() {
  // 重置动画以便重新播放
  genQuoteEl.style.animation = 'none';
  // 触发重绘
  void genQuoteEl.offsetWidth;
  genQuoteEl.style.animation = 'gen-marquee 8s linear forwards';
}
function startGenQuotes() {
  if (!genQuotesEl || !genQuoteEl) return;
  let idx = -1;
  const next = () => {
    idx = (idx + 1) % GEN_QUOTES.length;
    genQuoteEl.textContent = GEN_QUOTES[idx];
    applyMarqueeOnce();
  };
  // 移除旧的监听以免重复绑定
  try { if (genQuoteEndHandler) genQuoteEl.removeEventListener('animationend', genQuoteEndHandler); } catch {}
  genQuoteEndHandler = () => { next(); };
  genQuoteEl.addEventListener('animationend', genQuoteEndHandler);
  showGenQuotes();
  next();
}
function stopGenQuotes() {
  try { clearInterval(genQuoteTimer); } catch {}
  genQuoteTimer = null;
  // 停止动画并移除监听
  try {
    genQuoteEl.style.animation = 'none';
    if (genQuoteEndHandler) genQuoteEl.removeEventListener('animationend', genQuoteEndHandler);
  } catch {}
  genQuoteEndHandler = null;
  hideGenQuotes();
}

let controller = null;
let session = null;
// 标记是否曾经有过有效会话，用于避免初始化时的误报“Signed out”
let hadAuthSession = false;

// Supabase client (injected in index.html)
const supabase = typeof window !== 'undefined' ? window.supabaseClient : null;
async function getSupabaseUserId() {
  try {
    const storedSession = localStorage.getItem('supabase.auth.token');
    if (!storedSession) return null;
    
    const sessionData = JSON.parse(storedSession);
    return sessionData.user?.id || null;
  } catch (error) {
    console.error('Error getting user ID from stored session:', error);
    return null;
  }
}
async function upsertMovieToCloud(item, poster) {
  try {
    if (!supabase) return null;
    const uid = await getSupabaseUserId();
    if (!uid) return null; // 需要登录后才写入云端
    const payload = {
      title: (item.title || '').trim(),
      year: item.year || null,
      poster_url: poster || (item.posterUrl || ''),
    };
    const { data: row, error } = await supabase
      .from('movies')
      .upsert(payload, { onConflict: 'title,year' })
      .select('id')
      .single();
    if (error) throw error;
    return row?.id || null;
  } catch (e) {
    console.warn('upsertMovieToCloud failed:', e?.message || e);
    return null;
  }
}
async function setFavoriteMarkInCloud(item, poster) {
  try {
    if (!supabase) {
      console.log('setFavoriteMarkInCloud: No supabase client');
      return false;
    }
    const uid = await getSupabaseUserId();
    if (!uid) {
      console.log('setFavoriteMarkInCloud: No user ID');
      showToast('Sign in to sync favourites to cloud');
      return false;
    }
    console.log('setFavoriteMarkInCloud: Saving favorite for user', uid, 'movie:', item.title);
    const movieId = await upsertMovieToCloud(item, poster);
    if (!movieId) {
      console.log('setFavoriteMarkInCloud: Failed to get movie ID');
      return false;
    }
    console.log('setFavoriteMarkInCloud: Got movie ID', movieId, 'for', item.title);
    const { error } = await supabase
      .from('user_movie_marks')
      .upsert({ user_id: uid, movie_id: movieId, mark: 'favorite' }, { onConflict: 'user_id,movie_id,mark' });
    if (error) throw error;
    console.log('setFavoriteMarkInCloud: Successfully saved favorite for', item.title);
    return true;
  } catch (e) {
    console.warn('setFavoriteMarkInCloud failed:', e?.message || e);
    return false;
  }
}

async function setWatchedMarkInCloud(item, poster) {
  try {
    if (!supabase) return false;
    const uid = await getSupabaseUserId();
    if (!uid) {
      showToast('Sign in to sync watched to cloud');
      return false;
    }
    console.log('Saving watched movie to cloud:', { title: item.title, uid });
    const movieId = await upsertMovieToCloud(item, poster);
    if (!movieId) return false;
    const { error } = await supabase
      .from('user_movie_marks')
      .upsert({ user_id: uid, movie_id: movieId, mark: 'watched' }, { onConflict: 'user_id,movie_id,mark' });
    if (error) throw error;
    console.log('Successfully saved watched movie to cloud:', { title: item.title, movieId });
    return true;
  } catch (e) {
    console.warn('setWatchedMarkInCloud failed:', e?.message || e);
    return false;
  }
}

// Remove a specific mark for current user by title/year
async function removeCloudMarkByTitleYear(mark, title, year, id) {
  try {
    if (!supabase) return;
    const uid = await getSupabaseUserId();
    if (!uid) return;
    let movieId = id;
    if (!movieId) {
      const { data: row } = await supabase
        .from('movies')
        .select('id')
        .eq('title', (title || '').trim())
        .eq('year', year || null)
        .single();
      movieId = row?.id;
    }
    if (!movieId) return;
    const { error } = await supabase
      .from('user_movie_marks')
      .delete()
      .eq('user_id', uid)
      .eq('movie_id', movieId)
      .eq('mark', mark);
    if (error) throw error;
  } catch (e) {
    console.warn('removeCloudMarkByTitleYear failed:', e?.message || e);
  }
}
async function fetchCloudFavorites() {
  try {
    if (!supabase) return [];
    const uid = await getSupabaseUserId();
    if (!uid) return [];
    const { data: marks, error: mErr } = await supabase
      .from('user_movie_marks')
      .select('movie_id')
      .eq('user_id', uid)
      .eq('mark', 'favorite');
    if (mErr) throw mErr;
    const ids = (marks || []).map((m) => m.movie_id).filter(Boolean);
    if (!ids.length) return [];
    const { data: movies, error: vErr } = await supabase
      .from('movies')
      .select('id,title,year')
      .in('id', ids);
    if (vErr) throw vErr;
    return movies || [];
  } catch (e) {
    console.warn('fetchCloudFavorites failed:', e?.message || e);
    return [];
  }
}

function updateWishLabel(user) {
  try {
    if (!wishLabelEl) return;
    if (user) {
      const name = user.user_metadata?.full_name || user.email || user.id;
      wishLabelEl.textContent = `${name}, ${DEFAULT_WISH_LABEL}`;
    } else {
      wishLabelEl.textContent = DEFAULT_WISH_LABEL;
    }
  } catch {}
}

async function updateUserBadge() {
  try {
    if (!userBadgeEl || !supabase) return;
    const { data } = await supabase.auth.getSession();
    const user = data?.session?.user || null;
    const displayName = user ? (user.user_metadata?.full_name || user.email || user.id) : null;
    if (displayName) {
      userBadgeEl.textContent = displayName;
    } else {
      userBadgeEl.textContent = 'Not signed in';
    }
    updateWishLabel(user);
    updateAuthNav(user);
  } catch {}
}

function updateAuthNav(user) {
  try {
    if (!accountLink) return;
    // 始终保持为“Account”链接到账号页，避免误触导致登出
    accountLink.textContent = 'Account';
    accountLink.setAttribute('aria-label', 'Account');
    accountLink.href = 'auth.html';
    accountLink.onclick = null;
  } catch {}
}

// 禁用 Supabase 的认证状态监听器，我们手动管理会话
// if (supabase && supabase.auth) {
//   try {
//     let signedOutTimer = null;
//     function logAuthEvent(evt, sess) {
//       try {
//         const uid = sess?.user?.id || null;
//         const item = { evt, uid, when: new Date().toISOString() };
//         const list = JSON.parse(localStorage.getItem('m2m_auth_events') || '[]');
//         list.push(item);
//         if (list.length > 50) list.splice(0, list.length - 50);
//         localStorage.setItem('m2m_auth_events', JSON.stringify(list));
//       } catch {}
//     }
//     supabase.auth.onAuthStateChange(async (event, sess) => {
//       // 记录是否曾出现有效会话
//       try { hadAuthSession = hadAuthSession || !!(sess && sess.user); } catch {}
//       // 记录日志
//       try { logAuthEvent(event, sess); } catch {}
//       if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
//         await updateUserBadge();
//         if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
//           try {
//             const favs = await fetchCloudFavorites();
//             const titles = new Set(favs.map((f) => f.title));
//             document.querySelectorAll('.ticket-page').forEach((pg) => {
//               const name = pg.querySelector('.ticket-title')?.textContent?.trim();
//               if (name && titles.has(name)) {
//                 setMark(name, 'favorite', true);
//                 pg.querySelector('.wish-btn')?.classList.add('active');
//               }
//             });
//           } catch {}
//         }
//       } else if (event === 'SIGNED_OUT') {
//         // 去抖处理，避免导航或初始化期间的误报
//         try { if (signedOutTimer) clearTimeout(signedOutTimer); } catch {}
//         if (hadAuthSession) {
//           signedOutTimer = setTimeout(async () => {
//             try {
//               const { data } = await supabase.auth.getSession();
//               if (data?.session?.user) {
//                 await updateUserBadge();
//               } else {
//                 showToast('Signed out');
//                 await updateUserBadge();
//               }
//             } catch {
//               showToast('Signed out');
//               await updateUserBadge();
//             }
//           }, 500);
//         }
//       }
//     });
//     // Ensure session restored then update badge
//     try {
//       const { data } = await supabase.auth.getSession();
//       if (data?.session?.user) hadAuthSession = true;
//     } catch {}
//     updateUserBadge();
//   } catch {}
// }

// TMDB credentials (can be overridden via window.TMDB_READ_TOKEN / window.TMDB_API_KEY)
// 注意：在生产环境中，这些密钥应该通过环境变量或服务器端API提供
const TMDB_READ_TOKEN = window.TMDB_READ_TOKEN || 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIxYjMzODhiMTFiMWM4NjI3ZmZlMWU2OTAxYTg4OWM0ZiIsIm5iZiI6MTc2MDIwODY4My40NTIsInN1YiI6IjY4ZWFhNzJiOGY3OTNkZTRlNzFmNjczMiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.ijIF_j2ZesTQNkmgfzogTL0y1DBLUFQ-CfVBSErxPZQ';
const TMDB_API_KEY = window.TMDB_API_KEY || '1b3388b11b1c8627ffe1e6901a889c4f';

chips.addEventListener('click', (e) => {
  const t = e.target;
  if (t.classList.contains('chip')) {
    const text = t.textContent.trim();
    textarea.value = text; // 直接替换，而不是追加
    textarea.focus();
  }
});

goBtn.addEventListener('click', () => {
  startRecommendation();
});

refreshBtn?.addEventListener('click', () => {
  refreshRecommendations();
});

stopBtn?.addEventListener('click', () => {
  if (controller) controller.abort();
  setStatus('Stopped');
  stopGenQuotes();
});


// Restore last items on page load - use DOMContentLoaded to ensure DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('DOM loaded, attempting to restore items...');
    await restoreLastItems();
    console.log('Items restored successfully');
  } catch (error) {
    console.error('Failed to restore items on DOM load:', error);
  }
});

async function startRecommendation(reroll = false) {
  const content = textarea.value.trim();
  if (!content) {
    showToast('请先描述你想看的电影，再开始推荐～');
    return;
  }
  
  // 保存用户输入，以便Refresh Batch使用
  localStorage.setItem('m2m_last_input', content);

  resultsCard.hidden = false;
  setStatus('Checking availability…');
  
  // 禁用Generate按钮，显示生成中状态
  goBtn.disabled = true;
  goBtn.textContent = 'Generating...';
  goBtn.classList.add('generating');

  if (!('LanguageModel' in globalThis)) {
    setStatus('API unavailable');
    showToast('Prompt API is disabled. Please enable it in Chrome 138+ (flags).');
    // 恢复Generate按钮状态
    goBtn.disabled = false;
    goBtn.textContent = 'Generate';
    goBtn.classList.remove('generating');
    return;
  }

  const availability = await LanguageModel.availability();
  setStatus(`Status: ${availability}`);
  if (availability === 'unavailable') {
    showToast('Device or environment does not meet the requirements (disk/memory/GPU).');
    // 恢复Generate按钮状态
    goBtn.disabled = false;
    goBtn.textContent = 'Generate';
    goBtn.classList.remove('generating');
    return;
  }

  controller = new AbortController();
  // 将用户描述当作心情/场景，其余通过全局变量或默认值注入
  const mood = content;
  window.lastUserMood = mood;
  const lang = (window.USER_LANG || 'English');
  const liked_titles = Array.isArray(window.USER_LIKED_TITLES)
    ? window.USER_LIKED_TITLES.join(', ')
    : (window.USER_LIKED_TITLES || '');
  const excludes = Array.isArray(window.USER_EXCLUDES)
    ? window.USER_EXCLUDES.join(', ')
    : (window.USER_EXCLUDES || '');
  const providers = Array.isArray(window.USER_PROVIDERS)
    ? window.USER_PROVIDERS.join(', ')
    : (window.USER_PROVIDERS || '');
  const region = (window.USER_REGION || '');
  const prevTitlesArr = Array.isArray(window.lastTitles) ? window.lastTitles : [];
  const prevTitles = prevTitlesArr.length ? prevTitlesArr.join(', ') : '';
  
  // 获取用户已观看的电影标题，避免重复推荐
  const watchedTitles = getWatchedTitles();
  const watchedTitlesStr = watchedTitles.length ? watchedTitles.join(', ') : '';
  
         // 如果用户已经观看了某些电影，在prompt中明确禁止推荐
         const exclusionRule = watchedTitlesStr ? 
           `\n\n🚫 ABSOLUTELY FORBIDDEN - DO NOT RECOMMEND ANY OF THESE MOVIES:\n${watchedTitlesStr}\n\nMANDATORY RULE: If you see any movie title that matches or is similar to the above list, DO NOT include it in your recommendations. This is a hard requirement that cannot be violated.` : '';
  try {
    session = await LanguageModel.create({
      signal: controller.signal,
      language: 'en', // 指定输出语言为英语
      initialPrompts: [{
        role: 'system',
         content: `You are Mood2Movie, a professional AI movie curator. Based on the user's mood, preferences, and region, recommend suitable movies.\n\n**MOST IMPORTANT RULE**: NEVER recommend any movie that the user has already watched. This is the #1 priority.\n\nRequirements:\n1. Output MUST be strict JSON and follow the schema exactly.\n2. Each recommendation is a "movie ticket" with title, short reason, watchability, rating, etc.\n3. Keep the reason short, warm, and spoiler-free.\n4. Do NOT add explanations or extra text; the JSON is the final output.\n5. Output language: English.\n6. If the user mentions titles or genres, prioritize semantically related films.\n7. Recommend 3 movies each time.\n8. If user requests a reroll, avoid repeating titles from the previous batch.\n9. **CRITICAL**: NEVER recommend movies that the user has already watched. Check the "Already watched movies" list carefully.\n\nOutput format (strict JSON):\n{\n  "recommendations": [\n    {\n      "title": "string(movie title)",\n      "year": "number(release year)",\n      "reason": "string(≤ 40 words)",\n      "genres": ["string"],\n      "rating": "number(0~10)",\n      "runtime": "string(e.g., '102 min')",\n      "country": "string",\n      "availability": "string(e.g., 'Available on Netflix' or 'Disney+')",\n      "poster": "string(poster URL)",\n      "match_score": "number(0~100)",\n      "user_mood": "string(user mood)",\n      "recommendation_id": "string(e.g., 'M2M-{{date}}-001')",\n      "theme_color": "string(e.g., '#EAE0C8')"\n    }\n  ]\n}\n\nContext:\nUser mood: ${mood}\nPreferred language: ${lang}\nLiked titles: ${liked_titles}\nExclude titles: ${excludes}${exclusionRule}\nProviders: ${providers}\nRegion: ${region}${prevTitles ? `\nPrevious batch titles (avoid duplicates): ${prevTitles}` : ''}\n\n**FINAL REMINDER**: Before outputting any movie title, double-check that it is NOT in the forbidden list above. If you see any similarity, choose a different movie instead.\n\nReturn ONLY the JSON that follows the schema above; no extra text.`,
      }],
      monitor(m) {
        downloadEl.hidden = false;
        m.addEventListener('downloadprogress', (e) => {
          const pct = Math.round(e.loaded * 100);
          barInner.style.width = `${pct}%`;
          pctEl.textContent = pct + '%';
          if (pct >= 100) setTimeout(() => (downloadEl.hidden = true), 500);
        });
      },
    });
  } catch (err) {
    console.error(err);
    showToast('Failed to create model session: ' + err.message);
    return;
  }

  setStatus('Generating…');
  showGenQuotes();
  startGenQuotes();
  resultEl.textContent = '';
  cardsEl.innerHTML = '';
  countEl.textContent = '';
  try {
    const promptText = reroll ? 'Refresh batch' : 'Generate';
    const stream = session.promptStreaming(promptText);
    let hasStreamOutput = false;
    let finalText = '';
    for await (const chunk of stream) {
      hasStreamOutput = true;
      // 兼容不同流事件：output_text_delta（增量）与 output_text（完整）
      let piece = '';
      if (typeof chunk === 'string') {
        piece = chunk;
        finalText += piece;
      } else if (chunk?.type === 'output_text_delta') {
        piece = chunk.delta ?? '';
        finalText += piece;
      } else if (chunk?.type === 'output_text') {
        piece = chunk.text ?? '';
        finalText = piece; // 将完整文本覆盖为最终结果
      } else {
        piece = chunk?.text ?? '';
        finalText += piece;
      }
      resultEl.textContent = finalText || piece;
    }
    // 兜底：若流式没有内容，改用非流式一次性获取结果
    if (!hasStreamOutput || !resultEl.textContent) {
      const final = await session.prompt(promptText);
      const text = typeof final === 'string'
        ? final
        : (final?.text ?? JSON.stringify(final));
      resultEl.textContent = text;
      finalText = text;
    }
    // 解析并渲染卡片（优先解析 JSON）
    let parsed = parseJsonRecommendations(finalText) || parseRecommendations(finalText);
    let items = Array.isArray(parsed?.recommendations) ? parsed.recommendations : parsed;
    // 若流式文本难以解析，使用一次性 prompt 兜底
    if (!items || items.length === 0) {
      const final = await session.prompt(promptText);
      const text = typeof final === 'string' ? final : (final?.text ?? JSON.stringify(final));
      resultEl.textContent = text;
      finalText = text;
      parsed = parseJsonRecommendations(finalText) || parseRecommendations(finalText);
      items = Array.isArray(parsed?.recommendations) ? parsed.recommendations : parsed;
    }
    const limited = (items || []).slice(0, 3); // 获取3部电影
    
    // 过滤掉已观看的电影
    const watchedTitles = getWatchedTitles();
    const filtered = limited.filter(item => {
      const title = item.title || '';
      const isWatched = watchedTitles.some(watchedTitle => {
        // 检查标题是否匹配或相似
        return title.toLowerCase().includes(watchedTitle.toLowerCase()) || 
               watchedTitle.toLowerCase().includes(title.toLowerCase());
      });
      if (isWatched) {
        // 过滤掉已观看的电影
      }
      return !isWatched;
    });
    
    // 直接显示过滤后的电影（如果不足3部就显示可用的）
    renderCards(filtered);
    try { saveLastItems(filtered); } catch {}
    window.lastTitles = filtered.map(it => it.title).filter(Boolean);
    countEl.textContent = filtered.length ? `Total ${filtered.length}` : '';
    // 若无法解析为卡片，则直接展示文本内容
    resultEl.hidden = !!filtered.length;
    if (!filtered.length) {
      resultEl.textContent = finalText || 'No recommendations found.';
    }
    setStatus('Done');
    stopGenQuotes();
    // 恢复Generate按钮状态
    goBtn.disabled = false;
    goBtn.textContent = 'Generate';
    goBtn.classList.remove('generating');
  } catch (err) {
    console.error(err);
    setStatus('Error');
    stopGenQuotes();
    showToast('Generation failed: ' + err.message);
    // 恢复Generate按钮状态
    goBtn.disabled = false;
    goBtn.textContent = 'Generate';
    goBtn.classList.remove('generating');
  }
}

function refreshRecommendations() {
  const content = textarea.value.trim();
  if (!content) {
    // 如果没有输入内容，尝试使用上次的输入或默认描述
    const lastInput = localStorage.getItem('m2m_last_input') || 'I want to watch a good movie';
    textarea.value = lastInput;
    showToast('Using previous input to generate new batch...');
  } else {
    // 保存当前输入，以便下次使用
    localStorage.setItem('m2m_last_input', content);
  }
  setStatus('Refreshing batch…');
  startRecommendation(true);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  toast.setAttribute('aria-hidden', 'false');
  setTimeout(() => {
    toast.classList.remove('show');
    toast.setAttribute('aria-hidden', 'true');
  }, 1800);
}

function setStatus(text) {
  statusEl.textContent = text;
}

// Persist last generated items and restore on revisit
function saveLastItems(items) {
  try { localStorage.setItem('m2m_last_items', JSON.stringify(items || [])); } catch {}
}
function loadLastItems() {
  try { return JSON.parse(localStorage.getItem('m2m_last_items') || '[]'); } catch { return []; }
}
async function restoreLastItems() {
  try {
    const items = loadLastItems();
    if (Array.isArray(items) && items.length) {
      console.log('Restoring items:', items.length);
      resultsCard.hidden = false;
      await renderCards(items);
      window.lastTitles = items.map(it => it.title).filter(Boolean);
      countEl.textContent = items.length ? `Total ${items.length}` : '';
      setStatus('Restored');
      console.log('Items restored successfully');
    } else {
      console.log('No items to restore');
    }
  } catch (error) {
    console.error('Error restoring items:', error);
    setStatus('Restore failed');
  }
}

// 优先解析严格 JSON 数组
function parseJsonRecommendations(text) {
  if (!text) return null;
  try {
    // 提取最外层 JSON（对象/数组），兼容模型在前后添加噪音的情况
    const objStart = text.indexOf('{');
    const objEnd = text.lastIndexOf('}');
    const arrStart = text.indexOf('[');
    const arrEnd = text.lastIndexOf(']');
    let raw = '';
    if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
      raw = text.slice(objStart, objEnd + 1);
    } else if (arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart) {
      raw = text.slice(arrStart, arrEnd + 1);
    } else {
      return null;
    }

    const parsed = JSON.parse(raw);
    // 若是数组，则视为 recommendations
    if (Array.isArray(parsed)) {
      return { recommendations: normalizeMood2MovieItems(parsed) };
    }
    // 若是对象，尝试常见字段：recommendations / items / data / list
    if (parsed && (Array.isArray(parsed.recommendations) || Array.isArray(parsed.items) || Array.isArray(parsed.data) || Array.isArray(parsed.list))) {
      const arr = parsed.recommendations || parsed.items || parsed.data || parsed.list || [];
      return { recommendations: normalizeMood2MovieItems(arr) };
    }
    return null;
  } catch {
    return null;
  }
}

function normalizeMood2MovieItems(arr) {
  const pickStr = (obj, keys) => {
    for (const k of keys) {
      const v = obj?.[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return '';
  };
  const sanitizeUrl = (s) => {
    const t = String(s || '').trim();
    // 去除包裹的反引号或引号，兼容 Markdown 代码样式
    const cleaned = t.replace(/^[`'"\s]+|[`'"\s]+$/g, '');
    return cleaned;
  };
  const pickNum = (obj, keys) => {
    for (const k of keys) {
      const v = obj?.[k];
      if (typeof v === 'number' && !Number.isNaN(v)) return v;
      const n = Number(v);
      if (!Number.isNaN(n) && v != null && v !== '') return n;
    }
    return undefined;
  };
  const parseTitleFromReason = (reason) => {
    if (!reason) return '';
    // 《片名》 或 "片名" 或 '片名'
    const m = reason.match(/《([^》]+)》|"([^"]+)"|'([^']+)'/);
    return (m?.[1] || m?.[2] || m?.[3] || '').trim();
  };

  return arr
    .filter(it => it && typeof it === 'object')
    .map(it => {
      // 标题兜底：尝试多种字段与从 reason 中提取
      let title = pickStr(it, ['title', 'name', 'movie_title', 'movie', 'film_title', 'original_title', 'cn_title', 'zh_title']);
      const reason = pickStr(it, ['reason', 'why', 'summary', 'description', 'explanation']);
      if (!title || title === '...' || title === '…') {
        const fromReason = parseTitleFromReason(reason);
        if (fromReason) title = fromReason;
      }
      if (!title) title = '未命名影片';

      // 规范化：去掉标题末尾的括号年份，例如 "Knives Out (2019)"
      const yearFromTitleMatch = String(title).match(/\((\d{4})\)\s*$/);
      const yearFromTitle = yearFromTitleMatch ? Number(yearFromTitleMatch[1]) : undefined;
      title = String(title).replace(/\s*\((\d{4})\)\s*$/, '');

      // 体裁标签：数组或分隔字符串
      let genres = Array.isArray(it.genres) ? it.genres : (it.tags || it.category || it.categories);
      if (typeof genres === 'string') {
        genres = genres.split(/[、，,|\s]+/).filter(Boolean);
      }
      genres = Array.isArray(genres) ? genres.slice(0, 6) : [];

      let year = pickNum(it, ['year', 'release_year']);
      if (year == null && yearFromTitle != null) year = yearFromTitle;
      const rating = pickNum(it, ['rating', 'score', 'douban', 'douban_rating', 'imdb_rating']);
      const runtime = pickStr(it, ['runtime', 'duration']);
      const country = pickStr(it, ['country', 'region', 'origin_country']);
      const release_date = pickStr(it, ['release_date', 'release', 'date']);
      const availability = pickStr(it, ['availability', 'platform', 'provider', 'where_to_watch']);
      const posterUrl = sanitizeUrl(pickStr(it, ['poster', 'posterUrl', 'poster_url', 'image', 'cover', 'thumbnail', 'img', 'artwork']));
      const match_score = pickNum(it, ['match_score', 'match', 'matchScore', 'score_match']);
      const user_mood = pickStr(it, ['user_mood', 'mood']);
      const theme_color = pickStr(it, ['theme_color', 'accent', 'color', 'primary_color']);

      return {
        title, year, reason, genres, rating, runtime, country, release_date, availability,
        posterUrl, match_score, user_mood, theme_color,
      };
    })
    .filter(it => (it.title || '').trim());
}

// 将推荐文本解析为结构化数据
function parseRecommendations(text) {
  if (!text) return [];
  const lines = text
    .split(/\n+/)
    .map(l => l.trim())
    .filter(Boolean)
    .slice(0, 3);
  const items = [];
  for (const l of lines) {
    // 预期格式：片名 — 简短理由（可选括号年份/评分）
    const [left, reason = ''] = l.split(/\s*[—\-]\s*/);
    if (!left) continue;
    const m = left.match(/^(.*?)(?:\((\d{4})\))?(?:\s*\|\s*(\d+(?:\.\d+)?))?$/);
    const title = m?.[1]?.trim() || left.trim();
    const year = m?.[2] ? Number(m[2]) : undefined;
    const rating = m?.[3] ? Number(m[3]) : undefined;
    items.push({ title, year, rating, reason });
  }
  return items;
}

// 获取海报（优先 TMDB；其次 OMDb；最后占位图）
const _posterCache = new Map();

// TMDB条款要求：缓存不超过6个月
const TMDB_CACHE_DURATION = 6 * 30 * 24 * 60 * 60 * 1000; // 6个月（毫秒）

function isCacheExpired(timestamp) {
  return Date.now() - timestamp > TMDB_CACHE_DURATION;
}

// 清理过期的海报缓存
function cleanExpiredPosterCache() {
  const now = Date.now();
  for (const [key, data] of _posterCache.entries()) {
    if (data.timestamp && isCacheExpired(data.timestamp)) {
      _posterCache.delete(key);
    }
  }
}

// 定期清理过期缓存（每小时检查一次）
setInterval(cleanExpiredPosterCache, 60 * 60 * 1000);
async function getTmdbPoster(title, year) {
  try {
    if (!TMDB_READ_TOKEN && !TMDB_API_KEY) return '';
    const url = new URL('https://api.themoviedb.org/3/search/movie');
    url.searchParams.set('query', title);
    url.searchParams.set('include_adult', 'false');
    const lang = (window.USER_LANG && String(window.USER_LANG).toLowerCase().startsWith('zh')) ? 'zh-CN' : 'en-US';
    url.searchParams.set('language', lang);
    if (year) url.searchParams.set('year', String(year));
    const headers = TMDB_READ_TOKEN ? { Authorization: `Bearer ${TMDB_READ_TOKEN}` } : {};
    if (!TMDB_READ_TOKEN && TMDB_API_KEY) url.searchParams.set('api_key', TMDB_API_KEY);
    const res = await fetch(url.toString(), { headers });
    const data = await res.json();
    const posterPath = data?.results?.[0]?.poster_path;
    if (!posterPath) return '';
    return `https://image.tmdb.org/t/p/w500${posterPath}`;
  } catch {
    return '';
  }
}

async function getOmdbPoster(title, year) {
  try {
    const apikey = window.OMDB_API_KEY;
    if (!apikey) return '';
    const url = new URL('https://www.omdbapi.com/');
    url.searchParams.set('t', title);
    if (year) url.searchParams.set('y', String(year));
    url.searchParams.set('apikey', apikey);
    const res = await fetch(url.toString());
    const data = await res.json();
    const poster = data?.Poster && data.Poster !== 'N/A' ? data.Poster : '';
    return poster || '';
  } catch {
    return '';
  }
}

async function getPosterUrl(title, year, candidate) {
  const key = `poster-${title}-${year ?? ''}`;
  
  // 检查缓存是否存在且未过期
  if (_posterCache.has(key)) {
    const cachedData = _posterCache.get(key);
    if (cachedData.timestamp && !isCacheExpired(cachedData.timestamp)) {
      return cachedData.url;
    } else {
      // 缓存过期，删除旧缓存
      _posterCache.delete(key);
    }
  }
  
  const picsum = `https://image.tmdb.org/t/p/w500`; // placeholder prefix for tmdb; we'll fallback to picsum next
  // 1) Try TMDB
  let poster = await getTmdbPoster(title, year);
  // 若 TMDB 未找到且提供了候选链接，需校验候选是否为有效 URL
  const isValidUrl = (u) => {
    const s = String(u || '').trim();
    return /^(https?:|data:|blob:)/i.test(s);
  };
  if (!poster && candidate && isValidUrl(candidate)) poster = candidate.trim();
  // 2) Fallback OMDb
  if (!poster) poster = await getOmdbPoster(title, year);
  // 3) Final fallback
  if (!poster) poster = `https://picsum.photos/seed/${encodeURIComponent(title)}/300/450`;
  
  // 存储到缓存，包含时间戳
  _posterCache.set(key, {
    url: poster,
    timestamp: Date.now()
  });
  
  return poster;
}

function placeholderPoster(title) {
  return `https://picsum.photos/seed/${encodeURIComponent(title)}/300/450`;
}

// 渲染卡片列表
function shortMood(mood) {
  const m = String(mood || '').trim();
  if (!m) return 'Matches your current mood';
  return m.length > 22 ? m.slice(0, 22) + '…' : m;
}

function buildMoodSummary(mood, item) {
  const g = Array.isArray(item.genres) && item.genres.length ? `${item.genres[0]}` : '';
  const why = item.reason ? item.reason.replace(/\s+/g, ' ') : '';
  const lead = shortMood(mood);
  const base = g ? `This ${g} film` : 'This movie';
  if (why) return `${base} fits your mood: “${lead}”, because “${why}”.`;
  return `${base} matches your current mood: “${lead}”.`;
}

// Generate an emotional, concise one-liner under the title using Chrome Prompt API
async function buildEmotionLine(mood, item) {
  try {
    // Use existing session if available, otherwise fallback
    if (!('LanguageModel' in globalThis) || !session) {
      return buildEmotionFallback(mood, item);
    }
    const genres = Array.isArray(item.genres) ? item.genres.join(', ') : '';
    const contextReason = cleanReason(item.reason || '');
    const prompt = `Write ONE short English sentence (<= 22 words) that gives positive emotional value in an encouraging, healing, or motivational tone. Be warm, supportive, and hopeful. Avoid spoilers and repeating the title. No emojis. Return ONLY the sentence.\n\nUser mood: ${mood}\nTitle: ${item.title}\nGenres: ${genres}\nReason: ${contextReason}\nRating: ${item.rating ?? ''}`;
    const out = await session.prompt(prompt);
    const text = typeof out === 'string' ? out : (out?.text ?? '');
    const oneLine = String(text || '').split(/\n+/)[0].trim();
    return oneLine || buildEmotionFallback(mood, item);
  } catch {
    return buildEmotionFallback(mood, item);
  }
}

function buildEmotionFallback(mood, item) {
  const lead = shortMood(mood);
  const g = Array.isArray(item.genres) && item.genres.length ? `${item.genres[0]}` : '';
  const base = g ? `This ${g} film` : 'This film';
  return `${base} offers warm, hopeful support for your mood: "${lead}".`;
}

// Clean reason: remove trailing meta like country/year/runtime/rating and keep first sentence
function cleanReason(reason) {
  let r = String(reason || '').trim();
  if (!r) return '';
  // Take only the first sentence to drop appended meta lines
  r = r.split(/[。.!?]+\s*/)[0];
  r = r.replace(/\s+/g, ' ').trim();
  // Remove common trailing meta fragments if still present
  r = r.replace(/\bApprox\.\s*rating\s*\d+(?:\.\d+)?\b/i, '').trim();
  r = r.replace(/\b\d{4}\b.*$/i, '').trim(); // drop year and after if appended
  r = r.replace(/\b\d{2,3}\s*(?:min|分钟)\b.*$/i, '').trim();
  // Remove dangling separators
  r = r.replace(/[·/\-]+\s*$/, '').trim();
  return r;
}

function buildSynopsis(item) {
  const base = cleanReason(item.reason);
  return base ? base + '.' : '';
}

// Generate an English synopsis using Chrome Prompt API with moderate length
async function buildSynopsisChrome(mood, item) {
  try {
    // If Prompt API session is not ready, fallback to local synopsis
    if (!('LanguageModel' in globalThis) || !session) {
      return buildSynopsisFallback(item);
    }
    const genres = Array.isArray(item.genres) ? item.genres.join(', ') : '';
    const contextReason = cleanReason(item.reason || '');
    const title = String(item.title || '').trim();
    const year = item.year ? String(item.year) : '';
    const prompt = `Write a concise English synopsis (25–40 words) for the film below. Be clear, warm, and spoiler-free. Reflect why it suits the user's mood. No emojis. Return ONLY the synopsis sentence(s).\n\nUser mood: ${mood}\nTitle: ${title}${year ? ` (${year})` : ''}\nGenres: ${genres}\nReason: ${contextReason}\nRating: ${item.rating ?? ''}`;
    const out = await session.prompt(prompt);
    const text = typeof out === 'string' ? out : (out?.text ?? '');
    const one = String(text || '').replace(/\s+/g, ' ').trim();
    return one || buildSynopsisFallback(item);
  } catch {
    return buildSynopsisFallback(item);
  }
}

function buildSynopsisFallback(item) {
  const base = buildSynopsis(item);
  return base;
}

function starsFromRating(r) {
  if (r == null) return '☆☆☆☆☆';
  const full = Math.round(Number(r) / 2);
  return Array.from({ length: 5 }, (_, i) => (i < full ? '★' : '☆')).join(' ');
}

function extractMinutes(runtime) {
  if (!runtime) return '';
  const m = String(runtime).match(/(\d+)\s*分钟|([0-9]{2,3})\s*min|([0-9]{2,3})/i);
  const num = Number(m?.[1] || m?.[2] || m?.[3]);
  return Number.isFinite(num) ? String(num) : '';
}

// Persist user actions (favorite / watched) — allow both marks to coexist
function normalizeStates(raw) {
  const out = {};
  try {
    const s = raw || {};
    for (const [key, v] of Object.entries(s)) {
      if (v === 'wish') {
        out[key] = { favorite: true, watched: false };
      } else if (v === 'seen') {
        out[key] = { favorite: false, watched: true };
      } else if (v && typeof v === 'object') {
        out[key] = { favorite: !!v.favorite, watched: !!v.watched };
      }
    }
  } catch {}
  return out;
}
function loadStates() {
  try {
    const raw = JSON.parse(localStorage.getItem('m2m_states') || '{}');
    return normalizeStates(raw);
  } catch { return {}; }
}
function saveStates(states) {
  try { localStorage.setItem('m2m_states', JSON.stringify(states)); } catch {}
}
function getMarks(title) {
  const s = loadStates();
  const m = s[title];
  return m && typeof m === 'object' ? m : { favorite: false, watched: false };
}

function getWatchedTitles() {
  const s = loadStates();
  const watchedTitles = Object.entries(s)
    .filter(([_, v]) => v === 'seen' || (v && typeof v === 'object' && v.watched))
    .map(([title, v]) => {
      // 如果有完整的电影信息，使用存储的标题，否则使用键名
      if (v && typeof v === 'object' && v.watched && v.title) {
        return v.title;
      }
      return title;
    });
  
  // 添加部分匹配的标题（处理 "Paddington" vs "Paddington 2" 的情况）
  const expandedTitles = new Set(watchedTitles);
  watchedTitles.forEach(title => {
    // 如果标题包含数字，也添加不带数字的版本
    const withoutNumber = title.replace(/\s+\d+$/, '');
    if (withoutNumber !== title) {
      expandedTitles.add(withoutNumber);
    }
    // 如果标题不包含数字，也添加带数字的版本
    else {
      // 添加常见的续集版本
      for (let i = 2; i <= 5; i++) {
        expandedTitles.add(`${title} ${i}`);
      }
    }
  });
  
  return Array.from(expandedTitles);
}
function setMark(title, mark, on) {
  const s = loadStates();
  const cur = s[title] && typeof s[title] === 'object' ? s[title] : { favorite: false, watched: false };
  if (mark === 'favorite') cur.favorite = !!on;
  if (mark === 'watched') cur.watched = !!on;
  s[title] = cur;
  saveStates(s);
}

function setMarkWithDetails(title, mark, on, item, poster) {
  const s = loadStates();
  const cur = s[title] && typeof s[title] === 'object' ? s[title] : { favorite: false, watched: false };
  if (mark === 'favorite') cur.favorite = !!on;
  if (mark === 'watched') cur.watched = !!on;
  
  // 保存完整的电影信息
  if (on) {
    cur.title = item.title;
    cur.year = item.year;
    cur.poster_url = poster;
    cur.genres = item.genres;
    cur.rating = item.rating;
    cur.runtime = item.runtime;
    cur.country = item.country;
  }
  
  s[title] = cur;
  saveStates(s);
}
// Backward-compat wrappers used elsewhere in code
function getState(title) {
  const m = getMarks(title);
  if (m.favorite && m.watched) return 'both';
  if (m.favorite) return 'wish';
  if (m.watched) return 'seen';
  return '';
}
function setState(title, state) {
  if (state === 'wish') setMark(title, 'favorite', true);
  else if (state === 'seen') setMark(title, 'watched', true);
}

async function renderCards(items) {
  // 强制只显示 3 条
  items = (items || []).slice(0, 3);
  cardsEl.innerHTML = '';
  if (!items.length) return;
  for (const item of items) {
    const poster = await getPosterUrl(item.title, item.year, item.posterUrl);
    const page = document.createElement('div');
    page.className = 'ticket-page';
    const moodSummary = buildMoodSummary(window.lastUserMood || '', item);
    const synopsis = await buildSynopsisChrome(window.lastUserMood || '', item);
    const stars = starsFromRating(item.rating);
    const minutes = extractMinutes(item.runtime);
    // Build single-line info: Countries / Genres / Release / Runtime (English)
    const countries = String(item.country || '')
      .split(/[、，,|\/]+/)
      .map(s => s.trim())
      .filter(Boolean)
      .join(' ');
    const genresStr = Array.isArray(item.genres) && item.genres.length ? item.genres.join(', ') : '';
    let releaseStr = '';
    if (item.release_date) {
      const mainCountry = countries ? countries.split(' ')[0] : '';
      releaseStr = `${item.release_date}${mainCountry ? ` (${mainCountry})` : ''}`;
    } else if (item.year) {
      releaseStr = `${item.year}`;
    }
    const runtimeStr = minutes ? `${minutes} min` : (item.runtime ? String(item.runtime) : '');
    const infoLine = [countries, genresStr, releaseStr, runtimeStr].filter(Boolean).join(' / ');
    const ratingNum = (item.rating != null && Number.isFinite(Number(item.rating))) ? Number(item.rating).toFixed(1) : '';
    const ratingLine = ratingNum ? `<div class="ticket-stars">${stars} ${ratingNum}/10</div>` : '';
    const subtitleText = await buildEmotionLine(window.lastUserMood || '', item);
    page.innerHTML = `
      <article class="ticket">
        <span class="notch left"></span>
        <span class="notch right"></span>
        <span class="perf vert left"></span>
        <span class="perf vert right"></span>
        <div class="ticket-inner">
        <header class="ticket-header">
          <h2 class="ticket-title">${escapeHtml(item.title)}</h2>
          <div class="ticket-subtitle">${escapeHtml(subtitleText)}</div>
        </header>
        <div class="ticket-poster ticket-frame"><img alt="${escapeHtml(item.title)} poster" src="${poster}" loading="lazy"></div>
        ${ratingLine}
        <div class="ticket-info"><span>${escapeHtml(infoLine || '')}</span></div>
        <div class="ticket-actions">
          <button class="ticket-btn wish-btn" type="button" aria-label="Favourite">Favourite</button>
          <button class="ticket-btn seen-btn" type="button" aria-label="Wached">Wached</button>
        </div>
        <div class="ticket-body">
          <p class="ticket-synopsis">${escapeHtml(synopsis)}</p>
        </div>
        <div class="ticket-footer">Mood2Movie</div>
        </div>
      </article>
    `;
    cardsEl.appendChild(page);
    // 运行时兜底：若图片加载失败或 URL 无效，替换为占位图
    const img = page.querySelector('.ticket-poster img');
    const isValidUrl = (u) => /^(https?:|data:|blob:)/i.test(String(u || '').trim());
    if (!isValidUrl(img?.src)) {
      img.src = placeholderPoster(item.title);
    }
    img?.addEventListener('error', () => {
      img.src = placeholderPoster(item.title);
    });

    // Buttons: Want to Watch / Watched
    const wishBtn = page.querySelector('.wish-btn');
    const seenBtn = page.querySelector('.seen-btn');
    const marks = getMarks(item.title);
    if (marks.favorite) wishBtn?.classList.add('active');
    if (marks.watched) seenBtn?.classList.add('active');
    wishBtn?.addEventListener('click', async () => {
      const current = getMarks(item.title).favorite;
      const next = !current;
      setMarkWithDetails(item.title, 'favorite', next, item, poster);
      wishBtn.classList.toggle('active', next);
      if (next) {
        showToast('Added to Favourite');
        await setFavoriteMarkInCloud(item, poster);
      } else {
        showToast('Removed from Favourite');
        await removeCloudMarkByTitleYear('favorite', item.title, item.year);
      }
    });
    seenBtn?.addEventListener('click', async () => {
      const current = getMarks(item.title).watched;
      const next = !current;
      setMarkWithDetails(item.title, 'watched', next, item, poster);
      seenBtn.classList.toggle('active', next);
      if (next) {
        showToast('Marked as Watched');
        await setWatchedMarkInCloud(item, poster);
      } else {
        showToast('Unmarked Watched');
        await removeCloudMarkByTitleYear('watched', item.title, item.year);
      }
    });
  }

  // 尝试从云端拉取用户的收藏，并与本地状态合并
  try {
    const favs = await fetchCloudFavorites();
    if (Array.isArray(favs) && favs.length) {
      const titles = new Set(favs.map((f) => f.title));
      document.querySelectorAll('.ticket-page').forEach((pg) => {
        const name = pg.querySelector('.ticket-title')?.textContent?.trim();
        if (name && titles.has(name)) {
          setMark(name, 'favorite', true);
          pg.querySelector('.wish-btn')?.classList.add('active');
        }
      });
    }
  } catch {}
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"]+/g, s => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
  })[s]);
}