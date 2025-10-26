// === Raiku SlotScope — Realistic TX Simulation vFinal ===

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

// === Helpers ===
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randFloat = (min, max) => +(Math.random() * (max - min) + min).toFixed(6);

function getRates(scenario, mode) {
  // Base probability per scenario
  const base = {
    Normal: { exec: 0.9, pend: 0.07, fail: 0.03, delay: [100, 200] },
    HighFee: { exec: 0.86, pend: 0.09, fail: 0.05, delay: [150, 250] },
    Congested: { exec: 0.78, pend: 0.14, fail: 0.08, delay: [200, 350] }
  }[scenario];

  // AOT optimization: better execution, fewer fails
  if (mode === "AOT") {
    return {
      exec: Math.min(base.exec + 0.05, 0.97),
      pend: Math.max(base.pend - 0.03, 0.01),
      fail: Math.max(base.fail - 0.02, 0.01),
      delay: base.delay.map(d => d * 0.9)
    };
  }
  return base;
}

// === Reset ===
resetBtn.onclick = () => location.reload();

// === Simulation ===
startBtn.onclick = () => {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const scenario = scenarioSelect.value;
  const totalTX = parseInt(txCountInput.value) || 100;
  startSimulation(mode, scenario, totalTX);
};

function startSimulation(mode, scenario, totalTX) {
  const rates = getRates(scenario, mode);
  const basePerGate = Math.floor(totalTX / 10);
  const gatesTX = Array(10).fill(basePerGate);
  for (let i = 0; i < totalTX % 10; i++) gatesTX[i]++;

  let execSum = 0, pendSum = 0, failSum = 0, gasSum = 0;

  gatesTX.forEach((count, i) => {
    const gate = document.getElementById(`slot-${i + 1}`);
    let exec = Math.round(count * rates.exec);
    let pend = Math.round(count * rates.pend);
    let fail = count - exec - pend;
    if (exec + pend + fail !== count) exec = count - pend - fail;

    gate.querySelector(".exec").textContent = 0;
    gate.querySelector(".pend").textContent = pend;
    gate.querySelector(".fail").textContent = 0;
    txChart.data.datasets[1].data[i] = pend;

    totalPend += pend;
    pendSum += pend;

    // randomized TX sequence per gate
    const seq = [...Array(exec).fill("E"), ...Array(fail).fill("F")].sort(() => Math.random() - 0.5);

    seq.forEach((t, j) => {
      const delay = rand(...rates.delay) + j * rand(50, 90) + i * 60;
      setTimeout(() => {
        if (pend > 0 && Math.random() > 0.5) {
          pend--;
          gate.querySelector(".pend").textContent = pend;
          txChart.data.datasets[1].data[i] = pend;
          totalPend--;
        }

        if (t === "E") {
          const eNow = +gate.querySelector(".exec").textContent + 1;
          gate.querySelector(".exec").textContent = eNow;
          txChart.data.datasets[0].data[i] = eNow;
          totalExec++; execSum++;

          const gasVal = mode === "AOT" ? randFloat(0.00005, 0.00008) : randFloat(0.00002, 0.00005);
          gasSum += gasVal;
          if (mode === "AOT") { totalGasAOT += gasVal; gasChart.data.datasets[0].data[i] += gasVal; }
          else { totalGasJIT += gasVal; gasChart.data.datasets[1].data[i] += gasVal; }
        } else {
          const fNow = +gate.querySelector(".fail").textContent + 1;
          gate.querySelector(".fail").textContent = fNow;
          txChart.data.datasets[2].data[i] = fNow;
          totalFail++; failSum++;
        }

        txChart.update("none");
        gasChart.update("none");
        updateStats();
      }, delay);
    });
  });

  // Snapshot for comparison after full run
  setTimeout(() => {
    if (mode === "JIT") jitSnapshot = { exec: execSum, pend: pendSum, fail: failSum, gas: gasSum };
    else aotSnapshot = { exec: execSum, pend: pendSum, fail: failSum, gas: gasSum };
  }, 6000);
}

// === Update Statistics ===
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

// === Compare Popup ===
compareBtn.onclick = () => {
  if (!jitSnapshot && !aotSnapshot) return;
  const j = jitSnapshot || { exec: 0, pend: 0, fail: 0, gas: 0 };
  const a = aotSnapshot || { exec: 0, pend: 0, fail: 0, gas: 0 };

  const popup = document.createElement("div");
  popup.className = "popup-compare";
  popup.innerHTML = `
    <div class="popup-inner">
      <strong>📊 JIT vs AOT Comparison</strong>
      <canvas id="compareChart"></canvas>
      <p>Thực tế mô phỏng: AOT xử lý ổn định hơn khi mạng tắc nghẽn, gas cao hơn nhẹ.</p>
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

  popup.querySelector(".closePopup").onclick = () => popup.remove();
};
