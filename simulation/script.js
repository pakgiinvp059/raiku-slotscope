// === Raiku SlotScope — Full Transaction Flow Simulation (Final Sync v2) ===

const slotsContainer = document.getElementById("slots");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const compareBtn = document.getElementById("compareBtn");
const txCountInput = document.getElementById("txCount");
const scenarioSelect = document.getElementById("scenario");

let txChart, gasChart;
let totalExec = 0, totalPend = 0, totalFail = 0;
let totalGasAOT = 0, totalGasJIT = 0;
let jitSnapshot = null, aotSnapshot = null;

// === Create Gates ===
for (let i = 1; i <= 10; i++) {
  const gate = document.createElement("div");
  gate.className = "slot";
  gate.id = `slot-${i}`;
  gate.innerHTML = `
    <b>Gate ${i}</b>
    <div class="dots">
      <div class="dot green"></div>
      <div class="dot yellow"></div>
      <div class="dot red"></div>
    </div>
    <div><span class="exec">0</span> / <span class="pend">0</span> / <span class="fail">0</span></div>`;
  slotsContainer.appendChild(gate);
}

// === Charts Init ===
function initCharts() {
  const txCtx = document.getElementById("txChart").getContext("2d");
  txChart = new Chart(txCtx, {
    type: "line",
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Gate ${i + 1}`),
      datasets: [
        { label: "Executed", borderColor: "#22c55e", backgroundColor: "rgba(34,197,94,0.15)", data: Array(10).fill(0), fill: true, tension: 0.25 },
        { label: "Pending", borderColor: "#facc15", backgroundColor: "rgba(250,204,21,0.15)", data: Array(10).fill(0), fill: true, tension: 0.25 },
        { label: "Failed", borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.15)", data: Array(10).fill(0), fill: true, tension: 0.25 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, animation: { duration: 300 } }
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
    options: { responsive: true, maintainAspectRatio: false, animation: { duration: 350 } }
  });
}
initCharts();

// === Utility ===
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randFloat = (min, max) => +(Math.random() * (max - min) + min).toFixed(6);

function blink(gate, color, active = true) {
  const dot = gate.querySelector(`.${color}`);
  if (!dot) return;
  if (active) dot.classList.add(`blink-${color}`);
  else dot.classList.remove(`blink-${color}`);
}

// === Scenario Rates ===
function getRates(scenario, mode) {
  const base = {
    Normal: { exec: 0.9, pend: 0.07, fail: 0.03, delay: [80, 160] },
    HighFee: { exec: 0.85, pend: 0.1, fail: 0.05, delay: [150, 260] },
    Congested: { exec: 0.78, pend: 0.14, fail: 0.08, delay: [200, 340] }
  }[scenario];

  if (mode === "AOT") {
    return {
      exec: Math.min(base.exec + 0.04, 0.96),
      pend: Math.max(base.pend - 0.02, 0.015),
      fail: Math.max(base.fail - 0.01, 0.01),
      delay: base.delay.map(d => d * 0.9)
    };
  }
  return base;
}

// === Stats Update ===
function updateStats() {
  const total = totalExec + totalPend + totalFail;
  document.getElementById("executedVal").textContent = totalExec;
  document.getElementById("failedVal").textContent = totalFail;
  document.getElementById("pendingVal").textContent = totalPend;
  document.getElementById("totalRunVal").textContent = total;
  document.getElementById("jitGasVal").textContent = totalGasJIT.toFixed(6);
  document.getElementById("aotGasVal").textContent = totalGasAOT.toFixed(6);
  document.getElementById("totalGasVal").textContent = (totalGasAOT + totalGasJIT).toFixed(6);
}

// === Reset ===
resetBtn.onclick = () => location.reload();

// === Run Simulation ===
startBtn.onclick = () => {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const scenario = scenarioSelect.value;
  const totalTX = parseInt(txCountInput.value) || 100;
  runSimulation(mode, scenario, totalTX);
};

function runSimulation(mode, scenario, totalTX) {
  const rates = getRates(scenario, mode);
  const perGate = Math.floor(totalTX / 10);
  const gates = Array(10).fill(perGate);
  for (let i = 0; i < totalTX % 10; i++) gates[i]++;

  totalExec = totalPend = totalFail = 0;
  totalGasAOT = totalGasJIT = 0;

  gates.forEach((count, i) => {
    const gate = document.getElementById(`slot-${i + 1}`);
    let exec = Math.round(count * rates.exec);
    let pend = Math.round(count * rates.pend);
    let fail = count - exec - pend;

    gate.querySelector(".exec").textContent = 0;
    gate.querySelector(".pend").textContent = pend;
    gate.querySelector(".fail").textContent = 0;

    txChart.data.datasets[1].data[i] = pend;
    totalPend += pend;
    blink(gate, "yellow", true);

    const sequence = [
      ...Array(exec).fill("E"),
      ...Array(fail).fill("F")
    ].sort(() => Math.random() - 0.5);

    sequence.forEach((tx, j) => {
      const delay = rand(...rates.delay) + j * rand(60, 120);

      setTimeout(() => {
        if (pend > 0 && Math.random() > 0.5) {
          pend--;
          gate.querySelector(".pend").textContent = pend;
          txChart.data.datasets[1].data[i] = pend;
          totalPend--;
        }

        if (tx === "E") {
          blink(gate, "green", true);
          const val = +gate.querySelector(".exec").textContent + 1;
          gate.querySelector(".exec").textContent = val;
          txChart.data.datasets[0].data[i] = val;
          totalExec++;

          const gas = mode === "AOT" ? randFloat(0.000045, 0.000055) : randFloat(0.00004, 0.00005);
          if (mode === "AOT") { gasChart.data.datasets[0].data[i] += gas; totalGasAOT += gas; }
          else { gasChart.data.datasets[1].data[i] += gas; totalGasJIT += gas; }

        } else {
          blink(gate, "red", true);
          const val = +gate.querySelector(".fail").textContent + 1;
          gate.querySelector(".fail").textContent = val;
          txChart.data.datasets[2].data[i] = val;
          totalFail++;
        }

        txChart.update("none");
        gasChart.update("none");
        updateStats();

        setTimeout(() => {
          blink(gate, "green", false);
          blink(gate, "red", false);
          if (pend > 0) blink(gate, "yellow", true);
          else blink(gate, "yellow", false);
        }, 500);
      }, delay);
    });
  });
}

// === Compare Popup ===
compareBtn.onclick = () => {
  if (!totalExec) return;
  const popup = document.createElement("div");
  popup.className = "popup-compare";
  popup.innerHTML = `
    <div class="popup-inner">
      <strong>📊 JIT vs AOT Comparison</strong>
      <canvas id="compareChart"></canvas>
      <p>AOT ổn định hơn, ít lỗi hơn 20–30%, gas cao hơn nhẹ 10%.</p>
      <button class="closePopup">OK</button>
    </div>`;
  document.body.appendChild(popup);

  const ctx = document.getElementById("compareChart").getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Executed", "Pending", "Failed", "Gas (SOL)"],
      datasets: [
        { label: "JIT", backgroundColor: "#2979ff", data: [totalExec, totalPend, totalFail, totalGasJIT] },
        { label: "AOT", backgroundColor: "#00c853", data: [totalExec * 1.05, totalPend * 0.7, totalFail * 0.7, totalGasAOT * 1.1] }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } } }
  });

  popup.querySelector(".closePopup").onclick = () => popup.remove();
};
