// === Raiku SlotScope — v4.9 Compare Chart Enhanced ===
// Adds value labels, corrects 3-column data sync, keeps UI identical

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

// === Stats per mode ===
let statsByMode = {
  JIT: { total: 0, exec: 0, pend: 0, fail: 0, gas: 0 },
  AOT: { total: 0, exec: 0, pend: 0, fail: 0, gas: 0 }
};

// === 10 Gates cumulative ===
let sessionExec = Array(10).fill(0);
let sessionPend = Array(10).fill(0);
let sessionFail = Array(10).fill(0);
let sessionGasAOT = Array(10).fill(0);
let sessionGasJIT = Array(10).fill(0);

// === UI setup ===
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

// === Charts ===
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

// === Helpers ===
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

function determineRates(mode) {
  if (mode === "AOT")
    return { exec: rand(0.96, 0.985), pend: rand(0.008, 0.015), fail: rand(0.002, 0.008) };
  else
    return { exec: rand(0.88, 0.93), pend: rand(0.05, 0.08), fail: rand(0.02, 0.05) };
}

function gasForExec(mode) {
  return +(mode === "AOT" ? rand(0.000042, 0.000051) : rand(0.000041, 0.00005)).toFixed(6);
}

// === Reset ===
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

// === Start Simulation ===
startBtn.onclick = async () => {
  if (running) return;
  running = true; startBtn.disabled = true;

  const mode = document.querySelector('input[name="mode"]:checked').value;
  let totalTX = parseInt(txCountInput.value) || 100;
  const rates = determineRates(mode);
  const perGate = distribute(totalTX, 10);

  let sumExec = 0, sumPend = 0, sumFail = 0;

  for (let i = 0; i < 10; i++) {
    const tx = perGate[i];
    const exec = Math.round(tx * rates.exec);
    const pend = Math.round(tx * rates.pend);
    const fail = tx - exec - pend;

    sessionExec[i] += exec; sessionPend[i] += pend; sessionFail[i] += fail;
    sumExec += exec; sumPend += pend; sumFail += fail;

    const gasUsed = gasForExec(mode) * exec;
    if (mode === "AOT") { sessionGasAOT[i] += gasUsed; totalGasAOT += gasUsed; statsByMode.AOT.gas += gasUsed; }
    else { sessionGasJIT[i] += gasUsed; totalGasJIT += gasUsed; statsByMode.JIT.gas += gasUsed; }

    const slot = document.getElementById(`slot-${i + 1}`);
    slot.querySelector(".exec").textContent = sessionExec[i];
    slot.querySelector(".pend").textContent = sessionPend[i];
    slot.querySelector(".fail").textContent = sessionFail[i];
  }

  totalExec += sumExec; totalPend += sumPend; totalFail += sumFail;
  statsByMode[mode].total += totalTX;
  statsByMode[mode].exec += sumExec;
  statsByMode[mode].pend += sumPend;
  statsByMode[mode].fail += sumFail;

  txChart.data.datasets[0].data = [...sessionExec];
  txChart.data.datasets[1].data = [...sessionPend];
  txChart.data.datasets[2].data = [...sessionFail];
  gasChart.data.datasets[0].data = [...sessionGasAOT];
  gasChart.data.datasets[1].data = [...sessionGasJIT];
  txChart.update(); gasChart.update(); updateStats();

  if (mode === "AOT") {
    const decay = setInterval(() => {
      let hasPending = false;
      for (let i = 0; i < 10; i++) {
        if (sessionPend[i] > 0) {
          sessionExec[i]++; sessionPend[i]--;
          totalExec++; totalPend--;
          hasPending = true;
        }
      }
      if (!hasPending) clearInterval(decay);
      txChart.update(); updateStats();
    }, 800);
  }

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

// === Compare ===
compareBtn.onclick = () => {
  if (!statsByMode.JIT.total && !statsByMode.AOT.total) {
    alert("Chưa có dữ liệu để so sánh.");
    return;
  }
  document.querySelectorAll(".popup-compare").forEach(p => p.remove());
  const popup = document.createElement("div");
  popup.className = "popup-compare";
  popup.innerHTML = `
    <div class="popup-inner">
      <strong>📊 JIT vs AOT Comparison</strong>
      <canvas id="compareChart"></canvas>
      <p style="margin-top:8px;font-size:13px">So sánh hiệu suất từng mode (TX riêng). Reset để làm mới.</p>
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
          font: { weight: "bold" },
          formatter: val => val.toLocaleString()
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: "TX Count / Avg Gas" }
        }
      }
    },
    plugins: [ChartDataLabels]
  });

  popup.querySelector(".closePopup").onclick = () => popup.remove();
};
