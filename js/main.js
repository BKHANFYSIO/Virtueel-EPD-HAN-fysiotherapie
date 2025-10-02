// Globale variabelen
let currentUser = null;
let patients = [];
let currentPatient = null;
let currentEpisodeIndex = 0; // actieve behandelepisode binnen huidig dossier

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

    // Kopieer wachtwoord knop (indien aanwezig op loginpagina)
    const copyPasswordBtn = document.getElementById('copy-password-btn');
    if (copyPasswordBtn) {
        copyPasswordBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText('HANfysiotherapie');
                showAlert('Wachtwoord gekopieerd naar klembord.', 'success', 'login-alerts');
                const passwordInput = document.getElementById('login-password');
                if (passwordInput) {
                    passwordInput.value = 'HANfysiotherapie';
                    passwordInput.focus();
                }
            } catch (err) {
                // Fallback wanneer Clipboard API niet beschikbaar is
                const tempInput = document.createElement('input');
                tempInput.value = 'HANfysiotherapie';
                document.body.appendChild(tempInput);
                tempInput.select();
                try {
                    document.execCommand('copy');
                    showAlert('Wachtwoord gekopieerd naar klembord.', 'success', 'login-alerts');
                } catch (e) {
                    showAlert('Kopiëren mislukt. Kopieer handmatig: HANfysiotherapie', 'warning', 'login-alerts');
                }
                tempInput.remove();
                // Plak ook in het veld als fallback
                const passwordInput = document.getElementById('login-password');
                if (passwordInput) {
                    passwordInput.value = 'HANfysiotherapie';
                    passwordInput.focus();
                }
            }
        });
    }

    // Backup: downloaden
    const backupDownloadBtn = document.getElementById('backup-download-btn');
    if (backupDownloadBtn) {
        backupDownloadBtn.addEventListener('click', () => {
            try {
                const backup = createPatientsBackup();
                const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                const ts = new Date();
                const pad = (n) => String(n).padStart(2, '0');
                const fileName = `EPD-backup_${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}.json`;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                showAlert('Backup succesvol aangemaakt en gedownload.', 'success', 'patient-list-alerts');
            } catch (e) {
                console.error(e);
                showAlert('Aanmaken van backup is mislukt.', 'danger', 'patient-list-alerts');
            }
        });
    }

    // Backup: terugzetten
    const backupUploadInput = document.getElementById('backup-upload-input');
    if (backupUploadInput) {
        backupUploadInput.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                const json = JSON.parse(text);
                const validation = validateBackup(json);
                if (!validation.valid) {
                    showAlert(validation.message || 'Ongeldige backup.', 'danger', 'patient-list-alerts');
                    return;
                }

                // Kies modus: merge (standaard) of replace-all met bevestiging
                let mode = 'merge';
                const replaceAll = confirm('Wil je ALLES vervangen door de backup? Klik op Annuleren voor samenvoegen.');
                if (replaceAll) mode = 'replace';

                restorePatientsFromBackup(json, mode);
                renderPatientList();
                showAlert(mode === 'replace' ? 'Backup teruggezet (alles vervangen).' : 'Backup samengevoegd met bestaande gegevens.', 'success', 'patient-list-alerts');
                // Reset input zodat je opnieuw kunt kiezen
                e.target.value = '';
            } catch (err) {
                console.error(err);
                showAlert('Terugzetten van backup is mislukt. Controleer het bestand.', 'danger', 'patient-list-alerts');
            }
        });
    }

    // Backup info modal
    const backupInfoBtn = document.getElementById('backup-info-btn');
    const backupModal = document.getElementById('backup-modal');
    const backupModalClose = document.getElementById('backup-modal-close');
    if (backupInfoBtn && backupModal) {
        const openModal = () => { backupModal.classList.add('active'); backupModal.setAttribute('aria-hidden', 'false'); };
        const closeModal = () => { backupModal.classList.remove('active'); backupModal.setAttribute('aria-hidden', 'true'); };
        backupInfoBtn.addEventListener('click', openModal);
        if (backupModalClose) backupModalClose.addEventListener('click', closeModal);
        backupModal.addEventListener('click', (e) => { if (e.target === backupModal) closeModal(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
    }

    // Opslaan en volgend tabblad knoppen
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.save-next-btn');
        if (!btn) return;
        const nextTabId = btn.getAttribute('data-next-tab');
        // Zorg dat bovenaan zichtbaar is
        if (typeof window.scrollTo === 'function') {
            window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
        }
        if (nextTabId) {
            // Activeer het volgende tabblad na korte delay om UI te laten updaten
            setTimeout(() => activateTab(nextTabId), 150);
        }
    });

    // Toggle nieuw-sessie formulier
    const toggleNewSessionBtn = document.getElementById('toggle-new-session-btn');
    const newSessionForm = document.getElementById('behandelsessie-form');
    if (toggleNewSessionBtn && newSessionForm && !toggleNewSessionBtn.dataset.bound) {
        toggleNewSessionBtn.addEventListener('click', () => {
            const isHidden = newSessionForm.style.display === 'none' || newSessionForm.style.display === '';
            newSessionForm.style.display = isHidden ? 'block' : 'none';
            toggleNewSessionBtn.textContent = isHidden ? 'Annuleer nieuwe sessie' : 'Nieuwe behandelsessie';
            if (isHidden) {
                // Scroll soepel naar het formulier en focus op de datum
                try {
                    const targetY = Math.max(0, (window.scrollY || window.pageYOffset || 0) + newSessionForm.getBoundingClientRect().top - 100);
                    if (typeof window.scrollTo === 'function') {
                        window.scrollTo({ top: targetY, behavior: 'smooth' });
                    } else {
                        newSessionForm.scrollIntoView();
                    }
                    setTimeout(() => { document.getElementById('edit-behandel-datum')?.focus(); }, 250);
                } catch (_) {}
            }
        });
        toggleNewSessionBtn.dataset.bound = 'true';
    }

    // Sticky toolbar knoppen (alleen binden indien aanwezig)
    const toolbarSaveBtn = document.getElementById('toolbar-save-btn');
    const toolbarSaveNextBtn = document.getElementById('toolbar-save-next-btn');
    const toolbarBackBtn = document.getElementById('toolbar-back-btn');
    if (toolbarSaveBtn && !toolbarSaveBtn.dataset.bound) {
        toolbarSaveBtn.addEventListener('click', () => {
            // Bepaal actief tab en submit corresponderend formulier
            submitActiveTabForm('save');
        });
        toolbarSaveBtn.dataset.bound = 'true';
    }
    if (toolbarSaveNextBtn && !toolbarSaveNextBtn.dataset.bound) {
        toolbarSaveNextBtn.addEventListener('click', () => {
            submitActiveTabForm('save-next');
        });
        toolbarSaveNextBtn.dataset.bound = 'true';
    }
    if (toolbarBackBtn && !toolbarBackBtn.dataset.bound) {
        toolbarBackBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const ok = confirm('Wil je terug naar het patiëntenoverzicht? Niet-opgeslagen wijzigingen kunnen verloren gaan.');
            if (!ok) return;
            navigateTo('patients');
        });
        toolbarBackBtn.dataset.bound = 'true';
    }

    // Eerste zichtbaarheid-check (na initiale render)
    setTimeout(updateEditToolbarVisibility, 0);
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

// Toon/verberg sticky edit toolbar gebaseerd op zichtbaarheid van bewerkpagina
function updateEditToolbarVisibility(pageHint) {
    const toolbar = document.getElementById('edit-toolbar');
    if (!toolbar) return;
    const editPage = document.getElementById('edit-patient-page');
    const byHint = pageHint === 'edit-patient';
    const byStyle = !!editPage && editPage.style.display !== 'none';
    const visible = byHint || byStyle;
    toolbar.style.display = visible ? 'block' : 'none';
    if (visible) {
        document.body.classList.add('with-edit-toolbar');
    } else {
        document.body.classList.remove('with-edit-toolbar');
    }
}
// Hulpfunctie: submit het formulier van het actieve tabblad
function submitActiveTabForm(mode) {
    const activeTab = document.querySelector('.tab-content.active');
    if (!activeTab) return;
    const form = activeTab.querySelector('form');
    if (!form) return;
    // Bepaal volgende tab id dynamisch indien save-next
    if (mode === 'save-next') {
        const tabs = Array.from(document.querySelectorAll('.tabs .tab-item'))
          .map(el => el.id)
          .filter(Boolean);
        const currentTabId = document.querySelector('.tab-item.active')?.id || '';
        const idx = tabs.indexOf(currentTabId);
        const nextId = idx >= 0 && idx < tabs.length - 1 ? tabs[idx + 1] : null;
        if (nextId) setTimeout(() => activateTab(nextId), 150);
    }
    // Submit het formulier (triggert bestaande update* functies)
    if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
    } else {
        form.submit();
    }
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

// Maak backup-object
function createPatientsBackup() {
    const backup = {
        version: 1,
        app: 'Virtueel EPD - Fysiotherapie',
        createdAt: new Date().toISOString(),
        data: {
            patients: patients || []
        }
    };
    return backup;
}

// Valideer backupbestand
function validateBackup(json) {
    if (!json || typeof json !== 'object') return { valid: false, message: 'Leeg of ongeldig JSON-bestand.' };
    if (json.app !== 'Virtueel EPD - Fysiotherapie') return { valid: false, message: 'Onbekend backuptype.' };
    if (typeof json.version !== 'number') return { valid: false, message: 'Ontbrekende of ongeldige versie.' };
    if (!json.data || !Array.isArray(json.data.patients)) return { valid: false, message: 'Geen patiëntenlijst gevonden in backup.' };
    return { valid: true };
}

// Herstel patiënten uit backup
function restorePatientsFromBackup(backupJson, mode = 'merge') {
    const incoming = backupJson.data.patients || [];
    const existing = Array.isArray(patients) ? patients : [];

    if (mode === 'replace') {
        patients = incoming;
        savePatients();
        return;
    }

    // Merge op basis van sleutel (patientnummer of roepnaam+geboortedatum)
    const existingMap = new Map();
    existing.forEach(p => {
        const key = buildPatientKey(p);
        if (key) existingMap.set(key, p);
    });

    incoming.forEach(p => {
        const key = buildPatientKey(p);
        if (!key) return; // sla overs zonder bruikbare sleutel
        if (!existingMap.has(key)) {
            existing.push(p);
            existingMap.set(key, p);
        }
        // Als duplicaat: sla nieuwe over, behoud bestaande
    });

    patients = existing;
    savePatients();
}

function buildPatientKey(p) {
    if (!p || typeof p !== 'object') return null;
    if (p.patientnummer && String(p.patientnummer).trim() !== '') return `id:${String(p.patientnummer).trim()}`;
    const name = (p.roepnaam || '').trim();
    const dob = (p.geboortedatum || '').trim();
    if (!name || !dob) return null;
    return `nameDob:${name.toLowerCase()}|${dob}`;
}

// Sla patiënten op in lokale opslag
function savePatients() {
    localStorage.setItem('patients', JSON.stringify(patients));
}

// Toon patiëntenlijst
function renderPatientList() {
    const patientListElement = document.getElementById('patient-list');
    if (!patientListElement) return;
    
    // Bind 'Nieuwe patiënt toevoegen' knop altijd, ook wanneer er (nog) geen patiënten zijn
    const addPatientBtnEarly = document.querySelector('.card-footer .btn[data-target="add-patient"]');
    if (addPatientBtnEarly && !addPatientBtnEarly.dataset.bound) {
        addPatientBtnEarly.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo('add-patient');
        });
        addPatientBtnEarly.dataset.bound = 'true';
    }
    
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
                <button class="btn btn-primary btn-edit" data-index="${index}">Bewerk dossier</button>
                <button class="btn btn-success btn-pdf" data-index="${index}">PDF Genereren</button>
                <button class="btn btn-danger btn-delete" data-index="${index}">Verwijder dossier</button>
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
    
    // Verwijderen met bevestiging
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const indexStr = e.target.getAttribute('data-index');
            const index = Number(indexStr);
            const p = patients[index];
            const name = p ? `${p.roepnaam || ''} ${p.achternaam || ''}`.trim() : '';
            const ok = confirm(`Weet je zeker dat je dit dossier wilt verwijderen${name ? ` (\"${name}\")` : ''}? Dit kan niet ongedaan worden gemaakt.`);
            if (!ok) return;
            if (index >= 0 && index < patients.length) {
                patients.splice(index, 1);
                savePatients();
                renderPatientList();
                showAlert('Dossier verwijderd.', 'success', 'patient-list-alerts');
            }
        });
    });
    
    // (Listener voor 'Nieuwe patiënt toevoegen' is eerder al gebonden)
}

// Nieuwe patiënt toevoegen
function addPatient(event) {
    event.preventDefault();
    
    // Verzamel basisgegevens
    const patientData = {
        // Persoonsgegevens
        roepnaam: document.getElementById('patient-roepnaam').value.trim(),
        achternaam: document.getElementById('patient-achternaam').value.trim(),
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
    if (!patientData.roepnaam || !patientData.achternaam || !patientData.geboortedatum || !patientData.patientnummer) {
        showAlert('Vul alle verplichte velden in.', 'warning', 'add-patient-alerts');
        return;
    }
    
    // Voeg patiënt toe aan array
    patients.push(patientData);
    
    // Sla op in lokale opslag
    savePatients();

    // Navigeer direct naar 'Patiënt bewerken' voor de zojuist toegevoegde patiënt
    const newIndex = patients.length - 1;
    editPatient(newIndex);
    // Toon bevestiging op de bewerkpagina
    setTimeout(() => {
        showAlert('Patiënt succesvol toegevoegd. Je kunt nu gegevens bewerken.', 'success', 'edit-patient-alerts');
        // Open direct de Intake tab
        activateTab('intake-tab');
    }, 0);
}

// Reset patiëntformulier
function resetPatientForm() {
    document.getElementById('add-patient-form').reset();
}

// Bewerk patiënt
function editPatient(index) {
    currentPatient = patients[index];
    // Zorg voor episodes-structuur; migreer oude vlakke velden naar episode[0]
    if (currentPatient && !Array.isArray(currentPatient.episodes)) {
        const migrated = {
            begindatum: currentPatient.begindatum || '',
            einddatum: currentPatient.einddatum || '',
            verslagleggingsrichtlijn: currentPatient.verslagleggingsrichtlijn || '',
            behandelplanFase: currentPatient.behandelplanFase || {},
            behandelFase: currentPatient.behandelFase || [],
            eindevaluatieFase: currentPatient.eindevaluatieFase || {}
        };
        currentPatient.episodes = [migrated];
        // houd ook de vlakke velden aan voor backwards compat, maar schrijf consistenter weg vanuit episodes
        savePatients();
    }
    currentEpisodeIndex = 0;
    
    // Navigeer naar bewerk pagina
    navigateTo('edit-patient');
    // Forceer tonen toolbar na navigatie
    updateEditToolbarVisibility('edit-patient');
    // Scroll volledig naar boven zodat header, menu en waarschuwing zichtbaar zijn
    setTimeout(() => {
        if (typeof window.scrollTo === 'function') {
            window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
        } else if (document.documentElement) {
            document.documentElement.scrollTop = 0;
        } else if (document.body) {
            document.body.scrollTop = 0;
        }
    }, 0);
    
    // Vul formulier met patiëntgegevens
    fillPatientForm();
    
    // Activeer eerste tab
    activateTab('persoonsgegevens-tab');

    // Waarschuw als achternaam ontbreekt in oudere dossiers
    if (!currentPatient.achternaam || currentPatient.achternaam.trim() === '') {
        setTimeout(() => {
            showAlert('Dit dossier mist een achternaam. Vul deze aan bij Persoonsgegevens.', 'warning', 'edit-patient-alerts');
        }, 200);
    }
}

// Vul patiëntformulier met gegevens
function fillPatientForm() {
    if (!currentPatient) return;
    
    // Persoonsgegevens
    document.getElementById('edit-roepnaam').value = currentPatient.roepnaam || '';
    const editAchternaamEl = document.getElementById('edit-achternaam');
    if (editAchternaamEl) {
        editAchternaamEl.value = currentPatient.achternaam || '';
    }
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
    
    // Behandelepisode (via actieve episode)
    const ep = getActiveEpisode();
    document.getElementById('edit-begindatum').value = ep ? (ep.begindatum || '') : '';
    document.getElementById('edit-einddatum').value = ep ? (ep.einddatum || '') : '';
    document.getElementById('edit-verslagleggingsrichtlijn').value = ep ? (ep.verslagleggingsrichtlijn || '') : '';
    
    // Verzekering
    document.getElementById('edit-verzekeraar').value = currentPatient.verzekeraar || '';
    document.getElementById('edit-zvlsoort').value = currentPatient.zvlsoort || '';
    
    // Vul de andere fases in als ze bestaan
    fillIntakeFase();
    fillOnderzoeksFase();
    fillDiagnoseFase();
    fillMeetinstrumenten();
    renderEpisodesOverview();
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
    const ep = getActiveEpisode();
    if (!currentPatient || !ep || !ep.behandelplanFase) return;
    
    const plan = ep.behandelplanFase;
    
    document.getElementById('edit-plan-hulpvraag').value = plan.hulpvraag || '';
    document.getElementById('edit-verwachtingen').value = plan.verwachtingen || '';
    document.getElementById('edit-verwacht-herstel').value = plan.verwachtHerstel || '';
    document.getElementById('edit-hoofddoel').value = plan.hoofddoel || '';
    
    document.getElementById('edit-toestemming-behandelplan').checked = plan.toestemmingBehandelplan || false;
    document.getElementById('edit-toestemming-behandeling').checked = plan.toestemmingBehandeling || false;
    document.getElementById('edit-behandelplantabel').value = plan.behandelplantabel || '';
    document.getElementById('edit-toelichting-plan').value = plan.toelichting || '';
}

// Episodes helpers en UI
function getActiveEpisode() {
    if (!currentPatient || !Array.isArray(currentPatient.episodes) || currentPatient.episodes.length === 0) return null;
    const idx = Math.min(Math.max(currentEpisodeIndex || 0, 0), currentPatient.episodes.length - 1);
    return currentPatient.episodes[idx];
}

function ensureActiveEpisode() {
    if (!currentPatient.episodes) currentPatient.episodes = [];
    if (currentPatient.episodes.length === 0) {
        currentPatient.episodes.push({ begindatum: '', einddatum: '', verslagleggingsrichtlijn: '', behandelplanFase: {}, behandelFase: [], eindevaluatieFase: {} });
    }
    currentEpisodeIndex = Math.min(Math.max(currentEpisodeIndex || 0, 0), currentPatient.episodes.length - 1);
    return currentPatient.episodes[currentEpisodeIndex];
}

function renderEpisodesOverview() {
    const container = document.getElementById('episodes-overview-container');
    if (!container) return;
    container.innerHTML = '';
    const episodes = Array.isArray(currentPatient && currentPatient.episodes) ? currentPatient.episodes : [];
    if (episodes.length === 0) {
        container.innerHTML = '<div class="alert alert-info">Geen behandelepisodes. Klik op "Nieuwe behandelepisode" om te starten.</div>';
        return;
    }
    const list = document.createElement('div');
    episodes.forEach((ep, i) => {
        const btn = document.createElement('button');
        btn.className = 'btn ' + (i === currentEpisodeIndex ? 'btn-primary' : 'btn-secondary');
        const label = `Episode ${i + 1}${ep.begindatum ? ` (${ep.begindatum}${ep.einddatum ? ` - ${ep.einddatum}` : ''})` : ''}`;
        btn.textContent = label;
        btn.style.marginRight = '8px';
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            currentEpisodeIndex = i;
            // Her-vul episodegebonden velden en lijst
            fillPatientForm();
        });
        list.appendChild(btn);
    });
    container.appendChild(list);
}

function createNewEpisode() {
    if (!currentPatient) return;
    const ep = ensureActiveEpisode();
    // Nieuwe lege episode toevoegen
    currentPatient.episodes.push({ begindatum: '', einddatum: '', verslagleggingsrichtlijn: '', behandelplanFase: {}, behandelFase: [], eindevaluatieFase: {} });
    currentEpisodeIndex = currentPatient.episodes.length - 1;
    savePatients();
    fillPatientForm();
    showAlert('Nieuwe behandelepisode aangemaakt.', 'success', 'edit-patient-alerts');
}

// Vul Behandelfase
function fillBehandelFase() {
    // Vind container en reset altijd om 'doorlekken' tussen patiënten te voorkomen
    const behandelContainer = document.getElementById('behandelsessies-container');
    if (!behandelContainer) return;
    behandelContainer.innerHTML = '';

    const ep = getActiveEpisode();
    // Geen huidige patiënt of geen sessies: toon lege staat en stop
    if (!currentPatient || !ep || !Array.isArray(ep.behandelFase) || ep.behandelFase.length === 0) {
        behandelContainer.innerHTML = '<div class="alert alert-info">Geen behandelsessies geregistreerd.</div>';
        return;
    }

    // Toon bestaande behandelsessies als inklapbare kaarten (standaard ingeklapt)
    ep.behandelFase.forEach((sessie, index) => {
        const sessieElement = document.createElement('div');
        sessieElement.className = 'card mb-3 behandel-sessie';
        
        const bodyId = `behandelsessie-${index}-body`;
        sessieElement.innerHTML = `
            <div class="card-header behandel-toggle" role="button" tabindex="0" aria-expanded="false" aria-controls="${bodyId}">
                <span class="chevron" aria-hidden="true">▶</span>
                Behandelsessie ${index + 1}${sessie.datum ? ` – ${formatDutchDate(sessie.datum)}` : ''}
            </div>
            <div class="card-body" id="${bodyId}" style="display: none;">
                <div class="form-group">
                    <label class="form-label">Datum</label>
                    <input type="date" class="form-control sessie-input" data-field="datum" value="${sessie.datum || ''}" readonly>
                </div>
                <div class="form-group">
                    <label class="form-label">Subjectief</label>
                    <textarea class="form-control sessie-input" data-field="subjectief" readonly>${sessie.subjectief || ''}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Objectief</label>
                    <textarea class="form-control sessie-input" data-field="objectief" readonly>${sessie.objectief || ''}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Analyse</label>
                    <textarea class="form-control sessie-input" data-field="analyse" readonly>${sessie.analyse || ''}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Plan</label>
                    <textarea class="form-control sessie-input" data-field="plan" readonly>${sessie.plan || ''}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Afspraken</label>
                    <textarea class="form-control sessie-input" data-field="afspraken" readonly>${sessie.afspraken || ''}</textarea>
                </div>
                <div class="form-group" style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button type="button" class="btn btn-secondary btn-edit">Bewerken</button>
                    <button type="button" class="btn btn-primary btn-save" style="display:none;">Opslaan</button>
                    <button type="button" class="btn btn-warning btn-cancel" style="display:none;">Annuleren</button>
                    <button type="button" class="btn btn-danger btn-delete" style="margin-left:auto;">Verwijderen</button>
                </div>
            </div>
        `;

        // Voeg toe aan container
        behandelContainer.appendChild(sessieElement);

        // Toggle logica: standaard ingeklapt, klik/Enter/Space togglet
        const header = sessieElement.querySelector('.behandel-toggle');
        const chevron = sessieElement.querySelector('.chevron');
        const body = sessieElement.querySelector('.card-body');
        const toggle = () => {
            const expanded = header.getAttribute('aria-expanded') === 'true';
            header.setAttribute('aria-expanded', expanded ? 'false' : 'true');
            body.style.display = expanded ? 'none' : 'block';
            if (chevron) chevron.textContent = expanded ? '▶' : '▼';
        };
        header.addEventListener('click', toggle);
        header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle();
            }
        });

        // Edit/Delete handlers
        const btnEdit = sessieElement.querySelector('.btn-edit');
        const btnSave = sessieElement.querySelector('.btn-save');
        const btnCancel = sessieElement.querySelector('.btn-cancel');
        const btnDelete = sessieElement.querySelector('.btn-delete');
        const inputs = Array.from(sessieElement.querySelectorAll('.sessie-input'));

        const setEditing = (editing) => {
            inputs.forEach(el => {
                if (el.tagName === 'INPUT') el.readOnly = !editing;
                if (el.tagName === 'TEXTAREA') el.readOnly = !editing;
                el.classList.toggle('editing', editing);
            });
            btnEdit.style.display = editing ? 'none' : 'inline-block';
            btnSave.style.display = editing ? 'inline-block' : 'none';
            btnCancel.style.display = editing ? 'inline-block' : 'none';
        };

        let originalValues = null;
        btnEdit.addEventListener('click', () => {
            originalValues = inputs.map(el => ({ field: el.dataset.field, value: el.value || el.textContent }));
            setEditing(true);
        });

        btnCancel.addEventListener('click', () => {
            if (originalValues) {
                originalValues.forEach(({ field, value }) => {
                    const el = inputs.find(i => i.dataset.field === field);
                    if (!el) return;
                    if (el.tagName === 'INPUT') el.value = value || '';
                    else el.value = value || '';
                });
            }
            setEditing(false);
        });

        btnSave.addEventListener('click', () => {
            const updated = { ...sessie };
            inputs.forEach(el => {
                const val = (el.value || '').trim();
                updated[el.dataset.field] = val;
            });
            // Valideer datum
            if (!updated.datum) {
                alert('Vul een datum in voor de behandelsessie.');
                return;
            }
            // Schrijf terug en sla op
            ep.behandelFase[index] = updated;
            currentPatient.behandelFase = ep.behandelFase; // legacy mirror
            savePatients();
            // Her-render om header (datum) te updaten en editing te resetten
            fillBehandelFase();
        });

        btnDelete.addEventListener('click', () => {
            const ok = confirm('Weet je zeker dat je deze behandelsessie wilt verwijderen?');
            if (!ok) return;
            if (index >= 0 && index < ep.behandelFase.length) {
                ep.behandelFase.splice(index, 1);
                currentPatient.behandelFase = ep.behandelFase; // legacy mirror
                savePatients();
                fillBehandelFase();
            }
        });
    });
}

function formatDutchDate(isoDate) {
    try {
        if (!isoDate) return '';
        const d = new Date(isoDate);
        if (Number.isNaN(d.getTime())) return isoDate;
        return d.toLocaleDateString('nl-NL');
    } catch (_) {
        return isoDate;
    }
}

// Vul Eindevaluatiefase
function fillEindevaluatieFase() {
    const ep = getActiveEpisode();
    if (!currentPatient || !ep || !ep.eindevaluatieFase) return;
    
    const evaluatie = ep.eindevaluatieFase;
    
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
    currentPatient.achternaam = document.getElementById('edit-achternaam').value.trim();
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
    
    // Behandelepisode (actieve)
    const ep = ensureActiveEpisode();
    ep.begindatum = document.getElementById('edit-begindatum').value;
    ep.einddatum = document.getElementById('edit-einddatum').value;
    ep.verslagleggingsrichtlijn = document.getElementById('edit-verslagleggingsrichtlijn').value.trim();
    // Mirror naar legacy vlakke velden (voor PDF/backward-compat)
    currentPatient.begindatum = ep.begindatum;
    currentPatient.einddatum = ep.einddatum;
    currentPatient.verslagleggingsrichtlijn = ep.verslagleggingsrichtlijn;
    
    // Verzekering
    currentPatient.verzekeraar = document.getElementById('edit-verzekeraar').value.trim();
    currentPatient.zvlsoort = document.getElementById('edit-zvlsoort').value.trim();
    
    // Sla op in lokale opslag
    savePatients();
    
    // Toon bevestiging
    showAlert('Patiëntgegevens succesvol bijgewerkt.', 'success', 'edit-patient-alerts');
    // Scroll helemaal naar boven
    if (typeof window.scrollTo === 'function') {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
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
    if (typeof window.scrollTo === 'function') {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
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
    if (typeof window.scrollTo === 'function') {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
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
    if (typeof window.scrollTo === 'function') {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
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
    if (typeof window.scrollTo === 'function') {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
}

// Update Behandelplanfase
function updateBehandelplanFase(event) {
    event.preventDefault();
    
    if (!currentPatient) return;
    
    // Maak object aan als het nog niet bestaat
    const ep = ensureActiveEpisode();
    if (!ep.behandelplanFase) {
        ep.behandelplanFase = {};
    }
    
    const plan = ep.behandelplanFase;
    
    plan.hulpvraag = document.getElementById('edit-plan-hulpvraag').value.trim();
    plan.verwachtingen = document.getElementById('edit-verwachtingen').value.trim();
    plan.verwachtHerstel = document.getElementById('edit-verwacht-herstel').value.trim();
    plan.hoofddoel = document.getElementById('edit-hoofddoel').value.trim();
    
    plan.toestemmingBehandelplan = document.getElementById('edit-toestemming-behandelplan').checked;
    plan.toestemmingBehandeling = document.getElementById('edit-toestemming-behandeling').checked;
    plan.behandelplantabel = document.getElementById('edit-behandelplantabel').value.trim();
    plan.toelichting = document.getElementById('edit-toelichting-plan').value.trim();
    
    // Mirror naar legacy vlakke velden
    currentPatient.behandelplanFase = plan;
    // Sla op in lokale opslag
    savePatients();
    
    // Toon bevestiging
    showAlert('Behandelplanfase succesvol bijgewerkt.', 'success', 'edit-patient-alerts');
    if (typeof window.scrollTo === 'function') {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
}

// Voeg behandelsessie toe
function addBehandelsessie(event) {
    event.preventDefault();
    
    if (!currentPatient) return;
    
    const ep = ensureActiveEpisode();
    // Maak array aan als het nog niet bestaat
    if (!ep.behandelFase) {
        ep.behandelFase = [];
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
    ep.behandelFase.push(sessie);
    // Mirror naar legacy vlakke velden
    currentPatient.behandelFase = ep.behandelFase;
    
    // Sla op in lokale opslag
    savePatients();
    
    // Reset formulier
    document.getElementById('behandelsessie-form').reset();
    
    // Toon bevestiging
    showAlert('Behandelsessie succesvol toegevoegd.', 'success', 'edit-patient-alerts');
    
    // Werk behandelsessies lijst bij en klap formulier dicht
    fillBehandelFase();
    const btn = document.getElementById('toggle-new-session-btn');
    const form = document.getElementById('behandelsessie-form');
    if (form && btn) {
        form.style.display = 'none';
        btn.textContent = 'Nieuwe behandelsessie';
    }
    if (typeof window.scrollTo === 'function') {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
}

// Update Eindevaluatiefase
function updateEindevaluatieFase(event) {
    event.preventDefault();
    
    if (!currentPatient) return;
    
    // Maak object aan als het nog niet bestaat
    const ep = ensureActiveEpisode();
    if (!ep.eindevaluatieFase) {
        ep.eindevaluatieFase = {};
    }
    
    const evaluatie = ep.eindevaluatieFase;
    
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
    
    // Mirror naar legacy vlakke velden
    currentPatient.eindevaluatieFase = evaluatie;
    // Sla op in lokale opslag
    savePatients();
    
    // Toon bevestiging
    showAlert('Eindevaluatiefase succesvol bijgewerkt.', 'success', 'edit-patient-alerts');
    if (typeof window.scrollTo === 'function') {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
}

// Genereer PDF
async function generatePDF(index) {
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

        // Logo rechtsboven met correcte verhouding
        async function loadImageWithDims(src) {
            try {
                const res = await fetch(src);
                const blob = await res.blob();
                const dataUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
                const img = new Image();
                const dims = await new Promise((resolve) => {
                    img.onload = () => resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
                    img.onerror = () => resolve(null);
                    img.src = dataUrl;
                });
                if (!dims) return null;
                return { dataUrl, width: dims.w, height: dims.h };
            } catch (_) {
                return null;
            }
        }

        const logo = await loadImageWithDims('img/HAN_logo1a.png');
        let lineY = 24; // default positie van scheidingslijn onder de titel
        if (logo) {
            const pageWidth = 210; // A4 mm
            const margin = 14;
            const maxW = 46; // groter logo
            const maxH = 18; // iets hogere limiet
            let drawW = maxW;
            let drawH = (logo.height / logo.width) * drawW;
            if (drawH > maxH) { drawH = maxH; drawW = (logo.width / logo.height) * drawH; }
            const x = pageWidth - margin - drawW;
            const y = 10;
            try { doc.addImage(logo.dataUrl, 'PNG', x, y, drawW, drawH); } catch (_) {}
            // Plaats scheidingslijn altijd onder de onderkant van het logo
            lineY = Math.max(lineY, y + drawH + 2);
        }

        // Scheidingslijn onder titel
        doc.setDrawColor(230, 0, 126);
        doc.setLineWidth(0.5);
        doc.line(14, lineY, 196, lineY);

        // Korte toelichting (ruim onder de titel)
        const scale = doc.internal && doc.internal.scaleFactor ? doc.internal.scaleFactor : 1;
        const lh = (10 * (typeof doc.getLineHeightFactor === 'function' ? doc.getLineHeightFactor() : 1.15)) / scale;
        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);
        const infoText = 'Dit dossier is gegenereerd vanuit het Virtuele EPD van de opleiding Fysiotherapie (HAN). Gebruik uitsluitend fictieve en niet-herleidbare persoonsgegevens.';
        const infoLines = doc.splitTextToSize(infoText, 180);
        const infoY = lineY + 6; // ruimte t.o.v. scheidingslijn
        doc.text(infoLines, 14, infoY);
        let afterInfoY = infoY + (infoLines.length * lh) + 4;

        // Professionele infobox met meta-gegevens
        const boxX = 14, boxW = 182, rowLH = (12 * (typeof doc.getLineHeightFactor === 'function' ? doc.getLineHeightFactor() : 1.15)) / scale, pad = 3;
        const rows = 3; // Therapeut, COP, Datum
        const boxH = rows * rowLH + pad * 2;
        doc.setFillColor(245, 245, 245);
        doc.setDrawColor(220, 220, 220);
        doc.rect(boxX, afterInfoY, boxW, boxH, 'FD');

        // Labels en waarden
        const labelX = boxX + pad + 1;
        const valueX = boxX + 55;
        let metaY = afterInfoY + pad + rowLH - 1;
        doc.setFontSize(11);
        // Rij 1
        doc.setTextColor(230, 0, 126); doc.setFont(undefined, 'bold'); doc.text('Therapeut', labelX, metaY);
        doc.setTextColor(0, 0, 0); doc.setFont(undefined, 'normal'); doc.text(`${currentUser.fullName}`, valueX, metaY);
        // Rij 2
        metaY += rowLH;
        doc.setTextColor(230, 0, 126); doc.setFont(undefined, 'bold'); doc.text('COP', labelX, metaY);
        doc.setTextColor(0, 0, 0); doc.setFont(undefined, 'normal'); doc.text(`${currentUser.cop}`, valueX, metaY);
        // Rij 3
        metaY += rowLH;
        doc.setTextColor(230, 0, 126); doc.setFont(undefined, 'bold'); doc.text('Datum', labelX, metaY);
        doc.setTextColor(0, 0, 0); doc.setFont(undefined, 'normal'); doc.text(`${new Date().toLocaleDateString('nl-NL')}`, valueX, metaY);
        
        // Functie om veld toe te voegen met label en automatisch afbreken (word-wrap)
        function addField(label, value, x, y, maxWidth) {
            const safeValue = value || '';
            const wrappedLines = doc.splitTextToSize(safeValue, maxWidth - 6);
            const hasValue = safeValue !== '' && wrappedLines.length > 0;

            // Bepaal line-height en tekstblokhoogte op basis van fontgrootte en lineHeightFactor
            const fontSize = typeof doc.getFontSize === 'function' ? doc.getFontSize() : 10;
            const lineHeightFactor = typeof doc.getLineHeightFactor === 'function' ? doc.getLineHeightFactor() : 1.15;
            const scale = doc.internal && doc.internal.scaleFactor ? doc.internal.scaleFactor : 1;
            const lineHeight = (fontSize * lineHeightFactor) / scale;
            const labelSpacing = 2; // minimale ruimte direct onder label
            const padding = 3; // padding binnen het kader
            const textHeight = hasValue ? (wrappedLines.length * lineHeight) : lineHeight; // lege veld = 1 regel
            const rectHeight = textHeight + padding * 2;
            const requiredHeight = labelSpacing + rectHeight + 2;

            // Paginabreuk indien nodig vóór tekenen
            if (y + requiredHeight > 270) {
                doc.addPage();
                y = 20;
            }

            // Label (subkopje)
            doc.setTextColor(230, 0, 126);
            doc.setFont(undefined, 'bold');
            doc.text(label, x, y);

            // Waarde (met achtergrond en wrapping)
            const rectTop = y + labelSpacing; // kader begint direct na labelruimte
            doc.setTextColor(0, 0, 0);
            doc.setFont(undefined, 'normal');

            const bgColor = hasValue ? [240, 248, 255] : [245, 245, 245];
            doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
            doc.setDrawColor(230, 230, 230);
            doc.rect(x - 2, rectTop, maxWidth, rectHeight, 'FD');
            if (hasValue) {
                const textY = rectTop + padding + lineHeight * 0.85; // baseline iets onder de bovenrand
                doc.text(wrappedLines, x, textY, { maxWidth: maxWidth - 6 });
            }
            const fieldGap = 8; // extra ruimte onder elk veld voor duidelijkheid
            return rectTop + rectHeight + fieldGap;
        }
        
        // Functie om sectieheader toe te voegen
        function addSectionHeader(text, x, y) {
            doc.setFontSize(16);
            doc.setTextColor(230, 0, 126);
            doc.setFont(undefined, 'bold');
            doc.text(text, x, y);
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(0, 0, 0);
            return y + 8;
        }
        
        // Functie om subsectieheader toe te voegen
        function addSubSectionHeader(text, x, y) {
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text(text, x, y);
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            return y + 8;
        }
        
        // Functie om te controleren of we een nieuwe pagina nodig hebben
        function checkPageBreak(y, threshold = 270) {
            if (y > threshold) {
                doc.addPage();
                return 20;
            }
            return y;
        }
        
        // Voeg patiëntgegevens toe (start onder de meta-infobox)
        const patientHeaderStart = Math.max(afterInfoY + boxH + 10, 55);
        let yPos = addSectionHeader('Patiëntgegevens', 14, patientHeaderStart);
        
        // Persoonsgegevens
        yPos = addField('Roepnaam', patient.roepnaam, 14, yPos, 80);
        yPos = addField('Achternaam', patient.achternaam, 14, yPos, 80);
        yPos = addField('Geboortedatum', patient.geboortedatum, 14, yPos, 80);
        yPos = addField('Geslacht', patient.geslacht, 14, yPos, 80);
        yPos = addField('Patiëntnummer', patient.patientnummer, 14, yPos, 80);
        yPos = addField('Verzekerdennummer', patient.verzekerdennummer, 14, yPos, 80);
        
        // Contactgegevens
        let rightColY = patientHeaderStart + 7; // Start op dezelfde hoogte als de linkerkolom na de header
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

        // Behandelepisode start altijd op nieuwe pagina
        doc.addPage();
        yPos = 20;
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

        // 1. Intake fase start altijd op nieuwe pagina
        doc.addPage();
        yPos = 20;
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
        
        // 2. Onderzoeksfase start altijd op nieuwe pagina
        doc.addPage();
        yPos = 20;
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
        
        // 3. Diagnosefase start altijd op nieuwe pagina
        doc.addPage();
        yPos = 20;
        yPos = addSectionHeader('3. Diagnosefase', 14, yPos);
        
        // Controleer of diagnoseFase bestaat, zo niet maak een leeg object
        const diagnose = patient.diagnoseFase || {};
        
        yPos = addField('Fysiotherapeutische diagnose', diagnose.fysiotherapeutischeDiagnose, 14, yPos, 180);
        yPos = addField('(Verwijs)diagnosecode', diagnose.verwijsdiagnosecode, 14, yPos, 180);
        yPos = addField('Indicatie voor fysiotherapie', diagnose.indicatieFysiotherapie ? 'Ja' : 'Nee', 14, yPos, 180);
        yPos = addField('Behandelen conform richtlijn', diagnose.behandelenRichtlijn ? 'Ja' : 'Nee', 14, yPos, 180);
        yPos = addField('Bijzonderheden', diagnose.bijzonderheden, 14, yPos, 180);
        
        // 4. Meetinstrumenten start altijd op nieuwe pagina
        doc.addPage();
        yPos = 20;
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
        
        // Voeg paginanummers toe (voetregel)
        try {
            const pageCount = typeof doc.getNumberOfPages === 'function' ? doc.getNumberOfPages() : (doc.internal && doc.internal.getNumberOfPages ? doc.internal.getNumberOfPages() : 1);
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(9);
                doc.setTextColor(120, 120, 120);
                doc.text(`${i} van ${pageCount}`, 105, 290, { align: 'center' });
            }
        } catch (_) {}

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
