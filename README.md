Applikasjon 2 prosjekt 
stein, saks,papir

 i dette prosjektet lager jeg en enkel web-app knyttet til "Steinsakspapir". Løsningen består av
 en klient (html/css/js) og en server (Exspress) med et REST-ish API. Prosjektet er bevisst holdt
 enkelt, men oppfyller kravene til blant annet persistering av data (PostgreSQL på Render),
 PWA/offline og tilgjengelighet (Lighthouse).
   
 under er det link til miro og github projekt som jeg bruker til og organisere gjøremål for oppgaven. 

 link til Miro: https://miro.com/app/board/uXjVGPqECDY=/?share_link_id=222933779007 

 link til github todo liste: https://github.com/users/Quantumwolf210/projects/1/views/1 


server og render link/info

 serveren ligger på: localhost 8080.

live (Render): https://steinsakspapir-yc6d.onrender.com/ 


kjør lokalt

innstaler avhengigheter med "npm install", og start serveren med "npm start". serveren kjører da på port 8080 lokalt. 

hvis "DATABASE_URL" ikke er satt lokalt, bruker serveren in memory lagring for brukere  (kun for enkel lokal testing).

deploy

Applikasjonen kjører som en Web Service på render og bruker en PostgreSQL-database på render.
Når DATABASE_URL er satt i Render, lagres og hentes brukere fra databasen.
data presisterer selv om serveren restartes.  

dette er testet ved og opprette bruker, slette bruker, og opprette samme bruker igjen ( ved og gjøre dette vises det at data 
lagres og at endringer slår gjennom).

klient

klienten ligger i "public/" og bruker relative URL-er mot API-et. all kommunikasjon skjer via en felles 
"fetch"-funksjon ("apiRequest" ). UI-et er laget som en custum web component.

klienten støtter oppretting, sletting og oppdatering av bruker via API-kall.


Server/API

serveren ligger i "server.mjs" og tilbyr et REST-ish API. Bruker-endepunktene støtter
create/delete/patch.

"POST/api/users" oppretter en bruker. krever "username", "password" og at "accptTOS" er
"true"

"DELETE/api/users" sletter en bruker. krever "username" og "password"
(verifiseres før sletting).

"PATCH/api/users" oppdaterer "tosVersion" og oppdaterer tidspunktet for samtykke
("consented_at"). "krever" "Username", "password" og tosVersion".

i tilegg serveres juridiske documenter som markdown:
"GET/api/legaltos" og GET/api/legal/privacy".

Feilmeldinger følger nettleserens språk via "Accept-Language" (norsk/engelsk).

PWA of offline

Appen er installerbar ved hjelp av "maifest.webmanifest" og bruker service worker ("sw.js") for 
caching av statiske filer. Offline kan testes i Chrome DevTools ved å gå til Application-service
workers og slå på "offline", og deretter refreshe siden. UI skal fortsatt laste når nettverket er av.


Hva lagres om brukeren

Appen lagrer bare det som trengs for at systemet sakl fungere.
Brukernavn brukes for å identifisere brukeren i systemet. Passord lagres ikke i klartekst , men som
"password_hash" og "password_salt" for sikker lagring. Det lagres også TOS-versjon "tos__version" og tidspunkt
for samtykke "consented_at". Opprettelsestidspunkt "created_at" lagres for oversikt og feilsøking.




plan for prosjekt:

få alle disse tingene på plass.

klient: brukeren kan velge stein/saks eller papir og se resultat (statistikk)

server: håndtere innlogging/ registrering ol.

brukerkonto: mulighet for og  seette opp en bruker (registrering og innlogging).

database/storage?: for å lagre brukere og spillresultater/statistikk.

REST-ish API: lagring/ henting resultat, statistikk

pwa offline: programmet skal ha noe offline funksjonalitet.

brukere & mer.

i denne appen vil jeg holde meg til og samle det jeg trenger for at appen skal fungere:

brukernavn: for og identifisere brukeren i systemet
passord: lagres ikke i klartext, men som passwordHash + salt for sikker lagring

 santykke til vilkår (ToS): lagr om vilkårene er godtatt og tidspunktet. 


createdAAt:(valgfritt) brukes for oversikt og feilsøking.
