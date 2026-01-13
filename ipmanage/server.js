const express = require('express');
const { exec } = require('child_process');
const { Client } = require('pg');
const socketIo = require('socket.io');
const jwt = require('jwt-simple');
const cron = require('node-cron');
const cors = require('cors');
const dotenv = require('dotenv');
const nmap = require('nmap');
const csvWriter = require('csv-writer').createObjectCsvWriter;
const ip = require('ip');
const axios = require('axios');


// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 88;
const server = app.listen(port);  // Start the server
const io = socketIo(server);      // Pass the server to socket.io

app.use(cors());
app.use(express.json()); // Parse JSON request bodies
app.use(express.static('public')); // Serve static files for frontend

// Initialize PostgreSQL client
const client = new Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: 'ipvx',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT
});

client.connect();

function authenticateJWT(req, res, next) {
}

// API Routes

// Create new address space
app.post('/api/address-space', async (req, res) => {
  //const { cidr, name } = req.body;

  const { cidr, name } = req.body;

  if (!cidr || !name) {
    return res.status(400).send('CIDR und Name sind erforderlich');
  }

  // Dynamischer Tabellenname: Wir nutzen den Namen des Address Spaces, um eine Tabelle zu erstellen
//const sanitizedSpaceId = name.replace(/[\s-]/g, '_');
    // Führe den SQL-Befehl aus, um die Tabelle zu erstellen

  const query = `INSERT INTO address_spaces (cidr, name, scan) VALUES ($1, $2, 0) RETURNING tab`;
  const result = await client.query(query, [cidr, name]);

const spaceId = result.rows[0].tab;
//console.log(spaceId);

const tableName = `${spaceId}_ips`;

//console.log(tableName);

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id SERIAL PRIMARY KEY,
        ip VARCHAR(255) NOT NULL,
        mac_akt VARCHAR(255) NOT NULL DEFAULT '-',
        mac_save VARCHAR(255) NOT NULL DEFAULT '-',
        status VARCHAR(50) NOT NULL DEFAULT 'frei',
        type VARCHAR(50),
        hardware VARCHAR(255),
        name VARCHAR(255),
        location VARCHAR(255),
        hersteller VARCHAR(255),
        comment TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;
const jjj = await client.query(createTableQuery);
//console.log(jjj)

  // Calculate IP range for CIDR block
  const ipRange = await calculateIpRange(cidr); // Implement this function
  await insertIpAddresses(ipRange, spaceId);  // Insert all IPs for CIDR

  io.emit('address-space-created', { spaceId });
  res.status(201).json({ id: spaceId, name });
});

// Function to calculate IP range from CIDR
async function calculateIpRange(cidr) {
  // Use a CIDR library or custom logic to calculate the IP range
  const subnet = ip.cidrSubnet(cidr);
  const startIp = subnet.firstAddress;
  const endIp = subnet.lastAddress;

  // IP-Bereich berechnen
  const ipRange = [];
  let currentIp = startIp;

  // Solange die aktuelle IP-Adresse kleiner oder gleich der End-IP ist
  while (ip.toLong(currentIp) <= ip.toLong(endIp)) {
    ipRange.push(currentIp);
    // Gehe zur nächsten IP-Adresse, indem die numerische Form der IP um 1 erhöht wird
    currentIp = ip.fromLong(ip.toLong(currentIp) + 1);
  }

  return ipRange;
}

// Insert IP addresses into database
async function insertIpAddresses(ipRange, spaceId) {
  // Insert IPs into the corresponding address space table
  for (const ip of ipRange) {
    const query = `INSERT INTO ${spaceId}_ips (ip) VALUES ($1)`;
    await client.query(query, [ip]);
//    console.log(ip);
  }
}

//mac-akt
app.post('/api/macakt/', async (req, res) => {
  const spaceId = req.query.spaceId;
  const ip = req.query.ip;
const query = `UPDATE ${spaceId}_ips SET mac_save = mac_akt WHERE ip = $1`;
  const result = await client.query(query,[ip]);

res.status(200).send('Uebertragung komplett');
});



//mac-save
app.post('/api/macsave/:spaceId', async (req, res) => {
  const { spaceId } = req.params;
  const query = `UPDATE ${spaceId}_ips SET mac_save = mac_akt`;
  const result = await client.query(query);
  //const ips = result.rows;

  // Clear old MAC addresses
res.status(200).send('Uebertragung komplett');
});

// Scan address space and save MAC addresses
app.post('/api/scan/:spaceId', async (req, res) => {
//console.log('scan');
  const { spaceId } = req.params;
//console.log(spaceId);
 const query = `SELECT ip FROM ${spaceId}_ips`;
  const result = await client.query(query);
  const ips = result.rows;
//console.log(query);
  // Clear old MAC addresses
  const deleteQuery = `UPDATE ${spaceId}_ips SET mac_akt = '-', hersteller = ''`;
  await client.query(deleteQuery);

  // Run Nmap scan and save MAC addresses
  const macAddresses = await scanIpsWithNmap(ips, spaceId);
  io.emit('address-space-updated', { spaceId });
  res.status(200).send('Scan completed');
});


async function scanIpsWithNmap(ips, spaceId) {
  const macAddresses = [];

  // Führe nmap für jede IP aus
  for (const { ip } of ips) {
    // Nmap-Befehl zum Scannen der MAC-Adresse
    const command = `nmap -sP ${ip} | grep -i "mac address"`;

    try {
      const result = await runNmapCommand(command);
console.log(result);
      const mac = parseMacAddress(result);
      const herst = extractManufacturer(result);
console.log(herst);
      macAddresses.push({ ip, mac });  // Speichern der MAC-Adresse


      // SQL-Abfrage zum Aktualisieren der MAC-Adresse
      const updateQuery = `UPDATE ${spaceId}_ips SET mac_akt = $1, hersteller = $3  WHERE ip = $2`;
      //console.log(`sdf`, updateQuery);  // Zeige die Abfrage in der Konsole
      const dbResult = await client.query(updateQuery, [mac, ip, herst]);  // Übergabe der Parameter sicher

    } catch (error) {
      const mac = '-';  // Falls ein Fehler auftritt, setze MAC auf null
      const herst = '';
      console.error(`Error scanning IP ${ip}: ${error.message}`);
      macAddresses.push({ ip, mac });  // Null-Wert für MAC hinzufügen

      // SQL-Abfrage zum Setzen von NULL, wenn ein Fehler auftritt
      const updateQuery = `UPDATE ${spaceId}_ips SET mac_akt = $1, hersteller = $3 WHERE ip = $2`;
      //console.log(`123`, updateQuery);  // Zeige die Abfrage in der Konsole
      await client.query(updateQuery, [mac, ip, herst]);  // Übergabe der Parameter sicher

    }
  }


  return macAddresses;
}

// Funktion zur Ausführung des nmap-Befehls
function runNmapCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`exec error: ${stderr || error.message}`));
      }
      resolve(stdout);
    });
  });
}

// Funktion zum Extrahieren der MAC-Adresse aus dem nmap-Ergebnis
function parseMacAddress(nmapOutput) {
  const macAddressRegex = /MAC Address: ([\w:]+)/i;
  const match = nmapOutput.match(macAddressRegex);
  return match ? match[1] : null;
}
function extractManufacturer(nmapOutput) {
  const match = nmapOutput.match(/\((.*?)\)/); // Sucht nach Text zwischen Klammern
  return match ? match[1] : null; // Gibt den gefundenen Text oder null zurück
}

// Auto-scan every hour
cron.schedule('0 * * * *', async () => {
  const spaces = await client.query('SELECT id FROM address_spaces');
  for (const space of spaces.rows) {
    io.emit('auto-scan-started', { spaceId: space.id });
    await scanAddressSpace(space.id);
  }
});

// Function to perform scan
async function scanAddressSpace(spaceId) {
  const query = `SELECT ip FROM ${spaceId}_ips`;
  const result = await client.query(query);
  const ips = result.rows;

  // Clear old MAC addresses
  const deleteQuery = `UPDATE ${spaceId}_ips SET mac_akt = NULL`;
  await client.query(deleteQuery);

  // Run Nmap scan and save MAC addresses
  const macAddresses = await scanIpsWithNmap(ips);
  for (const { ip, mac } of macAddresses) {
    const updateQuery = `UPDATE ${spaceId}_ips SET mac_akt = $1 WHERE ip = $2`;
    await client.query(updateQuery, [mac, ip]);
  }

  io.emit('address-space-updated', { spaceId });
}

// Export address space data as CSV
app.get('/api/export/:spaceId', async (req, res) => {
  const { spaceId } = req.params;
  const query = `SELECT ip, mac_akt, status FROM ${spaceId}_ips`;
  const result = await client.query(query);

  const csv = csvWriter({
    path: `./exports/${spaceId}.csv`,
    header: [
      { id: 'ip', title: 'IP' },
      { id: 'mac_akt', title: 'MAC' },
      { id: 'status', title: 'Status' }
    ]
  });
  await csv.writeRecords(result.rows);

  res.download(`./exports/${spaceId}.csv`);
});

app.get('/api/address-spaces', async (req, res) => {
  try {
  const result = await client.query('SELECT * FROM address_spaces');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching address spaces:', error);
    res.status(500).json({ error: 'Failed to fetch address spaces' });
  }
});


app.get('/api/address-space/:name', async (req, res) => {
  const spaceId = req.params.name;
  try {
    // Hole die Daten basierend auf dem ausgewählten Addressraum (spaceId)
//console.log(spaceId);
//   const result = await client.query(`SELECT * FROM ${spaceId}_ips;`, [spaceId]);
console.log(spaceId);
const tableName = `${spaceId}_ips`;

    // Abfrage ausführen
    const result = await client.query(`SELECT * FROM ${tableName} ORDER BY ip::inet ASC;;`);

    res.json({ ips: result.rows });  // Gebe die IPs und zugehörige Daten zurück
  } catch (error) {
    console.error('Fehler beim Abrufen der IP-Daten:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Daten' });
  }
});

app.put('/api/address-space/update/:ip', async (req, res) => {
  const ip = req.params.ip;
  const { field, value } = req.body;
  const tableName = `${req.query.space}_ips`; // Aktueller Tabellenname aus dem Query-Parameter

  if (!['status', 'type', 'hardware', 'name', 'location', 'comment'].includes(field)) {
    return res.status(400).json({ error: 'Invalid field' });
  }

  try {
    const query = `UPDATE ${tableName} SET ${field} = $1 WHERE ip = $2`;
    console.log(query); // Überprüft die generierte Abfrage
    await client.query(query, [value, ip]); // Platzhalter verwenden
    res.status(200).json({ message: 'Update successful' });
  } catch (error) {
    console.error('Error updating field:', error);
    res.status(500).json({ error: 'Database update failed' });
  }
});
// API-Route, um den Nmap-Scan zu starten
app.post('/api/scan/:ip', (req, res) => {
    const ip = req.params.ip;
//console.log(ip);
   // Nmap-Scan-Befehl
    const command = `nmap -p- ${ip}`;

    // Scan ausführen
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Fehler beim Ausführen von Nmap: ${error.message}`);
            return res.status(500).send('Fehler beim Ausführen des Scans');
        }
        if (stderr) {
            console.error(`stderr: ${stderr}`);
            return res.status(500).send('Fehler beim Ausführen des Scans');
        }

        // Resultate an den Client senden
        res.send({ result: stdout });
    });
});

// Socket.IO: Ergebnisse an den Client in Echtzeit senden
io.on('connection', (socket) => {
    console.log('Ein Client ist verbunden.');

    socket.on('scan-start', (ip) => {
        const command = `nmap -p- ${ip}`;

        // Nmap-Scan in Echtzeit ausführen und Ergebnisse an den Client senden
        const scanProcess = exec(command);

        // Daten in Echtzeit an den Client senden
        scanProcess.stdout.on('data', (data) => {
            socket.emit('scan-progress', data);
        });

        scanProcess.stderr.on('data', (data) => {
            socket.emit('scan-progress', data);
        });

        scanProcess.on('close', (code) => {
            socket.emit('scan-finished', `Scan abgeschlossen mit Code: ${code}`);
        });
    });
});


app.post('/update-scan', async (req, res) => {
  const { address_space_id, scan_value } = req.body;

  try {
    const query = 'UPDATE address_spaces SET scan = $1 WHERE tab = $2';
    await client.query(query, [scan_value, address_space_id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Fehler beim Aktualisieren des Scan-Werts:', err);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Scan-Werts' });
  }
});

// Endpoint zum Überprüfen des Scan-Werts für einen address_space
app.get('/check-scan-value/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const query = 'SELECT scan FROM address_spaces WHERE tab = $1';
    const result = await client.query(query, [id]);
//console.log(result);
    if (result.rows.length > 0) {
      res.json({ scan: result.rows[0].scan });
    } else {
      res.status(404).json({ error: 'Address space nicht gefunden' });
    }
  } catch (err) {
    console.error('Fehler beim Abrufen des Scan-Werts:', err);
    res.status(500).json({ error: 'Fehler beim Abrufen des Scan-Werts' });
  }
});

async function runEveryHour() {

  try {
    console.log('Starte stündliche Aufgabe');
    // Hier kannst du z.B. eine API-Abfrage oder Datenbankoperationen durchführen
const wert = `1`
    //await someAsyncTask();
 try {
    const query = 'SELECT tab FROM address_spaces WHERE scan = $1';
    const result = await client.query(query, [wert]);
for (const row of result.rows) {
console.log('cron');
console.log(row.tab);
await axios.post(`http://localhost:${port}/api/scan/${row.tab}`);
}
} catch (err) {
    console.error('keine scans aktiv', err);
}



    console.log('Stündliche Aufgabe abgeschlossen');
  } catch (error) {
    console.error('Fehler bei der stündlichen Aufgabe:', error);
  }
}

// setInterval sorgt dafür, dass die asynchrone Funktion jede Stunde ausgeführt wird
//setInterval(runEveryHour, 360);
setInterval(runEveryHour, 3600000);



// Delete address space
app.delete('/api/address-space/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Get the space name first to drop the table
    const spaceQuery = 'SELECT name FROM address_spaces WHERE id = $1';
    const spaceResult = await client.query(spaceQuery, [id]);
    
    if (spaceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Adressraum nicht gefunden' });
    }
    
    const spaceName = spaceResult.rows[0].name;
    const tableName = `${spaceName}_ips`;
    
    // Drop the table associated with the address space
    const dropTableQuery = `DROP TABLE IF EXISTS "${tableName}"`;
    await client.query(dropTableQuery);
    
    // Delete the address space from the address_spaces table
    const deleteQuery = 'DELETE FROM address_spaces WHERE id = $1';
    await client.query(deleteQuery, [id]);
    
    io.emit('address-space-deleted', { id });
    res.status(200).json({ message: 'Adressraum erfolgreich gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen des Adressraums:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Adressraums' });
  }
});
