import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore, collection, doc, setDoc, getDoc, getDocs, addDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

// ------------------------------------------------------------- firebase --
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
const auth = getAuth(fbApp);

function waitForAuth() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, (user) => {
      if (user) resolve(user);
    });
    signInAnonymously(auth).catch(reject);
  });
}

// ---------------------------------------------------------------- helpers --
const $ = (sel, root = document) => root.querySelector(sel);
const $all = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const round1 = (n) => Math.round(n * 10) / 10;
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function sumItems(items) {
  return items.reduce(
    (a, it) => ({
      cal: a.cal + (it.cal || 0),
      protein: a.protein + (it.protein || 0),
      carbs: a.carbs + (it.carbs || 0),
      fat: a.fat + (it.fat || 0),
    }),
    { cal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function scaleFood(food, grams) {
  const factor = grams / 100;
  return {
    cal: round1(food.cal * factor),
    protein: round1(food.protein * factor),
    carbs: round1(food.carbs * factor),
    fat: round1(food.fat * factor),
  };
}
function effectiveGoalFor(goalsHistory, dateStr) {
  const dates = Object.keys(goalsHistory).filter((d) => d <= dateStr).sort();
  if (dates.length === 0) return 2000;
  return goalsHistory[dates[dates.length - 1]];
}

// ---- Built-in food database (values per 100g) — always available, never stored ----
const FOOD_DB = {
  "חזה עוף": { cal: 165, protein: 31, carbs: 0, fat: 3.6 },
  "חזה הודו": { cal: 135, protein: 30, carbs: 0, fat: 1 },
  "בשר בקר טחון 10%": { cal: 217, protein: 26, carbs: 0, fat: 12 },
  "סלמון": { cal: 208, protein: 20, carbs: 0, fat: 13 },
  "טונה בשימורים במים": { cal: 116, protein: 26, carbs: 0, fat: 1 },
  "ביצה קשה": { cal: 155, protein: 13, carbs: 1.1, fat: 11 },
  "יוגורט טבעי 3%": { cal: 61, protein: 3.5, carbs: 4.7, fat: 3 },
  "קוטג' 5%": { cal: 98, protein: 11, carbs: 3.4, fat: 5 },
  "בולגרית 5%": { cal: 109, protein: 13, carbs: 3, fat: 5 },
  "צפתית 5%": { cal: 117, protein: 12, carbs: 6, fat: 5 },
  "גבינה צהובה": { cal: 350, protein: 25, carbs: 1.3, fat: 27 },
  "גבינה צהובה 9%": { cal: 201, protein: 30, carbs: 0, fat: 9 },
  "אורז לבן מבושל": { cal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  "אורז מלא מבושל": { cal: 111, protein: 2.6, carbs: 23, fat: 0.9 },
  "פסטה מבושלת": { cal: 131, protein: 5, carbs: 25, fat: 1.1 },
  "לחם מלא": { cal: 247, protein: 13, carbs: 41, fat: 3.4 },
  "לחם לבן": { cal: 265, protein: 9, carbs: 49, fat: 3.2 },
  "בטטה אפויה": { cal: 90, protein: 2, carbs: 21, fat: 0.1 },
  "תפוח אדמה מבושל": { cal: 87, protein: 1.9, carbs: 20, fat: 0.1 },
  "חומוס": { cal: 186, protein: 11.3, carbs: 10.5, fat: 11 },
  "עדשים מבושלות": { cal: 116, protein: 9, carbs: 20, fat: 0.4 },
  "אבוקדו": { cal: 160, protein: 2, carbs: 8.5, fat: 14.7 },
  "בננה": { cal: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  "תפוח": { cal: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  "עגבנייה": { cal: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
  "מלפפון": { cal: 15, protein: 0.7, carbs: 3.6, fat: 0.1 },
  "תירס לייט": { cal: 45, protein: 1.2, carbs: 8, fat: 0.9 },
  "בצל": { cal: 40, protein: 1.1, carbs: 9.3, fat: 0.1 },
  "גמבה צהובה": { cal: 27, protein: 1, carbs: 6.3, fat: 0.2 },
  "חסה": { cal: 15, protein: 1.4, carbs: 2.9, fat: 0.2 },
  "בצל סגול": { cal: 40, protein: 1.1, carbs: 9.3, fat: 0.1 },
  "בצל לבן": { cal: 40, protein: 1.1, carbs: 9.3, fat: 0.1 },
  "טופו": { cal: 76, protein: 8, carbs: 1.9, fat: 4.8 },
  "שקדים": { cal: 579, protein: 21, carbs: 22, fat: 50 },
  "טחינה גולמית": { cal: 595, protein: 17, carbs: 21, fat: 54, tspGrams: 8 },
  "שמן זית": { cal: 884, protein: 0, carbs: 0, fat: 100, tspGrams: 4.5 },
};

// ---------------------------------------------------------- data layer --
async function fetchCustomFoods() {
  const snap = await getDocs(collection(db, "foods"));
  const out = {};
  snap.forEach((d) => (out[d.id] = d.data()));
  return out;
}
async function saveFood(name, per100) {
  await setDoc(doc(db, "foods", name), per100, { merge: true });
}
async function fetchEntries(dateStr) {
  const q = query(collection(db, "entries"), where("date", "==", dateStr));
  const snap = await getDocs(q);
  const list = [];
  snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
  list.sort((a, b) => (a._order || 0) - (b._order || 0));
  return list;
}
async function addEntryDoc(entry) {
  await addDoc(collection(db, "entries"), { ...entry, _order: Date.now(), createdAt: serverTimestamp() });
}
async function deleteEntryDoc(id) {
  await deleteDoc(doc(db, "entries", id));
}
async function fetchAllGoals() {
  const snap = await getDocs(query(collection(db, "goals"), orderBy("date")));
  const history = {};
  snap.forEach((d) => (history[d.data().date] = d.data().goal));
  return history;
}
async function setGoalDoc(dateStr, value) {
  // One document per date, overwritten on every edit — avoids duplicate
  // same-day docs whose read-back order Firestore doesn't guarantee.
  await setDoc(doc(db, "goals", dateStr), { date: dateStr, goal: value });
}
async function fetchEntriesForDates(dates) {
  // Firestore 'in' supports up to 30 values — 7 is plenty.
  const q = query(collection(db, "entries"), where("date", "in", dates));
  const snap = await getDocs(q);
  const byDate = {};
  dates.forEach((d) => (byDate[d] = []));
  snap.forEach((d) => {
    const data = d.data();
    (byDate[data.date] || (byDate[data.date] = [])).push(data);
  });
  return byDate;
}

// Looks up average nutrition per 100g for a food name via USDA FoodData Central (free, public API).
async function searchNutrition(name) {
  const resp = await fetch(
    `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(name)}&pageSize=6&api_key=DEMO_KEY`
  );
  if (!resp.ok) throw new Error("שגיאה בחיפוש באינטרנט");
  const data = await resp.json();
  const foods = (data.foods || []).sort((a, b) => {
    const rank = (f) => (["Foundation", "SR Legacy"].includes(f.dataType) ? 0 : 1);
    return rank(a) - rank(b);
  });
  for (const f of foods) {
    const nutrients = {};
    (f.foodNutrients || []).forEach((n) => (nutrients[n.nutrientName] = n.value));
    if (nutrients["Energy"] != null) {
      return {
        cal: round1(nutrients["Energy"]),
        protein: round1(nutrients["Protein"] || 0),
        carbs: round1(nutrients["Carbohydrate, by difference"] || 0),
        fat: round1(nutrients["Total lipid (fat)"] || 0),
      };
    }
  }
  throw new Error(`לא נמצאו תוצאות עבור "${name}"`);
}

// ------------------------------------------------------------------ state --
const state = {
  goal: 2000,
  goalsHistory: {},
  customFoods: {},
  entries: [],
  expandedMeals: new Set(),
  mode: "meal",
  mealItems: [],
  mealSource: "list",
  mealUnit: "g",
  singleUnit: "g",
  itemSource: "search",
  expandedHistoryDays: new Set(),
};

// ------------------------------------------------------------------- init --
async function init() {
  try {
    await waitForAuth();
  } catch (err) {
    $("#app").innerHTML = `<p class="text-center text-red py-10">שגיאת התחברות. יש לבדוק חיבור לאינטרנט ולרענן.</p>`;
    return;
  }
  const today = todayISO();
  let customFoods, goalsHistory, entries;
  try {
    [customFoods, goalsHistory, entries] = await Promise.all([
      fetchCustomFoods(),
      fetchAllGoals(),
      fetchEntries(today),
    ]);
  } catch (err) {
    console.error("שגיאה בטעינת נתונים:", err);
    $("#app").innerHTML = `<p class="text-center text-red py-10">שגיאה בטעינת הנתונים: ${escapeHtml(
      err && err.message ? err.message : "שגיאה לא ידועה"
    )}</p>`;
    return;
  }
  state.customFoods = customFoods;
  state.goalsHistory = goalsHistory;
  state.goal = effectiveGoalFor(goalsHistory, today);
  state.entries = entries;

  renderShell();
  bindStaticEvents();
  initFoodPickers();
  updateGoal();
  updateSummary();
  renderEntries();
}

function allFoods() {
  return { ...FOOD_DB, ...state.customFoods };
}
function foodByName(name) {
  return allFoods()[name];
}

// -------------------------------------------------------------- app shell --
function renderShell() {
  $("#app").innerHTML = `
    <h1 class="font-display font-black text-2xl text-center mb-4 text-ink">חישוב קלוריות יומי</h1>

    <div class="flex items-center justify-between mb-5 px-1">
      <div class="flex items-center gap-2">
        <div class="w-9 h-9 rounded-full bg-red flex items-center justify-center flex-shrink-0">🍽️</div>
        <div>
          <h2 class="font-display font-bold text-base leading-tight text-ink">היומן שלי</h2>
          <p class="text-xs leading-tight text-muted">${new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
      </div>
      <div class="relative">
        <button id="menu-btn" class="w-9 h-9 rounded-full bg-card flex items-center justify-center shadow-sm text-lg">☰</button>
        <div id="menu-dropdown" class="hidden absolute left-0 mt-2 w-56 bg-card rounded-xl shadow-lg border border-border z-30 overflow-hidden">
          <button id="menu-history-btn" class="w-full text-right px-4 py-3 text-sm text-ink flex items-center gap-2">
            <span class="text-green">📅</span> היסטוריית אירועים
          </button>
        </div>
      </div>
    </div>

    <div class="bg-card rounded-2xl px-4 py-3 mb-4 flex items-center justify-between shadow-sm">
      <div class="flex items-center gap-2">
        <span class="text-green">🎯</span>
        <span class="text-sm text-inkSoft">יעד יומי</span>
      </div>
      <div id="goal-display"></div>
    </div>

    <div class="bg-card rounded-2xl mb-4 shadow-sm overflow-hidden">
      <div class="px-4 pt-3 pb-2 border-b-8 border-ink">
        <h2 class="font-display font-black text-xl text-ink">ערכים תזונתיים — היום</h2>
      </div>
      <div class="px-4 pt-3 pb-1 border-b-4 border-ink">
        <div class="flex items-baseline justify-between">
          <span class="font-display font-bold text-sm text-ink">קלוריות</span>
          <span class="font-mono-he font-black text-2xl text-ink">
            <span id="sum-cal">0</span>
            <span class="text-sm font-medium text-mutedLight"> / <span id="sum-goal">2000</span></span>
          </span>
        </div>
        <div class="h-2 w-full rounded-full overflow-hidden mt-2 mb-3 bg-track">
          <div id="progress-bar" class="h-full rounded-full transition-all bg-green" style="width:0%"></div>
        </div>
      </div>
      <div class="px-4 py-2">
        <div class="flex items-center justify-between py-2">
          <div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-red"></span><span class="text-sm text-inkSoft">חלבון</span></div>
          <span class="font-mono-he font-bold text-sm text-ink"><span id="sum-protein">0</span> גרם</span>
        </div>
        <div class="flex items-center justify-between py-2 border-t border-track">
          <div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-gold"></span><span class="text-sm text-inkSoft">פחמימות</span></div>
          <span class="font-mono-he font-bold text-sm text-ink"><span id="sum-carbs">0</span> גרם</span>
        </div>
        <div class="flex items-center justify-between py-2 border-t border-track">
          <div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-blue"></span><span class="text-sm text-inkSoft">שומן</span></div>
          <span class="font-mono-he font-bold text-sm text-ink"><span id="sum-fat">0</span> גרם</span>
        </div>
      </div>
      <div class="h-2 bg-ink"></div>
    </div>

    <div class="bg-card rounded-2xl px-4 py-4 mb-4 shadow-sm">
      <div class="flex items-center gap-1 mb-4 bg-row rounded-xl p-1">
        <button data-tab="meal" class="tab-btn flex-1 text-center text-xs font-display font-bold py-2 rounded-lg">ארוחה חדשה</button>
        <button data-tab="single" class="tab-btn flex-1 text-center text-xs font-display font-bold py-2 rounded-lg">פריט בודד</button>
        <button data-tab="newItem" class="tab-btn flex-1 text-center text-xs font-display font-bold py-2 rounded-lg">פריט חדש</button>
      </div>

      ${mealPanelHTML()}
      ${singlePanelHTML()}
      ${newItemPanelHTML()}
    </div>

    <div class="bg-card rounded-2xl px-4 py-4 shadow-sm">
      <h3 class="font-display font-bold text-sm mb-3 text-ink">ארוחות היום</h3>
      <ul id="entries-list" class="space-y-2"></ul>
    </div>

    <p class="text-center text-xs mt-4" style="color:#B0A895">הנתונים נשמרים בענן (Firebase) ונגישים מכל מכשיר.</p>
  `;
  setActiveTab("meal");
}

function mealPanelHTML() {
  return `
  <div id="panel-meal" class="tab-panel">
    <input id="meal-name" type="text" placeholder='שם הארוחה (לדוגמה: "ארוחת צהריים")' class="w-full rounded-xl px-3 py-2.5 text-sm mb-3 font-display font-bold border border-border" />
    <p class="text-xs mb-2 text-muted">הוסיפי כל מרכיב בארוחה בנפרד:</p>
    <div class="flex items-center gap-1.5 mb-2">
      <button data-src="list" class="src-btn flex-1 text-xs font-medium py-2 rounded-lg border">מהרשימה</button>
      <button data-src="search" class="src-btn flex-1 text-xs font-medium py-2 rounded-lg border">חיפוש באינטרנט</button>
      <button data-src="manual" class="src-btn flex-1 text-xs font-medium py-2 rounded-lg border">הזנה ידנית</button>
    </div>

    <div class="src-panel-list relative">
      <input id="meal-food-input" type="text" autocomplete="off" placeholder="חיפוש או בחירה מהרשימה..." class="w-full rounded-xl px-3 py-2.5 text-sm mb-2 border border-border" />
      <div id="meal-food-dropdown" class="hidden absolute z-20 -mt-1 w-full max-h-48 overflow-y-auto bg-white border border-border rounded-xl shadow-lg"></div>
      <div id="meal-unit-toggle" class="hidden flex items-center gap-1.5 mb-2">
        <button data-unit="g" class="meal-unit-btn flex-1 text-xs font-medium py-2 rounded-lg border">גרם</button>
        <button data-unit="tsp" class="meal-unit-btn flex-1 text-xs font-medium py-2 rounded-lg border">כפיות</button>
      </div>
    </div>

    <div class="src-panel-search hidden">
      <div class="flex gap-2 mb-2">
        <input id="meal-search-name" type="text" placeholder='שם המרכיב, למשל "בצל ירוק"' class="flex-1 rounded-xl px-3 py-2.5 text-sm border border-border" />
        <button id="meal-search-btn" class="px-3 rounded-xl text-sm font-display font-bold bg-green text-white">🔍</button>
      </div>
      <p id="meal-search-error" class="text-xs mb-2 text-red hidden"></p>
      <div id="meal-search-result" class="hidden bg-row rounded-xl p-3 mb-2">
        <p class="text-xs font-bold mb-2 text-muted">ערכים ל-100 גרם (ניתן לערוך):</p>
        <div class="grid grid-cols-2 gap-2">
          ${labeledInputHTML("meal-search-cal", "קלוריות")}
          ${labeledInputHTML("meal-search-protein", "חלבון (גר׳)")}
          ${labeledInputHTML("meal-search-carbs", "פחמימות (גר׳)")}
          ${labeledInputHTML("meal-search-fat", "שומן (גר׳)")}
        </div>
      </div>
    </div>

    <div class="src-panel-manual hidden">
      <input id="meal-manual-name" type="text" placeholder="שם המרכיב" class="w-full rounded-xl px-3 py-2.5 text-sm mb-2 border border-border" />
      <p class="text-xs mb-2 text-muted">ערכים ל-100 גרם:</p>
      <div class="grid grid-cols-2 gap-2 mb-2">
        <input id="meal-manual-cal" type="number" placeholder="קלוריות" class="rounded-xl px-3 py-2.5 text-sm border border-border" />
        <input id="meal-manual-protein" type="number" placeholder="חלבון (גר׳)" class="rounded-xl px-3 py-2.5 text-sm border border-border" />
        <input id="meal-manual-carbs" type="number" placeholder="פחמימות (גר׳)" class="rounded-xl px-3 py-2.5 text-sm border border-border" />
        <input id="meal-manual-fat" type="number" placeholder="שומן (גר׳)" class="rounded-xl px-3 py-2.5 text-sm border border-border" />
      </div>
    </div>

    <div class="flex gap-2 mb-3 mt-2">
      <input id="meal-grams" type="number" placeholder="גרם" class="flex-1 rounded-xl px-3 py-2.5 text-sm border border-border" />
      <button id="meal-add-ingredient" class="px-4 rounded-xl text-sm font-display font-bold bg-green text-white">+ הוספה</button>
    </div>

    <div id="meal-items-box" class="hidden bg-row rounded-xl p-3 mb-3">
      <p class="text-xs font-bold mb-2 text-muted">מכיל:</p>
      <ul id="meal-items-list" class="space-y-1.5 mb-2"></ul>
      <div class="pt-2 flex items-center justify-between border-t border-border">
        <span class="text-xs font-bold text-ink">סה״כ לארוחה</span>
        <span id="meal-items-total" class="font-mono-he font-bold text-sm text-ink"></span>
      </div>
    </div>

    <button id="save-meal-btn" class="w-full rounded-xl py-2.5 text-sm font-display font-bold bg-ink text-white opacity-40" disabled>+ הוסף ארוחה</button>
  </div>`;
}

function singlePanelHTML() {
  return `
  <div id="panel-single" class="tab-panel hidden">
    <div class="flex items-center justify-end mb-2">
      <button id="single-custom-toggle" class="text-xs font-medium underline text-green">ערכים חד-פעמיים</button>
    </div>
    <div id="single-food-picker-wrap" class="relative">
      <input id="single-food-input" type="text" autocomplete="off" placeholder="חיפוש או בחירה מהרשימה..." class="w-full rounded-xl px-3 py-2.5 text-sm mb-2 border border-border" />
      <div id="single-food-dropdown" class="hidden absolute z-20 -mt-1 w-full max-h-48 overflow-y-auto bg-white border border-border rounded-xl shadow-lg"></div>
    </div>
    <input id="single-food-name" type="text" placeholder="שם הפריט" class="hidden w-full rounded-xl px-3 py-2.5 text-sm mb-2 border border-border" />
    <div id="single-unit-toggle" class="hidden flex items-center gap-1.5 mb-2">
      <button data-unit="g" class="single-unit-btn flex-1 text-xs font-medium py-2 rounded-lg border">גרם</button>
      <button data-unit="tsp" class="single-unit-btn flex-1 text-xs font-medium py-2 rounded-lg border">כפיות</button>
    </div>
    <div class="flex gap-2 mb-2">
      <input id="single-grams" type="number" placeholder="גרם" class="flex-1 rounded-xl px-3 py-2.5 text-sm border border-border" />
      <input id="single-cal" type="number" placeholder="קלוריות" class="single-custom hidden flex-1 rounded-xl px-3 py-2.5 text-sm border border-border" />
    </div>
    <div class="single-custom hidden flex gap-2 mb-2">
      <input id="single-protein" type="number" placeholder="חלבון" class="flex-1 rounded-xl px-3 py-2.5 text-sm border border-border" />
      <input id="single-carbs" type="number" placeholder="פחמימות" class="flex-1 rounded-xl px-3 py-2.5 text-sm border border-border" />
      <input id="single-fat" type="number" placeholder="שומן" class="flex-1 rounded-xl px-3 py-2.5 text-sm border border-border" />
    </div>
    <button id="add-single-btn" class="w-full rounded-xl py-2.5 text-sm font-display font-bold bg-ink text-white">הוספה ליומן</button>
  </div>`;
}

function newItemPanelHTML() {
  return `
  <div id="panel-newItem" class="tab-panel hidden">
    <div class="flex items-center gap-1.5 mb-3">
      <button data-item-src="search" class="item-src-btn flex-1 text-xs font-medium py-2 rounded-lg border">חיפוש באינטרנט</button>
      <button data-item-src="manual" class="item-src-btn flex-1 text-xs font-medium py-2 rounded-lg border">הזנה ידנית</button>
    </div>

    <div class="item-src-panel-search">
      <p class="text-xs mb-2 text-muted">הזיני שם מוצר — נחפש עבורך את הערכים התזונתיים הממוצעים ל-100 גרם באינטרנט (USDA FoodData Central).</p>
      <div class="flex gap-2 mb-3">
        <input id="lookup-name" type="text" placeholder='למשל: "פלאפל"' class="flex-1 rounded-xl px-3 py-2.5 text-sm border border-border" />
        <button id="lookup-btn" class="px-4 rounded-xl text-sm font-display font-bold bg-green text-white">חיפוש</button>
      </div>
      <p id="lookup-error" class="text-xs mb-3 text-red hidden"></p>
      <div id="lookup-result" class="hidden bg-row rounded-xl p-3 mb-3">
        <p class="text-xs font-bold mb-2 text-muted">ערכים ל-100 גרם (ניתן לערוך לפני שמירה):</p>
        <div class="grid grid-cols-2 gap-2">
          ${labeledInputHTML("lookup-cal", "קלוריות")}
          ${labeledInputHTML("lookup-protein", "חלבון (גר׳)")}
          ${labeledInputHTML("lookup-carbs", "פחמימות (גר׳)")}
          ${labeledInputHTML("lookup-fat", "שומן (גר׳)")}
        </div>
      </div>
      <button id="save-lookup-btn" class="w-full rounded-xl py-2.5 text-sm font-display font-bold bg-green text-white opacity-40" disabled>שמירת מוצר למאגר</button>
    </div>

    <div class="item-src-panel-manual hidden">
      <p class="text-xs mb-2 text-muted">הוספת מוצר ידנית — ערכים ל-100 גרם.</p>
      <input id="manual-item-name" type="text" placeholder="שם המוצר" class="w-full rounded-xl px-3 py-2.5 text-sm mb-2 border border-border" />
      <div class="grid grid-cols-2 gap-2 mb-3">
        <input id="manual-item-cal" type="number" placeholder="קלוריות ל-100 גר׳" class="rounded-xl px-3 py-2.5 text-sm border border-border" />
        <input id="manual-item-protein" type="number" placeholder="חלבון (גר׳)" class="rounded-xl px-3 py-2.5 text-sm border border-border" />
        <input id="manual-item-carbs" type="number" placeholder="פחמימות (גר׳)" class="rounded-xl px-3 py-2.5 text-sm border border-border" />
        <input id="manual-item-fat" type="number" placeholder="שומן (גר׳)" class="rounded-xl px-3 py-2.5 text-sm border border-border" />
      </div>
      <button id="save-manual-item-btn" class="w-full rounded-xl py-2.5 text-sm font-display font-bold bg-green text-white">שמירת מוצר למאגר</button>
    </div>
  </div>`;
}

function labeledInputHTML(id, label) {
  return `<div>
    <label class="block mb-1 text-mutedLight" style="font-size:10px">${label}</label>
    <input id="${id}" type="number" class="w-full rounded-lg px-2 py-1.5 text-sm border border-border" />
  </div>`;
}

// -------------------------------------------------------------- tab logic --
function setActiveTab(tab) {
  state.mode = tab;
  $all(".tab-btn").forEach((b) => {
    const active = b.dataset.tab === tab;
    b.classList.toggle("bg-ink", active);
    b.classList.toggle("text-white", active);
    b.classList.toggle("text-muted", !active);
  });
  $all(".tab-panel").forEach((p) => p.classList.toggle("hidden", p.id !== `panel-${tab}`));
}
function setMealSource(src) {
  state.mealSource = src;
  $all(".src-btn").forEach((b) => {
    const active = b.dataset.src === src;
    b.classList.toggle("bg-green", active);
    b.classList.toggle("text-white", active);
    b.classList.toggle("border-green", active);
    b.classList.toggle("text-muted", !active);
    b.classList.toggle("border-border", !active);
  });
  $(".src-panel-list").classList.toggle("hidden", src !== "list");
  $(".src-panel-search").classList.toggle("hidden", src !== "search");
  $(".src-panel-manual").classList.toggle("hidden", src !== "manual");
}
function setItemSource(src) {
  state.itemSource = src;
  $all(".item-src-btn").forEach((b) => {
    const active = b.dataset.itemSrc === src;
    b.classList.toggle("bg-green", active);
    b.classList.toggle("text-white", active);
    b.classList.toggle("border-green", active);
    b.classList.toggle("text-muted", !active);
    b.classList.toggle("border-border", !active);
  });
  $(".item-src-panel-search").classList.toggle("hidden", src !== "search");
  $(".item-src-panel-manual").classList.toggle("hidden", src !== "manual");
}

// ------------------------------------------------------------------ foods --
// A text input + filtered dropdown list, used instead of a native <select>
// so ingredients can be found either by scrolling or by typing to search.
function createFoodPicker(inputEl, dropdownEl, onSelect) {
  let selected = "";

  function renderList(filterText) {
    const names = Object.keys(allFoods()).sort((a, b) => a.localeCompare(b, "he"));
    const filtered = filterText ? names.filter((n) => n.includes(filterText)) : names;
    dropdownEl.innerHTML =
      filtered.length === 0
        ? `<div class="px-3 py-2 text-xs text-mutedLight">אין תוצאות</div>`
        : filtered
            .map(
              (n) =>
                `<button type="button" data-name="${escapeHtml(n)}" class="food-option w-full text-right px-3 py-2 text-sm text-ink block">${escapeHtml(n)}</button>`
            )
            .join("");
    dropdownEl.classList.remove("hidden");
    $all(".food-option", dropdownEl).forEach((btn) =>
      btn.addEventListener("mousedown", (ev) => {
        ev.preventDefault(); // keep focus so blur doesn't hide the list before click registers
        selected = btn.dataset.name;
        inputEl.value = selected;
        dropdownEl.classList.add("hidden");
        if (onSelect) onSelect(selected);
      })
    );
  }

  inputEl.addEventListener("focus", () => renderList(inputEl.value.trim()));
  inputEl.addEventListener("input", () => {
    selected = "";
    renderList(inputEl.value.trim());
    if (onSelect) onSelect("");
  });
  inputEl.addEventListener("blur", () => setTimeout(() => dropdownEl.classList.add("hidden"), 150));

  return {
    getValue: () => selected,
    setValue: (name) => {
      selected = name;
      inputEl.value = name;
      if (onSelect) onSelect(name);
    },
    reset: () => {
      selected = "";
      inputEl.value = "";
      if (onSelect) onSelect("");
    },
  };
}

// Grams-per-teaspoon lookup for foods that support that unit (e.g. oils, tahini).
function tspGramsFor(name) {
  const food = allFoods()[name];
  return food && food.tspGrams ? food.tspGrams : null;
}

// How to display a stored amount: teaspoons if that's how it was entered, else grams.
function formatAmount(it) {
  return it.unit === "tsp" ? `${it.amount} ${it.amount == 1 ? "כפית" : "כפיות"}` : `${it.grams} גר׳`;
}

function updateSingleUnitToggle(name) {
  const supportsTsp = !!tspGramsFor(name);
  state.singleUnit = "g";
  $("#single-unit-toggle").classList.toggle("hidden", !supportsTsp);
  setSingleUnit("g");
}
function setSingleUnit(unit) {
  state.singleUnit = unit;
  $all(".single-unit-btn").forEach((b) => {
    const active = b.dataset.unit === unit;
    b.classList.toggle("bg-green", active);
    b.classList.toggle("text-white", active);
    b.classList.toggle("border-green", active);
    b.classList.toggle("text-muted", !active);
    b.classList.toggle("border-border", !active);
  });
  $("#single-grams").placeholder = unit === "tsp" ? "מספר כפיות" : "גרם";
}

function updateMealUnitToggle(name) {
  const supportsTsp = !!tspGramsFor(name);
  state.mealUnit = "g";
  $("#meal-unit-toggle").classList.toggle("hidden", !supportsTsp);
  setMealUnit("g");
}
function setMealUnit(unit) {
  state.mealUnit = unit;
  $all(".meal-unit-btn").forEach((b) => {
    const active = b.dataset.unit === unit;
    b.classList.toggle("bg-green", active);
    b.classList.toggle("text-white", active);
    b.classList.toggle("border-green", active);
    b.classList.toggle("text-muted", !active);
    b.classList.toggle("border-border", !active);
  });
  $("#meal-grams").placeholder = unit === "tsp" ? "מספר כפיות" : "גרם";
}

let mealFoodPicker, singleFoodPicker;
function initFoodPickers() {
  mealFoodPicker = createFoodPicker($("#meal-food-input"), $("#meal-food-dropdown"), updateMealUnitToggle);
  singleFoodPicker = createFoodPicker($("#single-food-input"), $("#single-food-dropdown"), updateSingleUnitToggle);
}


// --------------------------------------------------------------- summary --
function updateGoal() {
  $("#sum-goal").textContent = state.goal.toLocaleString("he-IL");
  $("#goal-display").innerHTML = `
    <button id="goal-edit-btn" class="flex items-center gap-1.5 text-sm font-display font-bold text-ink">
      ${state.goal.toLocaleString("he-IL")} קל׳ <span class="text-mutedLight" style="font-size:12px">✎</span>
    </button>`;
  $("#goal-edit-btn").addEventListener("click", () => {
    $("#goal-display").innerHTML = `
      <div class="flex items-center gap-2">
        <input id="goal-input" type="number" value="${state.goal}" class="w-20 text-left rounded-lg px-2 py-1 text-sm font-mono-he border border-border" />
        <button id="goal-save-btn" class="text-green">✓</button>
      </div>`;
    const input = $("#goal-input");
    input.focus();
    const save = async () => {
      const v = parseFloat(input.value);
      if (v && v > 0) {
        const today = todayISO();
        try {
          await setGoalDoc(today, v);
          state.goalsHistory[today] = v;
          state.goal = v;
        } catch (err) {
          console.error("שגיאה בשמירת היעד:", err);
          alert("שמירת היעד נכשלה: " + (err && err.message ? err.message : "שגיאה לא ידועה"));
        }
      }
      updateGoal();
      updateSummary();
    };
    $("#goal-save-btn").addEventListener("click", save);
    input.addEventListener("keydown", (e) => e.key === "Enter" && save());
  });
}
function updateSummary() {
  const t = sumItems(state.entries);
  $("#sum-cal").textContent = Math.round(t.cal);
  $("#sum-protein").textContent = round1(t.protein);
  $("#sum-carbs").textContent = round1(t.carbs);
  $("#sum-fat").textContent = round1(t.fat);
  const pct = Math.min(100, Math.round((t.cal / state.goal) * 100) || 0);
  const bar = $("#progress-bar");
  bar.style.width = pct + "%";
  bar.classList.toggle("bg-red", pct >= 100);
  bar.classList.toggle("bg-green", pct < 100);
}

// --------------------------------------------------------------- entries --
function renderEntries() {
  const list = $("#entries-list");
  if (state.entries.length === 0) {
    list.innerHTML = `<p class="text-sm text-center py-4 text-mutedLight">עוד לא נוסף כלום היום</p>`;
    return;
  }
  list.innerHTML = state.entries.map((e) => (e.isMeal ? mealEntryHTML(e) : singleEntryHTML(e))).join("");

  $all("[data-toggle-meal]", list).forEach((btn) =>
    btn.addEventListener("click", () => {
      const id = btn.dataset.toggleMeal;
      state.expandedMeals.has(id) ? state.expandedMeals.delete(id) : state.expandedMeals.add(id);
      renderEntries();
    })
  );
  $all("[data-delete]", list).forEach((btn) =>
    btn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      if (!window.confirm("האם את בטוחה שברצונך למחוק את הפריט?")) return;
      await deleteEntryDoc(btn.dataset.delete);
      state.entries = await fetchEntries(todayISO());
      updateSummary();
      renderEntries();
    })
  );
}
function singleEntryHTML(e) {
  return `
  <li class="flex items-center justify-between bg-row rounded-xl px-3 py-2.5">
    <div>
      <p class="text-sm font-medium text-ink">${escapeHtml(e.name)}</p>
      <p class="text-xs text-mutedLight">${formatAmount(e)} · חלבון ${round1(e.protein)} · פחמ׳ ${round1(e.carbs)} · שומן ${round1(e.fat)}</p>
    </div>
    <div class="flex items-center gap-3">
      <span class="font-mono-he font-bold text-sm text-ink">🔥 ${Math.round(e.cal)}</span>
      <button data-delete="${e.id}" class="text-red">🗑</button>
    </div>
  </li>`;
}
function mealEntryHTML(e) {
  const open = state.expandedMeals.has(e.id);
  const itemsHTML = (e.items || [])
    .map(
      (it) => `<li class="flex items-center justify-between text-xs">
        <span class="text-inkSoft">${escapeHtml(it.name)} <span class="text-mutedLight">· ${formatAmount(it)}</span></span>
        <span class="font-mono-he text-muted">${Math.round(it.cal)} קל׳</span>
      </li>`
    )
    .join("");
  return `
  <li class="bg-row rounded-xl overflow-hidden">
    <button data-toggle-meal="${e.id}" class="w-full flex items-center justify-between px-3 py-2.5">
      <div class="flex items-center gap-1.5">
        <span class="text-mutedLight">${open ? "▲" : "▼"}</span>
        <div class="text-right">
          <p class="text-sm font-bold text-ink">${escapeHtml(e.name)}</p>
          <p class="text-xs text-mutedLight">${(e.items || []).length} מוצרים</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <span class="font-mono-he font-bold text-sm text-ink">🔥 ${Math.round(e.cal)}</span>
        <span data-delete="${e.id}" class="text-red">🗑</span>
      </div>
    </button>
    ${
      open
        ? `<div class="px-3 pb-3 pt-1">
            <ul class="space-y-1.5 mb-2 pt-2 border-t border-borderLight">${itemsHTML}</ul>
            <p class="text-xs pt-2 border-t border-borderLight text-muted">חלבון ${round1(e.protein)} · פחמ׳ ${round1(e.carbs)} · שומן ${round1(e.fat)}</p>
          </div>`
        : ""
    }
  </li>`;
}

// ---------------------------------------------------------- meal builder --
function renderMealItemsBox() {
  const box = $("#meal-items-box");
  if (state.mealItems.length === 0) {
    box.classList.add("hidden");
    $("#save-meal-btn").setAttribute("disabled", "true");
    $("#save-meal-btn").classList.add("opacity-40");
    return;
  }
  box.classList.remove("hidden");
  $("#save-meal-btn").removeAttribute("disabled");
  $("#save-meal-btn").classList.remove("opacity-40");
  $("#meal-items-list").innerHTML = state.mealItems
    .map(
      (it, i) => `<li class="flex items-center justify-between text-sm">
        <span class="text-ink">${escapeHtml(it.name)} <span class="text-mutedLight">· ${formatAmount(it)}</span></span>
        <div class="flex items-center gap-2">
          <span class="font-mono-he text-xs text-muted">${Math.round(it.cal)} קל׳</span>
          <button data-remove-ingredient="${i}" class="text-red">✕</button>
        </div>
      </li>`
    )
    .join("");
  $all("[data-remove-ingredient]").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.mealItems.splice(Number(btn.dataset.removeIngredient), 1);
      renderMealItemsBox();
    })
  );
  const t = sumItems(state.mealItems);
  $("#meal-items-total").textContent = `${Math.round(t.cal)} קל׳ · ח ${round1(t.protein)} · פ ${round1(t.carbs)} · ש ${round1(t.fat)}`;
}

async function handleMealSearch() {
  const name = $("#meal-search-name").value.trim();
  if (!name) return;
  $("#meal-search-error").classList.add("hidden");
  $("#meal-search-result").classList.add("hidden");
  try {
    const r = await searchNutrition(name);
    $("#meal-search-cal").value = r.cal;
    $("#meal-search-protein").value = r.protein;
    $("#meal-search-carbs").value = r.carbs;
    $("#meal-search-fat").value = r.fat;
    $("#meal-search-result").classList.remove("hidden");
  } catch (err) {
    $("#meal-search-error").textContent = err.message;
    $("#meal-search-error").classList.remove("hidden");
  }
}

async function handleAddIngredientToMeal() {
  const amount = parseFloat($("#meal-grams").value);
  if (!amount || amount <= 0) return;

  if (state.mealSource === "list") {
    const name = mealFoodPicker.getValue();
    const food = foodByName(name);
    if (!food) return;
    const tsp = state.mealUnit === "tsp" ? tspGramsFor(name) : null;
    const grams = tsp ? amount * tsp : amount;
    const item = { name, grams, ...scaleFood(food, grams) };
    if (tsp) {
      item.unit = "tsp";
      item.amount = amount;
    }
    state.mealItems.push(item);
    mealFoodPicker.reset();
  } else if (state.mealSource === "search") {
    const name = $("#meal-search-name").value.trim();
    const cal = parseFloat($("#meal-search-cal").value) || 0;
    if (!name || !cal) return;
    const per100 = {
      cal,
      protein: parseFloat($("#meal-search-protein").value) || 0,
      carbs: parseFloat($("#meal-search-carbs").value) || 0,
      fat: parseFloat($("#meal-search-fat").value) || 0,
    };
    state.mealItems.push({ name, grams: amount, ...scaleFood(per100, amount) });
    state.customFoods[name] = per100;
    saveFood(name, per100);
    $("#meal-search-name").value = "";
    $("#meal-search-result").classList.add("hidden");
  } else if (state.mealSource === "manual") {
    const name = $("#meal-manual-name").value.trim();
    const cal = parseFloat($("#meal-manual-cal").value) || 0;
    if (!name || !cal) return;
    const per100 = {
      cal,
      protein: parseFloat($("#meal-manual-protein").value) || 0,
      carbs: parseFloat($("#meal-manual-carbs").value) || 0,
      fat: parseFloat($("#meal-manual-fat").value) || 0,
    };
    state.mealItems.push({ name, grams: amount, ...scaleFood(per100, amount) });
    state.customFoods[name] = per100;
    saveFood(name, per100);
    ["meal-manual-name", "meal-manual-cal", "meal-manual-protein", "meal-manual-carbs", "meal-manual-fat"].forEach(
      (id) => ($(`#${id}`).value = "")
    );
  }
  $("#meal-grams").value = "";
  renderMealItemsBox();
}

async function handleSaveMeal() {
  if (state.mealItems.length === 0) return;
  const name = $("#meal-name").value.trim() || "ארוחה";
  await addEntryDoc({ date: todayISO(), name, isMeal: true, items: state.mealItems, ...sumItems(state.mealItems) });
  state.mealItems = [];
  $("#meal-name").value = "";
  renderMealItemsBox();
  state.entries = await fetchEntries(todayISO());
  updateSummary();
  renderEntries();
}

// ---------------------------------------------------------------- single --
async function handleAddSingle() {
  const amount = parseFloat($("#single-grams").value);
  if (!amount || amount <= 0) return;
  let payload;
  if ($("#single-food-picker-wrap").classList.contains("hidden")) {
    const name = $("#single-food-name").value.trim();
    if (!name) return;
    payload = {
      date: todayISO(),
      name,
      grams: amount,
      cal: parseFloat($("#single-cal").value) || 0,
      protein: parseFloat($("#single-protein").value) || 0,
      carbs: parseFloat($("#single-carbs").value) || 0,
      fat: parseFloat($("#single-fat").value) || 0,
    };
  } else {
    const name = singleFoodPicker.getValue();
    const food = foodByName(name);
    if (!food) return;
    const tsp = state.singleUnit === "tsp" ? tspGramsFor(name) : null;
    const grams = tsp ? amount * tsp : amount;
    payload = { date: todayISO(), name, grams, ...scaleFood(food, grams) };
    if (tsp) {
      payload.unit = "tsp";
      payload.amount = amount;
    }
  }
  await addEntryDoc(payload);
  $("#single-grams").value = "";
  $("#single-food-name").value = "";
  singleFoodPicker.reset();
  ["single-cal", "single-protein", "single-carbs", "single-fat"].forEach((id) => ($(`#${id}`).value = ""));
  state.entries = await fetchEntries(todayISO());
  updateSummary();
  renderEntries();
}

// -------------------------------------------------------------- new item --
async function handleLookup() {
  const name = $("#lookup-name").value.trim();
  if (!name) return;
  $("#lookup-error").classList.add("hidden");
  $("#lookup-result").classList.add("hidden");
  try {
    const r = await searchNutrition(name);
    $("#lookup-cal").value = r.cal;
    $("#lookup-protein").value = r.protein;
    $("#lookup-carbs").value = r.carbs;
    $("#lookup-fat").value = r.fat;
    $("#lookup-result").classList.remove("hidden");
    $("#save-lookup-btn").removeAttribute("disabled");
    $("#save-lookup-btn").classList.remove("opacity-40");
  } catch (err) {
    $("#lookup-error").textContent = err.message;
    $("#lookup-error").classList.remove("hidden");
  }
}
async function handleSaveLookupProduct() {
  const name = $("#lookup-name").value.trim();
  if (!name) return;
  const per100 = {
    cal: parseFloat($("#lookup-cal").value) || 0,
    protein: parseFloat($("#lookup-protein").value) || 0,
    carbs: parseFloat($("#lookup-carbs").value) || 0,
    fat: parseFloat($("#lookup-fat").value) || 0,
  };
  state.customFoods[name] = per100;
  await saveFood(name, per100);
  setActiveTab("single");
  singleFoodPicker.setValue(name);
  $("#lookup-name").value = "";
  $("#lookup-result").classList.add("hidden");
  $("#save-lookup-btn").setAttribute("disabled", "true");
}
async function handleSaveManualProduct() {
  const name = $("#manual-item-name").value.trim();
  const cal = parseFloat($("#manual-item-cal").value) || 0;
  if (!name || !cal) return;
  const per100 = {
    cal,
    protein: parseFloat($("#manual-item-protein").value) || 0,
    carbs: parseFloat($("#manual-item-carbs").value) || 0,
    fat: parseFloat($("#manual-item-fat").value) || 0,
  };
  state.customFoods[name] = per100;
  await saveFood(name, per100);
  setActiveTab("single");
  singleFoodPicker.setValue(name);
  ["manual-item-name", "manual-item-cal", "manual-item-protein", "manual-item-carbs", "manual-item-fat"].forEach(
    (id) => ($(`#${id}`).value = "")
  );
}

// --------------------------------------------------------------- history --
async function openDrawer() {
  $("#drawer-backdrop").classList.add("open");
  $("#drawer").classList.add("open");
  $("#drawer-content").innerHTML = `<div class="flex items-center justify-center py-16"><div class="spin" style="width:22px;height:22px;border:3px solid #D8D2C4;border-top-color:#4C6B4F;border-radius:50%"></div></div>`;

  const HISTORY_LENGTH = 7; // how many past days to look back over
  const dateList = [];
  for (let i = HISTORY_LENGTH; i >= 1; i--) {
    // i starts at HISTORY_LENGTH and stops at 1 — today (i=0) is intentionally excluded,
    // since "history" here means days that are already over.
    const d = new Date();
    d.setDate(d.getDate() - i);
    dateList.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  const byDate = await fetchEntriesForDates(dateList);
  const days = dateList
    .map((dateStr) => {
      const dayEntries = byDate[dateStr] || [];
      const items = dayEntries.flatMap((e) => (e.isMeal ? e.items || [] : [e]));
      const totals = sumItems(items);
      const d = new Date(dateStr);
      return {
        date: dateStr,
        goal: effectiveGoalFor(state.goalsHistory, dateStr),
        items,
        ...totals,
        label: d.toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "numeric" }),
      };
    })
    .filter((d) => d.items.length > 0); // only days that actually had something logged

  renderDrawer(days);
}
function closeDrawer() {
  $("#drawer-backdrop").classList.remove("open");
  $("#drawer").classList.remove("open");
}

function renderDrawer(days) {
  if (days.length === 0) {
    $("#drawer-content").innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <span class="text-green">📅</span>
          <h2 class="font-display font-black text-lg text-ink">היסטוריית אירועים</h2>
        </div>
        <button id="drawer-close" class="w-8 h-8 rounded-full bg-card flex items-center justify-center">✕</button>
      </div>
      <div class="bg-card rounded-2xl p-6 text-center shadow-sm">
        <p class="text-sm text-mutedLight">אין אירועים קודמים</p>
      </div>
    `;
    $("#drawer-close").addEventListener("click", closeDrawer);
    return;
  }

  const chartMax = Math.max(state.goal, ...days.map((d) => Math.max(d.cal, d.goal))) * 1.05;

  const bars = days
    .map(
      (d) => `<div class="flex-1 flex flex-col items-center gap-1 h-full justify-end">
        <div class="w-full rounded-t-md" style="height:${Math.max(4, (d.cal / chartMax) * 100)}%;background-color:${
        d.cal > d.goal ? "#E3A73A" : "#4C6B4F"
      }"></div>
      </div>`
    )
    .join("");
  const labels = days
    .map(
      (d) =>
        `<div class="flex-1 text-center"><span style="font-size:10px;font-weight:500;color:#8A8272">${d.label.split(",")[0]}</span></div>`
    )
    .join("");
  const cards = [...days].reverse().map((d) => dayCardHTML(d)).join("");

  $("#drawer-content").innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <span class="text-green">📅</span>
        <h2 class="font-display font-black text-lg text-ink">היסטוריית אירועים</h2>
      </div>
      <button id="drawer-close" class="w-8 h-8 rounded-full bg-card flex items-center justify-center">✕</button>
    </div>

    <div class="bg-card rounded-2xl p-4 mb-4 shadow-sm">
      <p class="text-xs font-bold mb-3 text-muted">קלוריות בימים קודמים</p>
      <div class="relative h-28 flex items-end gap-1.5">
        <div class="absolute right-0 left-0" style="bottom:${(state.goal / chartMax) * 100}%;border-top:1.5px dashed #8A8272"></div>
        ${bars}
      </div>
      <div class="flex gap-1.5 mt-1.5">${labels}</div>
      <p class="mt-2" style="font-size:10px;color:#8A8272">הקו המקווקו מסמן את היעד הנוכחי (${state.goal.toLocaleString("he-IL")} קל׳). כל יום מוצג מול היעד שהיה תקף בו.</p>
    </div>

    <p class="text-xs font-bold mb-2 px-1 text-muted">פירוט לפי יום — הקישי על יום לראות מה נאכל בו</p>
    <div class="space-y-2 pb-4">${cards}</div>
  `;

  $("#drawer-close").addEventListener("click", closeDrawer);
  $all("[data-day-toggle]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const key = btn.dataset.dayToggle;
      state.expandedHistoryDays.has(key) ? state.expandedHistoryDays.delete(key) : state.expandedHistoryDays.add(key);
      renderDrawer(days);
    })
  );
}

function dayCardHTML(d) {
  const diff = Math.round(d.cal - d.goal);
  const over = diff > 0;
  const pct = Math.min(100, Math.round((d.cal / d.goal) * 100) || 0);
  const expanded = state.expandedHistoryDays.has(d.date);
  const label = d.label;

  const itemsHTML =
    d.items.length === 0
      ? `<p style="font-size:12px;color:#8A8272" class="py-2">עוד לא נאכל כלום ביום הזה.</p>`
      : `<ul class="space-y-1.5 mt-2">${d.items
          .map(
            (it) => `<li class="flex items-center justify-between text-xs">
              <span class="text-inkSoft">${escapeHtml(it.name)} <span class="text-mutedLight">· ${formatAmount(it)}</span></span>
              <span class="font-mono-he text-muted">${Math.round(it.cal)} קל׳</span>
            </li>`
          )
          .join("")}</ul>`;

  return `
  <div class="bg-card rounded-2xl overflow-hidden shadow-sm">
    <button data-day-toggle="${d.date}" class="w-full text-right px-4 py-3">
      <div class="flex items-center justify-between mb-1.5">
        <div class="flex items-center gap-1.5">
          <span class="text-mutedLight" style="font-size:13px">${expanded ? "▲" : "▼"}</span>
          <span class="text-sm font-display font-bold text-ink">${label}</span>
        </div>
        <span class="font-mono-he font-black text-base text-ink">${Math.round(d.cal)} <span class="font-medium text-mutedLight" style="font-size:12px">קל׳</span></span>
      </div>
      <div class="h-1.5 w-full rounded-full overflow-hidden mb-2 bg-track">
        <div class="h-full rounded-full" style="width:${pct}%;background-color:${over ? "#E3A73A" : "#4C6B4F"}"></div>
      </div>
      <div class="flex items-center justify-between">
        <span style="font-size:11px;color:#6B6255">ח ${round1(d.protein)} · פ ${round1(d.carbs)} · ש ${round1(d.fat)}</span>
        <span style="font-size:11px;font-weight:500;color:${over ? "#E3A73A" : "#4C6B4F"}">${
    over ? `${diff} מעל היעד` : `${Math.abs(diff)} מתחת ליעד`
  } (${d.goal.toLocaleString("he-IL")})</span>
      </div>
    </button>
    ${expanded ? `<div class="px-4 pb-3 pt-1" style="border-top:1px solid #E4DFCF">${itemsHTML}</div>` : ""}
  </div>`;
}

// ---------------------------------------------------------------- events --
function bindStaticEvents() {
  $("#menu-btn").addEventListener("click", (ev) => {
    ev.stopPropagation();
    $("#menu-dropdown").classList.toggle("hidden");
  });
  document.addEventListener("click", () => $("#menu-dropdown").classList.add("hidden"));
  $("#menu-history-btn").addEventListener("click", (ev) => {
    ev.stopPropagation();
    $("#menu-dropdown").classList.add("hidden");
    openDrawer();
  });
  $("#drawer-backdrop").addEventListener("click", closeDrawer);

  $all(".tab-btn").forEach((b) => b.addEventListener("click", () => setActiveTab(b.dataset.tab)));
  $all(".src-btn").forEach((b) => b.addEventListener("click", () => setMealSource(b.dataset.src)));
  $all(".item-src-btn").forEach((b) => b.addEventListener("click", () => setItemSource(b.dataset.itemSrc)));
  $all(".single-unit-btn").forEach((b) => b.addEventListener("click", () => setSingleUnit(b.dataset.unit)));
  $all(".meal-unit-btn").forEach((b) => b.addEventListener("click", () => setMealUnit(b.dataset.unit)));
  setMealSource("list");
  setItemSource("search");

  $("#meal-search-btn").addEventListener("click", handleMealSearch);
  $("#meal-add-ingredient").addEventListener("click", handleAddIngredientToMeal);
  $("#save-meal-btn").addEventListener("click", handleSaveMeal);

  $("#single-custom-toggle").addEventListener("click", () => {
    const nowCustom = $("#single-food-name").classList.contains("hidden");
    $("#single-food-picker-wrap").classList.toggle("hidden", nowCustom);
    $("#single-food-name").classList.toggle("hidden", !nowCustom);
    $all(".single-custom").forEach((el) => el.classList.toggle("hidden", !nowCustom));
    $("#single-custom-toggle").textContent = nowCustom ? "בחירה מהרשימה" : "ערכים חד-פעמיים";
  });
  $("#add-single-btn").addEventListener("click", handleAddSingle);

  $("#lookup-btn").addEventListener("click", handleLookup);
  $("#save-lookup-btn").addEventListener("click", handleSaveLookupProduct);
  $("#save-manual-item-btn").addEventListener("click", handleSaveManualProduct);
}

init();