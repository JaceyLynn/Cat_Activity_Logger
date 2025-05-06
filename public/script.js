// const WEB_APP_URL =
//   "https://script.google.com/macros/s/AKfycbxn9-kXI1Vsmi_SvtI5M52terMvXbNspXr8HHrFdVRfxBTofhsmB6uXpT_wClNc9sNW-g/exec";

//session calculation for charts
let currentSessionLog = [];
//flag for the first initial loading screen
let isInitialLoad = true;
let hasInitialLoadCompleted = false;
//flag for switching drop down lists
let isUserSwitchingDate = false;
let isUserSwitchingWeekly = false;

//auto fill dates from google sheet tabs
async function populateDateFilter() {
  try {
    const res = await fetch("/catdata?mode=listSheets");
    const dateTabs = await res.json();

    console.log("Fetched dateTabs:", dateTabs);
    const select = document.getElementById("date-filter");

    // Clear existing options
    select.innerHTML = '<option value="">Select Date</option>';

    dateTabs.sort().reverse(); // latest first
    dateTabs.forEach((date) => {
      const option = document.createElement("option");
      option.value = date;
      option.textContent = date;
      select.appendChild(option);
    });
  } catch (err) {
    console.error("Error populating date filter:", err);
  }
}

//weekly drop down switch mark
const weeklySelect = document.getElementById("weekly-filter");
console.log("weeklySelect is:", weeklySelect);
weeklySelect.addEventListener("change", (e) => {
  console.log("weekly‑filter changed to:", e.target.value);
  fetchWeeklyData(e.target.value);
});


//Flags for all the different loading screen
let loadingTimeout;
//first load
function showInitialLoading() {
  document.getElementById("loading-overlay").style.display = "flex";
}
function hideInitialLoading() {
  document.getElementById("loading-overlay").style.display = "none";
}
//date switch
function showSwitchingLoading() {
  document.getElementById("switching-overlay").style.display = "flex";
}
function hideSwitchingLoading() {
  document.getElementById("switching-overlay").style.display = "none";
}
//weekly data
function showWeeklyLoading() {
  document.getElementById("weekly-overlay").style.display = "flex";
}
function hideWeeklyLoading() {
  document.getElementById("weekly-overlay").style.display = "none";
}


//fetch data for the now section
async function fetchCatData() {
  try {
    if (isUserSwitchingDate) return; //if switch date, stop override the charts
    if (isInitialLoad) showInitialLoading(); //trigger initial loading screen

    const res = await fetch("/catdata");
    const data = await res.json();
    //get notification if one event is not logging at all
    checkSensorHealth(data);
    
    if (!data || !Array.isArray(data)) return;//sanity check

    //get latest line
    const latest = data[data.length - 1];

    // Duration counters
    const bedDurationSeconds = data.filter(
      (row) => row.event2 === "cat_detected"
    ).length;
    const windowDurationSeconds = data.filter(
      (row) => row.event1 === "cat_detected"
    ).length;
    const foodDurationSeconds = data.filter(
      (row) => row.event3 === "cat_detected"
    ).length;

    let bedFrequency = 0;
    let windowFrequency = 0;
    let foodFrequency = 0;
    let sessionLog = [];

    let lastBedStatus = null;
    let lastWindowStatus = null;
    let lastFoodStatus = null;

    let bedSessionStart = null;
    let windowSessionStart = null;
    let foodSessionStart = null;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const currentTime = row.local_timestamp;

      //session calculations
      // -------------BED (event2) ----------------
      if (row.event2) {
        if (//detect session start
          lastBedStatus === "nothing_detected" &&
          row.event2 === "cat_detected"
        ) {
          bedSessionStart = currentTime;
        } else if (//detect session end
          lastBedStatus === "cat_detected" &&
          row.event2 === "nothing_detected" &&
          bedSessionStart
        ) {//prevent sensor glitching, if two session very close, merge them
          let merge = false;
          let skipCount = 0;
          for (let j = i + 1; j < data.length && skipCount < 120; j++) {
            const next = data[j];
            if (!next.event2) continue;
            skipCount++;
            if (next.event2 === "cat_detected") {
              merge = true;
              break;
            }
            if (next.event2 === "nothing_detected") break;
          }

          if (!merge) {
            const durationSec = Math.round(
              (new Date(currentTime) - new Date(bedSessionStart)) / 1000
            );
            sessionLog.push({
              startTime: bedSessionStart,
              durationSeconds: durationSec,
              location: "Bed",
            });
            bedSessionStart = null;
          }
        }
        lastBedStatus = row.event2;
      }

      // --------------WINDOW (event1)------------------
      if (row.event1) {
        if (
          lastWindowStatus === "nothing_detected" &&
          row.event1 === "cat_detected"
        ) {
          windowSessionStart = currentTime;
        } else if (
          lastWindowStatus === "cat_detected" &&
          row.event1 === "nothing_detected" &&
          windowSessionStart
        ) {//prevent sensor glitching, if two session very close, merge them
          let merge = false;
          let skipCount = 0;
          for (let j = i + 1; j < data.length && skipCount < 200; j++) {
            const next = data[j];
            if (!next.event1) continue;
            skipCount++;
            if (next.event1 === "cat_detected") {
              merge = true;
              break;
            }
            if (next.event1 === "nothing_detected") break;
          }

          if (!merge) {
            console.log(`[win] Merged session skipped at index ${i}`);
            const durationSec = Math.round(
              (new Date(currentTime) - new Date(windowSessionStart)) / 1000
            );
            sessionLog.push({
              startTime: windowSessionStart,
              durationSeconds: durationSec,
              location: "Window",
            });
            windowSessionStart = null;
          } else {
            console.log(
              `[win] Added session from ${bedSessionStart} to ${currentTime}`
            );
          }
        }
        lastWindowStatus = row.event1;
      }

      // ----------------FOOD (event3) --------------------
      if (row.event3) {
        if (
          lastFoodStatus === "nothing_detected" &&
          row.event3 === "cat_detected"
        ) {
          foodSessionStart = currentTime;
        } else if (
          lastFoodStatus === "cat_detected" &&
          row.event3 === "nothing_detected" &&
          foodSessionStart
        ) {//prevent sensor glitching, if two session very close, merge them
          let merge = false;
          let skipCount = 0;
          for (let j = i + 1; j < data.length && skipCount < 60; j++) {
            const next = data[j];
            if (!next.event3) continue;
            skipCount++;
            if (next.event3 === "cat_detected") {
              merge = true;
              break;
            }
            if (next.event3 === "nothing_detected") break;
          }

          if (!merge) {
            const durationSec = Math.round(
              (new Date(currentTime) - new Date(foodSessionStart)) / 1000
            );
            sessionLog.push({
              startTime: foodSessionStart,
              durationSeconds: durationSec,
              location: "Food",
            });
            foodSessionStart = null;
          }
        }
        lastFoodStatus = row.event3;
      }
    }
//sending processed data out for now section
updateStatus(
  latest,
  bedDurationSeconds,
  windowDurationSeconds,
  foodDurationSeconds,
  bedFrequency,
  windowFrequency,
  foodFrequency,
  data
);
//turn off loading screen when data loaded
    if (isInitialLoad) {
      hideInitialLoading();
      isInitialLoad = false;
    }
  } catch (err) {
    console.error("Error fetching cat data:", err);
    if (isInitialLoad) hideInitialLoading();
  }
  setTimeout(fetchCatData, 3000);//real time refreshes
}

// Inspect the last 20 rows of each event column for malfunction
function checkSensorHealth(data) {
  const sensors = {
    event1: "Window sensor",
    event2: "Bed sensor",
    event3: "Food sensor",
  };

  Object.entries(sensors).forEach(([evtKey, name]) => {
    const last20 = data.slice(-20);
    console.log(
      `Checking ${name}, last20 values:`,
      last20.map((r) => r[evtKey])
    ); // debug

    // if all 20 are falsy (undefined, null, or empty string), alert
    if (last20.length > 0 && last20.every((r) => !r[evtKey])) {
      showSensorAlert(name);
    }
  });
}

// Create a popup and auto‑dismiss!!!
function showSensorAlert(sensorName) {
  // don’t duplicate if already showing!!!
  if (document.getElementById("sensor-alert")) return;

  // aesthetic
  const overlay = document.createElement("div");
  overlay.id = "sensor-alert";
  Object.assign(overlay.style, {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10000,
  });

  // message box
  const box = document.createElement("div");
  box.textContent = `${sensorName} is not functioning`;
  Object.assign(box.style, {
    background: "#ee5a36",
    color: "#fff",
    padding: "1rem 1.5rem",
    borderRadius: "8px",
    fontSize: "1.2rem",
    textAlign: "center",
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
  });

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // auto‑dismiss after 5 seconds
  setTimeout(() => {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }, 5000);
}

//separate function for updating chart only
async function fetchChartDataOnly(selectedDate) {
  try {
    // don’t load daily if weekly is in progress!!!
    if (isUserSwitchingWeekly) return;

    isUserSwitchingDate = true;//trigger dataset switch
    showSwitchingLoading();//trigger loading screen

    const response = await fetch(
      `/catdata?sheet=${encodeURIComponent(selectedDate)}`
    );
    const data = await response.json();
//basically same logic as fetch cat data
    if (!data || !Array.isArray(data) || data.length === 0) {
      console.warn("No data found for the selected day.");
      hideSwitchingLoading();
      return;
    }

    console.log("Fetched data for:", selectedDate, data);

    currentSessionLog = [];

    let lastBedStatus = null;
    let lastWindowStatus = null;
    let lastFoodStatus = null;

    let bedSessionStart = null;
    let windowSessionStart = null;
    let foodSessionStart = null;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const currentTime = row.local_timestamp;

      // BED SESSION (event2)
      if (row.event2) {
        if (
          lastBedStatus === "nothing_detected" &&
          row.event2 === "cat_detected"
        ) {
          bedSessionStart = currentTime;
        } else if (
          lastBedStatus === "cat_detected" &&
          row.event2 === "nothing_detected" &&
          bedSessionStart
        ) {
          let merge = false;
          let skipCount = 0;
          for (let j = i + 1; j < data.length && skipCount < 120; j++) {
            const next = data[j];
            if (!next.event2) continue; // skip nulls
            skipCount++;
            if (next.event2 === "cat_detected") {
              merge = true;
              break;
            }
            if (next.event2 === "nothing_detected") break;
          }

          if (!merge) {
            const start = new Date(bedSessionStart);
            const end = new Date(currentTime);
            const durationSec = Math.round((end - start) / 1000);
            currentSessionLog.push({
              startTime: bedSessionStart,
              durationSeconds: durationSec,
              location: "Bed",
            });
            bedSessionStart = null;
          }
        }
        lastBedStatus = row.event2;
      }

      // WINDOW SESSION (event1)
      if (row.event1) {
        if (
          lastWindowStatus === "nothing_detected" &&
          row.event1 === "cat_detected"
        ) {
          windowSessionStart = currentTime;
        } else if (
          lastWindowStatus === "cat_detected" &&
          row.event1 === "nothing_detected" &&
          windowSessionStart
        ) {
          let merge = false;
          let skipCount = 0;
          for (let j = i + 1; j < data.length && skipCount < 200; j++) {
            const next = data[j];
            if (!next.event1) continue;
            skipCount++;
            if (next.event1 === "cat_detected") {
              merge = true;
              break;
            }
            if (next.event1 === "nothing_detected") break;
          }

          if (!merge) {
            const start = new Date(windowSessionStart);
            const end = new Date(currentTime);
            const durationSec = Math.round((end - start) / 1000);
            currentSessionLog.push({
              startTime: windowSessionStart,
              durationSeconds: durationSec,
              location: "Window",
            });
            windowSessionStart = null;
          }
        }
        lastWindowStatus = row.event1;
      }

      // FOOD SESSION (event3)
      if (row.event3) {
        if (
          lastFoodStatus === "nothing_detected" &&
          row.event3 === "cat_detected"
        ) {
          foodSessionStart = currentTime;
        } else if (
          lastFoodStatus === "cat_detected" &&
          row.event3 === "nothing_detected" &&
          foodSessionStart
        ) {
          let merge = false;
          let skipCount = 0;
          for (let j = i + 1; j < data.length && skipCount < 60; j++) {
            const next = data[j];
            if (!next.event3) continue;
            skipCount++;
            if (next.event3 === "cat_detected") {
              merge = true;
              break;
            }
            if (next.event3 === "nothing_detected") break;
          }

          if (!merge) {
            const start = new Date(foodSessionStart);
            const end = new Date(currentTime);
            const durationSec = Math.round((end - start) / 1000);
            currentSessionLog.push({
              startTime: foodSessionStart,
              durationSeconds: durationSec,
              location: "Food",
            });
            foodSessionStart = null;
          }
        }
        lastFoodStatus = row.event3;
      }
    }

    console.log("Processed sessionLog for:", selectedDate, currentSessionLog);

    await updateCharts(currentSessionLog);
    hideSwitchingLoading(); // Hide loading when charts are ready
  } catch (err) {
    console.error("Error fetching data for selected day:", err);
  } finally {
    hideSwitchingLoading();
    isUserSwitchingDate = false;
  }
}


//for weekly processing
function computeSessionLog(data) {
  let sessionLog = [];
  let last = { Bed: null, Food: null, Window: null };
  let start = { Bed: null, Food: null, Window: null };
  const keys = ["Bed", "Window", "Food"];
  const field = { Bed: "event2", Window: "event1", Food: "event3" };

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const t = row.local_timestamp;
    keys.forEach((loc) => {
      const evt = row[field[loc]];
      if (!evt) return;
      // start
      if (last[loc] === "nothing_detected" && evt === "cat_detected") {
        start[loc] = t;
      }
      // end
      else if (
        last[loc] === "cat_detected" &&
        evt === "nothing_detected" &&
        start[loc]
      ) {
        // peek ahead up to 10 non‑nulls
        let merge = false,
          skip = 0;
        for (let j = i + 1; j < data.length && skip < 10; j++) {
          const next = data[j][field[loc]];
          if (!next) continue;
          skip++;
          if (next === "cat_detected") {
            merge = true;
            break;
          }
          if (next === "nothing_detected") break;
        }
        if (!merge) {
          const dur = Math.round((new Date(t) - new Date(start[loc])) / 1000);
          sessionLog.push({
            startTime: start[loc],
            durationSeconds: dur,
            location: loc,
          });
          start[loc] = null;
        }
      }
      last[loc] = evt;
    });
  }
  return sessionLog;
}


//getting weekly data!
async function fetchWeeklyData(weekKey) {
  console.log("fetchWeeklyData()", weekKey);
  isUserSwitchingWeekly = true;
  showWeeklyLoading();

  try {
    // Get all tabs
    const listRes = await fetch("/catdata?mode=listSheets");
    const allTabs = await listRes.json();
    console.log("dateTabs:", allTabs.slice(0, 10), "...");

    const dateTabs = allTabs.filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name));
    console.log("filtered dateTabs:", dateTabs.slice(0, 10), "...");

    // Build 7-day window
    const today = new Date();
    let start, end;

    if (weekKey === "thisWeek") {
      // last 7 days, including today
      end = new Date(today);
      start = new Date(today);
      start.setDate(today.getDate() - 6);
    } else {
      // weekbefore
      end = new Date(today);
      end.setDate(today.getDate() - 6);
      start = new Date(end);
      start.setDate(end.getDate() - 12);
    }

    const fmt = (d) => d.toISOString().slice(0, 10);
    const startS = fmt(start),
      endS = fmt(end);
    console.log(`week range: ${startS} → ${endS}`);

    //Pick tabs in that range
    const weekTabs = dateTabs.filter((d) => d >= startS && d <= endS);
    console.log("weekTabs:", weekTabs);

    //Fetch each day’s sheet
    const allDataPerDay = await Promise.all(
      weekTabs.map((day) =>
        fetch(`/catdata?sheet=${encodeURIComponent(day)}`).then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status} for ${day}`);
          return r.json();
        })
      )
    );
    console.log(
      "fetched lengths:",
      allDataPerDay.map((arr) => arr.length)
    );

    // Flatten & sort by timestamp!!!
    const allData = allDataPerDay.flat();
    allData.sort(
      (a, b) => new Date(a.local_timestamp) - new Date(b.local_timestamp)
    );
    console.log("allData combined:", allData.length);

    // Turn rows into sessions (re‑use your existing helper)
    const weeklyLog = computeSessionLog(allData);
    console.log("weeklyLog sessions:", weeklyLog.length);

    // Finally redraw
    await updateCharts(weeklyLog);
  } catch (err) {
    console.error("Error fetching weekly data:", err);
  } finally {
    hideWeeklyLoading();
    isUserSwitchingWeekly = false;
  }
}

function updateStatus(
  latest,
  bedDurationSeconds,
  windowDurationSeconds,
  foodDurationSeconds,
  bedFrequency,
  windowFrequency,
  foodFrequency,
  fullData
) {
  const catBed     = document.getElementById("cat-bed");
  const windowSpot = document.getElementById("window");
  const foodBowl   = document.getElementById("food-bowl");

  [catBed, windowSpot, foodBowl].forEach(el => el.classList.remove("active"));

  const bedDetected    = latest.event2 === "cat_detected";
  const windowDetected = latest.event1 === "cat_detected";
  const foodDetected   = latest.event3 === "cat_detected";

  if (bedDetected)    catBed.classList.add("active");
  if (windowDetected) windowSpot.classList.add("active");
  if (foodDetected)   foodBowl.classList.add("active");

  updateBoxText(
    catBed,
    bedDetected,
    bedDurationSeconds,
    findLastDetected(fullData, "event2")
  );
  updateBoxText(
    windowSpot,
    windowDetected,
    windowDurationSeconds,
    findLastDetected(fullData, "event1")
  );
  updateBoxText(
    foodBowl,
    foodDetected,
    foodDurationSeconds,
    findLastDetected(fullData, "event3")
  );
}

//POPULATE THE CHART WITH PROCESSED DATA
async function updateCharts(currentSessionLog) {
  // Wait for each chart to finish drawing before continuing!!! loading
  await drawSessionChart(currentSessionLog);
  const hourlyData = prepareHourlySummary(currentSessionLog);
  await drawHourlyChart(hourlyData);
  await drawPatternChart(currentSessionLog);
  await drawPeakChart(currentSessionLog);
  await drawMovementChart(currentSessionLog);
}


//special data processing for hourly chart
function prepareHourlySummary(sessionLog) {
  // Initialize hourly summary
  const hours = Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, "0")}:00`,
    Bed: 0,
    Food: 0,
    Window: 0,
  }));

  const parseTime = d3.timeParse("%Y-%m-%d %H:%M:%S");

  sessionLog.forEach((session) => {
    const start = parseTime(session.startTime);
    const hour = start.getHours();
    if (session.location === "Bed") {
      hours[hour].Bed += session.durationSeconds;
    } else if (session.location === "Food") {
      hours[hour].Food += session.durationSeconds;
    } else if (session.location === "Window") {
      hours[hour].Window += session.durationSeconds;
    }
  });

  return hours;
}

function findLastDetected(data, eventKey) {
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i][eventKey] === "cat_detected") {
      const rawTime = data[i].local_timestamp;
      const formattedTime = formatReadableTime(rawTime);
      return formattedTime;
    }
  }
  return "-"; // if no detection found
}

function formatReadableTime(timestampStr) {
  const date = new Date(timestampStr);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}
//distributing datas to ui
function updateUI(
  latest,
  bedDurationSeconds,
  windowDurationSeconds,
  foodDurationSeconds,
  bedFrequency,
  windowFrequency,
  foodFrequency,
  sessionLog,
  fullData
) {
  const catBed = document.getElementById("cat-bed");
  const windowSpot = document.getElementById("window");
  const foodBowl = document.getElementById("food-bowl");

  [catBed, windowSpot, foodBowl].forEach((el) => el.classList.remove("active"));

  const bedDetected = latest.event2 === "cat_detected";
  const windowDetected = latest.event1 === "cat_detected";
  const foodDetected = latest.event3 === "cat_detected";

  if (bedDetected) catBed.classList.add("active");
  if (windowDetected) windowSpot.classList.add("active");
  if (foodDetected) foodBowl.classList.add("active");

  updateBoxText(
    catBed,
    bedDetected,
    bedDurationSeconds,
    findLastDetected(fullData, "event2")
  );
  updateBoxText(
    windowSpot,
    windowDetected,
    windowDurationSeconds,
    findLastDetected(fullData, "event1")
  );
  updateBoxText(
    foodBowl,
    foodDetected,
    foodDurationSeconds,
    findLastDetected(fullData, "event3")
  );

  // Draw the charts
  drawSessionChart(sessionLog);
  const hourlyData = prepareHourlySummary(sessionLog);
  drawHourlyChart(hourlyData);
  drawPatternChart(sessionLog);
  drawPeakChart(sessionLog);
  drawMovementChart(sessionLog);
}
//now section filling data
function updateBoxText(box, isActive, durationSeconds, lastDetectedTime) {
  const p = box.querySelector("p");
  const pawLine = isActive ? "🐾<br>" : "";
  const durationMinutes = (durationSeconds / 60).toFixed(1); // rounded to 1 decimal

  p.innerHTML = `
    <span class="label">current status:</span> ${
      isActive ? "cat detected" : "nothing detected"
    }<br>
    <span class="label">last detected:</span> ${lastDetectedTime}<br>
    <span class="label">total duration:</span> ${durationMinutes} min (${durationSeconds} sec)
  `;
}


//drawing all the charts
function drawSessionChart(sessionLog) {
  return new Promise((resolve) => {
    d3.select("#session-chart").html(""); // Clear previous chart

    const container = document.getElementById("session-chart");
    const width = container.clientWidth || 1000;
    const height = 700;
    const margin = { top: 20, right: 30, bottom: 60, left: 60 };

    const parseTime = d3.timeParse("%Y-%m-%d %H:%M:%S");

    // For weekly mode, remap startTimes to time‐of‐day!!!!
    let points = sessionLog
      .map((d) => {
        const dt = parseTime(d.startTime);
        return isUserSwitchingWeekly
          ? {
              startTime: new Date(
                1970,
                0,
                1,
                dt.getHours(),
                dt.getMinutes(),
                dt.getSeconds()
              ),
              duration: d.durationSeconds,
              loc: d.location,
            }
          : { startTime: dt, duration: d.durationSeconds, loc: d.location };
      })
      .filter((d) => d.startTime && d.duration > 0);

    // X‐scale:
    const x = isUserSwitchingWeekly
      ? d3
          .scaleTime()
          .domain([
            new Date(1970, 0, 1, 0, 0, 0),
            new Date(1970, 0, 1, 23, 59, 59),
          ])
          .range([margin.left, width - margin.right])
      : d3
          .scaleTime()
          .domain(d3.extent(points, (d) => d.startTime))
          .range([margin.left, width - margin.right]);

    const data = sessionLog.map((d) => ({
      startTime: parseTime(d.startTime),
      durationSeconds: d.durationSeconds,
      location: d.location,
    }));

    const cleanedData = data.filter(
      (d) => d.startTime && d.durationSeconds > 0 && d.location
    );

    // Y: session duration using log scale
    const y = d3
      .scalePow()
      .exponent(0.3) // sqrt-compression 0.3 ~ 0.7
      .domain([0, d3.max(cleanedData, (d) => d.durationSeconds)])
      .range([height - margin.bottom, margin.top]);

    const shape = d3
      .scaleOrdinal()
      .domain(["Bed", "Food", "Window"])
      .range([d3.symbolCircle, d3.symbolTriangle, d3.symbolSquare]);

    const color = d3
      .scaleOrdinal()
      .domain(["Bed", "Food", "Window"])
      .range(["#D390CE", "#F5AB54", "#60D1DB"]);

    const svg = d3
      .select("#session-chart")
      .append("svg")
      .attr("width", "100%")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("height", height);

    // Draw points
    svg
      .append("g")
      .selectAll("path")
      .data(cleanedData)
      .join("path")
      .attr(
        "transform",
        (d) => `translate(${x(d.startTime)},${y(d.durationSeconds)})`
      )
      .attr(
        "d",
        d3
          .symbol()
          .type((d) => shape(d.location))
          .size(100)
      )
      .attr("fill", (d) => color(d.location));

    // X axis (time)
    svg
      .append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(d3.timeHour.every(1)) // every ? hours
          .tickFormat(d3.timeFormat("%H:%M")) // 24-hour format
          .tickSizeOuter(0)
      );

    // Y axis (log scale, formatted)
    svg
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(
        d3
          .axisLeft(y)
          .ticks(18)
          .tickFormat((d) => `${(d / 60).toFixed(1)} `)
      );
    // Y Axis label
    svg
      .append("text")
      .attr("text-anchor", "middle")
      .attr("transform", `rotate(-90)`)
      .attr("x", -height / 2)
      .attr("y", 15) // distance from the axis
      .text("Duration (min)")
      .style("fill", "#333")
      .style("font-size", "14px");

    // ─── Legend ────────────────────────────────────────────────────────────────
    const legendData = ["Bed", "Food", "Window"];
    const legend = svg
      .append("g")
      .attr(
        "transform",
        `translate(${margin.left},${height - margin.bottom + 40})`
      );

    legendData.forEach((loc, i) => {
      // symbol
      legend
        .append("path")
        .attr("d", d3.symbol().type(shape(loc)).size(100)())
        .attr("transform", `translate(${i * 140}, 0)`)
        .attr("fill", color(loc));

      // label
      legend
        .append("text")
        .attr("x", i * 140 + 10)
        .attr("y", 5)
        .text(loc)
        .style("font-size", "12px")
        .attr("alignment-baseline", "middle");
    });

    resolve();
  });
}

function drawHourlyChart(hourlyData) {
  return new Promise((resolve) => {
    d3.select("#hourly-chart").html(""); // Clear previous chart

    const container = document.getElementById("session-chart");
    const width = container.clientWidth || 1000;
    const height = 600;
    const margin = { top: 20, right: 30, bottom: 60, left: 60 };

    const keys = ["Bed", "Food", "Window"];

    // Stack the data
    const stack = d3.stack().keys(keys).offset(d3.stackOffsetExpand); // Normalize to 100%

    const series = stack(hourlyData);

    const y = d3
      .scaleBand()
      .domain(hourlyData.map((d) => d.hour))
      .rangeRound([margin.top, height - margin.bottom])
      .padding(0.1);

    const x = d3.scaleLinear().rangeRound([margin.left, width - margin.right]);

    const color = d3
      .scaleOrdinal()
      .domain(keys)
      .range(["#D390CE", "#F5AB54", "#60D1DB"]);

    const svg = d3
      .select("#hourly-chart")
      .append("svg")
      .attr("width", "100%")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("height", height);

    svg
      .append("g")
      .selectAll("g")
      .data(series)
      .join("g")
      .attr("fill", (d) => color(d.key))
      .selectAll("rect")
      .data((d) => d)
      .join("rect")
      .attr("y", (d) => y(d.data.hour))
      .attr("x", (d) => x(d[0]))
      .attr("width", (d) => x(d[1]) - x(d[0]))
      .attr("height", y.bandwidth());

    svg
      .append("g")
      .attr("transform", `translate(0,${margin.top})`)
      .call(d3.axisTop(x).ticks(5, "%"));

    svg
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y));

    // Legend 
    const legend = svg
      .append("g")
      .attr(
        "transform",
        `translate(${margin.left},${height - margin.bottom + 40})`
      );

    keys.forEach((key, i) => {
      const x0 = i * 120;
      // color box
      legend
        .append("rect")
        .attr("x", x0)
        .attr("width", 12)
        .attr("height", 12)
        .attr("fill", color(key));
      // label
      legend
        .append("text")
        .attr("x", x0 + 18)
        .attr("y", 10)
        .text(key)
        .style("font-size", "12px")
        .attr("alignment-baseline", "middle");
    });

    resolve();
  });
}

function drawPatternChart(sessionLog) {
  return new Promise((resolve) => {
    d3.select("#pattern-chart").html(""); // Clear previous chart

    const container = document.getElementById("pattern-chart");
    const width = container.clientWidth || 1000;
    const height = 200;
    const margin = { top: 20, right: 30, bottom: 60, left: 80 };

    // parse timestamps & map to either full Date or time‑of‑day
    const parseTime = d3.timeParse("%Y-%m-%d %H:%M:%S");
    const data = sessionLog
      .map((d) => {
        const dt = parseTime(d.startTime);
        return {
          original: dt,
          timeOfDay: new Date(
            1970,
            0,
            1,
            dt.getHours(),
            dt.getMinutes(),
            dt.getSeconds()
          ),
          location: d.location,
        };
      })
      .sort((a, b) => {
        // sort by field
        return (
          (isUserSwitchingWeekly ? a.timeOfDay : a.original) -
          (isUserSwitchingWeekly ? b.timeOfDay : b.original)
        );
      });

    // X scale
    const x = isUserSwitchingWeekly
      ? d3
          .scaleTime()
          .domain([
            new Date(1970, 0, 1, 0, 0, 0),
            new Date(1970, 0, 1, 23, 59, 59),
          ])
          .range([margin.left, width - margin.right])
      : d3
          .scaleTime()
          .domain(d3.extent(data, (d) => d.original))
          .range([margin.left, width - margin.right]);

    //  Y / color / shape as before
    const locations = ["Bed", "Window", "Food"];
    const y = d3
      .scalePoint()
      .domain(locations)
      .range([margin.top, height - margin.bottom])
      .padding(0.5);

    const color = d3
      .scaleOrdinal()
      .domain(locations)
      .range(["#D390CE", "#60D1DB", "#F5AB54"]);

    // build SVG
    const svg = d3
      .select("#pattern-chart")
      .append("svg")
      .attr("width", "100%")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("height", height);

    // line generator picks the correct field
    const line = d3
      .line()
      .x((d) => x(isUserSwitchingWeekly ? d.timeOfDay : d.original))
      .y((d) => y(d.location))
      .curve(d3.curveMonotoneX);

    // draw & animate path
    const path = svg
      .append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#666")
      .attr("stroke-width", 1)
      .attr("d", line);

    const totalLen = path.node().getTotalLength();
    path
      .attr("stroke-dasharray", `${totalLen} ${totalLen}`)
      .attr("stroke-dashoffset", totalLen)
      .transition()
      .duration(3000)
      .ease(d3.easeLinear)
      .attr("stroke-dashoffset", 0);

    // draw circles
    svg
      .append("g")
      .selectAll("circle")
      .data(data)
      .join("circle")
      .attr("cx", (d) => x(isUserSwitchingWeekly ? d.timeOfDay : d.original))
      .attr("cy", (d) => y(d.location))
      .attr("r", 3)
      .attr("fill", (d) => color(d.location));

    // X axis
    svg
      .append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(isUserSwitchingWeekly ? d3.timeHour.every(1) : width / 80)
          .tickFormat(isUserSwitchingWeekly ? d3.timeFormat("%H:%M") : null)
          .tickSizeOuter(0)
      );

    // Y axis
    svg
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y));

    // legend (unchanged)
    const legend = svg
      .append("g")
      .attr(
        "transform",
        `translate(${margin.left},${height - margin.bottom + 40})`
      );
    locations.forEach((loc, i) => {
      const x0 = i * ((width - margin.left - margin.right) / locations.length);
      legend
        .append("circle")
        .attr("cx", x0)
        .attr("cy", 0)
        .attr("r", 6)
        .attr("fill", color(loc));
      legend
        .append("text")
        .attr("x", x0 + 12)
        .attr("y", 0)
        .text(loc)
        .style("font-size", "12px")
        .attr("alignment-baseline", "middle");
    });

    resolve();
  });
}

async function drawPeakChart(sessionLog) {
  // Aggregate total duration per hour for each location
  const locations = ["Bed", "Window", "Food"];
  const parse = d3.timeParse("%Y-%m-%d %H:%M:%S");
  const hourlyByLoc = {};
  locations.forEach((loc) => {
    hourlyByLoc[loc] = Array.from({ length: 24 }, () => 0);
  });
  sessionLog.forEach((d) => {
    const dt = parse(d.startTime);
    if (dt && hourlyByLoc[d.location] !== undefined) {
      hourlyByLoc[d.location][dt.getHours()] += d.durationSeconds;
    }
  });

  // Flatten into a data array
  const heatmapData = [];
  locations.forEach((loc) => {
    hourlyByLoc[loc].forEach((val, h) => {
      heatmapData.push({ location: loc, hour: h, value: val });
    });
  });

  // Clear & set SVG dimensions
  d3.select("#peak-chart").html("");
  const container = document.getElementById("peak-chart");
  const width = container.clientWidth || 800;
  const height = 220;
  const margin = { top: 40, right: 20, bottom: 60, left: 80 };
  const cellSize = (width - margin.left - margin.right) / 24;

  // Scales
  const x = d3
    .scaleBand()
    .domain(d3.range(24))
    .range([margin.left, margin.left + 24 * cellSize]);
  const y = d3
    .scaleBand()
    .domain(locations)
    .range([margin.top, margin.top + locations.length * cellSize])
    .paddingInner(0.1);
  const maxVal = d3.max(heatmapData, (d) => d.value);
  const color = d3
    .scaleLinear()
    .domain([0, maxVal])
    .range(["#DED9D3", "#ee5a36"]);

  // Create SVG
  const svg = d3
    .select("#peak-chart")
    .append("svg")
    .attr("width", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("height", height);

  // 6) Draw heat cells
  svg
    .append("g")
    .selectAll("rect")
    .data(heatmapData)
    .join("rect")
    .attr("class", "cell")
    .attr("x", (d) => x(d.hour))
    .attr("y", (d) => y(d.location))
    .attr("width", cellSize)
    .attr("height", cellSize)
    .attr("fill", (d) => color(d.value));

  // 7) X‑axis (hours)
  svg
    .append("g")
    .attr("transform", `translate(0,${margin.top - 5})`)
    .call(
      d3
        .axisTop(x)
        .tickValues(d3.range(0, 24, 2))
        .tickFormat((d) => d3.format("02")(d) + ":00")
        .tickSizeOuter(0)
    )
    .selectAll("text")
    .style("font-size", "12px");

  // svg.append("text")
  //     .attr("x", margin.left + (24*cellSize)/2)
  //     .attr("y", margin.top - 25)
  //     .attr("text-anchor","middle")
  //     .style("font-size","14px")
  //     .text("Hour of Day");

  // Y‑axis (locations)
  svg
    .append("g")
    .attr("transform", `translate(${margin.left - 5},0)`)
    .call(d3.axisLeft(y).tickSizeOuter(0))
    .selectAll("text")
    .style("font-size", "12px");

  // svg.append("text")
  //     .attr("transform","rotate(-90)")
  //     .attr("x", - (margin.top + locations.length*cellSize/2))
  //     .attr("y", margin.left - 60)
  //     .attr("text-anchor","middle")
  //     .style("font-size","14px")
  //     .text("Location");

  // Legend
  const legendWidth = 400;
  const legendHeight = 10;
  const legendScale = d3
    .scaleLinear()
    .domain([0, maxVal])
    .range([0, legendWidth]);
  const legendAxis = d3
    .axisBottom(legendScale)
    .ticks(5)
    .tickFormat((d) => (d / 60).toFixed(1) + " min");

  const defs = svg.append("defs");
  const grad = defs.append("linearGradient").attr("id", "grad-peak");
  grad
    .selectAll("stop")
    .data(d3.range(0, 1.01, 0.1))
    .enter()
    .append("stop")
    .attr("offset", (t) => t)
    .attr("stop-color", (t) => color(t * maxVal));

  const legend = svg
    .append("g")
    .attr(
      "transform",
      `translate(${width - margin.right - legendWidth}, ${height - 40})`
    );

  legend
    .append("rect")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .style("fill", "url(#grad-peak)");

  legend
    .append("g")
    .attr("transform", `translate(0,${legendHeight})`)
    .call(legendAxis)
    .selectAll("text")
    .style("font-size", "12px");

  legend
    .append("text")
    .attr("x", legendWidth / 2)
    .attr("y", legendHeight + 30)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Total Duration");
}

async function drawMovementChart(sessionLog) {
  // clear out any old diagram
  d3.select("#movement-chart").html("");

  // sizing
  const container = document.getElementById("movement-chart");
  const width = container.clientWidth || 600;
  const height = container.clientHeight || 600;
  const innerRadius = Math.min(width, height) * 0.4;
  const outerRadius = innerRadius * 1.1;

  // SVG + group centered
  const svg = d3
    .select("#movement-chart")
    .append("svg")
    .attr("width", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("height", height)
    .append("g")
    .attr("transform", `translate(${width / 2},${height / 2})`);
  const tooltip = d3.select("#tooltip");
  // build a 3×3 transition count matrix
  const locs = ["Bed", "Food", "Window"];
  const idx = { Bed: 0, Food: 1, Window: 2 };
  const matrix = Array.from({ length: 3 }, () => [0, 0, 0]);

  // sort by timestamp
  const parse = d3.timeParse("%Y-%m-%d %H:%M:%S");
  const sorted = sessionLog
    .map((d) => ({ ...d, date: parse(d.startTime) }))
    .sort((a, b) => a.date - b.date);

  for (let i = 1; i < sorted.length; i++) {
    const from = sorted[i - 1].location;
    const to = sorted[i].location;
    if (from !== to) matrix[idx[from]][idx[to]]++;
  }

  // chord layout
  const chord = d3.chordDirected().padAngle(0.05).sortSubgroups(d3.descending)(
    matrix
  );

  // arc + ribbon generators
  const arc = d3.arc().innerRadius(innerRadius).outerRadius(outerRadius);
  const ribbon = d3
    .ribbonArrow() // ← use ribbonArrow, not ribbonDirected
    .radius(innerRadius);

  // color
  const color = d3
    .scaleOrdinal()
    .domain([0, 1, 2])
    .range(["#D390CE", "#F5AB54", "#60D1DB"]);

  // draw outer arcs
  const group = svg.append("g").selectAll("g").data(chord.groups).join("g");

  group
    .append("path")
    .attr("d", arc)
    .attr("fill", (d) => color(d.index))
    .attr("stroke", (d) => d3.rgb(color(d.index)).darker());

  // group labels
  group
    .append("text")
    .each((d) => (d.angle = (d.startAngle + d.endAngle) / 2))
    .attr("dy", "0.35em")
    .attr(
      "transform",
      (d) => `
        rotate(${(d.angle * 180) / Math.PI - 90})
        translate(${outerRadius + 5})
        ${d.angle > Math.PI ? "rotate(180)" : ""}
      `
    )
    .attr("text-anchor", (d) => (d.angle > Math.PI ? "end" : "start"))
    .text((d) => locs[d.index]);

  // draw the directed ribbons
  svg
    .append("g")
    .selectAll("path")
    .data(chord)
    .join("path")
    .attr("d", ribbon)
    .attr("fill", (d) => color(d.source.index))
    .attr("stroke", (d) => d3.rgb(color(d.source.index)).darker())
    .attr("fill-opacity", 0.5)
    .attr("stroke-opacity", 0.5)
    .on("mouseover", (event, d) => {
      // show tooltip with count
      tooltip.style("display", "block").html(`
          <strong>${locs[d.source.index]} → ${
        locs[d.target.index]
      }</strong><br/>
          ${d.source.value} moves
        `);
    })
    .on("mousemove", (event) => {
      tooltip
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY + 10 + "px");
    })
    .on("mouseout", () => {
      tooltip.style("display", "none");
    });
}

// setInterval(fetchCatData, 3000);
populateDateFilter();
fetchCatData();

document.getElementById("date-filter").addEventListener("change", (e) => {
  const selectedDate = e.target.value;
  if (selectedDate) {
    isUserSwitchingDate = true;
    showSwitchingLoading(); // Show switch loading
    fetchChartDataOnly(selectedDate);
  }
});