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
- [ ] Ordentliche Trennung zwischen dev und docker Version
- [ ] Ordentliche Konfiguration, sodass das compose überall funktioniert wie es soll
- [ ] Arbeit an Progress Information Part
- [ ] Arbeit an Tag-Selection Part
- [ ] Arbeit an Alerting Part
- [ ] Integration von CloWM
- [ ] Schreiben
- [ ] Welcher Webserver? Konfig final abschließen!
