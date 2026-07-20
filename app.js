const SUBJECTS = {
  chinese: { label: "Chinese", icon: "文", color: "#ead7cb", desc: "文学、语言、文化研究" },
  english: { label: "English", icon: "Aa", color: "#d8e4e9", desc: "Language, literature & media" },
  maths: { label: "Maths", icon: "∑", color: "#e6dfcc", desc: "模型、统计与数学研究" },
  chemistry: { label: "Chemistry", icon: "⌬", color: "#d7e7df", desc: "实验、化学与材料科学" },
  psychology: { label: "Psychology", icon: "Ψ", color: "#e5dbea", desc: "行为、认知与心理研究" },
  economics: { label: "Economics", icon: "↗", color: "#e8ddcf", desc: "市场、政策与社会议题" }
};

const state = {
  papers: [],
  subject: null,
  search: "",
  sort: "newest",
  supabase: null,
  cloud: false
};

const $ = (id) => document.getElementById(id);
const paperDialog = $("paperDialog");
const settingsDialog = $("settingsDialog");

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2400);
}

function escapeHtml(value = "") {
  return value.replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[c]));
}

function getConfig() {
  try { return JSON.parse(localStorage.getItem("papernest_supabase") || "null"); }
  catch { return null; }
}

async function initCloud() {
  const config = getConfig();
  if (!config?.url || !config?.key || !window.supabase) return false;
  try {
    state.supabase = window.supabase.createClient(config.url, config.key);
    const { error } = await state.supabase.from("papers").select("id").limit(1);
    if (error) throw error;
    state.cloud = true;
    $("cloudStatus").textContent = "云端";
    $("cloudTest").textContent = "连接成功：当前使用 Supabase 云端同步。";
    return true;
  } catch (error) {
    console.warn(error);
    state.cloud = false;
    state.supabase = null;
    $("cloudStatus").textContent = "本地";
    return false;
  }
}

async function loadPapers() {
  if (state.cloud) {
    const { data, error } = await state.supabase.from("papers").select("*").order("created_at", { ascending: false });
    if (!error) state.papers = data || [];
    else showToast("云端读取失败，已切换本地数据");
  }
  if (!state.cloud) {
    try { state.papers = JSON.parse(localStorage.getItem("papernest_papers") || "[]"); }
    catch { state.papers = []; }
  }
  render();
}

function saveLocal() {
  localStorage.setItem("papernest_papers", JSON.stringify(state.papers));
}

async function savePaper(paper, file) {
  if (state.cloud) {
    if (file) {
      const safeName = `${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error: uploadError } = await state.supabase.storage.from("papers").upload(safeName, file);
      if (uploadError) throw uploadError;
      const { data } = state.supabase.storage.from("papers").getPublicUrl(safeName);
      paper.file_url = data.publicUrl;
      paper.file_name = file.name;
    }
    const { error } = await state.supabase.from("papers").upsert(paper);
    if (error) throw error;
  } else {
    if (file) {
      paper.file_url = await fileToDataURL(file);
      paper.file_name = file.name;
    }
    const index = state.papers.findIndex(p => p.id === paper.id);
    if (index >= 0) state.papers[index] = paper;
    else state.papers.unshift(paper);
    saveLocal();
  }
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function deletePaper(id) {
  if (!confirm("确定删除这篇文献吗？")) return;
  const target = state.papers.find(p => p.id === id);
  if (state.cloud) {
    const { error } = await state.supabase.from("papers").delete().eq("id", id);
    if (error) return showToast("删除失败");
  } else {
    state.papers = state.papers.filter(p => p.id !== id);
    saveLocal();
  }
  await loadPapers();
  showToast(`已删除《${target?.title || "文献"}》`);
}

function renderSubjects() {
  $("subjectGrid").innerHTML = Object.entries(SUBJECTS).map(([key, s]) => {
    const count = state.papers.filter(p => p.subject === key).length;
    return `<button class="subject-card" data-subject="${key}">
      <span class="bubble" style="background:${s.color}"></span>
      <span class="subject-icon">${s.icon}</span>
      <h3>${s.label}</h3>
      <p>${s.desc} · ${count} 篇</p>
    </button>`;
  }).join("");

  document.querySelectorAll(".subject-card").forEach(card => {
    card.addEventListener("click", () => {
      state.subject = card.dataset.subject;
      $("libraryTitle").textContent = SUBJECTS[state.subject].label;
      $("clearFilter").hidden = false;
      renderPapers();
      document.querySelector(".library-section").scrollIntoView({ behavior: "smooth" });
    });
  });
}

function filteredPapers() {
  let result = [...state.papers];
  if (state.subject) result = result.filter(p => p.subject === state.subject);
  if (state.search) {
    const q = state.search.toLowerCase();
    result = result.filter(p =>
      [p.title, p.authors, p.notes, (p.tags || []).join(" "), p.year]
        .filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }
  result.sort((a,b) => {
    if (state.sort === "oldest") return new Date(a.created_at) - new Date(b.created_at);
    if (state.sort === "title") return (a.title || "").localeCompare(b.title || "");
    if (state.sort === "year") return Number(b.year || 0) - Number(a.year || 0);
    return new Date(b.created_at) - new Date(a.created_at);
  });
  return result;
}

function renderPapers() {
  const papers = filteredPapers();
  $("paperGrid").innerHTML = papers.map(p => {
    const s = SUBJECTS[p.subject] || SUBJECTS.chinese;
    const tags = (p.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("");
    const link = p.url ? `<a href="${escapeHtml(p.url)}" target="_blank" rel="noopener">打开链接 ↗</a>` : "";
    const file = p.file_url ? `<a href="${p.file_url}" target="_blank" ${p.file_url.startsWith("data:") ? `download="${escapeHtml(p.file_name || "paper.pdf")}"` : ""}>查看 PDF</a>` : "";
    return `<article class="paper-card">
      <div class="paper-meta">
        <span class="subject-pill" style="background:${s.color}">${s.label}</span>
        <span class="paper-year">${escapeHtml(String(p.year || "未注明年份"))}</span>
      </div>
      <h3>${escapeHtml(p.title || "未命名论文")}</h3>
      <p class="authors">${escapeHtml(p.authors || "作者未注明")}</p>
      <p class="notes">${escapeHtml(p.notes || "尚未添加笔记。")}</p>
      <div class="tags">${tags}</div>
      <div class="card-actions">
        ${link}${file}
        <button onclick="editPaper('${p.id}')">编辑</button>
        <button class="delete" onclick="deletePaper('${p.id}')">删除</button>
      </div>
    </article>`;
  }).join("");
  $("emptyState").classList.toggle("show", papers.length === 0);
  $("paperGrid").style.display = papers.length ? "grid" : "none";
  $("totalCount").textContent = state.papers.length;
  renderSubjects();
}

function render() {
  renderSubjects();
  renderPapers();
}

function openPaperDialog(paper = null) {
  $("paperForm").reset();
  $("paperId").value = paper?.id || "";
  $("dialogTitle").textContent = paper ? "编辑论文" : "添加论文";
  $("titleInput").value = paper?.title || "";
  $("subjectInput").value = paper?.subject || state.subject || "chinese";
  $("yearInput").value = paper?.year || "";
  $("authorsInput").value = paper?.authors || "";
  $("urlInput").value = paper?.url || "";
  $("tagsInput").value = (paper?.tags || []).join(", ");
  $("notesInput").value = paper?.notes || "";
  paperDialog.showModal();
}

window.editPaper = (id) => openPaperDialog(state.papers.find(p => p.id === id));
window.deletePaper = deletePaper;

$("paperForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const existing = state.papers.find(p => p.id === $("paperId").value);
  const paper = {
    id: existing?.id || uid(),
    title: $("titleInput").value.trim(),
    subject: $("subjectInput").value,
    year: $("yearInput").value ? Number($("yearInput").value) : null,
    authors: $("authorsInput").value.trim(),
    url: $("urlInput").value.trim(),
    tags: $("tagsInput").value.split(",").map(x => x.trim()).filter(Boolean),
    notes: $("notesInput").value.trim(),
    file_url: existing?.file_url || null,
    file_name: existing?.file_name || null,
    created_at: existing?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  const file = $("fileInput").files[0];
  try {
    $("savePaperBtn").disabled = true;
    $("savePaperBtn").textContent = "保存中…";
    await savePaper(paper, file);
    paperDialog.close();
    await loadPapers();
    showToast(existing ? "论文已更新" : "论文已添加");
  } catch (err) {
    console.error(err);
    showToast("保存失败，请检查云端配置");
  } finally {
    $("savePaperBtn").disabled = false;
    $("savePaperBtn").textContent = "保存论文";
  }
});

["addPaperHero","addPaperBtn","emptyAddBtn"].forEach(id => $(id).addEventListener("click", () => openPaperDialog()));
$("scrollSubjects").addEventListener("click", () => $("subjectsSection").scrollIntoView({ behavior: "smooth" }));
$("searchInput").addEventListener("input", e => { state.search = e.target.value; renderPapers(); });
$("sortSelect").addEventListener("change", e => { state.sort = e.target.value; renderPapers(); });
$("clearFilter").addEventListener("click", () => {
  state.subject = null;
  $("libraryTitle").textContent = "全部文献";
  $("clearFilter").hidden = true;
  renderPapers();
});

$("settingsBtn").addEventListener("click", () => {
  const config = getConfig();
  $("supabaseUrl").value = config?.url || "";
  $("supabaseKey").value = config?.key || "";
  settingsDialog.showModal();
});

$("settingsForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const url = $("supabaseUrl").value.trim();
  const key = $("supabaseKey").value.trim();
  if (!url || !key) return showToast("请填写完整配置");
  localStorage.setItem("papernest_supabase", JSON.stringify({ url, key }));
  const ok = await initCloud();
  if (ok) {
    settingsDialog.close();
    await loadPapers();
    showToast("云端连接成功");
  } else {
    $("cloudTest").textContent = "连接失败。请检查 URL、Anon key、数据表和权限设置。";
  }
});

$("disconnectCloud").addEventListener("click", async () => {
  localStorage.removeItem("papernest_supabase");
  state.cloud = false;
  state.supabase = null;
  $("cloudStatus").textContent = "本地";
  settingsDialog.close();
  await loadPapers();
  showToast("已切换到本地存储");
});

$("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state.papers, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `papernest-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

$("importInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported)) throw new Error("Invalid format");
    if (state.cloud) {
      const { error } = await state.supabase.from("papers").upsert(imported);
      if (error) throw error;
    } else {
      state.papers = imported;
      saveLocal();
    }
    await loadPapers();
    showToast(`已导入 ${imported.length} 篇文献`);
  } catch {
    showToast("导入失败：文件格式不正确");
  }
  e.target.value = "";
});

(async function boot() {
  await initCloud();
  await loadPapers();
})();
