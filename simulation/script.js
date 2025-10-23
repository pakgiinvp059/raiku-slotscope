// Raiku SlotScope — Final Simulation Script

const SLOT_COUNT = 10;
const startBtn = document.getElementById('startBtn');
const aotMode = document.getElementById('aotMode');
const scenarioSel = document.getElementById('scenario');
const txCountInput = document.getElementById('txCount');
const autorun = document.getElementById('autorun');
const exportCsv = document.getElementById('exportCsv');
const resetBtn = document.getElementById('resetBtn');
const slotsWrap = document.getElementById('slotsWrap');
const executedCountEl = document.getElementById('executedCount');
const failedCountEl = document.getElementById('failedCount');
const pendingCountEl = document.getElementById('pendingCount');
const aotGasEl = document.getElementById('aotGas');
const jitGasEl = document.getElementById('jitGas');
const totalGasEl = document.getElementById('totalGas');
const logContent = document.getElementById('logContent');

const txCanvas = document.getElementById('txChart').getContext('2d');
const gasCanvas = document.getElementById('gasChart').getContext('2d');

let slotData = [];
let totals = { executed: 0, failed: 0, pending: 0 };
let gasTotals = { aot: 0, jit: 0 };

function createSlots() {
  slotsWrap.innerHTML = '';
  slotData = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    const el = document.createElement('div');
    el.className = 'slot';
    el.innerHTML = `
      <h4>Slot ${i + 1}</h4>
      <div class="dots">
        <div class="dot green"></div>
        <div class="dot yellow"></div>
        <div class="dot red"></div>
      </div>
      <div class="counts">
        <span class="exec">0</span>
        <span class="pend">0</span>
        <span class="fail">0</span>
      </div>`;
    slotsWrap.appendChild(el);
    slotData.push({ exec: 0, pend: 0, fail: 0, aotGas: 0, jitGas: 0 });
  }
}
createSlots();

const txChart = new Chart(txCanvas, {
  type: 'line',
  data: {
    labels: Array.from({ length: SLOT_COUNT }, (_, i) => `Slot ${i + 1}`),
    datasets: [
      { label: 'Total', data: Array(SLOT_COUNT).fill(0), borderColor: '#111827', tension: 0.2, fill: false, pointRadius: 3 },
      { label: 'Pending', data: Array(SLOT_COUNT).fill(0), borderColor: '#f59e0b', tension: 0.2, fill: false, pointRadius: 3 },
      { label: 'Executed', data: Array(SLOT_COUNT).fill(0), borderColor: '#16a34a', tension: 0.2, fill: false, pointRadius: 3 },
      { label: 'Failed', data: Array(SLOT_COUNT).fill(0), borderColor: '#ef4444', tension: 0.2, fill: false, pointRadius: 3 }
    ]
  },
  options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } }
});

const gasChart = new Chart(gasCanvas, {
  type: 'bar',
  data: {
    labels: Array.from({ length: SLOT_COUNT }, (_, i) => `Slot ${i + 1}`),
    datasets: [
      { label: 'AOT Gas', data: Array(SLOT_COUNT).fill(0), backgroundColor: '#16a34a' },
      { label: 'JIT Gas', data: Array(SLOT_COUNT).fill(0), backgroundColor: '#2563eb' }
    ]
  },
  options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } }
});

const SCENARIOS = {
  normal: { failRate: 0.03, pendRate: 0.02 },
  high: { failRate: 0.07, pendRate: 0.05 },
  congested: { failRate: 0.18, pendRate: 0.12 }
};

function log(msg) {
  const d = document.createElement('div');
  d.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logContent.prepend(d);
}

function updateUI() {
  slotData.forEach((s, i) => {
    const el = slotsWrap.children[i];
    el.querySelector('.exec').textContent = s.exec;
    el.querySelector('.pend').textContent = s.pend;
    el.querySelector('.fail').textContent = s.fail;
  });

  txChart.data.datasets[0].data = slotData.map(s => s.exec + s.pend + s.fail);
  txChart.data.datasets[1].data = slotData.map(s => s.pend);
  txChart.data.datasets[2].data = slotData.map(s => s.exec);
  txChart.data.datasets[3].data = slotData.map(s => s.fail);
  txChart.update();

  gasChart.data.datasets[0].data = slotData.map(s => s.aotGas.toFixed(6));
  gasChart.data.datasets[1].data = slotData.map(s => s.jitGas.toFixed(6));
  gasChart.update();

  executedCountEl.textContent = totals.executed;
  failedCountEl.textContent = totals.failed;
  pendingCountEl.textContent = totals.pending;
  aotGasEl.textContent = gasTotals.aot.toFixed(6);
  jitGasEl.textContent = gasTotals.jit.toFixed(6);
  totalGasEl.textContent = (gasTotals.aot + gasTotals.jit).toFixed(6);
}

function runSimulationRound() {
  const txCount = parseInt(txCountInput.value) || 100;
  const isAOT = aotMode.checked;
  const sc = SCENARIOS[scenarioSel.value];
  let roundExec = 0, roundPend = 0, roundFail = 0, roundAotGas = 0, roundJitGas = 0;

  const base = Math.floor(txCount / SLOT_COUNT);
  let remain = txCount - base * SLOT_COUNT;

  for (let i = 0; i < SLOT_COUNT; i++) {
    const perSlot = base + (remain-- > 0 ?
