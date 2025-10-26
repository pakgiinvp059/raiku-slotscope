// === Raiku SlotScope v6.6 — Deterministic Execution Simulation ===
// ✅ Độ lệch nhỏ giữa Gate
// ✅ Hiệu ứng Gate đang chạy
// ✅ Popup có giá trị hiển thị

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

// === Khởi tạo Gate ===
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
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "top" } },
      scales: { y: { ticks: { callback: v => parseFloat(v).toFixed(6) } } }
    }
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
  else base = { exec: 0.92, pend: 0.06, fail: 0.02 };

  if (mode === "AOT") {
    base.exec += 0.05;
    base.pend *= 0.4;
    base.fail *= 0.5;
  } else {
    base.exec -= 0.03;
    base.pend *= 1.2;
    base.fail *= 1.3;
  }
  const sum = base.exec + base.pend + base.fail;
  return { exec: base.exec/sum, pend: base.pend/sum, fail: base.fail/sum };
}

function gasForExec(mode) {
  return +(mode === "AOT" ? rand(0.000041, 0.000052) : rand(0.000040, 0.000055)).toFixed(6);
}

// === Reset ===
resetBtn.onclick = () => {
  if (running) return;
  totalExec = totalPend = totalFail = totalGasAOT = totalGasJIT = 0;
  cumulative = { JIT:{exec:0,pend:0,fail:0,gas:0}, AOT:{exec:0,pend:0,fail:0,gas:0} };
  document.querySelectorAll(".exec,.pend,.fail").forEach(el => el.textContent = "0");
  txChart.data.datasets.forEach(ds => ds.data = Array(10).fill(0));
  gasChart.data.datasets.forEach(ds => ds.data = Array(10).fill(0));
  txChart.update(); gasChart.update();
  updateStats();
  document.querySelectorAll(".popup-compare").forEach(p=>p.remove());
};

// === Simulation ===
startBtn.onclick = async () => {
  if (running) return;
  running = true;
  startBtn.disabled = true;

  const mode = document.querySelector('input[name="mode"]:checked').value;
  const scenario = scenarioSelect.value;
  let totalTX = parseInt(txCountInput.value) || 100;
  const rates = determineRates(scenario, mode);
  const perGate = distribute(totalTX, 10);

  totalExec = totalPend = totalFail = 0;

  for (let i = 0; i < 10; i++) {
    const slot = document.getElementById(`slot-${i+1}`);
    slot.classList.add("active");

    await new Promise(r => setTimeout(r, 250));

    const tx = Math.max(1, perGate[i] + randInt(-2, 2));
    let e = Math.round(tx * (rates.exec + rand(-0.02, 0.02)));
    let p = Math.round(tx * (rates.pend + rand(-0.01, 0.01)));
    let f = tx - e - p; if (f < 0) f = 0;

    slot.classList.remove("active", "executed", "pending", "failed");
    slot.querySelector(".exec").textContent = e;
    slot.querySelector(".pend").textContent = p;
    slot.querySelector(".fail").textContent = f;

    if (e>0
