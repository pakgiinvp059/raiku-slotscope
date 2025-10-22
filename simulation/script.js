// Raiku SlotScope — Research Edition (Full)
// Features: full TX run, AOT/JIT, scenarios, chart.js metrics, fee model, export CSV, blueprint animation

const timeline = document.getElementById('timeline');
const log = document.getElementById('log');
const startBtn = document.getElementById('startBtn');
const modeAot = document.getElementById('modeAot');
const scenario = document.getElementById('scenario');
const txCountInput = document.getElementById('txCount');
const exportBtn = document.getElementById('exportBtn');
const metricsDiv = document.getElementById('metrics');
const autorunChk = document.getElementById('autorun');

let slots = [];
let txRecords = [];
let totalFee = 0;

// -------- init & UI ----------
function initSlots(){
  timeline.innerHTML = '';
  slots = [];
  for(let i=1;i<=10;i++){
    const el = document.createElement('div');
    el.className = 'slot';
    el.innerHTML = `<div>Slot<br>${i}</div>`;
    el.id = `slot-${i}`;
    timeline.appendChild(el);
    slots.push({id:i,el,state:'idle',tx:null});
  }
  txRecords = [];
  totalFee = 0;
  log.innerHTML = '🟢 Ready.<br>';
  renderMetrics();
  resetChart();
}

// small helper
function addLog(t){ log.innerHTML = `[${new Date().toLocaleTimeString()}] ${t}<br>` + log.innerHTML; }
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

// -------- metrics & chart (Chart.js) ----------
const ctx = document.getElementById('txChart').getContext('2d');
const txData = { labels: [], datasets: [
  { label:'Total', data: [], borderColor:'#777', fill:false },
  { label:'Pending', data: [], borderColor:'#ffb600', fill:false },
  { label:'Executed', data: [], borderColor:'#22bb55', fill:false },
  { label:'Failed', data: [], borderColor:'#ff4444', fill:false }
]};
const txChart = new Chart(ctx, { type:'line', data: txData, options:{ responsive:true, plugins:{legend:{position:'bottom'}}, scales:{ y:{ beginAtZero:true } } }});
function updateChart(total,pending,executed,failed){
  const step = txData.labels.length + 1;
  txData.labels.push(step);
  txData.datasets[0].data.push(total);
  txData.datasets[1].data.push(pending);
  txData.datasets[2].data.push(executed);
  txData.datasets[3].data.push(failed);
  txChart.update();
}
function resetChart(){ txData.labels=[]; txData.datasets.forEach(d=>d.data=[]); txChart.update(); }

// -------- render metrics ----------
function renderMetrics(){
  const executed = txRecords.filter(t=>t.status==='executed').length;
  const failed = txRecords.filter(t=>t.status==='failed').length;
  const pending = txRecords.filter(t=>t.status==='pending').length;
  const total = txRecords.length;
  metricsDiv.innerHTML = `
    <div class="metric"><div class="value">${total}</div><div class="label">Total TX</div></div>
    <div class="metric"><div class="value">${pending}</div><div class="label">Pending</div></div>
    <div class="metric"><div class="value">${executed}</div><div class="label">Executed</div></div>
    <div class="metric"><div class="value">${failed}</div><div class="label">Failed</div></div>
    <div class="metric"><div class="value">${totalFee.toFixed(6)}</div><div class="label">Total Fee (SOL)</div></div>
  `;
  updateChart(total,pending,executed,failed);
}

// -------- economic helpers ----------
function calcFee(sc){
  if(sc==='normal') return 0.00012 + Math.random()*0.00008;
  if(sc==='congestion') return 0.0004 + Math.random()*0.0006;
  if(sc==='highfee') return 0.001 + Math.random()*0.0015;
  return 0.0001;
}
function calcDelay(sc){
  if(sc==='normal') return 160 + Math.random()*160;
  if(sc==='congestion') return 360 + Math.random()*560;
  if(sc==='highfee') return 200 + Math.random()*280;
  return 180;
}
function failProb(sc){
  if(sc==='normal') return 0.06;
  if(sc==='congestion') return 0.28;
  if(sc==='highfee') return 0.03;
  return 0.1;
}

// -------- simulation core ----------
async function simulate(){
  const count = Math.max(1, Math.min(50, Number(txCountInput.value || 10)));
  const sc = scenario.value;
  addLog(`Starting simulation: mode=${modeAot.checked?'AOT':'JIT'}, scenario=${sc}, count=${count}`);
  // prepare txs
  const txs = Array.from({length:count}, (_,i)=>({id:i+1, prefer: (modeAot.checked ? ((i % slots.length) + 1) : null), fee:0, status:'pending'}));
  // AOT flow: try reserve slots first (round-robin)
  if(modeAot.checked){
    // reserve phase
    for(const tx of txs){
      const slotId = tx.prefer;
      const s = slots.find(x=>x.id===slotId && x.state==='idle');
      if(s){
        s.state='reserved';
        s.tx = tx.id;
        s.el.classList.add('reserved');
        tx.fee = calcFee(sc);
        tx.status='reserved';
        txRecords.push({id:tx.id, slot:s.id, status:'reserved', fee:tx.fee, time:new Date().toISOString()});
        addLog(`TX ${tx.id} reserved slot ${s.id} (fee ${tx.fee.toFixed(6)} SOL)`);
        renderMetrics();
        await sleep(120);
      } else {
        // couldn't reserve (already reserved by earlier tx) -> pending queue
        tx.status='pending';
        txRecords.push({id:tx.id, slot:null, status:'pending', fee:0, time:new Date().toISOString()});
        addLog(`TX ${tx.id} failed to reserve (no idle slot)`);
      }
    }
    // execution phase: execute reserved slots in slot order
    for(const s of slots){
      await sleep(220);
      if(s.state==='reserved'){
        await executeTx(s.tx, s.id, sc);
      }
    }
    // any pending txs attempt fill leftover idle slots
    for(const tx of txs.filter(t=>t.status==='pending')){
      await sleep(160);
      const idle = slots.find(x=>x.state==='idle');
      if(idle){
        tx.fee = calcFee(sc);
        txRecords.push({id:tx.id, slot:idle.id, status:'pending', fee:tx.fee, time:new Date().toISOString()});
        addLog(`TX ${tx.id} assigned to slot ${idle.id} (fallback)`);
        await sleep(180);
        const success = Math.random() > failProb(sc);
        if(success) await executeTx(tx.id, idle.id, sc);
        else {
          addLog(`TX ${tx.id} failed at fallback slot ${idle.id}`);
          txRecords.push({id:tx.id, slot:idle.id, status:'failed', fee:tx.fee, time:new Date().toISOString()});
        }
        renderMetrics();
      } else {
        addLog(`TX ${tx.id} dropped: no slot available`);
        txRecords.push({id:tx.id, slot:null, status:'failed', fee:0, time:new Date().toISOString()});
        renderMetrics();
      }
    }
  } else {
    // JIT flow: sequential submission, occupy next idle slot
    for(const tx of txs){
      await sleep(120);
      const idle = slots.find(x=>x.state==='idle');
      if(idle){
        idle.state='pending';
        idle.tx = tx.id;
        idle.el.style.border = '2px dashed #ffa1d0';
        tx.fee = calcFee(sc);
        tx.status='pending';
        txRecords.push({id:tx.id, slot:idle.id, status:'pending', fee:tx.fee, time:new Date().toISOString()});
        addLog(`TX ${tx.id} submitted -> slot ${idle.id} (fee ${tx.fee.toFixed(6)} SOL)`);
        renderMetrics();
        await sleep(calcDelay(sc));
        const success = Math.random() > failProb(sc);
        if(success) await executeTx(tx.id, idle.id, sc);
        else {
          // fail and free slot
          idle.state='idle';
          idle.tx = null;
          idle.el.classList.remove('reserved','executed');
          idle.el.classList.add('failed');
          addLog(`TX ${tx.id} failed at slot ${idle.id}`);
          txRecords.push({id:tx.id, slot:idle.id, status:'failed', fee:tx.fee, time:new Date().toISOString()});
          renderMetrics();
          await sleep(90);
          idle.el.classList.remove('failed');
        }
      } else {
        addLog(`TX ${tx.id} dropped: no free slot`);
        txRecords.push({id:tx.id, slot:null, status:'failed', fee:0, time:new Date().toISOString()});
        renderMetrics();
      }
    }
  }

  addLog(`✅ Simulation complete. Executed: ${txRecords.filter(t=>t.status==='executed').length}/${txs.length}`);
  renderMetrics();
}

// execute helper
async function executeTx(txId, slotId, sc){
  const s = slots.find(x=>x.id===slotId);
  if(!s) return;
  s.state='executed';
  s.tx = txId;
  s.el.classList.remove('reserved');
  s.el.classList.remove('failed');
  s.el.classList.add('executed');
  // update record or append
  const fee = calcFee(sc);
  totalFee += (txRecords.find(r=>r.id===txId)?.fee) || fee;
  // mark existing record
  const recIdx = txRecords.findIndex(r=>r.id===txId);
  if(recIdx>=0) txRecords[recIdx] = {...txRecords[recIdx], status:'executed', fee: txRecords[recIdx].fee || fee, time:new Date().toISOString()};
  else txRecords.push({id:txId, slot:slotId, status:'executed', fee:fee, time:new Date().toISOString()});
  addLog(`TX ${txId} executed in slot ${slotId} (fee ${ (txRecords.find(r=>r.id===txId)?.fee || fee).toFixed(6)} SOL)`);
  renderMetrics();
  await sleep(80);
}

// -------- export CSV ----------
function exportCSV(){
  if(txRecords.length===0){ alert('No TX records'); return; }
  const header = 'id,slot,status,fee,time\n';
  const rows = txRecords.map(r => `${r.id},${r.slot||''},${r.status},${(r.fee||0).toFixed(6)},${r.time}`).join('\n');
  const csv = header + rows;
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'raiku-slotscope-data.csv'; a.click();
  URL.revokeObjectURL(url);
}

// -------- blueprint animation ----------
function animateBlueprint(){
  const steps = document.querySelectorAll('#blueprint .step');
  let i = 0;
  if(!steps || steps.length===0) return;
  const loop = setInterval(()=>{
    steps.forEach(s=>s.style.background='white');
    steps.forEach(s=>s.style.boxShadow='0 4px 10px rgba(0,0,0,0.03)');
    steps[i%steps.length].style.background='#e6f6ff';
    steps[i%steps.length].style.boxShadow='0 10px 20px rgba(0,120,255,0.12)';
    i++;
    if(i>steps.length*3){ clearInterval(loop); setTimeout(animateBlueprint, 3000); }
  }, 450);
}

// -------- events ----------
startBtn.addEventListener('click', async ()=>{
  initSlots();
  await simulate();
});
exportBtn.addEventListener('click', exportCSV);
window.addEventListener('load', ()=>{
  initSlots();
  animateBlueprint();
  if(autorunChk && autorunChk.checked) startBtn.click();
});
