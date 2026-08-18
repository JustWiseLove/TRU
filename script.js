const themes = [
  {name:"Black",  color:"#1a1a1a", soft:"#f0f0f0", dark:"#000000"},
  {name:"Red",    color:"#c62828", soft:"#ffebee", dark:"#8e0000"},
  {name:"Orange", color:"#ef6c00", soft:"#fff3e0", dark:"#b53d00"},
  {name:"Yellow", color:"#f9a825", soft:"#fffde7", dark:"#c17900"},
  {name:"Green",  color:"#008000", soft:"#e8f5e9", dark:"#006600"},
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
let retained = new Set(JSON.parse(localStorage.getItem("twltt_liked") || "[]"));
let currentTab = "browse";
let currentGroup = "reel";
let currentCards = typeof reelCards !== "undefined" ? reelCards : [];
let currentIndex = 0;
let scrolledToday = false;
let isLooping = false;
let totalScrolls = parseInt(localStorage.getItem("twltt_scrolls") || "0", 10);
let totalShares = parseInt(localStorage.getItem("twltt_shares") || "0", 10);
let searchQuery = "";
let darkMode = localStorage.getItem("twltt_dark") === "1";
let savedIndex = { truth: 0, learn: 0, reel: 0 };
let isSpeaking = false;
let preferredVoice = null;
let audioOn = localStorage.getItem("twltt_audio") === "1";
let cardOrder = localStorage.getItem("twltt_order") || "default";
let shuffledCache = { truth: null, learn: null, reel: null };
let autoSpeakTimer = null;
let lastSpokenId = null;
let activeVideo = null;

function todayKey() {
  const est = new Date(new Date().toLocaleString("en-US", {timeZone: "America/New_York"}));
  return `${est.getFullYear()}-${String(est.getMonth()+1).padStart(2,"0")}-${String(est.getDate()).padStart(2,"0")}`;
}
function getDaysSet() { try { return new Set(JSON.parse(localStorage.getItem("twltt_days") || "[]")); } catch { return new Set(); } }
function saveDaysSet(s) { localStorage.setItem("twltt_days", JSON.stringify([...s])); }
function updateDayCounter() {
  const d = getDaysSet();
  const dayEl = document.getElementById("dayCount");
  if (dayEl) dayEl.textContent = d.size;
  const pr = document.getElementById("profileStreak"); if (pr) pr.textContent = d.size;
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
function saveRetained() { localStorage.setItem("twltt_liked", JSON.stringify([...retained])); updateReviewCount(); }
function updateReviewCount() {
  const e = document.getElementById("reviewCount");
  if (e) e.textContent = retained.size ? ` ${retained.size}` : "";
  const s = document.getElementById("reviewStat");
  if (s) s.textContent = retained.size;
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
  const dt = document.getElementById("darkToggle");
  if (dt) dt.checked = darkMode;
}

function allCards() {
  return [
    ...(typeof truthCards !== "undefined" ? truthCards : []),
    ...(typeof learnCards !== "undefined" ? learnCards : []),
    ...(typeof reelCards !== "undefined" ? reelCards : [])
  ];
}
function cardMatches(card, q) {
  if (!q) return false;
  const s = q.toLowerCase().trim();
  if (!s) return false;
  const hay = [
    card.ref, card.quote, card.text, card.category, card.title,
    card.num != null ? String(card.num) : "",
    getSourceLabel(card)
  ].filter(Boolean).join(" ").toLowerCase();
  return hay.includes(s);
}
function getSourceLabel(card) {
  if (typeof reelCards !== "undefined" && reelCards.some(c => c.id === card.id)) return "Reel";
  if (typeof learnCards !== "undefined" && learnCards.some(c => c.id === card.id)) return "Learn";
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
  let base = [];
  if (group === "truth") base = typeof truthCards !== "undefined" ? truthCards : [];
  else if (group === "learn") base = typeof learnCards !== "undefined" ? learnCards : [];
  else base = typeof reelCards !== "undefined" ? reelCards : [];
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
  const prefer = currentGroup === "reel"
    ? ["Samantha", "Karen", "Moira", "Tessa", "Google US English", "Microsoft Zira"]
    : ["Alex", "Aaron", "Daniel", "Fred", "Google UK English Male", "Microsoft David"];
  for (const name of prefer) {
    const v = voices.find(x => x.name.includes(name) && x.lang.startsWith("en"));
    if (v) return v;
  }
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
  document.querySelectorAll(".scripture-quote .word.active, .truth-text .word.active").forEach(w => w.classList.remove("active"));
}
function wrapWords(el, text) {
  const words = text.split(/(\s+)/);
  el.innerHTML = words.map(w => /^\s+$/.test(w) ? w : `<span class="word">${w}</span>`).join("");
  return [...el.querySelectorAll(".word")];
}
function speakCurrentCard(force) {
  if (typeof speechSynthesis === "undefined") return;
  if (!currentCards.length || currentTab === "search") return;
  if (!force && !audioOn) return;
  const card = currentCards[currentIndex % currentCards.length];
  if (!card) return;
  const speakText = card.quote || card.text || "";
  if (!speakText) return;
  if (!force && lastSpokenId === card.id && isSpeaking) return;
  try { speechSynthesis.resume(); } catch (e) {}
  preferredVoice = pickBestVoice();
  stopSpeaking();
  lastSpokenId = card.id;

  const feed = document.getElementById("feed");
  const visibleCards = feed.querySelectorAll(".card");
  let textEl = null;
  for (const c of visibleCards) {
    if (parseInt(c.dataset.index, 10) === currentIndex) {
      textEl = c.querySelector(".scripture-quote") || c.querySelector(".truth-text");
      break;
    }
  }
  const words = textEl ? wrapWords(textEl, speakText) : [];
  const utter = new SpeechSynthesisUtterance(speakText);
  if (preferredVoice) utter.voice = preferredVoice;
  utter.rate = 0.95;
  utter.pitch = currentGroup === "reel" ? 1.05 : 0.98;
  utter.lang = (preferredVoice && preferredVoice.lang) || "en-US";
  let wordIndex = 0;
  utter.onboundary = (e) => {
    if (e.name !== "word" || !words.length) return;
    words.forEach(w => w.classList.remove("active"));
    if (wordIndex < words.length) { words[wordIndex].classList.add("active"); wordIndex++; }
  };
  const approxMs = Math.max(180, (speakText.length / Math.max(speakText.split(/\s+/).length, 1)) * 55);
  let fallbackTimer = null;
  utter.onstart = () => {
    isSpeaking = true;
    setTimeout(() => {
      if (isSpeaking && wordIndex < 2 && words.length) {
        fallbackTimer = setInterval(() => {
          if (!isSpeaking) { clearInterval(fallbackTimer); return; }
          words.forEach(w => w.classList.remove("active"));
          if (wordIndex < words.length) { words[wordIndex].classList.add("active"); wordIndex++; }
          else clearInterval(fallbackTimer);
        }, approxMs / 0.95);
      }
    }, 400);
  };
  utter.onend = () => {
    if (fallbackTimer) clearInterval(fallbackTimer);
    isSpeaking = false;
    if (textEl) textEl.textContent = speakText;
  };
  utter.onerror = () => {
    if (fallbackTimer) clearInterval(fallbackTimer);
    isSpeaking = false;
    if (textEl) textEl.textContent = speakText;
  };
  speechSynthesis.speak(utter);
}
function scheduleAutoSpeak() {
  if (!audioOn || currentTab !== "browse") return;
  if (autoSpeakTimer) clearTimeout(autoSpeakTimer);
  autoSpeakTimer = setTimeout(() => {
    if (audioOn && currentTab === "browse" && !isSpeaking) {
      try { speechSynthesis.resume(); } catch (e) {}
      speakCurrentCard(true);
    }
  }, 600);
}

function pauseAllVideos() {
  document.querySelectorAll("video.reel-video").forEach(v => {
    try { v.pause(); } catch (e) {}
  });
  activeVideo = null;
}
function playVisibleVideo() {
  const feed = document.getElementById("feed");
  if (!feed) return;
  const cards = feed.querySelectorAll(".card");
  const card = cards[currentIndex];
  document.querySelectorAll("video.reel-video").forEach(v => {
    if (!card || !card.contains(v)) {
      try { v.pause(); } catch (e) {}
    }
  });
  if (!card) return;
  const vid = card.querySelector("video.reel-video");
  if (!vid) return;
  activeVideo = vid;
  vid.muted = true;
  vid.defaultMuted = true;
  vid.playsInline = true;
  vid.setAttribute("playsinline", "");
  vid.setAttribute("webkit-playsinline", "");
  const tryPlay = () => {
    const p = vid.play();
    if (p && p.catch) p.catch(() => {
      // retry once after a short delay (iOS sometimes needs it)
      setTimeout(() => { try { vid.play().catch(() => {}); } catch (e) {} }, 250);
    });
  };
  if (vid.readyState >= 2) tryPlay();
  else {
    vid.addEventListener("loadeddata", tryPlay, { once: true });
    try { vid.load(); } catch (e) {}
  }
}

function buildFeed() {
  const feed = document.getElementById("feed");
  pauseAllVideos();
  feed.innerHTML = "";
  feed.classList.toggle("search-mode", currentTab === "search");
  const searchBar = document.getElementById("searchBar");
  if (currentTab === "search") searchBar.classList.add("visible");
  else searchBar.classList.remove("visible");
  const bottomNav = document.getElementById("bottomNav");
  if (currentTab === "browse") bottomNav.classList.remove("hidden");
  else bottomNav.classList.add("hidden");

  if (currentTab === "review") {
    currentCards = allCards().filter(c => retained.has(c.id));
  } else if (currentTab === "search") {
    const q = searchQuery.trim();
    currentCards = q ? allCards().filter(c => cardMatches(c, q)) : [];
  } else {
    currentCards = getGroupCards(currentGroup);
  }

  if (!currentCards.length) {
    let emptyHtml = "";
    if (currentTab === "review") {
      emptyHtml = `<div class="empty-state"><div class="big-icon"><i class="fa-solid fa-gem"></i></div><h3>Nothing to review yet</h3><p>Tap Save on any card<br>to keep it here.</p></div>`;
    } else if (currentTab === "search") {
      emptyHtml = searchQuery.trim()
        ? `<div class="empty-state"><div class="big-icon"><i class="fa-solid fa-magnifying-glass"></i></div><h3>No results for "${searchQuery}"</h3><p>Try another keyword.</p></div>`
        : `<div class="empty-state"><div class="big-icon"><i class="fa-solid fa-magnifying-glass"></i></div><h3>Search</h3><p>Type a keyword to find<br>scriptures, topics, or facts.</p></div>`;
    } else {
      emptyHtml = `<div class="empty-state"><div class="big-icon"><i class="fa-solid fa-book-open"></i></div><h3>No cards</h3></div>`;
    }
    feed.innerHTML = emptyHtml;
    document.getElementById("sideActions").style.display = "none";
    return;
  }

  document.getElementById("sideActions").style.display = currentTab === "search" ? "none" : "flex";
  const isSnap = currentTab === "browse";
  const toRender = isSnap ? [...currentCards, ...currentCards] : currentCards;

  toRender.forEach((t, i) => {
    const card = document.createElement("div");
    card.className = "card" + (t.video ? " reel-card" : "");
    card.dataset.index = i;
    card.dataset.id = t.id;
    const di = (i % currentCards.length) + 1;
    const label = currentTab === "search" || currentTab === "review"
      ? getSourceLabel(t)
      : (currentGroup === "learn" ? "Learn" : currentGroup === "reel" ? "Reel" : "Truth");

    if (t.video) {
      card.innerHTML = `
        <video class="reel-video" src="${t.video}" muted defaultMuted loop playsinline webkit-playsinline preload="auto" autoplay></video>
        <div class="reel-scrim"></div>
        <div class="card-content">
          <div class="reel-title">${t.title || ""}</div>
          <div class="truth-text">${t.text}</div>
          <div class="category">${t.category}</div>
          <div class="card-meta">${label} ${t.num} | Card ${di} of ${currentCards.length}</div>
        </div>${i === 0 && isSnap ? '<div class="swipe-hint">Swipe up</div>' : ''}`;
    } else {
      card.innerHTML = `<div class="card-content">
        <div class="scripture-ref">${t.ref}</div>
        <div class="scripture-quote">${t.quote}</div>
        <div class="truth-text">${t.text}</div>
        <div class="category">${t.category}</div>
        <div class="card-meta">${label} ${t.num} | Card ${di} of ${currentCards.length}</div>
      </div>${i === 0 && isSnap ? '<div class="swipe-hint">Swipe up</div>' : ''}`;
    }
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
      playVisibleVideo();
      scheduleAutoSpeak();
    });
  } else {
    feed.scrollTop = 0;
    currentIndex = 0;
  }
  updateSaveButton();
}

function updateSaveButton() {
  const btn = document.getElementById("saveBtnSide"), icon = document.getElementById("saveIcon");
  if (!currentCards.length || currentTab === "search") return;
  const id = currentCards[currentIndex % currentCards.length]?.id;
  if (retained.has(id)) {
    btn.classList.add("saved");
    icon.innerHTML = '<i class="fa-solid fa-bookmark"></i>';
  } else {
    btn.classList.remove("saved");
    icon.innerHTML = '<i class="fa-regular fa-bookmark"></i>';
  }
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
        if (currentTab === "browse") {
          savedIndex[currentGroup] = idx % Math.max(currentCards.length, 1);
        }
        updateSaveButton();
        playVisibleVideo();
        if (idx > 0 || scrolledToday) markScrolledToday();
        scheduleAutoSpeak();
      }
    });
  }, {root: ff, threshold: 0.55});
  fc.forEach(c => obs.observe(c));
  let st;
  ff.addEventListener("scroll", () => {
    clearTimeout(st);
    st = setTimeout(() => {
      if (ff.scrollTop > 40) markScrolledToday();
      if (currentTab !== "browse" || isLooping) return;
      const h = window.innerHeight, mid = currentCards.length * h;
      if (ff.scrollTop >= mid - h * 0.5) {
        isLooping = true;
        ff.scrollTop = (ff.scrollTop - mid) + h * 0.1;
        setTimeout(() => { isLooping = false; }, 50);
      }
    }, 80);
  }, {passive: true});
}

function toggleSave() {
  if (!currentCards.length || currentTab === "search") return;
  const id = currentCards[currentIndex % currentCards.length].id;
  if (retained.has(id)) { retained.delete(id); showToast("Removed from Review"); }
  else { retained.add(id); showToast("Saved to Review"); }
  saveRetained(); updateSaveButton();
  if (currentTab === "review") buildFeed();
}

function shareCard() {
  if (!currentCards.length || currentTab === "search") return;
  const t = currentCards[currentIndex % currentCards.length];
  const themeColor = getComputedStyle(document.documentElement).getPropertyValue("--theme").trim() || "#1a1a1a";
  const themeSoft = getComputedStyle(document.documentElement).getPropertyValue("--theme-soft").trim() || "#f0f0f0";
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
  function wrap(txt, x, y, mw, lh) {
    const words = txt.split(" ");
    let line = "", lines = [];
    for (let n = 0; n < words.length; n++) {
      const test = line + words[n] + " ";
      if (ctx.measureText(test).width > mw && n > 0) { lines.push(line.trim()); line = words[n] + " "; }
      else line = test;
    }
    lines.push(line.trim());
    lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
    return lines.length * lh;
  }
  ctx.fillStyle = "#f0f4f0"; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = themeColor + "18";
  ctx.beginPath(); ctx.arc(200, 300, 280, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(900, 1600, 320, 0, Math.PI * 2); ctx.fill();
  const cardX = 70, cardY = 220, cardW = w - 140, cardH = h - 480;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, cardX, cardY, cardW, cardH, 28); ctx.fill();
  ctx.fillStyle = themeColor; ctx.fillRect(cardX, cardY, cardW, 12);
  let y = cardY + 80;
  ctx.fillStyle = themeColor; ctx.font = "bold 48px -apple-system,sans-serif"; ctx.textAlign = "center";
  const head = t.ref || t.title || "";
  ctx.fillText(head, w / 2, y); y += 60;
  const body = t.quote || t.text || "";
  ctx.fillStyle = themeSoft;
  const bodyLines = [];
  ctx.font = "italic 36px -apple-system,sans-serif";
  {
    const words = body.split(" "); let line = "";
    for (let n = 0; n < words.length; n++) {
      const test = line + words[n] + " ";
      if (ctx.measureText(test).width > cardW - 140 && n > 0) { bodyLines.push(line.trim()); line = words[n] + " "; }
      else line = test;
    }
    bodyLines.push(line.trim());
  }
  const bodyH = Math.max(bodyLines.length * 50 + 48, 140);
  roundRect(ctx, cardX + 40, y, cardW - 80, bodyH, 16); ctx.fill();
  ctx.fillStyle = themeColor; ctx.fillRect(cardX + 40, y + 16, 8, bodyH - 32);
  ctx.fillStyle = "#222"; ctx.font = "italic 36px -apple-system,sans-serif"; ctx.textAlign = "left";
  bodyLines.forEach((l, i) => ctx.fillText(l, cardX + 70, y + 50 + i * 50));
  y += bodyH + 50;
  if (t.quote && t.text) {
    ctx.fillStyle = "#555"; ctx.font = "32px -apple-system,sans-serif"; ctx.textAlign = "center";
    y += wrap(t.text, w / 2, y, cardW - 100, 44) + 30;
  }
  ctx.fillStyle = themeColor; ctx.font = "bold 26px -apple-system,sans-serif"; ctx.textAlign = "center";
  ctx.fillText((t.category || "").toUpperCase(), w / 2, y); y += 50;
  ctx.fillStyle = "#999"; ctx.font = "24px -apple-system,sans-serif";
  ctx.fillText(`${getSourceLabel(t)} ${t.num}`, w / 2, y);
  ctx.fillStyle = themeColor; ctx.font = "bold 28px -apple-system,sans-serif";
  ctx.fillText("Browse Â· Review Â· Search", w / 2, h - 100);
  canvas.toBlob(blob => {
    incrementShares();
    const file = new File([blob], `card-${(t.ref || t.title || "share").replace(/[^a-z0-9]/gi, "-")}.png`, {type: "image/png"});
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
  const el = document.getElementById("profileSideIcon");
  if (!el) return;
  el.innerHTML = "";
  if (profile.avatarType === "image" && profile.avatar) {
    const i = document.createElement("img"); i.src = profile.avatar; el.appendChild(i);
  } else {
    el.innerHTML = '<i class="fa-solid fa-user"></i>';
  }
}
function updateAvatarPreview() {
  const el = document.getElementById("avatarPreview"); if (!el) return;
  el.innerHTML = "";
  if (profile.avatarType === "image" && profile.avatar) {
    const i = document.createElement("img"); i.src = profile.avatar; el.appendChild(i);
  } else el.innerHTML = '<i class="fa-solid fa-user"></i>';
}
function updateUsernameDisplay() {
  const el = document.getElementById("usernameDisplay");
  if (el) el.textContent = profile.name || "Profile";
}

function openIntro(force) {
  if (!force && localStorage.getItem("twltt_intro_hide") === "1") return;
  document.getElementById("introDontShow").checked = false;
  document.getElementById("introModal").classList.add("open");
}
function closeIntro() {
  if (document.getElementById("introDontShow").checked) {
    localStorage.setItem("twltt_intro_hide", "1");
  }
  document.getElementById("introModal").classList.remove("open");
}

function openProfileModal() {
  document.getElementById("nameInput").value = profile.name;
  document.getElementById("audioToggle").checked = audioOn;
  const dt = document.getElementById("darkToggle");
  if (dt) dt.checked = darkMode;
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
  document.getElementById("reviewStat").textContent = retained.size;
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

function setTab(tab) {
  stopSpeaking();
  pauseAllVideos();
  if (currentTab === "browse" && tab !== "browse") {
    savedIndex[currentGroup] = currentIndex % Math.max(currentCards.length, 1);
  }
  currentTab = tab;
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  const idMap = { browse: "tabBrowse", review: "tabReview", search: "tabSearch" };
  const el = document.getElementById(idMap[tab]);
  if (el) el.classList.add("active");
  buildFeed();
  if (tab === "search") setTimeout(() => document.getElementById("searchInput").focus(), 100);
}

function setGroup(group) {
  if (currentTab === "browse") {
    savedIndex[currentGroup] = currentIndex % Math.max(currentCards.length, 1);
  }
  currentGroup = group;
  document.querySelectorAll(".bottom-tab").forEach(b => b.classList.remove("active"));
  const map = { learn: "groupLearn", reel: "groupReel", truth: "groupTruth" };
  const el = document.getElementById(map[group]);
  if (el) el.classList.add("active");
  preferredVoice = pickBestVoice();
  if (currentTab === "browse") buildFeed();
  else setTab("browse");
}

function init() {
  applyTheme(profile.theme);
  applyDarkMode(darkMode);
  buildFeed();
  renderAvatarDisplay();
  updateUsernameDisplay();
  updateDayCounter();
  updateReviewCount();
  updateTodayCheck();
  setInterval(updateTimeLeft, 30000);

  document.getElementById("tabBrowse").onclick = () => setTab("browse");
  document.getElementById("tabReview").onclick = () => setTab("review");
  document.getElementById("tabSearch").onclick = () => setTab("search");
  document.getElementById("groupLearn").onclick = () => setGroup("learn");
  document.getElementById("groupReel").onclick = () => setGroup("reel");
  document.getElementById("groupTruth").onclick = () => setGroup("truth");
  document.getElementById("saveBtnSide").onclick = toggleSave;
  document.getElementById("shareBtn").onclick = shareCard;
  document.getElementById("profileBtnSide").onclick = openProfileModal;
  
  document.getElementById("cancelBtn").onclick = closeProfileModal;
  document.getElementById("introStartBtn").onclick = closeIntro;
  document.querySelectorAll(".intro-card").forEach(card => {
    card.onclick = () => {
      closeIntro();
      const key = card.dataset.intro;
      if (key === "review") setTab("review");
      else if (key === "search") setTab("search");
      else setTab("browse");
    };
  });
  document.getElementById("openIntroBtn").onclick = () => {
    closeProfileModal();
    openIntro(true);
  };

  document.getElementById("saveBtn").onclick = () => {
    profile.name = document.getElementById("nameInput").value.trim() || "Friend";
    audioOn = document.getElementById("audioToggle").checked;
    const dt = document.getElementById("darkToggle");
    if (dt) applyDarkMode(dt.checked);
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
      shuffledCache = { truth: null, learn: null, reel: null };
      savedIndex = { truth: 0, learn: 0, reel: 0 };
    }
    renderAvatarDisplay();
    updateUsernameDisplay();
    closeProfileModal();
    if (currentTab === "browse") buildFeed();
    if (audioOn) {
      try { speechSynthesis.resume(); } catch (e) {}
      setTimeout(() => speakCurrentCard(true), 100);
    } else stopSpeaking();
    showToast(audioOn ? "Audio on" : "Saved");
  };

  document.getElementById("fileInput").onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 2 * 1024 * 1024) { alert("Image under 2 MB please."); return; }
    const r = new FileReader();
    r.onload = ev => { profile.avatar = ev.target.result; profile.avatarType = "image"; updateAvatarPreview(); };
    r.readAsDataURL(f);
  };
  document.getElementById("resetAvatarBtn").onclick = () => {
    profile.avatar = ""; profile.avatarType = "icon"; updateAvatarPreview();
  };
  document.getElementById("profileModal").onclick = e => { if (e.target.id === "profileModal") closeProfileModal(); };
  document.getElementById("introModal").onclick = e => { if (e.target.id === "introModal") closeIntro(); };
  document.getElementById("orderSegment").onclick = e => {
    const btn = e.target.closest(".seg-btn"); if (!btn) return;
    document.querySelectorAll(".seg-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  };

  const searchInput = document.getElementById("searchInput");
  const clearBtn = document.getElementById("clearSearch");
  let searchTimer;
  function runSearch() {
    searchQuery = (searchInput.value || "").trim();
    clearBtn.style.display = searchQuery ? "block" : "none";
    if (currentTab !== "search") setTab("search");
    else buildFeed();
  }
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, 150);
  });
  searchInput.addEventListener("keyup", e => { if (e.key === "Enter") { clearTimeout(searchTimer); runSearch(); } });
  clearBtn.onclick = () => {
    searchInput.value = ""; searchQuery = ""; clearBtn.style.display = "none";
    if (currentTab === "search") buildFeed();
    searchInput.focus();
  };

  openIntro(false);
  if (!profile.name) setTimeout(() => { if (!profile.name) openProfileModal(); }, 2500);
}
init();
