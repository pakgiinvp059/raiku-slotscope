let chart;
let autoRunning = false;

function addLog(msg) {
  const box = document.getElementById("logBox");
  const t = new Date().toLocaleTimeString();
  box.innerHTML += `[${t}] ${msg}<br>`;
  box.scrollTop = box.scrollHeight;
}

function initSlots() {
  const slots = document.getElementById("slots");
  slots.innerHTML = "";
  for (let i = 1; i <= 10; i++) {
    slots.innerHTML += `
      <div class="slot-tile">
        <div class="label">Slot ${i}</div>
        <div class="slot-counters">
          <span class="counter exec">Exec: 0</span>
          <span class="counter pend">Pend: 0</span>
          <span class="counter fail">Fail: 0</span>
        </div>
      </div>`;
  }
}

function initChart() {
  const ctx = document.getElementById("txChart").getContext("2d");
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: Array.from({ length: 10 }, (_, i) => `Slot ${i + 1}`),
      datasets: [
        { label: "Total TX", data: Array(10).fill(0), borderColor: "#000", fill: false },
        { label: "Executed", data: Array(10).fill(0), borderColor: "#20b050", fill: false },
        { label: "Failed", data: Array(10).fill(0), borderColor: "#ff4545", fill: false },
        { label: "Pending", data: Array(10).fill(0), borderColor: "#fcbf24", fill: false },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, max: 10 } },
      plugins: { legend: { display: false } },
    },
  });
}

async function simulate() {
  addLog("Simulation started...");
  const slots = document.querySelectorAll(".slot-tile");
  const txCount = parseInt(document.getElementById("txCount").value);
  const aot = document.getElementById("aotMode").checked;
  const scenario = document.getElementById("scenario").value;

  let execTotal = 0, failTotal = 0, pendTotal = 0, totalGas = 0, aotGas = 0;

  for (let i = 0; i < slots.length; i++) {
    const exec = Math.floor(Math.random() * (txCount / 10)) + 3;
    let fail = Math.floor(Math.random() * 3);
    let pend = scenario !== "normal" && Math.random() > 0.7 ? Math.floor(Math.random() * 3) : 0;

    if (aot) { fail = Math.floor(fail / 2); pend = Math.floor(pend / 2); }

    const totalSlot = exec + fail + pend;
    execTotal += exec; failTotal += fail; pendTotal += pend;
    totalGas += totalSlot * 0.0003;
    if (aot) aotGas += totalSlot * 0.0005;

    const counters = slots[i].querySelectorAll(".counter");
    counters[0].textContent = `Exec: ${exec}`;
    counters[1].textContent = `Pend: ${pend}`;
    counters[2].textContent = `Fail: ${fail}`;

    chart.data.datasets[0].data[i] = totalSlot;
    chart.data.datasets[1].data[i] = exec;
    chart.data.datasets[2].data[i] = fail;
    chart.data.datasets[3].data[i] = pend;
    chart.update();

    await new Promise(r => setTimeout(r, 150));
  }

  document.getElementById("execCount").textContent = execTotal;
  document.getElementById("failCount").textContent = failTotal;
  document.getElementById("pendCount").textContent = pendTotal;
  document.getElementById("totalGas").textContent = totalGas.toFixed(5);
  document.getElementById("aotGas").textContent = aotGas.toFixed(5);

  addLog(`✅ Done: Exec=${execTotal}, Fail=${failTotal}, Pend=${pendTotal}`);
}

function resetAll() {
  initSlots();
  initChart();
  document.getElementById("execCount").textContent =
  document.getElementById("failCount").textContent =
  document.getElementById("pendCount").textContent = "0";
  document.getElementById("totalGas").textContent =
  document.getElementById("aotGas").textContent = "0.0000";
  document.getElementById("logBox").innerHTML = "";
  addLog("🔄 Reset complete");
}

async function autoRunLoop() {
  autoRunning = true;
  addLog("🤖 Auto-run started: running 5 cycles...");
  let cycle = 0;

  while (autoRunning) {
    for (let i = 0; i < 5; i++) {
      if (!autoRunning) break;
      cycle++;
      addLog(`Cycle ${cycle} running...`);
      await simulate();
      await new Promise(r => setTimeout(r, 1200));
    }
    const cont = confirm("Auto-run completed 5 cycles. Continue?");
    if (!cont) { addLog("🛑 Auto stopped by user."); autoRunning = false; }
  }
}

document.getElementById("startBtn").onclick = simulate;
document.getElementById("resetBtn").onclick = resetAll;
document.getElementById("exportBtn").onclick = () => addLog("📦 Export CSV (mock)");
document.getElementById("autoRun").onclick = autoRunLoop;

window.onload = () => {
  initSlots();
  initChart();
  addLog("✨ Ready — click Start Simulation.");
};
