// script.js - Raiku SlotScope simulation
// Author: assistant (adapted for pakgiinvp059)

const SLOT_COUNT = 10;

const startBtn = document.getElementById('startBtn');
const aotMode = document.getElementById('aotMode');
const scenarioSel = document.getElementById('scenario');
const txCountInput = document.getElementById('txCount');
const autorun = document.getElementById('autorun');
const exportCsv = document.getElementById('exportCsv');
const resetBtn = document.getElementById('resetBtn');
const slotsWrap = document.getElementById('slotsWrap');
const logContent = document.getElementById('logContent');

const aotGasEl = document.getElementById('aotGas');
const totalGasEl = document.getElementById('totalGas');
const executedCountEl = document.getElementById('executedCount');
const failedCountEl = document.getElementById('failedCount');
const pendingCountEl = document.getElementById('pendingCount');

let slotData = []; // [{exec, pend, fail}]
let totalExecuted = 0, totalFailed = 0, totalPending = 0;
let totalGas = 0, aotGas = 0;

// create slot DOMs
function createSlots(){
  slotsWrap.innerHTML = '';
  slotData = [];
  for(let i=1;i<=SLOT_COUNT;i++){
    const el = document.createElement('div');
    el.className = 'slot';
    el.id = `slot-${i}`;
    el.innerHTML = `
      <h4>Slot ${i}</h4>
      <div class="dots">
        <div class="dot green" title="Executed"></div>
        <div class="dot yellow" title="Pending"></div>
        <div class="dot red" title="Failed"></div>
      </div>
      <div class="counts">
        <span class="exec">Exec:<br><strong>0</strong></span>
        <span class="pend">Pend:<br><strong>0</strong></span>
        <span class="fail">Fail:<br><strong>0</strong></span>
      </div>`;
    slotsWrap.appendChild(el);
    slotData.push({exec:0, pend:0, fail:0});
  }
}
createSlots();

// Chart.js setup
const ctx = document.getElementById('txChart').getContext('2d');
let txChart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: Array.from({length:SLOT_COUNT},(_,i)=>`Slot ${i+1}`),
    datasets: [
      {label:'Total', data: Array(SLOT_COUNT).fill(0), borderColor:'#111827', backgroundColor:'#111827', pointRadius:3},
      {label:'Pending', data: Array(SLOT_COUNT).fill(0), borderColor:'#f59e0b', backgroundColor:'#f59e0b', pointRadius:3},
      {label:'Executed', data: Array(SLOT_COUNT).fill(0), borderColor:'#10b981', backgroundColor:'#10b981', pointRadius:3},
      {label:'Failed', data: Array(SLOT_COUNT).fill(0), borderColor:'#ef4444', backgroundColor:'#ef4444', pointRadius:3}
    ]
  },
  options: {
    responsive:true,
    maintainAspectRatio:false,
    scales:{
      x:{ticks:{autoSkip:false}},
      y:{beginAtZero:true, ticks:{stepSize:1}}
    },
    plugins:{legend:{display:false}}
  }
});

function log(msg){
  const time = new Date().toLocaleTimeString();
  const p = document.createElement('div');
  p.textContent = `[${time}] ${msg}`;
  logContent.prepend(p);
}

// Scenario parameters (probabilities)
const SCENARIOS = {
  normal: {failRate:0.05, pendRate:0.05, extraLoad:0},
  high: {failRate:0.12, pendRate:0.12, extraLoad:0.2},
  congested: {failRate:0.28, pendRate:0.30, extraLoad:0.5}
};

// run one simulation
function runSimulationSingle(){
  // reset per-run counters
  totalExecuted = 0; totalFailed = 0; totalPending = 0;
  totalGas = 0; aotGas = 0;
  slotData = slotData.map(()=>({exec:0, pend:0, fail:0}));

  const txCount = Math.max(1, parseInt(txCountInput.value)||100);
  const modeAot = aotMode.checked;
  const scenario = scenarioSel.value;
  const params = SCENARIOS[scenario];

  // distribute TX to slots randomly (not equal) to simulate real network variability
  // Use weighted random: slots get random counts summing to txCount
  // We'll use simple stochastic allocation
  let remaining = txCount;
  const baseAlloc = Math.floor(txCount / SLOT_COUNT);
  // first fill with baseAlloc then distribute remainder randomly
  for(let i=0;i<SLOT_COUNT;i++){
    slotData[i].alloc = baseAlloc;
  }
  let rem = txCount - baseAlloc * SLOT_COUNT;
  while(rem>0){
    const idx = Math.floor(Math.random()*SLOT_COUNT);
    slotData[idx].alloc = (slotData[idx].alloc||0) + 1;
    rem--;
  }

  // simulate each TX outcome per slot
  for(let i=0;i<SLOT_COUNT;i++){
    const alloc = slotData[i].alloc||0;
    let exec=0, pend=0, fail=0;
    for(let t=0;t<alloc;t++){
      // dynamic probabilities
      let failP = params.failRate;
      let pendP = params.pendRate;
      // High load increases pending/fail slightly (random)
      if(Math.random() < params.extraLoad) { failP *= 1.3; pendP *= 1.4; }
      if(modeAot){
        // AOT reduces pending to 0 and reduces fail drastically but increases gas
        pendP = 0;
        failP = Math.max(0.001, failP * 0.15);
      }
      // Random outcome
      const r = Math.random();
      if(r < failP){
        fail++;
      } else if(r < failP + pendP){
        pend++;
      } else {
        exec++;
      }
    }
    slotData[i].exec = exec;
    slotData[i].pend = pend;
    slotData[i].fail = fail;

    totalExecuted += exec;
    totalFailed += fail;
    totalPending += pend;

    // gas estimation: base per tx + AOT premium for exec
    const gasPerTx = modeAot ? 0.00045 : 0.00030; // mock numbers
    const slotGas = (exec+pend+fail) * gasPerTx;
    totalGas += slotGas;
    if(modeAot) aotGas += slotGas * 0.35; // mock fraction attributed to AOT
  }

  // update UI
  updateSlotsUI();
  updateChart();
  updateSummary();
  log(`Run complete: Mode=${modeAot? 'AOT': 'JIT'}, Scenario=${scenario}, TX=${txCount}. Exec=${totalExecuted} Fail=${totalFailed} Pend=${totalPending}`);
}

// update slot DOMs
function updateSlotsUI(){
  for(let i=0;i<SLOT_COUNT;i++){
    const el = document.getElementById(`slot-${i+1}`);
    el.querySelector('.exec strong').textContent = slotData[i].exec;
    el.querySelector('.pend strong').textContent = slotData[i].pend;
    el.querySelector('.fail strong').textContent = slotData[i].fail;
  }
}

// update chart
function updateChart(){
  const totalArr = [], pendArr=[], execArr=[], failArr=[];
  for(let i=0;i<SLOT_COUNT;i++){
    const s = slotData[i];
    totalArr.push(s.exec + s.pend + s.fail);
    pendArr.push(s.pend);
    execArr.push(s.exec);
    failArr.push(s.fail);
  }

  txChart.data.datasets[0].data = totalArr;
  txChart.data.datasets[1].data = pendArr;
  txChart.data.datasets[2].data = execArr;
  txChart.data.datasets[3].data = failArr;

  // autoscale y max to nearest integer + margin
  const maxVal = Math.max(...totalArr, 1);
  txChart.options.scales.y.max = Math.ceil(maxVal * 1.2);
  txChart.update();
}

// update summary numbers
function updateSummary(){
  aotGasEl.textContent = aotGas.toFixed(4);
  totalGasEl.textContent = totalGas.toFixed(4);
  executedCountEl.textContent = totalExecuted;
  failedCountEl.textContent = totalFailed;
  pendingCountEl.textContent = totalPending;
}


// export CSV
exportCsv.addEventListener('click', ()=>{
  let csv = 'Slot,Executed,Pending,Failed,Total\n';
  for(let i=0;i<SLOT_COUNT;i++){
    const s = slotData[i];
    csv += `${i+1},${s.exec},${s.pend},${s.fail},${s.exec+s.pend+s.fail}\n`;
  }
  csv += `,,Executed,${totalExecuted},\n`;
  csv += `,,Failed,${totalFailed},\n`;
  csv += `,,Pending,${totalPending},\n`;
  const blob = new Blob([csv],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'raiku-slotscope-summary.csv';
  a.click();
  URL.revokeObjectURL(url);
});

// reset
resetBtn.addEventListener('click', ()=>{
  createSlots();
  txChart.data.datasets.forEach(ds => ds.data = Array(SLOT_COUNT).fill(0));
  txChart.update();
  logContent.innerHTML = '';
  totalExecuted = totalFailed = totalPending = 0;
  totalGas = aotGas = 0;
  updateSummary();
});

// start / autorun behavior
startBtn.addEventListener('click', async ()=>{
  await runAutoSequence(1); // single run when clicked
});

// run sequence with auto logic (n times then prompt)
async function runAutoSequence(requestedRuns=1){
  const shouldAuto = autorun.checked;
  let runs = requestedRuns;
  if(shouldAuto){
    runs = 5; // default auto-run 5 times
  }
  for(let i=0;i<runs;i++){
    runSimulationSingle();
    // small delay for visualization (optional)
    await new Promise(r=>setTimeout(r, 350));
  }

  if(shouldAuto){
    // after 5 runs ask user
    const cont = confirm('Auto-run completed 5 runs. Continue auto-run?');
    if(!cont){
      autorun.checked = false; // turn off auto
      log('Auto-run turned off by user.');
      return;
    } else {
      // continue another 5 runs (recursive)
      await runAutoSequence(5);
    }
  }
}

// auto-run on load
window.addEventListener('load', ()=>{
  createSlots();
  // small safety: if autorun is checked in UI, start
  if(autorun.checked){
    setTimeout(()=>startBtn.click(), 700);
  }
});
