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

   // Last non-null durations
    const lastValidDuration2Row = [...data].reverse().find(row => row.duration2 && row.duration2 !== "null");
    const lastValidDuration1Row = [...data].reverse().find(row => row.duration1 && row.duration1 !== "null");

    updateUI(
      latest,
      lastEvent2Row,
      lastEvent1Row,
      lastValidDuration2Row,
      lastValidDuration1Row,
    );
  } catch (err) {
    console.error("Error fetching cat data:", err);
  }
}

function updateUI(
  latest,
  bedLog,
  windowLog,
  bedDurationRow,
  windowDurationRow,
) {
  const catBed = document.getElementById('cat-bed');
  const windowSpot = document.getElementById('window');
  const foodBowl = document.getElementById('food-bowl');

  [catBed, windowSpot, foodBowl].forEach(el => el.classList.remove('active'));

  const bedDetected = latest.event2 === "cat_detected";
  const windowDetected = latest.event1 === "cat_detected";
  const foodDetected = latest.Location === "Food Bowl";

  if (bedDetected) catBed.classList.add('active');
  if (windowDetected) windowSpot.classList.add('active');
  if (foodDetected) foodBowl.classList.add('active');

  // CAT BED
  updateBoxText(
    catBed,
    bedLog?.local_timestamp || "-",
    bedDurationRow?.duration2 || "-",
    bedDetected,
    bedDetected ? "Cat Detected" : "Nothing Detected"
  );

  // WINDOW
  updateBoxText(
    windowSpot,
    windowLog?.local_timestamp || "-",
    windowDurationRow?.duration1 || "-",
    windowDetected,
    windowDetected ? "Cat Detected" : "Nothing Detected"
  );

  // FOOD BOWL

}




function updateBoxText(box, time, duration, showPaw = false, status = "-") {
  const p = box.querySelector('p');
  const pawLine = showPaw ? "🐾<br>" : "";
  p.innerHTML = `${pawLine}Current status:<br>${status}<br>Last active:<br>${time}<br>Duration:<br>${duration}`;
}

setInterval(fetchCatData, 3000);
fetchCatData();
