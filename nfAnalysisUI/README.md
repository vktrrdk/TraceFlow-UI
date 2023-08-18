# Current work
- [x] fix bug on tags in analysis summary
- x ] Tags in allen Listen anzeigen, wo es notwendig ist
- [ ] Anpassen der zurückgegebenen Analysis-Listen - mehr Informationen auf Prozessebene!
- [ ] **Bugfixing summaries (memory percentage average passt nicht?)**
- [ ] **eigene Metrik - eine Evaluation des Workflows anhand von kombinierten Daten** 
 - [x] Anfang
 - [x] erweitern
 - [ ] Prozessebene
 - [ ] Anpassen der Berechnung
- [ ] **Hinweise für den Umgang mit den analysierten Daten**
   - [x] Anfang
   - [ ] Prozessebene!
- [ ] **Test-Workflows** 
  - [ ] Beispiele nutzen, wie schneidet die eigene Lösung ab usw.
  - [ ] MGTK nutzen


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


____

user time? welche time wird bei den durations angezeigt
--> cpu zeit, wird die zahl der kerne multipliziert? 

process listing mit task-id bei längsten prozessen --> klarmachen, dass es sich um einen task handelt und tag hinzufügen

tags auch zu den least and most stuff!


___

Score Metric:

CPU allocation beachten - dabei wird cpu% gegen cpu anzahl gerechnet, wenn diese werte gegeben sind. - umso näher man an 100% ist desto besser
das selbe gilt für memory - hier gilt es einen weg zu finden, wie man vmem und rss miteinander vergleicht
nehme initial an, man vergleich den RSS-Wert mit dem Requested Memory wert - umso näher man an 100% ist, desto besser. 

____ 

gängiges vorgehen von entwicklern, checke was der peak an ram ist, nehme den wert für alle tasks dieses prozesses --> viele tasks brauchen viel weniger, wodurch diese ineffizient gewertet werden.
unterscheide bei den handlungsanweisungen zwischen prozessen und tasks!
--> problemdarstellung auf prozessebene muss!

--> Result section!