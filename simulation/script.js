// Raiku SlotScope — Compact MiniChart Version

let slots = [];
let txRecords = [];
let totalFee = 0;

const timeline = document.getElementById("timeline");
const log = document.getElementById("log");
const metricsMini = {
  exec: document.getElementById("execCount"),
  fail: document.getElementById("failCount"),
  pend: document.getElementById("pendCount"),
};
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const scenarioSel = document.getElementById("scenario");
const modeAot = document.getElementById("modeAot");
const txCountInput = document.getElementById("txCount");

let miniChart, ctxMini;

function addLog(t) {
  log.innerHTML = `[${new Date().toLocaleTimeString()}] ${t}<br>` + log.innerHTML;
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function initSlots() {
  timeline.innerHTML = "";
  slots = [];
  for (let i = 1; i <= 10; i++) {
    const el = document.createElement("div");
    el.className = "slot";
    el.innerHTML = `Slot ${i}`;
    timeline.appendChild(el);
    slots.push({ id: i, el, state: "idle" });
  }
  txRecords = [];
  totalFee = 0;
  updateMiniStats(0, 0, 0);
  resetMiniChart();
  addLog("🟢 Ready.");
}

function setSlotState(slot, state) {
  slot.el.classList.remove("executed", "failed", "pending");
  if (state !== "idle") slot.el.classList.add(state);
  slot.state = state;
}

function initMiniChart() {
  ctxMini = document.getElementById("miniChart").getContext("2d");
  miniChart = new Chart(ctxMini, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        { label: "Executed", borderColor: "#22bb55", data: [] },
        { label: "Failed", borderColor: "#ff4444", data: [] },
      ],
    },
    options: {
      responsive: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: { display: false },
      },
    },
  });
}

function resetMiniChart() {
  if (!miniChart) return;
  miniChart.data.labels = [];
  miniChart.data.datasets.forEach((d) => (d.data = []));
  miniChart.update();
}

function updateMiniStats(exec, fail, pend) {
  metricsMini.exec.textContent = exec;
  metricsMini.fail.textContent = fail;
  metricsMini.pend.textContent = pend;
}

function updateMiniChart(slot, exec, fail) {
  miniChart.data.labels.push(slot);
  miniChart.data.datasets[0].data.push(exec);
  miniChart.data.datasets[1].data.push(fail);
  miniChart.update();
}

async function simulate() {
  const totalTx = Number(txCountInput.value);
  const perSlot = Math.ceil(totalTx / 10);
  const sc = scenarioSel.value;

  let execTotal = 0,
    failTotal = 0,
    pendTotal = 0;

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    setSlotState(slot, "pending");
    pendTotal += perSlot;
    updateMiniStats(execTotal, failTotal, pendTotal);
    await sleep(150);

    let executed = 0,
      failed = 0;
    for (let j = 0; j < perSlot; j++) {
      const success = Math.random() > 0.2;
      if (success) executed++;
      else failed++;
    }

    execTotal += executed;
    failTotal += failed;
    pendTotal -= perSlot;

    setSlotState(slot, executed ? "executed" : failed ? "failed" : "idle");
    updateMiniStats(execTotal, failTotal, pendTotal);
    updateMiniChart(slot.id, execTotal, failTotal);
    addLog(`Slot ${slot.id}: ${executed} ✅, ${failed} ❌`);
    await sleep(200);
    setSlotState(slot, "idle");
  }
  addLog("✅ Simulation complete.");
}

startBtn.addEventListener("click", async () => {
  initSlots();
  await simulate();
});
resetBtn.addEventListener("click", initSlots);

window.onload = () => {
  initSlots();
  initMiniChart();
};
