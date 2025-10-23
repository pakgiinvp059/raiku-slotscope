// Raiku SlotScope - final copyable script
let slots = [];
let txChart;
const slotCount = 10;

const elStart = document.getElementById("startBtn");
const elReset = document.getElementById("resetBtn");
const elExport = document.getElementById("exportBtn");
const elAot = document.getElementById("modeAot");
const elScenario = document.getElementById("scenario");
const elTxCount = document.getElementById("txCount");
const elAuto = document.getElementById("autorun");

const mExec = document.getElementById("m-exec");
const mFail = document.getElementById("m-fail");
const mPend = document.getElementById("m-pend");
const mGas = document.getElementById("m-gas");
const mAotGas = document.getElementById("m-aotgas");
const logBox = document.getElementById("log");
const aotInfo = document.getElementById("aotInfo");

function addLog(text){
  const time = new Date().toLocaleTimeString();
  logBox.innerHTML = `[${time}] ${text}<br>` + logBox.innerHTML;
}

// Initialize slot DOM and state
function initSlots(){
  const container = document.getElementById("timeline");
  container.innerHTML = "";
  slots = [];
  for(let i=1;i<=slotCount;i++){
    const el = document.createElement("div");
    el.className = "slot-tile";
    el.id = `slot-${i}`;
    el.innerHTML = `<div class="label">Slot ${i}</div>
      <div class="slot-counters">
        <div class="counter exec">Exec: <span id="slot-${i}-exec">0</span></div>
        <div class="counter pend">Pend: <span id="slot-${i}-pend">0</span></div>
        <div class="counter fail">Fail: <span id="slot-${i}-fail">0</span></div>
      </div>`;
    container.appendChild(el);
    slots.push({ id:i, el, exec:0, pend:0, fail:0, base:0 });
  }
}

// Setup Chart.js
function initChart(){
  const ctx = document.getElementById("txChart").getContext("2d");
  const labels = Array.from({length:slotCount}, (_,i) => `Slot ${i+1}`);
  txChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label:'Total', borderColor:'#333', data:[], pointRadius:3, borderWidth:2, tension:0.3 },
        { label:'Executed', borderColor:'#22bb55', data:[], pointRadius:3, borderWidth:2, tension:0.3 },
        { label:'Pending', borderColor:'#ffb600', data:[], pointRadius:3, borderWidth:2, tension:0.3 },
        { label:'Failed', borderColor:'#ff4444', data:[], pointRadius:3, borderWidth:2, tension:0.3 }
      ]
    },
    options: {
      responsive:true,
      maintainAspectRatio:true,
      aspectRatio:1.6,
      plugins:{legend:{display:false}},
      scales:{
        x:{ title:{display:true, text:'Slot (1–10)'}},
        y:{ beginAtZero:true, ticks:{precision:0}, title:{display:true, text:'Transaction Count'} }
      }
    }
  });
}

// Utility: random distribution of tx across slots (sum = txCount)
function distributeTx(total){
  const base = Math.floor(total/slotCount);
  // generate variability array
  const arr = new Array(slotCount).fill(base);
  let remaining = total - base*slotCount;
  // distribute remaining randomly +/-1..3
  while(remaining>0){
    const idx = Math.floor(Math.random()*slotCount);
    arr[idx] += 1;
    remaining--;
  }
  // also randomly vary neighboring slots (small)
  for(let i=0;i<slotCount;i++){
    const delta = Math.floor(Math.random()*3) - 1; // -1,0,1
    arr[i] = Math.max(0, arr[i] + delta);
  }
  // re-normalize to total
  let sum = arr.reduce((a,b)=>a+b,0);
  while(sum !== total){
    if(sum < total){
      arr[Math.floor(Math.random()*slotCount)]++;
      sum++;
    } else {
      const idx = Math.floor(Math.random()*slotCount);
      if(arr[idx]>0){ arr[idx]--; sum--; }
    }
  }
  return arr;
}

// Simulate function
async function simulate(){
  const txCount = Math.max(10, Number(elTxCount.value) || 100);
  const isAOT = elAot.checked;
  const scenario = elScenario.value;

  // UI
  elStart.disabled = true;
  addLog(`🔄 Starting simulation: mode=${isAOT?'AOT':'JIT'}, scenario=${scenario}, totalTX=${txCount}`);

  // reset chart data
  txChart.data.datasets.forEach(ds => ds.data = []);
  let totalExec=0, totalFail=0, totalPend=0;
  let totalGas=0, aotGas=0;

  // compute per-slot distribution
  const distribution = distributeTx(txCount);

  for(let i=0;i<slotCount;i++){
    const s = slots[i];
    const slotNum = i+1;
    s.exec = 0; s.fail = 0; s.pend = 0;
    s.base = distribution[i];

    // active highlight
    s.el.classList.add('active');

    // each TX in slot:
    for(let t=0;t<s.base;t++){
      const r = Math.random();
      // scenario rules:
      if(isAOT){
        // AOT deterministically executes (low fail), but simulate small fail chance
        if(Math.random() < 0.01) { s.fail++; }
        else { s.exec++; }
      } else {
        if(scenario === 'normal'){
          if(r < 0.78) s.exec++;
          else if(r < 0.92) s.fail++;
          else s.pend++;
        } else if(scenario === 'highfee'){
          // high fee: more executed less failed
          if(r < 0.85) s.exec++;
          else if(r < 0.95) s.fail++;
          else s.pend++;
        } else if(scenario === 'congestion'){
          // congestion: pending appears randomly (bigger chance)
          if(r < 0.60) s.exec++;
          else if(r < 0.75) s.fail++;
          else s.pend++;
        }
      }
    }

    // simulate pending retries if any (JIT only): retry pending -> some succeed, some fail
    if(!isAOT && s.pend>0){
      // retry some fraction
      const toRetry = Math.floor(s.pend * (0.4 + Math.random()*0.6)); // 40-100%
      let resolved=0, resolvedFail=0;
      for(let r=0;r<toRetry;r++){
        const rr = Math.random();
        if(rr < 0.7) { s.exec++; resolved++; }
        else { s.fail++; resolvedFail++; }
      }
      s.pend = Math.max(0, s.pend - toRetry);
      addLog(`Slot ${slotNum}: pending ${toRetry} retried -> ${resolved} exec, ${resolvedFail} fail`);
    }

    // update totals
    totalExec += s.exec;
    totalFail += s.fail;
    totalPend += s.pend;

    // gas: per tx base * factor (AOT higher)
    const gasPerTx = isAOT ? 0.00025 : 0.00018; // example values
    const gasSlot = (s.exec + s.fail + s.pend) * gasPerTx;
    totalGas += gasSlot;
    if(isAOT) aotGas += gasSlot * 1.2;

    // update DOM counters
    document.getElementById(`slot-${slotNum}-exec`).textContent = s.exec;
    document.getElementById(`slot-${slotNum}-pend`).textContent = s.pend;
    document.getElementById(`slot-${slotNum}-fail`).textContent = s.fail;

    // push to chart
    txChart.data.datasets[0].data.push(s.base);
    txChart.data.datasets[1].data.push(s.exec);
    txChart.data.datasets[2].data.push(s.pend);
    txChart.data.datasets[3].data.push(s.fail);
    txChart.update();

    // small delay for animation feel
    await new Promise(res => setTimeout(res, 160 + Math.random()*240));
    s.el.classList.remove('active');
  }

  // update summary
  mExec.textContent = totalExec;
  mFail.textContent = totalFail;
  mPend.textContent = totalPend;
  mGas.textContent = totalGas.toFixed(5);
  mAotGas.textContent = aotGas.toFixed(5);

  addLog(`✅ Done — Exec:${totalExec} Fail:${totalFail} Pend:${totalPend} Gas:${totalGas.toFixed(5)} SOL`);

  // re-enable start
  elStart.disabled = false;
}

// Export CSV: per-slot counters + totals
function exportCSV(){
  const header = ['slot','base','exec','pend','fail'];
  const rows = [header.join(',')];
  for(let s of slots){
    rows.push([s.id,s.base||0,s.exec||0,s.pend||0,s.fail||0].join(','));
  }
  rows.push(['TOTAL','','',mExec.textContent,mFail.textContent].join(','));
  rows.push(['GAS','','',mGas.textContent,mAotGas.textContent].join(','));
  const csv = rows.join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `raiku_slotscope_${Date.now()}.csv`; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 2000);
  addLog('📥 Exported CSV');
}

// Reset function
function resetAll(){
  initSlots();
  if(txChart) txChart.destroy();
  initChart();
  mExec.textContent = '0';
  mFail.textContent = '0';
  mPend.textContent = '0';
  mGas.textContent = '0.00000';
  mAotGas.textContent = '0.00000';
  logBox.innerHTML = '';
  addLog('🔄 Reset completed');
}

// UI wiring
elStart.addEventListener('click', simulate);
elReset.addEventListener('click', resetAll);
elExport.addEventListener('click', exportCSV);

elAot.addEventListener('change', ()=>{
  aotInfo.textContent = elAot.checked ? 'AOT mode ON — gas cost increases, pending minimized' : '';
});

// autorun
window.addEventListener('load', ()=>{
  initSlots();
  initChart();
  if(elAuto.checked) elStart.click();
});
