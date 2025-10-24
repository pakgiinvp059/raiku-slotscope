// === script.js — fixed cumulative TX + isolated gas update ===

const slotsContainer = document.getElementById('slots');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const compareBtn = document.getElementById('compareBtn');
const txCountInput = document.getElementById('txCount');
const scenarioSelect = document.getElementById('scenario');

let txChart, gasChart, compareChart;

// Totals
let totalExec = 0, totalPend = 0, totalFail = 0;
let totalGasAOT = 0, totalGasJIT = 0;
let runCount = 0;
let modeData = { JIT: [], AOT: [] };

// --- Slots ---
for (let i = 1; i <= 10; i++) {
  const s = document.createElement('div');
  s.className = 'slot';
  s.id = `slot-${i}`;
  s.innerHTML = `
    <b>Slot ${i}</b>
    <div class="dots">
      <div class="dot green"></div>
      <div class="dot yellow"></div>
      <div class="dot red"></div>
    </div>
    <div class="slot-values">
      <span class="exec">0</span> / <span class="pend">0</span> / <span class="fail">0</span>
    </div>`;
  slotsContainer.appendChild(s);
}

// --- Charts ---
function initCharts() {
  const txCtx = document.getElementById('txChart').getContext('2d');
  txChart = new Chart(txCtx, {
    type: 'bar',
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Slot ${i + 1}`),
      datasets: [
        { label: 'Executed', backgroundColor: '#22c55e', data: Array(10).fill(0) },
        { label: 'Pending', backgroundColor: '#facc15', data: Array(10).fill(0) },
        { label: 'Failed', backgroundColor: '#ef4444', data: Array(10).fill(0) }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: { y: { beginAtZero: true } }
    }
  });

  const gasCtx = document.getElementById('gasChart').getContext('2d');
  gasChart = new Chart(gasCtx, {
    type: 'bar',
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Slot ${i + 1}`),
      datasets: [
        { label: 'AOT Gas', backgroundColor: '#00c853', data: Array(10).fill(0) },
        { label: 'JIT Gas', backgroundColor: '#2979ff', data: Array(10).fill(0) }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          ticks: { callback: (val) => val.toFixed(6) }
        }
      }
    }
  });
}
initCharts();

// --- Utilities ---
function formatGas(n) { return Number(n).toFixed(6); }
function randomGas() { return +(0.00003 + Math.random() * 0.00003).toFixed(6); }

function getScenarioRates(level) {
  if (level === 'HighFee') return { exec: 0.85, pend: 0.10, fail: 0.05 };
  if (level === 'Congested') return { exec: 0.70, pend: 0.22, fail: 0.08 };
  return { exec: 0.92, pend: 0.06, fail: 0.02 };
}

function updateTotals() {
  document.getElementById('executedVal').textContent = totalExec;
  document.getElementById('failedVal').textContent = totalFail;
  document.getElementById('pendingVal').textContent = totalPend;
  document.getElementById('jitGasVal').textContent = formatGas(totalGasJIT);
  document.getElementById('aotGasVal').textContent = formatGas(totalGasAOT);
  document.getElementById('totalGasVal').textContent = formatGas(totalGasAOT + totalGasJIT);
}

// --- Simulation ---
async function runSimulation(mode, totalTX, scenario) {
  const perSlot = Math.floor(totalTX / 10);
  const remainder = totalTX % 10;
  const baseRates = getScenarioRates(scenario);

  for (let i = 0; i < 10; i++) {
    const base = perSlot + (i < remainder ? 1 : 0);
    const rate = { ...baseRates };
    if (mode === 'AOT') {
      rate.exec += 0.05;
      rate.pend -= 0.03;
      rate.fail -= 0.02;
    }

    const exec = Math.round(base * rate.exec);
    const pend = Math.round(base * rate.pend);
    const fail = base - exec - pend;

    // Simulate delay for pending → executed/failed
    const slot = document.getElementById(`slot-${i + 1}`);
    slot.querySelector('.pend').textContent = pend;
    slot.querySelector('.exec').textContent = 0;
    slot.querySelector('.fail').textContent = 0;

    await new Promise(r => setTimeout(r, 250));

    // Live animation (random delay per slot)
    for (let j = 0; j < exec + fail; j++) {
      await new Promise(r => setTimeout(r, 20 + Math.random() * 30));
      if (j < exec) {
        slot.querySelector('.exec').textContent = parseInt(slot.querySelector('.exec').textContent) + 1;
      } else {
        slot.querySelector('.fail').textContent = parseInt(slot.querySelector('.fail').textContent) + 1;
      }
      slot.querySelector('.pend').textContent = Math.max(0, pend - j - 1);
    }

    // Cộng dồn toàn cục
    totalExec += exec;
    totalPend += pend;
    totalFail += fail;

    // Chỉ cộng gas cho mode đang chạy
    const gasUsed = Array.from({ length: base }, randomGas).reduce((a, b) => a + b, 0);
    if (mode === 'AOT') totalGasAOT += gasUsed;
    else totalGasJIT += gasUsed;

    // Update biểu đồ: cộng dồn (+=)
    txChart.data.datasets[0].data[i] += exec;
    txChart.data.datasets[1].data[i] += pend;
    txChart.data.datasets[2].data[i] += fail;

    if (mode === 'AOT') gasChart.data.datasets[0].data[i] += gasUsed;
    if (mode === 'JIT') gasChart.data.datasets[1].data[i] += gasUsed;

    txChart.update();
    gasChart.update();
    updateTotals();
  }

  modeData[mode].push({ exec: totalExec, pend: totalPend, fail: totalFail, gas: mode === 'AOT' ? totalGasAOT : totalGasJIT });
}

// --- Handlers ---
startBtn.addEventListener('click', () => {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const scenario = scenarioSelect.value;
  const totalTX = parseInt(txCountInput.value) || 100;
  runSimulation(mode, totalTX, scenario);
});

resetBtn.addEventListener('click', () => {
  totalExec = totalPend = totalFail = 0;
  totalGasAOT = totalGasJIT = 0;
  runCount = 0;
  modeData = { JIT: [], AOT: [] };

  for (let i = 1; i <= 10; i++) {
    txChart.data.datasets.forEach(ds => ds.data[i - 1] = 0);
    gasChart.data.datasets.forEach(ds => ds.data[i - 1] = 0);
    document.getElementById(`slot-${i}`).querySelectorAll('.exec,.pend,.fail').forEach(e => e.textContent = 0);
  }

  txChart.update();
  gasChart.update();
  updateTotals();
});

compareBtn.addEventListener('click', () => {
  if (compareChart) compareChart.destroy();

  const ctx = document.createElement('canvas');
  ctx.id = 'compareChart';
  document.querySelector('.stats').after(ctx);

  const avg = (arr, key) => arr.length ? arr.reduce((a, b) => a + b[key], 0) / arr.length : 0;
  const j = modeData.JIT, a = modeData.AOT;

  const avgJ = { exec: avg(j, 'exec'), pend: avg(j, 'pend'), fail: avg(j, 'fail'), gas: avg(j, 'gas') };
  const avgA = { exec: avg(a, 'exec'), pend: avg(a, 'pend'), fail: avg(a, 'fail'), gas: avg(a, 'gas') };

  compareChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Executed', 'Pending', 'Failed', 'Gas'],
      datasets: [
        { label: 'JIT', backgroundColor: '#2979ff', data: [avgJ.exec, avgJ.pend, avgJ.fail, avgJ.gas] },
        { label: 'AOT', backgroundColor: '#00c853', data: [avgA.exec, avgA.pend, avgA.fail, avgA.gas] }
      ]
    },
    options: { responsive: true, plugins: { legend: { position: 'top' } } }
  });
});
