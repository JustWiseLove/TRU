const defaultAvatars = [
  {color:"#000000",label:"Black"},{color:"#E53935",label:"Red"},{color:"#FB8C00",label:"Orange"},
  {color:"#FDD835",label:"Yellow"},{color:"#43A047",label:"Green"},{color:"#1E88E5",label:"Blue"},
  {color:"#8E24AA",label:"Violet"},{color:"#D81B60",label:"Pink"}
];

let profile = {name:localStorage.getItem("twltt_name")||"",avatar:localStorage.getItem("twltt_avatar")||"",avatarType:localStorage.getItem("twltt_avatarType")||"default"};
let liked = new Set(JSON.parse(localStorage.getItem("twltt_liked")||"[]"));
let currentTab = "scroll";
let currentGroup = "truth";
let currentCards = typeof truthsCards !== "undefined" ? truthsCards : [];
let currentIndex = 0;
let scrolledToday = false;
let isLooping = false;
let totalScrolls = parseInt(localStorage.getItem("twltt_scrolls")||"0",10);

function todayKey(){
  const est = new Date(new Date().toLocaleString("en-US",{timeZone:"America/New_York"}));
  return `${est.getFullYear()}-${String(est.getMonth()+1).padStart(2,"0")}-${String(est.getDate()).padStart(2,"0")}`;
}
function getDaysSet(){try{return new Set(JSON.parse(localStorage.getItem("twltt_days")||"[]"));}catch{return new Set();}}
function saveDaysSet(s){localStorage.setItem("twltt_days",JSON.stringify([...s]));}
function updateDayCounter(){
  const d=getDaysSet();
  document.getElementById("dayCount").textContent=d.size;
  const p=document.getElementById("profileStreak");if(p)p.textContent=d.size;
}
function markScrolledToday(){
  if(scrolledToday)return;
  scrolledToday=true;
  const d=getDaysSet();d.add(todayKey());saveDaysSet(d);
  updateDayCounter();updateTodayCheck();
}
function incrementScrollEXP(){totalScrolls++;localStorage.setItem("twltt_scrolls",totalScrolls);const e=document.getElementById("scrollEXP");if(e)e.textContent=totalScrolls;}
function updateTodayCheck(){const c=document.getElementById("todayCheck");if(c)c.innerHTML=getDaysSet().has(todayKey())?'<i class="fa-solid fa-square-check"></i>':'<i class="fa-regular fa-square"></i>';}
function updateTimeLeft(){
  const el=document.getElementById("timeLeft");if(!el)return;
  const est=new Date(new Date().toLocaleString("en-US",{timeZone:"America/New_York"}));
  const next=new Date(est);next.setHours(24,0,0,0);
  const diff=next-est;
  el.textContent=`${Math.floor(diff/3600000)} HRS ${Math.floor((diff%3600000)/60000)} MINS`;
}
function getInitials(n){return n?n.trim().split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase():"?";}
function showToast(m){const t=document.getElementById("toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200);}
function saveLiked(){localStorage.setItem("twltt_liked",JSON.stringify([...liked]));updateLikedCount();}
function updateLikedCount(){const e=document.getElementById("likedCount");e.textContent=liked.size?` ${liked.size}`:"";}

function buildFeed(){
  const feed=document.getElementById("feed");feed.innerHTML="";
  if(currentTab==="liked"){
    currentCards=[...(typeof truthsCards!=="undefined"?truthsCards:[]),...(typeof proofCards!=="undefined"?proofCards:[])].filter(c=>liked.has(c.id));
  } else {
    currentCards = currentGroup==="truth" ? (typeof truthsCards!=="undefined"?truthsCards:[]) : (typeof proofCards!=="undefined"?proofCards:[]);
  }
  if(!currentCards.length){
    feed.innerHTML=`<div class="empty-state"><div class="big-icon"><i class="fa-regular fa-heart"></i></div><h3>No liked cards yet</h3><p>Tap the heart on any card<br>to save it here.</p></div>`;
    document.getElementById("sideActions").style.display="none";
    document.getElementById("leftActions").style.display=currentTab==="liked"?"none":"flex";
    return;
  }
  document.getElementById("sideActions").style.display="flex";
  document.getElementById("leftActions").style.display=currentTab==="liked"?"none":"flex";
  const toRender=currentTab==="scroll"?[...currentCards,...currentCards]:currentCards;
  const label = currentGroup==="proof" ? "Proof" : "Truth";
  toRender.forEach((t,i)=>{
    const card=document.createElement("div");
    card.className="card";
    card.dataset.index=i;card.dataset.id=t.id;
    const di=(i%currentCards.length)+1;
    card.innerHTML=`<div class="card-content">
      <div class="scripture-ref">${t.ref}</div>
      <div class="scripture-quote">${t.quote}</div>
      <div class="truth-text">${t.text}</div>
      <div class="category">${t.category}</div>
      <div class="card-meta">${label} ${t.num} · Card ${di} of ${currentCards.length}</div>
    </div>${i===0&&currentTab==="scroll"?'<div class="swipe-hint">Swipe up</div>':''}`;
    feed.appendChild(card);
  });
  feed.scrollTop=0;currentIndex=0;setupScrollTracking();updateLikeButton();
}

function updateLikeButton(){
  const btn=document.getElementById("likeBtn"),icon=document.getElementById("likeIcon");
  if(!currentCards.length)return;
  const id=currentCards[currentIndex%currentCards.length]?.id;
  if(liked.has(id)){btn.classList.add("liked");icon.innerHTML='<i class="fa-solid fa-heart"></i>';}
  else{btn.classList.remove("liked");icon.innerHTML='<i class="fa-regular fa-heart"></i>';}
}

function setupScrollTracking(){
  const feed=document.getElementById("feed");
  const nf=feed.cloneNode(true);feed.parentNode.replaceChild(nf,feed);
  const ff=document.getElementById("feed"),fc=ff.querySelectorAll(".card");
  const obs=new IntersectionObserver(es=>{
    es.forEach(e=>{
      if(e.isIntersecting){
        const idx=parseInt(e.target.dataset.index,10);
        if(idx!==currentIndex)incrementScrollEXP();
        currentIndex=idx;updateLikeButton();
        if(idx>0||scrolledToday)markScrolledToday();
      }
    });
  },{root:ff,threshold:0.55});
  fc.forEach(c=>obs.observe(c));
  let st;
  ff.addEventListener("scroll",()=>{
    clearTimeout(st);
    st=setTimeout(()=>{
      if(ff.scrollTop>40)markScrolledToday();
      if(currentTab!=="scroll"||isLooping)return;
      const h=window.innerHeight,mid=currentCards.length*h;
      if(ff.scrollTop>=mid-h*0.5){isLooping=true;ff.scrollTop=(ff.scrollTop-mid)+h*0.1;setTimeout(()=>{isLooping=false;},50);}
    },80);
  },{passive:true});
}

function toggleLike(){
  if(!currentCards.length)return;
  const id=currentCards[currentIndex%currentCards.length].id;
  if(liked.has(id)){liked.delete(id);showToast("Removed from Liked");}
  else{liked.add(id);showToast("Added to Liked");}
  saveLiked();updateLikeButton();
  if(currentTab==="liked")buildFeed();
}

function shareCard(){
  if(!currentCards.length)return;
  const t=currentCards[currentIndex%currentCards.length];
  const canvas=document.createElement("canvas");
  const w=1080,h=1920;
  canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext("2d");

  ctx.fillStyle="#f7faf7";ctx.fillRect(0,0,w,h);
  ctx.fillStyle="#ffffff";
  roundRect(ctx,60,180,w-120,h-360,24);
  ctx.fill();

  function roundRect(ctx,x,y,width,height,radius){
    ctx.beginPath();
    ctx.moveTo(x+radius,y);
    ctx.arcTo(x+width,y,x+width,y+height,radius);
    ctx.arcTo(x+width,y+height,x,y+height,radius);
    ctx.arcTo(x,y+height,x,y,radius);
    ctx.arcTo(x,y,x+width,y,radius);
    ctx.closePath();
  }

  function wrap(txt,x,y,mw,lh){
    const words=txt.split(" ");let line="",lines=[];
    for(let n=0;n<words.length;n++){
      const test=line+words[n]+" ";
      if(ctx.measureText(test).width>mw&&n>0){lines.push(line);line=words[n]+" ";}
      else line=test;
    }
    lines.push(line);
    lines.forEach((l,i)=>ctx.fillText(l.trim(),x,y+i*lh));
    return lines.length*lh;
  }

  let y=280;
  ctx.fillStyle="#008000";ctx.font="bold 48px -apple-system,sans-serif";ctx.textAlign="center";
  ctx.fillText(t.ref,w/2,y);y+=70;

  ctx.fillStyle="#e8f5e9";
  ctx.fillRect(100,y-10,w-200,200);
  ctx.fillStyle="#008000";
  ctx.fillRect(100,y-10,8,200);

  ctx.fillStyle="#333";ctx.font="italic 36px -apple-system,sans-serif";ctx.textAlign="left";
  const qH=wrap(t.quote,130,y+40,w-260,48);
  y+=Math.max(qH,180)+50;

  ctx.fillStyle="#555";ctx.font="32px -apple-system,sans-serif";ctx.textAlign="center";
  y+=wrap(t.text,w/2,y,w-200,44)+50;

  ctx.fillStyle="#008000";ctx.font="bold 26px -apple-system,sans-serif";
  ctx.fillText(t.category.toUpperCase(),w/2,y);y+=50;

  ctx.fillStyle="#888";ctx.font="24px -apple-system,sans-serif";
  ctx.fillText(`${currentGroup==="proof"?"Proof":"Truth"} ${t.num}`,w/2,y);

  canvas.toBlob(blob=>{
    const file=new File([blob],`card-${t.ref.replace(/[^a-z0-9]/gi,"-")}.png`,{type:"image/png"});
    if(navigator.canShare&&navigator.canShare({files:[file]})){
      navigator.share({files:[file]}).catch(()=>dl(canvas));
    }else dl(canvas);
  },"image/png");
}
function dl(c){const a=document.createElement("a");a.download="scripture-card.png";a.href=c.toDataURL("image/png");a.click();showToast("Image saved!");}

function renderAvatarDisplay(){
  const el=document.getElementById("avatarDisplay");el.innerHTML="";
  if(profile.avatarType==="image"&&profile.avatar){const i=document.createElement("img");i.src=profile.avatar;el.appendChild(i);}
  else if(profile.avatar&&profile.avatar.startsWith("color:")){
    const m=profile.avatar.match(/color:(#[0-9A-Fa-f]+):(.+)/);
    el.style.background=m?m[1]:"#e8f5e9";el.style.color=m&&m[1]==="#FDD835"?"#222":"#fff";
    el.textContent=m?m[2].charAt(0):getInitials(profile.name);
  }else{el.style.background="#e8f5e9";el.style.color="#008000";el.textContent=getInitials(profile.name);}
}
function updateUsernameDisplay(){document.getElementById("usernameDisplay").textContent=profile.name||"Set name";}
function openProfileModal(){
  document.getElementById("nameInput").value=profile.name;
  buildAvatarOptions();updateDayCounter();updateTodayCheck();updateTimeLeft();
  document.getElementById("scrollEXP").textContent=totalScrolls;
  document.getElementById("profileModal").classList.add("open");
}
function closeProfileModal(){document.getElementById("profileModal").classList.remove("open");}
function buildAvatarOptions(){
  const c=document.getElementById("avatarOptions");c.innerHTML="";
  defaultAvatars.forEach(av=>{
    const d=document.createElement("div");d.className="avatar-option";d.style.background=av.color;
    if(av.color==="#FDD835")d.style.color="#222";
    d.textContent=av.label.charAt(0);d.title=av.label;
    const key=`color:${av.color}:${av.label}`;
    if(profile.avatar===key)d.classList.add("selected");
    d.onclick=()=>{document.querySelectorAll(".avatar-option").forEach(o=>o.classList.remove("selected"));d.classList.add("selected");profile.avatar=key;profile.avatarType="default";};
    c.appendChild(d);
  });
  if(profile.avatarType==="image"&&profile.avatar){
    const d=document.createElement("div");d.className="avatar-option selected";
    const i=document.createElement("img");i.src=profile.avatar;d.appendChild(i);c.prepend(d);
  }
}
function shareProfile(){
  const text=`${profile.name||"Friend"}'s Scripture Streak\nStreak: ${getDaysSet().size} days\nScrolls: ${totalScrolls} EXP\n\nTruths We Love to Teach`;
  if(navigator.share)navigator.share({title:"My Scripture Profile",text}).catch(()=>{navigator.clipboard.writeText(text);showToast("Copied!");});
  else{navigator.clipboard.writeText(text);showToast("Copied!");}
}

function init(){
  buildFeed();renderAvatarDisplay();updateUsernameDisplay();updateDayCounter();updateLikedCount();updateTodayCheck();
  setInterval(updateTimeLeft,30000);

  document.getElementById("tabScroll").onclick=()=>{currentTab="scroll";document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));document.getElementById("tabScroll").classList.add("active");buildFeed();};
  document.getElementById("tabLiked").onclick=()=>{currentTab="liked";document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));document.getElementById("tabLiked").classList.add("active");buildFeed();};
  document.getElementById("groupTruth").onclick=()=>{currentGroup="truth";document.querySelectorAll(".group-btn").forEach(b=>b.classList.remove("active"));document.getElementById("groupTruth").classList.add("active");if(currentTab==="scroll")buildFeed();};
  document.getElementById("groupProof").onclick=()=>{currentGroup="proof";document.querySelectorAll(".group-btn").forEach(b=>b.classList.remove("active"));document.getElementById("groupProof").classList.add("active");if(currentTab==="scroll")buildFeed();};

  document.getElementById("likeBtn").onclick=toggleLike;
  document.getElementById("shareBtn").onclick=shareCard;
  document.getElementById("userInfo").onclick=openProfileModal;
  document.getElementById("cancelBtn").onclick=closeProfileModal;
  document.getElementById("saveBtn").onclick=()=>{
    profile.name=document.getElementById("nameInput").value.trim()||"Friend";
    localStorage.setItem("twltt_name",profile.name);
    localStorage.setItem("twltt_avatar",profile.avatar);
    localStorage.setItem("twltt_avatarType",profile.avatarType);
    renderAvatarDisplay();updateUsernameDisplay();closeProfileModal();
  };
  document.getElementById("shareProfileBtn").onclick=shareProfile;
  document.getElementById("fileInput").onchange=e=>{
    const f=e.target.files[0];if(!f)return;
    if(f.size>2*1024*1024){alert("Image under 2 MB please.");return;}
    const r=new FileReader();r.onload=ev=>{profile.avatar=ev.target.result;profile.avatarType="image";buildAvatarOptions();};r.readAsDataURL(f);
  };
  document.getElementById("profileModal").onclick=e=>{if(e.target.id==="profileModal")closeProfileModal();};
  if(!profile.name)setTimeout(()=>{if(!profile.name)openProfileModal();},2000);
}
init();
