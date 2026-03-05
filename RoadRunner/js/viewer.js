import { db } from "./firebase.js";
import { ref, onValue, set, remove, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const BASE_URL = window.location.origin;
let map;
const markers = {};
const polylines = {};
let editingTripId = null;
let allTripsData = {};

/* ===== DOM ===== */
const leaderEl = document.getElementById("leaderEl");
const driverEl = document.getElementById("driverEl");
const cabEl = document.getElementById("cabEl");
const dateEl = document.getElementById("dateEl");
const pickupEl = document.getElementById("pickupEl");
const timeEl = document.getElementById("timeEl");
const dropEl = document.getElementById("dropEl");
const atDisp = document.getElementById("atDisp");
const coordinatorName = document.getElementById("coordinatorName");
const coordinatorCode = document.getElementById("coordinatorCode");
const tripsDiv = document.getElementById("cards");
const addTripBtn = document.getElementById("add-trip-btn");
const tripModal = document.getElementById("trip-modal");
const cancelBtn = document.getElementById("cancel-btn");
const saveBtn = document.getElementById("save-btn");
const databaseBtn = document.getElementById("database-btn");
const databaseModal = document.getElementById("database-modal");
const closeDatabaseBtn = document.getElementById("close-db-btn");
const databaseTbody = document.getElementById("database-tbody");
const exportCsvBtn = document.getElementById("export-csv-btn");

// Summary elements
const sumTotal = document.getElementById("sum-total");
const sumActive = document.getElementById("sum-active");
const sumEnded = document.getElementById("sum-ended");

/* ===== MAP INIT ===== */
function initMap() {
  map = new google.maps.Map(document.getElementById("trips-map"), {
    center: { lat: 20.5937, lng: 78.9629 },
    zoom: 5
  });
  listenFirebase();
}

function waitForMaps() {
  if (window.google && window.google.maps) initMap();
  else setTimeout(waitForMaps, 100);
}
waitForMaps();

/* ===== MODALS ===== */
addTripBtn.addEventListener("click", () => {
  editingTripId = null;
  leaderEl.value = "";
  driverEl.value = "";
  cabEl.value = "";
  dateEl.value = "";
  pickupEl.value = "";
  timeEl.value = "";
  dropEl.value = "";
  atDisp.checked = false;
  coordinatorName.value = "";
  coordinatorCode.value = "";
  tripModal.classList.add("active");
});

cancelBtn.addEventListener("click", () => {
  tripModal.classList.remove("active");
  editingTripId = null;
});

saveBtn.addEventListener("click", () => {
  const tripData = {
    leaderName: leaderEl.value,
    driverName: driverEl.value,
    cabNumber: cabEl.value,
    travelDate: dateEl.value,
    pickup: pickupEl.value,
    pickupTime: timeEl.value,
    drop: dropEl.value,
    atDisposal: atDisp.checked,
    coordinatorName: coordinatorName.value,
    coordinatorCode: coordinatorCode.value,
    updatedAt: Date.now()
  };

  if (editingTripId) {
    update(ref(db, "trips/" + editingTripId), tripData);
  } else {
    const id = Date.now().toString();
    set(ref(db, "trips/" + id), {
      ...tripData,
      status: "active",
      createdAt: Date.now()
    });
  }

  tripModal.classList.remove("active");
  editingTripId = null;
});

/* ===== DATABASE MODAL ===== */
databaseBtn.addEventListener("click", () => {
  populateDatabaseTable();
  databaseModal.classList.add("active");
});

closeDatabaseBtn.addEventListener("click", () => {
  databaseModal.classList.remove("active");
});

databaseModal.addEventListener("click", (e) => {
  if (e.target === databaseModal) {
    databaseModal.classList.remove("active");
  }
});

function populateDatabaseTable() {
  databaseTbody.innerHTML = "";
  
  Object.entries(allTripsData).forEach(([id, trip]) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${id.slice(-8)}</td>
      <td>${trip.coordinatorName || "N/A"}</td>
      <td>${trip.coordinatorCode || "N/A"}</td>
      <td>${trip.leaderName || "N/A"}</td>
      <td>${trip.driverName || "N/A"}</td>
      <td>${trip.cabNumber || "N/A"}</td>
      <td>${trip.travelDate || "N/A"}</td>
      <td>${trip.pickup || "N/A"}</td>
      <td>${trip.pickupTime || "N/A"}</td>
      <td>${trip.drop || "N/A"}</td>
      <td>${trip.atDisposal ? "Yes" : "No"}</td>
      <td><span class="status-badge-table status-${trip.status}">${trip.status || "active"}</span></td>
    `;
    databaseTbody.appendChild(row);
  });
}

/* ===== ACTIONS ===== */
window.copyLink = (l) => {
  navigator.clipboard.writeText(l);
  showNotification("Link copied to clipboard!");
};

window.editTrip = (id, tripData) => {
  editingTripId = id;
  leaderEl.value = tripData.leaderName || "";
  driverEl.value = tripData.driverName || "";
  cabEl.value = tripData.cabNumber || "";
  dateEl.value = tripData.travelDate || "";
  pickupEl.value = tripData.pickup || "";
  timeEl.value = tripData.pickupTime || "";
  dropEl.value = tripData.drop || "";
  atDisp.checked = tripData.atDisposal || false;
  coordinatorName.value = tripData.coordinatorName || "";
  coordinatorCode.value = tripData.coordinatorCode || "";
  tripModal.classList.add("active");
};

window.endTrip = (id) => {
  if (confirm("End this trip?")) {
    update(ref(db, "trips/" + id), { status: "ended", updatedAt: Date.now() });
    showNotification("Trip ended - removed from cards, saved in database!");
  }
};

/* ===== NOTIFICATION ===== */
function showNotification(message) {
  const notification = document.createElement("div");
  notification.style.cssText = `
    position: fixed;
    top: 150px;
    right: 40px;
    background: linear-gradient(135deg, #10B981, #059669);
    color: #001b20;
    padding: 16px 24px;
    border-radius: 12px;
    font-weight: 700;
    z-index: 10000;
    box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4);
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => notification.remove(), 3000);
}

/* ===== CSV EXPORT ===== */
exportCsvBtn.addEventListener("click", () => {
  const csvData = convertToCSV(allTripsData);
  downloadCSV(csvData, `RoadRunner_Trips_${new Date().toISOString().split('T')[0]}.csv`);
  showNotification("Data exported successfully!");
});

function convertToCSV(trips) {
  const headers = [
    "Trip ID",
    "Coordinator Name",
    "Coordinator Code",
    "Leader Name",
    "Driver Name",
    "Cab Number",
    "Travel Date",
    "Pickup Location",
    "Pickup Time",
    "Drop Location",
    "At Disposal",
    "Status",
    "Created At",
    "Updated At"
  ];

  const rows = Object.entries(trips).map(([id, trip]) => [
    id,
    trip.coordinatorName || "N/A",
    trip.coordinatorCode || "N/A",
    trip.leaderName || "N/A",
    trip.driverName || "N/A",
    trip.cabNumber || "N/A",
    trip.travelDate || "N/A",
    trip.pickup || "N/A",
    trip.pickupTime || "N/A",
    trip.drop || "N/A",
    trip.atDisposal ? "Yes" : "No",
    trip.status || "active",
    new Date(trip.createdAt).toLocaleString(),
    trip.updatedAt ? new Date(trip.updatedAt).toLocaleString() : "N/A"
  ]);

  return [headers, ...rows].map(row => 
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
  ).join("\n");
}

function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/* ===== HELPER: GEOCODE ADDRESS ===== */
const geocodeCache = {};
async function geocode(address) {
  if (geocodeCache[address]) {
    return geocodeCache[address];
  }
  
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=AIzaSyAjpGN4ickxPdE7kqmapEm65d-tnH4iLrQ`
    );
    const data = await res.json();
    const result = data.results?.[0]?.geometry?.location;
    if (result) {
      geocodeCache[address] = result;
    }
    return result;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

/* ===== FIREBASE LISTENER - FIXED FOR NO BLINKING ===== */
let lastRenderedData = {};

function listenFirebase() {
  onValue(ref(db), async snap => {
    const data = snap.val() || {};
    allTripsData = data.trips || {};
    
    // Calculate summary stats
    const trips = Object.entries(allTripsData);
    const totalTrips = trips.length;
    const activeTrips = trips.filter(([_, t]) => t.status === "active").length;
    const endedTrips = trips.filter(([_, t]) => t.status === "ended").length;

    // Update summary
    sumTotal.textContent = totalTrips;
    sumActive.textContent = activeTrips;
    sumEnded.textContent = endedTrips;

    // ONLY SHOW ACTIVE TRIPS IN CARDS
    const activeTripsOnly = trips.filter(([_, t]) => t.status === "active");
    
    // Get current card IDs
    const currentCardIds = Array.from(tripsDiv.querySelectorAll('.trip-card'))
      .map(card => card.getAttribute('data-trip-id'));
    
    // Get new trip IDs
    const newTripIds = activeTripsOnly.map(([id]) => id);
    
    // Remove cards for trips that are ended or deleted
    currentCardIds.forEach(id => {
      if (!newTripIds.includes(id)) {
        const cardToRemove = tripsDiv.querySelector(`[data-trip-id="${id}"]`);
        if (cardToRemove) {
          cardToRemove.remove();
          delete lastRenderedData[id];
        }
      }
    });

    // Update or create cards for active trips
    for (const [id, t] of activeTripsOnly) {
      const loc = data.locations?.[id];
      const dataString = JSON.stringify({ t, loc });
      
      // Only update if data actually changed
      if (lastRenderedData[id] !== dataString) {
        lastRenderedData[id] = dataString;
        
        let card = tripsDiv.querySelector(`[data-trip-id="${id}"]`);
        
        if (!card) {
          // Create new card
          card = createTripCard(id, t, loc);
          tripsDiv.appendChild(card);
        } else {
          // Update existing card content
          updateTripCard(card, id, t, loc);
        }
      }

      // Update marker (always, for location changes)
      updateMarker(id, t, loc);
      
      // Update trajectory
      await updateTrajectory(id, t, loc);
    }
  });
}

/* ===== CREATE TRIP CARD ===== */
function createTripCard(id, t, loc) {
  const driverLink = `${BASE_URL}/driver.html?id=${id}`;
  const shortLink = `driver.html?id=${id.slice(-8)}`;

  const card = document.createElement("div");
  card.className = "trip-card";
  card.setAttribute("data-trip-id", id);
  
  const statusBadge = '<div class="trip-badge"><div class="badge-pulse"></div>ACTIVE</div>';
  
  card.innerHTML = `
    <div class="trip-card-header">
      <div class="trip-callsign">${t.cabNumber || "N/A"}</div>
      ${statusBadge}
    </div>
    
    <div class="trip-leader">Leader: ${t.leaderName}</div>
    
    <div class="route-display">${t.pickup} → ${t.drop}</div>
    <div class="time-display">${t.travelDate} • ${t.pickupTime}</div>
    
    <div class="trip-info-grid">
      <div class="trip-info-item">
        <div class="trip-info-label">Driver</div>
        <div class="trip-info-value">${t.driverName}</div>
      </div>
      
      <div class="trip-info-item">
        <div class="trip-info-label">Coordinator</div>
        <div class="trip-info-value">${t.coordinatorName || "N/A"}</div>
      </div>
      
      <div class="trip-info-item">
        <div class="trip-info-label">Employee Code</div>
        <div class="trip-info-value">${t.coordinatorCode || "N/A"}</div>
      </div>
      
      <div class="trip-info-item">
        <div class="trip-info-label">At Disposal</div>
        <div class="trip-info-value">${t.atDisposal ? "Yes" : "No"}</div>
      </div>
    </div>

    <div class="trip-link-box">
      <span class="link-icon">🔗</span>
      <span class="link-text">${shortLink}</span>
    </div>

    <div class="trip-actions">
      <button onclick='copyLink("${driverLink}")'>Copy Link</button>
      <button onclick='editTrip("${id}", ${JSON.stringify(t).replace(/'/g, "\\'")})'}>Edit</button>
      <button onclick="endTrip('${id}')">End Trip</button>
    </div>
  `;

  // Click card to zoom
  card.addEventListener("click", (e) => {
    if (e.target.tagName === "BUTTON") return;
    if (markers[id]) {
      map.setCenter(markers[id].getPosition());
      map.setZoom(17);
    }
  });

  return card;
}

/* ===== UPDATE TRIP CARD ===== */
function updateTripCard(card, id, t, loc) {
  // Cards for active trips don't need status updates
  // Just keep them as-is since they're always active
}

/* ===== UPDATE MARKER - RED GOOGLE MAPS STYLE ===== */
function updateMarker(id, t, loc) {
  if (loc) {
    const pos = { lat: loc.lat, lng: loc.lng };
    if (!markers[id]) {
      // Default RED Google Maps marker
      markers[id] = new google.maps.Marker({ 
        map, 
        position: pos,
        title: `${t.driverName} - ${t.cabNumber}`
        // No custom icon = default red marker
      });
    } else {
      markers[id].setPosition(pos);
    }
  }
}

/* ===== UPDATE TRAJECTORY ===== */
async function updateTrajectory(id, t, loc) {
  if (t.pickup && t.drop) {
    // Only geocode if we haven't already
    if (!polylines[id]) {
      const pickupLoc = await geocode(t.pickup);
      const dropLoc = await geocode(t.drop);

      if (pickupLoc && dropLoc) {
        console.log(`✅ Drawing trajectory for ${t.cabNumber}: ${t.pickup} → ${t.drop}`);
        
        polylines[id] = new google.maps.Polyline({
          path: [pickupLoc, dropLoc],
          strokeColor: "#10B981",
          strokeOpacity: 0.8,
          strokeWeight: 4,
          map
        });

        // Deviation alert
        if (loc) {
          checkDeviation(id, t, loc, polylines[id]);
        }
      } else {
        console.warn(`❌ Could not geocode locations for ${t.cabNumber}`);
      }
    } else {
      // Polyline exists, just check deviation
      if (loc) {
        checkDeviation(id, t, loc, polylines[id]);
      }
    }
  }
}

/* ===== CHECK DEVIATION ===== */
function checkDeviation(id, t, loc, polyline) {
  const driverPos = new google.maps.LatLng(loc.lat, loc.lng);
  const distanceResult = google.maps.geometry.spherical.computeDistanceToLine(
    driverPos,
    polyline
  );
  const distance = Math.round(distanceResult.distance);

  if (distance > 500) {
    console.warn(`⚠️ DEVIATION: ${t.driverName} is ${distance}m off route`);
    showDeviationAlert(t.driverName, distance);
  }
}

/* ===== SHOW DEVIATION ALERT ===== */
let lastAlertTime = {};
function showDeviationAlert(driverName, distance) {
  const now = Date.now();
  // Only show alert once per minute per driver
  if (lastAlertTime[driverName] && (now - lastAlertTime[driverName]) < 60000) {
    return;
  }
  lastAlertTime[driverName] = now;
  
  const alertDiv = document.createElement("div");
  alertDiv.style.cssText = `
    position: fixed;
    top: 150px;
    right: 40px;
    background: linear-gradient(135deg, #F59E0B, #D97706);
    color: #fff;
    padding: 16px 24px;
    border-radius: 12px;
    font-weight: 700;
    z-index: 10000;
    box-shadow: 0 8px 24px rgba(245, 158, 11, 0.4);
  `;
  alertDiv.innerHTML = `⚠️ ${driverName} deviated ${distance}m from route`;
  document.body.appendChild(alertDiv);
  
  setTimeout(() => alertDiv.remove(), 5000);
}
