// Raiku SlotScope v2.1 — Deterministic Execution Simulation

const SLOT_COUNT = 10;
let slotData = [];
let totalExecuted = 0, totalFailed = 0, totalPending = 0;
let aotGas = 0, jitGas = 0, totalGas = 0;

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

const ctx1 = document.getElementById('txChart').getContext('2d');
const ctx2 = document.getElementById('gasChart').getContext('2d');

function createSlots() {
  slotsWrap.innerHTML = '';
  slotData = [];
  for (let i = 1; i <= SLOT_COUNT; i++) {
    const el = document.createElement('div');
    el.className = 'slot';
    el.id = `slot-${i}`;
    el.innerHTML = `
      <h4>Slot ${i}</h4>
      <div class="dots">
        <div class="dot green"></div>
        <div class="dot yellow"></div>
        <div class="dot red"></div>
      </div>
      <div class="counts">
        <span class="exec"><strong>0</strong></span>
        <span class="pend"><strong>0</strong></span>
        <span class="fail"><strong>0</strong></span>
      </div>`;
    slotsWrap.appendChild(el);
    slotData.push({ exec: 0, pend: 0, fail: 0 });
  }
}
createSlots();

const txChart = new Chart(ctx1, {
  type: 'line',
  data: {
    labels: Array.from({ length: SLOT_COUNT }, (_, i) => `Slot ${i + 1}`),
    datasets: [
      { label: 'Total', data: Array(SLOT_COUNT).fill(0), borderColor: '#111' },
      { label: 'Pending', data: Array(SLOT_COUNT).fill(0), borderColor: '#f59e0b' },
      { label: 'Executed', data: Array(SLOT_COUNT).fill(0), borderColor: '#22c55e' },
      { label: 'Failed', data: Array(SLOT_COUNT).fill(0), borderColor: '#ef4444' },
    ]
  },
  options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
});

const gasChart = new Chart(ctx2, {
  type: 'line',
  data: {
    labels: Array.from({ length: SLOT_COUNT }, (_, i) => `Slot ${i + 1}`),
    datasets: [
      { label: 'AOT Gas', data: Array(SLOT_COUNT).fill(0), borderColor: '#22c55e' },
      { label: 'JIT Gas', data: Array(SLOT_COUNT).fill(0), borderColor: '#3b82f6' },
    ]
  },
  options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
});

const SCENARIOS = {
  normal: { failRate: 0.05, pendRate: 0.03 },
  high: { failRate: 0.1, pendRate: 0.07 },
  congested: { failRate: 0.2, pendRate: 0.15 }
};

function log(msg) {
  const div = document.createElement('div');
  div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logContent.prepend(div);
}

function runSimulationSingle() {
  const txCount = parseInt(txCountInput.value) || 100;
  const isAOT = aotMode.checked;
  const sc = SCENARIOS[scenarioSel.value];

  let roundExec = 0, roundPend = 0, roundFail = 0;
  let roundAotGas = 0, roundJitGas = 0;

  for (let i = 0; i < SLOT_COUNT; i++) {
    let exec = 0, pend = 0, fail = 0;
    const perSlot = Math.floor(txCount / SLOT_COUNT + Math.random() * 3);
    for (let j = 0; j < perSlot; j++) {
      let failP = sc.failRate, pendP = sc.pendRate;
      if (isAOT) { pendP = 0; failP *= 0.25; }
      const r = Math.random();
      if (r < failP) fail++; else if (r < failP + pendP) pend++; else exec++;
    }
    slotData[i].exec += exec;
    slotData[i].pend += pend;
    slotData[i].fail += fail;
    roundExec += exec; roundPend += pend; roundFail += fail;

    const gas = (exec + pend + fail) * 0.0003;
    if (isAOT) roundAotGas += gas * 1.4; else roundJitGas += gas;
  }

  totalExecuted += roundExec;
  totalPending += roundPend;
  totalFailed += roundFail;
  aotGas += roundAotGas;
  jitGas += roundJitGas;
  totalGas += (roundAotGas + roundJitGas);

  updateUI();
  log(`Run done — Mode: ${isAOT ? "AOT" : "JIT"} | Scenario: ${scenarioSel.value}`);
}

function updateUI() {
  slotData.forEach((s, i) => {
    const el = document.getElementById(`slot-${i + 1}`);
    el.querySelector('.exec strong').textContent = s.exec;
    el.querySelector('.pend strong').textContent = s.pend;
    el.querySelector('.fail strong').textContent = s.fail;
  });

  const totalArr = slotData.map(s => s.exec + s.pend + s.fail);
  txChart.data.datasets[0].data = totalArr;
  txChart.data.datasets[1].data = slotData.map(s => s.pend);
  txChart.data.datasets[2].data = slotData.map(s => s.exec);
  txChart.data.datasets[3].data = slotData.map(s => s.fail);
  txChart.update();

  gasChart.data.datasets[0].data = slotData.map(() => aotGas / SLOT_COUNT);
  gasChart.data.datasets[1].data = slotData.map(() => jitGas / SLOT_COUNT);
  gasChart.update();

  executedCountEl.textContent = totalExecuted;
  failedCountEl.textContent = totalFailed;
  pendingCountEl.textContent = totalPending;
  aotGasEl.textContent = aotGas.toFixed(4);
  jitGasEl.textContent = jitGas.toFixed(4);
  totalGasEl.textContent = totalGas.toFixed(4);
}

async function runAutoSequence(times = 1) {
  const auto = autorun.checked;
  let loops = auto ? 5 : times;
  for (let i = 0; i < loops; i++) {
    runSimulationSingle();
    await new Promise(r => setTimeout(r, 250));
  }
  if (auto) {
    const cont = confirm("Auto-run done 5 rounds. Continue?");
    if (!cont) autorun.checked = false;
    else await runAutoSequence(5);
  }
}

startBtn.onclick = () => runAutoSequence(1);
resetBtn.onclick = () => {
  createSlots();
  totalExecuted = totalFailed = totalPending = 0;
  aotGas = jitGas = totalGas = 0;
  updateUI();
  log("Reset complete.");
};
exportCsv.onclick = () => {
  let csv = "Slot,Executed,Pending,Failed\n";
  slotData.forEach((s, i) => (csv += `${i + 1},${s.exec},${s.pend},${s.fail}\n`));
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "raiku-slotscope.csv";
  a.click();
};
