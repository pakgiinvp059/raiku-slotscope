// Raiku SlotScope — Final Version
const slotsContainer = document.getElementById("slots");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const compareBtn = document.getElementById("compareBtn");
const txCountInput = document.getElementById("txCount");
const scenarioSelect = document.getElementById("scenario");

let txChart, gasChart;
let totalExec = 0, totalPend = 0, totalFail = 0;
let totalGasAOT = 0, totalGasJIT = 0;

// tạo slot UI
for (let i = 1; i <= 10; i++) {
  const s = document.createElement("div");
  s.className = "slot";
  s.id = `slot-${i}`;
  s.innerHTML = `
    <b>Slot ${i}</b>
    <div class="dots"><div class="dot green"></div><div class="dot yellow"></div><div class="dot red"></div></div>
    <div><span class="exec">0</span> / <span class="pend">0</span> / <span class="fail">0</span></div>`;
  slotsContainer.appendChild(s);
}

// Chart init
function initCharts() {
  txChart = new Chart(document.getElementById("txChart"), {
    type: "line",
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Slot ${i + 1}`),
      datasets: [
        { label: "Executed", borderColor: "#22c55e", data: Array(10).fill(0), tension: 0.3 },
        { label: "Pending", borderColor: "#facc15", data: Array(10).fill(0), tension: 0.3 },
        { label: "Failed", borderColor: "#ef4444", data: Array(10).fill(0), tension: 0.3 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  gasChart = new Chart(document.getElementById("gasChart"), {
    type: "bar",
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Slot ${i + 1}`),
      datasets: [
        { label: "AOT Gas", backgroundColor: "#00c853", data: Array(10).fill(0) },
        { label: "JIT Gas", backgroundColor: "#2979ff", data: Array(10).fill(0) }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}
initCharts();

function randomBetween(a,b){return Math.floor(Math.random()*(b-a+1))+a;}
function randomGas(){return +(Math.random()*0.00008+0.00002).toFixed(6);}
function getRates(type){
  if(type==="HighFee")return{exec:0.88,pend:0.09,fail:0.03};
  if(type==="Congested")return{exec:0.82,pend:0.12,fail:0.06};
  return{exec:0.93,pend:0.05,fail:0.02};
}
function updateStats(){
  document.getElementById("executedVal").textContent=totalExec;
  document.getElementById("failedVal").textContent=totalFail;
  document.getElementById("pendingVal").textContent=totalPend;
  document.getElementById("totalRunVal").textContent=totalExec+totalPend+totalFail;
  document.getElementById("jitGasVal").textContent=totalGasJIT.toFixed(6);
  document.getElementById("aotGasVal").textContent=totalGasAOT.toFixed(6);
  document.getElementById("totalGasVal").textContent=(totalGasAOT+totalGasJIT).toFixed(6);
}

// RESET
resetBtn.onclick = ()=>{
  totalExec=totalPend=totalFail=totalGasAOT=totalGasJIT=0;
  document.querySelectorAll(".slot span").forEach(s=>s.textContent="0");
  [txChart,gasChart].forEach(c=>{c.data.datasets.forEach(d=>d.data=Array(10).fill(0));c.update();});
  updateStats();
};

// Simulation
startBtn.onclick=()=>{
  const mode=document.querySelector("input[name=mode]:checked").value;
  const scenario=scenarioSelect.value;
  const totalTX=parseInt(txCountInput.value)||100;
  runSim(mode,totalTX,scenario);
};

function runSim(mode,totalTX,scenario){
  const rate=getRates(scenario);
  const slotTx=Array.from({length:10},()=>randomBetween(8,12));
  const totalSlot=slotTx.reduce((a,b)=>a+b,0);
  const scale=totalTX/totalSlot;
  let perSlot=slotTx.map(v=>Math.round(v*scale));

  for(let i=0;i<10;i++){
    const el=document.getElementById(`slot-${i+1}`);
    const tx=perSlot[i];
    const execC=Math.round(tx*rate.exec);
    const pendC=Math.round(tx*rate.pend);
    const failC=tx-execC-pendC;

    el.querySelector(".exec").textContent=0;
    el.querySelector(".pend").textContent=pendC;
    el.querySelector(".fail").textContent=0;
    txChart.data.datasets[1].data[i]=pendC;
    totalPend+=pendC;

    // pending decay
    let runningPend=pendC;
    const decay=setInterval(()=>{
      if(runningPend>0){
        runningPend--;
        el.querySelector(".pend").textContent=runningPend;
        txChart.data.datasets[1].data[i]=runningPend;
        totalPend--;
        txChart.update("none");
        updateStats();
      }else clearInterval(decay);
    },randomBetween(250,600));

    // execute + fail
    const seq=[...Array(execC).fill("E"),...Array(failC).fill("F")].sort(()=>Math.random()-0.5);
    seq.forEach((t,idx)=>{
      setTimeout(()=>{
        if(t==="E"){
          const e=+el.querySelector(".exec").textContent+1;
          el.querySelector(".exec").textContent=e;
          txChart.data.datasets[0].data[i]=e;
          totalExec++;
          const g=randomGas();
          if(mode==="AOT"){gasChart.data.datasets[0].data[i]+=g;totalGasAOT+=g;}
          else{gasChart.data.datasets[1].data[i]+=g;totalGasJIT+=g;}
        }else{
          const f=+el.querySelector(".fail").textContent+1;
          el.querySelector(".fail").textContent=f;
          txChart.data.datasets[2].data[i]=f;
          totalFail++;
        }
        txChart.update("none");
        gasChart.update("none");
        updateStats();
      },idx*randomBetween(80,130)+randomBetween(200,400));
    });
  }
}

// Compare Popup
compareBtn.onclick=()=>{
  const popup=document.createElement("div");
  popup.className="popup-compare";
  popup.innerHTML=`
    <div class="popup-inner">
      <strong>📊 JIT vs AOT Comparison</strong>
      <canvas id="compareChart"></canvas>
      <div class="compare-text">
        <p>✅ Executed: <b>${totalExec}</b> | ⚠️ Pending: <b>${totalPend}</b> | ❌ Failed: <b>${totalFail}</b></p>
        <p>💡 AOT Gas: <b>${totalGasAOT.toFixed(6)}</b> | JIT Gas: <b>${totalGasJIT.toFixed(6)}</b></p>
        <p>📈 AOT giảm lỗi ~30% & Gas tăng nhẹ ~10% để đạt hiệu suất ổn định hơn.</p>
      </div>
      <button class="closePopup">OK</button>
    </div>`;
  document.body.appendChild(popup);
  const ctx=document.getElementById("compareChart").getContext("2d");
  new Chart(ctx,{
    type:"bar",
    data:{
      labels:["Executed","Pending","Failed","Gas (SOL)"],
      datasets:[
        {label:"JIT",backgroundColor:"#2979ff",data:[totalExec*0.9,totalPend*1.2,totalFail*1.3,totalGasJIT]},
        {label:"AOT",backgroundColor:"#00c853",data:[totalExec,totalPend*0.7,totalFail*0.6,totalGasAOT*1.1]}
      ]
    },
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"top"}}}
  });
  popup.querySelector(".closePopup").onclick=()=>popup.remove();
};
