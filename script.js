const KEY = "redline_budget_v1";
const THEME_KEY = "redline_theme";

/* THEME */
function getTheme(){
  return localStorage.getItem(THEME_KEY) || "redline";
}

function applyTheme(theme){
  const t = theme === "grayman" ? "grayman" : "redline";
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem(THEME_KEY, t);

  // Update browser chrome color
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta){
    meta.content = t === "grayman" ? "#f0f0f2" : "#080808";
  }

  // Sync theme cards
  document.querySelectorAll(".theme-card").forEach(card => {
    card.classList.toggle("active", card.dataset.theme === t);
  });
}

function initTheme(){
  applyTheme(getTheme());

  document.querySelectorAll(".theme-card").forEach(card => {
    card.onclick = () => {
      applyTheme(card.dataset.theme);
      toast(card.dataset.theme === "grayman" ? "Grayman theme on" : "Redline theme on");
    };
  });
}

const money = n =>
  new Intl.NumberFormat("en-US",{
    style:"currency",
    currency:"USD"
  }).format(Number(n)||0);

const esc = s =>
  String(s ?? "")
    .replace(/[&<>"']/g,m=>({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#039;"
    }[m]));

const iso = d => {
  let x = new Date(d);
  return new Date(
    x.getTime() -
    x.getTimezoneOffset()*60000
  )
  .toISOString()
  .slice(0,10);
};

const today = () => iso(new Date());

const parseDate = s => {
  if(!s) return null;
  let [y,m,d] = s.split("-").map(Number);
  return new Date(y, m-1, d);
};

const fmtDate = d =>
  d
  ? parseDate(iso(d)).toLocaleDateString(
      "en-US",
      {
        month:"short",
        day:"numeric",
        year:"numeric"
      }
    )
  : "â";

const daysBetween = (a,b) =>
  Math.round(
    (
      parseDate(iso(b)) -
      parseDate(iso(a))
    ) / 86400000
  );

const uid = () =>
  crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now()+"_"+Math.random();

const monthDays = (y,m) =>
  new Date(y,m+1,0).getDate();

/* Snap a date forward to the preferred weekday (keeps same day if it already matches) */
const weekdayMap = {
  Sunday:0, Monday:1, Tuesday:2, Wednesday:3,
  Thursday:4, Friday:5, Saturday:6
};

function snapToWeekday(dateStr, weekdayName){
  let d = parseDate(dateStr);
  if(!d) return dateStr || today();
  let target = weekdayMap[weekdayName];
  if(target === undefined) target = 5; // Friday fallback
  let current = d.getDay();
  let diff = (target - current + 7) % 7;
  if(diff !== 0){
    d.setDate(d.getDate() + diff);
  }
  return iso(d);
}


let state = {
  schemaVersion:1,

  settings:{
    frequency:"biweekly",
    payday:"Friday",
    nextPay:today(),
    payAmount:0,
    checking:0,
    savePerPay:0
  },

  bills:[],

  savings:{
    current:0,
    goal:0,
    targetDate:"",
    contribution:0
  },

  payments:[]
};


/* STORAGE */

function load(){
  try{
    const x = JSON.parse(localStorage.getItem(KEY));

    if(x && x.schemaVersion){
      state = {
        ...state,
        ...x,
        settings:{
          ...state.settings,
          ...x.settings
        },
        savings:{
          ...state.savings,
          ...x.savings
        },
        bills: Array.isArray(x.bills) ? x.bills : [],
        payments: Array.isArray(x.payments) ? x.payments : []
      };
    }
  }catch(e){
    console.warn(e);
  }
}


function save(){
  localStorage.setItem(KEY, JSON.stringify(state));
}


/* TOAST */

function toast(msg,type="ok"){
  let d = document.createElement("div");
  d.className = "toast "+type;
  d.textContent = msg;
  document.getElementById("toastbox").appendChild(d);
  setTimeout(()=>d.remove(), 2600);
}


/* BILL OCCURRENCES */

function occurrences(b, start=today(), end=null){
  let s = parseDate(start);
  let limit = end
    ? parseDate(end)
    : new Date(s.getFullYear()+2, s.getMonth(), s.getDate());

  let out=[];

  if(!b.active) return out;

  if(b.frequency==="one"){
    let d = parseDate(b.dueDate);
    if(d >= s && d <= limit){
      out.push(d);
    }
    return out;
  }

  let cur;

  if(b.frequency==="weekly" || b.frequency==="biweekly"){
    cur = parseDate(b.startDate || b.dueDate);
    let step = b.frequency==="weekly" ? 7 : 14;

    while(cur < s){
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate()+step);
    }

    while(cur <= limit){
      out.push(new Date(cur));
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate()+step);
    }
  }
  else if(b.frequency==="monthly"){
    let base = parseDate(b.dueDate);
    let y = s.getFullYear();
    let m = s.getMonth();

    cur = new Date(y, m, Math.min(base.getDate(), monthDays(y,m)));

    if(cur < s){
      m++;
      if(m>11){ m=0; y++; }
      cur = new Date(y, m, Math.min(base.getDate(), monthDays(y,m)));
    }

    while(cur <= limit){
      out.push(new Date(cur));
      m++;
      if(m>11){ m=0; y++; }
      cur = new Date(y, m, Math.min(base.getDate(), monthDays(y,m)));
    }
  }
  else if(b.frequency==="quarterly"){
    let base = parseDate(b.dueDate);
    cur = new Date(base);

    while(cur < s){
      let nm = cur.getMonth()+3;
      let ny = cur.getFullYear();
      cur = new Date(ny, nm, Math.min(base.getDate(), monthDays(ny,nm)));
    }

    while(cur <= limit){
      out.push(new Date(cur));
      let nm = cur.getMonth()+3;
      let ny = cur.getFullYear();
      cur = new Date(ny, nm, Math.min(base.getDate(), monthDays(ny,nm)));
    }
  }
  else if(b.frequency==="yearly"){
    let base = parseDate(b.dueDate);
    let y = s.getFullYear();

    cur = new Date(y, base.getMonth(), Math.min(base.getDate(), monthDays(y, base.getMonth())));

    if(cur < s){
      y++;
      cur = new Date(y, base.getMonth(), Math.min(base.getDate(), monthDays(y, base.getMonth())));
    }

    while(cur <= limit){
      out.push(new Date(cur));
      y++;
      cur = new Date(y, base.getMonth(), Math.min(base.getDate(), monthDays(y, base.getMonth())));
    }
  }

  return out;
}


function nextOccurrence(b, from=today()){
  let end = iso(
    new Date(
      parseDate(from).getFullYear()+1,
      parseDate(from).getMonth(),
      parseDate(from).getDate()
    )
  );
  return occurrences(b, from, end)[0] || null;
}


function activeBills(){
  return state.bills.filter(b => b.active !== false);
}


function monthlyEstimate(b){
  let a = Number(b.amount)||0;
  if(b.frequency==="weekly") return a*52/12;
  if(b.frequency==="biweekly") return a*26/12;
  if(b.frequency==="quarterly") return a/3;
  if(b.frequency==="yearly") return a/12;
  return a;
}


function upcomingBills(days=45){
  let end = iso(
    new Date(
      parseDate(today()).getTime() + days*86400000
    )
  );

  let arr=[];

  activeBills().forEach(b=>{
    occurrences(b, today(), end).forEach(d=>{
      arr.push({b, d});
    });
  });

  return arr.sort((a,b)=>a.d-b.d);
}


/* PAYCHECKS */

function payDates(count=8){
  let s = parseDate(state.settings.nextPay || today());
  let step = state.settings.frequency==="weekly" ? 7 : 14;
  let a=[];

  for(let i=0; i<count; i++){
    a.push(new Date(s));
    s = new Date(s.getFullYear(), s.getMonth(), s.getDate()+step);
  }

  return a;
}


function billPaid(b,d){
  let key = b.id+"_"+iso(d);
  return state.payments.some(p=>p.key===key);
}


function markPaid(b,d){
  let key = b.id+"_"+iso(d);
  let i = state.payments.findIndex(p=>p.key===key);

  if(i>=0){
    state.payments.splice(i,1);
  }else{
    state.payments.push({
      id:uid(),
      key,
      billId:b.id,
      date:iso(d),
      amount:Number(b.amount)||0
    });
  }

  save();
  render();
}


function paycheckPlan(date){
  let start = iso(date);
  let next = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + (state.settings.frequency==="weekly" ? 7 : 14)
  );
  let end = iso(next);

  let items=[];

  activeBills().forEach(b=>{
    occurrences(b, start, end).forEach(d=>{
      if(!billPaid(b,d)){
        items.push({b, d});
      }
    });
  });

  let total = items.reduce((s,x)=> s + Number(x.b.amount||0), 0);
  let saveAmt = Number(state.settings.savePerPay||0);
  let remaining = Number(state.settings.payAmount||0) - total - saveAmt;

  return { items, total, save:saveAmt, remaining };
}


/* RENDER */

function render(){
  renderDashboard();
  renderBills();
  renderPay();
  renderSavings();
  renderReports();
  save();
}


/* DASHBOARD */

function renderDashboard(){
  document.getElementById("dChecking").textContent = money(state.settings.checking);

  // Keep the quick-update field in sync
  let qc = document.getElementById("quickChecking");
  if(qc && document.activeElement !== qc){
    qc.value = state.settings.checking || "";
  }

  let p = payDates(1)[0];
  let plan = paycheckPlan(p);
  let up = upcomingBills(45);

  document.getElementById("dPay").textContent = money(state.settings.payAmount);
  document.getElementById("dPayDate").textContent = p ? fmtDate(p) : "Not set";

  document.getElementById("dBills").textContent = money(
    up.reduce((s,x)=> s + Number(x.b.amount||0), 0)
  );
  document.getElementById("dBillCount").textContent = up.length + " upcoming";

  document.getElementById("dSavings").textContent = money(state.savings.current);
  document.getElementById("dSavingsGoal").textContent =
    state.savings.goal ? money(state.savings.goal)+" goal" : "No goal";

  let safe =
    Number(state.settings.checking||0)
    -
    up.slice(0,10).reduce((s,x)=>
      s + (billPaid(x.b, x.d) ? 0 : Number(x.b.amount||0)), 0)
    -
    Number(state.settings.savePerPay||0);

  document.getElementById("safeSpend").textContent = money(safe);
  document.getElementById("safeNote").textContent =
    safe < 0
    ? "Shortfall detected â upcoming obligations exceed available funds."
    : "After upcoming obligations and planned savings.";

  document.getElementById("safeHero").classList.toggle("warn", safe<0);

  document.getElementById("dashAlert").innerHTML =
    safe<0
    ? `
    <div class="card" style="border-color:var(--danger-border);color:var(--safe-warn);font-size:12px">
      <b>â  Funding warning</b><br>
      Review your upcoming bills or increase your available funds.
    </div>`
    : "";

  document.getElementById("upCount").textContent = up.length + " next 45 days";

  document.getElementById("dashBills").innerHTML =
    up.slice(0,5).map(x => billHTML(x.b, x.d)).join("")
    ||
    empty("No upcoming bills", "Add your first bill to start planning.");

  document.getElementById("dashPay").innerHTML = payHTML(p, plan);
}


/* BILL HTML */

function billHTML(b,d){
  let paid = billPaid(b,d);
  let days = daysBetween(today(), d);

  let cls =
    paid ? "green"
    : days<=3 ? "red"
    : days<=7 ? "yellow"
    : "";

  return `
  <div class="bill">
    <div class="billtop">
      <div>
        <div class="billname">${esc(b.name)}</div>
        <div class="billmeta">
          ${esc(b.category||"General")} Â· ${esc(b.frequency)}
        </div>
      </div>
      <div class="amt">${money(b.amount)}</div>
    </div>

    <div class="billbottom">
      <div>
        <span class="badge ${cls}">
          ${
            paid ? "PAID"
            : days<0 ? "OVERDUE"
            : days===0 ? "DUE TODAY"
            : days+" days"
          }
        </span>
        <span class="muted">Due ${fmtDate(d)}</span>
      </div>

      <div class="row">
        <button class="btn mini" onclick="editBill('${b.id}')">Edit</button>
        <button
          class="btn mini ${paid?"danger":""}"
          onclick="
            markPaid(
              state.bills.find(x=>x.id==='${b.id}'),
              parseDate('${iso(d)}')
            )
          "
        >
          ${paid?"Undo":"Paid"}
        </button>
      </div>
    </div>
  </div>
  `;
}


/* PAYCHECK HTML */

function payHTML(d,p){
  return `
  <div class="card">
    <div class="split">
      <div>
        <div class="eyebrow">${fmtDate(d)}</div>
        <div style="font-size:22px;font-weight:900">
          ${money(state.settings.payAmount)}
        </div>
      </div>
      <span class="badge ${p.remaining<0?"red":"green"}">
        ${p.remaining<0?"SHORTFALL":"ON TRACK"}
      </span>
    </div>

    <div style="margin-top:10px">
      ${
        p.items.slice(0,7).map(x => `
          <div class="payrow">
            <span>${esc(x.b.name)} Â· ${fmtDate(x.d)}</span>
            <b>${money(x.b.amount)}</b>
          </div>
        `).join("")
        ||
        `<div class="muted" style="padding:10px 0">
          No bills assigned to this pay period.
        </div>`
      }
    </div>

    <div class="payrow" style="margin-top:7px">
      <span>Bill allocations</span>
      <b>${money(p.total)}</b>
    </div>

    <div class="payrow">
      <span>Savings</span>
      <b>${money(p.save)}</b>
    </div>

    <div class="payrow">
      <span>Remaining</span>
      <b class="${p.remaining<0?"red":"green"}">${money(p.remaining)}</b>
    </div>
  </div>
  `;
}


/* EMPTY */

function empty(a,b){
  return `
  <div class="empty">
    <b>${a}</b>
    ${b}
  </div>
  `;
}


/* BILLS */

function renderBills(){
  let bs = activeBills();

  document.getElementById("bCount").textContent = bs.length;
  document.getElementById("bListCount").textContent = bs.length + " active";

  document.getElementById("bMonthly").textContent = money(
    bs.reduce((s,b)=> s + monthlyEstimate(b), 0)
  );

  let arr=[];
  bs.forEach(b=>{
    let d = nextOccurrence(b);
    if(d) arr.push({b, d});
  });

  arr.sort((a,b)=> a.d-b.d);

  document.getElementById("billList").innerHTML =
    arr.map(x => billHTML(x.b, x.d)).join("")
    ||
    empty("No bills yet", "Tap Add Bill to create your first obligation.");
}


/* PAYCHECK PAGE */

function renderPay(){
  document.getElementById("frequency").value = state.settings.frequency;
  document.getElementById("payday").value = state.settings.payday;
  document.getElementById("nextPay").value = state.settings.nextPay || today();
  document.getElementById("payAmount").value = state.settings.payAmount || "";
  document.getElementById("checking").value = state.settings.checking || "";
  document.getElementById("savePerPay").value = state.settings.savePerPay || "";

  document.getElementById("payList").innerHTML =
    payDates(8).map(d => payHTML(d, paycheckPlan(d))).join("");
}


/* SAVINGS */

function renderSavings(){
  let s = Number(state.savings.current||0);
  let g = Number(state.savings.goal||0);
  let pct = g ? Math.min(100, s/g*100) : 0;

  document.getElementById("sCurrent").textContent = money(s);
  document.getElementById("sGoal").textContent = money(g);
  document.getElementById("sRemain").textContent = money(Math.max(0, g-s));
  document.getElementById("sBar").style.width = pct+"%";

  document.getElementById("sTarget").textContent =
    state.savings.targetDate
    ? "Target: " + fmtDate(state.savings.targetDate)
    : g
    ? "Goal: " + money(g)
    : "No goal set.";

  document.getElementById("savings").value = s || "";
  document.getElementById("goal").value = g || "";
  document.getElementById("targetDate").value = state.savings.targetDate || "";
  document.getElementById("contribution").value =
    state.savings.contribution || state.settings.savePerPay || "";
}


/* REPORTS */

function renderReports(){
  let start = document.getElementById("reportStart");
  if(!start.value){
    let d = new Date();
    start.value = iso(new Date(d.getFullYear(), d.getMonth(), 1));
  }
}


/* MODAL */

function openModal(title, body, onSave){
  let bg = document.getElementById("modalBg");
  let m = document.getElementById("modal");

  m.innerHTML = `
    <div class="modalhead">
      <h2>${title}</h2>
      <button class="close" id="closeModal">Ã</button>
    </div>
    ${body}
    <div class="modalfoot">
      <button class="btn" id="cancelModal">Cancel</button>
      <button class="btn primary" id="modalSave">Save</button>
    </div>
  `;

  bg.classList.add("show");

  document.getElementById("closeModal").onclick = closeModal;
  document.getElementById("cancelModal").onclick = closeModal;
  document.getElementById("modalSave").onclick = () => {
    if(onSave()) closeModal();
  };
}


function closeModal(){
  document.getElementById("modalBg").classList.remove("show");
}


/* BILL FORM */

function billForm(b={}){
  let d = b.dueDate || today();

  return `
  <div class="grid two">
    <div class="field">
      <label>Bill Name</label>
      <input id="fName" value="${esc(b.name||"")}" placeholder="e.g. Electric">
    </div>

    <div class="field">
      <label>Amount</label>
      <input type="number" min="0" step=".01" id="fAmount" value="${b.amount??""}" placeholder="0.00">
    </div>

    <div class="field">
      <label>Due Date</label>
      <input type="date" id="fDate" value="${d}">
    </div>

    <div class="field">
      <label>Frequency</label>
      <select id="fFreq">
        <option value="monthly">Monthly</option>
        <option value="weekly">Weekly</option>
        <option value="biweekly">Every 2 Weeks</option>
        <option value="quarterly">Quarterly</option>
        <option value="yearly">Yearly</option>
        <option value="one">One Time</option>
      </select>
    </div>

    <div class="field">
      <label>Category</label>
      <input id="fCat" value="${esc(b.category||"")}" placeholder="General">
    </div>

    <div class="field">
      <label>Priority</label>
      <select id="fPriority">
        <option>Normal</option>
        <option>High</option>
        <option>Critical</option>
      </select>
    </div>

    <div class="field full">
      <label>Notes</label>
      <textarea id="fNotes" placeholder="Optional notesâ¦">${esc(b.notes||"")}</textarea>
    </div>
  </div>
  `;
}


function showBill(b=null){
  openModal(
    b ? "Edit Bill" : "Add Bill",
    billForm(b||{}),
    () => {
      let name = document.getElementById("fName").value.trim();
      let amount = Number(document.getElementById("fAmount").value);
      let date = document.getElementById("fDate").value;

      if(!name || !date || amount<0){
        toast("Please enter a bill name, date, and valid amount.", "err");
        return false;
      }

      let obj = {
        id: b?.id || uid(),
        name,
        amount,
        dueDate: date,
        startDate: date,
        frequency: document.getElementById("fFreq").value,
        category: document.getElementById("fCat").value.trim() || "General",
        priority: document.getElementById("fPriority").value,
        notes: document.getElementById("fNotes").value.trim(),
        active: true
      };

      if(b){
        Object.assign(b, obj);
      }else{
        state.bills.push(obj);
      }

      save();
      render();
      toast(b ? "Bill updated" : "Bill added");
      return true;
    }
  );

  if(b){
    document.getElementById("fFreq").value = b.frequency;
    document.getElementById("fPriority").value = b.priority || "Normal";
  }
}


window.editBill = id =>
  showBill(state.bills.find(b=>b.id===id));


function addBill(){
  showBill();
}


/* REPORT GENERATOR */

function generateReport(){
  let type = document.getElementById("reportType").value;
  let start = document.getElementById("reportStart").value;
  let end;

  if(type==="monthly"){
    let d = parseDate(start);
    end = iso(new Date(d.getFullYear(), d.getMonth()+1, 0));
  }
  else if(type==="weekly"){
    end = iso(new Date(parseDate(start).getTime() + 6*86400000));
  }
  else{
    end = document.getElementById("reportEnd").value;
  }

  if(!start || !end){
    toast("Choose a valid date range.", "err");
    return;
  }

  let planned=[];
  let paid=[];

  activeBills().forEach(b=>{
    occurrences(b, start, end).forEach(d=>{
      let x = {b, d};
      planned.push(x);
      if(billPaid(b, d)) paid.push(x);
    });
  });

  let useHistory = document.getElementById("reportHistory").value === "yes";
  let list = useHistory ? paid : planned;

  let total = list.reduce((s,x)=> s + Number(x.b.amount||0), 0);

  let categories={};
  list.forEach(x=>{
    let c = x.b.category || "General";
    categories[c] = (categories[c] || 0) + Number(x.b.amount||0);
  });

  let income =
    payDates(20)
      .filter(d => d>=parseDate(start) && d<=parseDate(end))
      .length
    * Number(state.settings.payAmount||0);

  let savingsContribution = Number(
    state.savings.contribution || state.settings.savePerPay || 0
  );

  let paycheckCount =
    payDates(20)
      .filter(d => d>=parseDate(start) && d<=parseDate(end))
      .length;

  let savingsTotal = savingsContribution * paycheckCount;

  document.getElementById("reportPreview").innerHTML = `
  <div class="report">
    <div class="reportActions noPrint">
      <button class="btn" onclick="window.print()">Print Report</button>
    </div>

    <h3>
      REDLINE â
      ${type==="monthly" ? "MONTHLY" : type==="weekly" ? "WEEKLY" : "CUSTOM"}
      MONEY REPORT
    </h3>

    <small>${fmtDate(start)} â ${fmtDate(end)}</small>

    <div class="reportgrid">
      <div class="reportbox">
        <span>EST. INCOME</span>
        <b>${money(income)}</b>
      </div>
      <div class="reportbox">
        <span>${useHistory ? "PAID" : "PLANNED"} BILLS</span>
        <b>${money(total)}</b>
      </div>
      <div class="reportbox">
        <span>SAVINGS</span>
        <b>${money(savingsTotal)}</b>
      </div>
      <div class="reportbox">
        <span>REMAINING</span>
        <b>${money(income-total-savingsTotal)}</b>
      </div>
    </div>

    <h4>Expense Breakdown</h4>

    <table class="reporttable">
      <thead>
        <tr>
          <th>Category</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${
          Object.entries(categories)
            .sort((a,b)=> b[1]-a[1])
            .map(([k,v]) => `
              <tr>
                <td>${esc(k)}</td>
                <td>${money(v)}</td>
              </tr>
            `).join("")
          ||
          `<tr><td colspan="2">No expenses in this period.</td></tr>`
        }
      </tbody>
    </table>

    <h4 style="margin-top:20px">Bills</h4>

    <table class="reporttable">
      <thead>
        <tr>
          <th>Status</th>
          <th>Bill</th>
          <th>Due</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${
          list.map(x => `
            <tr>
              <td>${billPaid(x.b, x.d) ? "Paid" : "Planned"}</td>
              <td>${esc(x.b.name)}</td>
              <td>${fmtDate(x.d)}</td>
              <td>${money(x.b.amount)}</td>
            </tr>
          `).join("")
          ||
          `<tr><td colspan="4">No bills.</td></tr>`
        }
      </tbody>
    </table>

    <p style="margin-top:22px;font-size:9px;color:#777">
      Generated by Redline Â· Your money. Your schedule. Your plan.
    </p>
  </div>
  `;
}


/* DOWNLOAD */

function download(name, data){
  let a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([data], {type:"application/json"})
  );
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}


/* EXPORT FULL BACKUP */

function exportAll(){
  download(
    "redline-backup-"+today()+".json",
    JSON.stringify(state, null, 2)
  );
  toast("Full backup exported");
}


/* EXPORT BILLS */

function exportBills(){
  download(
    "redline-bills-"+today()+".json",
    JSON.stringify({
      schemaVersion:1,
      exportDate: new Date().toISOString(),
      bills: state.bills
    }, null, 2)
  );
  toast("Bills exported");
}


/* FILE READER */

function readFile(input, cb){
  let f = input.files[0];
  if(!f) return;

  let r = new FileReader();
  r.onload = () => {
    try{
      cb(JSON.parse(r.result));
    }catch(e){
      toast("Invalid JSON file.", "err");
    }
  };
  r.readAsText(f);
  input.value="";
}


/* INITIALIZATION */

function init(){
  load();
  initTheme();

  /* NAVIGATION */
  document.querySelectorAll(".nav button").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".nav button").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");

      document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
      document.getElementById("page-"+btn.dataset.page).classList.add("active");
      window.scrollTo(0,0);
    };
  });

  /* ADD BILL */
  document.getElementById("quickAdd").onclick = addBill;
  document.getElementById("addBill").onclick = addBill;

  /* SAVE PAYCHECK */
  document.getElementById("savePay").onclick = () => {
    state.settings.frequency = document.getElementById("frequency").value;
    state.settings.payday = document.getElementById("payday").value;

    // Snap Next Payday to the preferred weekday
    let rawNext = document.getElementById("nextPay").value || today();
    state.settings.nextPay = snapToWeekday(rawNext, state.settings.payday);

    state.settings.payAmount = Number(document.getElementById("payAmount").value) || 0;
    state.settings.checking = Number(document.getElementById("checking").value) || 0;
    state.settings.savePerPay = Number(document.getElementById("savePerPay").value) || 0;

    // Reflect the snapped date back into the input
    document.getElementById("nextPay").value = state.settings.nextPay;

    save();
    render();
    toast("Pay schedule saved");
  };

  /* Live snap when Preferred Payday changes */
  document.getElementById("payday").onchange = () => {
    let raw = document.getElementById("nextPay").value || today();
    let snapped = snapToWeekday(raw, document.getElementById("payday").value);
    document.getElementById("nextPay").value = snapped;
  };

  /* Quick Update Checking Balance (Dashboard) */
  document.getElementById("updateChecking").onclick = () => {
    let val = Number(document.getElementById("quickChecking").value);
    if(isNaN(val) || val < 0){
      toast("Enter a valid checking balance.", "err");
      return;
    }
    state.settings.checking = val;
    // Keep the Paycheck page input in sync
    document.getElementById("checking").value = val || "";
    save();
    render();
    toast("Checking balance updated");
  };

  /* SAVE SAVINGS */
  document.getElementById("saveSavings").onclick = () => {
    state.savings.current = Number(document.getElementById("savings").value) || 0;
    state.savings.goal = Number(document.getElementById("goal").value) || 0;
    state.savings.targetDate = document.getElementById("targetDate").value;
    state.savings.contribution = Number(document.getElementById("contribution").value) || 0;
    state.settings.savePerPay = state.savings.contribution;

    save();
    render();
    toast("Savings plan saved");
  };

  /* REPORT TYPE */
  document.getElementById("reportType").onchange = e => {
    document.getElementById("reportEndWrap").style.display =
      e.target.value==="custom" ? "flex" : "none";
  };

  document.getElementById("generateReport").onclick = generateReport;

  document.getElementById("printReport").onclick = () => {
    generateReport();
    setTimeout(() => window.print(), 100);
  };

  /* EXPORT */
  document.getElementById("exportAll").onclick = exportAll;
  document.getElementById("exportBills").onclick = exportBills;

  /* IMPORT */
  document.getElementById("importAll").onclick = () =>
    document.getElementById("allInput").click();

  document.getElementById("importBills").onclick = () =>
    document.getElementById("billInput").click();

  /* FULL IMPORT */
  document.getElementById("allInput").onchange = e =>
    readFile(e.target, data => {
      if(!confirm("Replace your current Redline data with this backup?")) return;

      if(!data || data.schemaVersion!==1 || !Array.isArray(data.bills)){
        toast("Invalid Redline backup.", "err");
        return;
      }

      state = data;
      save();
      render();
      toast("Backup restored");
    });

  /* BILL IMPORT */
  document.getElementById("billInput").onchange = e =>
    readFile(e.target, data => {
      if(!Array.isArray(data.bills)){
        toast("Invalid bill backup.", "err");
        return;
      }

      state.bills = data.bills;
      save();
      render();
      toast("Bills imported");
    });

  /* CLEAR */
  document.getElementById("clearData").onclick = () => {
    if(confirm("Erase ALL Redline data from this browser? This cannot be undone unless you have a backup.")){
      localStorage.removeItem(KEY);
      location.reload();
    }
  };

  /* FIRST RUN */
  if(!localStorage.getItem(KEY)){
    toast("Welcome to Redline â add your first bill to begin.");
  }

  render();
}


init();
