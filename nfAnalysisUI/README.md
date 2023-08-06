# Current work
- [x] fix bugs regarding filters (multiselect) 
- [x] refactor: **autoselect enabled - multiple parts need update**: process progress list and metrics not updated regardless of polling
- [x] show number of processes finished
- [x] show general progress: how many processes currently submitted are finished and so on
- [x] show workflow state - running, failed or finished? (use meta)
- [x] Ordentliche Trennung zwischen dev und docker Version - erstmal okay
- [x] Ordentliche Konfiguration, sodass das compose überall funktioniert wie es soll - erstmal okay
- [x] Arbeit an Progress Information Part - erstmal okay
- [x] Arbeit an Tag-Selection Part
- [x] Ersetze ProcessNames durch die Keys des Mappings
- [x] **Mehrere run-Ids unter einem Token** --> betrachte auch run-names
  - [x] Wenn Workflows gestartet werden, ist die Abfrage der States (allProcesses noch fehlerhaft)
  - [x] Polling anpassen!
  - [x] Progress-Anzeige anscheinend noch Buggy
  - [x] Plot if-cases und Aktualisierung prüfen
  - [x] Tag und Process-Selection abhängig vom gewählten Run  
- [x] sortiere Run-Auswahl nach Start-Datum 
- [x] **Arbeit an Alerting Part**
- [x] Sidebar wegen vielem Scrollen
- [ ] **Test-Workflows** 
  - [ ] Beispiele nutzen, wie schneidet die eigene Lösung ab usw.
- [ ] **eigene Metrik - eine Evaluation des Workflows anhand von kombinierten Daten** 
- [ ] **Vergleiche zwei Runs miteinander** 
- [ ] Analysemetriken einschränken - setze dynamische grenzen für die Relevanz
- [ ] Hinweise für den Umgang mit den analysierten Daten
- [ ] create overview: which processes are running, which are submitted, which are completed, which are failed?
- [ ] filter für currently-running
- [ ] axis labelings (% and so on)
- [ ] native_id - kann für Steal-Time usw. genutzt
  - [ ] Über pyslurm hostnamen des prozesses abfragen
    - [ ] BatchHost für native-id (welche die JobId für Slurm ist) holen
      - [ ] hole Info z.b. über SSH über Informationen wie Steal-Time usw.
      - [ ] Endpunkt in der API, wo die informationen gesendet werden können - also eigenständiger Service
- [ ] regard retry as state - show number of attempts if available, same holds for ignore
- [ ] bestimmte metrikenwerte über Celery berechnen und in der Datenbank speichern? schnellere berechnung möglich? Vor allem wenn die anfrage an den Service geht
- [ ] Berechnungen cachen, timestamp der threshold für caching darstellt? damit analyse beim polling nicht die ganze Zeit abgefragt wird?
- [ ] zeige zeitliche Verläufe von Prozessen (Horizontal) (options: { indexAxis: 'y'},)
- [ ] Betrachte weitere relevante Metriken
- [ ] automatische Formatierung von Zeitdaten - Sekunden, Minuten, Stunden
- [ ] genererisches Handling von Prozessen - ein gemeinsamer Filter für alle Metriken (beim Update der Plots -> aggregation der Daten einheitlich)
- [ ] API die Rechenarbeit machen lassen? -> gezieltere Anfragen, gezieltere Responses
- [ ] Integration von CloWM
- [ ] Welcher Webserver? Config final abschließen!
- [ ] remove empty columns from list - or show possibility to disable certain columns  
- [ ] more generic handling of traces --> also use meta
- [x] Welche Prozesse laufen im Workflow am längsten?  pro run --> kriegen wir

Notes:


Vergleiche Runs miteinander! wie viel mehr oder weniger cpu z.b 
Gruppieren nach Task!
Probleme in Relation bringen - ein Ranking ist notwendig um die größten Probleme als erstes darzustellen
Also ein 2GB prozess, der nur 50% verarbeitet ist weniger schlimm als ein 16 gb prozess der 65% prozent verarbeitet
Scatter Plot (x cpu, y ram %ual) linie mit 100% die das anzeigt

Prozesse in relation zu einander setzen -> gehört ein prozess zu den 10% die am längsten dauern? ja / nein
x --> setze die möglichkeit einer konfiguration

heartbeat daten nutzbar??
Dann könnte man zeit/cpu in relation bringen, und ab einem bestimmten zeitpunkt wäre ein prozess ineffektiv.


Globaler Service: User management --> wer kann anfragen stellen usw. 