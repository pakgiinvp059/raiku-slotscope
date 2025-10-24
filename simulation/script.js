// script.js — realistic TX distribution and live pending
const slotsContainer = document.getElementById('slots');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const compareBtn = document.getElementById('compareBtn');
const txCountInput = document.getElementById('txCount');
const scenarioSelect = document.getElementById('scenario');

let txChart, gasChart, compareChart;
let popup = null;

// totals
let totalExec = 0, totalPend = 0, totalFail = 0;
let totalGasAOT = 0, totalGasJIT = 0;
let modeData = { JIT: [], AOT: [] };

// --- create slots ---
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

// --- init charts ---
function initCharts() {
  const txCtx = document.getElementById('txChart').getContext('2d');
  txChart = new Chart(txCtx, {
    type: 'line',
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Slot ${i + 1}`),
      datasets: [
        { label: 'Executed', borderColor: '#22c55e', backgroundColor: '#22c55e22', data: Array(10).fill(0), tension: 0.35 },
        { label: 'Pending', borderColor: '#facc15', backgroundColor: '#facc1522', data: Array(10).fill(0), tension: 0.35 },
        { label: 'Failed', borderColor: '#ef4444', backgroundColor: '#ef444422', data: Array(10).fill(0), tension: 0.35 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: { y: { beginAtZero: true } },
      animation: { duration: 400, easing: 'easeOutQuad' }
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
      plugins: { legend: { position: 'top' } },
      scales: { y: { ticks: { callback: v => Number(v).toFixed(6) } } }
    }
  });
}
initCharts();

// --- utils ---
function randomGas() {
  return +(0.00004 + Math.random() * 0.00002).toFixed(6);
}
function formatGas(n) { return Number(n).toFixed(6); }
function randomBetween(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}
function updateTotals() {
  document.getElementById('executedVal').textContent = totalExec;
  document.getElementById('failedVal').textContent = totalFail;
  document.getElementById('pendingVal').textContent = totalPend;
  document.getElementById('jitGasVal').textContent = formatGas(totalGasJIT);
  document.getElementById('aotGasVal').textContent = formatGas(totalGasAOT);
  document.getElementById('totalGasVal').textContent = formatGas(totalGasAOT + totalGasJIT);
}

// --- scenario logic ---
function getRates(scenario) {
  if (scenario === 'HighFee') return { exec: 0.88, pend: 0.09, fail: 0.03 };
  if (scenario === 'Congested') return { exec: 0.75, pend: 0.18, fail: 0.07 };
  return { exec: 0.93, pend: 0.05, fail: 0.02 }; // normal
}

// --- main simulation ---
function runSimulation(mode, totalTX, scenario) {
  const { exec, pend, fail } = getRates(scenario);
  const slotTX = Array.from({ length: 10 }, () => randomBetween(8, 12));
  const totalSum = slotTX.reduce((a, b) => a + b, 0);
  const scale = totalTX / totalSum;

  slotTX.forEach((base, i) => {
    const txSlot = Math.round(base * scale);
    const execCount = Math.round(txSlot * exec);
    const pendCount = Math.round(txSlot * pend);
    const failCount = txSlot - execCount - pendCount;

    const slot = document.getElementById(`slot-${i + 1}`);
    slot.querySelector('.exec').textContent = 0;
    slot.querySelector('.pend').textContent = pendCount;
    slot.querySelector('.fail').textContent = 0;

    txChart.data.datasets[0].data[i] = 0;
    txChart.data.datasets[1].data[i] = pendCount;
    txChart.data.datasets[2].data[i] = 0;

    totalPend += pendCount;
    updateTotals();

    const sequence = [
      ...Array(execCount).fill('E'),
      ...Array(failCount).fill('F')
    ].sort(() => Math.random() - 0.5);

    sequence.forEach((status, j) => {
      setTimeout(() => {
        const p = Math.max(0, parseInt(slot.querySelector('.pend').textContent) - 1);
        slot.querySelector('.pend').textContent = p;

        if (status === 'E') {
          const e = parseInt(slot.querySelector('.exec').textContent) + 1;
          slot.querySelector('.exec').textContent = e;
          totalExec++;
          const g = randomGas();
          if (mode === 'AOT') {
            gasChart.data.datasets[0].data[i] += g;
            totalGasAOT += g;
          } else {
            gasChart.data.datasets[1].data[i] += g;
            totalGasJIT += g;
          }
          txChart.data.datasets[0].data[i]++;
        } else {
          const f = parseInt(slot.querySelector('.fail').textContent) + 1;
          slot.querySelector('.fail').textContent = f;
          totalFail++;
          txChart.data.datasets[2].data[i]++;
        }

        txChart.data.datasets[1].data[i] = Math.max(0, txChart.data.datasets[1].data[i] - 1);
        txChart.update();
        gasChart.update();
        updateTotals();
      }, j * randomBetween(40, 90));
    });
  });
}

// --- buttons ---
startBtn.onclick = () => {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const scenario = scenarioSelect.value;
  const totalTX = parseInt(txCountInput.value) || 100;
  runSimulation(mode, totalTX, scenario);
};

resetBtn.onclick = () => {
  totalExec = totalPend = totalFail = 0;
  totalGasAOT = totalGasJIT = 0;
  modeData = { JIT: [], AOT: [] };
  for (let i = 1; i <= 10; i++) {
    const el = document.getElementById(`slot-${i}`);
    el.querySelectorAll('.exec,.pend,.fail').forEach(x => x.textContent = 0);
  }
  txChart.data.datasets.forEach(ds => ds.data = Array(10).fill(0));
  gasChart.data.datasets.forEach(ds => ds.data = Array(10).fill(0));
  txChart.update();
  gasChart.update();
  updateTotals();
};
