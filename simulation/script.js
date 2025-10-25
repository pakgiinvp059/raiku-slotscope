// === Raiku SlotScope — True Stable Simulation ===

const slotsContainer = document.getElementById("slots");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const compareBtn = document.getElementById("compareBtn");
const txCountInput = document.getElementById("txCount");
const scenarioSelect = document.getElementById("scenario");

let txChart, gasChart;
let totalExec = 0, totalPend = 0, totalFail = 0;
let totalGasAOT = 0, totalGasJIT = 0;
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
        { label: "Executed", borderColor: "#22c55e", backgroundColor: "rgba(34,197,94,0.15)", data: Array(10).fill(0), fill: true, tension: 0.3 },
        { label: "Pending", borderColor: "#facc15", backgroundColor: "rgba(250,204,21,0.15)", data: Array(10).fill(0), fill: true, tension: 0.3 },
        { label: "Failed", borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.15)", data: Array(10).fill(0), fill: true, tension: 0.3 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      plugins: { legend: { position: "top" } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
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
  const base = {
    Normal: { exec: 0.93, pend: 0.05, fail: 0.02 },
    HighFee: { exec: 0.88, pend: 0.09, fail: 0.03 },
    Congested: { exec: 0.82, pend: 0.12, fail: 0.06 }
  }[scenario];
  if (mode === "AOT") {
    return {
      exec: Math.min(base.exec + 0.03, 0.98),
      pend: Math.max(base.pend - 0.02, 0.01),
      fail: Math.max(base.fail - 0.01, 0.005)
    };
  }
  return base;
}

// === RESET ===
resetBtn.addEventListener("click", () => {
  totalExec = totalPend = totalFail = 0;
  totalGasAOT = totalGasJIT = 0;
  snapshots = { JIT: null, AOT: null };
  document.querySelectorAll(".exec, .pend, .fail").forEach(el => (el.textContent = "0"));
  document.querySelectorAll("#executedVal, #failedVal, #pendingVal, #totalRunVal").forEach(el => (el.textContent = 0));
  document.querySelectorAll("#jitGasVal, #aotGasVal, #totalGasVal").forEach(el => (el.textContent = "0.00000"));
  txChart.data.datasets.forEach(ds => (ds.data = Array(10).fill(0)));
  gasChart.data.datasets.forEach(ds => (ds.data = Array(10).fill(0)));
  txChart.update(); gasChart.update();
});

// === MAIN SIMULATION ===
startBtn.addEventListener("click", () => {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const scenario = scenarioSelect.value;
  const totalTX = Math.max(10, parseInt(txCountInput.value) || 100);
  simulate(mode, scenario, totalTX);
});

function simulate(mode, scenario, totalTX) {
  const { exec, pend, fail } = getRates(scenario, mode);
  const perGate = Math.floor(totalTX / 10);
  const remainder = totalTX % 10;

  let execSum = 0, failSum = 0, pendSum = 0, gasSum = 0;

  for (let i = 0; i < 10; i++) {
    const gate = document.getElementById(`slot-${i + 1}`);
    const txCount = perGate + (i < remainder ? 1 : 0); // Chia đều chính xác 100 TX
    const execCount = Math.round(txCount * exec);
    const pendCount = Math.max(1, Math.round(txCount * pend));
    const failCount = Math.max(1, txCount - execCount - pendCount);

    let e = 0, f = 0;
    gate.querySelector(".exec").textContent = "0";
    gate.querySelector(".pend").textContent = pendCount;
    gate.querySelector(".fail").textContent = "0";

    pendSum += pendCount;
    txChart.data.datasets[1].data[i] = pendCount;

    const sequence = [
      ...Array(execCount).fill("E"),
      ...Array(failCount).fill("F")
    ].sort(() => Math.random() - 0.5);

    sequence.forEach((tx, idx) => {
      const delay = idx * randomBetween(70, 150);
      setTimeout(() => {
        if (tx === "E") {
          e++;
          gate.querySelector(".exec").textContent = e;
          txChart.data.datasets[0].data[i] = e;
          execSum++;
          const gas = mode === "AOT" ? randomGas(0.00005, 0.00008) : randomGas(0.00002, 0.00005);
          gasSum += gas;
          if (mode === "AOT") { gasChart.data.datasets[0].data[i] += gas; totalGasAOT += gas; }
          else { gasChart.data.datasets[1].data[i] += gas; totalGasJIT += gas; }
        } else {
          f++;
          gate.querySelector(".fail").textContent = f;
          txChart.data.datasets[2].data[i] = f;
          failSum++;
        }
        txChart.update("none");
        gasChart.update("none");
        updateStats(execSum, pendSum, failSum);
      }, delay);
    });
  }

  // Lưu snapshot chính xác sau khi hoàn tất
  setTimeout(() => {
    const snap = { exec: execSum, pend: pendSum, fail: failSum, gas: gasSum };
    snapshots[mode] = snap;
  }, 4000);
}

// === UPDATE STATS ===
function updateStats(execSum, pendSum, failSum) {
  totalExec = execSum;
  totalFail = failSum;
  totalPend = pendSum;
  document.getElementById("executedVal").textContent = totalExec;
  document.getElementById("failedVal").textContent = totalFail;
  document.getElementById("pendingVal").textContent = totalPend;
  document.getElementById("totalRunVal").textContent = totalExec + totalPend + totalFail;
  document.getElementById("jitGasVal").textContent = totalGasJIT.toFixed(6);
  document.getElementById("aotGasVal").textContent = totalGasAOT.toFixed(6);
  document.getElementById("totalGasVal").textContent = (totalGasAOT + totalGasJIT).toFixed(6);
}

// === COMPARE POPUP ===
compareBtn.addEventListener("click", () => {
  const j = snapshots.JIT || { exec: 0, pend: 0, fail: 0, gas: 0 };
  const a = snapshots.AOT || { exec: 0, pend: 0, fail: 0, gas: 0 };

  const execDiff = ((a.exec - j.exec) / (j.exec || 1) * 100).toFixed(1);
  const pendDiff = ((j.pend - a.pend) / (j.pend || 1) * 100).toFixed(1);
  const failDiff = ((j.fail - a.fail) / (j.fail || 1) * 100).toFixed(1);
  const gasDiff = ((a.gas - j.gas) / (j.gas || 1) * 100).toFixed(1);

  const popup = document.createElement("div");
  popup.className = "popup-compare";
  popup.innerHTML = `
    <div class="popup-inner">
      <strong>📊 JIT vs AOT Comparison</strong>
      <canvas id="compareChart"></canvas>
      <p>
        AOT giảm <b>${pendDiff}% Pending</b> & <b>${failDiff}% Failed</b>,
        tăng nhẹ <b>${gasDiff}% Gas</b> để đạt độ ổn định cao hơn.
      </p>
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
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "top" } },
      scales: { y: { beginAtZero: true } }
    }
  });

  popup.querySelector(".closePopup").addEventListener("click", () => popup.remove());
});
