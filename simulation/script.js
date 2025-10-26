// === Raiku SlotScope — Realistic TX Flow Simulation ===

const slotsContainer = document.getElementById("slots");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const compareBtn = document.getElementById("compareBtn");
const txCountInput = document.getElementById("txCount");
const scenarioSelect = document.getElementById("scenario");

let txChart, gasChart;
let totalExec = 0, totalPend = 0, totalFail = 0;
let totalGasAOT = 0, totalGasJIT = 0;
let cumulative = {
  JIT: { exec: 0, pend: 0, fail: 0, gas: 0 },
  AOT: { exec: 0, pend: 0, fail: 0, gas: 0 }
};
let running = false;

// === GATES ===
for (let i = 1; i <= 10; i++) {
  const slot = document.createElement("div");
  slot.className = "slot";
  slot.id = `slot-${i}`;
  slot.innerHTML = `
    <b>Gate ${i}</b>
    <div class="dots"><div class="dot green"></div><div class="dot yellow"></div><div class="dot red"></div></div>
    <div><span class="exec">0</span> / <span class="pend">0</span> / <span class="fail">0</span></div>`;
  slotsContainer.appendChild(slot);
}

// === CHARTS ===
function initCharts() {
  const txCtx = document.getElementById("txChart").getContext("2d");
  txChart = new Chart(txCtx, {
    type: "line",
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Gate ${i + 1}`),
      datasets: [
        { label: "Executed", borderColor: "#22c55e", backgroundColor: "rgba(34,197,94,0.1)", data: Array(10).fill(0), fill: true },
        { label: "Pending", borderColor: "#facc15", backgroundColor: "rgba(250,204,21,0.1)", data: Array(10).fill(0), fill: true },
        { label: "Failed", borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.1)", data: Array(10).fill(0), fill: true }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  const gasCtx = document.getElementById("gasChart").getContext("2d");
  gasChart = new Chart(gasCtx, {
    type: "bar",
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Gate ${i + 1}`),
      datasets: [
        { label: "AOT Gas", backgroundColor: "#00c853", data: Array(10).fill(0) },
        { label: "JIT Gas", backgroundColor: "#2979ff", data: Array(10).fill(0) }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}
initCharts();

// === HELPERS ===
const rand = (min, max) => Math.random() * (max - min) + min;
const distributeTX = (total, gates = 10) => {
  const base = Math.floor(total / gates);
  let remainder = total % gates;
  const arr = Array(gates).fill(base);
  while (remainder > 0) { arr[Math.floor(Math.random() * gates)]++; remainder--; }
  return arr;
};

function gas(mode) {
  return +(mode === "AOT" ? rand(0.00005, 0.00008) : rand(0.00003, 0.00005)).toFixed(6);
}

function getRates(mode) {
  let exec = rand(0.6, 0.8);
  let fail = rand(0.03, 0.08);
  let pend = 1 - exec - fail;
  if (mode === "AOT") exec += 0.05;
  return { exec, pend, fail };
}

// === RESET ===
resetBtn.onclick = () => {
  if (running) return;
  totalExec = totalPend = totalFail = totalGasAOT = totalGasJIT = 0;
  cumulative = { JIT: { exec: 0, pend: 0, fail: 0, gas: 0 }, AOT: { exec: 0, pend: 0, fail: 0, gas: 0 } };
  document.querySelectorAll(".exec,.pend,.fail").forEach(el => el.textContent = "0");
  txChart.data.datasets.forEach(d => d.data.fill(0));
  gasChart.data.datasets.forEach(d => d.data.fill(0));
  updateStats();
  txChart.update();
  gasChart.update();
};

// === START SIMULATION ===
startBtn.onclick = async () => {
  if (running) return;
  running = true;
  startBtn.disabled = true;

  const mode = document.querySelector('input[name="mode"]:checked').value;
  const totalTX = parseInt(txCountInput.value) || 100;
  const gates = distributeTX(totalTX, 10);
  const { exec: rExec, pend: rPend, fail: rFail } = getRates(mode);

  totalPend += Math.floor(totalTX * rPend);
  cumulative[mode].pend += Math.floor(totalTX * rPend);

  for (let g = 0; g < 10; g++) {
    const slot = document.getElementById(`slot-${g + 1}`);
    const execCount = Math.round(gates[g] * rExec);
    const failCount = Math.round(gates[g] * rFail);
    const pendCount = gates[g] - execCount - failCount;

    slot.querySelector(".exec").textContent = execCount;
    slot.querySelector(".pend").textContent = pendCount;
    slot.querySelector(".fail").textContent = failCount;

    txChart.data.datasets[0].data[g] = execCount;
    txChart.data.datasets[1].data[g] = pendCount;
    txChart.data.datasets[2].data[g] = failCount;

    totalExec += execCount;
    totalFail += failCount;
    totalPend += pendCount;

    cumulative[mode].exec += execCount;
    cumulative[mode].fail += failCount;
    cumulative[mode].pend += pendCount;

    const gCost = gas(mode) * execCount;
    if (mode === "AOT") { totalGasAOT += gCost; cumulative[mode].gas += gCost; gasChart.data.datasets[0].data[g] = gCost; }
    else { totalGasJIT += gCost; cumulative[mode].gas += gCost; gasChart.data.datasets[1].data[g] = gCost; }
  }

  // update charts and stats
  txChart.update();
  gasChart.update();
  updateStats();

  // simulate pending resolution gradually (looks real)
  let interval = setInterval(() => {
    let reduce = Math.floor(totalPend * 0.15);
    if (reduce < 1) { clearInterval(interval); running = false; startBtn.disabled = false; return; }
    totalPend -= reduce;
    totalExec += reduce;
    updateStats();
  }, 1000);
};

// === UPDATE STATS ===
function updateStats() {
  const total = totalExec + totalFail + totalPend;
  document.getElementById("executedVal").textContent = totalExec;
  document.getElementById("failedVal").textContent = totalFail;
  document.getElementById("pendingVal").textContent = totalPend;
  document.getElementById("totalRunVal").textContent = total;
  document.getElementById("jitGasVal").textContent = totalGasJIT.toFixed(6);
  document.getElementById("aotGasVal").textContent = totalGasAOT.toFixed(6);
  document.getElementById("totalGasVal").textContent = (totalGasAOT + totalGasJIT).toFixed(6);
}

// === COMPARE ===
compareBtn.onclick = () => {
  const popup = document.createElement("div");
  popup.className = "popup-compare";
  popup.innerHTML = `
    <div class="popup-inner">
      <strong>📊 JIT vs AOT Comparison</strong>
      <canvas id="compareChart"></canvas>
      <p>AOT ổn định hơn, Pending ít hơn, Gas cao hơn nhẹ.</p>
      <button class="closePopup">OK</button>
    </div>`;
  document.body.appendChild(popup);

  const ctx = document.getElementById("compareChart").getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Executed", "Pending", "Failed", "Gas (SOL)"],
      datasets: [
        { label: "JIT", backgroundColor: "#2979ff", data: [cumulative.JIT.exec, cumulative.JIT.pend, cumulative.JIT.fail, cumulative.JIT.gas] },
        { label: "AOT", backgroundColor: "#00c853", data: [cumulative.AOT.exec, cumulative.AOT.pend, cumulative.AOT.fail, cumulative.AOT.gas] }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  popup.querySelector(".closePopup").onclick = () => popup.remove();
};
