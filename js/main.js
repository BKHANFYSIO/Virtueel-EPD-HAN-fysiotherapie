// Globale variabelen
let currentUser = null;
let patients = [];
let currentPatient = null;

// DOM geladen
document.addEventListener('DOMContentLoaded', () => {
    // Controleer of er een gebruiker is ingelogd
    const storedUser = sessionStorage.getItem('currentUser');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        loadPatients();
        navigateTo('home');
    } else {
        navigateTo('login');
    }

    // Event listeners voor navigatie
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const target = e.target.getAttribute('data-target');
            navigateTo(target);
        });
    });

    // Logout knop
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
});

// Navigatie functie
function navigateTo(page) {
    // Controleer of gebruiker is ingelogd voor niet-login pagina's
    if (page !== 'login' && !currentUser) {
        showAlert('Je moet eerst inloggen om toegang te krijgen tot deze pagina.', 'warning', 'login-alerts');
        page = 'login';
    }

    // Verberg alle pagina's
    document.querySelectorAll('.page').forEach(p => {
        p.style.display = 'none';
    });

    // Toon de geselecteerde pagina
    const targetPage = document.getElementById(`${page}-page`);
    if (targetPage) {
        targetPage.style.display = 'block';
    }

    // Update actieve navigatie-item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-target') === page) {
            item.classList.add('active');
        }
    });

    // Specifieke acties per pagina
    switch (page) {
        case 'home':
            updateUserInfo();
            break;
        case 'patients':
            renderPatientList();
            break;
        case 'add-patient':
            resetPatientForm();
            break;
    }
}

// Login functie
function login(event) {
    event.preventDefault();
    
    const firstName = document.getElementById('login-firstname').value.trim();
    const lastName = document.getElementById('login-lastname').value.trim();
    const cop = document.getElementById('login-cop').value;
    const password = document.getElementById('login-password').value;
    
    // Controleer wachtwoord
    if (password !== 'HANfysiotherapie') {
        showAlert('Incorrect wachtwoord. Probeer opnieuw.', 'danger', 'login-alerts');
        return;
    }
    
    if (!firstName || !lastName || !cop) {
        showAlert('Vul alle verplichte velden in.', 'warning', 'login-alerts');
        return;
    }
    
    // Sla gebruiker op in sessie
    currentUser = {
        firstName,
        lastName,
        cop,
        fullName: `${firstName} ${lastName}`
    };
    
    sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    // Laad patiënten uit lokale opslag
    loadPatients();
    
    // Navigeer naar home
    navigateTo('home');
    updateUserInfo();
}

// Logout functie
function logout() {
    if (confirm('Waarschuwing: Bij uitloggen gaan alle niet-opgeslagen gegevens verloren. Het is aan te raden eerst een PDF te genereren van je ingevulde dossiers voordat je uitlogt, bijvoorbeeld voor gebruik in eJournal. Wil je doorgaan met uitloggen?')) {
        sessionStorage.removeItem('currentUser');
        currentUser = null;
        navigateTo('login');
    }
}

// Update gebruikersinfo in header
function updateUserInfo() {
    if (!currentUser) return;
    
    const userNameElement = document.getElementById('user-name');
    if (userNameElement) {
        userNameElement.textContent = `${currentUser.fullName} (${currentUser.cop})`;
    }
}

// Laad patiënten uit lokale opslag
function loadPatients() {
    const storedPatients = localStorage.getItem('patients');
    if (storedPatients) {
        patients = JSON.parse(storedPatients);
    }
}

// Sla patiënten op in lokale opslag
function savePatients() {
    localStorage.setItem('patients', JSON.stringify(patients));
}

// Toon patiëntenlijst
function renderPatientList() {
    const patientListElement = document.getElementById('patient-list');
    if (!patientListElement) return;
    
    patientListElement.innerHTML = '';
    
    if (patients.length === 0) {
        patientListElement.innerHTML = '<div class="alert alert-info">Geen patiënten gevonden. Voeg een nieuwe patiënt toe.</div>';
        return;
    }
    
    patients.forEach((patient, index) => {
        const patientItem = document.createElement('div');
        patientItem.className = 'patient-item';
        patientItem.innerHTML = `
            <div class="patient-info">
                <div class="patient-name">${patient.roepnaam || ''} ${patient.achternaam || ''}</div>
                <div class="patient-details">
                    Geboortedatum: ${patient.geboortedatum || 'Onbekend'} | 
                    Patiëntnummer: ${patient.patientnummer || 'Onbekend'}
                </div>
            </div>
            <div class="patient-actions">
                <button class="btn btn-primary btn-edit" data-index="${index}">Bewerken</button>
                <button class="btn btn-success btn-pdf" data-index="${index}">PDF Genereren</button>
            </div>
        `;
        patientListElement.appendChild(patientItem);
    });
    
    // Event listeners voor knoppen
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = e.target.getAttribute('data-index');
            editPatient(index);
        });
    });
    
    document.querySelectorAll('.btn-pdf').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = e.target.getAttribute('data-index');
            generatePDF(index);
        });
    });
    
    // Event listener voor 'Nieuwe patiënt toevoegen' knop op patiëntenpagina
    const addPatientBtn = document.querySelector('.card-footer .btn[data-target="add-patient"]');
    if (addPatientBtn) {
        addPatientBtn.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo('add-patient');
        });
    }
}

// Nieuwe patiënt toevoegen
function addPatient(event) {
    event.preventDefault();
    
    // Verzamel basisgegevens
    const patientData = {
        // Persoonsgegevens
        roepnaam: document.getElementById('patient-roepnaam').value.trim(),
        geboortedatum: document.getElementById('patient-geboortedatum').value,
        geslacht: document.getElementById('patient-geslacht').value,
        patientnummer: document.getElementById('patient-patientnummer').value.trim(),
        verzekerdennummer: document.getElementById('patient-verzekerdennummer').value.trim(),
        
        // Contactgegevens
        privételefoon: document.getElementById('patient-privetelefoon').value.trim(),
        werktelefoon: document.getElementById('patient-werktelefoon').value.trim(),
        mobiel: document.getElementById('patient-mobiel').value.trim(),
        faxnummer: document.getElementById('patient-faxnummer').value.trim(),
        email: document.getElementById('patient-email').value.trim(),
        
        // Verwijzer/huisarts
        huisarts: document.getElementById('patient-huisarts').value.trim(),
        huisartstelefoon: document.getElementById('patient-huisartstelefoon').value.trim(),
        
        // Behandelepisode
        begindatum: document.getElementById('patient-begindatum').value,
        einddatum: document.getElementById('patient-einddatum').value,
        verslagleggingsrichtlijn: document.getElementById('patient-verslagleggingsrichtlijn').value.trim(),
        
        // Verzekering
        verzekeraar: document.getElementById('patient-verzekeraar').value.trim(),
        zvlsoort: document.getElementById('patient-zvlsoort').value.trim(),
        
        // Lege objecten voor de verschillende fases
        intakeFase: {},
        onderzoeksFase: {},
        diagnoseFase: {},
        meetinstrumenten: {},
        behandelplanFase: {},
        behandelFase: [],
        eindevaluatieFase: {}
    };
    
    // Valideer verplichte velden
    if (!patientData.roepnaam || !patientData.geboortedatum || !patientData.patientnummer) {
        showAlert('Vul alle verplichte velden in.', 'warning', 'add-patient-alerts');
        return;
    }
    
    // Voeg patiënt toe aan array
    patients.push(patientData);
    
    // Sla op in lokale opslag
    savePatients();
    
    // Toon bevestiging
    showAlert('Patiënt succesvol toegevoegd.', 'success', 'add-patient-alerts');
    
    // Navigeer naar patiëntenlijst
    setTimeout(() => {
        navigateTo('patients');
    }, 1500);
}

// Reset patiëntformulier
function resetPatientForm() {
    document.getElementById('add-patient-form').reset();
}

// Bewerk patiënt
function editPatient(index) {
    currentPatient = patients[index];
    
    // Navigeer naar bewerk pagina
    navigateTo('edit-patient');
    
    // Vul formulier met patiëntgegevens
    fillPatientForm();
    
    // Activeer eerste tab
    activateTab('persoonsgegevens-tab');
}

// Vul patiëntformulier met gegevens
function fillPatientForm() {
    if (!currentPatient) return;
    
    // Persoonsgegevens
    document.getElementById('edit-roepnaam').value = currentPatient.roepnaam || '';
    document.getElementById('edit-geboortedatum').value = currentPatient.geboortedatum || '';
    document.getElementById('edit-geslacht').value = currentPatient.geslacht || '';
    document.getElementById('edit-patientnummer').value = currentPatient.patientnummer || '';
    document.getElementById('edit-verzekerdennummer').value = currentPatient.verzekerdennummer || '';
    
    // Contactgegevens
    document.getElementById('edit-privetelefoon').value = currentPatient.privételefoon || '';
    document.getElementById('edit-werktelefoon').value = currentPatient.werktelefoon || '';
    document.getElementById('edit-mobiel').value = currentPatient.mobiel || '';
    document.getElementById('edit-faxnummer').value = currentPatient.faxnummer || '';
    document.getElementById('edit-email').value = currentPatient.email || '';
    
    // Verwijzer/huisarts
    document.getElementById('edit-huisarts').value = currentPatient.huisarts || '';
    document.getElementById('edit-huisartstelefoon').value = currentPatient.huisartstelefoon || '';
    
    // Behandelepisode
    document.getElementById('edit-begindatum').value = currentPatient.begindatum || '';
    document.getElementById('edit-einddatum').value = currentPatient.einddatum || '';
    document.getElementById('edit-verslagleggingsrichtlijn').value = currentPatient.verslagleggingsrichtlijn || '';
    
    // Verzekering
    document.getElementById('edit-verzekeraar').value = currentPatient.verzekeraar || '';
    document.getElementById('edit-zvlsoort').value = currentPatient.zvlsoort || '';
    
    // Vul de andere fases in als ze bestaan
    fillIntakeFase();
    fillOnderzoeksFase();
    fillDiagnoseFase();
    fillMeetinstrumenten();
    fillBehandelplanFase();
    fillBehandelFase();
    fillEindevaluatieFase();
}

// Vul Intake fase
function fillIntakeFase() {
    if (!currentPatient || !currentPatient.intakeFase) return;
    
    const intake = currentPatient.intakeFase;
    
    // Algemeen
    document.getElementById('edit-binnenkomst').value = intake.binnenkomst || '';
    document.getElementById('edit-praktijk-gevonden').value = intake.praktijkGevonden || '';
    document.getElementById('edit-omschrijving-klacht').value = intake.omschrijvingKlacht || '';
    document.getElementById('edit-klacht-categorie').value = intake.klachtCategorie || '';
    
    // Verwijsgegevens
    document.getElementById('edit-dtf').checked = intake.dtf || false;
    
    // Anamnese
    document.getElementById('edit-hulpvraag').value = intake.hulpvraag || '';
    document.getElementById('edit-ontstaanswijze').value = intake.ontstaanswijze || '';
    document.getElementById('edit-beloop').value = intake.beloop || '';
    document.getElementById('edit-duur-klacht').value = intake.duurKlacht || '';
    document.getElementById('edit-aangedane-zijde').value = intake.aangedaneZijde || '';
    document.getElementById('edit-stoornissen').value = intake.stoornissen || '';
    document.getElementById('edit-beperkingen').value = intake.beperkingen || '';
    document.getElementById('edit-participatieproblemen').value = intake.participatieproblemen || '';
    
    // Resultaat screening
    document.getElementById('edit-resultaat-screening').value = intake.resultaatScreening || '';
    document.getElementById('edit-conclusie-screening').value = intake.conclusieScreening || '';
    document.getElementById('edit-indicatie-fysiotherapie').checked = intake.indicatieFysiotherapie || false;
    document.getElementById('edit-toestemming-contact').checked = intake.toestemmingContact || false;
    
    // Aanvullende anamnese
    document.getElementById('edit-herstel-factoren').value = intake.herstelFactoren || '';
    document.getElementById('edit-voorgeschiedenis').value = intake.voorgeschiedenis || '';
    document.getElementById('edit-nevenpathologie').value = intake.nevenpathologie || '';
    document.getElementById('edit-eerdere-aandoeningen').value = intake.eerdereAandoeningen || '';
    document.getElementById('edit-erfelijke-aandoeningen').value = intake.erfelijkeAandoeningen || '';
    document.getElementById('edit-medische-verrichtingen').value = intake.medischeVerrichtingen || '';
    document.getElementById('edit-datum-trauma').value = intake.datumTrauma || '';
    document.getElementById('edit-operatiedatum').value = intake.operatiedatum || '';
    document.getElementById('edit-medicatiegebruik').value = intake.medicatiegebruik || '';
    document.getElementById('edit-recidief').checked = intake.recidief || false;
    
    // Omgevingsfactoren en persoonlijke factoren
    document.getElementById('edit-omgevingsfactoren').value = intake.omgevingsfactoren || '';
    document.getElementById('edit-persoonlijke-factoren').value = intake.persoonlijkeFactoren || '';
    document.getElementById('edit-voorlopige-conclusie').value = intake.voorlopigeHypothese || '';
}

// Vul Onderzoeksfase
function fillOnderzoeksFase() {
    if (!currentPatient || !currentPatient.onderzoeksFase) return;
    
    const onderzoek = currentPatient.onderzoeksFase;
    
    document.getElementById('edit-onderzoek-voorlopige-conclusie').value = onderzoek.voorlopigeHypothese || '';
    document.getElementById('edit-toestemming-onderzoek').checked = onderzoek.toestemmingOnderzoek || false;
    
    // Onderzoek
    document.getElementById('edit-inspectie').value = onderzoek.inspectie || '';
    document.getElementById('edit-palpatie').value = onderzoek.palpatie || '';
    document.getElementById('edit-tests').value = onderzoek.tests || '';
    document.getElementById('edit-overig-onderzoek').value = onderzoek.overig || '';
    document.getElementById('edit-conclusie-onderzoek').value = onderzoek.conclusieOnderzoek || '';
    document.getElementById('edit-behandelbare-grootheden').value = onderzoek.behandelbareGrootheden || '';
}

// Vul Diagnosefase
function fillDiagnoseFase() {
    if (!currentPatient || !currentPatient.diagnoseFase) return;
    
    const diagnose = currentPatient.diagnoseFase;
    
    document.getElementById('edit-fysiotherapeutische-diagnose').value = diagnose.fysiotherapeutischeDiagnose || '';
    document.getElementById('edit-verwijsdiagnosecode').value = diagnose.verwijsdiagnosecode || '';
    document.getElementById('edit-indicatie-fysiotherapie-diagnose').checked = diagnose.indicatieFysiotherapie || false;
    document.getElementById('edit-behandelen-richtlijn').checked = diagnose.behandelenRichtlijn || false;
    document.getElementById('edit-bijzonderheden-diagnose').value = diagnose.bijzonderheden || '';
}

// Vul Meetinstrumenten
function fillMeetinstrumenten() {
    if (!currentPatient || !currentPatient.meetinstrumenten) return;
    
    const meet = currentPatient.meetinstrumenten;
    
    document.getElementById('edit-nrs-pijn').value = meet.nrsPijn || '';
    document.getElementById('edit-vas-pijn').value = meet.vasPijn || '';
    document.getElementById('edit-psk10').value = meet.psk10 || '';
    document.getElementById('edit-algofunctional').value = meet.algofunctional || '';
}

// Vul Behandelplanfase
function fillBehandelplanFase() {
    if (!currentPatient || !currentPatient.behandelplanFase) return;
    
    const plan = currentPatient.behandelplanFase;
    
    document.getElementById('edit-plan-hulpvraag').value = plan.hulpvraag || '';
    document.getElementById('edit-verwachtingen').value = plan.verwachtingen || '';
    document.getElementById('edit-verwacht-herstel').value = plan.verwachtHerstel || '';
    document.getElementById('edit-hoofddoel').value = plan.hoofddoel || '';
    
    document.getElementById('edit-toestemming-behandelplan').checked = plan.toestemmingBehandelplan || false;
    document.getElementById('edit-toestemming-behandeling').checked = plan.toestemmingBehandeling || false;
    document.getElementById('edit-behandelplantabel').value = plan.behandelplantabel || '';
    document.getElementById('edit-toelichting-plan').value = plan.toelichting || '';
}

// Vul Behandelfase
function fillBehandelFase() {
    if (!currentPatient || !currentPatient.behandelFase || !currentPatient.behandelFase.length) return;
    
    // Toon bestaande behandelsessies
    const behandelContainer = document.getElementById('behandelsessies-container');
    behandelContainer.innerHTML = '';
    
    currentPatient.behandelFase.forEach((sessie, index) => {
        const sessieElement = document.createElement('div');
        sessieElement.className = 'card mb-3';
        sessieElement.innerHTML = `
            <div class="card-header">
                Behandelsessie ${index + 1}
            </div>
            <div class="card-body">
                <div class="form-group">
                    <label class="form-label">Datum</label>
                    <input type="date" class="form-control" value="${sessie.datum || ''}" readonly>
                </div>
                <div class="form-group">
                    <label class="form-label">Subjectief</label>
                    <textarea class="form-control" readonly>${sessie.subjectief || ''}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Objectief</label>
                    <textarea class="form-control" readonly>${sessie.objectief || ''}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Analyse</label>
                    <textarea class="form-control" readonly>${sessie.analyse || ''}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Plan</label>
                    <textarea class="form-control" readonly>${sessie.plan || ''}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Afspraken</label>
                    <textarea class="form-control" readonly>${sessie.afspraken || ''}</textarea>
                </div>
            </div>
        `;
        behandelContainer.appendChild(sessieElement);
    });
}

// Vul Eindevaluatiefase
function fillEindevaluatieFase() {
    if (!currentPatient || !currentPatient.eindevaluatieFase) return;
    
    const evaluatie = currentPatient.eindevaluatieFase;
    
    document.getElementById('edit-evaluatie-hoofddoel').value = evaluatie.hoofddoel || '';
    document.getElementById('edit-evaluatie-behandelplantabel').value = evaluatie.behandelplantabel || '';
    
    document.getElementById('edit-patient-aanwezigheid').checked = evaluatie.patientAanwezigheid || false;
    document.getElementById('edit-eindmeting').value = evaluatie.eindmeting || '';
    document.getElementById('edit-resultaat').value = evaluatie.resultaat || '';
    document.getElementById('edit-afwijkingen').value = evaluatie.afwijkingen || '';
    document.getElementById('edit-oordeel').value = evaluatie.oordeel || '';
    
    document.getElementById('edit-aanbeveling-huisarts').value = evaluatie.aanbevelingHuisarts || '';
    document.getElementById('edit-doorverwezen').value = evaluatie.doorverwezen || '';
    document.getElementById('edit-reden-einde').value = evaluatie.redenEinde || '';
    document.getElementById('edit-nazorg').value = evaluatie.nazorg || '';
    document.getElementById('edit-einddatum-evaluatie').value = evaluatie.einddatum || '';
    document.getElementById('edit-bijzonderheden-evaluatie').value = evaluatie.bijzonderheden || '';
}

// Activeer tab
function activateTab(tabId) {
    // Verberg alle tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Deactiveer alle tabs
    document.querySelectorAll('.tab-item').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Activeer geselecteerde tab en content
    document.getElementById(tabId).classList.add('active');
    const contentId = tabId.replace('-tab', '-content');
    document.getElementById(contentId).classList.add('active');
}

// Update patiëntgegevens
function updatePatient(event) {
    event.preventDefault();
    
    if (!currentPatient) return;
    
    // Update persoonsgegevens
    currentPatient.roepnaam = document.getElementById('edit-roepnaam').value.trim();
    currentPatient.geboortedatum = document.getElementById('edit-geboortedatum').value;
    currentPatient.geslacht = document.getElementById('edit-geslacht').value;
    currentPatient.patientnummer = document.getElementById('edit-patientnummer').value.trim();
    currentPatient.verzekerdennummer = document.getElementById('edit-verzekerdennummer').value.trim();
    
    // Contactgegevens
    currentPatient.privételefoon = document.getElementById('edit-privetelefoon').value.trim();
    currentPatient.werktelefoon = document.getElementById('edit-werktelefoon').value.trim();
    currentPatient.mobiel = document.getElementById('edit-mobiel').value.trim();
    currentPatient.faxnummer = document.getElementById('edit-faxnummer').value.trim();
    currentPatient.email = document.getElementById('edit-email').value.trim();
    
    // Verwijzer/huisarts
    currentPatient.huisarts = document.getElementById('edit-huisarts').value.trim();
    currentPatient.huisartstelefoon = document.getElementById('edit-huisartstelefoon').value.trim();
    
    // Behandelepisode
    currentPatient.begindatum = document.getElementById('edit-begindatum').value;
    currentPatient.einddatum = document.getElementById('edit-einddatum').value;
    currentPatient.verslagleggingsrichtlijn = document.getElementById('edit-verslagleggingsrichtlijn').value.trim();
    
    // Verzekering
    currentPatient.verzekeraar = document.getElementById('edit-verzekeraar').value.trim();
    currentPatient.zvlsoort = document.getElementById('edit-zvlsoort').value.trim();
    
    // Sla op in lokale opslag
    savePatients();
    
    // Toon bevestiging
    showAlert('Patiëntgegevens succesvol bijgewerkt.', 'success', 'edit-patient-alerts');
}

// Update Intake fase
function updateIntakeFase(event) {
    event.preventDefault();
    
    if (!currentPatient) return;
    
    // Maak object aan als het nog niet bestaat
    if (!currentPatient.intakeFase) {
        currentPatient.intakeFase = {};
    }
    
    const intake = currentPatient.intakeFase;
    
    // Algemeen
    intake.binnenkomst = document.getElementById('edit-binnenkomst').value.trim();
    intake.praktijkGevonden = document.getElementById('edit-praktijk-gevonden').value.trim();
    intake.omschrijvingKlacht = document.getElementById('edit-omschrijving-klacht').value.trim();
    intake.klachtCategorie = document.getElementById('edit-klacht-categorie').value.trim();
    
    // Verwijsgegevens
    intake.dtf = document.getElementById('edit-dtf').checked;
    
    // Anamnese
    intake.hulpvraag = document.getElementById('edit-hulpvraag').value.trim();
    intake.ontstaanswijze = document.getElementById('edit-ontstaanswijze').value.trim();
    intake.beloop = document.getElementById('edit-beloop').value.trim();
    intake.duurKlacht = document.getElementById('edit-duur-klacht').value.trim();
    intake.aangedaneZijde = document.getElementById('edit-aangedane-zijde').value.trim();
    intake.stoornissen = document.getElementById('edit-stoornissen').value.trim();
    intake.beperkingen = document.getElementById('edit-beperkingen').value.trim();
    intake.participatieproblemen = document.getElementById('edit-participatieproblemen').value.trim();
    
    // Resultaat screening
    intake.resultaatScreening = document.getElementById('edit-resultaat-screening').value.trim();
    intake.conclusieScreening = document.getElementById('edit-conclusie-screening').value.trim();
    intake.indicatieFysiotherapie = document.getElementById('edit-indicatie-fysiotherapie').checked;
    intake.toestemmingContact = document.getElementById('edit-toestemming-contact').checked;
    
    // Aanvullende anamnese
    intake.herstelFactoren = document.getElementById('edit-herstel-factoren').value.trim();
    intake.voorgeschiedenis = document.getElementById('edit-voorgeschiedenis').value.trim();
    intake.nevenpathologie = document.getElementById('edit-nevenpathologie').value.trim();
    intake.eerdereAandoeningen = document.getElementById('edit-eerdere-aandoeningen').value.trim();
    intake.erfelijkeAandoeningen = document.getElementById('edit-erfelijke-aandoeningen').value.trim();
    intake.medischeVerrichtingen = document.getElementById('edit-medische-verrichtingen').value.trim();
    intake.datumTrauma = document.getElementById('edit-datum-trauma').value;
    intake.operatiedatum = document.getElementById('edit-operatiedatum').value;
    intake.medicatiegebruik = document.getElementById('edit-medicatiegebruik').value.trim();
    intake.recidief = document.getElementById('edit-recidief').checked;
    
    // Omgevingsfactoren en persoonlijke factoren
    intake.omgevingsfactoren = document.getElementById('edit-omgevingsfactoren').value.trim();
    intake.persoonlijkeFactoren = document.getElementById('edit-persoonlijke-factoren').value.trim();
    intake.voorlopigeHypothese = document.getElementById('edit-voorlopige-conclusie').value.trim();
    
    // Sla op in lokale opslag
    savePatients();
    
    // Toon bevestiging
    showAlert('Intake fase succesvol bijgewerkt.', 'success', 'edit-patient-alerts');
}

// Update Onderzoeksfase
function updateOnderzoeksFase(event) {
    event.preventDefault();
    
    if (!currentPatient) return;
    
    // Maak object aan als het nog niet bestaat
    if (!currentPatient.onderzoeksFase) {
        currentPatient.onderzoeksFase = {};
    }
    
    const onderzoek = currentPatient.onderzoeksFase;
    
    onderzoek.voorlopigeHypothese = document.getElementById('edit-onderzoek-voorlopige-conclusie').value.trim();
    onderzoek.toestemmingOnderzoek = document.getElementById('edit-toestemming-onderzoek').checked;
    
    // Onderzoek
    onderzoek.inspectie = document.getElementById('edit-inspectie').value.trim();
    onderzoek.palpatie = document.getElementById('edit-palpatie').value.trim();
    onderzoek.tests = document.getElementById('edit-tests').value.trim();
    onderzoek.overig = document.getElementById('edit-overig-onderzoek').value.trim();
    onderzoek.conclusieOnderzoek = document.getElementById('edit-conclusie-onderzoek').value.trim();
    onderzoek.behandelbareGrootheden = document.getElementById('edit-behandelbare-grootheden').value.trim();
    
    // Sla op in lokale opslag
    savePatients();
    
    // Toon bevestiging
    showAlert('Onderzoeksfase succesvol bijgewerkt.', 'success', 'edit-patient-alerts');
}

// Update Diagnosefase
function updateDiagnoseFase(event) {
    event.preventDefault();
    
    if (!currentPatient) return;
    
    // Maak object aan als het nog niet bestaat
    if (!currentPatient.diagnoseFase) {
        currentPatient.diagnoseFase = {};
    }
    
    const diagnose = currentPatient.diagnoseFase;
    
    diagnose.fysiotherapeutischeDiagnose = document.getElementById('edit-fysiotherapeutische-diagnose').value.trim();
    diagnose.verwijsdiagnosecode = document.getElementById('edit-verwijsdiagnosecode').value.trim();
    diagnose.indicatieFysiotherapie = document.getElementById('edit-indicatie-fysiotherapie-diagnose').checked;
    diagnose.behandelenRichtlijn = document.getElementById('edit-behandelen-richtlijn').checked;
    diagnose.bijzonderheden = document.getElementById('edit-bijzonderheden-diagnose').value.trim();
    
    // Sla op in lokale opslag
    savePatients();
    
    // Toon bevestiging
    showAlert('Diagnosefase succesvol bijgewerkt.', 'success', 'edit-patient-alerts');
}

// Update Meetinstrumenten
function updateMeetinstrumenten(event) {
    event.preventDefault();
    
    if (!currentPatient) return;
    
    // Maak object aan als het nog niet bestaat
    if (!currentPatient.meetinstrumenten) {
        currentPatient.meetinstrumenten = {};
    }
    
    const meet = currentPatient.meetinstrumenten;
    
    meet.nrsPijn = document.getElementById('edit-nrs-pijn').value.trim();
    meet.vasPijn = document.getElementById('edit-vas-pijn').value.trim();
    meet.psk10 = document.getElementById('edit-psk10').value.trim();
    meet.algofunctional = document.getElementById('edit-algofunctional').value.trim();
    
    // Sla op in lokale opslag
    savePatients();
    
    // Toon bevestiging
    showAlert('Meetinstrumenten succesvol bijgewerkt.', 'success', 'edit-patient-alerts');
}

// Update Behandelplanfase
function updateBehandelplanFase(event) {
    event.preventDefault();
    
    if (!currentPatient) return;
    
    // Maak object aan als het nog niet bestaat
    if (!currentPatient.behandelplanFase) {
        currentPatient.behandelplanFase = {};
    }
    
    const plan = currentPatient.behandelplanFase;
    
    plan.hulpvraag = document.getElementById('edit-plan-hulpvraag').value.trim();
    plan.verwachtingen = document.getElementById('edit-verwachtingen').value.trim();
    plan.verwachtHerstel = document.getElementById('edit-verwacht-herstel').value.trim();
    plan.hoofddoel = document.getElementById('edit-hoofddoel').value.trim();
    
    plan.toestemmingBehandelplan = document.getElementById('edit-toestemming-behandelplan').checked;
    plan.toestemmingBehandeling = document.getElementById('edit-toestemming-behandeling').checked;
    plan.behandelplantabel = document.getElementById('edit-behandelplantabel').value.trim();
    plan.toelichting = document.getElementById('edit-toelichting-plan').value.trim();
    
    // Sla op in lokale opslag
    savePatients();
    
    // Toon bevestiging
    showAlert('Behandelplanfase succesvol bijgewerkt.', 'success', 'edit-patient-alerts');
}

// Voeg behandelsessie toe
function addBehandelsessie(event) {
    event.preventDefault();
    
    if (!currentPatient) return;
    
    // Maak array aan als het nog niet bestaat
    if (!currentPatient.behandelFase) {
        currentPatient.behandelFase = [];
    }
    
    // Verzamel sessiegegevens
    const sessie = {
        datum: document.getElementById('edit-behandel-datum').value,
        subjectief: document.getElementById('edit-subjectief').value.trim(),
        objectief: document.getElementById('edit-objectief').value.trim(),
        analyse: document.getElementById('edit-analyse').value.trim(),
        plan: document.getElementById('edit-plan').value.trim(),
        afspraken: document.getElementById('edit-afspraken').value.trim()
    };
    
    // Valideer verplichte velden
    if (!sessie.datum) {
        showAlert('Vul een datum in voor de behandelsessie.', 'warning', 'edit-patient-alerts');
        return;
    }
    
    // Voeg sessie toe aan array
    currentPatient.behandelFase.push(sessie);
    
    // Sla op in lokale opslag
    savePatients();
    
    // Reset formulier
    document.getElementById('behandelsessie-form').reset();
    
    // Toon bevestiging
    showAlert('Behandelsessie succesvol toegevoegd.', 'success', 'edit-patient-alerts');
    
    // Werk behandelsessies lijst bij
    fillBehandelFase();
}

// Update Eindevaluatiefase
function updateEindevaluatieFase(event) {
    event.preventDefault();
    
    if (!currentPatient) return;
    
    // Maak object aan als het nog niet bestaat
    if (!currentPatient.eindevaluatieFase) {
        currentPatient.eindevaluatieFase = {};
    }
    
    const evaluatie = currentPatient.eindevaluatieFase;
    
    evaluatie.hoofddoel = document.getElementById('edit-evaluatie-hoofddoel').value.trim();
    evaluatie.behandelplantabel = document.getElementById('edit-evaluatie-behandelplantabel').value.trim();
    
    evaluatie.patientAanwezigheid = document.getElementById('edit-patient-aanwezigheid').checked;
    evaluatie.eindmeting = document.getElementById('edit-eindmeting').value.trim();
    evaluatie.resultaat = document.getElementById('edit-resultaat').value.trim();
    evaluatie.afwijkingen = document.getElementById('edit-afwijkingen').value.trim();
    evaluatie.oordeel = document.getElementById('edit-oordeel').value.trim();
    
    evaluatie.aanbevelingHuisarts = document.getElementById('edit-aanbeveling-huisarts').value.trim();
    evaluatie.doorverwezen = document.getElementById('edit-doorverwezen').value.trim();
    evaluatie.redenEinde = document.getElementById('edit-reden-einde').value.trim();
    evaluatie.nazorg = document.getElementById('edit-nazorg').value.trim();
    evaluatie.einddatum = document.getElementById('edit-einddatum-evaluatie').value;
    evaluatie.bijzonderheden = document.getElementById('edit-bijzonderheden-evaluatie').value.trim();
    
    // Sla op in lokale opslag
    savePatients();
    
    // Toon bevestiging
    showAlert('Eindevaluatiefase succesvol bijgewerkt.', 'success', 'edit-patient-alerts');
}

// Genereer PDF
function generatePDF(index) {
    const patient = patients[index];
    if (!patient) return;
    
    try {
        // Gebruik de globaal beschikbare jsPDF
        const { jsPDF } = window.jspdf;
        
        // Maak een nieuw PDF document
        const doc = new jsPDF();
        
        // Voeg header toe
        doc.setFontSize(18);
        doc.setTextColor(230, 0, 126); // HAN magenta
        doc.text('Patiëntendossier Fysiotherapie', 105, 20, { align: 'center' });
        
        // Voeg therapeut info toe
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`Therapeut: ${currentUser.fullName}`, 14, 30);
        doc.text(`COP: ${currentUser.cop}`, 14, 37);
        doc.text(`Datum: ${new Date().toLocaleDateString('nl-NL')}`, 14, 44);
        
        // Functie om veld toe te voegen met achtergrondkleur voor ingevulde velden
        function addField(label, value, x, y, maxWidth) {
            // Teken achtergrond als het veld is ingevuld
            if (value && value !== '') {
                doc.setFillColor(240, 248, 255); // Lichtblauwe achtergrond voor ingevulde velden
                doc.rect(x - 2, y - 4, maxWidth, 6, 'F');
            }
            doc.text(`${label}: ${value || ''}`, x, y);
            return y + 6; // Retourneer nieuwe y-positie
        }
        
        // Functie om sectieheader toe te voegen
        function addSectionHeader(text, x, y) {
            doc.setFontSize(14);
            doc.setTextColor(230, 0, 126);
            doc.text(text, x, y);
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            return y + 7;
        }
        
        // Functie om subsectieheader toe te voegen
        function addSubSectionHeader(text, x, y) {
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.text(text, x, y);
            doc.setFontSize(10);
            return y + 6;
        }
        
        // Functie om te controleren of we een nieuwe pagina nodig hebben
        function checkPageBreak(y, threshold = 270) {
            if (y > threshold) {
                doc.addPage();
                return 20;
            }
            return y;
        }
        
        // Voeg patiëntgegevens toe
        let yPos = addSectionHeader('Patiëntgegevens', 14, 55);
        
        // Persoonsgegevens
        yPos = addField('Roepnaam', patient.roepnaam, 14, yPos, 80);
        yPos = addField('Geboortedatum', patient.geboortedatum, 14, yPos, 80);
        yPos = addField('Geslacht', patient.geslacht, 14, yPos, 80);
        yPos = addField('Patiëntnummer', patient.patientnummer, 14, yPos, 80);
        yPos = addField('Verzekerdennummer', patient.verzekerdennummer, 14, yPos, 80);
        
        // Contactgegevens
        let rightColY = 55 + 7; // Start op dezelfde hoogte als de linkerkolom na de header
        rightColY = addField('Privételefoon', patient.privételefoon, 120, rightColY, 80);
        rightColY = addField('Werktelefoon', patient.werktelefoon, 120, rightColY, 80);
        rightColY = addField('Mobiel', patient.mobiel, 120, rightColY, 80);
        rightColY = addField('Faxnummer', patient.faxnummer, 120, rightColY, 80);
        rightColY = addField('E-mail', patient.email, 120, rightColY, 80);
        
        // Huisarts info
        rightColY = addField('Huisarts', patient.huisarts, 120, rightColY, 80);
        rightColY = addField('Huisarts telefoon', patient.huisartstelefoon, 120, rightColY, 80);
        
        // Gebruik de hoogste y-waarde voor de volgende sectie
        yPos = Math.max(yPos, rightColY) + 5;
        
        // Voeg behandelepisode toe
        yPos = addSectionHeader('Behandelepisode', 14, yPos);
        
        yPos = addField('Begindatum', patient.begindatum, 14, yPos, 80);
        yPos = addField('Einddatum', patient.einddatum, 14, yPos, 80);
        yPos = addField('Verslagleggingsrichtlijn', patient.verslagleggingsrichtlijn, 14, yPos, 80);
        
        // Verzekeringsinformatie
        rightColY = yPos - 18; // Start op dezelfde hoogte als de behandelepisode
        rightColY = addField('Verzekeraar', patient.verzekeraar, 120, rightColY, 80);
        rightColY = addField('ZVL-soort', patient.zvlsoort, 120, rightColY, 80);
        
        // Gebruik de hoogste y-waarde voor de volgende sectie
        yPos = Math.max(yPos, rightColY) + 10;
        
        // Voeg intakefase toe
        yPos = addSectionHeader('1. Intake fase', 14, yPos);
        
        // Algemeen
        yPos = addSubSectionHeader('Algemeen', 14, yPos);
        
        // Controleer of intakeFase bestaat, zo niet maak een leeg object
        const intake = patient.intakeFase || {};
        
        yPos = addField('Binnenkomst', intake.binnenkomst, 14, yPos, 180);
        yPos = addField('Praktijk gevonden via', intake.praktijkGevonden, 14, yPos, 180);
        yPos = addField('Omschrijving klacht', intake.omschrijvingKlacht, 14, yPos, 180);
        yPos = addField('Klacht categorie', intake.klachtCategorie, 14, yPos, 180);
        
        // Verwijsgegevens
        yPos = checkPageBreak(yPos);
        yPos = addSubSectionHeader('Verwijsgegevens', 14, yPos);
        yPos = addField('Directe Toegankelijkheid Fysiotherapie', intake.dtf ? 'Ja' : 'Nee', 14, yPos, 180);
        
        // Anamnese
        yPos = checkPageBreak(yPos);
        yPos = addSubSectionHeader('Anamnese', 14, yPos);
        yPos = addField('Hulpvraag/contactreden', intake.hulpvraag, 14, yPos, 180);
        yPos = addField('Ontstaanswijze/historie', intake.ontstaanswijze, 14, yPos, 180);
        yPos = addField('Beloop', intake.beloop, 14, yPos, 180);
        yPos = addField('Duur klacht', intake.duurKlacht, 14, yPos, 180);
        yPos = addField('Aangedane zijde', intake.aangedaneZijde, 14, yPos, 180);
        yPos = addField('Stoornissen in functie', intake.stoornissen, 14, yPos, 180);
        yPos = addField('Beperkingen in activiteiten', intake.beperkingen, 14, yPos, 180);
        yPos = addField('Participatieproblemen', intake.participatieproblemen, 14, yPos, 180);
        
        // Resultaat screening
        yPos = checkPageBreak(yPos);
        yPos = addSubSectionHeader('Resultaat screening', 14, yPos);
        yPos = addField('Resultaat screening (vlaggen)', intake.resultaatScreening, 14, yPos, 180);
        yPos = addField('Conclusie screening', intake.conclusieScreening, 14, yPos, 180);
        yPos = addField('Indicatie verder fysiotherapeutisch handelen', intake.indicatieFysiotherapie ? 'Ja' : 'Nee', 14, yPos, 180);
        yPos = addField('Toestemming patiënt voor contact/verstrekken/opvragen gegevens', intake.toestemmingContact ? 'Ja' : 'Nee', 14, yPos, 180);
        
        // Aanvullende anamnese
        yPos = checkPageBreak(yPos);
        yPos = addSubSectionHeader('Aanvullende anamnese', 14, yPos);
        yPos = addField('Herstel beïnvloedende factoren', intake.herstelFactoren, 14, yPos, 180);
        yPos = addField('(Medische) voorgeschiedenis', intake.voorgeschiedenis, 14, yPos, 180);
        yPos = addField('Nevenpathologie', intake.nevenpathologie, 14, yPos, 180);
        yPos = addField('Eerdere aandoeningen', intake.eerdereAandoeningen, 14, yPos, 180);
        yPos = addField('Erfelijke aandoeningen', intake.erfelijkeAandoeningen, 14, yPos, 180);
        yPos = addField('Medische verrichtingen', intake.medischeVerrichtingen, 14, yPos, 180);
        yPos = addField('Datum trauma', intake.datumTrauma, 14, yPos, 180);
        yPos = addField('Operatiedatum', intake.operatiedatum, 14, yPos, 180);
        yPos = addField('Medicatiegebruik', intake.medicatiegebruik, 14, yPos, 180);
        yPos = addField('Recidief', intake.recidief ? 'Ja' : 'Nee', 14, yPos, 180);
        
        // Omgevingsfactoren en persoonlijke factoren
        yPos = checkPageBreak(yPos);
        yPos = addSubSectionHeader('Omgevingsfactoren en persoonlijke factoren', 14, yPos);
        yPos = addField('Omgevingsfactoren', intake.omgevingsfactoren, 14, yPos, 180);
        yPos = addField('Persoonlijke factoren', intake.persoonlijkeFactoren, 14, yPos, 180);
        yPos = addField('Voorlopige conclusie/hypothese(n)', intake.voorlopigeHypothese, 14, yPos, 180);
        
        // Voeg nieuwe pagina toe voor onderzoeksfase
        doc.addPage();
        yPos = 20;
        
        // Onderzoeksfase
        yPos = addSectionHeader('2. Onderzoeksfase', 14, yPos);
        
        // Controleer of onderzoeksFase bestaat, zo niet maak een leeg object
        const onderzoek = patient.onderzoeksFase || {};
        
        yPos = addField('Voorlopige conclusie/hypothese(n)', onderzoek.voorlopigeHypothese, 14, yPos, 180);
        yPos = addField('Toestemming voor bijzondere of voorbehouden handeling (onderzoek)', onderzoek.toestemmingOnderzoek ? 'Ja' : 'Nee', 14, yPos, 180);
        
        // Onderzoek
        yPos = checkPageBreak(yPos);
        yPos = addSubSectionHeader('Onderzoek', 14, yPos);
        yPos = addField('Inspectie/observatie', onderzoek.inspectie, 14, yPos, 180);
        yPos = addField('Palpatie, percussie, auscultatie', onderzoek.palpatie, 14, yPos, 180);
        yPos = addField('Uitvoering tests en metingen', onderzoek.tests, 14, yPos, 180);
        yPos = addField('Overig', onderzoek.overig, 14, yPos, 180);
        yPos = addField('Conclusie onderzoek', onderzoek.conclusieOnderzoek, 14, yPos, 180);
        yPos = addField('Behandelbare grootheden', onderzoek.behandelbareGrootheden, 14, yPos, 180);
        
        // Diagnosefase
        yPos = checkPageBreak(yPos, 240);
        yPos = addSectionHeader('3. Diagnosefase', 14, yPos);
        
        // Controleer of diagnoseFase bestaat, zo niet maak een leeg object
        const diagnose = patient.diagnoseFase || {};
        
        yPos = addField('Fysiotherapeutische diagnose', diagnose.fysiotherapeutischeDiagnose, 14, yPos, 180);
        yPos = addField('(Verwijs)diagnosecode', diagnose.verwijsdiagnosecode, 14, yPos, 180);
        yPos = addField('Indicatie voor fysiotherapie', diagnose.indicatieFysiotherapie ? 'Ja' : 'Nee', 14, yPos, 180);
        yPos = addField('Behandelen conform richtlijn', diagnose.behandelenRichtlijn ? 'Ja' : 'Nee', 14, yPos, 180);
        yPos = addField('Bijzonderheden', diagnose.bijzonderheden, 14, yPos, 180);
        
        // Meetinstrumenten
        yPos = checkPageBreak(yPos, 240);
        yPos = addSectionHeader('4. Meetinstrumenten', 14, yPos);
        
        // Controleer of meetinstrumenten bestaat, zo niet maak een leeg object
        const meet = patient.meetinstrumenten || {};
        
        yPos = addField('NRS Pijn (NPRS) - score 0-10', meet.nrsPijn, 14, yPos, 180);
        yPos = addField('VAS Pijn/stijfheid', meet.vasPijn, 14, yPos, 180);
        yPos = addField('Patiënt Specifieke Klachten (PSK10)', meet.psk10, 14, yPos, 180);
        yPos = addField('Algofunctional Index Artrose - Knie', meet.algofunctional, 14, yPos, 180);
        
        // Behandelplanfase
        doc.addPage();
        yPos = 20;
        yPos = addSectionHeader('5. Behandelplanfase', 14, yPos);
        
        // Controleer of behandelplanFase bestaat, zo niet maak een leeg object
        const plan = patient.behandelplanFase || {};
        
        yPos = addSubSectionHeader('Doelen en verrichtingen', 14, yPos);
        yPos = addField('Hulpvraag/contactreden', plan.hulpvraag, 14, yPos, 180);
        yPos = addField('Verwachtingen', plan.verwachtingen, 14, yPos, 180);
        yPos = addField('Verwacht herstel in tijd', plan.verwachtHerstel, 14, yPos, 180);
        yPos = addField('Hoofddoel', plan.hoofddoel, 14, yPos, 180);
        
        yPos = checkPageBreak(yPos);
        yPos = addField('Toestemming patiënt (akkoord met behandelplan)', plan.toestemmingBehandelplan ? 'Ja' : 'Nee', 14, yPos, 180);
        yPos = addField('Toestemming bijzondere of voorbehouden handeling (behandelingen)', plan.toestemmingBehandeling ? 'Ja' : 'Nee', 14, yPos, 180);
        yPos = addField('Behandelplantabel met subdoelen', plan.behandelplantabel, 14, yPos, 180);
        yPos = addField('Toelichting', plan.toelichting, 14, yPos, 180);
        
        // Behandelfase
        doc.addPage();
        yPos = 20;
        yPos = addSectionHeader('6. Behandelfase', 14, yPos);
        
        // Controleer of behandelFase bestaat, zo niet maak een leeg array
        const behandelFase = patient.behandelFase || [];
        
        if (behandelFase.length === 0) {
            yPos = addField('Geen behandelsessies geregistreerd', '', 14, yPos, 180);
        } else {
            // Loop door alle behandelsessies
            behandelFase.forEach((sessie, i) => {
                yPos = checkPageBreak(yPos, 240);
                
                yPos = addSubSectionHeader(`Behandelsessie ${i + 1} - ${sessie.datum || ''}`, 14, yPos);
                
                yPos = addField('S (Subjectief/bevindingen patiënt)', sessie.subjectief, 14, yPos, 180);
                yPos = addField('O (Objectief/bevindingen therapeut)', sessie.objectief, 14, yPos, 180);
                yPos = addField('A (Analyse/conclusie bevindingen)', sessie.analyse, 14, yPos, 180);
                yPos = addField('P (Plan van aanpak/uitgevoerde behandeling)', sessie.plan, 14, yPos, 180);
                yPos = addField('Afspraken met patiënt', sessie.afspraken, 14, yPos, 180);
                
                yPos += 5; // Extra ruimte tussen sessies
            });
        }
        
        // Eindevaluatiefase
        doc.addPage();
        yPos = 20;
        yPos = addSectionHeader('7. Eindevaluatiefase', 14, yPos);
        
        // Controleer of eindevaluatieFase bestaat, zo niet maak een leeg object
        const evaluatie = patient.eindevaluatieFase || {};
        
        yPos = addSubSectionHeader('Doelen en verrichtingen', 14, yPos);
        yPos = addField('Hoofddoel', evaluatie.hoofddoel, 14, yPos, 180);
        yPos = addField('Behandelplantabel', evaluatie.behandelplantabel, 14, yPos, 180);
        
        yPos = checkPageBreak(yPos);
        yPos = addField('Patiënt aanwezigheid', evaluatie.patientAanwezigheid ? 'Ja' : 'Nee', 14, yPos, 180);
        yPos = addField('Eindmeting', evaluatie.eindmeting, 14, yPos, 180);
        yPos = addField('Resultaat', evaluatie.resultaat, 14, yPos, 180);
        yPos = addField('Afwijkingen verwacht behandelbeloop', evaluatie.afwijkingen, 14, yPos, 180);
        yPos = addField('Oordeel over behandelbeloop', evaluatie.oordeel, 14, yPos, 180);
        
        yPos = checkPageBreak(yPos);
        yPos = addSubSectionHeader('Afsluiting', 14, yPos);
        yPos = addField('Aanbeveling vervolg huisarts', evaluatie.aanbevelingHuisarts, 14, yPos, 180);
        yPos = addField('Doorverwezen naar', evaluatie.doorverwezen, 14, yPos, 180);
        yPos = addField('Reden einde zorg', evaluatie.redenEinde, 14, yPos, 180);
        yPos = addField('Gegevens nazorg/afspraken met patiënt', evaluatie.nazorg, 14, yPos, 180);
        yPos = addField('Einddatum behandelepisode', evaluatie.einddatum, 14, yPos, 180);
        yPos = addField('Bijzonderheden', evaluatie.bijzonderheden, 14, yPos, 180);
        
        // Sla het PDF-document op
        doc.save(`Patientendossier_${patient.roepnaam || 'Patient'}_${patient.patientnummer || ''}.pdf`);
        
        showAlert('PDF succesvol gegenereerd en gedownload.', 'success', 'patient-list-alerts');
    } catch (error) {
        console.error('Error generating PDF:', error);
        showAlert('Er is een fout opgetreden bij het genereren van de PDF.', 'danger', 'patient-list-alerts');
    }
}

// Toon alert bericht
function showAlert(message, type, containerId) {
    const alertContainer = document.getElementById(containerId);
    if (!alertContainer) return;
    
    const alertElement = document.createElement('div');
    alertElement.className = `alert alert-${type}`;
    alertElement.textContent = message;
    
    // Verwijder bestaande alerts
    alertContainer.innerHTML = '';
    alertContainer.appendChild(alertElement);
    
    // Verwijder alert na 5 seconden
    setTimeout(() => {
        alertElement.remove();
    }, 5000);
}
