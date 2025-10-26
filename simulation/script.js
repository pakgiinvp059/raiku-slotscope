// Raiku SlotScope v5.2 — Full Stable Version
// ✅ Giao diện giữ nguyên hoàn toàn
// ✅ Logic realistic (Normal, HighFee, Congested)
// ✅ Biểu đồ so sánh JIT vs AOT hiển thị giá trị, nút OK hoạt động
// ✅ Thêm dòng "AOT giảm lỗi so với JIT: X%"

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

// Lưu trữ thống kê mỗi mode
let statsByMode = {
  JIT: { total: 0, exec: 0, pend: 0, fail: 0, gas: 0 },
  AOT: { total: 0, exec: 0, pend: 0, fail: 0, gas: 0 }
};

// Gate data
let sessionExec = Array(10).fill(0);
let sessionPend = Array(10).fill(0);
let sessionFail = Array(10).fill(0);
let sessionGasAOT = Array(10).fill(0);
let sessionGasJIT = Array(10).fill(0);

// Khởi tạo UI các gate
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

// Khởi tạo biểu đồ chính
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

// Helper functions
const rand = (min, max) => Math.random() * (max - min) + min;

function distribute(total, n = 10) {
  const avg = total / n;
  const arr = [];
  for (let i = 0; i < n; i++) arr.push(Math.max(1, Math.round(avg * rand(0.9, 1.1))));
  const diff = total - arr.reduce((a, b) => a + b, 0);
  if (diff !== 0) arr[0] += diff;
  return arr;
}

function determineRates(mode, scenario) {
  let base;
  if (scenario === "Congested") base = { exec: 0.75, pend: 0.17, fail: 0.08 };
  else if (scenario === "HighFee") base = { exec: 0.82, pend: 0.12, fail: 0.06 };
  else base = { exec: 0.90, pend: 0.075, fail: 0.025 };

  base.exec += rand(-0.005, 0.005);
  base.pend += rand(-0.003, 0.003);
  base.fail += rand(-0.002, 0.002);

  if (mode === "AOT") {
    base.exec = Math.min(0.995, base.exec + rand(0.04, 0.07));
    base.pend = Math.max(0.001, base.pend * rand(0.08, 0.25));
    base.fail = Math.max(0.0005, base.fail * rand(0.1, 0.35));
  } else {
    base.exec = Math.max(0.60, base.exec - rand(0.02, 0.05));
    base.pend = Math.min(0.30, base.pend * rand(1.05, 1.35));
    base.fail = Math.min(0.20, base.fail * rand(1.1, 1.5));
  }

  const s = base.exec + base.pend + base.fail;
  return { exec: base.exec / s, pend: base.pend / s, fail: base.fail / s };
}

function gasForExec(mode) {
  return +(mode === "AOT" ? rand(0.0000425, 0.0000515) : rand(0.000041, 0.000050)).toFixed(6);
}

// Reset
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

// Start Simulation
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
    let exec = Math.round(tx * rates.exec);
    let pend = Math.round(tx * rates.pend);
    let fail = tx - exec - pend;

    pend += Math.round(rand(-1, 2));
    fail += Math.round(rand(-1, 2));
    if (pend < 0) pend = 0;
    if (fail < 0) fail = 0;

    sessionExec[i] += exec;
    sessionPend[i] += pend;
    sessionFail[i] += fail;
    sumExec += exec; sumPend += pend; sumFail += fail;

    const gasUsed = gasForExec(mode) * exec;
    if (mode === "AOT") { sessionGasAOT[i] += gasUsed; totalGasAOT += gasUsed; statsByMode.AOT.gas += gasUsed; }
    else { sessionGasJIT[i] += gasUsed; totalGasJIT += gasUsed; statsByMode.JIT.gas += gasUsed; }

    const slot = document.getElementById(`slot-${i + 1}`);
    slot.querySelector(".exec").textContent = sessionExec[i];
    slot.querySelector(".pend").textContent = sessionPend[i];
    slot.querySelector(".fail").textContent = sessionFail[i];
  }

  totalExec += sumExec;
  totalPend += sumPend;
  totalFail += sumFail;

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

  running = false;
  startBtn.disabled = false;
};

// Update Stats
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

// Compare (hiển thị giá trị + % giảm lỗi)
compareBtn.onclick = () => {
  if (!statsByMode.JIT.total && !statsByMode.AOT.total) {
    alert("Chưa có dữ liệu để so sánh.");
    return;
  }

  document.querySelectorAll(".popup-compare").forEach(p => p.remove());
  const popup = document.createElement("div");
  popup.className = "popup-compare";
  popup.innerHTML = `
    <div class="popup-inner" style="width:720px;max-width:95%;padding:20px 25px;background:white;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,0.15);text-align:center;">
      <h3 style="font-size:18px;font-weight:700;margin-bottom:10px;">📊 JIT vs AOT Comparison</h3>
      <div id="efficiencyLine" style="font-size:14px;color:#0a0;margin-bottom:10px;"></div>
      <canvas id="compareChart" style="height:320px;margin-bottom:10px;"></canvas>
      <p style="margin-top:8px;font-size:13px;color:#444;">So sánh hiệu suất từng chế độ (TX riêng). Bấm <b>Reset</b> để làm mới dữ liệu.</p>
      <button id="closePopupBtn" style="margin-top:10px;padding:6px 20px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;">OK</button>
    </div>`;
  document.body.appendChild(popup);

  const jitFail = statsByMode.JIT.fail || 0;
  const aotFail = statsByMode.AOT.fail || 0;
  const reduction = jitFail > 0 ? (((jitFail - aotFail) / jitFail) * 100).toFixed(2) : 0;
  const effText = `⚙️ AOT giảm lỗi so với JIT: <b>${reduction}%</b>`;
  document.getElementById("efficiencyLine").innerHTML = effText;

  const labels = ["Executed", "Pending", "Failed", "Avg Gas (x10⁴ SOL)"];
  const jitData = [
    statsByMode.JIT.exec,
    statsByMode.JIT.pend,
    statsByMode.JIT.fail,
    statsByMode.JIT.exec ? +(statsByMode.JIT.gas / statsByMode.JIT.exec * 10000).toFixed(3) : 0
  ];
  const aotData = [
    statsByMode.AOT.exec,
    statsByMode.AOT.pend,
    statsByMode.AOT.fail,
    statsByMode.AOT.exec ? +(statsByMode.AOT.gas / statsByMode.AOT.exec * 10000).toFixed(3) : 0
  ];

  const ctx = document.getElementById("compareChart").getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "JIT", backgroundColor: "#2979ff", borderRadius: 5, data: jitData },
        { label: "AOT", backgroundColor: "#00c853", borderRadius: 5, data: aotData }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top", labels: { font: { size: 14 } } },
        datalabels: {
          display: true,
          color: "#111",
          anchor: "end",
          align: "top",
          font: { weight: "bold", size: 13 },
          formatter: val => (typeof val === "number" ? val.toLocaleString() : val)
        },
        tooltip: {
          backgroundColor: "rgba(0,0,0,0.75)",
          titleFont: { weight: "bold" },
          callbacks: {
            label: context => {
              const val = context.parsed.y;
              if (context.label.includes("Gas"))
                return `${context.dataset.label}: ${(val / 10000).toFixed(6)} SOL`;
              return `${context.dataset.label}: ${val}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { font: { size: 12 } },
          title: { display: true, text: "TX Count / Avg Gas", font: { size: 13, weight: "bold" } }
        },
        x: { ticks: { font: { size: 13 } } }
      }
    },
    plugins: [ChartDataLabels]
  });

  document.getElementById("closePopupBtn").onclick = () => popup.remove();
};
