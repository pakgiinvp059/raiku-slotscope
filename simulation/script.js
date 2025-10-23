body {
  font-family: "Inter", sans-serif;
  background: #f9fbfd;
  color: #333;
  margin: 0;
  text-align: center;
}
.header {
  background: linear-gradient(90deg, #1e90ff, #00b4ff);
  color: white;
  padding: 12px 0;
}
.controls { margin: 15px; }
button {
  background: #007bff;
  border: none;
  color: white;
  padding: 7px 14px;
  border-radius: 6px;
  cursor: pointer;
  margin: 0 4px;
}
button:hover { background: #0056b3; }

.slots {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  margin: 10px 0;
}
.slot {
  background: white;
  border-radius: 8px;
  padding: 10px;
  width: 90px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
}
.dots { margin: 5px 0; }
.dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin: 0 3px; }
.green { background: #27ae60; }
.orange { background: #f1c40f; }
.red { background: #e74c3c; }
.blue { background: #2980b9; }
.teal { background: #16a085; }

.blueprint {
  background: white;
  border-radius: 10px;
  margin: 20px auto;
  width: 92%;
  padding: 15px;
}
.steps {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  flex-wrap: nowrap;
  overflow-x: auto;
}
.step {
  background: #f7f9fc;
  border-radius: 10px;
  padding: 8px 12px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
  min-width: 120px;
}
.arrow { font-size: 18px; }

.charts {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  flex-wrap: nowrap;
  gap: 10px;
  width: 92%;
  margin: 0 auto;
}
.chart-box {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.05);
  padding: 10px;
}
.chart-box.large { flex: 7; height: 300px; }
.chart-box.small { flex: 3; height: 300px; }

.summary {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  margin: 15px auto;
  width: 95%;
}
.box {
  background: #f9fafc;
  border-radius: 8px;
  padding: 8px;
  width: 150px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}
.box span {
  font-size: 18px;
  font-weight: 600;
  color: #007bff;
}

.comparison {
  background: #ffffff;
  border-radius: 10px;
  margin: 20px auto;
  width: 55%;
  padding: 15px;
  box-shadow: 0 3px 6px rgba(0,0,0,0.1);
  position: relative;
  z-index: 2;
}
.hidden { display: none; }
