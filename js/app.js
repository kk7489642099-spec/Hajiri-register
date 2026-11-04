import { getAll, putOne, deleteOne, exportAll, replaceAll } from "./db.js";
import { calculateWorkerMonth } from "./reports.js";

const $ = id => document.getElementById(id);
const today = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
const makeId = prefix => `${prefix}_${crypto.randomUUID()}`;
const state = { sites: [], workers: [], attendance: [], transactions: [], siteId: null };

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

async function refreshData() {
  [state.sites, state.workers, state.attendance, state.transactions] = await Promise.all([
    getAll("sites"), getAll("workers"), getAll("attendance"), getAll("transactions")
  ]);
  if (!state.siteId || !state.sites.some(site => site.id === state.siteId)) {
    state.siteId = state.sites[0]?.id || null;
  }
}

async function ensureFirstSite() {
  if (state.sites.length) return;
  const site = { id: makeId("site"), name: "Main Site", createdAt: new Date().toISOString() };
  await putOne("sites", site);
  state.siteId = site.id;
}

function currentAttendance() {
  const date = $("attendanceDate").value;
  return state.attendance.find(day => day.siteId === state.siteId && day.date === date);
}

async function saveAttendanceEntry(worker, status) {
  const date = $("attendanceDate").value;
  let day = currentAttendance();
  if (!day) day = { id: makeId("day"), siteId: state.siteId, date, entries: {} };

  if (day.entries[worker.id]?.status === status) {
    delete day.entries[worker.id];
  } else {
    day.entries[worker.id] = {
      status,
      wageAtTime: Number(worker.dailyWage),
      workerNameAtTime: worker.name,
      updatedAt: new Date().toISOString()
    };
  }

  await putOne("attendance", day);
  await refreshData();
  renderAttendance();
  renderReport();
}

function renderSites() {
  $("siteSelect").innerHTML = state.sites.map(site =>
    `<option value="${site.id}">${escapeHtml(site.name)}</option>`
  ).join("");
  $("siteSelect").value = state.siteId || "";
}

function renderAttendance() {
  const date = $("attendanceDate").value;
  const day = currentAttendance();
  const entries = day?.entries || {};
  const workers = state.workers.filter(worker => worker.active !== false && worker.siteId === state.siteId);

  $("emptyAttendance").hidden = workers.length > 0;
  $("attendanceList").innerHTML = workers.map(worker => {
    const entry = entries[worker.id];
    const status = entry?.status || "";
    const statusButtons = [
      ["present", "Present"], ["half", "Half-day"], ["absent", "Absent"]
    ].map(([key, label]) => `<button class="status-button ${status === key ? "selected" : ""}" data-worker="${worker.id}" data-status="${key}" type="button">${label}</button>`).join("");

    return `<article class="attendance-card">
      <div class="attendance-top">
        <div><div class="person-name">${escapeHtml(worker.name)}</div>
        <div class="meta">Daily wage ₹${Number(worker.dailyWage).toLocaleString("en-IN")}</div></div>
        <span class="meta">${entry ? (status === "half" ? "Half-day" : status[0].toUpperCase() + status.slice(1)) : "Not marked"}</span>
      </div>
      <div class="status-actions">${statusButtons}</div>
    </article>`;
  }).join("");

  const counts = Object.values(entries).reduce((result, entry) => {
    result[entry.status] = (result[entry.status] || 0) + 1;
    return result;
  }, {});
  $("attendanceSummary").innerHTML = `
    <span class="summary-chip">Present <strong>${counts.present || 0}</strong></span>
    <span class="summary-chip">Half-day <strong>${counts.half || 0}</strong></span>
    <span class="summary-chip">Absent <strong>${counts.absent || 0}</strong></span>
    <span class="summary-chip">Unmarked <strong>${Math.max(0, workers.length - Object.keys(entries).length)}</strong></span>`;
}

function renderWorkers() {
  const workers = state.workers.filter(worker => worker.siteId === state.siteId);
  $("workerDirectory").innerHTML = workers.map(worker => `
    <div class="directory-card">
      <div class="directory-top">
        <div><div class="person-name">${escapeHtml(worker.name)}</div><div class="meta">Daily wage ₹${Number(worker.dailyWage).toLocaleString("en-IN")}</div></div>
        <div class="small-actions">
          <button class="small-button" data-edit-worker="${worker.id}" type="button">Edit</button>
          <button class="small-button" data-archive-worker="${worker.id}" type="button">${worker.active === false ? "Restore" : "Archive"}</button>
        </div>
      </div>
    </div>`).join("");

  $("paymentWorker").innerHTML = workers.filter(w => w.active !== false)
    .map(worker => `<option value="${worker.id}">${escapeHtml(worker.name)}</option>`).join("");
}

function renderTransactions() {
  const recent = state.transactions.filter(item => item.siteId === state.siteId)
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  $("recentTransactions").innerHTML = recent.map(item => {
    const worker = state.workers.find(w => w.id === item.workerId);
    return `<div class="transaction-card"><div class="transaction-top">
      <div><div class="person-name">${escapeHtml(worker?.name || item.workerNameAtTime || "Archived labourer")}</div>
      <div class="meta">${item.date} · ${item.type === "advance" ? "Advance" : "Wage payment"}${item.note ? " · " + escapeHtml(item.note) : ""}</div></div>
      <strong>₹${Number(item.amount).toLocaleString("en-IN")}</strong>
    </div></div>`;
  }).join("") || `<p class="empty-state">No payments recorded yet.</p>`;
}

function renderReport() {
  const month = $("reportMonth").value;
  const workers = state.workers.filter(worker => worker.siteId === state.siteId);
  const rows = workers.map(worker => ({
    worker,
    result: calculateWorkerMonth(worker.id, state.siteId, month, state.attendance, state.transactions)
  })).filter(row => row.result.earned || row.result.paid);

  const totalEarned = rows.reduce((sum, row) => sum + row.result.earned, 0);
  const totalPaid = rows.reduce((sum, row) => sum + row.result.paid, 0);

  $("monthlyReport").innerHTML = rows.map(({ worker, result }) => `
    <div class="report-card">
      <div class="report-top"><div><div class="person-name">${escapeHtml(worker.name)}</div>
      <div class="meta">${result.presentDays} full · ${result.halfDays} half · ${result.absentDays} absent</div></div>
      <div class="report-total">₹${Math.round(result.balance).toLocaleString("en-IN")}</div></div>
      <div class="meta">Earned ₹${Math.round(result.earned).toLocaleString("en-IN")} · Paid/advance ₹${Math.round(result.paid).toLocaleString("en-IN")}</div>
    </div>`).join("") || `<p class="empty-state">No wage activity for this month.</p>`;

  $("monthlyReport").insertAdjacentHTML("beforeend", `
    <div class="summary-strip">
      <span class="summary-chip">Total earned <strong>₹${Math.round(totalEarned).toLocaleString("en-IN")}</strong></span>
      <span class="summary-chip">Total paid <strong>₹${Math.round(totalPaid).toLocaleString("en-IN")}</strong></span>
      <span class="summary-chip">Balance <strong>₹${Math.round(totalEarned - totalPaid).toLocaleString("en-IN")}</strong></span>
    </div>`);
}

async function addSite() {
  const name = $("newSiteName").value.trim();
  if (!name) return;
  if (state.sites.some(site => site.name.toLowerCase() === name.toLowerCase())) {
    alert("A site with this name already exists.");
    return;
  }
  const site = { id: makeId("site"), name, createdAt: new Date().toISOString() };
  await putOne("sites", site);
  state.siteId = site.id;
  $("newSiteName").value = "";
  $("siteDialog").close();
  await refreshData();
  renderAll();
}

async function addWorker(event) {
  event.preventDefault();
  const name = $("workerName").value.trim();
  const dailyWage = Number($("workerWage").value);
  if (!name || !Number.isFinite(dailyWage) || dailyWage < 0) return alert("Enter a valid name and wage.");
  const worker = {
    id: makeId("worker"), siteId: state.siteId, name, dailyWage,
    active: true, createdAt: new Date().toISOString()
  };
  await putOne("workers", worker);
  $("workerForm").reset();
  await refreshData();
  renderAll();
}

async function saveWorkerEdit(event) {
  event.preventDefault();
  const id = $("editWorkerId").value;
  const worker = state.workers.find(item => item.id === id);
  if (!worker) return;
  worker.name = $("editWorkerName").value.trim();
  worker.dailyWage = Number($("editWorkerWage").value);
  await putOne("workers", worker);
  $("editWorkerDialog").close();
  await refreshData();
  renderAll();
}

async function archiveWorker(id) {
  const worker = state.workers.find(item => item.id === id);
  if (!worker) return;
  worker.active = worker.active === false;
  await putOne("workers", worker);
  await refreshData();
  renderAll();
}

async function addTransaction(event) {
  event.preventDefault();
  const worker = state.workers.find(item => item.id === $("paymentWorker").value);
  const amount = Number($("paymentAmount").value);
  if (!worker || !Number.isFinite(amount) || amount <= 0) return alert("Enter a valid amount.");
  const transaction = {
    id: makeId("txn"), siteId: state.siteId, workerId: worker.id,
    workerNameAtTime: worker.name, type: $("paymentType").value,
    amount, date: $("paymentDate").value, note: $("paymentNote").value.trim(),
    createdAt: new Date().toISOString()
  };
  await putOne("transactions", transaction);
  $("paymentAmount").value = "";
  $("paymentNote").value = "";
  await refreshData();
  renderAll();
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function backupData() {
  const backup = await exportAll();
  downloadFile(`hajiri-backup-${today()}.json`, JSON.stringify(backup, null, 2), "application/json");
}

async function restoreData(file) {
  if (!file) return;
  if (!confirm("Restore replaces the data currently stored in this browser. Make a backup first. Continue?")) return;
  try {
    const backup = JSON.parse(await file.text());
    if (backup.app !== "Hajiri Register" || !Array.isArray(backup.sites) ||
        !Array.isArray(backup.workers) || !Array.isArray(backup.attendance) ||
        !Array.isArray(backup.transactions)) throw new Error("Invalid backup file.");
    await replaceAll(backup);
    await refreshData();
    renderAll();
    alert("Backup restored.");
  } catch (error) {
    alert(`Could not restore backup: ${error.message}`);
  }
}

async function exportCsv() {
  const month = $("reportMonth").value;
  const workers = state.workers.filter(worker => worker.siteId === state.siteId);
  const rows = [["Labourer", "Month", "Present days", "Half days", "Absent days", "Earned", "Paid/advance", "Balance"]];
  for (const worker of workers) {
    const result = calculateWorkerMonth(worker.id, state.siteId, month, state.attendance, state.transactions);
    rows.push([worker.name, month, result.presentDays, result.halfDays, result.absentDays,
      result.earned, result.paid, result.balance]);
  }
  const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  downloadFile(`hajiri-report-${month}.csv`, "\uFEFF" + csv, "text/csv;charset=utf-8");
}

function renderAll() {
  renderSites();
  renderAttendance();
  renderWorkers();
  renderTransactions();
  renderReport();
}

function registerEvents() {
  $("siteSelect").addEventListener("change", event => { state.siteId = event.target.value; renderAll(); });
  $("attendanceDate").addEventListener("change", renderAttendance);
  $("reportMonth").addEventListener("change", renderReport);
  $("workerForm").addEventListener("submit", addWorker);
  $("paymentForm").addEventListener("submit", addTransaction);
  $("siteForm").addEventListener("submit", event => { event.preventDefault(); addSite(); });
  $("editWorkerForm").addEventListener("submit", saveWorkerEdit);
  $("addSiteButton").addEventListener("click", () => $("siteDialog").showModal());
  $("attendanceList").addEventListener("click", event => {
    const button = event.target.closest("[data-worker]");
    if (!button) return;
    const worker = state.workers.find(item => item.id === button.dataset.worker);
    if (worker) saveAttendanceEntry(worker, button.dataset.status);
  });
  $("workerDirectory").addEventListener("click", event => {
    const editButton = event.target.closest("[data-edit-worker]");
    const archiveButton = event.target.closest("[data-archive-worker]");
    if (editButton) {
      const worker = state.workers.find(item => item.id === editButton.dataset.editWorker);
      if (!worker) return;
      $("editWorkerId").value = worker.id;
      $("editWorkerName").value = worker.name;
      $("editWorkerWage").value = worker.dailyWage;
      $("editWorkerDialog").showModal();
    }
    if (archiveButton) archiveWorker(archiveButton.dataset.archiveWorker);
  });
  $("backupButton").addEventListener("click", backupData);
  $("restoreButton").addEventListener("click", () => $("restoreFile").click());
  $("restoreFile").addEventListener("change", event => restoreData(event.target.files[0]));
  $("exportCsvButton").addEventListener("click", exportCsv);
}

async function startApp() {
  try {
    $("attendanceDate").value = today();
    $("paymentDate").value = today();
    $("reportMonth").value = today().slice(0, 7);
    registerEvents();
    await refreshData();
    await ensureFirstSite();
    await refreshData();
    renderAll();
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
    }
  } catch (error) {
    console.error(error);
    alert("The register could not start. Please reload the page. If this continues, contact the app developer.");
  }
}

startApp();
