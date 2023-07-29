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
- [ ] check if multiple tasks of the same process are reflected in the changes of the metrics and progress, when autoselect is disabled
- [ ] adjust progress information part
  - [ ] add tags of processes
  - [x] show number of processes finished
  - [ ] create overview: which processes are running, which are submitted, which are completed, which are failed?
    - [ ] show general progress: how many processes currently submitted are finished and so on
  - [ ] regard retry as state - show number of attempts if available
- [ ] show workflow state - running, failed or finished? (use meta)
- [ ] alerting for more than 100% memory usage for process or very low usages


# Reihenfolge für nächstes Vorgehen - WICHTIG
- [x] Ordentliche Trennung zwischen dev und docker Version - erstmal okay
- [x] Ordentliche Konfiguration, sodass das compose überall funktioniert wie es soll - erstmal okay
- [x] Arbeit an Progress Information Part - erstmal okay
- [x] Arbeit an Tag-Selection Part
- [ ] **Arbeit an Alerting Part - Anfang gemacht**
- [ ] **Mehrere run-Ids unter einem Token** 
- [ ] automatische Formatierung von Zeitdaten - Sekunden, Minuten, Stunden
- [ ] genererisches Handling von Prozessen - ein gemeinsamer Filter für alle Metriken
- [ ] API die Rechenarbeit machen lassen? -> gezieltere Anfragen, gezieltere Responses
- [ ] Integration von CloWM
- [ ] Welcher Webserver? Konfig final abschließen!
