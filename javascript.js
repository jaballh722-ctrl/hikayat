const STORAGE_KEY = "hikayat_state_v1";
const FALLBACK_COVER = "";
const SHOWCASE_AUTHOR_IDS = new Set(["author_sara", "author_ahmed", "author_karim", "author_laila", "author_hind", "author_shady"]);
const SHOWCASE_NOVEL_IDS = new Set(["novel_moon", "novel_sword", "novel_alley", "novel_city", "novel_neon", "novel_house", "novel_damascus"]);

const initialState = {
  users: [],
  sessionUserId: null,
  novels: [],
  follows: [],
  authorFollows: [],
  comments: [],
  reports: [],
  likes: [],
  novelLikes: [],
  notifications: [],
  reading: {},
  theme: "dark"
};

let state = loadState();
let authMode = "login";
let activeMyWritingFilter = "all";
let activeLibraryFilter = "all";
let currentRoute = location.hash.replace("#", "") || "home";
let readerFont = Number(localStorage.getItem("hikayat_reader_font") || 22);
let readerLine = Number(localStorage.getItem("hikayat_reader_line") || 2.1);

const app = document.getElementById("app");
const toast = document.getElementById("toast");
const authModal = document.getElementById("authModal");
const authForm = document.getElementById("authForm");
const authTitle = document.getElementById("authTitle");
const authSubmit = document.getElementById("authSubmit");
const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const authButton = document.getElementById("authButton");
const userMenu = document.getElementById("userMenu");
const userDropdown = document.getElementById("userDropdown");
const avatarInitial = document.getElementById("avatarInitial");
const notifyBadge = document.getElementById("notifyBadge");

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!parsed) return structuredClone(initialState);
    const users = (parsed?.users || []).filter(user => !SHOWCASE_AUTHOR_IDS.has(user.id));
    const novels = (parsed?.novels || []).filter(novel => !SHOWCASE_NOVEL_IDS.has(novel.id));
    return { ...initialState, ...parsed, users, novels, theme: parsed?.theme || initialState.theme };
  } catch {
    return structuredClone(initialState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  updateHeader();
}

function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function currentUser() {
  return state.users.find(user => user.id === state.sessionUserId) || null;
}

function authorName(id) {
  return state.users.find(user => user.id === id)?.name || "كاتب غير معروف";
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}

function formatDate(date) {
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
}

function publishedChapters(novel) {
  return novel.chapters.filter(chapter => chapter.published);
}

function isComplete(novel) {
  return novel.status === "completed";
}

function hasNewChapter(novel) {
  const key = `${novel.id}_lastSeen`;
  const seenAt = state.reading[key] || 0;
  return publishedChapters(novel).some(chapter => new Date(chapter.createdAt).getTime() > seenAt);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3200);
}

function requireAuth(action = "هذا التفاعل") {
  if (currentUser()) return true;
  showAuthModal("login");
  showToast(`${action} يحتاج إلى تسجيل دخول أولاً.`);
  return false;
}

async function hashPassword(password) {
  if (!globalThis.crypto?.subtle) return btoa(unescape(encodeURIComponent(password))).split("").reverse().join("");
  const encoded = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function routeTo(route) {
  location.hash = route;
}

function setPage(html) {
  app.innerHTML = html;
  app.focus();
  bindPageEvents();
}

function render() {
  currentRoute = location.hash.replace("#", "") || "home";
  updateHeader();
  document.querySelectorAll("[data-route]").forEach(link => link.classList.toggle("active", link.dataset.route === currentRoute));

  if (currentRoute.startsWith("novel/")) return renderNovel(currentRoute.split("/")[1]);
  if (currentRoute.startsWith("read/")) return renderReader(currentRoute.split("/")[1], currentRoute.split("/")[2]);
  if (currentRoute === "write") return renderWrite();
  if (currentRoute === "my-writing") return renderMyWriting();
  if (currentRoute === "library") return renderLibrary();
  if (currentRoute === "profile") return renderProfile();
  if (currentRoute.startsWith("search")) return renderSearch(new URLSearchParams(currentRoute.split("?")[1]).get("q") || "");
  if (currentRoute === "privacy") return renderInfo("سياسة الخصوصية", "نحافظ على بياناتك داخل هذا النموذج المحلي، ولا تتم مشاركة أي بيانات مع طرف خارجي.");
  if (currentRoute === "terms") return renderInfo("شروط الاستخدام", "استخدم المنصة لنشر أعمالك الأصلية فقط، وتجنب الإساءة أو انتهاك حقوق الآخرين.");
  renderHome();
}

function renderHome() {
  const novels = state.novels.filter(novel => publishedChapters(novel).length > 0);
  const latest = [...novels].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  setPage(`
    <section class="hero">
      <div>
        <span class="pill">روايات من إنشاء المستخدمين فقط</span>
        <h1>اكتب روايتك، وانشر فصولك، وابنِ جمهورك.</h1>
        <p>حكايات تعمل بدون أي روايات تجريبية. الصفحة الرئيسية تعرض فقط الروايات التي ينشئها المستخدمون وينشرون لها فصولاً.</p>
        <div class="hero-actions">
          <button class="primary" data-action="write">ابدأ الكتابة الآن</button>
          <button class="secondary" data-route-button="library">افتح مكتبتي</button>
        </div>
      </div>
    </section>

    <div class="section-head">
      <h2>الروايات المنشورة</h2>
      <span class="pill">${latest.length} رواية</span>
    </div>
    ${latest.length ? `<div class="grid">${latest.map(novelCard).join("")}</div>` : emptyState("لا توجد روايات منشورة بعد", "كن أول مستخدم ينشئ رواية وينشر فصلها الأول.", "اكتب", "write")}
  `);
}

function novelCard(novel) {
  const chapters = publishedChapters(novel);
  return `
    <article class="novel-card">
      <button class="cover" data-open-novel="${novel.id}" type="button">${novel.cover ? `<img src="${novel.cover}" alt="غلاف ${escapeHtml(novel.title)}">` : escapeHtml(novel.title.slice(0, 28))}</button>
      <div class="novel-body">
        <h3>${escapeHtml(novel.title)}</h3>
        <div class="meta"><span>بقلم ${escapeHtml(authorName(novel.authorId))}</span><span>${escapeHtml(novel.category)}</span><span>${isComplete(novel) ? "مكتملة" : "غير مكتملة"}</span></div>
        <p class="muted">${escapeHtml(novel.description.slice(0, 120))}${novel.description.length > 120 ? "..." : ""}</p>
        <div class="actions">
          <button class="primary" data-open-novel="${novel.id}" type="button">عرض الرواية</button>
          <button class="secondary" data-follow-novel="${novel.id}" type="button">${isFollowingNovel(novel.id) ? "إزالة من مكتبتي" : "متابعة"}</button>
        </div>
        <span class="pill">${chapters.length} فصل منشور</span>
      </div>
    </article>
  `;
}

function emptyState(title, text, buttonText, action) {
  return `<div class="empty-state"><h3>${title}</h3><p>${text}</p>${buttonText ? `<button class="primary" data-action="${action}" type="button">${buttonText}</button>` : ""}</div>`;
}

function renderMyWriting() {
  if (!requireAuth("عرض مؤلفاتي")) return renderHome();
  const user = currentUser();
  const novels = state.novels.filter(novel => novel.authorId === user.id).filter(novel => {
    if (activeMyWritingFilter === "completed") return isComplete(novel);
    if (activeMyWritingFilter === "published") return publishedChapters(novel).length > 0;
    if (activeMyWritingFilter === "draft") return publishedChapters(novel).length === 0;
    return true;
  });
  setPage(`
    <div class="section-head"><h1>مؤلفاتي</h1><button class="primary" data-action="write" type="button">اكتب فصل جديد</button></div>
    <div class="filters" data-filter-group="my-writing">
      ${filterButton("all", "جميع الروايات", activeMyWritingFilter)}
      ${filterButton("completed", "الروايات المكتملة", activeMyWritingFilter)}
      ${filterButton("published", "التي تم نشرها", activeMyWritingFilter)}
      ${filterButton("draft", "التي لم تنشر", activeMyWritingFilter)}
    </div>
    ${novels.length ? `<div class="grid">${novels.map(novelCard).join("")}</div>` : emptyState("لا توجد روايات في هذا الفلتر", "استخدم زر اكتب لإنشاء رواية أو نشر فصل جديد.", "اكتب", "write")}
  `);
}

function renderLibrary() {
  if (!requireAuth("فتح مكتبتي")) return renderHome();
  const user = currentUser();
  const followedIds = state.follows.filter(item => item.userId === user.id).map(item => item.novelId);
  const novels = state.novels.filter(novel => followedIds.includes(novel.id)).filter(novel => {
    if (activeLibraryFilter === "completed") return isComplete(novel);
    if (activeLibraryFilter === "incomplete") return !isComplete(novel);
    if (activeLibraryFilter === "new") return hasNewChapter(novel);
    return true;
  });
  setPage(`
    <div class="section-head"><h1>مكتبتي</h1><span class="pill">الروايات التي تتابعها</span></div>
    <div class="filters" data-filter-group="library">
      ${filterButton("all", "كل الروايات", activeLibraryFilter)}
      ${filterButton("completed", "للروايات المكتملة", activeLibraryFilter)}
      ${filterButton("incomplete", "الغير مكتملة", activeLibraryFilter)}
      ${filterButton("new", "بها فصول جديدة", activeLibraryFilter)}
    </div>
    ${novels.length ? `<div class="grid">${novels.map(novelCard).join("")}</div>` : emptyState("مكتبتك فارغة", "تابع روايات من الصفحة الرئيسية لتظهر هنا.", "تصفح الروايات", "home")}
  `);
}

function filterButton(value, label, active) {
  return `<button class="${active === value ? "active" : ""}" data-filter="${value}" type="button">${label}</button>`;
}

function renderWrite() {
  if (!requireAuth("كتابة الروايات")) return renderHome();
  const myNovels = state.novels.filter(novel => novel.authorId === currentUser().id);
  setPage(`
    <div class="section-head"><h1>اكتب</h1><span class="pill">إنشاء فصل جديد</span></div>
    <div class="panel">
      <div class="tabs">
        <button class="active" data-write-mode="new" type="button">إنشاء رواية جديدة</button>
        <button data-write-mode="existing" type="button">إضافة فصل لرواية موجودة</button>
      </div>
      <form id="writeForm" class="form-stack">
        <input type="hidden" id="writeMode" value="new">
        <div id="newNovelFields" class="two-col">
          <label>اسم الرواية<input id="novelTitle" type="text" placeholder="اسم الرواية" required></label>
          <label>التصنيف<select id="novelCategory" required><option value="">اختر التصنيف</option><option>أكشن</option><option>رومانسي</option><option>غموض</option><option>رعب</option><option>خيال</option><option>دراما</option></select></label>
          <label>حالة الرواية<select id="novelStatus"><option value="ongoing">غير مكتملة</option><option value="completed">مكتملة</option></select></label>
          <label>صورة الغلاف اختيارية<input id="novelCover" type="file" accept="image/png,image/jpeg,image/webp"></label>
          <label class="span-all">وصف الرواية<textarea id="novelDescription" placeholder="اكتب وصفاً مشوقاً للرواية" required></textarea></label>
        </div>
        <div id="existingNovelFields" class="hidden">
          <label>اختر رواية كتبتها<select id="existingNovel">${myNovels.map(novel => `<option value="${novel.id}">${escapeHtml(novel.title)}</option>`).join("")}</select></label>
          ${myNovels.length ? "" : `<p class="muted">لا توجد روايات لديك بعد. أنشئ رواية جديدة أولاً.</p>`}
        </div>
        <div class="two-col">
          <label>اسم الفصل<input id="chapterTitle" type="text" placeholder="الفصل الأول: البداية" required></label>
          <label>مختصر الفصل بشكل مشوق اختياري<input id="chapterSummary" type="text" placeholder="جملة تجذب القارئ"></label>
        </div>
        <label>نص الفصل<textarea id="chapterContent" class="chapter-editor" placeholder="اكتب نص الفصل هنا..." required></textarea></label>
        <div class="actions"><button class="primary" type="submit">نشر</button><button class="secondary" id="saveDraftButton" type="button">حفظ كمسودة</button></div>
      </form>
    </div>
  `);
}

function renderNovel(novelId) {
  const novel = state.novels.find(item => item.id === novelId);
  if (!novel) return setPage(emptyState("الرواية غير موجودة", "ربما تم حذفها بواسطة الكاتب.", "الرئيسية", "home"));
  const chapters = publishedChapters(novel);
  const isAuthor = currentUser()?.id === novel.authorId;
  const comments = state.comments.filter(comment => comment.novelId === novel.id);
  setPage(`
    <section class="novel-detail">
      <div class="novel-card"><div class="cover">${novel.cover ? `<img src="${novel.cover}" alt="غلاف ${escapeHtml(novel.title)}">` : escapeHtml(novel.title)}</div></div>
      <div class="panel">
        <h1>${escapeHtml(novel.title)}</h1>
        <p class="muted">${escapeHtml(novel.description)}</p>
        <div class="meta"><span class="pill">بقلم ${escapeHtml(authorName(novel.authorId))}</span><span class="pill">${escapeHtml(novel.category)}</span><span class="pill">${isComplete(novel) ? "مكتملة" : "غير مكتملة"}</span><span class="pill">${chapters.length} فصل</span></div>
        <div class="actions">
          <button class="primary" data-read-first="${novel.id}" type="button">ابدأ القراءة</button>
          <button class="secondary" data-follow-novel="${novel.id}" type="button">${isFollowingNovel(novel.id) ? "إزالة من مكتبتي" : "أضف إلى مكتبتي"}</button>
          <button class="secondary" data-follow-author="${novel.authorId}" type="button">${isFollowingAuthor(novel.authorId) ? "إلغاء متابعة الكاتب" : "متابعة الكاتب"}</button>
          <button class="secondary" data-like-novel="${novel.id}" type="button">إعجاب (${novelLikeCount(novel.id)})</button>
          <button class="secondary" data-share="${novel.id}" type="button">مشاركة</button>
          <button class="danger" data-report="${novel.id}" type="button">تبليغ</button>
          ${isAuthor ? `<button class="secondary" data-edit-novel="${novel.id}" type="button">إضافة فصل جديد</button><button class="danger" data-delete-novel="${novel.id}" type="button">حذف الرواية</button>` : ""}
        </div>
      </div>
    </section>
    <section class="panel" style="margin-top:22px">
      <h2>فهرس الفصول</h2>
      ${chapters.length ? `<div class="chapter-list">${chapters.map((chapter, index) => `<div class="chapter-row"><div><strong>${index + 1}. ${escapeHtml(chapter.title)}</strong><p class="muted">${escapeHtml(chapter.summary || "بدون مختصر")}</p></div><button class="primary" data-read="${novel.id}/${chapter.id}" type="button">قراءة</button></div>`).join("")}</div>` : `<p class="muted">لا توجد فصول منشورة بعد.</p>`}
    </section>
    <section class="panel" style="margin-top:22px">
      <h2>التعليقات والتقييمات</h2>
      <form id="commentForm" class="form-stack"><textarea id="commentText" placeholder="اكتب تعليقك"></textarea><button class="primary" type="submit">إرسال تعليق</button></form>
      <div>${comments.map(comment => `<div class="comment"><strong>${escapeHtml(authorName(comment.userId))}</strong><p>${escapeHtml(comment.text)}</p><button class="secondary" data-like-comment="${comment.id}" type="button">إعجاب (${comment.likes || 0})</button></div>`).join("") || `<p class="muted">لا توجد تعليقات بعد.</p>`}</div>
    </section>
  `);
}

function renderReader(novelId, chapterId) {
  const novel = state.novels.find(item => item.id === novelId);
  const chapter = novel?.chapters.find(item => item.id === chapterId && item.published);
  if (!novel || !chapter) return setPage(emptyState("الفصل غير موجود", "الفصل غير منشور أو تم حذفه.", "الرئيسية", "home"));
  state.reading[`${novel.id}_lastSeen`] = Date.now();
  state.reading[`${novel.id}_chapter`] = chapter.id;
  saveState();
  const chapters = publishedChapters(novel);
  const index = chapters.findIndex(item => item.id === chapter.id);
  document.documentElement.style.setProperty("--reader-font", `${readerFont}px`);
  document.documentElement.style.setProperty("--reader-line", readerLine);
  setPage(`
    <article class="reader">
      <div class="reader-toolbar">
        <button class="secondary" data-open-novel="${novel.id}" type="button">العودة للرواية</button>
        <button class="secondary" data-reader-font="plus" type="button">تكبير الخط</button>
        <button class="secondary" data-reader-font="minus" type="button">تصغير الخط</button>
        <button class="secondary" data-reader-line="plus" type="button">زيادة التباعد</button>
        <button class="secondary" data-reader-line="minus" type="button">تقليل التباعد</button>
      </div>
      <h1>${escapeHtml(chapter.title)}</h1>
      <p class="muted">${escapeHtml(novel.title)} — ${escapeHtml(chapter.summary || "")}</p>
      <div class="reader-text">${escapeHtml(chapter.content)}</div>
      <div class="actions" style="justify-content:space-between;margin-top:22px">
        <button class="secondary" ${index <= 0 ? "disabled" : ""} data-read="${novel.id}/${chapters[index - 1]?.id}" type="button">الفصل السابق</button>
        <button class="primary" ${index >= chapters.length - 1 ? "disabled" : ""} data-read="${novel.id}/${chapters[index + 1]?.id}" type="button">الفصل التالي</button>
      </div>
    </article>
  `);
}

function renderSearch(query) {
  const q = query.trim().toLowerCase();
  const novels = state.novels.filter(novel => novel.title.toLowerCase().includes(q) || authorName(novel.authorId).toLowerCase().includes(q) || novel.category.toLowerCase().includes(q));
  setPage(`<div class="section-head"><h1>نتائج البحث عن: ${escapeHtml(query)}</h1></div>${novels.length ? `<div class="grid">${novels.map(novelCard).join("")}</div>` : emptyState("لم يتم العثور على نتائج", "جرّب كلمة أخرى أو أنشئ أول رواية في هذا التصنيف.", "اكتب", "write")}`);
}

function renderProfile() {
  if (!requireAuth("فتح الملف الشخصي")) return renderHome();
  const user = currentUser();
  setPage(`<section class="panel"><h1>ملفي الشخصي</h1><p>الاسم: ${escapeHtml(user.name)}</p><p>البريد: ${escapeHtml(user.email)}</p><div class="actions"><button class="primary" data-route-button="my-writing">مؤلفاتي</button><button class="secondary" data-route-button="library">مكتبتي</button></div></section>`);
}

function renderInfo(title, text) {
  setPage(`<section class="panel"><h1>${title}</h1><p>${text}</p></section>`);
}

function bindPageEvents() {
  app.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click", () => routeTo(button.dataset.action === "write" ? "write" : button.dataset.action)));
  app.querySelectorAll("[data-route-button]").forEach(button => button.addEventListener("click", () => routeTo(button.dataset.routeButton)));
  app.querySelectorAll("[data-open-novel]").forEach(button => button.addEventListener("click", () => routeTo(`novel/${button.dataset.openNovel}`)));
  app.querySelectorAll("[data-read]").forEach(button => button.addEventListener("click", () => routeTo(`read/${button.dataset.read}`)));
  app.querySelectorAll("[data-read-first]").forEach(button => button.addEventListener("click", () => readFirst(button.dataset.readFirst)));
  app.querySelectorAll("[data-follow-novel]").forEach(button => button.addEventListener("click", () => toggleNovelFollow(button.dataset.followNovel)));
  app.querySelectorAll("[data-follow-author]").forEach(button => button.addEventListener("click", () => toggleAuthorFollow(button.dataset.followAuthor)));
  app.querySelectorAll("[data-share]").forEach(button => button.addEventListener("click", () => shareNovel(button.dataset.share)));
  app.querySelectorAll("[data-report]").forEach(button => button.addEventListener("click", () => reportNovel(button.dataset.report)));
  app.querySelectorAll("[data-delete-novel]").forEach(button => button.addEventListener("click", () => deleteNovel(button.dataset.deleteNovel)));
  app.querySelectorAll("[data-edit-novel]").forEach(button => button.addEventListener("click", () => routeTo("write")));
  app.querySelectorAll("[data-like-comment]").forEach(button => button.addEventListener("click", () => likeComment(button.dataset.likeComment)));
  app.querySelectorAll("[data-like-novel]").forEach(button => button.addEventListener("click", () => likeNovel(button.dataset.likeNovel)));
  app.querySelectorAll("[data-filter]").forEach(button => button.addEventListener("click", () => setFilter(button)));
  app.querySelectorAll("[data-write-mode]").forEach(button => button.addEventListener("click", () => setWriteMode(button.dataset.writeMode)));
  app.querySelectorAll("[data-reader-font]").forEach(button => button.addEventListener("click", () => setReaderFont(button.dataset.readerFont)));
  app.querySelectorAll("[data-reader-line]").forEach(button => button.addEventListener("click", () => setReaderLine(button.dataset.readerLine)));
  document.getElementById("writeForm")?.addEventListener("submit", publishChapter);
  document.getElementById("saveDraftButton")?.addEventListener("click", saveDraft);
  document.getElementById("commentForm")?.addEventListener("submit", addComment);
}

function updateHeader() {
  document.documentElement.dataset.theme = state.theme;
  const user = currentUser();
  authButton.classList.toggle("hidden", Boolean(user));
  userMenu.classList.toggle("hidden", !user);
  if (user) avatarInitial.textContent = user.name.trim().charAt(0) || "م";
  const unread = state.notifications.filter(item => item.userId === user?.id && !item.read).length;
  notifyBadge.textContent = unread;
  notifyBadge.classList.toggle("hidden", unread === 0);
}

function showAuthModal(mode = "login") {
  authMode = mode;
  authTitle.textContent = mode === "login" ? "تسجيل الدخول" : "إنشاء حساب";
  authSubmit.textContent = mode === "login" ? "دخول" : "إنشاء الحساب";
  loginTab.classList.toggle("active", mode === "login");
  registerTab.classList.toggle("active", mode === "register");
  document.querySelectorAll(".register-only").forEach(field => field.classList.toggle("hidden", mode !== "register"));
  authModal.classList.remove("hidden");
}

async function handleAuth(event) {
  event.preventDefault();
  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;
  const passwordHash = await hashPassword(password);
  if (authMode === "register") {
    const name = document.getElementById("displayName").value.trim();
    if (!name) return showToast("اكتب اسم المستخدم.");
    if (state.users.some(user => user.email === email)) return showToast("هذا البريد مسجل بالفعل.");
    const user = { id: uid("user"), name, email, passwordHash, createdAt: new Date().toISOString() };
    state.users.push(user);
    state.sessionUserId = user.id;
    showToast("تم إنشاء الحساب وتسجيل الدخول بنجاح.");
  } else {
    const user = state.users.find(item => item.email === email && item.passwordHash === passwordHash);
    if (!user) return showToast("بيانات الدخول غير صحيحة أو الحساب غير موجود.");
    state.sessionUserId = user.id;
    showToast("تم تسجيل الدخول بنجاح.");
  }
  saveState();
  authModal.classList.add("hidden");
  authForm.reset();
  render();
}

function setWriteMode(mode) {
  document.getElementById("writeMode").value = mode;
  document.getElementById("newNovelFields").classList.toggle("hidden", mode !== "new");
  document.getElementById("existingNovelFields").classList.toggle("hidden", mode !== "existing");
  app.querySelectorAll("[data-write-mode]").forEach(button => button.classList.toggle("active", button.dataset.writeMode === mode));
  ["novelTitle", "novelCategory", "novelDescription"].forEach(id => document.getElementById(id).required = mode === "new");
}

function fileToDataUrl(file) {
  return new Promise(resolve => {
    if (!file) return resolve(FALLBACK_COVER);
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

async function publishChapter(event) {
  event.preventDefault();
  if (!requireAuth("نشر الفصول")) return;
  const mode = document.getElementById("writeMode").value;
  let novel;
  if (mode === "new") {
    const cover = await fileToDataUrl(document.getElementById("novelCover").files[0]);
    novel = {
      id: uid("novel"),
      authorId: currentUser().id,
      title: document.getElementById("novelTitle").value.trim(),
      description: document.getElementById("novelDescription").value.trim(),
      cover,
      category: document.getElementById("novelCategory").value,
      status: document.getElementById("novelStatus").value,
      chapters: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    state.novels.push(novel);
  } else {
    novel = state.novels.find(item => item.id === document.getElementById("existingNovel").value && item.authorId === currentUser().id);
    if (!novel) return showToast("اختر رواية موجودة كتبتها.");
  }
  const chapter = buildChapter(true);
  novel.chapters.push(chapter);
  novel.updatedAt = chapter.createdAt;
  notifyFollowers(novel, chapter);
  saveState();
  showToast("تم نشر الفصل بنجاح.");
  routeTo(`novel/${novel.id}`);
}

function saveDraft() {
  if (!requireAuth("حفظ المسودات")) return;
  const mode = document.getElementById("writeMode").value;
  if (mode !== "existing") return showToast("المسودة تحتاج رواية موجودة. أنشئ الرواية وانشر أول فصل أو اختر رواية موجودة.");
  const novel = state.novels.find(item => item.id === document.getElementById("existingNovel").value && item.authorId === currentUser().id);
  if (!novel) return showToast("اختر رواية صحيحة.");
  novel.chapters.push(buildChapter(false));
  novel.updatedAt = new Date().toISOString();
  saveState();
  showToast("تم حفظ الفصل كمسودة.");
  routeTo("my-writing");
}

function buildChapter(published) {
  return {
    id: uid("chapter"),
    title: document.getElementById("chapterTitle").value.trim(),
    summary: document.getElementById("chapterSummary").value.trim(),
    content: document.getElementById("chapterContent").value.trim(),
    published,
    createdAt: new Date().toISOString()
  };
}

function notifyFollowers(novel, chapter) {
  state.follows.filter(item => item.novelId === novel.id).forEach(item => state.notifications.push({ id: uid("notify"), userId: item.userId, read: false, text: `فصل جديد: ${chapter.title} في ${novel.title}`, createdAt: new Date().toISOString() }));
  state.authorFollows.filter(item => item.authorId === novel.authorId).forEach(item => state.notifications.push({ id: uid("notify"), userId: item.userId, read: false, text: `الكاتب ${authorName(novel.authorId)} نشر فصلاً جديداً`, createdAt: new Date().toISOString() }));
}

function isFollowingNovel(novelId) {
  return state.follows.some(item => item.userId === currentUser()?.id && item.novelId === novelId);
}

function toggleNovelFollow(novelId) {
  if (!requireAuth("متابعة الروايات")) return;
  const existingIndex = state.follows.findIndex(item => item.userId === currentUser().id && item.novelId === novelId);
  if (existingIndex >= 0) {
    state.follows.splice(existingIndex, 1);
    showToast("تمت إزالة الرواية من مكتبتك.");
  } else {
    state.follows.push({ userId: currentUser().id, novelId, createdAt: new Date().toISOString() });
    showToast("تمت إضافة الرواية إلى مكتبتك.");
  }
  saveState();
  render();
}

function isFollowingAuthor(authorId) {
  return state.authorFollows.some(item => item.userId === currentUser()?.id && item.authorId === authorId);
}

function toggleAuthorFollow(authorId) {
  if (!requireAuth("متابعة الكتاب")) return;
  if (authorId === currentUser().id) return showToast("لا تحتاج إلى متابعة نفسك.");
  const existingIndex = state.authorFollows.findIndex(item => item.userId === currentUser().id && item.authorId === authorId);
  if (existingIndex >= 0) {
    state.authorFollows.splice(existingIndex, 1);
    showToast("تم إلغاء متابعة الكاتب.");
  } else {
    state.authorFollows.push({ userId: currentUser().id, authorId, createdAt: new Date().toISOString() });
    showToast("تمت متابعة الكاتب.");
  }
  saveState();
  render();
}

function readFirst(novelId) {
  const novel = state.novels.find(item => item.id === novelId);
  const last = state.reading[`${novelId}_chapter`];
  const chapter = novel.chapters.find(item => item.id === last && item.published) || publishedChapters(novel)[0];
  if (!chapter) return showToast("لا توجد فصول منشورة بعد.");
  routeTo(`read/${novel.id}/${chapter.id}`);
}

function addComment(event) {
  event.preventDefault();
  if (!requireAuth("التعليق")) return;
  const novelId = currentRoute.split("/")[1];
  const text = document.getElementById("commentText").value.trim();
  if (!text) return showToast("اكتب تعليقاً أولاً.");
  state.comments.push({ id: uid("comment"), novelId, userId: currentUser().id, text, likes: 0, createdAt: new Date().toISOString() });
  saveState();
  showToast("تم إرسال التعليق.");
  render();
}

function likeComment(commentId) {
  if (!requireAuth("الإعجاب أو عد الإعجاب")) return;
  const key = `${currentUser().id}_${commentId}`;
  if (state.likes.includes(key)) return showToast("أعجبت بهذا التعليق بالفعل.");
  const comment = state.comments.find(item => item.id === commentId);
  comment.likes = (comment.likes || 0) + 1;
  state.likes.push(key);
  saveState();
  render();
}

function novelLikeCount(novelId) {
  return state.novelLikes.filter(item => item.novelId === novelId).length;
}

function likeNovel(novelId) {
  if (!requireAuth("الإعجاب أو عد الإعجاب")) return;
  if (state.novelLikes.some(item => item.userId === currentUser().id && item.novelId === novelId)) return showToast("أعجبت بهذه الرواية بالفعل.");
  state.novelLikes.push({ userId: currentUser().id, novelId, createdAt: new Date().toISOString() });
  saveState();
  showToast("تم تسجيل إعجابك بالرواية.");
  render();
}

function reportNovel(novelId) {
  if (!requireAuth("التبليغ على الروايات")) return;
  const reason = prompt("اكتب سبب التبليغ:");
  if (!reason) return;
  state.reports.push({ id: uid("report"), novelId, userId: currentUser().id, reason, createdAt: new Date().toISOString() });
  saveState();
  showToast("تم إرسال البلاغ للإدارة.");
}

function deleteNovel(novelId) {
  if (!confirm("هل تريد حذف الرواية نهائياً؟")) return;
  const novel = state.novels.find(item => item.id === novelId);
  if (novel?.authorId !== currentUser()?.id) return showToast("لا يمكنك حذف رواية ليست لك.");
  state.novels = state.novels.filter(item => item.id !== novelId);
  state.follows = state.follows.filter(item => item.novelId !== novelId);
  state.comments = state.comments.filter(item => item.novelId !== novelId);
  saveState();
  showToast("تم حذف الرواية.");
  routeTo("my-writing");
}

async function shareNovel(novelId) {
  const novel = state.novels.find(item => item.id === novelId);
  const url = `${location.origin}${location.pathname}#novel/${novelId}`;
  if (navigator.share) await navigator.share({ title: novel.title, text: novel.description, url });
  else await navigator.clipboard.writeText(url);
  showToast("تم تجهيز رابط المشاركة.");
}

function setFilter(button) {
  const group = button.closest("[data-filter-group]").dataset.filterGroup;
  if (group === "my-writing") activeMyWritingFilter = button.dataset.filter;
  if (group === "library") activeLibraryFilter = button.dataset.filter;
  render();
}

function setReaderFont(direction) {
  readerFont = Math.min(34, Math.max(16, readerFont + (direction === "plus" ? 2 : -2)));
  localStorage.setItem("hikayat_reader_font", readerFont);
  render();
}

function setReaderLine(direction) {
  readerLine = Math.min(3, Math.max(1.5, readerLine + (direction === "plus" ? .15 : -.15)));
  localStorage.setItem("hikayat_reader_line", readerLine);
  render();
}

document.getElementById("menuToggle").addEventListener("click", () => document.getElementById("navLinks").classList.toggle("open"));
document.getElementById("writeTopButton").addEventListener("click", () => routeTo("write"));
document.getElementById("themeToggle").addEventListener("click", () => { state.theme = state.theme === "dark" ? "light" : "dark"; saveState(); });
document.getElementById("notificationsButton").addEventListener("click", () => {
  if (!requireAuth("الإشعارات")) return;
  const notes = state.notifications.filter(item => item.userId === currentUser().id);
  notes.forEach(item => item.read = true);
  saveState();
  showToast(notes.length ? notes.map(item => item.text).slice(-3).join(" | ") : "لا توجد إشعارات جديدة.");
});
authButton.addEventListener("click", () => showAuthModal("login"));
document.getElementById("closeAuth").addEventListener("click", () => authModal.classList.add("hidden"));
loginTab.addEventListener("click", () => showAuthModal("login"));
registerTab.addEventListener("click", () => showAuthModal("register"));
authForm.addEventListener("submit", handleAuth);
document.getElementById("avatarButton").addEventListener("click", () => userDropdown.classList.toggle("hidden"));
document.getElementById("logoutButton").addEventListener("click", () => { state.sessionUserId = null; saveState(); userDropdown.classList.add("hidden"); showToast("تم تسجيل الخروج."); render(); });
userDropdown.querySelectorAll("[data-route]").forEach(button => button.addEventListener("click", () => { userDropdown.classList.add("hidden"); routeTo(button.dataset.route); }));
document.getElementById("contactWhatsapp").addEventListener("click", () => window.open("https://wa.me/201116967317", "_blank", "noopener"));
document.getElementById("privacyButton").addEventListener("click", () => routeTo("privacy"));
document.getElementById("termsButton").addEventListener("click", () => routeTo("terms"));
document.getElementById("searchForm").addEventListener("submit", event => {
  event.preventDefault();
  const query = document.getElementById("searchInput").value.trim();
  if (query) routeTo(`search?q=${encodeURIComponent(query)}`);
});
document.getElementById("searchInput").addEventListener("input", event => {
  const query = event.target.value.trim().toLowerCase();
  const suggestions = document.getElementById("suggestions");
  if (!query) return suggestions.classList.add("hidden");
  const matches = state.novels.filter(novel => novel.title.toLowerCase().includes(query) || authorName(novel.authorId).toLowerCase().includes(query)).slice(0, 5);
  suggestions.innerHTML = matches.length ? matches.map(novel => `<button type="button" data-suggest="${novel.id}">${escapeHtml(novel.title)} — ${escapeHtml(authorName(novel.authorId))}</button>`).join("") : `<button type="button">لا توجد اقتراحات</button>`;
  suggestions.classList.remove("hidden");
  suggestions.querySelectorAll("[data-suggest]").forEach(button => button.addEventListener("click", () => { suggestions.classList.add("hidden"); routeTo(`novel/${button.dataset.suggest}`); }));
});
window.addEventListener("hashchange", render);
render();
