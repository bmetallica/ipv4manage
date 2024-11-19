// public/scripts.js
const socket = io();

// Create address space
document.getElementById('create-space').addEventListener('click', async () => {
  const cidr = document.getElementById('cidr').value;
  const name = document.getElementById('name').value;

  try {
    const response = await axios.post('/api/address-space', { cidr, name });
    alert('Address Space created!');
  } catch (error) {
    alert('Error: ' + error.message);
  }
});

// Handle Address Space dropdown
socket.on('address-space-created', () => {
  populateAddressSpaceDropdown();
});

// Event Listener für das Ein-/Ausblenden von Spalten
document.querySelectorAll('.toggle-column').forEach(checkbox => {
  checkbox.addEventListener('change', (event) => {
    const column = event.target.dataset.column;
    const isChecked = event.target.checked;

    // Hole alle Zellen in der entsprechenden Spalte
    document.querySelectorAll(`#ip-table tbody tr`).forEach(row => {
      const cell = row.children[column];
      if (cell) {
        cell.style.display = isChecked ? '' : 'none';
     }
    });

    // Verstecke auch die Spaltenüberschrift
    const headerCell = document.querySelector(`#ip-table thead tr th:nth-child(${+column + 1})`);
    if (headerCell) {
      headerCell.style.display = isChecked ? '' : 'none';
    }
  });
});



async function populateAddressSpaceDropdown() {
  const response = await axios.get('/api/address-spaces');
  const dropdown = document.getElementById('address-space-dropdown');
  dropdown.innerHTML = ''; // Clear existing options
  response.data.forEach(space => {
    const option = document.createElement('option');
    option.value = space.id;
    option.innerText = space.name;
    dropdown.appendChild(option);
  });
      // Wähle den ersten Adressraum aus, wenn welche vorhanden sind
      dropdown.selectedIndex = 0; // Setzt die Auswahl auf den ersten Eintrag

      // Sende sofort eine Anfrage, um die IPs für den ersten Adressraum abzurufen
      const firstSpaceId = response.data[0].id;
//console.log(firstSpaceId);
      upt(firstSpaceId);
}

// Scan Address Space
document.getElementById('scan-space').addEventListener('click', async () => {
alert('Achtung der Scan wird im Hintergrund durchgeführt');
  const spaceId = document.getElementById('address-space-dropdown').value;
  await axios.post(`/api/scan/${spaceId}`);
  alert('Scan fertig!');
upt(spaceId);
});

document.getElementById('mac-save').addEventListener('click', async () => {
  const spaceId = document.getElementById('address-space-dropdown').value;
  await axios.post(`/api/macsave/${spaceId}`);
  alert('MACs übertragen');
});


// Auto-scan checkbox
document.getElementById('auto-scan').addEventListener('change', (event) => {
const selectedAddressSpace = document.getElementById('address-space-dropdown').value;
 if (event.target.checked) {
    // Checkbox aktiviert, Update in der Datenbank
//console.log(222);
 updateScanValue(selectedAddressSpace, 1);
  } else {
    // Checkbox deaktiviert, Update in der Datenbank
    updateScanValue(selectedAddressSpace, 0);
  }
});

// Funktion zum Update des Scan-Werts in der Datenbank
function updateScanValue(addressSpaceId, scanValue) {
  fetch('/update-scan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      address_space_id: addressSpaceId,
      scan_value: scanValue
    }),
  })
  .then(response => response.json())
  .then(data => {
    console.log('Scan-Wert erfolgreich aktualisiert:', data);
  })
  .catch(error => {
    console.error('Fehler beim Update des Scan-Werts:', error);
  });
}



// Dropdown für address spaces
document.getElementById('address-space-dropdown').addEventListener('change', (event) => {
  const addressSpaceId = event.target.value;
  
  // Überprüfen, ob der Scan-Wert in der Datenbank auf 1 gesetzt ist
  fetch(`/check-scan-value/${addressSpaceId}`)
    .then(response => response.json())
    .then(data => {
      if (data.scan === 1) {
        document.getElementById('auto-scan').checked = true;
      } else {
        document.getElementById('auto-scan').checked = false;
      }
    })
    .catch(error => {
      console.error('Fehler beim Abrufen des Scan-Werts:', error);
    });
});



// Populating IP Table with colored rows
socket.on('address-space-updated', (data) => {

  // Prüfen, ob `data.ips` ein Array ist
  if (!data || !Array.isArray(data.ips)) {
    console.error('Ungültige Datenstruktur für `data.ips`:', data.ips);
    return; // Beende die Funktion, wenn die Daten ungültig sind
  }


  const tableBody = document.getElementById('ip-table').getElementsByTagName('tbody')[0];
  tableBody.innerHTML = ''; // Clear previous rows
console.log(`Porpulating`, data.ips)
  data.ips.forEach(ip => {
    const row = document.createElement('tr');
    row.classList.add(getRowStatusClass(ip.status));  // Assign a color class based on the status

    // Highlight the MAC columns if they differ
    const mac_aktClass = ip.mac_akt !== ip.mac_save ? 'mac-differenz' : '';

    row.innerHTML = `
      <td>${ip.ip}</td>
      <td class="${mac_aktClass}">${ip.mac_akt}</td>
      <td class="${mac_aktClass}">${ip.mac_save}</td>
      <td>${ip.hersteller}</td>
      <td>${ip.status}</td>
      <td>${ip.type}</td>
      <td>${ip.hardware}</td>
      <td>${ip.name}</td>
      <td>${ip.location}</td>
      <td>${ip.comment}</td>
      <td><button onclick="scanIp('${ip.ip}')">Scan</button></td>
    `;
    
    tableBody.appendChild(row);
  });
});

// Function to get the appropriate class for the status
function getRowStatusClass(status, mac_akt) {
  if (status === 'belegt') {
    return 'status-belegt';
  } else if (status === 'frei') {
    //const mac_akt = document.querySelector(`#mac_akt`);
//console.log(`ma:`, mac_akt);
if (mac_akt !== "-") {
//    if (mac_akt && mac_akt.textContent.trim() !== "") {
      return 'status-frei-mit-mac';
    }
    return 'status-frei';
  }
  return 'status-unknown';
}

// Scan a specific IP
//const socket = io();
function scanIp(ip) {
  document.getElementById('scan-popup').style.display = 'block';
        document.getElementById('scan-output').textContent = 'Scan läuft...';

        // Sende Anfrage an den Server, um den Nmap-Scan zu starten
        socket.emit('scan-start', ip);

        // Empfange Fortschritt des Scans und zeige ihn im Popup
        socket.on('scan-progress', (data) => {
            document.getElementById('scan-output').textContent += data;
        });

        // Empfange das Ende des Scans
        socket.on('scan-finished', (message) => {
            document.getElementById('scan-output').textContent += '\n' + message;
        });
    }

  // Funktion zum Schließen des Popups
    function closePopup() {
        document.getElementById('scan-popup').style.display = 'none';
    }


// Funktion, um das Dropdown mit den Adressräumen zu füllen
async function populateAddressSpaceDropdown() {
  try {
    const response = await axios.get('/api/address-spaces'); // Anfrage an das Backend
    const dropdown = document.getElementById('address-space-dropdown');
    dropdown.innerHTML = ''; // Vorherige Optionen entfernen

    if (response.data.length > 0) {
      // Wenn Adressräume gefunden wurden, füge sie als Optionen hinzu
      response.data.forEach(space => {
        const option = document.createElement('option');
        option.value = space.name;  // Der Wert der Option ist die ID des Adressraums
        window.currentSpace = space.name; 
console.log(`fuelle:`, window.currentSpace);
       option.innerText = space.name;  // Der Text der Option ist der Name des Adressraums
        dropdown.appendChild(option);
      });
dropdown.selectedIndex = 0;
const firstSpaceId = response.data[0].name;
console.log(firstSpaceId);
upt(firstSpaceId);
    } else {
      // Wenn keine Adressräume vorhanden sind, zeige eine entsprechende Nachricht an
      const option = document.createElement('option');
      option.innerText = 'Keine Adressräume verfügbar';
      dropdown.appendChild(option);
    }
  } catch (error) {
    console.error('Fehler beim Befüllen des Dropdowns:', error);
  }
}

// Aufruf der Funktion, um das Dropdown zu befüllen
populateAddressSpaceDropdown();
// Event Listener für die Auswahl eines Addressraums im Dropdown
document.getElementById('address-space-dropdown').addEventListener('change', async () => {
  const spaceId = document.getElementById('address-space-dropdown').value;
  if (spaceId) {
    try {
      // Anfrage an das Backend senden, um die zugehörigen Daten für den Addressraum zu erhalten
      const response = await axios.get(`/api/address-space/${spaceId}`);
      const data = response.data;
   // Anfrage, um den Scan-Wert des Addressraums zu prüfen
      const scanResponse = await fetch(`/check-scan-value/${spaceId}`);
      const scanData = await scanResponse.json();
console.log(scanData.scan); 

if (Number(scanData.scan) === 1) {
        document.getElementById('auto-scan').checked = true;
      } else {
        document.getElementById('auto-scan').checked = false;
      }


      updateIpTable(data.ips, spaceId);
    } catch (error) {
      console.error('Fehler beim Abrufen der Daten:', error);
    }
  }
});

async function upt(spaceId){
   try {
      // Anfrage an das Backend senden, um die zugeh      rigen Daten f      r den Addressraum zu erhalten

      window.currentSpace = spaceId;
      const response = await axios.get(`/api/address-space/${spaceId}`);
      const data = response.data;
//console.log(`upt`, window.currentSpace);
      // Hier kannst du die Funktion aufrufen, um die Haupttabelle zu f      llen
      updateIpTable(data.ips, spaceId);
 document.querySelectorAll('.toggle-column').forEach(checkbox => {
        const column = checkbox.dataset.column;
        const isChecked = checkbox.checked;

        // Hole alle Zellen in der entsprechenden Spalte und wende den Zustand an
        document.querySelectorAll(`#ip-table tbody tr`).forEach(row => {
            const cell = row.children[column];
            if (cell) {
                cell.style.display = isChecked ? '' : 'none';
            }
        });

        // Verstecke auch die Spaltenüberschrift
        const headerCell = document.querySelector(`#ip-table thead tr th:nth-child(${+column + 1})`);
        if (headerCell) {
            headerCell.style.display = isChecked ? '' : 'none';
        }
    });
    } catch (error) {
      console.error('Fehler beim Abrufen der Daten:', error);
    }
  
};


function updateIpTable(ips, spaceId) {
  const tableBody = document.getElementById('ip-table').getElementsByTagName('tbody')[0];
  tableBody.innerHTML = ''; // Lösche vorherige Tabelleninhalte
  window.currentSpace = spaceId;
  ips.forEach(ip => {
    const row = document.createElement('tr');
    row.classList.add(getRowStatusClass(ip.status, ip.mac_akt)); // Statusklasse hinzufügen
    const mac_aktClass = ip.mac_akt !== ip.mac_save ? 'mac-differenz' : '';

    row.innerHTML = `
      <td><a href=http://${ip.ip}target=new class="ip-link">${ip.ip}</a></td>
      <td class="${mac_aktClass}"><font size=2>${ip.mac_akt || ''}</font></td>
      <td class="${mac_aktClass}"><font size=2>${ip.mac_save || ''}</font><br><button class="api-button" onclick="macup('${ip.ip}', '${spaceId}')"><code> <=> </code></button></td>
      <td class="hersteller"><font size=2>${ip.hersteller}</font></td>
      <td>
        <select class="status-dropdown" data-ip="${ip.ip}">
          <option value="frei" ${ip.status === 'frei' ? 'selected' : ''}>Frei</option>
          <option value="belegt" ${ip.status === 'belegt' ? 'selected' : ''}>Belegt</option>
        </select>
      </td>
      <td>
        <select class="type-dropdown" data-ip="${ip.ip}">
          <option value="Anderes" ${ip.type === 'Anderes' ? 'selected' : ''}>Anderes</option>
          <option value="VM" ${ip.type === 'VM' ? 'selected' : ''}>VM</option>
          <option value="Computer" ${ip.type === 'Computer' ? 'selected' : ''}>Computer</option>
          <option value="Laptop" ${ip.type === 'Laptop' ? 'selected' : ''}>Laptop</option>
          <option value="Handy" ${ip.type === 'Handy' ? 'selected' : ''}>Handy</option>
          <option value="ESP" ${ip.type === 'ESP' ? 'selected' : ''}>ESP</option>
          <option value="Steckdose" ${ip.type === 'Steckdose' ? 'selected' : ''}>Steckdose</option>
          <option value="NAS" ${ip.type === 'NAS' ? 'selected' : ''}>NAS</option>
          <option value="Raspberry" ${ip.type === 'Raspberry' ? 'selected' : ''}>Raspberry</option>
          <option value="RaspberryZero" ${ip.type === 'RaspberryZero' ? 'selected' : ''}>RaspberryZero</option>
          <option value="Server" ${ip.type === 'Server' ? 'selected' : ''}>Server</option>
          <option value="Switch" ${ip.type === 'Switch' ? 'selected' : ''}>Switch</option>
          <option value="Router" ${ip.type === 'Router' ? 'selected' : ''}>Router</option>
        </select>
      </td>
      <td><input type="text" class="hardware-input" data-ip="${ip.ip}" value="${ip.hardware || ''}"></td>
      <td><input type="text" class="name-input" data-ip="${ip.ip}" value="${ip.name || ''}"></td>
      <td><input type="text" class="location-input" data-ip="${ip.ip}" value="${ip.location || ''}"></td>
      <td><input type="text" class="comment-input" data-ip="${ip.ip}" value="${ip.comment || ''}"></td>
      <td><button onclick="scanIp('${ip.ip}')">Scan</button></td>

    `;

    tableBody.appendChild(row);
    // Füge Event-Listener für die Dropdowns hinzu
    const statusDropdown = row.querySelector('.status-dropdown');

    const typeDropdown = row.querySelector('.type-dropdown');

    statusDropdown.addEventListener('change', (e) => {
      const newStatus = e.target.value;
      // Aktualisiere die Klasse der Zeile basierend auf dem neuen Status
      row.classList.remove('status-frei', 'status-belegt');
      row.classList.add(getRowStatusClass(newStatus));
    });
  });


// Funktion, die `/api/macakt` aufruft
//function macup(ip, spaceId) {
window.macup = function(ip, spaceId) {
  fetch(`/api/macakt?ip=${ip}&spaceId=${spaceId}`, {
    method: 'POST'
  })
    .then(response => response.json())
    .then(data => {
      //console.log('API Response:', data);
//const spaceDropdown = document.getElementById('address-space-dropdown');
      //const currentSpaceId = spaceDropdown.value;  // Aktuellen Space holen
      upt(spaceId); 
      //alert(`Mac aktualisiert`);
//updateIpTable(ips, spaceId)
    })
    .catch(error => {
//updateIpTable(ips, spaceId)
//const spaceDropdown = document.getElementById('address-space-dropdown');
     // const currentSpaceId = spaceDropdown.value;  // Aktuellen Space holen
      upt(spaceId); 
      //console.error('API Fehler:', error);
      //alert(`Fehler beim API-Aufruf für IP: ${ip}`);
    });
}

  // Event-Listener für Dropdowns und Texteingaben hinzufügen
  document.querySelectorAll('.status-dropdown').forEach(dropdown => {
    dropdown.addEventListener('change', saveCellData);
  });

  document.querySelectorAll('.type-dropdown').forEach(dropdown => {
    dropdown.addEventListener('change', saveCellData);
  });

  document.querySelectorAll('.hardware-input, .name-input, .location-input, .comment-input').forEach(input => {
    input.addEventListener('blur', saveCellData);
  });
}

// Speichert automatisch Änderungen in der Datenbank
async function saveCellData(event) {
  const element = event.target;
  const ip = element.getAttribute('data-ip');
  const field = element.className.split('-')[0]; // "status", "type", "hardware", etc.
  const value = element.value;
  const space = window.currentSpace;

  // Hole den aktuellen "space" aus einer globalen Variable, einem DOM-Element oder einer anderen Quelle
  //const space = document.querySelector('#current-space')?.value || 'default'; // Beispiel: aktueller Space aus einem Input-Feld

  try {
    // Füge den `space`-Parameter zur URL hinzu
    const response = await axios.put(`/api/address-space/update/${ip}?space=${space}`, { field, value });
    console.log(`Saved ${field} for IP ${ip}: ${value}`);
//console.log(space);
upt(space);
  } catch (error) {
    console.error(`Error saving ${field} for IP ${ip}:`, error);
  }
}
function updateRowStatus(ip) {
  const row = document.querySelector(`tr[data-ip="${ip}"]`);  // Finde die Zeile mit der entsprechenden IP

  if (row) {
    const status = row.querySelector('.status-dropdown').value;  // Hole den neuen Status

    // Entferne alle bisherigen Status-Klassen
    row.classList.remove('status-belegt', 'status-frei', 'status-unknown');
    // Füge die neue Status-Klasse hinzu
    row.classList.add(getRowStatusClass(status));  // Nutze die bestehende Funktion zur Bestimmung der Klasse
  }
}
// Event Listener für das Suchfeld
document.getElementById('tableSearch').addEventListener('input', function () {
  const searchTerm = this.value.toLowerCase(); // Suchtext in Kleinbuchstaben
  const rows = document.querySelectorAll('#ip-table tbody tr');

  rows.forEach(row => {
    const cells = Array.from(row.children); // Alle Zellen der Zeile
    const matches = cells.some(cell => {
      const cellText = cell.textContent.toLowerCase(); // Textinhalt der Zelle
      const inputElement = cell.querySelector('input'); // Suche nach einem Input-Element
      const inputValue = inputElement ? inputElement.value.toLowerCase() : ''; // Wert des Inputs, falls vorhanden
      return cellText.includes(searchTerm) || inputValue.includes(searchTerm); // Suche in Text und Input-Wert
    });

    row.style.display = matches ? '' : 'none'; // Zeile ein-/ausblenden
  });
});

