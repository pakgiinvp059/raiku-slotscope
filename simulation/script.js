// === Raiku SlotScope — Fixed TX Distribution and Realistic Pending ===

const slotsContainer = document.getElementById("slots");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const compareBtn = document.getElementById("compareBtn");
const txCountInput = document.getElementById("txCount");
const scenarioSelect = document.getElementById("scenario");

let txChart, gasChart;
let cumExec = 0, cumPend = 0, cumFail = 0;
let cumGasAOT = 0, cumGasJIT = 0;
let snapshots = { JIT: null, AOT: null };

// === Create 10 Gates ===
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

// === Init Charts ===
function initCharts() {
  const txCtx = document.getElementById("txChart").getContext("2d");
  txChart = new Chart(txCtx, {
    type: "line",
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Gate ${i + 1}`),
      datasets: [
        { label: "Executed", borderColor: "#22c55e", backgroundColor: "rgba(34,197,94,0.12)", data: Array(10).fill(0), fill: true, tension: 0.25 },
        { label: "Pending", borderColor: "#facc15", backgroundColor: "rgba(250,204,21,0.1)", data: Array(10).fill(0), fill: true, tension: 0.25 },
        { label: "Failed", borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.1)", data: Array(10).fill(0), fill: true, tension: 0.25 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      plugins: { legend: { position: "top" } }
    }
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
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      scales: { y: { beginAtZero: true, ticks: { callback: v => v.toFixed(6) } } }
    }
  });
}
initCharts();

// === Helpers ===
const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomGas = (min, max) => +(Math.random() * (max - min) + min).toFixed(6);

function getRates(scenario, mode) {
  // realistic rates
  const base = {
    Normal: { exec: 0.9, pend: 0.07, fail: 0.03 },
    HighFee: { exec: 0.85, pend: 0.1, fail: 0.05 },
    Congested: { exec: 0.78, pend: 0.14, fail: 0.08 }
  }[scenario];
  if (mode === "AOT") {
    return {
      exec: Math.min(base.exec + 0.05, 0.98),
      pend: Math.max(base.pend - 0.03, 0.01),
      fail: Math.max(base.fail - 0.02, 0.01)
    };
  }
  return base;
}

// === Reset ===
resetBtn.addEventListener("click", () => {
  cumExec = cumPend = cumFail = 0;
  cumGasAOT = cumGasJIT = 0;
  snapshots = { JIT: null, AOT: null };
  document.querySelectorAll(".exec, .pend, .fail").forEach(e => e.textContent = "0");
  document.querySelectorAll("#executedVal, #failedVal, #pendingVal, #totalRunVal").forEach(e => e.textContent = 0);
  document.querySelectorAll("#jitGasVal, #aotGasVal, #totalGasVal").forEach(e => e.textContent = "0.00000");
  txChart.data.datasets.forEach(ds => ds.data = Array(10).fill(0));
  gasChart.data.datasets.forEach(ds => ds.data = Array(10).fill(0));
  txChart.update(); gasChart.update();
});

// === Start Simulation ===
startBtn.addEventListener("click", () => {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const scenario = scenarioSelect.value;
  const totalTX = Math.max(1, parseInt(txCountInput.value) || 100);
  runSimulation(mode, scenario, totalTX);
});

function runSimulation(mode, scenario, totalTX) {
  const rates = getRates(scenario, mode);
  const perGate = Array(10).fill(Math.floor(totalTX / 10));
  let remainder = totalTX - perGate.reduce((a, b) => a + b, 0);
  for (let i = 0; i < remainder; i++) perGate[i]++;

  let runExec = 0, runPend = 0, runFail = 0, runGas = 0;

  for (let i = 0; i < 10; i++) {
    const gate = document.getElementById(`slot-${i + 1}`);
    const txCount = perGate[i];

    // randomize within rate band to avoid uniform gates
    let pendCount = Math.round(txCount * (rates.pend * (0.9 + Math.random() * 0.2)));
    let failCount = Math.round(txCount * (rates.fail * (0.9 + Math.random() * 0.2)));
    let execCount = txCount - pendCount - failCount;

    // correct rounding drift
    let totalNow = execCount + pendCount + failCount;
    if (totalNow < txCount) execCount += (txCount - totalNow);
    if (totalNow > txCount) execCount -= (totalNow - txCount);

    // update UI
    gate.querySelector(".exec").textContent = "0";
    gate.querySelector(".pend").textContent = pendCount;
    gate.querySelector(".fail").textContent = "0";
    txChart.data.datasets[1].data[i] = pendCount;

    cumPend += pendCount;
    runPend += pendCount;

    // TX sequence
    const sequence = [...Array(execCount).fill("E"), ...Array(failCount).fill("F")];
    for (let s = sequence.length - 1; s > 0; s--) {
      const r = Math.floor(Math.random() * (s + 1));
      [sequence[s], sequence[r]] = [sequence[r], sequence[s]];
    }

    sequence.forEach((tx, idx) => {
      const delay = idx * randomBetween(80, 150) + i * 25;
      setTimeout(() => {
        let pNow = +gate.querySelector(".pend").textContent;
        if (pNow > 0) {
          pNow--;
          gate.querySelector(".pend").textContent = pNow;
          txChart.data.datasets[1].data[i] = pNow;
          cumPend--; runPend--;
        }

        if (tx === "E") {
          const eNow = +gate.querySelector(".exec").textContent + 1;
          gate.querySelector(".exec").textContent = eNow;
          txChart.data.datasets[0].data[i] = eNow;
          cumExec++; runExec++;
          const g = mode === "AOT" ? randomGas(0.00005, 0.00008) : randomGas(0.00002, 0.00005);
          runGas += g;
          if (mode === "AOT") { cumGasAOT += g; gasChart.data.datasets[0].data[i] += g; }
          else { cumGasJIT += g; gasChart.data.datasets[1].data[i] += g; }
        } else {
          const fNow = +gate.querySelector(".fail").textContent + 1;
          gate.querySelector(".fail").textContent = fNow;
          txChart.data.datasets[2].data[i] = fNow;
          cumFail++; runFail++;
        }

        txChart.update("none");
        gasChart.update("none");
        updateStats();
      }, delay);
    });
  }

  setTimeout(() => {
    snapshots[mode] = { exec: runExec, pend: runPend, fail: runFail, gas: runGas };
  }, 4000);
}

// === Stats Update ===
function updateStats() {
  document.getElementById("executedVal").textContent = cumExec;
  document.getElementById("failedVal").textContent = cumFail;
  document.getElementById("pendingVal").textContent = cumPend;
  document.getElementById("totalRunVal").textContent = cumExec + cumPend + cumFail;
  document.getElementById("jitGasVal").textContent = cumGasJIT.toFixed(6);
  document.getElementById("aotGasVal").textContent = cumGasAOT.toFixed(6);
  document.getElementById("totalGasVal").textContent = (cumGasAOT + cumGasJIT).toFixed(6);
}

// === Compare Popup ===
compareBtn.addEventListener("click", () => {
  const j = snapshots.JIT || { exec: 0, pend: 0, fail: 0, gas: 0 };
  const a = snapshots.AOT || { exec: 0, pend: 0, fail: 0, gas: 0 };

  const popup = document.createElement("div");
  popup.className = "popup-compare";
  popup.innerHTML = `
    <div class="popup-inner">
      <strong>📊 JIT vs AOT Comparison</strong>
      <canvas id="compareChart"></canvas>
      <p>AOT giảm lỗi và pending, đổi lại gas cao hơn nhẹ.</p>
      <button class="closePopup">OK</button>
    </div>`;
  document.body.appendChild(popup);

  const ctx = document.getElementById("compareChart").getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Executed", "Pending", "Failed", "Gas (SOL)"],
      datasets: [
        { label: "JIT", backgroundColor: "#2979ff", data: [j.exec, j.pend, j.fail, j.gas] },
        { label: "AOT", backgroundColor: "#00c853", data: [a.exec, a.pend, a.fail, a.gas] }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } } }
  });

  popup.querySelector(".closePopup").addEventListener("click", () => popup.remove());
});
