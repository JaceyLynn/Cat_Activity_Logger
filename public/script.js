const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbyX43LlCbY9Z1XXowkOhi18ksW8ez94HJQLOvsJp1NWwrnFpMUqyjxDMvFt0sLUkGM8ig/exec";

async function fetchCatData() {
  try {
    const res = await fetch("/catdata");
    const data = await res.json();

    if (!data || !Array.isArray(data) || data.length === 0) {
      console.warn("No data found in sheet.");
      return;
    }

    // Get the latest (last) row of data
    const latest = data[data.length - 1];

    console.log("Latest cat activity:", latest);
    
        // Look backward to find the latest CAT DETECTED rows per sensor
    const lastEvent2Row = [...data].reverse().find(row => row.event2 === "cat_detected");
    const lastEvent1Row = [...data].reverse().find(row => row.event1 === "cat_detected");

    updateUI(latest, lastEvent2Row, lastEvent1Row);
  } catch (err) {
    console.error("Error fetching cat data:", err);
  }
}

function updateUI(latest, bedLog, windowLog, foodLog) {
  const catBed = document.getElementById('cat-bed');
  const windowSpot = document.getElementById('window');
  const foodBowl = document.getElementById('food-bowl');

  [catBed, windowSpot, foodBowl].forEach(el => el.classList.remove('active'));

  // CAT BED
  const bedDetected = latest.event2 === "cat_detected";
  if (bedDetected) {
    catBed.classList.add('active');
  }
  updateBoxText(
    catBed,
    bedLog?.local_timestamp || "-",
    bedLog?.duration2 || "-",
    bedDetected,
    bedDetected ? "Cat Detected" : "Nothing Detected"
  );

  // WINDOW
  const windowDetected = latest.event1 === "cat_detected";
  if (windowDetected) {
    windowSpot.classList.add('active');
  }
  updateBoxText(
    windowSpot,
    windowLog?.local_timestamp || "-",
    windowLog?.duration1 || "-",
    windowDetected,
    windowDetected ? "Cat Detected" : "Nothing Detected"
  );

  // FOOD BOWL
  const foodDetected = latest.Location === "Food Bowl";
  if (foodDetected) {
    foodBowl.classList.add('active');
  }
  updateBoxText(
    foodBowl,
    foodLog?.local_timestamp || "-",
    foodLog?.Duration || "-",
    foodDetected,
    foodDetected ? "Cat Detected" : "Nothing Detected"
  );
}



function updateBoxText(box, time, duration, showPaw = false, status = "-") {
  const p = box.querySelector('p');
  const pawLine = showPaw ? "🐾<br>" : "";
  p.innerHTML = `${pawLine}Current status:<br>${status}<br>Last active:<br>${time}<br>Duration:<br>${duration}`;
}

setInterval(fetchCatData, 3000);
fetchCatData();
