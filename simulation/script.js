// script.js — Raiku SlotScope v5.1.1 (Scenario-corrected, cumulative stable logic)
// Keep UI unchanged. Fix: scenario rates (Normal < HighFee < Congested), cumulative logic.

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

// Per-mode cumulative stats
let statsByMode = {
  JIT: { total: 0, exec: 0, pend: 0, fail: 0, gas: 0 },
  AOT: { total: 0, exec: 0, pend: 0, fail: 0, gas: 0 }
};

// Gate-level accumulators (persistent across runs)
let sessionExec = Array(10).fill(0);
let sessionPend = Array(10).fill(0);
let sessionFail = Array(10).fill(0);
let sessionGasAOT = Array(10).fill(0);
let sessionGasJIT = Array(10).fill(0);

// --- Build gate UI (unchanged) ---
for (let i = 1; i <= 10; i++) {
  const gate = document.createElement("div");
  gate.className = "slot";
  gate.id = `slot-${i}`;
  gate.innerHTML = `
    <b>Gate ${i}</b>
    <div class="dots"><div class="dot green"></div><div class="dot yellow"></div><div class="dot red"></div></div>
    <div><span class="exec">0</span> / <span class="pend">0</span> / <span class="fail">0</span></div>`;
  slotsContainer.appendChild(gate);
}

// --- Charts init (unchanged look) ---
function initCharts() {
  const txCtx = document.getElementById("txChart").getContext("2d");
  txChart = new Chart(txCtx, {
    type: "line",
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Gate ${i + 1}`),
      datasets: [
        { label: "Executed", borderColor: "#22c55e", backgroundColor: "rgba(34,197,94,0.08)", data: [...sessionExec], fill: true },
        { label: "Pending", borderColor: "#facc15", backgroundColor: "rgba(250,204,21,0.06)", data: [...sessionPend], fill: true },
        { label: "Failed", borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.06)", data: [...sessionFail], fill: true }
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

// --- Helpers ---
const rand = (min, max) => Math.random() * (max - min) + min;

function distribute(total, n = 10) {
  const avg = total / n;
  const arr = [];
  for (let i = 0; i < n; i++) {
    const noise = rand(0.85, 1.15);
    arr.push(Math.max(1, Math.round(avg * noise)));
  }
  const diff = total - arr.reduce((a, b) => a + b, 0);
  if (diff !== 0) arr[0] += diff;
  return arr;
}

/*
  determineRates(mode, scenario)
  - scenario: "Normal", "HighFee", "Congested"
  Desired order of fail rate: Normal < HighFee < Congested
  Desired pending: Normal low, HighFee medium, Congested high
  AOT adjusts to be much better than JIT across scenarios
*/
function determineRates(mode, scenario) {
  // base per scenario (before mode adjust)
  let base;
  if (scenario === "Congested") {
    base = { exec: 0.75, pend: 0.17, fail: 0.08 };
  } else if (scenario === "HighFee") {
    base = { exec: 0.82, pend: 0.12, fail: 0.06 };
  } else { // Normal
    base = { exec: 0.90, pend: 0.07, fail: 0.03 };
  }

  // mode adjustments: AOT improves exec/pend/fail slightly; JIT slightly worse
  if (mode === "AOT") {
    // AOT small exec boost, reduce pend and fail substantially
    base.exec = Math.min(0.995, base.exec + rand(0.04, 0.07));
    base.pend = Math.max(0.001, base.pend * rand(0.08, 0.25)); // much smaller pending fraction
    base.fail = Math.max(0.0005, base.fail * rand(0.1, 0.35)); // fail lower
  } else {
    // JIT slightly worse than base: a bit less exec, more pend/fail
    base.exec = Math.max(0.60, base.exec - rand(0.02, 0.06));
    base.pend = Math.min(0.30, base.pend * rand(1.05, 1.35));
    base.fail = Math.min(0.20, base.fail * rand(1.1, 1.6));
  }

  // normalize to ensure exec+pend+fail ~= 1 (rounding later)
  const s = base.exec + base.pend + base.fail;
  return { exec: base.exec / s, pend: base.pend / s, fail: base.fail / s };
}

// AOT gas slightly higher (but only ~1-2% up), JIT slightly lower
function gasForExec(mode) {
  if (mode === "AOT") return +(rand(0.0000425, 0.0000515)).toFixed(6);
  return +(rand(0.0000410, 0.0000500)).toFixed(6);
}

// --- Reset (keep UI unchanged) ---
resetBtn.onclick = () => {
  if (running) return;
  totalExec = totalPend = totalFail = 0;
  totalGasAOT = totalGasJIT = 0;
  statsByMode = { JIT: { total: 0, exec: 0, pend: 0, fail: 0, gas: 0 }, AOT: { total: 0, exec: 0, pend: 0, fail: 0, gas: 0 } };
  sessionExec.fill(0); sessionPend.fill(0); sessionFail.fill(0);
  sessionGasAOT.fill(0); sessionGasJIT.fill(0);
  document.querySelectorAll(".exec,.pend,.fail").forEach(e => e.textContent = "0");
  txChart.data.datasets.forEach(ds => ds.data.fill(0));
  gasChart.data.datasets.forEach(ds => ds.data.fill(0));
  txChart.update(); gasChart.update(); updateStats();
  document.querySelectorAll(".popup-compare").forEach(p => p.remove());
};

// --- Start Simulation ---
// Cumulative: each Start adds more TX to totals and gate accumulators;
// pending/fail of prior runs remain and do not decay. AOT produces much fewer new pending/fail.
startBtn.onclick = () => {
  if (running) return;
  running = true;
  startBtn.disabled = true;

  const mode = document.querySelector('input[name="mode"]:checked').value;
  const scenario = scenarioSelect.value;
  const totalTX = Math.max(1, parseInt(txCountInput.value) || 100);
  const rates = determineRates(mode, scenario);
  const perGate = distribute(totalTX, 10);

  let sumExec = 0, sumPend = 0, sumFail = 0;

  for (let i = 0; i < 10; i++) {
    const tx = perGate[i];

    // calculate expected counts using rates; ensure integer rounding doesn't create negative
    let exec = Math.round(tx * rates.exec);
    let pend = Math.round(tx * rates.pend);
    let fail = tx - exec - pend;

    // correction if rounding produced negative fail or small inconsistencies
    if (fail < 0) {
      // move some from exec to fail/pending
      const diff = -fail;
      const take = Math.min(diff, exec);
      exec -= take;
      fail += take;
    }

    // apply cumulative addition
    sessionExec[i] += exec;
    sessionPend[i] += pend;
    sessionFail[i] += fail;

    sumExec += exec; sumPend += pend; sumFail += fail;

    // gas accumulation
    const gasUsed = gasForExec(mode) * exec;
    if (mode === "AOT") { sessionGasAOT[i] += gasUsed; totalGasAOT += gasUsed; statsByMode.AOT.gas += gasUsed; }
    else { sessionGasJIT[i] += gasUsed; totalGasJIT += gasUsed; statsByMode.JIT.gas += gasUsed; }

    // update gate UI text
    const slot = document.getElementById(`slot-${i + 1}`);
    slot.querySelector(".exec").textContent = sessionExec[i];
    slot.querySelector(".pend").textContent = sessionPend[i];
    slot.querySelector(".fail").textContent = sessionFail[i];
  }

  // update global totals (cumulative)
  totalExec += sumExec;
  totalPend += sumPend;
  totalFail += sumFail;

  // per-mode cumulative stats
  statsByMode[mode].total += totalTX;
  statsByMode[mode].exec += sumExec;
  statsByMode[mode].pend += sumPend;
  statsByMode[mode].fail += sumFail;

  // update charts
  txChart.data.datasets[0].data = [...sessionExec];
  txChart.data.datasets[1].data = [...sessionPend];
  txChart.data.datasets[2].data = [...sessionFail];
  gasChart.data.datasets[0].data = [...sessionGasAOT];
  gasChart.data.datasets[1].data = [...sessionGasJIT];

  txChart.update(); gasChart.update(); updateStats();

  running = false;
  startBtn.disabled = false;
};

// --- Update stats UI ---
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

// --- Compare popup (unchanged behavior, show per-mode cumulative) ---
compareBtn.onclick = () => {
  if (!statsByMode.JIT.total && !statsByMode.AOT.total) {
    alert("Chưa có dữ liệu để so sánh.");
    return;
  }
  document.querySelectorAll(".popup-compare").forEach(p => p.remove());
  const popup = document.createElement("div");
  popup.className = "popup-compare";

  // percentage success per mode (exec / total)
  const pctJIT = statsByMode.JIT.total ? (statsByMode.JIT.exec / (statsByMode.JIT.exec + statsByMode.JIT.pend + statsByMode.JIT.fail) * 100) : 0;
  const pctAOT = statsByMode.AOT.total ? (statsByMode.AOT.exec / (statsByMode.AOT.exec + statsByMode.AOT.pend + statsByMode.AOT.fail) * 100) : 0;

  popup.innerHTML = `
    <div class="popup-inner">
      <strong>📊 JIT vs AOT Comparison</strong>
      <canvas id="compareChart"></canvas>
      <p style="margin-top:8px;font-size:13px">So sánh hiệu suất từng mode (TX riêng). Reset để làm mới.</p>
      <p style="font-size:13px;margin-top:6px;color:#222;">
        <b>Success rate:</b> JIT ${pctJIT.toFixed(1)}% — AOT ${pctAOT.toFixed(1)}%
      </p>
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
        datalabels: {
          color: "#111",
          anchor: "end",
          align: "top",
          font: { weight: "600" },
          formatter: val => val.toLocaleString()
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              if (ctx.label.includes("Gas")) return `${ctx.dataset.label}: ${(ctx.parsed.y / 10000).toFixed(6)} SOL`;
              return `${ctx.dataset.label}: ${ctx.parsed.y}`;
            }
          }
        }
      },
      scales: { y: { beginAtZero: true, title: { display: true, text: "TX Count / Avg Gas" } } }
    },
    plugins: [ChartDataLabels]
  });

  popup.querySelector(".closePopup").onclick = () => popup.remove();
};
