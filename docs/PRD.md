# Product Requirements Document — TodoLess beta

## 1. Documentmetadata

| Veld | Waarde |
|---|---|
| Document-ID | `PRD-TODOLESS-BETA` |
| Product | TodoLess |
| Fase | Beta / release candidate |
| Status | Draft voor implementatie en release-gating |
| Versie | 0.1.0 |
| Laatst bijgewerkt | 2026-08-11 |
| Productbron | branch `red` |
| Beta-baseline | commit `96a9dc5` |
| Repository | `todoless-calendar-fix` |
| Primaire focus | Onboarding, familie, invites, ledenbeheer, privacy en basistests |
| Taalconventie | Nederlands, met Engelse code-termen en stabiele requirement/test-ID's |

### 1.1 Revisiehistorie

| Versie | Datum | Wijziging | Auteur/owner |
|---|---|---|---|
| 0.1.0 | 2026-08-11 | Eerste uitbreidbare PRD op basis van de actuele `red`-worktree en beta-baseline | Product/Engineering |

### 1.2 Documentconventies

- Functionele requirements gebruiken blijvende ID's `FR-*`; ID's worden niet hergebruikt.
- Non-functionals gebruiken `NFR-*`; basistests gebruiken `BT-*`.
- Prioriteiten: **P0** = release blocker, **P1** = kort na beta, **P2** = later.
- `MUST`, `SHOULD` en `MAY` volgen de gebruikelijke RFC-betekenis.
- Een requirement dat vervalt blijft in de historie als *deprecated*; het nummer wordt niet opnieuw toegekend.
- Geen credentials, tokens, invite-codes, secrets of persoonsgegevens worden in dit document of testbewijs opgenomen.

## 2. Repo-baseline en bestaand productgedrag

Deze PRD beschrijft gewenst gedrag en is gebaseerd op inspectie van de actuele `red`-worktree. `red` is de bron van waarheid; commit `96a9dc5` is de bestaande beta/release-candidate-baseline. `main` en productie-uitrol vallen buiten dit document.

### 2.1 Relevante bestaande structuur

| Gebied | Bestaande implementatie |
|---|---|
| App routing/gate | `src/App.tsx`, `src/lib/onboarding-gate.ts`, `src/lib/bootstrap-status.ts` |
| Onboarding | `src/components/Onboarding.tsx` |
| Login/registratie/session | `src/components/Login.tsx`, `src/components/Register.tsx`, `src/components/AuthProvider.tsx` |
| Frontend API | `src/lib/pocketbase-client.ts` |
| Familie-/app-state | `src/context/AppContext.tsx` |
| Invites | `src/components/InviteManager.tsx`, routes in `pb_hooks/main.pb.js` |
| Ledenbeheer | `src/components/MembersView.tsx`, action dispatcher in `pb_hooks/main.pb.js` |
| Datamodel/rules | `pb_migrations/`, waaronder family-, identity-, sharing- en privacy-migrations |
| Tests | `src/__tests__/`, `tests/`, Vitest en Node test runner |

### 2.2 Aangetroffen functionaliteit

- Een schone installatie gebruikt `/api/setup-status` om first-run onboarding te kiezen.
- De eerste registratie maakt één user en één `families`-record; de user krijgt dat `family_id`.
- Verdere publieke registratie loopt via `/api/register` en vereist een geldige, ongebruikte, niet-verlopen invite.
- De invite is gekoppeld aan de inviter; de geregistreerde user erft de `family_id` van de inviter.
- Alleen `admin`/`owner` kan via de gebruikte frontend-route een human invite genereren; huidige server-expiry is zeven dagen.
- De ledenpagina toont family users en biedt role change, block/unblock en delete-acties.
- Het identity-model kent `owner`, `admin`, `member`, `agent`, plus `member_status` en `member_type`.
- Taken en boodschappen hebben family sharing en een private vlag; labels kennen `private`, `shared` en `family` visibility.
- Bestaande unit/contracttests dekken delen van onboarding, login accessibility, ledenbeheer-UI, family filtering en label/task privacy.

### 2.3 Bekende beta-gap die P0-verificatie vereist

De invite-flow was niet end-to-end bewezen met een daadwerkelijk aangemaakte tweede user. Tijdens de P0-reproductie zijn twee concrete contractdefecten vastgesteld: gegenereerde codes behielden mixed case terwijl validatie/registratie uppercase gebruikte, en handmatige frontendvalidatie verwachtte een niet-bestaand genest `invite`-object. De huidige releasekandidaat normaliseert bestaande en nieuwe codes, gebruikt één vlak validatiecontract en heeft een verplichte two-user basistestketen. Invitefunctionaliteit is pas release-ready nadat die keten ook op de gedeployde beta slaagt.

## 3. Productvisie

TodoLess geeft een familie één rustige, self-hosted plek voor gedeelde dagelijkse organisatie, zonder persoonlijke gegevens onbedoeld met andere familieleden of externe partijen te delen.

### 3.1 Productprincipes

1. **Eén onboarding, één familie:** first-run maakt precies één initiële familie; invitees komen in diezelfde familie.
2. **Invite-only na bootstrap:** na de eerste admin bestaat geen open registratiepad.
3. **Privacy by default en server-side:** private data wordt door API/rules afgeschermd, niet alleen verborgen in de UI.
4. **Fail closed:** twijfelachtige auth-, invite-, family- of permission-states geven geen toegang.
5. **Mobile-first, overal bruikbaar:** kernflows werken op desktop, tablet en mobile.
6. **Test-first:** P0-gedrag krijgt geautomatiseerde regressiedekking vóór release.
7. **Self-hosted en data-soeverein:** family data blijft op de installatie van de gebruiker.

### 3.2 Beta-succesdefinitie

Een nieuwe beheerder kan vanaf een schone database een familie starten, een tweede persoon veilig uitnodigen en beide users kunnen dezelfde gedeelde data zien terwijl private data strikt gescheiden blijft. Alle P0-basistests slagen in een reproduceerbare omgeving.

## 4. Scope

### 4.1 In scope voor beta

- First-run detectie en first-admin onboarding.
- Aanmaken van precies één initiële familie tijdens onboarding.
- Login, session restore en logout voor human users.
- Admin/owner invite generatie, delen, validatie, acceptatie en single-use lifecycle.
- Automatische family-toewijzing van invitees aan de familie van de inviter.
- Ledenlijst en basisledenbeheer: role, blokkeren/deblokkeren en verwijderen.
- Family-scoped shared data en user-scoped private data.
- Loading, empty, success, validation, expired, reused, forbidden en error states.
- Responsive werking op desktop, tablet en mobile.
- P0-basistestmatrix, testdata-isolatie en release-gating.
- Bestaande UI-talen NL/FR/EN/DE/ES voor gebruikerszichtbare kernteksten.

### 4.2 Non-scope voor deze beta

- Deploy naar `main` of productie en productie-operaties.
- Meerdere families per installatie of per user.
- Een user tussen families verplaatsen of families samenvoegen.
- Publieke self-signup zonder invite na first-run.
- E-mailbezorging als harde voorwaarde; kopiëren/delen van een invite-link volstaat.
- Social login, SSO, MFA en enterprise identity management.
- Volwaardige agent onboarding en API-tokenbeheer; bestaande agent-features blijven buiten deze human invite scope.
- Nieuwe modules buiten de bestaande TodoLess-functies.
- Billing, abonnementen, analytics, advertenties of tracking.
- Native mobile apps; responsive web/PWA valt wel binnen scope.

## 5. Persona's

| ID | Persona | Doel | Belangrijkste risico |
|---|---|---|---|
| `PER-01` | First admin / family owner | Installatie starten, familie benoemen en eerste account maken | Onbedoeld open registratiepad of half-afgeronde setup |
| `PER-02` | Family admin | Mensen uitnodigen en leden veilig beheren | Cross-family beheer of verlies van laatste beheerder |
| `PER-03` | Family member | Invite accepteren, inloggen en samenwerken | Niet in juiste familie terechtkomen |
| `PER-04` | Privacybewuste member | Persoonlijke taken/items afschermen | Private data zichtbaar via list, direct URL of alternatieve API-route |
| `PER-05` | Self-hoster | Betrouwbare beta installeren, testen, back-uppen | Niet-reproduceerbare setup of secrets in documentatie/logs |

## 6. User journeys

### `UJ-01` — Schone installatie naar first admin

1. Self-hoster start TodoLess met een schone database.
2. App vraagt setup-status op en toont admin-onboarding.
3. User kiest taal, ziet de introductie, vult family name en accountgegevens in.
4. Server maakt atomair de eerste human admin en één familie aan en koppelt beide.
5. User wordt geauthenticeerd en opent de app.
6. Bij refresh blijft de user ingelogd; bij logout verschijnt login, geen admin-onboarding.

### `UJ-02` — Admin nodigt familielid uit

1. Admin logt in en opent Settings → Leden.
2. Admin genereert een human invite.
3. TodoLess toont code, link en geldigheid zonder gevoelige accountdata.
4. Admin kopieert/deelt de link.
5. Openstaande, gebruikte en verlopen invites hebben onderscheidbare states.

### `UJ-03` — Invite accepteren in aparte context

1. Genodigde opent de link in een incognito/andere browser-context zonder admin-session.
2. App bewaart/verwerkt de invite zonder de admin-authcontext over te nemen.
3. Server valideert code, type, expiry, unused-state en inviter family.
4. Genodigde registreert een uniek account.
5. Server maakt de user als actief `member` in exact dezelfde familie en consumeert de invite éénmalig.
6. Nieuwe user kan inloggen en ziet de eigen onboarding/app.
7. Admin ziet de geaccepteerde user in de ledenlijst na refresh/realtime update.

### `UJ-04` — Shared versus private data

1. Admin/user A maakt herkenbare family-shared en private fixtures.
2. User B logt in.
3. User B ziet shared family data volgens modulepermissions.
4. User B ziet private data van user A nergens: niet in list/search/count/realtime/direct URL/custom API.
5. User A blijft eigen private data zien en beheren.

### `UJ-05` — Ledenbeheer

1. Beheerder opent een lid in de ledenlijst.
2. Beheerder wijzigt toegestane role/status of verwijdert het lid na confirmation.
3. Server verifieert actuele actor-role en family op het moment van de actie.
4. Owner/self/last-admin guardrails blokkeren onveilige acties.
5. UI synchroniseert met serverresultaat en toont expliciete feedback.

## 7. Functionele requirements

### 7.1 Bootstrap en onboarding

| ID | Prio | Requirement |
|---|---|---|
| `FR-ONB-001` | P0 | De app MUST via server-side setup-status vaststellen of er users bestaan; bij nul users wordt first-admin onboarding getoond. |
| `FR-ONB-002` | P0 | Alleen wanneer de database nul users bevat, MUST registratie zonder invite zijn toegestaan. |
| `FR-ONB-003` | P0 | First-admin onboarding MUST taal, family name, voornaam, optionele achternaam, uniek e-mailadres, password en password confirmation verzamelen en valideren. |
| `FR-ONB-004` | P0 | De server MUST de eerste human user en exact één familie aanmaken en de user aan die familie koppelen; een gedeeltelijke setup mag niet als voltooid worden getoond. |
| `FR-ONB-005` | P0 | De first user MUST een beheerrol krijgen die invites en ledenbeheer kan uitvoeren; beta noemt deze rol in de UI “admin”, ook als het datamodel later `owner` canoniseert. |
| `FR-ONB-006` | P0 | Na succesvolle onboarding MUST de first admin een geldige session hebben en de app kunnen openen zonder extra login. |
| `FR-ONB-007` | P0 | Na bestaande setup MUST een unauthenticated bezoeker naar info/login gaan en nooit opnieuw first-admin kunnen aanmaken. |
| `FR-ONB-008` | P1 | Een ingelogde user die de introductie nog niet heeft gezien SHOULD user-onboarding kunnen voltooien of overslaan, zonder family/account opnieuw aan te maken. |
| `FR-ONB-009` | P1 | Onboarding completion MUST per user worden bijgehouden; browser-local state mag niet de enige bron van waarheid zijn. |

### 7.2 Authentication en sessions

| ID | Prio | Requirement |
|---|---|---|
| `FR-AUTH-001` | P0 | Een actieve human user MUST met e-mail en password kunnen inloggen. |
| `FR-AUTH-002` | P0 | Ongeldige credentials MUST generieke foutfeedback geven zonder account-existence te lekken. |
| `FR-AUTH-003` | P0 | Een geldige session MUST bij refresh veilig worden hersteld en bij ongeldigheid worden gewist. |
| `FR-AUTH-004` | P0 | Logout MUST lokale auth-state en tokens wissen en protected app-content ontoegankelijk maken. |
| `FR-AUTH-005` | P0 | Een geblokkeerde user MUST geen app- of API-toegang behouden, ook niet via een eerder uitgegeven session of API-route. |
| `FR-AUTH-006` | P1 | Auth-forms SHOULD password-manager-, keyboard- en screenreader-vriendelijk zijn. |

### 7.3 Familie

| ID | Prio | Requirement |
|---|---|---|
| `FR-FAM-001` | P0 | Beta MUST per installatie uitgaan van één via onboarding aangemaakte familie. |
| `FR-FAM-002` | P0 | Elke human invite MUST de family identity server-side afleiden van de inviter; clientinput voor `family_id` MUST worden genegeerd/afgewezen. |
| `FR-FAM-003` | P0 | Een invitee MUST na succesvolle registratie exact dezelfde non-empty `family_id` hebben als de inviter. |
| `FR-FAM-004` | P0 | Ledenlijsten en member actions MUST server-side tot de eigen familie beperkt zijn. |
| `FR-FAM-005` | P0 | Shared records MUST alleen binnen dezelfde familie zichtbaar/bewerkbaar zijn volgens collection- en role-permissions. |
| `FR-FAM-006` | P2 | Family rename en uitgebreid family profile MAY later worden toegevoegd zonder `family_id` te wijzigen. |

### 7.4 Invites

| ID | Prio | Requirement |
|---|---|---|
| `FR-INV-001` | P0 | Alleen een actuele `admin`/`owner` in een geldige familie MUST een human invite kunnen genereren. |
| `FR-INV-002` | P0 | Invite-codes MUST server-side met cryptografisch veilige randomness worden gegenereerd, voldoende entropie hebben en niet voorspelbaar zijn. |
| `FR-INV-003` | P0 | Elke invite MUST een server-owned creator, family-afleiding, type, creation time, expiry, used-state en optioneel `used_by`/`used_at` hebben. |
| `FR-INV-004` | P0 | UI MUST een deelbare `/register?invite=…`-link en copy/share fallback leveren. |
| `FR-INV-005` | P0 | Een invite MUST zonder bestaande session in een aparte browser-context kunnen worden geopend en geaccepteerd. |
| `FR-INV-006` | P0 | Validatiecontract tussen frontend en backend MUST één gedocumenteerde response-shape gebruiken en valid/invalid/expired/used onderscheidbaar verwerken zonder gevoelige inviter-data te lekken. |
| `FR-INV-007` | P0 | Acceptatie MUST invitevalidatie, user creation, family assignment en invite consumption als één transactioneel/atomair proces uitvoeren of volledig terugrollen. |
| `FR-INV-008` | P0 | Een invite MUST single-use zijn; concurrente of herhaalde acceptatie levert maximaal één geaccepteerd account op. |
| `FR-INV-009` | P0 | Ontbrekende, malformed, onbekende, verlopen, verwijderde of al gebruikte invites MUST fail-closed registratiefouten geven. |
| `FR-INV-010` | P0 | Na eerste bootstrap MUST `/api/register` registratie zonder geldige invite weigeren, ongeacht clientroute of request body. |
| `FR-INV-011` | P0 | De invitee MUST standaard als actief human `member` worden aangemaakt en mag via de invite geen admin/owner/agent role kiezen. |
| `FR-INV-012` | P1 | Admin SHOULD openstaande, gebruikte en verlopen invites kunnen zien en een ongebruikte invite kunnen intrekken/verwijderen. |
| `FR-INV-013` | P1 | Invite-expiry SHOULD configureerbaar zijn; de gekozen default en tijdzone/UTC-semantiek moeten expliciet worden vastgelegd. |
| `FR-INV-014` | P2 | Resend en e-mail delivery MAY worden toegevoegd, maar de invite-link blijft zelfstandig bruikbaar. |

### 7.5 Ledenbeheer

| ID | Prio | Requirement |
|---|---|---|
| `FR-MEM-001` | P0 | Na inviteacceptatie MUST de nieuwe user na refresh of realtime update zichtbaar zijn in de ledenlijst van de inviter. |
| `FR-MEM-002` | P0 | Een member MUST alleen leden uit de eigen familie kunnen zien. |
| `FR-MEM-003` | P0 | Alleen actuele `admin`/`owner` roles MUST role-, block- en delete-actions kunnen uitvoeren; server MUST actor-record opnieuw uit de database laden. |
| `FR-MEM-004` | P0 | Member actions MUST cross-family targets weigeren en geen targetdetails lekken. |
| `FR-MEM-005` | P0 | Owner MUST niet gedegradeerd, geblokkeerd of verwijderd kunnen worden via standaard member actions. |
| `FR-MEM-006` | P0 | Een actor MUST zichzelf niet kunnen blokkeren of verwijderen. |
| `FR-MEM-007` | P0 | Het systeem MUST voorkomen dat een familie zonder actieve beheerder achterblijft; role-transferregels moeten deterministisch zijn. |
| `FR-MEM-008` | P0 | API tokens/agents MUST geen human member-management actions kunnen uitvoeren. |
| `FR-MEM-009` | P1 | Blokkeren/deblokkeren en verwijderen SHOULD confirmation, loading, success en failure feedback tonen en stale UI-state voorkomen. |
| `FR-MEM-010` | P1 | Bij verwijderen MUST ownership/data-retention per collection expliciet en testbaar zijn; stil dataverlies is niet toegestaan. |

### 7.6 Shared en private data

| ID | Prio | Requirement |
|---|---|---|
| `FR-PRV-001` | P0 | Een eigenaar MUST een bestaand privacy-attribuut kunnen gebruiken om ondersteunde data private te maken. |
| `FR-PRV-002` | P0 | Family-shared data MUST voor beide actieve family users zichtbaar zijn in relevante lists/views. |
| `FR-PRV-003` | P0 | Private data van user A MUST voor user B verborgen zijn via collection list/view, direct-record URL, search/filter/count, realtime, custom hooks, agent/API-tokenroutes en export. |
| `FR-PRV-004` | P0 | De eigenaar MUST eigen private data kunnen lezen en beheren. |
| `FR-PRV-005` | P0 | Labels met `private`, `shared` en `family` visibility MUST server-side worden afgedwongen; mixed-label gedrag MUST fail-closed en consistent zijn. |
| `FR-PRV-006` | P0 | API-antwoorden voor niet-toegankelijke private records SHOULD zich gedragen als “not found” waar dit existence leakage vermindert. |
| `FR-PRV-007` | P1 | De UI SHOULD visibility duidelijk tonen vóór opslaan en in relevante detailviews, zonder private metadata aan onbevoegde users te leveren. |

## 8. Non-functional requirements

| ID | Prio | Requirement / meetpunt |
|---|---|---|
| `NFR-SEC-001` | P0 | Auth, family scoping, invite lifecycle en privacy worden server-side afgedwongen; client filtering is nooit de enige controle. |
| `NFR-SEC-002` | P0 | Invite- en auth-fouten zijn fail-closed; onverwachte exceptions geven geen stacktrace, secret of intern record terug aan de client. |
| `NFR-SEC-003` | P0 | Passwords worden uitsluitend via PocketBase auth/password hashing verwerkt en nooit gelogd of in testfixtures/documentatie vastgelegd. |
| `NFR-SEC-004` | P0 | Repo- en CI-secret scan MUST groen zijn; testbewijs redigeert tokens, invite-codes, e-mails en persoonsgegevens. |
| `NFR-SEC-005` | P0 | Invite consumption MUST race-safe zijn; twee gelijktijdige requests kunnen niet beide slagen. |
| `NFR-PRV-001` | P0 | Geen cross-family of cross-user private data leakage via enig actief leespad. |
| `NFR-REL-001` | P0 | Bootstrap en inviteacceptatie zijn atomair of herstelbaar zonder orphan user/family/invite-state. |
| `NFR-REL-002` | P0 | Alle P0-tests zijn deterministisch vanaf een schone, geïsoleerde database en laten geen testdata achter in gedeelde omgevingen. |
| `NFR-PERF-001` | P1 | Kernschermen tonen binnen 2 s bruikbare loading/content feedback op een gangbare LAN self-hosted installatie, exclusief cold image pull. |
| `NFR-UX-001` | P0 | Kernacties hebben loading, success, empty en actionable error feedback; dubbele submit wordt voorkomen. |
| `NFR-RWD-001` | P0 | Onboarding, login, inviteacceptatie, ledenlijst en logout zijn functioneel zonder horizontale overflow op mobile (360×800), tablet (768×1024) en desktop (1440×900). |
| `NFR-A11Y-001` | P1 | Kernflows zijn met keyboard uitvoerbaar, hebben zichtbare focus, gekoppelde labels, zinvolle headings en `role=alert` voor errors. |
| `NFR-I18N-001` | P1 | Alle gebruikerszichtbare kernteksten bestaan in NL/FR/EN/DE/ES; code-termen en errors worden niet als untranslated raw backend strings getoond. |
| `NFR-COMP-001` | P0 | Beta ondersteunt actuele Chromium en Firefox; responsive PWA-web wordt op minimaal één touchbrowser gesmoked. |
| `NFR-OBS-001` | P1 | Serverlogs bevatten correlation-/eventcontext voor setup, invite en member action, maar geen password, raw auth-token of volledige invite-code. |
| `NFR-MNT-001` | P0 | Wijzigingen volgen test-first: failing regressiontest vóór fix, daarna unit/contract/integration/E2E plus typecheck/build. |

## 9. UX, schermen en states

### 9.1 Kernschermen

| Scherm | Verplichte states |
|---|---|
| Setup-status gate | checking, safe fallback, first-run, existing setup, server error |
| Admin-onboarding | language, welcome, modules, family/workspace, account, submitting, success, recoverable error |
| Login | idle, client validation, submitting, invalid credentials, blocked, success |
| Invite manager | empty, generating, active, copy/share success/failure, used, expired, revoked/deleting |
| Invite registratie | invite parsing, validating, valid, registration form, submitting, success, invalid, expired, reused, network error |
| Ledenlijst | loading, empty/impossible-state, populated, search-no-results, action pending, forbidden, success, failure |
| App data | loading, loaded, empty, retryable error, unauthorized/session expired |

### 9.2 UX-regels

- Een invite-link opent direct de invite-registratieflow en mag niet door algemene info-onboarding worden onderschept.
- Een geldige URL mag validation UX versnellen, maar registratie MUST server-side opnieuw valideren.
- Valid/invalid/expired/reused heeft begrijpelijke tekst; de user krijgt nooit een “succes” voordat servercommit voltooid is.
- Buttons voor submit/generate/member action zijn disabled tijdens dezelfde request.
- Destructieve acties vereisen confirmation en tonen pas success na serverbevestiging.
- Role/status-controls worden niet getoond aan gewone members, maar backend authorization blijft verplicht.
- Logout is bereikbaar op alle ondersteunde viewports.
- Touch targets zijn minimaal 44×44 CSS pixels.
- Geen state bevat een echte invite-code, token, password of credential in screenshotnamen, console-output of testartifact.

## 10. Privacy- en permissiematrix

### 10.1 Rollen en acties

Legenda: ✅ toegestaan, ❌ verboden, ◐ alleen eigen record/data, — niet van toepassing.

| Actie | Owner | Admin | Member | Agent/API token | Unauthenticated |
|---|---:|---:|---:|---:|---:|
| First account maken bij schone DB | — | — | — | ❌ | ✅ éénmalig |
| Registreren na bootstrap | — | — | — | ❌ in human flow | ✅ alleen geldige invite |
| Human invite genereren | ✅ | ✅ | ❌ | ❌ | ❌ |
| Invites eigen familie beheren | ✅ | ✅ | ❌ | ❌ | ❌ |
| Family leden zien | ✅ | ✅ | ✅ | Alleen expliciete read scope, geen beheer | ❌ |
| Role wijzigen | ✅ met guardrails | ✅ met guardrails | ❌ | ❌ | ❌ |
| Lid blokkeren/verwijderen | ✅ met guardrails | ✅ met guardrails | ❌ | ❌ | ❌ |
| Eigen profiel wijzigen | ◐ | ◐ | ◐ | ❌ | ❌ |
| Shared family data lezen | ✅ | ✅ | ✅ | Alleen expliciete scope | ❌ |
| Shared family data wijzigen | Volgens collection rule | Volgens collection rule | Volgens collection rule | Alleen expliciete scope | ❌ |
| Eigen private data lezen/wijzigen | ◐ | ◐ | ◐ | Alleen owner-bound expliciete scope | ❌ |
| Private data ander lid lezen | ❌ | ❌ | ❌ | ❌ | ❌ |
| Cross-family data/leden | ❌ | ❌ | ❌ | ❌ | ❌ |

### 10.2 Data visibility

| Data-/visibilitytype | Owner van record | Zelfde familie, ander lid | Andere familie | Unauthenticated |
|---|---:|---:|---:|---:|
| `family` / non-private | ✅ | ✅ volgens module rule | ❌ | ❌ |
| `shared` label | ✅ | ✅ alleen expliciet gedeeld | ❌ | ❌ |
| `private` / `is_private=true` | ✅ | ❌ | ❌ | ❌ |
| Family member profile | ✅ | ✅ minimale familyvelden | ❌ | ❌ |
| Invite metadata | Admin/owner van familie | ❌ | ❌ | Alleen minimale validatiestatus |
| Password/token/secret | Nooit als leesbare data | Nooit | Nooit | Nooit |

## 11. Acceptance criteria

### `AC-ONB-01` — Bootstrap

**Given** een lege database, **when** een geldige first-admin onboarding éénmaal wordt ingediend, **then** bestaan één user en één familie, verwijst de user naar die familie, is de user geauthenticeerd en kan een tweede bootstrap zonder invite niet slagen. Dekt `FR-ONB-001` t/m `FR-ONB-007`.

### `AC-INV-01` — Happy path invite

**Given** een ingelogde admin met een familie, **when** die een invite maakt en een unauthenticated tweede browser-context registreert via de link, **then** wordt exact één actief human member met dezelfde `family_id` gemaakt, wordt de invite éénmaal consumed en verschijnt de user in de ledenlijst. Dekt `FR-FAM-002` t/m `FR-FAM-004`, `FR-INV-001` t/m `FR-INV-011`, `FR-MEM-001`.

### `AC-INV-02` — Fail-closed invite

Voor ieder van missing, malformed, unknown, expired, deleted en reused invite geldt: registratie maakt geen user, wijzigt geen familie, consumeert geen andere invite en toont geen gevoelige details. Dekt `FR-INV-006` t/m `FR-INV-010`.

### `AC-MEM-01` — Ledenbeheer

Een beheerder kan een ander member binnen de eigen familie volgens guardrails beheren; member, API token en cross-family actor kunnen dat niet. Owner/self/last-admin blijft beschermd. Dekt `FR-MEM-002` t/m `FR-MEM-010`.

### `AC-PRV-01` — Shared zichtbaar

Een shared task en shared grocery fixture van user A in familie F zijn na login voor user B uit familie F zichtbaar in de relevante UI én API-list, volgens de collection rule. Dekt `FR-FAM-005`, `FR-PRV-002`.

### `AC-PRV-02` — Private verborgen

Een private task/item/label fixture van user A is voor user B niet zichtbaar via UI, list, direct read, filter/count, realtime, custom route of export; user A ziet de fixture wel. Dekt `FR-PRV-001`, `FR-PRV-003` t/m `FR-PRV-006`.

### `AC-RWD-01` — Responsive kernflow

De volledige onboarding/login/invite/member/logout-flow kan op 360×800, 768×1024 en 1440×900 worden uitgevoerd zonder afgesneden controls, horizontale overflow of onbereikbare actie. Dekt `NFR-RWD-001`.

## 12. Roadmap en releaseprioriteit

### P0 — Beta release blockers

- Contractfix en bewezen E2E-flow voor invites met een echte tweede user.
- Schone DB → first admin → één familie.
- Admin- en tweede-user login/session/logout.
- Single-use, race-safe, fail-closed inviteacceptatie.
- Geaccepteerde user zichtbaar in de family ledenlijst.
- Shared data zichtbaar; private data server-side verborgen op alle actieve routes.
- Family-scoped en guarded ledenbeheer.
- Desktop/tablet/mobile smoke.
- Alle `BT-P0-*` tests groen plus typecheck, build en secret scan.

### P1 — Beta hardening

- Toegankelijke, gelokaliseerde states voor alle kernflows.
- Configureerbare invite-expiry en duidelijk revoke-beheer.
- Verbeterde audit/observability zonder gevoelige data.
- Expliciet dataretentie-/ownershipbeleid bij member deletion.
- Performancebudget en cross-browser automatisering.

### P2 — Na beta

- Multi-family ontwerp, family transfer/merge.
- E-mail delivery/resend en uitgebreid invitebeheer.
- MFA/SSO en uitgebreid role model.
- Native companion onboarding.
- Uitgebreid family profile en beheer.

## 13. Verplichte basistestmatrix

### 13.1 Testregels

- Iedere P0-test start met een expliciete fixture-state en gebruikt synthetische, unieke testaccounts uit runtime config; waarden worden niet in source, documentatie, screenshots of logs vastgelegd.
- Happy-path E2E gebruikt **twee geïsoleerde browser-contexten**: context A voor admin, context B voor invitee.
- Voor privacy worden shared en private fixtures inhoudelijk herkenbaar maar niet persoonsgebonden gemaakt.
- API-asserties bewijzen server-side gedrag; alleen “niet zichtbaar in UI” is onvoldoende.
- Tests ruimen database-, session- en browserstate op of verwijderen de volledige disposable testdatabase.

| ID | Prio | Niveau | Scenario | Kernasserties | Viewport |
|---|---|---|---|---|---|
| `BT-P0-001` | P0 | E2E + API | Schone DB → first admin | Setup toont admin-onboarding; één user; één familie; non-empty gelijke family-link; beheerrol; authenticated app | Desktop |
| `BT-P0-002` | P0 | E2E | Admin login | Logout/nieuwe context → geldige admin login opent protected app; ongeldige login faalt generiek | Desktop |
| `BT-P0-003` | P0 | E2E + API | Invite genereren | Alleen admin/owner slaagt; response bevat veilige code, expiry, unused-state; family van actor is server-owned | Desktop |
| `BT-P0-004` | P0 | E2E | Invite openen in aparte context | Context B heeft geen admin-session en opent rechtstreeks registratie met pending invite | Desktop |
| `BT-P0-005` | P0 | E2E + API | Invite accepteren/registreren | Tweede account wordt aangemaakt; invite consumed; role=`member`; type=`human`; status=`active`; exact dezelfde `family_id` | Desktop |
| `BT-P0-006` | P0 | E2E + API | Geaccepteerde user zichtbaar als familielid | Context A refresh/realtime toont exact één nieuwe member; geen users uit andere families | Desktop |
| `BT-P0-007` | P0 | E2E | Login tweede user | Context B kan na logout opnieuw inloggen en protected app openen | Desktop |
| `BT-P0-008` | P0 | E2E + API | Shared data zichtbaar | Shared task en grocery van A zijn zichtbaar voor B in UI en authorized API-list | Desktop |
| `BT-P0-009` | P0 | E2E + API security | Private data verborgen | Private task/item/label van A ontbreekt voor B in UI/list/search/count/direct read/custom route/export; A ziet ze wel | Desktop |
| `BT-P0-010` | P0 | API integration | Invalid invite fail-closed | Onbekende/malformed code geeft gecontroleerde failure; user/family/invite counts ongewijzigd | n.v.t. |
| `BT-P0-011` | P0 | API integration | Expired invite fail-closed | Verlopen code kan niet valideren/registreren; geen user gemaakt; invite blijft niet bruikbaar | n.v.t. |
| `BT-P0-012` | P0 | API integration + concurrency | Reused invite fail-closed | Tweede en parallelle acceptatie falen; maximaal één user; `used_by`/`used_at` consistent | n.v.t. |
| `BT-P0-013` | P0 | E2E | Logout admin en tweede user | Auth-store/session gewist; protected content weg; refresh blijft unauthenticated | Desktop |
| `BT-P0-014` | P0 | Responsive E2E | Desktop kernflow | `BT-P0-001` t/m `BT-P0-007` smoke op 1440×900 zonder overflow/onbereikbare controls | 1440×900 |
| `BT-P0-015` | P0 | Responsive E2E | Tablet kernflow | Login, invite open/accept, member zichtbaar en logout op 768×1024 | 768×1024 |
| `BT-P0-016` | P0 | Responsive E2E | Mobile kernflow | Login, invite open/accept, member zichtbaar en logout op 360×800; touch controls ≥44 px | 360×800 |
| `BT-P0-017` | P0 | API authorization | Registratie zonder invite na bootstrap | Directe `/api/register` call wordt geweigerd; geen user/family aangemaakt | n.v.t. |
| `BT-P0-018` | P0 | API authorization | Cross-family ledenbeheer | Actor uit familie A kan user uit familie B niet zien/wijzigen/blokkeren/verwijderen | n.v.t. |
| `BT-P0-019` | P0 | API authorization | Owner/self/last-admin guardrails | Onveilige demote/block/delete-acties falen zonder statewijziging | n.v.t. |
| `BT-P0-020` | P0 | Contract | Frontend/backend invite response | Validatie- en registratie-response voldoen aan één gedeeld contract; geen undefined access of raw internals | n.v.t. |
| `BT-P1-001` | P1 | Accessibility | Keyboard/screenreader kernflow | Labels, focusvolgorde, alerts, headings en dialogs voldoen aan contract | Alle |
| `BT-P1-002` | P1 | i18n | Kernflow in vijf talen | Geen ontbrekende/hardcoded kernteksten in NL/FR/EN/DE/ES | Mobile + desktop |
| `BT-P1-003` | P1 | Performance | Kernscherm feedback | Loading/content feedback binnen budget op referentie-LAN | Desktop |
| `BT-P1-004` | P1 | Browser matrix | Chromium/Firefox/touch smoke | Zelfde functionele uitkomst in ondersteunde browsers | Alle |

### 13.2 Bestaande tests versus benodigde dekking

Bestaande tests leveren nuttige regressiedekking voor onboarding-UI, login accessibility, member-management UI, family filtering, privacyregels en backend contracts. Zij vervangen de bovenstaande P0-E2E echter niet: er is nog geen bewezen testketen die een tweede user via een echte invite accepteert, opnieuw inlogt en shared/private gedrag in twee browser-contexten controleert.

## 14. Definition of Done

Een P0 requirement of beta-release is pas **Done** wanneer:

1. Requirement en acceptance criteria hebben stabiele ID's en traceerbare tests.
2. Voor een bugfix bestaat eerst een falende regressietest die de fout reproduceert.
3. Implementatie gebruikt de bestaande repo-architectuur (`src/`, `pb_hooks/`, `pb_migrations/`) zonder parallel shadow-contract.
4. Frontend- en backendcontracten zijn gelijk en type-/contracttests dekken response-shapes.
5. Authorization en privacy zijn server-side bewezen via list én direct/custom route tests.
6. Schone-installatie én upgradepad zijn getest wanneer schema/migrations wijzigen.
7. Alle `BT-P0-*` tests slagen op een disposable database.
8. `npm run typecheck`, `npm test`, relevante Node backendtests en `npm run build` slagen.
9. Secret scan slaagt; artifacts/logs bevatten geen credentials, raw tokens, invite-codes of persoonsgegevens.
10. Desktop/tablet/mobile kernsmokes slagen en essentiële a11y-checks hebben geen P0-blokkers.
11. Errors, loading, empty en success states zijn aanwezig en gelokaliseerd waar van toepassing.
12. Code review bevestigt family scoping, race-safety, owner/self/last-admin guardrails en minimale datalekken.
13. PRD changelog, open beslissingen en traceability zijn bijgewerkt.
14. `red` blijft de bron van waarheid; promotie naar beta gebeurt pas na groen releasebewijs. `main`/prod blijft buiten deze DoD.

## 15. Traceability-overzicht

| Productdoel | Requirements | Acceptance criteria | Basistests |
|---|---|---|---|
| First-run veilig starten | `FR-ONB-*`, `FR-FAM-001` | `AC-ONB-01` | `BT-P0-001`, `BT-P0-002`, `BT-P0-017` |
| Tweede user veilig uitnodigen | `FR-INV-*`, `FR-FAM-002..004` | `AC-INV-01`, `AC-INV-02` | `BT-P0-003..007`, `BT-P0-010..012`, `BT-P0-020` |
| Familie beheren | `FR-MEM-*` | `AC-MEM-01` | `BT-P0-006`, `BT-P0-018`, `BT-P0-019` |
| Samenwerken zonder privacylek | `FR-FAM-005`, `FR-PRV-*` | `AC-PRV-01`, `AC-PRV-02` | `BT-P0-008`, `BT-P0-009` |
| Bruikbaar op elk kernformaat | `NFR-RWD-001`, `NFR-UX-001` | `AC-RWD-01` | `BT-P0-014..016` |
| Session veilig beëindigen | `FR-AUTH-*` | onderdeel van journeys | `BT-P0-002`, `BT-P0-007`, `BT-P0-013` |

## 16. Open beslissingen

| ID | Prio | Beslissing nodig | Opties / advies |
|---|---|---|---|
| `OD-001` | P0 | Canonieke naam/semantiek first beheerder | Kies `owner` als onvervreemdbare first user óf `admin` als enige beheerrol. Huidige code bevat beide concepten; advies: één owner + optionele admins, en pas single-adminregels daarop aan. |
| `OD-002` | P0 | Invite validation response-shape | Kies minimale DTO, bijvoorbeeld `{status, family_name?}`; frontend mag geen niet-bestaand `invite`-object verwachten. Leg OpenAPI/contracttest vast. |
| `OD-003` | P0 | Atomiciteit inviteacceptatie | Bepaal ondersteunde PocketBase transaction/locking-aanpak en bewijs concurrency met `BT-P0-012`. |
| `OD-004` | P0 | Wat geldt als “shared data” voor beta gate? | Minimaal tasks en groceries; beslis of notes, calendar projection, shops, labels, rewards/goals ook P0 moeten zijn. |
| `OD-005` | P0 | Private datadomeinen | Inventariseer iedere collection en actieve custom route; maak expliciet welke records `is_private` of visibility ondersteunen. |
| `OD-006` | P1 | Invite expiry default | Huidige gebruikte route hanteert 7 dagen; legacy route noemt 1 uur. Advies: één route/één default, UTC-server-tijd, configureerbaar later. |
| `OD-007` | P1 | Verwijderen van lid | Kies ownership transfer, soft delete/deactivate of hard delete per collection en documenteer retentie. |
| `OD-008` | P1 | Realtime versus refresh ledenlijst | Advies: correctness via refresh verplicht, realtime als UX-verbetering. |
| `OD-009` | P1 | Blocked session revocation | Bepaal of onmiddellijke token invalidation nodig is naast server-side statuscheck per request. |
| `OD-010` | P2 | Multi-family toekomst | Houd schema/API uitbreidbaar, maar introduceer geen beta-complexiteit zonder apart PRD. |

## 17. Risico's en mitigaties

| Risico | Impact | Mitigatie |
|---|---|---|
| Frontend/backend invitecontract wijkt af | Invite handmatige invoer faalt | `FR-INV-006`, gedeelde contracttest `BT-P0-020` |
| Invite dubbel gebruikt door race | Ongeautoriseerde extra user | Atomische consume + uniqueness/lock + `BT-P0-012` |
| Client-only private filtering | Ernstig familiedatalek | Server rules, volledige route-inventory, `BT-P0-009` |
| Stale auth role | Onjuiste member authorization | Fresh actor-record per action, `FR-MEM-003` |
| Owner/admin-model inconsistent | Familie zonder beheerder of onverwachte demotie | Beslis `OD-001`, guardrails `BT-P0-019` |
| Lokale onboarding flag maskeert serverstate | Verkeerd scherm/half setup | Serverstatus leidend, per-user completion, `BT-P0-001/017` |
| Alleen mock/unit QA | Invite lijkt af maar tweede user bestaat niet | Verplichte disposable DB + twee echte browser-contexten |
| Testartifacts lekken gevoelige data | Security/privacy incident | Synthetische runtime data, redaction en secret scan |

## 18. Changelog

### 0.1.0 — 2026-08-11

- Eerste PRD aangemaakt vanuit actuele `red`-repo-inspectie.
- Bestaande onboarding-, familie-, invite-, member- en privacystructuur vastgelegd.
- Stabiele `FR-*`, `NFR-*` en `BT-*` ID-systemen geïntroduceerd.
- Volledige verplichte P0-basistestketen toegevoegd: schone DB, first admin, twee logins, invite in aparte context, acceptatie, family visibility, shared/private data, fail-closed invitegevallen, logout en desktop/tablet/mobile.
- Bekende invite-contractgap en ontbrekend werkelijk tweede-user E2E-bewijs expliciet als P0 release blocker opgenomen.
