# 🖧 ipv4manage

**WEB IPv4 Management Tool**  
Eine Node.js-Anwendung zur komfortablen Verwaltung von IPv4-Adressbereichen.  
Die Anwendung läuft standardmäßig auf **Port 88** (dies kann in `server.js` angepasst werden – bitte ggf. auch die `.service`-Datei anpassen).

![Screenshot](https://github.com/bmetallica/ipv4manage/blob/main/utils/prev.jpg)

---

## ✅ Features

- [x] Flexibles Anlegen von Adressräumen
- [x] Automatisches Befüllen der Datenbank mit allen möglichen IPs
- [x] Auswahl eines Adressraums für die Haupttabelle
- [x] Automatisches Speichern von Änderungen in der Haupttabelle
- [x] Volltextsuche über alle Spalten
- [x] Dynamisches Ein-/Ausblenden von Spalten
- [x] Manueller Scan eines Adressraums via `nmap` (MAC-Adresse & Hersteller)
- [x] Automatischer Stundenscan ausgewählter Adressräume
- [x] Sicherung aller MAC-Adressen eines Adressraums (z.B. für Geräte mit wechselnder IP)
- [x] Manuelles Speichern einzelner MAC-Adressen als MAC_SAVE
- [x] Live-Nmap-Scan einzelner IPs
- [x] Farbcode für belegte IPs (🔴), freie IPs (🟢), Inkonsistenzen (🟠/🟡)

---


## 📦 Installation <br>

### 🐳 **Docker-Installation**

<table border=2><tr><th>
<b><u> 🔧 Voraussetzungen </u></b></th><td>
- docker & compose Plugin
</td></tr></table>
<br>
  
```bash
mkdir ipmanage
cd ipmanage
wget https://raw.githubusercontent.com/bmetallica/ipv4manage/refs/heads/main/docker-compose.yml
docker compose up -d
```
<br><br>

### ⚙️ **Manuelle Installation**
(als root User durchführen)

<table border=2><tr><th>🔧 Voraussetzungen</th><td>

- Debian/Linux Server
- PostgreSQL-Datenbank (im Netzwerk erreichbar)
- Node.js & npm
- `nmap` installiert

</td></tr></table>
<br>


### 1. Projekt klonen

```bash
git clone https://github.com/bmetallica/ipv4manage.git /opt/ipv4manage
cd /opt/ipv4manage/ipmanage
```

### 2. Abhängigkeiten installieren

```bash
apt install nmap sudo -y
npm init -y
npm install express pg socket.io jwt-simple node-cron cors dotenv nmap csv-writer ip axios
```

### 3. PostgreSQL-Datenbank vorbereiten

```bash
# Datenbank "ipvx" anlegen (z. B. mit pgAdmin oder psql)
sudo -u postgres psql -c "create database ipvx"
sudo -u postgres psql -d ipvx -f /opt/ipv4manage/utils/create.sql
```

### 4. Umgebungsvariablen konfigurieren

```bash
mv db.env .env
# Dann .env öffnen und Zugangsdaten zur Datenbank eintragen
```

---

## ⚙️ Dienst & Autostart einrichten

```bash
mv /opt/ipv4manage/utils/ipv.service /etc/systemd/system/
chmod 776 /etc/systemd/system/ipv.service
systemctl daemon-reload
systemctl start ipv
systemctl enable ipv
```

---

## 🌐 Webzugriff

Die Anwendung ist nun über den Browser erreichbar unter:

```
http://localhost:88
```

(Port ggf. in `server.js` und `ipv.service` anpassen)


---

**Autor:** [bmetallica](https://github.com/bmetallica)
