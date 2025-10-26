// === Raiku SlotScope — Final Stable Natural Simulation (Raiku Deterministic Engine v4.0) ===

const slotsContainer = document.getElementById("slots");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const compareBtn = document.getElementById("compareBtn");
const txCountInput = document.getElementById("txCount");
const scenarioSelect = document.getElementById("scenario");

let txChart, gasChart;
let totalExec = 0, totalPend = 0, totalFail = 0;
let totalGasAOT = 0, totalGasJIT = 0;
let cumulative = { JIT: { exec:0, pend:0, fail:0, gas:0 }, AOT: { exec:0, pend:0, fail:0, gas:0 } };
let running = false;

// session accumulators
let sessionExec = Array(10).fill(0);
let sessionPend = Array(10).fill(0);
let sessionFail = Array(10).fill(0);
let sessionGasAOT = Array(10).fill(0);
let sessionGasJIT = Array(10).fill(0);

// === Create Slots ===
for (let i=1; i<=10; i++){
  const slot = document.createElement("div");
  slot.className = "slot";
  slot.id = `slot-${i}`;
  slot.innerHTML = `
    <b>Gate ${i}</b>
    <div class="dots"><div class="dot green"></div><div class="dot yellow"></div><div class="dot red"></div></div>
    <div><span class="exec">0</span> / <span class="pend">0</span> / <span class="fail">0</span></div>`;
  slotsContainer.appendChild(slot);
}

// === Charts ===
function initCharts(){
  const txCtx = document.getElementById("txChart").getContext("2d");
  txChart = new Chart(txCtx, {
    type: "line",
    data: {
      labels: Array.from({length:10},(_,i)=>`Gate ${i+1}`),
      datasets: [
        { label: "Executed", borderColor:"#22c55e", backgroundColor:"rgba(34,197,94,0.08)", data:[...sessionExec], fill:true, pointRadius:3 },
        { label: "Pending", borderColor:"#facc15", backgroundColor:"rgba(250,204,21,0.06)", data:[...sessionPend], fill:true, pointRadius:3 },
        { label: "Failed", borderColor:"#ef4444", backgroundColor:"rgba(239,68,68,0.06)", data:[...sessionFail], fill:true, pointRadius:3 }
      ]
    },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'top'}}}
  });

  const gasCtx = document.getElementById("gasChart").getContext("2d");
  gasChart = new Chart(gasCtx,{
    type:"bar",
    data:{
      labels:Array.from({length:10},(_,i)=>`Gate ${i+1}`),
      datasets:[
        { label:"AOT Gas", backgroundColor:"#00c853", data:[...sessionGasAOT] },
        { label:"JIT Gas", backgroundColor:"#2979ff", data:[...sessionGasJIT] }
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      scales:{ y:{ ticks:{ callback:v=>parseFloat(v).toFixed(6) } } },
      plugins:{legend:{position:'top'}}
    }
  });
}
initCharts();

// === Helper ===
const rand = (min,max)=>Math.random()*(max-min)+min;
const randInt = (min,max)=>Math.floor(rand(min,max+1));
function gaussianRand(){
  // Box-Muller transform for realistic natural spread
  let u=0,v=0;
  while(u===0)u=Math.random();
  while(v===0)v=Math.random();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
}

// === Distribute TX with natural jitter ===
function distribute(total,n=10){
  let arr = [];
  const mean = total/n;
  for(let i=0;i<n;i++){
    const jitter = gaussianRand()*0.15; // ±15%
    arr.push(Math.max(1, Math.round(mean*(1+jitter))));
  }
  const sum = arr.reduce((a,b)=>a+b,0);
  const ratio = total/sum;
  return arr.map(v=>Math.round(v*ratio));
}

// === Determine Rates ===
function determineRates(scenario, mode){
  let base;
  if (scenario==="HighFee") base={exec:0.8,pend:0.14,fail:0.06};
  else if (scenario==="Congested") base={exec:0.75,pend:0.18,fail:0.07};
  else base={exec:0.88,pend:0.09,fail:0.03};

  if (mode==="AOT"){
    // deterministic mode: fewer fails/pending, optimized
    base.exec = Math.min(base.exec + rand(0.06,0.08),0.99);
    base.pend = Math.max(base.pend - rand(0.05,0.07),0.01);
    base.fail = Math.max(base.fail - rand(0.02,0.025),0.001);
  } else {
    // JIT: more variance, uncertain finality
    base.exec = Math.max(base.exec - rand(0.05,0.07),0.65);
    base.pend = Math.min(base.pend + rand(0.04,0.06),0.22);
    base.fail = Math.min(base.fail + rand(0.03,0.05),0.1);
  }

  const sum = base.exec+base.pend+base.fail;
  base.exec/=sum; base.pend/=sum; base.fail/=sum;
  return base;
}

// === Gas Cost (AOT slightly higher) ===
function gasForExec(mode){
  return +(mode==="AOT"
    ? rand(0.0000408,0.0000510)
    : rand(0.0000400,0.0000500)
  ).toFixed(6);
}

// === Reset ===
resetBtn.onclick=()=>{
  if(running)return;
  totalExec=totalPend=totalFail=0;
  totalGasAOT=totalGasJIT=0;
  cumulative={JIT:{exec:0,pend:0,fail:0,gas:0},AOT:{exec:0,pend:0,fail:0,gas:0}};
  sessionExec.fill(0);sessionPend.fill(0);sessionFail.fill(0);
  sessionGasAOT.fill(0);sessionGasJIT.fill(0);
  document.querySelectorAll(".exec,.pend,.fail").forEach(e=>e.textContent="0");
  txChart.data.datasets.forEach(ds=>ds.data.fill(0));
  gasChart.data.datasets.forEach(ds=>ds.data.fill(0));
  txChart.update();gasChart.update();updateStats();
  document.querySelectorAll(".popup-compare").forEach(p=>p.remove());
};

// === Start Simulation ===
startBtn.onclick=()=>{
  if(running)return;
  running=true;startBtn.disabled=true;

  const mode=document.querySelector('input[name="mode"]:checked').value;
  const scenario=scenarioSelect.value;
  let totalTX=Math.max(1,parseInt(txCountInput.value)||100);
  const rates=determineRates(scenario,mode);
  const perGate=distribute(totalTX,10);

  let sumExec=0,sumPend=0,sumFail=0;
  for(let i=0;i<10;i++){
    const tx=perGate[i];
    let e=Math.round(tx*(rates.exec + gaussianRand()*0.02));
    let f=Math.round(tx*(rates.fail + gaussianRand()*0.01));
    let p=Math.max(0,tx-e-f);
    e=Math.max(e,0);f=Math.max(f,0);
    sumExec+=e;sumPend+=p;sumFail+=f;

    sessionExec[i]+=e;
    sessionPend[i]+=p;
    sessionFail[i]+=f;

    const slot=document.getElementById(`slot-${i+1}`);
    slot.querySelector(".exec").textContent=sessionExec[i];
    slot.querySelector(".pend").textContent=sessionPend[i];
    slot.querySelector(".fail").textContent=sessionFail[i];

    const gasUsed=gasForExec(mode)*e;
    if(mode==="AOT"){sessionGasAOT[i]+=gasUsed;totalGasAOT+=gasUsed;cumulative.AOT.gas+=gasUsed;}
    else{sessionGasJIT[i]+=gasUsed;totalGasJIT+=gasUsed;cumulative.JIT.gas+=gasUsed;}
  }

  totalExec+=sumExec;totalPend+=sumPend;totalFail+=sumFail;
  if(mode==="AOT"){cumulative.AOT.exec+=sumExec;cumulative.AOT.pend+=sumPend;cumulative.AOT.fail+=sumFail;}
  else{cumulative.JIT.exec+=sumExec;cumulative.JIT.pend+=sumPend;cumulative.JIT.fail+=sumFail;}

  txChart.data.datasets[0].data=[...sessionExec];
  txChart.data.datasets[1].data=[...sessionPend];
  txChart.data.datasets[2].data=[...sessionFail];
  gasChart.data.datasets[0].data=[...sessionGasAOT];
  gasChart.data.datasets[1].data=[...sessionGasJIT];
  txChart.update();gasChart.update();updateStats();

  // === Pending resolution (AOT resolves better) ===
  let tick=0;const decayTicks=6;
  const interval=setInterval(()=>{
    tick++;
    const pendingNow=sessionPend.reduce((a,b)=>a+b,0);
    if(pendingNow<=0||tick>decayTicks){clearInterval(interval);running=false;startBtn.disabled=false;return;}
    let convert=Math.ceil(pendingNow/(decayTicks-tick+1));
    if(mode==="AOT") convert*=1.5; // AOT resolves faster
    for(let i=0;i<10;i++){
      const take=Math.min(sessionPend[i],Math.round(convert*(sessionPend[i]/pendingNow)));
      if(take<=0)continue;
      sessionPend[i]-=take;
      sessionExec[i]+=take;
      totalPend-=take;totalExec+=take;
      const gasAdd=gasForExec(mode)*take;
      if(mode==="AOT"){sessionGasAOT[i]+=gasAdd;totalGasAOT+=gasAdd;cumulative.AOT.gas+=gasAdd;}
      else{sessionGasJIT[i]+=gasAdd;totalGasJIT+=gasAdd;cumulative.JIT.gas+=gasAdd;}
    }
    txChart.data.datasets[0].data=[...sessionExec];
    txChart.data.datasets[1].data=[...sessionPend];
    txChart.update();gasChart.update();updateStats();
  },900);
};

// === Stats Update ===
function updateStats(){
  const total=totalExec+totalPend+totalFail;
  document.getElementById("executedVal").textContent=totalExec;
  document.getElementById("failedVal").textContent=totalFail;
  document.getElementById("pendingVal").textContent=totalPend;
  document.getElementById("totalRunVal").textContent=total;
  document.getElementById("jitGasVal").textContent=totalGasJIT.toFixed(6);
  document.getElementById("aotGasVal").textContent=totalGasAOT.toFixed(6);
  document.getElementById("totalGasVal").textContent=(totalGasAOT+totalGasJIT).toFixed(6);
}

// === Compare Popup ===
compareBtn.onclick=()=>{
  if(cumulative.JIT.exec===0&&cumulative.AOT.exec===0){
    alert("Chưa có dữ liệu để so sánh — hãy chạy mô phỏng JIT hoặc AOT ít nhất một lần.");return;
  }
  document.querySelectorAll(".popup-compare").forEach(p=>p.remove());
  const popup=document.createElement("div");
  popup.className="popup-compare";
  popup.innerHTML=`
    <div class="popup-inner">
      <strong>📊 JIT vs AOT Comparison</strong>
      <canvas id="compareChart"></canvas>
      <p style="margin-top:8px;font-size:13px">Số liệu cộng dồn (mỗi lần bạn bấm Start). Reset sẽ xóa.</p>
      <button class="closePopup">OK</button>
    </div>`;
  document.body.appendChild(popup);

  const ctx=document.getElementById("compareChart").getContext("2d");
  new Chart(ctx,{
    type:"bar",
    data:{
      labels:["Executed","Pending","Failed","Avg Gas (SOL)"],
      datasets:[
        {label:"JIT",backgroundColor:"#2979ff",data:[
          cumulative.JIT.exec,cumulative.JIT.pend,cumulative.JIT.fail,
          cumulative.JIT.exec?+(cumulative.JIT.gas/cumulative.JIT.exec).toFixed(6):0]},
        {label:"AOT",backgroundColor:"#00c853",data:[
          cumulative.AOT.exec,cumulative.AOT.pend,cumulative.AOT.fail,
          cumulative.AOT.exec?+(cumulative.AOT.gas/cumulative.AOT.exec).toFixed(6):0]}
      ]
    },
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top'}}}
  });
  popup.querySelector(".closePopup").onclick=()=>popup.remove();
};
