// === Raiku SlotScope v7.6 — Accumulative Gates + Fixed Compare Charts ===

const slotsContainer = document.getElementById("slots");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const compareBtn = document.getElementById("compareBtn");
const txCountInput = document.getElementById("txCount");
const scenarioSelect = document.getElementById("scenario");

let txChart, gasChart;
let totalExec = 0, totalPend = 0, totalFail = 0;
let totalGasAOT = 0, totalGasJIT = 0;
let cumulative = { JIT: { exec:0, pend:0, fail:0, gas:0 }, AOT: { exec:0, pend:0, fail:0, gas:0 } };
let running = false;

// === Init 10 Gates ===
for (let i = 1; i <= 10; i++) {
  const slot = document.createElement("div");
  slot.className = "slot";
  slot.id = `slot-${i}`;
  slot.innerHTML = `
    <b>Gate ${i}</b>
    <div class="dots">
      <div class="dot green"></div>
      <div class="dot yellow"></div>
      <div class="dot red"></div>
    </div>
    <div><span class="exec">0</span> / <span class="pend">0</span> / <span class="fail">0</span></div>`;
  slotsContainer.appendChild(slot);
}

// === Pulse animation ===
const style = document.createElement("style");
style.innerHTML = `
@keyframes pulse {
  0% { box-shadow: 0 0 5px rgba(0,122,255,0.2); }
  50% { box-shadow: 0 0 12px rgba(0,122,255,0.5); }
  100% { box-shadow: 0 0 5px rgba(0,122,255,0.2); }
}
.slot.active { animation: pulse 0.8s infinite ease-in-out; border-color:#007aff; }
`;
document.head.appendChild(style);

// === Init Charts ===
function initCharts() {
  const txCtx = document.getElementById("txChart").getContext("2d");
  txChart = new Chart(txCtx, {
    type: "line",
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Gate ${i + 1}`),
      datasets: [
        { label: "Executed (Cumulative)", borderColor: "#22c55e", backgroundColor: "rgba(34,197,94,0.08)", data: Array(10).fill(0), fill: true },
        { label: "Pending (Cumulative)", borderColor: "#facc15", backgroundColor: "rgba(250,204,21,0.06)", data: Array(10).fill(0), fill: true },
        { label: "Failed (Cumulative)", borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.06)", data: Array(10).fill(0), fill: true }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } } }
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

// === Helpers ===
const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const randomNoise = (n) => Math.max(1, n + randInt(-2, 2));

function distribute(total, n = 10) {
  const base = Math.floor(total / n);
  const arr = Array(n).fill(base);
  let remainder = total - base * n;
  for (let i = 0; i < remainder; i++) arr[i]++;
  return arr;
}

function determineRates(scenario, mode) {
  let base;
  if (scenario === "HighFee") base = { exec: 0.82, pend: 0.10, fail: 0.08 };
  else if (scenario === "Congested") base = { exec: 0.74, pend: 0.17, fail: 0.09 };
  else base = { exec: 0.93, pend: 0.05, fail: 0.02 };

  if (mode === "AOT") {
    base.exec += 0.05; base.pend *= 0.5; base.fail *= 0.6;
  } else {
    base.exec -= 0.02; base.pend *= 1.25; base.fail *= 1.5;
  }
  const sum = base.exec + base.pend + base.fail;
  return { exec: base.exec/sum, pend: base.pend/sum, fail: base.fail/sum };
}

function gasForExec(mode) {
  return +(mode === "AOT" ? rand(0.000041, 0.000050) : rand(0.000039, 0.000048)).toFixed(6);
}

// === Reset ===
resetBtn.onclick = () => location.reload();

// === Simulation ===
startBtn.onclick = async () => {
  if (running) return;
  running = true;
  startBtn.disabled = true;

  const mode = document.querySelector('input[name="mode"]:checked').value;
  const scenario = scenarioSelect.value;
  let totalTX = parseInt(txCountInput.value) || 100;
  if (totalTX <= 0) totalTX = 100;

  const rates = determineRates(scenario, mode);
  const perGate = distribute(totalTX, 10);

  let executedSum = 0, pendingSum = 0, failSum = 0;

  for (let i = 0; i < 10; i++) {
    const slot = document.getElementById(`slot-${i + 1}`);
    slot.classList.add("active");
    await new Promise(r => setTimeout(r, 300));

    let tx = randomNoise(perGate[i]);
    if (i === 9) tx = totalTX - (executedSum + pendingSum + failSum);

    let e = Math.round(tx * rates.exec);
    let p = Math.round(tx * rates.pend);
    let f = tx - e - p;
    if (f < 0) f = 0;

    executedSum += e;
    pendingSum += p;
    failSum += f;

    // cập nhật Gate & biểu đồ cộng dồn
    slot.querySelector(".exec").textContent = executedSum;
    slot.querySelector(".pend").textContent = pendingSum;
    slot.querySelector(".fail").textContent = failSum;

    txChart.data.datasets[0].data[i] = executedSum;
    txChart.data.datasets[1].data[i] = pendingSum;
    txChart.data.datasets[2].data[i] = failSum;

    const gasPer = gasForExec(mode);
    const totalGas = +(gasPer * e).toFixed(6);

    if (mode === "AOT") {
      gasChart.data.datasets[0].data[i] = totalGasAOT + totalGas;
      totalGasAOT += totalGas;
      cumulative.AOT.exec += e; cumulative.AOT.pend += p; cumulative.AOT.fail += f; cumulative.AOT.gas += totalGas;
    } else {
      gasChart.data.datasets[1].data[i] = totalGasJIT + totalGas;
      totalGasJIT += totalGas;
      cumulative.JIT.exec += e; cumulative.JIT.pend += p; cumulative.JIT.fail += f; cumulative.JIT.gas += totalGas;
    }

    totalExec = executedSum; totalPend = pendingSum; totalFail = failSum;
    txChart.update(); gasChart.update(); updateStats();
    slot.classList.remove("active");
  }

  running = false;
  startBtn.disabled = false;
};

// === Compare Popup ===
compareBtn.onclick = () => {
  document.querySelectorAll(".popup-compare").forEach(p => p.remove());

  const popup = document.createElement("div");
  popup.className = "popup-compare";
  const execDiff = ((cumulative.AOT.exec - cumulative.JIT.exec) / cumulative.JIT.exec * 100).toFixed(1);
  const gasDiff = ((cumulative.JIT.gas - cumulative.AOT.gas) / cumulative.JIT.gas * 100).toFixed(1);
  const failDiff = ((cumulative.JIT.fail - cumulative.AOT.fail) / cumulative.JIT.fail * 100).toFixed(1);

  popup.innerHTML = `
    <div class="popup-inner">
      <div class="popup-header">
        <h3>📊 AOT vs JIT Performance Overview</h3>
        <p>Deterministic Execution Impact Summary</p>
      </div>
      <div class="compare-row" style="height:220px;">
        <div class="compare-chart">
          <strong>Transaction Breakdown</strong>
          <canvas id="compareChart"></canvas>
        </div>
        <div class="compare-chart">
          <strong>Gas Consumption</strong>
          <canvas id="gasCompare"></canvas>
        </div>
      </div>
      <div class="summary-box">
        ✅ <b>AOT executed</b> ${execDiff}% more transactions<br>
        💧 <b>Gas saved</b> ${gasDiff}% compared to JIT<br>
        ⚠️ <b>Failures reduced</b> by ${failDiff}% through deterministic scheduling
      </div>
      <button class="closePopup">✖ Close</button>
    </div>`;
  document.body.appendChild(popup);
  popup.querySelector(".closePopup").onclick = () => popup.remove();

  const ctx1 = document.getElementById("compareChart").getContext("2d");
  new Chart(ctx1, {
    type: "bar",
    data: {
      labels: ["Executed", "Pending", "Failed"],
      datasets: [
        { label: "AOT", backgroundColor: "#00c853", data: [cumulative.AOT.exec, cumulative.AOT.pend, cumulative.AOT.fail] },
        { label: "JIT", backgroundColor: "#2979ff", data: [cumulative.JIT.exec, cumulative.JIT.pend, cumulative.JIT.fail] }
      ]
    },
    options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: "top" } } }
  });

  const ctx2 = document.getElementById("gasCompare").getContext("2d");
  new Chart(ctx2, {
    type: "bar",
    data: {
      labels: ["AOT Gas", "JIT Gas"],
      datasets: [
        { label: "Gas Used (SOL)", backgroundColor: ["#00c853", "#2979ff"], data: [cumulative.AOT.gas, cumulative.JIT.gas] }
      ]
    },
    options: { responsive: true, maintainAspectRatio: true }
  });
};

// === Update Stats ===
function updateStats() {
  document.getElementById("totalRunVal").textContent = totalExec + totalPend + totalFail;
  document.getElementById("executedVal").textContent = totalExec;
  document.getElementById("failedVal").textContent = totalFail;
  document.getElementById("pendingVal").textContent = totalPend;
  document.getElementById("jitGasVal").textContent = totalGasJIT.toFixed(6);
  document.getElementById("aotGasVal").textContent = totalGasAOT.toFixed(6);
  document.getElementById("totalGasVal").textContent = (totalGasAOT + totalGasJIT).toFixed(6);
}
