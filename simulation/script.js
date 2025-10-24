// script.js — TX chart as line + compare modal popup
const slotsContainer = document.getElementById('slots');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const compareBtn = document.getElementById('compareBtn');
const txCountInput = document.getElementById('txCount');
const scenarioSelect = document.getElementById('scenario');

let txChart, gasChart, compareChart;
let modal = null;

// totals
let totalExec = 0, totalPend = 0, totalFail = 0;
let totalGasAOT = 0, totalGasJIT = 0;
let modeData = { JIT: [], AOT: [] };

// --- create 10 slots ---
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

// --- charts ---
function initCharts() {
  const txCtx = document.getElementById('txChart').getContext('2d');
  txChart = new Chart(txCtx, {
    type: 'line',
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Slot ${i + 1}`),
      datasets: [
        { label: 'Executed', borderColor: '#22c55e', data: Array(10).fill(0), tension: 0.3 },
        { label: 'Pending', borderColor: '#facc15', data: Array(10).fill(0), tension: 0.3 },
        { label: 'Failed', borderColor: '#ef4444', data: Array(10).fill(0), tension: 0.3 }
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
      plugins: { legend: { position: 'top' } },
      scales: { y: { ticks: { callback: v => Number(v).toFixed(6) } } }
    }
  });
}
initCharts();

// --- utils ---
function rndGas() { return +(0.00003 + Math.random() * 0.00003).toFixed(6); }
function partition(total) {
  const per = Math.floor(total / 10);
  const rem = total % 10;
  return Array.from({ length: 10 }, (_, i) => per + (i < rem ? 1 : 0));
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function formatGas(n) { return Number(n).toFixed(6); }
function updateTotals() {
  document.getElementById('executedVal').textContent = totalExec;
  document.getElementById('failedVal').textContent = totalFail;
  document.getElementById('pendingVal').textContent = totalPend;
  document.getElementById('jitGasVal').textContent = formatGas(totalGasJIT);
  document.getElementById('aotGasVal').textContent = formatGas(totalGasAOT);
  document.getElementById('totalGasVal').textContent = formatGas(totalGasAOT + totalGasJIT);
}

// --- scenario ---
function scenarioRates(s) {
  if (s === 'HighFee') return { exec: 0.85, pend: 0.10, fail: 0.05 };
  if (s === 'Congested') return { exec: 0.7, pend: 0.22, fail: 0.08 };
  return { exec: 0.92, pend: 0.06, fail: 0.02 };
}

// --- main simulation ---
function runSimulation(mode, totalTX, scenario) {
  const slots = partition(totalTX);
  const rates = scenarioRates(scenario);
  const adj = mode === 'AOT' ? { exec: +0.05, pend: -0.03, fail: -0.02 } : { exec: 0, pend: 0, fail: 0 };
  const runSummary = { exec: 0, pend: 0, fail: 0, gasAOT: 0, gasJIT: 0 };

  slots.forEach((base, i) => {
    let execP = rates.exec + adj.exec;
    let pendP = rates.pend + adj.pend;
    let failP = 1 - execP - pendP;
    const s = execP + pendP + failP;
    execP /= s; pendP /= s; failP /= s;
    if (pendP < failP) { pendP += 0.02; execP -= 0.02; }

    const execT = Math.round(base * execP);
    const pendT = Math.round(base * pendP);
    const failT = base - execT - pendT;

    totalPend += pendT;
    runSummary.pend += pendT;
    txChart.data.datasets[1].data[i] += pendT;
    document.getElementById(`slot-${i + 1}`).querySelector('.pend').textContent = pendT;

    const conv = [...Array(execT).fill('E'), ...Array(failT).fill('F')];
    shuffle(conv);
    conv.forEach((o, j) => {
      setTimeout(() => {
        const el = document.getElementById(`slot-${i + 1}`);
        const p = Math.max(0, parseInt(el.querySelector('.pend').textContent) - 1);
        el.querySelector('.pend').textContent = p;

        if (o === 'E') {
          const ex = parseInt(el.querySelector('.exec').textContent) + 1;
          el.querySelector('.exec').textContent = ex;
          totalExec++;
          runSummary.exec++;
          const g = rndGas();
          if (mode === 'AOT') { totalGasAOT += g; runSummary.gasAOT += g; gasChart.data.datasets[0].data[i] += g; }
          else { totalGasJIT += g; runSummary.gasJIT += g; gasChart.data.datasets[1].data[i] += g; }
          txChart.data.datasets[0].data[i] += 1;
          txChart.data.datasets[1].data[i] = Math.max(0, txChart.data.datasets[1].data[i] - 1);
        } else {
          const f = parseInt(el.querySelector('.fail').textContent) + 1;
          el.querySelector('.fail').textContent = f;
          totalFail++;
          runSummary.fail++;
          txChart.data.datasets[2].data[i] += 1;
          txChart.data.datasets[1].data[i] = Math.max(0, txChart.data.datasets[1].data[i] - 1);
        }

        txChart.update();
        gasChart.update();
        updateTotals();
      }, j * (20 + Math.random() * 30));
    });
  });

  modeData[mode].push(runSummary);
  txChart.update();
  gasChart.update();
  updateTotals();
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

// --- compare modal ---
compareBtn.onclick = () => {
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close-btn">&times;</span>
      <h3>Compare JIT vs AOT</h3>
      <canvas id="compareChart"></canvas>
      <div class="compare-info" id="compareInfo"></div>
    </div>`;
  document.body.appendChild(modal);

  modal.querySelector('.close-btn').onclick = () => modal.remove();

  const j = modeData.JIT, a = modeData.AOT;
  const avg = (arr, key) => arr.length ? arr.reduce((x, y) => x + y[key], 0) / arr.length : 0;
  const avgJ = { exec: avg(j, 'exec'), pend: avg(j, 'pend'), fail: avg(j, 'fail'), gas: avg(j, 'gasJIT') || 0 };
  const avgA = { exec: avg(a, 'exec'), pend: avg(a, 'pend'), fail: avg(a, 'fail'), gas: avg(a, 'gasAOT') || 0 };

  const ctx = modal.querySelector('#compareChart').getContext('2d');
  compareChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Executed', 'Pending', 'Failed', 'Gas (SOL)'],
      datasets: [
        { label: 'JIT', backgroundColor: '#2979ff', data: [avgJ.exec, avgJ.pend, avgJ.fail, avgJ.gas] },
        { label: 'AOT', backgroundColor: '#00c853', data: [avgA.exec, avgA.pend, avgA.fail, avgA.gas] }
      ]
    },
    options: { responsive: true, plugins: { legend: { position: 'top' } } }
  });

  const pendImprove = avgJ.pend ? ((avgJ.pend - avgA.pend) / avgJ.pend * 100).toFixed(1) : 0;
  const failImprove = avgJ.fail ? ((avgJ.fail - avgA.fail) / avgJ.fail * 100).toFixed(1) : 0;
  const gasInc = avgJ.gas ? ((avgA.gas - avgJ.gas) / avgJ.gas * 100).toFixed(1) : 0;

  modal.querySelector('#compareInfo').innerHTML = `
    <p>💡 <b>AOT</b> reduces Pending by <b>${pendImprove}%</b> and Failed by <b>${failImprove}%</b> vs JIT.</p>
    <p>⚙️ Gas AOT increases ~<b>${gasInc}%</b> for higher stability.</p>
  `;
};
