// === Raiku SlotScope — v4.7 Accurate Mode Isolation ===
// Keep total TX cumulative; compare chart separates JIT vs AOT exactly

const slotsContainer = document.getElementById("slots");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const compareBtn = document.getElementById("compareBtn");
const txCountInput = document.getElementById("txCount");
const scenarioSelect = document.getElementById("scenario");

let txChart, gasChart;
let totalExec = 0, totalPend = 0, totalFail = 0;
let totalGasAOT = 0, totalGasJIT = 0;
let running = false;

// store per-mode cumulative stats
let statsByMode = {
  JIT: { exec: 0, pend: 0, fail: 0, gas: 0, total: 0 },
  AOT: { exec: 0, pend: 0, fail: 0, gas: 0, total: 0 }
};

// gate data accumulates globally
let sessionExec = Array(10).fill(0);
let sessionPend = Array(10).fill(0);
let sessionFail = Array(10).fill(0);
let sessionGasAOT = Array(10).fill(0);
let sessionGasJIT = Array(10).fill(0);

// === Build gates UI ===
for (let i = 1; i <= 10; i++) {
  const slot = document.createElement("div");
  slot.className = "slot";
  slot.id = `slot-${i}`;
  slot.innerHTML = `
    <b>Gate ${i}</b>
    <div class="dots">
      <div class="dot green"></div><div class="dot yellow"></div><div class="dot red"></div>
    </div>
    <div><span class="exec">0</span> / <span class="pend">0</span> / <span class="fail">0</span></div>`;
  slotsContainer.appendChild(slot);
}

// === Charts ===
function initCharts() {
  const txCtx = document.getElementById("txChart").getContext("2d");
  txChart = new Chart(txCtx, {
    type: "line",
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Gate ${i + 1}`),
      datasets: [
        { label: "Executed", borderColor: "#22c55e", backgroundColor: "rgba(34,197,94,0.08)", data: [...sessionExec], fill: true, pointRadius: 3 },
        { label: "Pending", borderColor: "#facc15", backgroundColor: "rgba(250,204,21,0.06)", data: [...sessionPend], fill: true, pointRadius: 3 },
        { label: "Failed", borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.06)", data: [...sessionFail], fill: true, pointRadius: 3 }
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
        { label: "AOT Gas", backgroundColor: "#00c853", data: [...sessionGasAOT] },
        { label: "JIT Gas", backgroundColor: "#2979ff", data: [...sessionGasJIT] }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { ticks: { callback: v => parseFloat(v).toFixed(6) } } },
      plugins: { legend: { position: "top" } }
    }
  });
}
initCharts();

const rand = (min, max) => Math.random() * (max - min) + min;

function distribute(total, n = 10) {
  const avg = total / n;
  let arr = [], sum = 0;
  for (let i = 0; i < n; i++) {
    const bias = Math.sin((i / n) * Math.PI) * 0.08;
    const jitter = rand(0.9 + bias, 1.1 + bias / 2);
    const val = Math.max(1, Math.round(avg * jitter));
    arr.push(val); sum += val;
  }
  let drift = sum - total;
  while (drift !== 0) {
    for (let i = 0; i < n && drift !== 0; i++) {
      if (drift > 0 && arr[i] > 1) { arr[i]--; drift--; }
      else if (drift < 0) { arr[i]++; drift++; }
    }
  }
  return arr;
}

function determineRates(scenario, mode) {
  let base;
  if (scenario === "HighFee") base = { exec: 0.8, pend: 0.14, fail: 0.06 };
  else if (scenario === "Congested") base = { exec: 0.75, pend: 0.18, fail: 0.07 };
  else base = { exec: 0.88, pend: 0.09, fail: 0.03 };

  if (mode === "AOT") {
    base.exec = Math.min(base.exec + rand(0.06, 0.08), 0.995);
    base.pend = Math.max(base.pend - rand(0.05, 0.07), 0.002);
    base.fail = Math.max(base.fail - rand(0.02, 0.025), 0.001);
  } else {
    base.exec = Math.max(base.exec - rand(0.05, 0.07), 0.65);
    base.pend = Math.min(base.pend + rand(0.04, 0.06), 0.22);
    base.fail = Math.min(base.fail + rand(0.03, 0.05), 0.1);
  }

  const sum = base.exec + base.pend + base.fail;
  base.exec /= sum; base.pend /= sum; base.fail /= sum;
  return base;
}

function gasForExec(mode) {
  return +(mode === "AOT" ? rand(0.0000410, 0.0000510) : rand(0.0000400, 0.0000500)).toFixed(6);
}

// === Reset ===
resetBtn.onclick = () => {
  if (running) return;
  totalExec = totalPend = totalFail = 0;
  totalGasAOT = totalGasJIT = 0;
  statsByMode = { JIT: { exec: 0, pend: 0, fail: 0, gas: 0, total: 0 }, AOT: { exec: 0, pend: 0, fail: 0, gas: 0, total: 0 } };
  sessionExec.fill(0); sessionPend.fill(0); sessionFail.fill(0);
  sessionGasAOT.fill(0); sessionGasJIT.fill(0);
  document.querySelectorAll(".exec,.pend,.fail").forEach(e => e.textContent = "0");
  txChart.data.datasets.forEach(ds => ds.data.fill(0));
  gasChart.data.datasets.forEach(ds => ds.data.fill(0));
  txChart.update(); gasChart.update(); updateStats();
  document.querySelectorAll(".popup-compare").forEach(p => p.remove());
};

// === Start Simulation ===
startBtn.onclick = () => {
  if (running) return;
  running = true; startBtn.disabled = true;

  const mode = document.querySelector('input[name="mode"]:checked').value;
  const scenario = scenarioSelect.value;
  let totalTX = Math.max(1, parseInt(txCountInput.value) || 100);
  const rates = determineRates(scenario, mode);
  const perGate = distribute(totalTX, 10);

  let sumExec = 0, sumPend = 0, sumFail = 0;

  for (let i = 0; i < 10; i++) {
    const tx = perGate[i];
    const e = Math.round(tx * rates.exec);
    const f = Math.round(tx * rates.fail);
    const p = Math.max(0, tx - e - f);

    sessionExec[i] += e; sessionPend[i] += p; sessionFail[i] += f;
    sumExec += e; sumPend += p; sumFail += f;

    const gasUsed = gasForExec(mode) * e;
    if (mode === "AOT") { sessionGasAOT[i] += gasUsed; totalGasAOT += gasUsed; statsByMode.AOT.gas += gasUsed; }
    else { sessionGasJIT[i] += gasUsed; totalGasJIT += gasUsed; statsByMode.JIT.gas += gasUsed; }

    const slot = document.getElementById(`slot-${i + 1}`);
    slot.querySelector(".exec").textContent = sessionExec[i];
    slot.querySelector(".pend").textContent = sessionPend[i];
    slot.querySelector(".fail").textContent = sessionFail[i];
  }

  // === accumulate totals ===
  totalExec += sumExec; totalPend += sumPend; totalFail += sumFail;
  statsByMode[mode].exec += sumExec;
  statsByMode[mode].pend += sumPend;
  statsByMode[mode].fail += sumFail;
  statsByMode[mode].total += totalTX;

  txChart.data.datasets[0].data = [...sessionExec];
  txChart.data.datasets[1].data = [...sessionPend];
  txChart.data.datasets[2].data = [...sessionFail];
  gasChart.data.datasets[0].data = [...sessionGasAOT];
  gasChart.data.datasets[1].data = [...sessionGasJIT];
  txChart.update(); gasChart.update(); updateStats();
  running = false; startBtn.disabled = false;
};

// === Update Stats ===
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

// === Compare Chart ===
compareBtn.onclick = () => {
  if (statsByMode.JIT.total === 0 && statsByMode.AOT.total === 0) {
    alert("Chưa có dữ liệu để so sánh — hãy chạy JIT và/hoặc AOT ít nhất một lần.");
    return;
  }
  document.querySelectorAll(".popup-compare").forEach(p => p.remove());
  const popup = document.createElement("div");
  popup.className = "popup-compare";
  popup.innerHTML = `
    <div class="popup-inner">
      <strong>📊 JIT vs AOT Comparison</strong>
      <canvas id="compareChart"></canvas>
      <p style="margin-top:8px;font-size:13px">So sánh dữ liệu thực tế từng mode. Reset để làm mới.</p>
      <button class="closePopup">OK</button>
    </div>`;
  document.body.appendChild(popup);

  const ctx = document.getElementById("compareChart").getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Executed", "Pending", "Failed", "Avg Gas (x10⁴ SOL)"],
      datasets: [
        {
          label: "JIT",
          backgroundColor: "#2979ff",
          data: [
            statsByMode.JIT.exec,
            statsByMode.JIT.pend,
            statsByMode.JIT.fail,
            statsByMode.JIT.exec ? +(statsByMode.JIT.gas / statsByMode.JIT.exec * 10000).toFixed(3) : 0
          ]
        },
        {
          label: "AOT",
          backgroundColor: "#00c853",
          data: [
            statsByMode.AOT.exec,
            statsByMode.AOT.pend,
            statsByMode.AOT.fail,
            statsByMode.AOT.exec ? +(statsByMode.AOT.gas / statsByMode.AOT.exec * 10000).toFixed(3) : 0
          ]
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top" },
        tooltip: {
          callbacks: {
            label: ctx => {
              if (ctx.label.includes("Gas"))
                return `${ctx.dataset.label}: ${(ctx.parsed.y / 10000).toFixed(6)} SOL`;
              return `${ctx.dataset.label}: ${ctx.parsed.y}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: "TX Count / Avg Gas" },
          suggestedMax: Math.max(statsByMode.JIT.exec, statsByMode.AOT.exec) * 1.1
        }
      }
    },
    plugins: [ChartDataLabels]
  });
  popup.querySelector(".closePopup").onclick = () => popup.remove();
};
