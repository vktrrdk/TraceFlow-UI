# TODO

 - [ ] **remove empty columns from list** - or show possibility to disable certain columns
 - [ ] how do we get information about current non-submitted processes/tasks?
 - [ ] more generic handling of traces --> also use meta
 - [ ] check router history - how to add "back-button" ?
 - [ ] adjust layout
 - [ ] adjust naming function

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
- [ ] **Mehrere run-Ids unter einem Token** --> betrachte auch run-names
  - [ ] Wenn Workflows gestartet werden, ist die Abfrage der States (allProcesses noch fehlerhaft)
  - [ ] Polling anpassen!
  - [ ] Progress-Anzeige anscheinend noch Buggy
- [ ] **Arbeit an Alerting Part - Anfang gemacht**
- [ ] sortiere Run-Auswahl nach Start-Datum
- [ ] regard retry as state - show number of attempts if available
- [ ] zeige zeitliche Verläufe von Prozessen (Horizontal) (options: { indexAxis: 'y'},)
- [ ] Betrachte weitere relevante Metriken
- [ ] create overview: which processes are running, which are submitted, which are completed, which are failed?
- [ ] automatische Formatierung von Zeitdaten - Sekunden, Minuten, Stunden
- [ ] genererisches Handling von Prozessen - ein gemeinsamer Filter für alle Metriken (beim Update der Plots -> aggregation der Daten einheitlich)
- [ ] API die Rechenarbeit machen lassen? -> gezieltere Anfragen, gezieltere Responses
- [ ] Integration von CloWM
- [ ] Welcher Webserver? Konfig final abschließen!
