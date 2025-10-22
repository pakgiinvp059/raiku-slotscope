// Raiku SlotScope — Refined Research Edition (Compact Chart + Reset Counters + Clear Analysis)

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
let simulationActive = false;

let ctx, txChart, txData;

// --------- HELPER ---------
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function addLog(t){log.innerHTML=`[${new Date().toLocaleTimeString()}] ${t}<br>`+log.innerHTML;}

// --------- INIT UI ---------
function initSlots(){
  timeline.innerHTML='';
  slots=[];
  for(let i=1;i<=10;i++){
    const el=document.createElement('div');
    el.className='slot idle';
    el.innerHTML=`
      <div class="label">Slot ${i}</div>
      <div class="counter">
        <div class="stats">
          <div class="badge exec" id="slot-${i}-exec">0</div>
          <div class="badge pending" id="slot-${i}-pend">0</div>
          <div class="badge fail" id="slot-${i}-fail">0</div>
        </div>
      </div>`;
    el.id=`slot-${i}`;
    timeline.appendChild(el);
    slots.push({id:i,el,state:'idle',tx:null,counts:{exec:0,pending:0,fail:0}});
  }
  txRecords=[];
  totalFee=0;
  log.innerHTML='🟢 Ready.<br>';
  renderMetrics();
  resetChart();
  resetBlueprint();
}

// --------- CHART INIT ---------
function initChart(){
  const canvas=document.getElementById('txChart');
  if(!canvas)return;
  ctx=canvas.getContext('2d');
  txData={
    labels:[],
    datasets:[
      {label:'Total TX',data:[],borderColor:'#444',backgroundColor:'#444',fill:false,tension:0.25},
      {label:'Pending TX',data:[],borderColor:'#ffb600',backgroundColor:'#ffb600',fill:false,tension:0.25},
      {label:'Executed TX',data:[],borderColor:'#22bb55',backgroundColor:'#22bb55',fill:false,tension:0.25},
      {label:'Failed TX',data:[],borderColor:'#ff4444',backgroundColor:'#ff4444',fill:false,tension:0.25}
    ]
  };
  txChart=new Chart(ctx,{
    type:'line',
    data:txData,
    options:{
      responsive:true,
      plugins:{legend:{position:'bottom'}},
      layout:{padding:{top:10,bottom:10,left:10,right:10}},
      scales:{
        y:{beginAtZero:true,title:{display:true,text:'Number of Transactions'}},
        x:{title:{display:true,text:'Simulation Step'}}
      }
    }
  });
}
function resetChart(){
  if(!txData||!txChart)return;
  txData.labels=[];
  txData.datasets.forEach(d=>d.data=[]);
  txChart.update();
}
function updateChart(total,pending,executed,failed){
  if(!txChart)return;
  const step=txData.labels.length+1;
  txData.labels.push(step);
  txData.datasets[0].data.push(total);
  txData.datasets[1].data.push(pending);
  txData.datasets[2].data.push(executed);
  txData.datasets[3].data.push(failed);
  txChart.update();
}

// --------- ECONOMIC LOGIC ---------
function calcFee(sc){
  if(sc==='normal')return 0.00012+Math.random()*0.00008;
  if(sc==='congestion')return 0.0004+Math.random()*0.0006;
  if(sc==='highfee')return 0.001+Math.random()*0.0015;
  return 0.0001;
}
function calcDelay(sc){
  if(sc==='normal')return 100+Math.random()*120;
  if(sc==='congestion')return 280+Math.random()*500;
  if(sc==='highfee')return 180+Math.random()*260;
  return 160;
}
function failProb(sc){
  if(sc==='normal')return 0.05;
  if(sc==='congestion')return 0.25;
  if(sc==='highfee')return 0.02;
  return 0.1;
}

// --------- METRICS ---------
function renderMetrics(){
  const executed=txRecords.filter(t=>t.status==='executed').length;
  const failed=txRecords.filter(t=>t.status==='failed').length;
  const pending=txRecords.filter(t=>t.status==='pending').length;
  const total=txRecords.length;
  metricsDiv.innerHTML=`
    <div class="metric"><div class="value">${total}</div><div class="label">Total TX</div></div>
    <div class="metric"><div class="value">${pending}</div><div class="label">Pending</div></div>
    <div class="metric"><div class="value">${executed}</div><div class="label">Executed</div></div>
    <div class="metric"><div class="value">${failed}</div><div class="label">Failed</div></div>
    <div class="metric"><div class="value">${totalFee.toFixed(6)}</div><div class="label">Total Fee (SOL)</div></div>`;
  updateChart(total,pending,executed,failed);
}

// --------- SLOT VISUALS ---------
function setSlotState(slotObj,state){
  slotObj.el.classList.remove('idle','pending','reserved','executed','failed');
  slotObj.el.classList.add(state);
  slotObj.state=state;
}
function incSlotCounter(slotId,type){
  const s=slots.find(x=>x.id===slotId);
  if(!s)return;
  s.counts[type]++;
  document.getElementById(`slot-${slotId}-exec`).textContent=s.counts.exec;
  document.getElementById(`slot-${slotId}-pend`).textContent=s.counts.pending;
  document.getElementById(`slot-${slotId}-fail`).textContent=s.counts.fail;
}

// --------- SIMULATION CORE ---------
async function simulate(){
  if(simulationActive)return;
  simulationActive=true;
  const count=Math.max(1,Math.min(200,Number(txCountInput.value||10)));
  const sc=scenario.value;
  addLog(`Starting simulation: ${modeAot.checked?'AOT':'JIT'}, scenario=${sc}, count=${count}`);
  slots.forEach(s=>{
    s.counts={exec:0,pending:0,fail:0};
    document.getElementById(`slot-${s.id}-exec`).textContent='0';
    document.getElementById(`slot-${s.id}-pend`).textContent='0';
    document.getElementById(`slot-${s.id}-fail`).textContent='0';
    setSlotState(s,'idle');
  });
  txRecords=[];
  totalFee=0;
  renderMetrics();

  const txs=Array.from({length:count},(_,i)=>({id:i+1,prefer:modeAot.checked?((i%slots.length)+1):null,fee:0,status:'pending'}));

  if(modeAot.checked){
    for(const tx of txs){
      const slotId=tx.prefer;
      const s=slots.find(x=>x.id===slotId && x.state==='idle');
      if(s){
        setSlotState(s,'reserved');
        s.tx=tx.id;
        tx.fee=calcFee(sc);
        tx.status='reserved';
        txRecords.push({id:tx.id,slot:s.id,status:'reserved',fee:tx.fee,time:new Date().toISOString()});
        incSlotCounter(s.id,'pending');
        addLog(`TX ${tx.id} reserved slot ${s.id}`);
      }
      renderMetrics(); await sleep(70);
    }
    for(const s of slots){
      await sleep(120);
      if(s.state==='reserved'){
        const success=Math.random()>failProb(sc);
        if(success)await executeTx(s.tx,s.id,sc);
        else await failTx(s.tx,s.id,sc);
      }
    }
  }else{
    for(const tx of txs){
      const idle=slots.find(x=>x.state==='idle');
      if(idle){
        setSlotState(idle,'pending');
        incSlotCounter(idle.id,'pending');
        tx.fee=calcFee(sc);
        tx.status='pending';
        txRecords.push({id:tx.id,slot:idle.id,status:'pending',fee:tx.fee,time:new Date().toISOString()});
        addLog(`TX ${tx.id} → slot ${idle.id}`);
        renderMetrics();
        await sleep(calcDelay(sc));
        const success=Math.random()>failProb(sc);
        if(success)await executeTx(tx.id,idle.id,sc);
        else await failTx(tx.id,idle.id,sc);
      }
    }
  }
  addLog(`✅ Simulation complete.`);
  simulationActive=false;
}

// --------- EXECUTION ----------
async function executeTx(txId,slotId,sc){
  const s=slots.find(x=>x.id===slotId);
  if(!s)return;
  setSlotState(s,'executed');
  incSlotCounter(slotId,'exec');
  totalFee+=calcFee(sc);
  txRecords.push({id:txId,slot:slotId,status:'executed',fee:calcFee(sc),time:new Date().toISOString()});
  addLog(`TX ${txId} ✅ executed in slot ${slotId}`);
  renderMetrics();
  await sleep(100);
  setSlotState(s,'idle');
}
async function failTx(txId,slotId,sc){
  const s=slots.find(x=>x.id===slotId);
  if(!s)return;
  setSlotState(s,'failed');
  incSlotCounter(slotId,'fail');
  txRecords.push({id:txId,slot:slotId,status:'failed',fee:0,time:new Date().toISOString()});
  addLog(`TX ${txId} ❌ failed in slot ${slotId}`);
  renderMetrics();
  await sleep(120);
  setSlotState(s,'idle');
}

// --------- RESET COUNTERS ----------
function resetAllCounters(){
  slots.forEach(s=>{
    s.counts={exec:0,pending:0,fail:0};
    document.getElementById(`slot-${s.id}-exec`).textContent='0';
    document.getElementById(`slot-${s.id}-pend`).textContent='0';
    document.getElementById(`slot-${s.id}-fail`).textContent='0';
    setSlotState(s,'idle');
  });
  txRecords=[];
  totalFee=0;
  resetChart();
  renderMetrics();
  log.innerHTML='🔄 Counters reset.<br>'+log.innerHTML;
}

// --------- BLUEPRINT ----------
function resetBlueprint(){
  document.querySelectorAll('#blueprint .step').forEach(s=>{
    s.style.background='white';
    s.style.boxShadow='0 3px 8px rgba(0,0,0,0.05)';
  });
}
function highlightStep(i){
  resetBlueprint();
  const steps=document.querySelectorAll('#blueprint .step');
  if(steps[i]){
    steps[i].style.background='#e7f5ff';
    steps[i].style.boxShadow='0 10px 20px rgba(0,120,255,0.12)';
  }
}
async function stepThroughBlueprint(){
  const steps=document.querySelectorAll('#blueprint .step');
  for(let i=0;i<steps.length;i++){highlightStep(i);await sleep(450);}
  resetBlueprint();
}

// --------- EVENTS ----------
startBtn.addEventListener('click',async()=>{initSlots();resetChart();await simulate();});
exportBtn.insertAdjacentHTML('afterend','<button id="resetBtn" class="btn-outline">🔄 Reset Counters</button>');
document.getElementById('resetBtn').addEventListener('click',resetAllCounters);
exportBtn.addEventListener('click',()=>{
  if(txRecords.length===0){alert('No TX records');return;}
  const header='id,slot,status,fee,time\n';
  const rows=txRecords.map(r=>`${r.id},${r.slot||''},${r.status},${(r.fee||0).toFixed(6)},${r.time}`).join('\n');
  const blob=new Blob([header+rows],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='raiku-slotscope-data.csv';
  a.click();
});

window.addEventListener('load',()=>{
  initSlots();initChart();
  if(autorunChk&&autorunChk.checked)startBtn.click();
  stepThroughBlueprint();
});
