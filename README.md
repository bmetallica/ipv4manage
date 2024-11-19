# ipv4manage
WEB IPv4 management tool  
Eine NodeJS Anwendung die auf Port 88 (dieser kann in der Datei server.js angepasst werden [muss dann auch in .service Datei angepasst werden]) eine Webseite zur Verwaltung von IPv4 Adressbereichen bereit stellt.  

**Folgende Funktionen wurden integriert:**
- [x] flexibeles anlegen von Adressräumen
- [x] automatisches Befüllen der Datenbank mit allen in den Adressräumen möglichen IPs
- [x] Auswahl des Adressraums für die Haupttabelle 
- [x] Automatisches speichern von Änderungen in der Haupttabelle
- [x] Suchfunktion über alle Spalten der Haupttabelle
- [x] Spalten variabel ein/ausblenden
- [x] Manuelle Möglichkeit einzelne Adressräume mit nmap zu scannen (Erfassung MAC_akt und Hersteller) 
- [x] Automatischer Scann ausgewählter Adressräume jede Stunde
- [x] Sichern Aller MACs eines Adressraums (z.B. um Geräte zu finden deren IP sich geändert hat)
- [x] Aktualisierung einzelner MAC Adressen zu MAC_SAVE
- [x] Nmap scan einzelner IPs mit Liveansicht 
- [x] Einfärbung belegter IPs -> Zeile rot
- [x] Einfärbung freier IPs -> Zeile grün
- [x] Einfärbung bei gefundener MAC-AKT aber als Frei markiert -> Zeile orange
- [x] Einfärbung bei Unterschied MAC_AKT und MAC_Save -> Felder gelb

![Alternativtext](https://github.com/bmetallica/ipv4manage/blob/main/utils/prev.jpg)

**Voraussetzungen:**  
Ein Debian Server mit einer im Netzwerk erreichbaren PostgreSQL Datenbank und NodeJS incl. npm.

**Installation:**  
1. Download nach /opt/ mit "git clone https://github.com/bmetallica/ipv4manage.git
2. "apt install nmap -y"
3. "cd /opt/ipmanage"
4. Nodeprojekt initiieren mit "npm init -y"
5. Abhängigkeiten installieren mit "npm install express pg socket.io jwt-simple node-cron cors dotenv nmap csv-writer ip axios"
6. Eine PostgreSQL Datenbank mit dem Namen "ipvx" anlegen
7. Mit psql in der Datenbank die Tabelle anlegen (das create.sql für diese Tabelle ist im utils Ordner zu finden)  
   "psql -d ipvx -f /opt/utils/create.sql"
8. In der Datei ".env" die Datenbankverbindung (User und password) anpassen

**Dienst und Autostart erstellen**
1. "mv /opt/dpm/utils/ipv.service /etc/systemd/system/"
2. "chmod 776 /etc/systemd/system/ipv.service"
3. "systemctl daemon-reload"
4. "systemctl start ipv"
5. Für den Autostart: "systemctl enable ipv"

Die Webseite sollte nun unter **http://localhost:88** erreichbar sein.  
  
Viel Spaß mit diesem Projekt
