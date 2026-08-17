const themes = [
  {name:"Black",  color:"#1a1a1a", soft:"#f0f0f0", dark:"#000000"},
  {name:"Green",  color:"#008000", soft:"#e8f5e9", dark:"#006600"},
  {name:"Red",    color:"#c62828", soft:"#ffebee", dark:"#8e0000"},
  {name:"Orange", color:"#ef6c00", soft:"#fff3e0", dark:"#b53d00"},
  {name:"Yellow", color:"#f9a825", soft:"#fffde7", dark:"#c17900"},
  {name:"Blue",   color:"#1565c0", soft:"#e3f2fd", dark:"#0d47a1"},
  {name:"Violet", color:"#6a1b9a", soft:"#f3e5f5", dark:"#4a148c"},
  {name:"Pink",   color:"#e91e63", soft:"#fce4ec", dark:"#c2185b"}
];

let profile = {
  name: localStorage.getItem("twltt_name") || "",
  avatar: localStorage.getItem("twltt_avatar") || "",
  avatarType: localStorage.getItem("twltt_avatarType") || "icon",
  theme: localStorage.getItem("twltt_theme") || "#1a1a1a"
};
let liked = new Set(JSON.parse(localStorage.getItem("twltt_liked") || "[]"));
let currentTab = "scroll";
let currentGroup = "truth";
let currentCards = typeof truthCards !== "undefined" ? truthCards : [];
let currentIndex = 0;
let scrolledToday = false;
let isLooping = false;
let totalScrolls = parseInt(localStorage.getItem("twltt_scrolls") || "0", 10);
let totalShares = parseInt(localStorage.getItem("twltt_shares") || "0", 10);
let searchQuery = "";
let darkMode = localStorage.getItem("twltt_dark") === "1";
let savedIndex = { truth: 0, proof: 0 };
let isSpeaking = false;
let preferredVoice = null;
let audioOn = localStorage.getItem("twltt_audio") === "1";
let cardOrder = localStorage.getItem("twltt_order") || "default";
let shuffledCache = { truth: null, proof: null };
let autoSpeakTimer = null;
let lastSpokenId = null;

function todayKey() {
  const est = new Date(new Date().toLocaleString("en-US", {timeZone: "America/New_York"}));
  return `${est.getFullYear()}-${String(est.getMonth()+1).padStart(2,"0")}-${String(est.getDate()).padStart(2,"0")}`;
}
function getDaysSet() { try { return new Set(JSON.parse(localStorage.getItem("twltt_days") || "[]")); } catch { return new Set(); } }
function saveDaysSet(s) { localStorage.setItem("twltt_days", JSON.stringify([...s])); }
function updateDayCounter() {
  const d = getDaysSet();
  document.getElementById("dayCount").textContent = d.size;
  const p = document.getElementById("profileStreak"); if (p) p.textContent = d.size;
}
function markScrolledToday() {
  if (scrolledToday) return;
  scrolledToday = true;
  const d = getDaysSet(); d.add(todayKey()); saveDaysSet(d);
  updateDayCounter(); updateTodayCheck();
}
function incrementScrollEXP() {
  totalScrolls++;
  localStorage.setItem("twltt_scrolls", totalScrolls);
  const e = document.getElementById("scrollEXP"); if (e) e.textContent = totalScrolls;
}
function incrementShares() {
  totalShares++;
  localStorage.setItem("twltt_shares", totalShares);
  const e = document.getElementById("shareCount"); if (e) e.textContent = totalShares;
}
function updateTodayCheck() {
  const c = document.getElementById("todayCheck");
  if (c) c.innerHTML = getDaysSet().has(todayKey()) ? '<i class="fa-solid fa-square-check"></i>' : '<i class="fa-regular fa-square"></i>';
}
function updateTimeLeft() {
  const el = document.getElementById("timeLeft"); if (!el) return;
  const est = new Date(new Date().toLocaleString("en-US", {timeZone: "America/New_York"}));
  const next = new Date(est); next.setHours(24, 0, 0, 0);
  const diff = next - est;
  el.textContent = `${Math.floor(diff/3600000)} HRS ${Math.floor((diff%3600000)/60000)} MINS`;
}
function showToast(m) {
  const t = document.getElementById("toast");
  t.textContent = m; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
}
function saveLiked() { localStorage.setItem("twltt_liked", JSON.stringify([...liked])); updateLikedCount(); }
function updateLikedCount() {
  const e = document.getElementById("likedCount");
  e.textContent = liked.size ? ` ${liked.size}` : "";
  const s = document.getElementById("likedStat");
  if (s) s.textContent = liked.size;
}

function applyTheme(color) {
  const t = themes.find(x => x.color === color) || themes[0];
  document.documentElement.style.setProperty("--theme", t.color);
  document.documentElement.style.setProperty("--theme-dark", t.dark);
  document.documentElement.style.setProperty("--theme-soft", t.soft);
  profile.theme = t.color;
  document.body.setAttribute("data-theme", t.name.toLowerCase());
}

function applyDarkMode(on) {
  darkMode = !!on;
  document.body.classList.toggle("dark", darkMode);
  localStorage.setItem("twltt_dark", darkMode ? "1" : "0");
  const icon = document.querySelector("#streakBox i");
  if (icon) icon.className = darkMode ? "fa-solid fa-moon" : "fa-solid fa-sun";
}

function allCards() {
  return [...(typeof truthCards !== "undefined" ? truthCards : []), ...(typeof proofCards !== "undefined" ? proofCards : [])];
}

function cardMatches(card, q) {
  if (!q) return false;
  const s = q.toLowerCase();
  return (card.ref && card.ref.toLowerCase().includes(s)) ||
         (card.quote && card.quote.toLowerCase().includes(s)) ||
         (card.text && card.text.toLowerCase().includes(s)) ||
         (card.category && card.category.toLowerCase().includes(s));
}

function getSourceLabel(card) {
  if (typeof proofCards !== "undefined" && proofCards.some(c => c.id === card.id)) return "Proof";
  return "Truth";
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getGroupCards(group) {
  const base = group === "truth"
    ? (typeof truthCards !== "undefined" ? truthCards : [])
    : (typeof proofCards !== "undefined" ? proofCards : []);
  if (cardOrder === "shuffle") {
    if (!shuffledCache[group] || shuffledCache[group].length !== base.length) {
      shuffledCache[group] = shuffleArray(base);
    }
    return shuffledCache[group];
  }
  return base;
}

function pickBestVoice() {
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;
  const prefer = ["Alex", "Aaron", "Daniel", "Fred", "Google UK English Male", "Microsoft David", "Microsoft Mark"];
  for (const name of prefer) {
    const v = voices.find(x => x.name.includes(name) && x.lang.startsWith("en"));
    if (v) return v;
  }
  const maleHints = /alex|aaron|daniel|fred|david|mark|male/i;
  const m = voices.find(x => x.lang.startsWith("en") && maleHints.test(x.name));
  if (m) return m;
  return voices.find(x => x.lang === "en-US") || voices.find(x => x.lang.startsWith("en")) || voices[0];
}

function loadVoices() { preferredVoice = pickBestVoice(); }
if (typeof speechSynthesis !== "undefined") {
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
}

function stopSpeaking() {
  if (autoSpeakTimer) { clearTimeout(autoSpeakTimer); autoSpeakTimer = null; }
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  isSpeaking = false;
  document.querySelectorAll(".scripture-quote .word.active").forEach(w => w.classList.remove("active"));
}

function wrapQuoteWords(quoteEl, text) {
  const words = text.split(/(\s+)/);
  quoteEl.innerHTML = words.map(w => /^\s+$/.test(w) ? w : `<span class="word">${w}</span>`).join("");
  return [...quoteEl.querySelectorAll(".word")];
}

function speakCurrentCard(force) {
  if (typeof speechSynthesis === "undefined") return;
  if (!currentCards.length || currentTab === "search") return;
  if (!force && !audioOn) return;

  const card = currentCards[currentIndex % currentCards.length];
  if (!card || !card.quote) return;
  if (!force && lastSpokenId === card.id && isSpeaking) return;

  // iOS often pauses the synthesis engine; resume before speaking
  try { speechSynthesis.resume(); } catch (e) {}
  if (!preferredVoice) loadVoices();

  stopSpeaking();
  lastSpokenId = card.id;

  const feed = document.getElementById("feed");
  const visibleCards = feed.querySelectorAll(".card");
  let quoteEl = null;
  for (const c of visibleCards) {
    if (parseInt(c.dataset.index, 10) === currentIndex) {
      quoteEl = c.querySelector(".scripture-quote");
      break;
    }
  }
  if (!quoteEl) {
    for (const c of visibleCards) {
      if (c.dataset.id === card.id) { quoteEl = c.querySelector(".scripture-quote"); break; }
    }
  }

  const words = quoteEl ? wrapQuoteWords(quoteEl, card.quote) : [];
  const utter = new SpeechSynthesisUtterance(card.quote);
  if (!preferredVoice) preferredVoice = pickBestVoice();
  if (preferredVoice) utter.voice = preferredVoice;
  utter.rate = 0.95;
  utter.pitch = 0.98;
  utter.lang = (preferredVoice && preferredVoice.lang) || "en-US";

  let wordIndex = 0;
  utter.onboundary = (e) => {
    if (e.name !== "word" || !words.length) return;
    words.forEach(w => w.classList.remove("active"));
    if (wordIndex < words.length) { words[wordIndex].classList.add("active"); wordIndex++; }
  };

  const approxMs = Math.max(180, (card.quote.length / Math.max(card.quote.split(/\s+/).length, 1)) * 55);
  let fallbackTimer = null;
  const startFallback = () => {
    if (!words.length) return;
    fallbackTimer = setInterval(() => {
      if (!isSpeaking) { clearInterval(fallbackTimer); return; }
      words.forEach(w => w.classList.remove("active"));
      if (wordIndex < words.length) { words[wordIndex].classList.add("active"); wordIndex++; }
      else clearInterval(fallbackTimer);
    }, approxMs / 0.95);
  };

  utter.onstart = () => {
    isSpeaking = true;
    setTimeout(() => { if (isSpeaking && wordIndex < 2) startFallback(); }, 400);
  };
  utter.onend = () => {
    if (fallbackTimer) clearInterval(fallbackTimer);
    isSpeaking = false;
    if (quoteEl) quoteEl.textContent = card.quote;
  };
  utter.onerror = () => {
    if (fallbackTimer) clearInterval(fallbackTimer);
    isSpeaking = false;
    if (quoteEl) quoteEl.textContent = card.quote;
  };

  speechSynthesis.speak(utter);
}

function scheduleAutoSpeak() {
  if (!audioOn || currentTab !== "scroll") return;
  if (autoSpeakTimer) clearTimeout(autoSpeakTimer);
  autoSpeakTimer = setTimeout(() => {
    if (audioOn && currentTab === "scroll" && !isSpeaking) {
      try { speechSynthesis.resume(); } catch (e) {}
      speakCurrentCard(true);
    }
  }, 600);
}

function buildFeed() {
  const feed = document.getElementById("feed");
  feed.innerHTML = "";
  feed.classList.toggle("search-mode", currentTab === "search");

  const searchBar = document.getElementById("searchBar");
  if (currentTab === "search") searchBar.classList.add("visible");
  else searchBar.classList.remove("visible");

  const bottomNav = document.getElementById("bottomNav");
  if (currentTab === "scroll") bottomNav.classList.remove("hidden");
  else bottomNav.classList.add("hidden");

  if (currentTab === "liked") {
    currentCards = allCards().filter(c => liked.has(c.id));
  } else if (currentTab === "search") {
    const q = searchQuery.trim();
    currentCards = q ? allCards().filter(c => cardMatches(c, q)) : [];
  } else {
    currentCards = getGroupCards(currentGroup);
  }

  if (!currentCards.length) {
    let emptyHtml = "";
    if (currentTab === "liked") {
      emptyHtml = `<div class="empty-state"><div class="big-icon"><i class="fa-regular fa-heart"></i></div><h3>No liked cards yet</h3><p>Tap the heart on any card<br>to save it here.</p></div>`;
    } else if (currentTab === "search") {
      emptyHtml = searchQuery.trim()
        ? `<div class="empty-state"><div class="big-icon"><i class="fa-solid fa-magnifying-glass"></i></div><h3>No results</h3><p>Try a different keyword.</p></div>`
        : `<div class="empty-state"><div class="big-icon"><i class="fa-solid fa-magnifying-glass"></i></div><h3>Search</h3><p>Type a keyword to find<br>scriptures, topics, or text.</p></div>`;
    } else {
      emptyHtml = `<div class="empty-state"><div class="big-icon"><i class="fa-solid fa-book-open"></i></div><h3>No cards</h3></div>`;
    }
    feed.innerHTML = emptyHtml;
    document.getElementById("sideActions").style.display = "none";
    return;
  }

  document.getElementById("sideActions").style.display = currentTab === "search" ? "none" : "flex";

  const isSnap = currentTab === "scroll";
  const toRender = isSnap ? [...currentCards, ...currentCards] : currentCards;

  toRender.forEach((t, i) => {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.index = i;
    card.dataset.id = t.id;
    const di = (i % currentCards.length) + 1;
    const label = currentTab === "search" || currentTab === "liked"
      ? getSourceLabel(t)
      : (currentGroup === "proof" ? "Proof" : "Truth");
    card.innerHTML = `<div class="card-content">
      <div class="scripture-ref">${t.ref}</div>
      <div class="scripture-quote">${t.quote}</div>
      <div class="truth-text">${t.text}</div>
      <div class="category">${t.category}</div>
      <div class="card-meta">${label} ${t.num} | Card ${di} of ${currentCards.length}</div>
    </div>${i === 0 && isSnap ? '<div class="swipe-hint">Swipe up</div>' : ''}`;
    feed.appendChild(card);
  });

  if (isSnap) {
    const maxIdx = currentCards.length;
    let start = savedIndex[currentGroup] || 0;
    if (start < 0 || start >= maxIdx) start = 0;
    currentIndex = start;
    setupScrollTracking();
    requestAnimationFrame(() => {
      const ff = document.getElementById("feed");
      const cards = ff.querySelectorAll(".card");
      if (cards[start]) ff.scrollTop = cards[start].offsetTop;
      scheduleAutoSpeak();
    });
  } else {
    feed.scrollTop = 0;
    currentIndex = 0;
  }
  updateLikeButton();
}

function updateLikeButton() {
  const btn = document.getElementById("likeBtn"), icon = document.getElementById("likeIcon");
  if (!currentCards.length || currentTab === "search") return;
  const id = currentCards[currentIndex % currentCards.length]?.id;
  if (liked.has(id)) { btn.classList.add("liked"); icon.innerHTML = '<i class="fa-solid fa-heart"></i>'; }
  else { btn.classList.remove("liked"); icon.innerHTML = '<i class="fa-regular fa-heart"></i>'; }
}

function setupScrollTracking() {
  const feed = document.getElementById("feed");
  const nf = feed.cloneNode(true);
  feed.parentNode.replaceChild(nf, feed);
  const ff = document.getElementById("feed"), fc = ff.querySelectorAll(".card");
  const obs = new IntersectionObserver(es => {
    es.forEach(e => {
      if (e.isIntersecting) {
        const idx = parseInt(e.target.dataset.index, 10);
        if (idx !== currentIndex) {
          stopSpeaking();
          incrementScrollEXP();
          lastSpokenId = null;
        }
        currentIndex = idx;
        if (currentTab === "scroll") {
          savedIndex[currentGroup] = idx % Math.max(currentCards.length, 1);
        }
        updateLikeButton();
        if (idx > 0 || scrolledToday) markScrolledToday();
        if (idx !== currentIndex || true) scheduleAutoSpeak();
      }
    });
  }, {root: ff, threshold: 0.55});
  fc.forEach(c => obs.observe(c));
  let st;
  ff.addEventListener("scroll", () => {
    clearTimeout(st);
    st = setTimeout(() => {
      if (ff.scrollTop > 40) markScrolledToday();
      if (currentTab !== "scroll" || isLooping) return;
      const h = window.innerHeight, mid = currentCards.length * h;
      if (ff.scrollTop >= mid - h * 0.5) {
        isLooping = true;
        ff.scrollTop = (ff.scrollTop - mid) + h * 0.1;
        setTimeout(() => { isLooping = false; }, 50);
      }
    }, 80);
  }, {passive: true});
}

function toggleLike() {
  if (!currentCards.length || currentTab === "search") return;
  const id = currentCards[currentIndex % currentCards.length].id;
  if (liked.has(id)) { liked.delete(id); showToast("Removed from Liked"); }
  else { liked.add(id); showToast("Added to Liked"); }
  saveLiked(); updateLikeButton();
  if (currentTab === "liked") buildFeed();
}

function shareCard() {
  if (!currentCards.length || currentTab === "search") return;
  const t = currentCards[currentIndex % currentCards.length];
  const themeColor = getComputedStyle(document.documentElement).getPropertyValue("--theme").trim() || "#008000";
  const themeSoft = getComputedStyle(document.documentElement).getPropertyValue("--theme-soft").trim() || "#e8f5e9";
  const canvas = document.createElement("canvas");
  const w = 1080, h = 1920;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");

  function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }

  function wrap(txt, x, y, mw, lh, align) {
    const words = txt.split(" ");
    let line = "", lines = [];
    for (let n = 0; n < words.length; n++) {
      const test = line + words[n] + " ";
      if (ctx.measureText(test).width > mw && n > 0) { lines.push(line.trim()); line = words[n] + " "; }
      else line = test;
    }
    lines.push(line.trim());
    lines.forEach((l, i) => {
      if (align === "center") ctx.fillText(l, x, y + i * lh);
      else ctx.fillText(l, x, y + i * lh);
    });
    return lines.length * lh;
  }

  // Background
  ctx.fillStyle = "#f0f4f0";
  ctx.fillRect(0, 0, w, h);

  // Soft accent orbs
  ctx.fillStyle = themeColor + "18";
  ctx.beginPath(); ctx.arc(200, 300, 280, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(900, 1600, 320, 0, Math.PI * 2); ctx.fill();

  // White card
  const cardX = 70, cardY = 220, cardW = w - 140, cardH = h - 480;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, cardX, cardY, cardW, cardH, 28);
  ctx.fill();
  ctx.shadowColor = "transparent";

  // Top accent bar
  ctx.fillStyle = themeColor;
  roundRect(ctx, cardX, cardY, cardW, 12, 0);
  ctx.fill();
  ctx.fillRect(cardX, cardY, cardW, 12);

  let y = cardY + 80;

  // Reference
  ctx.fillStyle = themeColor;
  ctx.font = "bold 52px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(t.ref, w / 2, y);
  y += 50;

  // Quote box
  const quoteBoxTop = y;
  ctx.fillStyle = themeSoft;
  roundRect(ctx, cardX + 40, quoteBoxTop, cardW - 80, 10, 12);
  // measure quote first
  ctx.font = "italic 38px -apple-system, sans-serif";
  ctx.textAlign = "left";
  const quoteLines = [];
  {
    const words = t.quote.split(" ");
    let line = "";
    const mw = cardW - 140;
    for (let n = 0; n < words.length; n++) {
      const test = line + words[n] + " ";
      if (ctx.measureText(test).width > mw && n > 0) { quoteLines.push(line.trim()); line = words[n] + " "; }
      else line = test;
    }
    quoteLines.push(line.trim());
  }
  const quoteH = Math.max(quoteLines.length * 52 + 48, 140);
  ctx.fillStyle = themeSoft;
  roundRect(ctx, cardX + 40, quoteBoxTop, cardW - 80, quoteH, 16);
  ctx.fill();
  ctx.fillStyle = themeColor;
  ctx.fillRect(cardX + 40, quoteBoxTop + 16, 8, quoteH - 32);

  ctx.fillStyle = "#222";
  ctx.font = "italic 38px -apple-system, sans-serif";
  quoteLines.forEach((l, i) => ctx.fillText(l, cardX + 70, quoteBoxTop + 52 + i * 52));
  y = quoteBoxTop + quoteH + 50;

  // Teaching text
  ctx.fillStyle = "#555";
  ctx.font = "34px -apple-system, sans-serif";
  ctx.textAlign = "center";
  y += wrap(t.text, w / 2, y, cardW - 100, 46, "center") + 40;

  // Category pill
  ctx.font = "bold 28px -apple-system, sans-serif";
  const cat = t.category.toUpperCase();
  const catW = ctx.measureText(cat).width + 40;
  ctx.fillStyle = themeSoft;
  roundRect(ctx, (w - catW) / 2, y - 28, catW, 44, 22);
  ctx.fill();
  ctx.fillStyle = themeColor;
  ctx.fillText(cat, w / 2, y);
  y += 60;

  // Meta
  ctx.fillStyle = "#999";
  ctx.font = "26px -apple-system, sans-serif";
  ctx.fillText(`${getSourceLabel(t)} ${t.num}`, w / 2, y);

  // Footer branding
  ctx.fillStyle = themeColor;
  ctx.font = "bold 28px -apple-system, sans-serif";
  ctx.fillText("Truths We Love to Teach", w / 2, h - 100);
  ctx.fillStyle = "#aaa";
  ctx.font = "22px -apple-system, sans-serif";
  ctx.fillText("NWT", w / 2, h - 60);

  canvas.toBlob(blob => {
    incrementShares();
    const file = new File([blob], `scripture-${t.ref.replace(/[^a-z0-9]/gi, "-")}.png`, {type: "image/png"});
    if (navigator.canShare && navigator.canShare({files: [file]})) {
      navigator.share({files: [file]}).catch(() => dl(canvas));
    } else dl(canvas);
  }, "image/png");
}

function dl(c) {
  const a = document.createElement("a");
  a.download = "scripture-card.png";
  a.href = c.toDataURL("image/png");
  a.click();
  showToast("Image saved!");
}

function renderAvatarDisplay() {
  const el = document.getElementById("avatarDisplay");
  el.innerHTML = "";
  if (profile.avatarType === "image" && profile.avatar) {
    const i = document.createElement("img");
    i.src = profile.avatar;
    el.appendChild(i);
  } else {
    el.innerHTML = '<i class="fa-solid fa-user"></i>';
  }
}

function updateAvatarPreview() {
  const el = document.getElementById("avatarPreview");
  if (!el) return;
  el.innerHTML = "";
  if (profile.avatarType === "image" && profile.avatar) {
    const i = document.createElement("img");
    i.src = profile.avatar;
    el.appendChild(i);
  } else {
    el.innerHTML = '<i class="fa-solid fa-user"></i>';
  }
}

function updateUsernameDisplay() {
  document.getElementById("usernameDisplay").textContent = profile.name || "Set name";
}

function openProfileModal() {
  document.getElementById("nameInput").value = profile.name;
  document.getElementById("audioToggle").checked = audioOn;
  document.querySelectorAll(".seg-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.order === cardOrder);
  });
  buildThemeOptions();
  updateAvatarPreview();
  updateDayCounter();
  updateTodayCheck();
  updateTimeLeft();
  document.getElementById("scrollEXP").textContent = totalScrolls;
  document.getElementById("shareCount").textContent = totalShares;
  document.getElementById("likedStat").textContent = liked.size;
  document.getElementById("profileModal").classList.add("open");
}

function closeProfileModal() {
  document.getElementById("profileModal").classList.remove("open");
}

function buildThemeOptions() {
  const c = document.getElementById("themeOptions");
  c.innerHTML = "";
  themes.forEach(t => {
    const d = document.createElement("div");
    d.className = "theme-option" + (profile.theme === t.color ? " selected" : "");
    d.style.background = t.color;
    d.title = t.name;
    d.onclick = () => {
      document.querySelectorAll(".theme-option").forEach(o => o.classList.remove("selected"));
      d.classList.add("selected");
      applyTheme(t.color);
      updateAvatarPreview();
    };
    c.appendChild(d);
  });
}

function shareProfile() {
  const text = `${profile.name || "Friend"}'s Scripture Profile\nStreak: ${getDaysSet().size} days\nScrolls: ${totalScrolls} EXP\nShares: ${totalShares}\nLiked: ${liked.size}\n\nTruths We Love to Teach`;
  if (navigator.share) {
    navigator.share({title: "My Scripture Profile", text}).catch(() => {
      navigator.clipboard.writeText(text); showToast("Copied!");
    });
  } else {
    navigator.clipboard.writeText(text); showToast("Copied!");
  }
}

function setTab(tab) {
  stopSpeaking();
  if (currentTab === "scroll" && tab !== "scroll") {
    savedIndex[currentGroup] = currentIndex % Math.max(currentCards.length, 1);
  }
  currentTab = tab;
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  const el = document.getElementById("tab" + tab.charAt(0).toUpperCase() + tab.slice(1));
  if (el) el.classList.add("active");
  buildFeed();
  if (tab === "search") setTimeout(() => document.getElementById("searchInput").focus(), 100);
}

function init() {
  applyTheme(profile.theme);
  applyDarkMode(darkMode);
  buildFeed();
  renderAvatarDisplay();
  updateUsernameDisplay();
  updateDayCounter();
  updateLikedCount();
  updateTodayCheck();
  setInterval(updateTimeLeft, 30000);

  document.getElementById("tabScroll").onclick = () => setTab("scroll");
  document.getElementById("tabLiked").onclick = () => setTab("liked");
  document.getElementById("tabSearch").onclick = () => setTab("search");

  document.getElementById("groupTruth").onclick = () => {
    if (currentTab === "scroll") savedIndex[currentGroup] = currentIndex % Math.max(currentCards.length, 1);
    currentGroup = "truth";
    document.querySelectorAll(".bottom-tab").forEach(b => b.classList.remove("active"));
    document.getElementById("groupTruth").classList.add("active");
    if (currentTab === "scroll") buildFeed();
    else setTab("scroll");
  };
  document.getElementById("groupProof").onclick = () => {
    if (currentTab === "scroll") savedIndex[currentGroup] = currentIndex % Math.max(currentCards.length, 1);
    currentGroup = "proof";
    document.querySelectorAll(".bottom-tab").forEach(b => b.classList.remove("active"));
    document.getElementById("groupProof").classList.add("active");
    if (currentTab === "scroll") buildFeed();
    else setTab("scroll");
  };

  document.getElementById("streakBox").onclick = () => applyDarkMode(!darkMode);
  document.getElementById("likeBtn").onclick = toggleLike;
  document.getElementById("shareBtn").onclick = shareCard;
  document.getElementById("userInfo").onclick = openProfileModal;
  document.getElementById("cancelBtn").onclick = closeProfileModal;

  document.getElementById("saveBtn").onclick = () => {
    profile.name = document.getElementById("nameInput").value.trim() || "Friend";
    audioOn = document.getElementById("audioToggle").checked;
    const prevOrder = cardOrder;
    const activeSeg = document.querySelector(".seg-btn.active");
    cardOrder = activeSeg ? activeSeg.dataset.order : "default";
    localStorage.setItem("twltt_name", profile.name);
    localStorage.setItem("twltt_avatar", profile.avatar);
    localStorage.setItem("twltt_avatarType", profile.avatarType);
    localStorage.setItem("twltt_theme", profile.theme);
    localStorage.setItem("twltt_audio", audioOn ? "1" : "0");
    localStorage.setItem("twltt_order", cardOrder);
    if (prevOrder !== cardOrder) {
      shuffledCache = { truth: null, proof: null };
      savedIndex = { truth: 0, proof: 0 };
    }
    renderAvatarDisplay();
    updateUsernameDisplay();
    closeProfileModal();
    if (currentTab === "scroll") buildFeed();
    if (audioOn) {
      // User gesture (Save tap) unlocks iOS speech â speak current card now
      try { speechSynthesis.resume(); } catch (e) {}
      setTimeout(() => speakCurrentCard(true), 100);
    } else {
      stopSpeaking();
    }
    showToast(audioOn ? "Audio on" : "Saved");
  };

  document.getElementById("shareProfileBtn").onclick = shareProfile;
  document.getElementById("fileInput").onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 2 * 1024 * 1024) { alert("Image under 2 MB please."); return; }
    const r = new FileReader();
    r.onload = ev => {
      profile.avatar = ev.target.result;
      profile.avatarType = "image";
      updateAvatarPreview();
    };
    r.readAsDataURL(f);
  };
  document.getElementById("resetAvatarBtn").onclick = () => {
    profile.avatar = "";
    profile.avatarType = "icon";
    updateAvatarPreview();
  };
  document.getElementById("profileModal").onclick = e => {
    if (e.target.id === "profileModal") closeProfileModal();
  };

  document.getElementById("orderSegment").onclick = e => {
    const btn = e.target.closest(".seg-btn");
    if (!btn) return;
    document.querySelectorAll(".seg-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  };

  const searchInput = document.getElementById("searchInput");
  const clearBtn = document.getElementById("clearSearch");
  let searchTimer;
  searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value;
    clearBtn.style.display = searchQuery ? "block" : "none";
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { if (currentTab === "search") buildFeed(); }, 200);
  });
  clearBtn.onclick = () => {
    searchInput.value = "";
    searchQuery = "";
    clearBtn.style.display = "none";
    buildFeed();
    searchInput.focus();
  };

  if (!profile.name) setTimeout(() => { if (!profile.name) openProfileModal(); }, 2000);
}
init();
