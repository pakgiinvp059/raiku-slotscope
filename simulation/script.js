// === Raiku SlotScope v6.3 — Deterministic Execution Simulation ===
// ✅ Sửa logic chạy TX tuần tự từng Gate
// ✅ Dữ liệu, biểu đồ, popup hoạt động chính xác

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

// === Khởi tạo 10 Gate ===
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

// === Charts ===
function initCharts() {
  const txCtx = document.getElementById("txChart").getContext("2d");
  txChart = new Chart(txCtx, {
    type: "line",
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Gate ${i + 1}`),
      datasets: [
        { label: "Executed", borderColor: "#22c55e", backgroundColor: "rgba(34,197,94,0.08)", data: Array(10).fill(0), fill: true },
        { label: "Pending", borderColor: "#facc15", backgroundColor: "rgba(250,204,21,0.06)", data: Array(10).fill(0), fill: true },
        { label: "Failed", borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.06)", data: Array(10).fill(0), fill: true }
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
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { callback: v => parseFloat(v).toFixed(6) } } } }
  });
}
initCharts();

// === Helpers ===
const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));

function distribute(total, n = 10) {
  const base = Math.floor(total / n);
  const arr = Array(n).fill(base);
  let remainder = total - base * n;
  for (let i = 0; i < remainder; i++) arr[i]++;
  return arr;
}

function determineRates(scenario, mode) {
  let base;
  if (scenario === "HighFee") base = { exec: 0.85, pend: 0.10, fail: 0.05 };
  else if (scenario === "Congested") base = { exec: 0.75, pend: 0.18, fail: 0.07 };
  else base = { exec: 0.92, pend: 0.06, fail: 0.02 }; // Normal

  if (mode === "AOT") {
    base.exec = Math.min(base.exec + 0.05, 0.99);
    base.pend = Math.max(base.pend * 0.4, 0.005);
    base.fail = Math.max(base.fail * 0.5, 0.002);
  } else {
    base.exec = Math.max(base.exec - 0.03, 0.7);
    base.pend = base.pend * 1.2;
    base.fail = base.fail * 1.3;
  }
  const sum = base.exec + base.pend + base.fail;
  return { exec: base.exec / sum, pend: base.pend / sum, fail: base.fail / sum };
}

function gasForExec(mode) {
  return +(mode === "AOT" ? rand(0.0000415, 0.000050) : rand(0.000040, 0.000048)).toFixed(6);
}

// === Reset ===
resetBtn.onclick = () => {
  if (running) return;
  totalExec = totalPend = totalFail = 0;
  totalGasAOT = totalGasJIT = 0;
  cumulative = { JIT: { exec: 0, pend: 0, fail: 0, gas: 0 }, AOT: { exec: 0, pend: 0, fail: 0, gas: 0 } };
  document.querySelectorAll(".exec,.pend,.fail").forEach(el => el.textContent = "0");
  txChart.data.datasets.forEach(ds => ds.data = Array(10).fill(0));
  gasChart.data.datasets.forEach(ds => ds.data = Array(10).fill(0));
  txChart.update(); gasChart.update();
  updateStats();
  document.querySelectorAll(".popup-compare").forEach(p => p.remove());
};

// === Simulation (Fixed Sequential Execution) ===
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

  // Reset temporary accumulators
  const execArr = Array(10).fill(0);
  const pendArr = Array(10).fill(0);
  const failArr = Array(10).fill(0);

  // Run simulation deterministically per Gate (sequentially)
  for (let i = 0; i < 10; i++) {
    await new Promise(resolve => setTimeout(resolve, 250)); // delay between gates

    const tx = perGate[i];
    const e = Math.round(tx * rates.exec);
    const p = Math.round(tx * rates.pend);
    const f = tx - e - p;

    execArr[i] = e;
    pendArr[i] = p;
    failArr[i] = f < 0 ? 0 : f;

    const slot = document.getElementById(`slot-${i + 1}`);
    slot.classList.remove("executed", "pending", "failed");

    slot.querySelector(".exec").textContent = e;
    slot.querySelector(".pend").textContent = p;
    slot.querySelector(".fail").textContent = f;

    // Add visual classes
    if (e > 0) slot.classList.add("executed");
    if (p > 0) slot.classList.add("pending");
    if (f > 0) slot.classList.add("failed");

    // Update charts
    txChart.data.datasets[0].data[i] = e;
    txChart.data.datasets[1].data[i] = p;
    txChart.data.datasets[2].data[i] = f;

    const gasPer = gasForExec(mode);
    const totalGas = +(gasPer * e).toFixed(6);

    if (mode === "AOT") {
      gasChart.data.datasets[0].data[i] += totalGas;
      totalGasAOT += totalGas;
      cumulative.AOT.exec += e;
      cumulative.AOT.pend += p;
      cumulative.AOT.fail += f;
      cumulative.AOT.gas += totalGas;
    } else {
      gasChart.data.datasets[1].data[i] += totalGas;
      totalGasJIT += totalGas;
      cumulative.JIT.exec += e;
      cumulative.JIT.pend += p;
      cumulative.JIT.fail += f;
      cumulative.JIT.gas += totalGas;
    }

    totalExec += e;
    totalPend += p;
    totalFail += f;

    txChart.update();
    gasChart.update();
    updateStats();
  }

  running = false;
  startBtn.disabled = false;
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

// === Compare Popup ===
compareBtn.onclick = () => {
  if (cumulative.JIT.exec === 0 && cumulative.AOT.exec === 0) {
    alert("Chưa có dữ liệu để so sánh — hãy chạy JIT và AOT trước.");
    return;
  }
  document.querySelectorAll(".popup-compare").forEach(p => p.remove());

  const jitFail = cumulative.JIT.fail || 0;
  const aotFail = cumulative.AOT.fail || 0;
  const reduction = jitFail > 0 ? (((jitFail - aotFail) / jitFail) * 100).toFixed(2) : 0;

  const popup = document.createElement("div");
  popup.className = "popup-compare";
  popup.innerHTML = `
    <div class="popup-inner">
      <strong>📊 JIT vs AOT Comparison</strong>
      <canvas id="compareChart"></canvas>
      <p style="margin-top:8px;font-size:14px;color:#22c55e">⚙️ AOT giảm lỗi so với JIT: ${reduction}%</p>
      <p style="margin-top:8px;font-size:13px;color:#333">So sánh hiệu suất từng chế độ (TX riêng). Bấm <b>Reset</b> để làm mới dữ liệu.</p>
      <button class="closePopup">OK</button>
    </div>`;
  document.body.appendChild(popup);

  const ctx = document.getElementById("compareChart").getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Executed", "Pending", "Failed", "Avg Gas (SOL)"],
      datasets: [
        {
          label: "JIT",
          backgroundColor: "#2979ff",
          data: [
            cumulative.JIT.exec,
            cumulative.JIT.pend,
            cumulative.JIT.fail,
            cumulative.JIT.exec ? +(cumulative.JIT.gas / cumulative.JIT.exec).toFixed(6) : 0
          ]
        },
        {
          label: "AOT",
          backgroundColor: "#00c853",
          data: [
            cumulative.AOT.exec,
            cumulative.AOT.pend,
            cumulative.AOT.fail,
            cumulative.AOT.exec ? +(cumulative.AOT.gas / cumulative.AOT.exec).toFixed(6) : 0
          ]
        }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } }, scales: { y: { beginAtZero: true } } }
  });

  popup.querySelector(".closePopup").onclick = () => popup.remove();
};
