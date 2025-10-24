const slots = document.getElementById("slots");
const txChartCtx = document.getElementById("txChart").getContext("2d");
const gasChartCtx = document.getElementById("gasChart").getContext("2d");

let executed = 0, failed = 0, pending = 0;
let jitGas = 0, aotGas = 0;

// tạo slot
for (let i = 1; i <= 10; i++) {
  slots.innerHTML += `
    <div class="slot" id="slot-${i}">
      <b>Slot ${i}</b>
      <div class="dots">
        <div class="dot green"></div>
        <div class="dot yellow"></div>
        <div class="dot red"></div>
      </div>
      <div class="slot-values">
        <span class="exec">0</span> / 
        <span class="pend">0</span> / 
        <span class="fail">0</span>
      </div>
    </div>`;
}

// TX chart
const txChart = new Chart(txChartCtx, {
  type: "line",
  data: {
    labels: Array.from({ length: 10 }, (_, i) => `Slot ${i + 1}`),
    datasets: [
      { label: "Executed", borderColor: "#00c853", data: [], fill: false },
      { label: "Pending", borderColor: "#ffb300", data: [], fill: false },
      { label: "Failed", borderColor: "#ff5252", data: [], fill: false },
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: { y: { beginAtZero: true } }
  }
});

// GAS chart
const gasChart = new Chart(gasChartCtx, {
  type: "bar",
  data: {
    labels: Array.from({ length: 10 }, (_, i) => `Slot ${i + 1}`),
    datasets: [
      { label: "AOT Gas", backgroundColor: "#00c853", data: [] },
      { label: "JIT Gas", backgroundColor: "#2979ff", data: [] },
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: { y: { beginAtZero: true } }
  }
});

// start simulation
document.getElementById("startBtn").addEventListener("click", () => {
  executed = failed = pending = jitGas = aotGas = 0;
  const txCount = parseInt(document.getElementById("txCount").value);
  const execData = [], pendData = [], failData = [];
  const gasAOT = [], gasJIT = [];

  for (let i = 1; i <= 10; i++) {
    const slot = document.getElementById(`slot-${i}`);
    const exec = Math.floor(Math.random() * (txCount / 10)) + 5;
    const pend = Math.floor(Math.random() * 3);
    const fail = Math.floor(Math.random() * 2);

    executed += exec; pending += pend; failed += fail;

    slot.querySelector(".exec").textContent = exec;
    slot.querySelector(".pend").textContent = pend;
    slot.querySelector(".fail").textContent = fail;

    execData.push(exec);
    pendData.push(pend);
    failData.push(fail);

    // gas random
    const gasA = 0.00003 + Math.random() * 0.00006;
    const gasJ = 0.00003 + Math
