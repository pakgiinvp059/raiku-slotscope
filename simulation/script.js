const slotsEl=document.getElementById("slots");
const logBox=document.getElementById("logBox");
const execEl=document.getElementById("execCount");
const failEl=document.getElementById("failCount");
const pendEl=document.getElementById("pendCount");
const aotGasEl=document.getElementById("aotGas");
const totalGasEl=document.getElementById("totalGas");
let chart,autoRunning=false;

function initSlots(){
  slotsEl.innerHTML="";
  for(let i=1;i<=10;i++){
    const div=document.createElement("div");
    div.className="slot-tile";
    div.innerHTML=`
      <div class="label">Slot ${i}</div>
      <div class="slot-counters">
        <span class="counter exec">Exec:0</span>
        <span class="counter pend">Pend:0</span>
        <span class="counter fail">Fail:0</span>
      </div>`;
    slotsEl.appendChild(div);
  }
}

function addLog(msg){
  const time=new Date().toLocaleTimeString();
  logBox.innerHTML+=`[${time}] ${msg}<br>`;
  logBox.scrollTop=logBox.scrollHeight;
}

function initChart(){
  const ctx=document.getElementById("txChart");
  chart=new Chart(ctx,{
    type:"line",
    data:{labels:[...Array(10).keys()].map(i=>`Slot ${i+1}`),
      datasets:[
        {label:"Total TX",data:Array(10).fill(0),borderColor:"#000",fill:false},
        {label:"Executed",data:Array(10).fill(0),borderColor:"#20b050",fill:false},
        {label:"Failed",data:Array(10).fill(0),borderColor:"#ff4545",fill:false},
        {label:"Pending",data:Array(10).fill(0),borderColor:"#fcbf24",fill:false}
      ]},
    options:{responsive:true,maintainAspectRatio:false,scales:{
      y:{beginAtZero:true,max:10},x:{ticks:{font:{size:11}}}}});
}

async function simulate(){
  addLog("Simulation started...");
  const slots=document.querySelectorAll(".slot-tile");
  const txCount=parseInt(document.getElementById("txCount").value);
  const aot=document.getElementById("aotMode").checked;
  const scenario=document.getElementById("scenario").value;
  let execTotal=0,failTotal=0,pendTotal=0,totalGas=0,aotGas=0;

  for(let i=0;i<slots.length;i++){
    const exec=Math.floor(Math.random()*(txCount/10))+3;
    let fail=Math.floor(Math.random()*3);
    let pend=scenario!=="normal" && Math.random()>0.7 ? Math.floor(Math.random()*3):0;
    if(aot){fail=Math.floor(fail/2);pend=Math.floor(pend/2);}
    const totalSlot=exec+fail+pend;
    execTotal+=exec;failTotal+=fail;pendTotal+=pend;
    totalGas+=totalSlot*0.0003;aotGas+=aot?totalSlot*0.0005:0;

    const c=slots[i].querySelectorAll(".counter");
    c[0].textContent=`Exec:${exec}`;
    c[1].textContent=`Pend:${pend}`;
    c[2].textContent=`Fail:${fail}`;
    chart.data.datasets[0].data[i]=totalSlot;
    chart.data.datasets[1].data[i]=exec;
    chart.data.datasets[2].data[i]=fail;
    chart.data.datasets[3].data[i]=pend;
    chart.update();
    await new Promise(r=>setTimeout(r,200));
  }
  execEl.textContent=execTotal;
  failEl.textContent=failTotal;
  pendEl.textContent=pendTotal;
  totalGasEl.textContent=totalGas.toFixed(5);
  aotGasEl.textContent=aotGas.toFixed(5);
  addLog(`✅ Simulation done — Exec:${execTotal}, Fail:${failTotal}, Pend:${pendTotal}`);
}

function resetAll(){
  initSlots();initChart();
  execEl.textContent=failEl.textContent=pendEl.textContent='0';
  totalGasEl.textContent=aotGasEl.textContent='0.0000';
  logBox.innerHTML="";addLog("🔄 Reset complete");
}

// Auto-run
async function autoRunLoop(){
  autoRunning=true;
  let count=0;
  addLog("🤖 Auto-run mode: 5 simulations per cycle.");
  while(autoRunning){
    for(let i=0;i<5;i++){
      if(!autoRunning) break;
      count++;
      addLog(`Cycle ${count}`);
      await simulate();
      await new Promise(r=>setTimeout(r,1500));
    }
    if(!confirm("Auto-run completed 5 rounds. Continue?")){
      addLog("🛑 Auto stopped by user.");autoRunning=false;break;
    }
  }
}

// Handlers
document.getElementById("startBtn").onclick=simulate;
document.getElementById("resetBtn").onclick=resetAll;
document.getElementById("exportBtn").onclick=()=>addLog("📦 Exported CSV (placeholder)");
document.getElementById("autoRun").onclick=autoRunLoop;

// Initialize
window.onload=()=>{initSlots();initChart();addLog("✨ Ready — click Start Simulation.");};
