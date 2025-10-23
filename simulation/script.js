const SLOT_COUNT = 10;
let perSlot = [];
let totals = { exec: 0, pend: 0, fail: 0, gasAOT: 0, gasJIT: 0 };

const slotsRow = document.getElementById("slotsRow");
const txCountInput = document.getElementById("txCount");
const scenarioSel = document.getElementById("scenarioSelect");
const aotChk = document.getElementById("aotCheckbox");
const jitChk = document.getElementById("jitCheckbox");
const autorunChk = document.getElementById("autorun");
const logBox = document.getElementById("log");

const executedStat = document.querySelector("#executedStat span");
const failedStat = document.querySelector("#failedStat span");
const pendingStat = document.querySelector("#pendingStat span");
const aotGasStat = document.querySelector("#aotGasStat span");
const jitGasStat = document.querySelector("#jitGasStat span");
const totalGasStat = document.querySelector("#totalGasStat span");

let txChart, gasChart;

// --- Init ---
window.addEventListener("DOMContentLoaded", () => {
  createSlots();
  initCharts();
  updateUI();
  log("Ready — 10 slots loaded.");
});

// --- Create Slots ---
function createSlots() {
  perSlot = Array.from({ length: SLOT_COUNT }, () => ({
    exec: 0,
    pend: 0,
    fail: 0,
    gasAOT: 0,
    gasJIT: 0
  }));

  slotsRow.innerHTML = "";
  for (let i = 0; i < SLOT_COUNT; i++) {
    const div = document.createElement("div");
    div.className = "slot";
    div.innerHTML = `
      <h4>Slot ${i + 1}</h4>
      <div class="dots">
        <span class="dot exec"></span>
        <span class="dot pending"></span>
        <span class="dot failed"></span>
      </div>
      <div class="nums">
        <span id="num-exec-${i}">0</span>
        <span id="num-pend-${i}">0</span>
        <span id="num-fail-${i}">0</span>
      </div>`;
    slotsRow.appendChild(div);
  }
}

// --- Charts ---
function initCharts() {
  const labels = Array.from({ length: SLOT_COUNT }, (_, i) => `Slot ${i + 1}`);
  const txCtx = document.getElementById("txChart").getContext("2d");
  const gasCtx = document.getElementById("gasChart").getContext("2d");

  txChart = new Chart(txCtx, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Total", data: [], borderColor: "#111827", tension: 0.3 },
        { label: "Pending", data: [], borderColor: "#f59e0b", tension: 0.3 },
        { label: "Executed", data: [], borderColor: "#16a34a", tension: 0.3 },
        { label: "Failed", data: [], borderColor: "#ef4444", tension: 0.3 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  gasChart = new Chart(gasCtx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "AOT Gas", data: [], backgroundColor: "#16a34a99" },
        { label: "JIT Gas", data: [], backgroundColor: "#3b82f699" }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

// --- Simulation Logic ---
function simulateOnce() {
  const txCount = parseInt(txCountInput.value) || 100;
  const scenario = scenarioSel.value;
  const isAOT = aotChk.checked;
  const isJIT = jitChk.checked;

  let failRate = 0.03,
    pendRate = 0.02,
    gasBase = 0.0003;

  if (scenario === "highfee") {
    failRate = 0.05;
    pendRate = 0.04;
    gasBase = 0.0005;
  } else if (scenario === "congestion") {
    failRate = 0.15;
    pendRate = 0.12;
    gasBase = 0.0004;
  }

  for (let i = 0; i < txCount; i++) {
    const s = Math.floor(Math.random() * SLOT_COUNT);
    let r = Math.random();

    if (isAOT) {
      pendRate *= 0.2;
      failRate *= 0.3;
    }

    if (r < failRate) {
      perSlot[s].fail++;
      totals.fail++;
    } else if (r < failRate + pendRate) {
      perSlot[s].pend++;
      totals.pend++;
    } else {
      perSlot[s].exec++;
      totals.exec++;
    }

    const gas = gasBase * (isAOT ? 1.5 : 1.0) * (Math.random() * 0.2 + 0.9);
    if (isAOT) {
      perSlot[s].gasAOT += gas;
      totals.gasAOT += gas;
    } else {
      perSlot[s].gasJIT += gas;
      totals.gasJIT += gas;
    }
  }

  updateUI();
  updateCharts();
  log(`Run ${scenario.toUpperCase()} — ${txCount} TX`);
}

// --- Auto-run ---
async function runAuto() {
  if (!autorunChk.checked) return simulateOnce();

  for (let i = 0; i < 5; i++) {
    simulateOnce();
    await new Promise((r) => setTimeout(r, 400));
  }

  if (confirm("Continue auto-run?")) runAuto();
  else autorunChk.checked = false;
}

// --- Update ---
function updateUI() {
  for (let i = 0; i < SLOT_COUNT; i++) {
    document.getElementById(`num-exec-${i}`).textContent = perSlot[i].exec;
    document.getElementById(`num-pend-${i}`).textContent = perSlot[i].pend;
    document.getElementById(`num-fail-${i}`).textContent = perSlot[i].fail;
  }

  executedStat.textContent = totals.exec;
  failedStat.textContent = totals.fail;
  pendingStat.textContent = totals.pend;
  aotGasStat.textContent = totals.gasAOT.toFixed(4);
  jitGasStat.textContent = totals.gasJIT.toFixed(4);
  totalGasStat.textContent = (totals.gasAOT + totals.gasJIT).toFixed(4);
}

function updateCharts() {
  const totalsArr = [],
    execArr = [],
    pendArr = [],
    failArr = [],
    aotArr = [],
    jitArr = [];

  perSlot.forEach((s) => {
    totalsArr.push(s.exec + s.pend + s.fail);
    execArr.push(s.exec);
    pendArr.push(s.pend);
    failArr.push(s.fail);
    aotArr.push(s.gasAOT);
    jitArr.push(s.gasJIT);
  });

  txChart.data.datasets[0].data = totalsArr;
  txChart.data.datasets[1].data = pendArr;
  txChart.data.datasets[2].data = execArr;
  txChart.data.datasets[3].data = failArr;
  txChart.update();

  gasChart.data.datasets[0].data = aotArr;
  gasChart.data.datasets[1].data = jitArr;
  gasChart.update();
}

function log(msg) {
  const t = new Date().toLocaleTimeString();
  logBox.insertAdjacentHTML("afterbegin", `<div>[${t}] ${msg}</div>`);
}

// --- Buttons ---
document.getElementById("startBtn").addEventListener("click", runAuto);
document.getElementById("resetBtn").addEventListener("click", () => {
  createSlots();
  totals = { exec: 0, pend: 0, fail: 0, gasAOT: 0, gasJIT: 0 };
  updateUI();
  log("Reset completed.");
});
document.getElementById("exportBtn").addEventListener("click", () => {
  let csv = "Slot,Executed,Pending,Failed,AOT Gas,JIT Gas\n";
  perSlot.forEach((s, i) => {
    csv += `${i + 1},${s.exec},${s.pend},${s.fail},${s.gasAOT.toFixed(
      6
    )},${s.gasJIT.toFixed(6)}\n`;
  });
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "raiku_slotscope.csv";
  a.click();
  URL.revokeObjectURL(url);
});
