// script.js - Raiku SlotScope simulation
const SLOT_COUNT = 10;
let perSlot = [];
let cumulative = { total: 0, exec: 0, fail: 0, pend: 0, gasAOT: 0, gasJIT: 0 };
let autoRunCounter = 0;
let autoRunMax = 5;

// DOM
const slotsRow = document.getElementById('slotsRow');
const startBtn = document.getElementById('startBtn');
const aotChk = document.getElementById('aotChk');
const jitChk = document.getElementById('jitChk');
const txCountInput = document.getElementById('txCount');
const resetBtn = document.getElementById('resetBtn');
const exportBtn = document.getElementById('exportBtn');
const scenarioSel = document.getElementById('scenario');
const autorunChk = document.getElementById('autorun');

const executedCnt = document.getElementById('executedCnt').querySelector('strong');
const failedCnt = document.getElementById('failedCnt').querySelector('strong');
const pendingCnt = document.getElementById('pendingCnt').querySelector('strong');
const aotGasEl = document.getElementById('aotGas').querySelector('strong');
const jitGasEl = document.getElementById('jitGas').querySelector('strong');
const totalGasEl = document.getElementById('totalGas').querySelector('strong');

let txChart, gasChart;

function initSlots(){
  perSlot = [];
  slotsRow.innerHTML = '';
  for(let i=0;i<SLOT_COUNT;i++){
    perSlot.push({exec:0, pend:0, fail:0, gasAOT:0, gasJIT:0});
    const div = document.createElement('div');
    div.className = 'slot';
    div.id = `slot-${i+1}`;
    div.innerHTML = `<div class="title">Slot ${i+1}</div><div class="dots"><span id="g-${i}" class="dot green"></span><span id="y-${i}" class="dot yellow"></span><span id="r-${i}" class="dot red"></span></div><div style="margin-top:8px;font-size:13px;color:var(--muted)"><span id="n-${i}">0</span></div>`;
    slotsRow.appendChild(div);
  }
}

function updateSlotUI(){
  for(let i=0;i<SLOT_COUNT;i++){
    document.getElementById(`n-${i}`).textContent = `${perSlot[i].exec}`;
    // color intensity: adjust dot opacity by proportion
    const total = perSlot[i].exec + perSlot[i].pend + perSlot[i].fail || 1;
    document.getElementById(`g-${i}`).style.opacity = (perSlot[i].exec/total) || 0.15;
    document.getElementById(`y-${i}`).style.opacity = (perSlot[i].pend/total) || 0.15;
    document.getElementById(`r-${i}`).style.opacity = (perSlot[i].fail/total) || 0.15;
  }
}

function updateSummaryUI(){
  executedCnt.textContent = cumulative.exec;
  failedCnt.textContent = cumulative.fail;
  pendingCnt.textContent = cumulative.pend;
  aotGasEl.textContent = cumulative.gasAOT.toFixed(4);
  jitGasEl.textContent = cumulative.gasJIT.toFixed(4);
  totalGasEl.textContent = (cumulative.gasAOT + cumulative.gasJIT).toFixed(4);
}

function createCharts(){
  const txCtx = document.getElementById('txChart');
  const gasCtx = document.getElementById('gasChart');

  const labels = Array.from({length:SLOT_COUNT}, (_,i)=>`Slot ${i+1}`);

  txChart = new Chart(txCtx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label:'Total', data: Array(SLOT_COUNT).fill(0), borderColor:'#111827', backgroundColor:'#111827', tension:0.3, pointRadius:4 },
        { label:'Pending', data: Array(SLOT_COUNT).fill(0), borderColor:'#f59e0b', backgroundColor:'#f59e0b', tension:0.3, pointRadius:3 },
        { label:'Executed', data: Array(SLOT_COUNT).fill(0), borderColor:'#10b981', backgroundColor:'#10b981', tension:0.3, pointRadius:3 },
        { label:'Failed', data: Array(SLOT_COUNT).fill(0), borderColor:'#ef4444', backgroundColor:'#ef4444', tension:0.3, pointRadius:3 }
      ]
    },
    options: {
      responsive:true,
      maintainAspectRatio:false,
      scales:{ x:{grid:{display:false}}, y:{beginAtZero:true, ticks:{stepSize:2}} }
    }
  });

  gasChart = new Chart(gasCtx, {
    type:'bar',
    data: {
      labels,
      datasets:[
        { label:'AOT Gas', data:Array(SLOT_COUNT).fill(0), backgroundColor:'#10b981' },
        { label:'JIT Gas', data:Array(SLOT_COUNT).fill(0), backgroundColor:'#3b82f6' }
      ]
    },
    options: { responsive:true, maintainAspectRatio:false, scales:{y:{beginAtZero:true}} }
  });
}

function updateCharts(){
  const totalData = perSlot.map(s => s.exec + s.pend + s.fail);
  const pendData = perSlot.map(s => s.pend);
  const execData = perSlot.map(s => s.exec);
  const failData = perSlot.map(s => s.fail);
  txChart.data.datasets[0].data = totalData;
  txChart.data.datasets[1].data = pendData;
  txChart.data.datasets[2].data = execData;
  txChart.data.datasets[3].data = failData;
  txChart.update();

  gasChart.data.datasets[0].data = perSlot.map(s => s.gasAOT);
  gasChart.data.datasets[1].data = perSlot.map(s => s.gasJIT);
  gasChart.update();
}

function simulateRun(){
  const txCount = Math.max(1, parseInt(txCountInput.value)||100);
  const scenario = scenarioSel.value;
  const isAOT = aotChk.checked;
  const isJIT = jitChk.checked;

  // scenario factors: affect pending/fail rates and gas multipliers
  let basePending = 0.02, baseFail = 0.01, gasAOTmult = 0.0015, gasJITmult = 0.0008;
  if(scenario === 'high'){ basePending = 0.06; baseFail = 0.03; gasAOTmult = 0.0020; }
  if(scenario === 'congested'){ basePending = 0.12; baseFail = 0.08; gasAOTmult = 0.0025; gasJITmult = 0.0012; }

  // AOT lowers pending/fail but costs more gas
  if(isAOT){ basePending *= 0.25; baseFail *= 0.3; gasAOTmult *= 3; }

  // Distribute txCount randomly across slots with slight unevenness
  let remaining = txCount;
  for(let i=0;i<SLOT_COUNT;i++){
    let assign = Math.floor(txCount / SLOT_COUNT);
    // Random jitter
    const jitter = Math.round((Math.random()-0.5) * (txCount*0.06));
    assign = Math.max(0, assign + jitter);
    if(i === SLOT_COUNT-1) assign = remaining;
    else remaining -= assign;

    // For each assigned TX decide outcome
    for(let t=0;t<assign;t++){
      // dynamic pending probability: increases slightly if many assigned to this slot
      const slotLoadFactor = Math.min(1, assign / Math.max(1, txCount / SLOT_COUNT));
      const pPending = Math.min(0.9, basePending + slotLoadFactor * 0.08 * (scenario==='congested'?1.5:1));
      const pFail = Math.min(0.9, baseFail + slotLoadFactor * 0.05);

      const r = Math.random();
      if(r < pFail){
        perSlot[i].fail++;
        cumulative.fail++;
      } else if(r < pFail + pPending){
        perSlot[i].pend++;
        cumulative.pend++;
      } else {
        perSlot[i].exec++;
        cumulative.exec++;
      }

      // gas consumption
      if(isAOT){
        const g = gasAOTmult * (1 + Math.random()*0.4);
        perSlot[i].gasAOT += g; cumulative.gasAOT += g;
      } else {
        const g = gasJITmult * (1 + Math.random()*0.6);
        perSlot[i].gasJIT += g; cumulative.gasJIT += g;
      }

      cumulative.total++;
    }
  }

  updateSlotUI();
  updateCharts();
  updateSummaryUI();
}

function resetAll(){
  perSlot = Array.from({length:SLOT_COUNT},()=>({exec:0,pend:0,fail:0,gasAOT:0,gasJIT:0}));
  cumulative = { total:0, exec:0, fail:0, pend:0, gasAOT:0, gasJIT:0 };
  autoRunCounter = 0;
  initSlots();
  updateCharts();
  updateSummaryUI();
  updateSlotUI();
}

startBtn.addEventListener('click', async () => {
  // single run
  simulateRun();

  // Auto-run logic: if autorun checked, run 5 times then ask
  if(autorunChk.checked){
    autoRunCounter = 1;
    while(autoRunCounter < autoRunMax){
      await new Promise(r => setTimeout(r, 350)); // small delay for UI
      simulateRun();
      autoRunCounter++;
    }
    // ask user
    const cont = confirm(`Auto-run completed ${autoRunMax} runs. Continue auto-run?`);
    if(cont){
      autoRunCounter = 0; // allow further autorun
      if(autorunChk.checked) startBtn.click();
    } else {
      // turn off autorun
      autorunChk.checked = false;
    }
  }
});

resetBtn.addEventListener('click', () => {
  if(confirm('Reset all counters and charts?')){
    resetAll();
  }
});

exportBtn.addEventListener('click', () => {
  let csv = 'Slot,Executed,Pending,Failed,AOT_Gas,JIT_Gas\n';
  perSlot.forEach((s,i)=> csv += `${i+1},${s.exec},${s.pend},${s.fail},${s.gasAOT.toFixed(6)},${s.gasJIT.toFixed(6)}\n`);
  const blob = new Blob([csv],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'slotscope.csv'; a.click();
  URL.revokeObjectURL(url);
});

// init
initSlots();
createCharts();
updateCharts();
updateSlotUI();
updateSummaryUI();
