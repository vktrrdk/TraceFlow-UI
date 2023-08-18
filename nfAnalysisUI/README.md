# Current work
- [ ] **Anpassen der Analyse-Metriken**
  - [ ]Bewertung eines Tasks
    - [ ] Raw
    - Gewichtet nach Metrik-Eigenschaften (z.b Ram duration usw.)
  - [ ] Bewertung eines Prozesses
    - [ ] Gewichtet nach Metrik Eigenschaften
    - [ ] Abstand zum Optimum im Schnitt, nicht nur der Durschnitt
  - [ ] Bewertung des gesammten Workflows
    - [ ] Gewichtungen
- [ ] **Hinweise für den Umgang mit den analysierten Daten**
  - [x] Anfang
  - [ ] Prozessebene!
  - [ ] Anpassen der zurückgegebenen Analysis-Listen - mehr Informationen auf Prozessebene!
- [ ] **Test-Workflows** 
  - [ ] Beispiele nutzen, wie schneidet die eigene Lösung ab usw.
  - [ ] MGTK nutzen

Notes:
Also ein 2GB prozess, der nur 50% verarbeitet ist weniger schlimm als ein 16 gb prozess der 65% prozent verarbeitet
Gewichten der Metriken, wie ? Normalisierung usw?

`(sum_over_all_tasks ((w_1 * r_t_1 * a_t_1 * d) + (w_2 * r_t_2 * a_t_2 * d))) / (sum_over_all_tasks (w_1 * a_t_1 * d) + (w_2 * a_t_2 * d))
`


# Möglicherweise

- [ ] Analysemetriken einschränken - setze dynamische grenzen für die Relevanz
  - [x] Anfang
  - [ ] Fertigstellen

# Zukünftige Änderungen
- [ ] **Vergleiche zwei Runs miteinander** 
- [ ] Webserver Konfiguration
- [ ] Einheiten dynamisch wählbar machenn.
- [ ] Metriken: Score erweitern mit I/O
- [ ] Hinweise erweitern auf I/O
- [ ] native_id - kann für Steal-Time usw. genutzt
  - [ ] Über pyslurm hostnamen des prozesses abfragen
    - [ ] BatchHost für native-id (welche die JobId für Slurm ist) holen
      - [ ] hole Info z.b. über SSH über Informationen wie Steal-Time usw.
      - [ ] Endpunkt in der API, wo die informationen gesendet werden können - also eigenständiger Service
- [ ] bestimmte metrikenwerte über Celery berechnen und in der Datenbank speichern? schnellere berechnung möglich? Vor allem wenn die anfrage an den Service geht
- [ ] Berechnungen cachen, timestamp der threshold für caching darstellt? damit analyse beim polling nicht die ganze Zeit abgefragt wird?
- [ ] zeige zeitliche Verläufe von Prozessen (Horizontal) (options: { indexAxis: 'y'},)
- [ ] Integration von CloWM
- [ ] remove empty columns from list - or show possibility to disable certain columns  
- [ ] create overview: which processes are running, which are submitted, which are completed, which are failed?
- [ ] show ignored processes - in list?
