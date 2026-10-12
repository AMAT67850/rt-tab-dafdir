/* rt-donnees.js — Rocket Tower — reprise d'octobre 2026
 *
 * Fichier commun aux neuf pages, appelé par une seule ligne placée avant tout code
 * qui lit ou écrit des données :
 *     <script src="rt-donnees.js"></script>
 * Il remplace garde-navigateur.js.
 *
 * Ce qu'il fait, dans l'ordre :
 *
 * 1. VERROU CHROME. Hors de Google Chrome, la page ne se charge pas : rien n'est lu,
 *    rien n'est écrit. Un écran indique l'adresse à ouvrir dans Chrome et propose
 *    d'exporter les anciennes données restées dans ce navigateur (lecture seule).
 *
 * 2. ÉTIQUETTES « rt- ». Les pages continuent d'appeler les anciennes étiquettes
 *    (recettesRT…) ; elles sont aiguillées sans modification des pages vers les
 *    nouvelles (rt-recettes…). Au premier passage, le contenu des anciennes est
 *    recopié sous les nouvelles. Les anciennes ne sont ni modifiées ni effacées.
 *
 * 3. FICHIER UNIQUE DANS iCLOUD. Les données vivent dans un fichier chiffré
 *    (donnees_rocket_tower.json), dans un dossier iCloud désigné une fois par Mac.
 *    Chrome en garde une copie de travail. Chaque modification réelle est écrite
 *    dans le fichier ; les simples recalculs du module 6 ne le sont pas.
 *    Chiffrement identique à Horizon SCI : PBKDF2-SHA-256, 600 000 itérations,
 *    AES-GCM 256 bits. Le mot de passe n'est écrit nulle part ; la clé qui en
 *    dérive est gardée le temps de l'onglet. Aucune récupération en cas d'oubli.
 *
 * 4. GARDE-FOU ANTI-ÉCRASEMENT. Le fichier porte un numéro de révision, la date et
 *    le nom du Mac qui a écrit, lisibles sans mot de passe. Avant chaque écriture,
 *    le fichier est relu : s'il est plus récent que ce que ce Mac connaît, rien
 *    n'est écrit. Au retour sur l'onglet, la révision est relue. Tant que le
 *    fichier n'est pas joignable ou que le mot de passe n'est pas saisi, toute
 *    modification est refusée, avec un message, et la page est rechargée.
 *
 * 5. BANDEAU D'ÉTAT en haut de chaque page, masqué à l'impression.
 */
(function () {
    'use strict';

    var ADRESSE = 'https://amat67850.github.io/rt-tab-dafdir/';
    var FICHIER = 'donnees_rocket_tower.json';
    var HISTO = 'historique';
    var GARDER = 20;
    var ITER = 600000;

    // Anciennes étiquettes → nouvelles
    var CORRESP = {
        'recettesRT': 'rt-recettes',
        'chargesRecurrentesRT': 'rt-charges-recurrentes',
        'chargesPeriodiquesRT': 'rt-charges-periodiques',
        'previsionnel12moisRT': 'rt-previsionnel',
        'typesRecettesRT': 'rt-types-recettes',
        'derniereSauvegardeRT': 'rt-derniere-sauvegarde',
        'rocket_tower_seuils_personnalises': 'rt-seuils-personnalises'
    };
    var NOUVELLES = Object.keys(CORRESP).map(function (k) { return CORRESP[k]; });
    var ETAT = 'rt-etat';            // { revision, sale, migreLe }
    // Étiquette « légère » : sa modification n'est jamais refusée.
    var LEGERE = 'rt-derniere-sauvegarde';

    var SP = Storage.prototype;
    var origGet = SP.getItem, origSet = SP.setItem, origRem = SP.removeItem;
    var LS;
    try { LS = window.localStorage; } catch (e) { LS = null; }

    function lire(k) { return origGet.call(LS, k); }
    function ecrire(k, v) { origSet.call(LS, k, v); }
    function effacer(k) { origRem.call(LS, k); }

    // ════════════════════════════════════════════════════════════════════════
    // 1. VERROU CHROME
    // ════════════════════════════════════════════════════════════════════════
    function estChrome() {
        try {
            var b = navigator.userAgentData && navigator.userAgentData.brands;
            return !!(b && b.some(function (x) { return x.brand === 'Google Chrome'; }));
        } catch (e) { return false; }
    }

    if (!estChrome()) {
        // Plus aucune lecture ni écriture par les pages.
        SP.getItem = function (k) { return this === LS ? null : origGet.call(this, k); };
        SP.setItem = function (k, v) { if (this !== LS) origSet.call(this, k, v); };
        SP.removeItem = function (k) { if (this !== LS) origRem.call(this, k); };
        try { window.stop(); } catch (e) { /* rien */ }
        setTimeout(ecranBlocage, 0);
        return;
    }

    function ecranBlocage() {
        var html = document.documentElement;
        html.innerHTML = '<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
            '<title>Ouvrir dans Chrome — Rocket Tower</title></head><body></body>';
        var b = document.body;
        b.setAttribute('style', 'margin:0;min-height:100vh;background:#f3f4f6;display:flex;align-items:center;' +
            'justify-content:center;padding:24px;box-sizing:border-box;' +
            'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;');
        var boite = document.createElement('div');
        boite.setAttribute('style', 'background:#fff;max-width:640px;width:100%;border-radius:14px;padding:32px;' +
            'box-shadow:0 10px 40px rgba(0,0,0,.15);border-top:6px solid #b91c1c;font-size:18px;line-height:1.55;color:#1f2933;');
        boite.innerHTML =
            '<h1 style="font-size:24px;margin:0 0 16px;color:#7f1d1d;">Cet outil fonctionne dans Chrome.</h1>' +
            '<p style="margin:0 0 14px;">Copiez l\'adresse ci-dessous et collez-la dans Google Chrome.</p>' +
            '<p id="rtAdr" style="margin:0 0 18px;background:#f4f6f8;border:1px solid #dfe4ea;border-radius:8px;' +
              'padding:12px 14px;word-break:break-all;">' + ADRESSE + '</p>' +
            '<p style="margin:0 0 22px;"><button id="rtCopier" type="button" style="font-size:18px;padding:12px 20px;' +
              'border:none;border-radius:8px;background:#1d4ed8;color:#fff;cursor:pointer;">Copier l\'adresse</button></p>' +
            '<hr style="border:none;border-top:1px solid #e5e7eb;margin:8px 0 18px;">' +
            '<p style="margin:0 0 12px;color:#4b5563;">Des données anciennes du tableau de bord peuvent subsister dans ce navigateur. ' +
              'Ce bouton les enregistre dans un fichier, sans rien modifier ici.</p>' +
            '<p style="margin:0;"><button id="rtExpAncien" type="button" style="font-size:18px;padding:12px 20px;' +
              'border:1px solid #9ca3af;border-radius:8px;background:#fff;color:#1f2933;cursor:pointer;">' +
              'Exporter les données de ce navigateur</button></p>' +
            '<p id="rtExpMsg" style="margin:12px 0 0;color:#4b5563;"></p>';
        b.appendChild(boite);

        document.getElementById('rtCopier').onclick = function () {
            var bt = this;
            var ok = function () { bt.textContent = 'Adresse copiée'; };
            try { navigator.clipboard.writeText(ADRESSE).then(ok, selection); } catch (e) { selection(); }
            function selection() {
                var r = document.createRange(); r.selectNodeContents(document.getElementById('rtAdr'));
                var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
                bt.textContent = 'Adresse sélectionnée — faites ⌘C';
            }
        };
        document.getElementById('rtExpAncien').onclick = function () {
            var msg = document.getElementById('rtExpMsg');
            if (!LS) { msg.textContent = 'Ce navigateur ne donne pas accès à sa mémoire.'; return; }
            var g = function (k) { try { return JSON.parse(origGet.call(LS, k) || 'null'); } catch (e) { return null; } };
            var d = {
                version: '2.0', dateExport: new Date().toISOString(), systeme: 'Rocket Tower',
                recettes: g('recettesRT') || [], chargesRecurrentes: g('chargesRecurrentesRT') || [],
                chargesPeriodiques: g('chargesPeriodiquesRT') || [], previsionnel: g('previsionnel12moisRT'),
                typesRecettes: g('typesRecettesRT')
            };
            var n = d.recettes.length + d.chargesRecurrentes.length + d.chargesPeriodiques.length;
            if (!n && !d.previsionnel) { msg.textContent = 'Aucune donnée du tableau de bord dans ce navigateur.'; return; }
            telecharger('rocket-tower-export-' + jour() + '_ancien-navigateur.json', JSON.stringify(d, null, 2));
            msg.textContent = 'Fichier enregistré dans vos Téléchargements : ' + d.recettes.length + ' recettes, ' +
                d.chargesRecurrentes.length + ' charges récurrentes, ' + d.chargesPeriodiques.length + ' charges périodiques.';
        };
    }

    // ════════════════════════════════════════════════════════════════════════
    // Outils
    // ════════════════════════════════════════════════════════════════════════
    function jour() {
        var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    }
    function horodatage() {
        var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
        return '' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
    }
    function telecharger(nom, texte) {
        var blob = new Blob([texte], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = nom;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }
    function quand(iso) {
        if (!iso) return '—';
        var d = new Date(iso);
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' à ' +
               d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }

    // ════════════════════════════════════════════════════════════════════════
    // 2. ÉTIQUETTES « rt- » : reprise des anciennes, puis aiguillage
    // ════════════════════════════════════════════════════════════════════════
    if (!LS) return;   // mémoire refusée : les pages le signalent déjà elles-mêmes

    function lireEtat() {
        try { return JSON.parse(lire(ETAT)) || null; } catch (e) { return null; }
    }
    function ecrireEtat(e) { ecrire(ETAT, JSON.stringify(e)); }

    var etat = lireEtat();
    if (!etat) {
        Object.keys(CORRESP).forEach(function (ancienne) {
            var v = lire(ancienne);
            if (v !== null && lire(CORRESP[ancienne]) === null) ecrire(CORRESP[ancienne], v);
        });
        etat = { revision: 0, sale: false, migreLe: new Date().toISOString() };
        ecrireEtat(etat);
    }

    // État de la séance : demarrage | ok | non-relie | verrouille | modifie-ailleurs |
    // autre-onglet | conflit | injoignable | erreur-ecriture
    var S = { statut: 'demarrage', detail: '', dir: null, cle: null, sel: null, machine: null,
              enCours: false, encore: false, minuteur: null, fichier: null };

    // Le prévisionnel est réécrit par le module 6 à chaque ouverture : seuls ces
    // champs constituent une vraie modification.
    var CHAMPS_PREV = ['soldeInitial', 'operationsSpecifiques', 'overridesTemporaires', 'suppressionsTemporaires'];
    function substancePrev(txt) {
        try {
            var o = JSON.parse(txt);
            if (!o || typeof o !== 'object') return String(txt);
            return JSON.stringify(CHAMPS_PREV.map(function (c) { return o[c] === undefined ? null : o[c]; }));
        } catch (e) { return String(txt); }
    }
    function estVraiChangement(cle, ancien, nouveau) {
        if (ancien === nouveau) return false;
        if (cle === 'rt-previsionnel' && ancien !== null && nouveau !== null)
            return substancePrev(ancien) !== substancePrev(nouveau);
        return true;
    }

    function poser(nouvelleCle, valeur) {   // valeur null = effacement
        var ancien = lire(nouvelleCle);
        var vrai = estVraiChangement(nouvelleCle, ancien, valeur);
        if (!vrai) {
            if (valeur === null) effacer(nouvelleCle); else ecrire(nouvelleCle, valeur);
            return;
        }
        if (nouvelleCle === LEGERE) {
            if (valeur === null) effacer(nouvelleCle); else ecrire(nouvelleCle, valeur);
            if (S.statut === 'ok') { marquerSale(); planifier(); }
            return;
        }
        // Refus : rien n'est écrit. Un seul message (le nôtre), puis rechargement de
        // la page pour que l'écran montre ce qui est réellement enregistré.
        if (S.statut !== 'ok') { refuser(); return; }
        if (valeur === null) effacer(nouvelleCle); else ecrire(nouvelleCle, valeur);
        marquerSale();
        planifier();
    }

    SP.getItem = function (k) {
        if (this === LS && CORRESP[k]) return origGet.call(LS, CORRESP[k]);
        return origGet.call(this, k);
    };
    SP.setItem = function (k, v) {
        if (this === LS && CORRESP[k]) return poser(CORRESP[k], String(v));
        return origSet.call(this, k, v);
    };
    SP.removeItem = function (k) {
        if (this === LS && CORRESP[k]) return poser(CORRESP[k], null);
        return origRem.call(this, k);
    };

    function marquerSale() { etat = lireEtat() || etat; etat.sale = true; ecrireEtat(etat); }

    var MOTIFS = {
        'demarrage': "la vérification du fichier de données n'était pas terminée.",
        'non-relie': "aucun fichier de données n'est relié à ce Mac (voir le bandeau en haut de la page).",
        'verrouille': "le mot de passe n'a pas été saisi (voir le bandeau en haut de la page).",
        'modifie-ailleurs': "le fichier a été modifié sur l'autre Mac depuis l'ouverture de cette page.",
        'autre-onglet': "les données ont été modifiées dans un autre onglet.",
        'conflit': "ce Mac et le fichier ont été modifiés chacun de leur côté : il faut d'abord choisir.",
        'copie-conflit': "iCloud a créé une copie de conflit du fichier : il faut d'abord choisir la bonne version.",
        'injoignable': "le fichier de données n'est pas joignable.",
        'erreur-ecriture': "le dernier enregistrement dans le fichier a échoué."
    };
    var refusEnCours = false;
    function refuser() {
        if (refusEnCours) return;
        refusEnCours = true;
        setTimeout(function () {
            alert('Rien n\'a été enregistré : ' + (MOTIFS[S.statut] || 'le fichier de données n\'est pas prêt.') +
                  '\n\nLa page va être rechargée pour afficher les données réellement enregistrées.');
            var dernier = Number(sessionStorage.getItem('rt-recharge-refus') || 0);
            if (Date.now() - dernier > 4000) {
                sessionStorage.setItem('rt-recharge-refus', String(Date.now()));
                location.reload();
            } else { refusEnCours = false; }
        }, 0);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Mémoire durable du navigateur (IndexedDB) : dossier, nom du Mac, clé de l'onglet
    // ════════════════════════════════════════════════════════════════════════
    function idb() {
        return new Promise(function (res, rej) {
            var r = indexedDB.open('rt-tab-dafdir', 1);
            r.onupgradeneeded = function (e) { e.target.result.createObjectStore('config'); };
            r.onsuccess = function (e) { res(e.target.result); };
            r.onerror = function () { rej(r.error); };
        });
    }
    function idbGet(k) {
        return idb().then(function (d) {
            return new Promise(function (res, rej) {
                var r = d.transaction('config').objectStore('config').get(k);
                r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
            });
        });
    }
    function idbSet(k, v) {
        return idb().then(function (d) {
            return new Promise(function (res, rej) {
                var tx = d.transaction('config', 'readwrite'); tx.objectStore('config').put(v, k);
                tx.oncomplete = function () { res(); }; tx.onerror = function () { rej(tx.error); };
            });
        });
    }
    function idbDel(k) {
        return idb().then(function (d) {
            return new Promise(function (res) {
                var tx = d.transaction('config', 'readwrite'); tx.objectStore('config').delete(k);
                tx.oncomplete = function () { res(); }; tx.onerror = function () { res(); };
            });
        });
    }
    function idOnglet() {
        var s = sessionStorage.getItem('rt-onglet');
        if (!s) { s = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('rt-onglet', s); }
        return s;
    }

    // ════════════════════════════════════════════════════════════════════════
    // Chiffrement
    // ════════════════════════════════════════════════════════════════════════
    function b64(buf) {
        var a = new Uint8Array(buf), out = '', CH = 0x8000;
        for (var i = 0; i < a.length; i += CH) out += String.fromCharCode.apply(null, a.subarray(i, i + CH));
        return btoa(out);
    }
    function unb64(str) {
        var bin = atob(str), a = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
        return a;
    }
    function deriver(mdp, sel) {
        return crypto.subtle.importKey('raw', new TextEncoder().encode(mdp), 'PBKDF2', false, ['deriveKey'])
            .then(function (base) {
                return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: sel, iterations: ITER, hash: 'SHA-256' },
                    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
            });
    }
    function dechiffrer(env, cle) {
        return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.cipher.iv) }, cle, unb64(env.payload))
            .then(function (clair) { return JSON.parse(new TextDecoder().decode(clair)); },
                  function () { return null; });
    }

    // ════════════════════════════════════════════════════════════════════════
    // Lecture du dossier
    // ════════════════════════════════════════════════════════════════════════
    // Renvoie { env } ou { manque:true } ou { fantome:true } ou { erreur }
    function lireEnveloppe() {
        var noms = [];
        var it = S.dir.entries();
        function suite() {
            return it.next().then(function (r) {
                if (r.done) return null;
                noms.push(r.value[0]); return suite();
            });
        }
        return suite().then(function () {
            var copies = noms.filter(estCopieConflit);
            if (noms.indexOf(FICHIER) < 0) {
                if (noms.indexOf('.' + FICHIER + '.icloud') >= 0) return { fantome: true, copies: copies };
                return { manque: true, copies: copies };
            }
            return S.dir.getFileHandle(FICHIER)
                .then(function (fh) { return fh.getFile(); })
                .then(function (f) { return f.text(); })
                .then(function (t) { return { env: JSON.parse(t), copies: copies }; });
        }).catch(function (e) { return { erreur: e, copies: [] }; });
    }

    // Copie de conflit : quand deux Mac écrivent avant qu'iCloud ait fait passer le
    // fichier de l'un à l'autre, iCloud garde une version et range l'autre à côté,
    // sous un nom du type « donnees_rocket_tower 2.json ».
    var BASE = FICHIER.replace(/\.json$/, '');
    function estCopieConflit(n) {
        if (n === FICHIER || n === '.' + FICHIER + '.icloud') return false;
        if (n.indexOf(BASE) === 0 && /\.json$/.test(n)) return true;
        if (n.indexOf('.' + BASE) === 0 && /\.json\.icloud$/.test(n)) return true;
        return false;
    }

    function donneesDeCeMac() {
        var d = {};
        NOUVELLES.forEach(function (k) { var v = lire(k); if (v !== null) d[k] = v; });
        return d;
    }
    function appliquer(data) {
        NOUVELLES.forEach(function (k) {
            if (data && Object.prototype.hasOwnProperty.call(data, k)) ecrire(k, data[k]); else effacer(k);
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    // Écriture du fichier
    // ════════════════════════════════════════════════════════════════════════
    function planifier() {
        clearTimeout(S.minuteur);
        S.minuteur = setTimeout(function () { S.minuteur = null; ecrireMaintenant(); }, 300);
        majBandeau();
    }

    function ecrireCopie(nomFichier, texte) {
        return S.dir.getDirectoryHandle(HISTO, { create: true }).then(function (hd) {
            return hd.getFileHandle(nomFichier, { create: true }).then(function (h) {
                return h.createWritable().then(function (w) {
                    return w.write(texte).then(function () { return w.close(); });
                });
            }).then(function () { return hd; });
        });
    }
    function rotation(hd) {
        var noms = [], it = hd.entries();
        function suite() {
            return it.next().then(function (r) {
                if (r.done) return null;
                var n = r.value[0];
                if (/^donnees_rocket_tower_\d{8}-\d{6}\.json$/.test(n)) noms.push(n);
                return suite();
            });
        }
        return suite().then(function () {
            noms.sort();
            var p = Promise.resolve();
            while (noms.length > GARDER) { (function (n) { p = p.then(function () { return hd.removeEntry(n); }); })(noms.shift()); }
            return p;
        });
    }

    // forcer : réécrit même si le fichier porte une révision différente (après arbitrage)
    function ecrireMaintenant(forcer) {
        if (S.statut !== 'ok' && !forcer) return Promise.resolve(false);
        if (!S.dir || !S.cle) return Promise.resolve(false);
        if (S.enCours) { S.encore = true; return Promise.resolve(false); }
        S.enCours = true;
        etat = lireEtat() || etat;
        return lireEnveloppe().then(function (r) {
            if (r.erreur || r.fantome) throw r.erreur || new Error('fichier non téléchargé sur ce Mac');
            if (r.copies && r.copies.length && !forcer) { passer('copie-conflit'); return false; }
            if (r.env && !forcer && Number(r.env.revision) !== Number(etat.revision)) {
                S.fichier = r.env;
                passer(Number(r.env.revision) > Number(etat.revision) ? 'modifie-ailleurs' : 'conflit');
                return false;
            }
            var precedent = r.env ? JSON.stringify(r.env) : null;
            var rev = Math.max(Number(etat.revision) || 0, r.env ? Number(r.env.revision) || 0 : 0) + 1;
            var le = new Date().toISOString();
            // Le voyant « Sauvegarder » de la page d'accueil suit désormais le dernier
            // enregistrement dans le fichier iCloud, qui est la vraie sauvegarde.
            ecrire(LEGERE, le);
            var iv = crypto.getRandomValues(new Uint8Array(12));
            var corps = JSON.stringify({ revision: rev, savedAt: le, device: S.machine, data: donneesDeCeMac() });
            return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, S.cle, new TextEncoder().encode(corps))
                .then(function (ct) {
                    var texte = JSON.stringify({
                        format: 'rt-tab-dafdir-chiffre', version: 1,
                        kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: ITER, salt: b64(S.sel) },
                        cipher: { name: 'AES-GCM', iv: b64(iv) },
                        revision: rev, savedAt: le, device: S.machine, payload: b64(ct)
                    });
                    // Après un arbitrage, l'ancienne version du fichier est gardée à part.
                    var avant = (forcer && precedent)
                        ? ecrireCopie('avant_arbitrage_' + horodatage() + '.json', precedent)
                        : Promise.resolve();
                    return avant.then(function () {
                        return S.dir.getFileHandle(FICHIER, { create: true });
                    }).then(function (fh) {
                        return fh.createWritable().then(function (w) {
                            return w.write(texte).then(function () { return w.close(); });
                        });
                    }).then(function () {
                        etat = { revision: rev, sale: false, migreLe: etat.migreLe, enregistreLe: le, par: S.machine };
                        ecrireEtat(etat);
                        S.fichier = { revision: rev, savedAt: le, device: S.machine };
                        S.statut = 'ok'; S.detail = '';
                        majBandeau();
                        if (!sessionStorage.getItem('rt-histo')) {
                            return ecrireCopie('donnees_rocket_tower_' + horodatage() + '.json', texte)
                                .then(function (hd) { sessionStorage.setItem('rt-histo', '1'); return rotation(hd); })
                                .catch(function () { /* la copie d'historique n'est pas bloquante */ });
                        }
                    }).then(function () { return true; });
                });
        }).catch(function (e) {
            passer('erreur-ecriture', (e && e.message) ? e.message : String(e));
            return false;
        }).then(function (ok) {
            S.enCours = false;
            majBandeau();
            if (S.encore) { S.encore = false; ecrireMaintenant(); }
            return ok;
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    // Ouverture : vérification du fichier
    // ════════════════════════════════════════════════════════════════════════
    function verifier(corpsDechiffre) {
        return lireEnveloppe().then(function (r) {
            if (r.fantome) return passer('injoignable', "Le fichier de données est dans le dossier mais n'est pas téléchargé sur ce Mac. " +
                "Dans le Finder, faites un clic droit sur le dossier puis « Conserver le téléchargement », puis cliquez sur « Réessayer ».");
            if (r.manque) return passer('injoignable', "Le dossier relié ne contient pas « " + FICHIER + " ». " +
                "Il a peut-être été déplacé ou renommé. Vérifiez dans le Finder, ou désignez à nouveau le bon dossier.");
            if (r.erreur) return passer('injoignable', "Le dossier relié n'est pas lisible (" + (r.erreur.message || r.erreur) + "). " +
                "Si le fichier vient d'être modifié sur l'autre Mac, iCloud est peut-être encore en train de le télécharger : réessayez dans un instant.");
            var env = r.env;
            S.fichier = env;
            if (r.copies && r.copies.length) return passer('copie-conflit');
            etat = lireEtat() || etat;
            var revF = Number(env.revision) || 0, revM = Number(etat.revision) || 0;

            if (revF === revM) {
                S.statut = 'ok'; S.detail = ''; majBandeau();
                if (etat.sale) return ecrireMaintenant();
                return;
            }
            if (revF > revM && !etat.sale) {
                // Le fichier est plus récent : on le recopie ici et on recharge la page.
                var p = corpsDechiffre ? Promise.resolve(corpsDechiffre) : dechiffrer(env, S.cle);
                return p.then(function (corps) {
                    if (!corps) { oublierCle(); return passer('verrouille'); }
                    // Boucle véritable seulement si la même révision est rechargée deux fois de suite.
                    var dernier = {};
                    try { dernier = JSON.parse(sessionStorage.getItem('rt-recharge') || '{}') || {}; } catch (e) { }
                    if (dernier.rev === revF && Date.now() - (dernier.t || 0) < 10000)
                        return passer('injoignable', 'Rechargement en boucle évité. Fermez puis rouvrez l\'onglet.');
                    appliquer(corps.data);
                    etat = { revision: Number(corps.revision) || revF, sale: false, migreLe: etat.migreLe,
                             enregistreLe: corps.savedAt, par: corps.device };
                    ecrireEtat(etat);
                    sessionStorage.setItem('rt-recharge', JSON.stringify({ rev: revF, t: Date.now() }));
                    location.reload();
                });
            }
            // Ce Mac a des modifications non enregistrées et le fichier a changé, ou le fichier est plus ancien.
            return passer('conflit');
        });
    }

    function oublierCle() { S.cle = null; return idbDel('cle-' + idOnglet()); }

    function demarrer() {
        creerBandeau();
        Promise.all([idbGet('dossier'), idbGet('machine'), idbGet('cle-' + idOnglet())]).then(function (v) {
            S.dir = v[0] || null; S.machine = v[1] || null;
            if (v[2]) { S.cle = v[2].cle; S.sel = unb64(v[2].sel); }
            if (!S.dir) return passer('non-relie');
            return S.dir.queryPermission({ mode: 'readwrite' }).then(function (perm) {
                if (perm !== 'granted' || !S.cle) return passer('verrouille');
                return verifier();
            });
        }).catch(function (e) {
            passer('injoignable', 'Erreur à l\'ouverture : ' + (e && e.message ? e.message : e));
        }).then(function () {
            if (S.statut === 'verrouille' && !sessionStorage.getItem('rt-mdp-decline')) ouvrirAvecMotDePasse();
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    // Actions de l'utilisatrice
    // ════════════════════════════════════════════════════════════════════════
    function ouvrirAvecMotDePasse() {
        dialogue({
            titre: 'Ouvrir les données du tableau de bord',
            texte: '<p>Saisissez le mot de passe du fichier de données.</p>',
            champs: [{ id: 'mdp', type: 'password', label: 'Mot de passe' }],
            boutons: [{ id: 'ok', label: 'Ouvrir', principal: true }, { id: 'non', label: 'Consulter sans modifier' }]
        }, function (rep, aide) {
            if (rep.bouton !== 'ok') return true;
            if (!rep.valeurs.mdp) { aide('Saisissez le mot de passe.'); return false; }
            aide('Ouverture…');
            return S.dir.requestPermission({ mode: 'readwrite' }).then(function (p) {
                if (p !== 'granted') { aide('Chrome n\'a pas reçu l\'autorisation d\'accéder au dossier. Cliquez à nouveau sur « Ouvrir » et acceptez.'); return false; }
                return lireEnveloppe().then(function (r) {
                    if (!r.env) { aide('Le fichier de données n\'est pas lisible dans le dossier relié.'); return false; }
                    var sel = unb64(r.env.kdf.salt);
                    return deriver(rep.valeurs.mdp, sel).then(function (cle) {
                        return dechiffrer(r.env, cle).then(function (corps) {
                            if (!corps) { aide('Mot de passe incorrect.'); return false; }
                            S.cle = cle; S.sel = sel;
                            return idbSet('cle-' + idOnglet(), { cle: cle, sel: b64(sel), le: Date.now() })
                                .then(function () { return verifier(corps); })
                                .then(function () { return true; });
                        });
                    });
                });
            });
        }).then(function (rep) {
            if (rep && rep.bouton !== 'ok') sessionStorage.setItem('rt-mdp-decline', '1');
        });
    }

    function compter(data) {
        var n = function (k) { try { var a = JSON.parse(data[k] || '[]'); return Array.isArray(a) ? a.length : 0; } catch (e) { return 0; } };
        var solde = null;
        try { var p = JSON.parse(data['rt-previsionnel'] || 'null'); if (p) solde = p.soldeInitial; } catch (e) { }
        return { recettes: n('rt-recettes'), charges: n('rt-charges-recurrentes'), periodiques: n('rt-charges-periodiques'), solde: solde };
    }
    function resume(c) {
        return c.recettes + ' recettes, ' + c.charges + ' charges récurrentes, ' + c.periodiques + ' charges périodiques' +
            (c.solde != null ? ', solde initial du prévisionnel ' + Number(c.solde).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €' : '');
    }

    function demanderMachine() {
        if (S.machine) return Promise.resolve(S.machine);
        return dialogue({
            titre: 'Nom de ce Mac',
            texte: '<p>Ce nom apparaîtra dans le bandeau pour dire quel Mac a enregistré en dernier. Par exemple : iMac, ou MacBook.</p>',
            champs: [{ id: 'nom', type: 'text', label: 'Nom de ce Mac' }],
            boutons: [{ id: 'ok', label: 'Valider', principal: true }, { id: 'non', label: 'Annuler' }]
        }, function (rep, aide) {
            if (rep.bouton === 'ok' && !String(rep.valeurs.nom || '').trim()) { aide('Indiquez un nom.'); return false; }
            return true;
        }).then(function (rep) {
            if (rep.bouton !== 'ok') return null;
            S.machine = String(rep.valeurs.nom).trim();
            return idbSet('machine', S.machine).then(function () { return S.machine; });
        });
    }

    function choisirDossier() {
        return window.showDirectoryPicker({ mode: 'readwrite', id: 'rt-tab-dafdir' })
            .catch(function (e) { if (e.name === 'AbortError') return null; throw e; });
    }

    function lireExport(fichier) {
        return fichier.text().then(function (t) {
            var d = JSON.parse(t);
            if (!d || !Array.isArray(d.recettes) || !Array.isArray(d.chargesRecurrentes)) throw new Error('Ce fichier n\'est pas un export du tableau de bord.');
            var data = {};
            data['rt-recettes'] = JSON.stringify(d.recettes);
            data['rt-charges-recurrentes'] = JSON.stringify(d.chargesRecurrentes);
            data['rt-charges-periodiques'] = JSON.stringify(d.chargesPeriodiques || []);
            if (d.previsionnel) data['rt-previsionnel'] = JSON.stringify(d.previsionnel);
            if (Array.isArray(d.typesRecettes) && d.typesRecettes.length) data['rt-types-recettes'] = JSON.stringify(d.typesRecettes);
            var seuils = lire('rt-seuils-personnalises');
            if (seuils !== null) data['rt-seuils-personnalises'] = seuils;
            return { data: data, date: d.dateExport };
        });
    }

    function creerFichier() {
        var ici = donneesDeCeMac();
        var source = null;   // { data, libelle }
        dialogue({
            titre: 'Créer le fichier de données',
            texte: '<p>Le fichier sera créé avec l\'une de ces deux sources. Choisissez la plus récente.</p>' +
                   '<p><b>Données actuellement dans Chrome sur ce Mac</b> : ' + esc(resume(compter(ici))) + '.</p>' +
                   '<p>Ou bien un <b>fichier d\'export</b> (rocket-tower-export-….json).</p>',
            fichier: true,
            boutons: [{ id: 'ici', label: 'Avec les données de ce Mac', principal: true },
                      { id: 'export', label: 'Avec un fichier d\'export…' }, { id: 'non', label: 'Annuler' }]
        }, function (rep, aide) {
            if (rep.bouton === 'ici') { source = { data: ici, libelle: 'les données de ce Mac' }; return true; }
            if (rep.bouton === 'export') {
                if (!rep.fichier) { aide('Cliquez d\'abord sur « Choisir un fichier », puis à nouveau sur ce bouton.'); return false; }
                return lireExport(rep.fichier).then(function (x) {
                    source = { data: x.data, libelle: 'l\'export ' + rep.fichier.name };
                    return true;
                }, function (e) { aide(e.message); return false; });
            }
            return true;
        }).then(function (rep) {
            if (!source) return;
            return dialogue({
                titre: 'Vérification',
                texte: '<p>Le fichier de données va contenir, d\'après ' + esc(source.libelle) + ' :</p><p><b>' +
                       esc(resume(compter(source.data))) + '</b>.</p><p>Choisissez ensuite le dossier iCloud où le ranger.</p>',
                boutons: [{ id: 'ok', label: 'Choisir le dossier', principal: true }, { id: 'non', label: 'Annuler' }]
            }).then(function (r2) {
                if (r2.bouton !== 'ok') return;
                return choisirDossier().then(function (dir) {
                    if (!dir) return;
                    S.dir = dir;
                    return lireEnveloppe().then(function (r) {
                        if (r.env || r.fantome) {
                            return dialogue({ titre: 'Fichier déjà présent', texte: '<p>Ce dossier contient déjà un fichier de données. ' +
                                'Utilisez plutôt « Relier un fichier existant », pour ne pas en créer un second.</p>',
                                boutons: [{ id: 'ok', label: 'Compris', principal: true }] })
                                .then(function () { S.dir = null; });
                        }
                        return demanderMachine().then(function (m) {
                            if (!m) { S.dir = null; return; }
                            return dialogue({
                                titre: 'Mot de passe du fichier',
                                texte: '<p>Ce mot de passe protège le fichier. Il n\'est enregistré nulle part et ne peut pas être retrouvé : ' +
                                       'notez-le maintenant. Huit caractères au minimum.</p>',
                                champs: [{ id: 'a', type: 'password', label: 'Mot de passe' }, { id: 'b', type: 'password', label: 'Le même, une seconde fois' }],
                                boutons: [{ id: 'ok', label: 'Créer le fichier', principal: true }, { id: 'non', label: 'Annuler' }]
                            }, function (rp, aide) {
                                if (rp.bouton !== 'ok') return true;
                                if ((rp.valeurs.a || '').length < 8) { aide('Huit caractères au minimum.'); return false; }
                                if (rp.valeurs.a !== rp.valeurs.b) { aide('Les deux saisies diffèrent.'); return false; }
                                aide('Création…');
                                var sel = crypto.getRandomValues(new Uint8Array(16));
                                return deriver(rp.valeurs.a, sel).then(function (cle) {
                                    S.cle = cle; S.sel = sel;
                                    appliquer(source.data);
                                    etat = { revision: 0, sale: true, migreLe: (lireEtat() || {}).migreLe };
                                    ecrireEtat(etat);
                                    return Promise.all([idbSet('dossier', dir), idbSet('cle-' + idOnglet(), { cle: cle, sel: b64(sel), le: Date.now() })]);
                                }).then(function () { return ecrireMaintenant(true); })
                                  .then(function (ok) {
                                      if (!ok) { aide('L\'écriture a échoué : ' + (S.detail || 'raison inconnue')); return false; }
                                      location.reload();
                                      return true;
                                  });
                            });
                        });
                    });
                });
            });
        });
    }

    function relierFichier() {
        choisirDossier().then(function (dir) {
            if (!dir) return;
            S.dir = dir;
            return lireEnveloppe().then(function (r) {
                if (!r.env) {
                    return dialogue({ titre: 'Aucun fichier de données', texte: '<p>' + (r.fantome
                        ? 'Le fichier est dans ce dossier mais n\'est pas téléchargé sur ce Mac. Dans le Finder : clic droit sur le dossier, « Conserver le téléchargement », puis recommencez.'
                        : 'Ce dossier ne contient pas « ' + FICHIER + ' ». Choisissez le dossier qui le contient.') + '</p>',
                        boutons: [{ id: 'ok', label: 'Compris', principal: true }] }).then(function () { S.dir = null; });
                }
                var env = r.env;
                return demanderMachine().then(function (m) {
                    if (!m) { S.dir = null; return; }
                    var corpsLu = null;
                    return dialogue({
                        titre: 'Relier le fichier de données',
                        texte: '<p>Fichier enregistré le ' + esc(quand(env.savedAt)) + ' sur ' + esc(env.device || '?') + '.</p>',
                        champs: [{ id: 'mdp', type: 'password', label: 'Mot de passe du fichier' }],
                        boutons: [{ id: 'ok', label: 'Ouvrir', principal: true }, { id: 'non', label: 'Annuler' }]
                    }, function (rp, aide) {
                        if (rp.bouton !== 'ok') return true;
                        aide('Ouverture…');
                        var sel = unb64(env.kdf.salt);
                        return deriver(rp.valeurs.mdp || '', sel).then(function (cle) {
                            return dechiffrer(env, cle).then(function (corps) {
                                if (!corps) { aide('Mot de passe incorrect.'); return false; }
                                S.cle = cle; S.sel = sel; corpsLu = corps; return true;
                            });
                        });
                    }).then(function () {
                        if (!corpsLu) { S.dir = null; return; }
                        var ici = donneesDeCeMac();
                        var aRemplacer = Object.keys(ici).some(function (k) { return k !== LEGERE && corpsLu.data[k] !== ici[k]; });
                        var confirmer = aRemplacer ? dialogue({
                            titre: 'Remplacer les données de ce Mac',
                            texte: '<p>Les données actuellement dans Chrome sur ce Mac (' + esc(resume(compter(ici))) + ') ' +
                                   'vont être remplacées par celles du fichier (' + esc(resume(compter(corpsLu.data))) + ').</p>' +
                                   '<p>Une copie de sécurité de ce Mac est gardée dans Chrome. Vous pouvez aussi l\'exporter avant.</p>',
                            boutons: [{ id: 'ok', label: 'Remplacer', principal: true }, { id: 'exp', label: 'Exporter d\'abord les données de ce Mac' }, { id: 'non', label: 'Annuler' }]
                        }, function (rp) {
                            if (rp.bouton === 'exp') { exporterCeMac(); return false; }
                            return true;
                        }) : Promise.resolve({ bouton: 'ok' });
                        return confirmer.then(function (rc) {
                            if (rc.bouton !== 'ok') { S.dir = null; S.cle = null; return; }
                            if (aRemplacer) ecrire('rt-copie-avant-liaison', JSON.stringify({ le: new Date().toISOString(), data: ici }));
                            appliquer(corpsLu.data);
                            etat = { revision: Number(corpsLu.revision) || 0, sale: false, migreLe: (lireEtat() || {}).migreLe,
                                     enregistreLe: corpsLu.savedAt, par: corpsLu.device };
                            ecrireEtat(etat);
                            return Promise.all([idbSet('dossier', dir), idbSet('cle-' + idOnglet(), { cle: S.cle, sel: b64(S.sel), le: Date.now() })])
                                .then(function () { location.reload(); });
                        });
                    });
                });
            });
        }).catch(function (e) { alert('Le dossier n\'a pas pu être relié : ' + (e && e.message ? e.message : e)); });
    }

    function exporterCeMac() {
        var g = function (k) { try { return JSON.parse(lire(k) || 'null'); } catch (e) { return null; } };
        var d = {
            version: '2.0', dateExport: new Date().toISOString(), systeme: 'Rocket Tower',
            recettes: g('rt-recettes') || [], chargesRecurrentes: g('rt-charges-recurrentes') || [],
            chargesPeriodiques: g('rt-charges-periodiques') || [], previsionnel: g('rt-previsionnel'),
            typesRecettes: g('rt-types-recettes')
        };
        telecharger('rocket-tower-export-' + jour() + '_' + (S.machine || 'ce-mac') + '.json', JSON.stringify(d, null, 2));
    }

    // ─── Arbitrage ─────────────────────────────────────────────────────────
    function differences(ici, fic, nomIci, nomFic) {
        nomIci = nomIci || 'sur ce Mac'; nomFic = nomFic || 'dans le fichier';
        var lignes = [];
        var libelle = function (x) { return x.client || x.fournisseur || x.libelle || x.element || ('fiche ' + x.id); };
        [['rt-recettes', 'Recettes'], ['rt-charges-recurrentes', 'Charges récurrentes'], ['rt-charges-periodiques', 'Charges périodiques']].forEach(function (c) {
            var A, B;
            try { A = JSON.parse(ici[c[0]] || '[]'); B = JSON.parse(fic[c[0]] || '[]'); } catch (e) { return; }
            var ma = {}, mb = {};
            A.forEach(function (x) { ma[String(x.id)] = x; }); B.forEach(function (x) { mb[String(x.id)] = x; });
            var seulIci = [], seulFic = [], modif = [];
            Object.keys(ma).forEach(function (k) {
                if (!mb[k]) seulIci.push(libelle(ma[k]));
                else if (JSON.stringify(ma[k]) !== JSON.stringify(mb[k])) modif.push(libelle(ma[k]));
            });
            Object.keys(mb).forEach(function (k) { if (!ma[k]) seulFic.push(libelle(mb[k])); });
            var l = function (t, arr) { return arr.length ? '<li>' + t + ' (' + arr.length + ') : ' + esc(arr.slice(0, 8).join(', ')) + (arr.length > 8 ? '…' : '') + '</li>' : ''; };
            var h = l('seulement ' + nomIci, seulIci) + l('seulement ' + nomFic, seulFic) + l('différentes', modif);
            if (h) lignes.push('<p style="margin:10px 0 4px;"><b>' + c[1] + '</b></p><ul style="margin:0;padding-left:22px;">' + h + '</ul>');
        });
        if (substancePrev(ici['rt-previsionnel'] || 'null') !== substancePrev(fic['rt-previsionnel'] || 'null'))
            lignes.push('<p style="margin:10px 0 4px;"><b>Prévisionnel</b> : solde initial ou opérations spécifiques différents.</p>');
        if ((ici['rt-types-recettes'] || '') !== (fic['rt-types-recettes'] || '')) lignes.push('<p style="margin:10px 0 4px;"><b>Types de recettes</b> différents.</p>');
        if ((ici['rt-seuils-personnalises'] || '') !== (fic['rt-seuils-personnalises'] || '')) lignes.push('<p style="margin:10px 0 4px;"><b>Seuils personnalisés</b> différents.</p>');
        return lignes.length ? lignes.join('') : '<p>Aucune différence de contenu.</p>';
    }

    function arbitrer() {
        if (!S.cle) return ouvrirAvecMotDePasse();
        lireEnveloppe().then(function (r) {
            if (!r.env) return verifier();
            return dechiffrer(r.env, S.cle).then(function (corps) {
                if (!corps) { oublierCle(); passer('verrouille'); return ouvrirAvecMotDePasse(); }
                var ici = donneesDeCeMac();
                etat = lireEtat() || etat;
                var plusAncien = Number(r.env.revision) < Number(etat.revision);
                return dialogue({
                    titre: 'Deux versions différentes',
                    texte: (plusAncien
                        ? '<p>Le fichier (enregistré le ' + esc(quand(r.env.savedAt)) + ' sur ' + esc(r.env.device) + ') est <b>plus ancien</b> que ce que ce Mac a déjà vu. ' +
                          'iCloud n\'a peut-être pas fini de le mettre à jour : dans le doute, fermez cette fenêtre, attendez une minute et rechargez la page.</p>'
                        : '<p>Ce Mac contient des modifications qui ne sont pas dans le fichier, <b>et le fichier a été modifié ailleurs</b> ' +
                          '(le ' + esc(quand(r.env.savedAt)) + ' sur ' + esc(r.env.device) + ').</p>') +
                        '<p>Voici ce qui distingue les deux versions :</p>' + differences(ici, corps.data) +
                        '<p style="margin-top:14px;">Quelle version garder ? L\'autre sera écartée ; une copie de sécurité est conservée dans tous les cas.</p>',
                    boutons: [{ id: 'fichier', label: 'Garder la version du fichier', principal: true },
                              { id: 'mac', label: 'Garder la version de ce Mac' },
                              { id: 'exp', label: 'Exporter d\'abord la version de ce Mac' },
                              { id: 'non', label: 'Décider plus tard' }]
                }, function (rp) {
                    if (rp.bouton === 'exp') { exporterCeMac(); return false; }
                    if (rp.bouton === 'fichier' && !confirm('Remplacer les données de ce Mac par celles du fichier ?')) return false;
                    if (rp.bouton === 'mac' && !confirm('Remplacer le fichier par les données de ce Mac ?\n\nL\'ancienne version du fichier sera gardée dans « historique ».')) return false;
                    return true;
                }).then(function (rp) {
                    if (rp.bouton === 'fichier') {
                        ecrire('rt-copie-avant-arbitrage', JSON.stringify({ le: new Date().toISOString(), data: ici }));
                        appliquer(corps.data);
                        ecrireEtat({ revision: Number(corps.revision) || 0, sale: false, migreLe: etat.migreLe, enregistreLe: corps.savedAt, par: corps.device });
                        location.reload();
                    } else if (rp.bouton === 'mac') {
                        return ecrireMaintenant(true).then(function (ok) { if (ok) location.reload(); });
                    }
                });
            });
        });
    }

    function lireFichierNomme(nom) {
        return S.dir.getFileHandle(nom).then(function (fh) { return fh.getFile(); })
            .then(function (f) { return f.text(); });
    }
    function rangerCopie(nom, texte) {
        return ecrireCopie('copie_conflit_ecartee_' + horodatage() + '.json', texte)
            .then(function () { return S.dir.removeEntry(nom); });
    }

    function arbitrerCopie() {
        if (!S.cle) return ouvrirAvecMotDePasse();
        lireEnveloppe().then(function (r) {
            if (!r.copies || !r.copies.length) return verifier();
            var nom = r.copies[0];
            if (nom.charAt(0) === '.') {
                return dialogue({ titre: 'Seconde version pas encore téléchargée',
                    texte: '<p>iCloud a créé une seconde version du fichier, mais elle n\'est pas encore téléchargée sur ce Mac. ' +
                           'Dans le Finder : clic droit sur le dossier des données, « Conserver le téléchargement », puis rechargez la page.</p>',
                    boutons: [{ id: 'ok', label: 'Compris', principal: true }] });
            }
            if (!r.env) return passer('injoignable', 'Le fichier principal est absent du dossier.');
            return lireFichierNomme(nom).then(function (texteCopie) {
                var envCopie = JSON.parse(texteCopie);
                return Promise.all([dechiffrer(r.env, S.cle), dechiffrer(envCopie, S.cle)]).then(function (c) {
                    var principal = c[0], copie = c[1];
                    if (!principal || !copie) { oublierCle(); passer('verrouille'); return ouvrirAvecMotDePasse(); }
                    var desc = function (e) { return 'enregistrée le ' + esc(quand(e.savedAt)) + ' sur ' + esc(e.device || '?'); };
                    return dialogue({
                        titre: 'Deux versions du fichier de données',
                        texte: '<p>Les deux Mac ont enregistré presque en même temps, avant qu\'iCloud ait fait passer le fichier de l\'un à l\'autre. ' +
                               'iCloud a donc gardé deux versions :</p>' +
                               '<p><b>Version A</b> — ' + desc(r.env) + '.<br><b>Version B</b> — ' + desc(envCopie) + ' (« ' + esc(nom) + ' »).</p>' +
                               '<p>Ce qui les distingue :</p>' + differences(principal.data, copie.data, 'dans la version A', 'dans la version B') +
                               '<p style="margin-top:14px;">Quelle version garder ? L\'autre est rangée dans « historique », rien n\'est détruit. ' +
                               'Si chacune contient une saisie utile, gardez la plus complète, puis refaites l\'autre saisie à la main.</p>',
                        boutons: [{ id: 'A', label: 'Garder la version A', principal: true },
                                  { id: 'B', label: 'Garder la version B' },
                                  { id: 'non', label: 'Décider plus tard' }]
                    }, function (rp) {
                        if (rp.bouton === 'A' && !confirm('Garder la version A (' + quand(r.env.savedAt) + ', ' + (r.env.device || '?') + ') ?')) return false;
                        if (rp.bouton === 'B' && !confirm('Garder la version B (' + quand(envCopie.savedAt) + ', ' + (envCopie.device || '?') + ') ?')) return false;
                        return true;
                    }).then(function (rp) {
                        if (rp.bouton !== 'A' && rp.bouton !== 'B') return;
                        var garde = rp.bouton === 'A' ? principal : copie;
                        ecrire('rt-copie-avant-arbitrage', JSON.stringify({ le: new Date().toISOString(), data: donneesDeCeMac() }));
                        appliquer(garde.data);
                        // Nouvelle révision au-dessus des deux : l'autre Mac verra qu'il doit recharger.
                        etat = lireEtat() || etat;
                        etat.revision = Math.max(Number(r.env.revision) || 0, Number(envCopie.revision) || 0);
                        etat.sale = true; ecrireEtat(etat);
                        return rangerCopie(nom, texteCopie).then(function () {
                            return ecrireMaintenant(true);
                        }).then(function (ok) {
                            if (ok) location.reload();
                            else alert('L\'enregistrement a échoué : ' + (S.detail || 'raison inconnue') + '. Rechargez la page et recommencez.');
                        });
                    });
                });
            });
        }).catch(function (e) { alert('Erreur : ' + (e && e.message ? e.message : e)); });
    }

    // ════════════════════════════════════════════════════════════════════════
    // Surveillance : retour sur l'onglet, autre onglet, départ de la page
    // ════════════════════════════════════════════════════════════════════════
    // Relecture de la révision du fichier : au retour sur l'onglet, au clic dans la
    // fenêtre, et toutes les 30 secondes tant que la page est affichée.
    var derniereRelecture = 0;
    function relireRevision() {
        if (!S.dir || S.statut !== 'ok' || S.enCours || S.minuteur) return;
        if (Date.now() - derniereRelecture < 3000) return;
        derniereRelecture = Date.now();
        S.dir.queryPermission({ mode: 'readwrite' }).then(function (p) {
            if (p !== 'granted') return;
            return lireEnveloppe().then(function (r) {
                if (S.enCours || S.statut !== 'ok') return;
                if (r.copies && r.copies.length) return passer('copie-conflit');
                etat = lireEtat() || etat;
                if (r.env && Number(r.env.revision) > Number(etat.revision)) { S.fichier = r.env; passer('modifie-ailleurs'); }
            });
        }).catch(function () { });
    }
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
            if (S.minuteur) { clearTimeout(S.minuteur); S.minuteur = null; ecrireMaintenant(); }
            return;
        }
        relireRevision();
    });
    window.addEventListener('focus', relireRevision);
    document.addEventListener('pointerdown', relireRevision, true);
    setInterval(function () { if (document.visibilityState === 'visible') relireRevision(); }, 30000);
    window.addEventListener('pagehide', function () {
        if (S.minuteur) { clearTimeout(S.minuteur); S.minuteur = null; ecrireMaintenant(); }
    });
    window.addEventListener('storage', function (e) {
        if (e.storageArea === LS && e.key && NOUVELLES.indexOf(e.key) >= 0 && S.statut === 'ok') passer('autre-onglet');
    });

    // ════════════════════════════════════════════════════════════════════════
    // Bandeau d'état
    // ════════════════════════════════════════════════════════════════════════
    var bandeau = null;
    function creerBandeau() {
        if (bandeau) return;
        var st = document.createElement('style');
        st.textContent =
            '#rtBandeau{position:sticky;top:0;z-index:2147480000;margin:-20px -20px 16px;padding:10px 20px;' +
            'font:18px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:#fff;' +
            'display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;box-shadow:0 2px 8px rgba(0,0,0,.15);}' +
            '#rtBandeau .rtL1{font-weight:600;flex:1 1 420px;}' +
            '#rtBandeau .rtL2{flex:1 1 100%;font-size:18px;opacity:.9;font-style:italic;}' +
            '#rtBandeau button{font:600 18px/1.2 inherit;font-family:inherit;padding:7px 14px;border-radius:7px;border:1px solid rgba(255,255,255,.7);' +
            'background:rgba(255,255,255,.15);color:#fff;cursor:pointer;}' +
            '#rtBandeau button:hover{background:rgba(255,255,255,.28);}' +
            '#rtBandeau[data-c=vert]{background:#166534;}#rtBandeau[data-c=gris]{background:#4b5563;}' +
            '#rtBandeau[data-c=orange]{background:#b45309;}#rtBandeau[data-c=rouge]{background:#b91c1c;}' +
            '@media print{#rtBandeau{display:none!important;}}' +
            '.rtDlg{border:none;border-radius:14px;padding:0;max-width:640px;width:calc(100% - 32px);box-shadow:0 20px 60px rgba(0,0,0,.35);' +
            'position:fixed;inset:0;margin:auto;height:fit-content;max-height:90vh;overflow:auto;}' +
            '.rtDlg::backdrop{background:rgba(17,24,39,.55);}' +
            '.rtDlg .rtIn{padding:26px 28px;font:18px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:#1f2933;}' +
            '.rtDlg h2{margin:0 0 12px;font-size:22px;color:#111827;}.rtDlg p{margin:0 0 10px;}' +
            '.rtDlg label{display:block;margin:12px 0 4px;font-weight:600;}' +
            '.rtDlg input[type=password],.rtDlg input[type=text]{width:100%;box-sizing:border-box;font-size:18px;padding:10px 12px;border:2px solid #d1d5db;border-radius:8px;}' +
            '.rtDlg input[type=file]{font-size:18px;margin:6px 0;}' +
            '.rtDlg .rtAide{min-height:1.5em;color:#b91c1c;margin-top:10px;}' +
            '.rtDlg .rtBt{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px;}' +
            '.rtDlg .rtBt button{font-size:18px;padding:10px 16px;border-radius:8px;border:1px solid #9ca3af;background:#fff;color:#1f2933;cursor:pointer;}' +
            '.rtDlg .rtBt button.rtP{background:#1d4ed8;border-color:#1d4ed8;color:#fff;}' +
            '.rtDlg ul{font-size:18px;}';
        document.head.appendChild(st);
        bandeau = document.createElement('div');
        bandeau.id = 'rtBandeau';
        // Le bandeau s'étend d'un bord à l'autre quelle que soit la marge de la page.
        try {
            var cs = getComputedStyle(document.body);
            var pg = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.marginLeft) || 0),
                pd = (parseFloat(cs.paddingRight) || 0) + (parseFloat(cs.marginRight) || 0),
                ph = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.marginTop) || 0);
            bandeau.style.margin = (-ph) + 'px ' + (-pd) + 'px 16px ' + (-pg) + 'px';
        } catch (e) { }
        document.body.insertBefore(bandeau, document.body.firstChild);
        majBandeau();
    }

    function passer(statut, detail) {
        S.statut = statut; S.detail = detail || '';
        majBandeau();
    }

    function majBandeau() {
        if (!bandeau) return;
        var f = S.fichier, e = lireEtat() || etat;
        var t = '', c = 'gris', bt = [];
        switch (S.statut) {
            case 'demarrage': t = 'Vérification du fichier de données…'; break;
            case 'ok':
                c = 'vert';
                if (S.enCours || S.minuteur || e.sale) t = 'Enregistrement dans le fichier en cours…';
                else t = 'Données à jour — enregistrées le ' + quand(e.enregistreLe || (f && f.savedAt)) +
                         ' sur ' + (e.par || (f && f.device) || '?') + ' (révision ' + e.revision + ')';
                break;
            case 'non-relie':
                c = 'orange'; t = 'Aucun fichier de données relié à ce Mac — consultation seule';
                bt = [['Créer le fichier de données', creerFichier], ['Relier un fichier existant', relierFichier]]; break;
            case 'verrouille':
                c = 'orange'; t = 'Mot de passe non saisi — consultation seule';
                bt = [['Saisir le mot de passe', ouvrirAvecMotDePasse]]; break;
            case 'modifie-ailleurs':
                c = 'rouge'; t = 'Le fichier a été modifié sur ' + ((f && f.device) || 'l\'autre Mac') + ' le ' + quand(f && f.savedAt) +
                    ' — rechargez avant de saisir';
                bt = [['Recharger', function () { location.reload(); }]]; break;
            case 'autre-onglet':
                c = 'rouge'; t = 'Les données ont été modifiées dans un autre onglet — rechargez avant de saisir';
                bt = [['Recharger', function () { location.reload(); }]]; break;
            case 'conflit':
                c = 'rouge'; t = 'Ce Mac et le fichier ne portent pas la même version — il faut choisir avant de saisir';
                bt = [['Voir et choisir', arbitrer]]; break;
            case 'copie-conflit':
                c = 'rouge'; t = 'iCloud a créé une seconde version du fichier de données (enregistrements croisés sur les deux Mac) — il faut choisir avant de saisir';
                bt = [['Voir et choisir', arbitrerCopie]]; break;
            case 'injoignable':
                c = 'rouge'; t = 'Fichier de données injoignable — consultation seule. ' + S.detail;
                bt = [['Réessayer', function () { location.reload(); }], ['Désigner à nouveau le dossier', relierFichier]]; break;
            case 'erreur-ecriture':
                c = 'rouge'; t = 'Le dernier enregistrement dans le fichier a échoué : ' + S.detail;
                bt = [['Réessayer', function () { passer('ok'); ecrireMaintenant(); }]]; break;
        }
        bandeau.setAttribute('data-c', c);
        bandeau.innerHTML = '<span class="rtL1"></span>';
        bandeau.firstChild.textContent = t;
        bt.forEach(function (b) {
            var x = document.createElement('button'); x.type = 'button'; x.textContent = b[0]; x.onclick = b[1];
            bandeau.appendChild(x);
        });
        var l2 = document.createElement('span'); l2.className = 'rtL2';
        l2.textContent = 'Fermez cet onglet avant de passer à l\'autre ordinateur.';
        bandeau.appendChild(l2);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Fenêtres de dialogue
    // valider(rep, aide) : renvoie true (fermer), false (rester), ou une promesse de l'un des deux
    // ════════════════════════════════════════════════════════════════════════
    function dialogue(o, valider) {
        return new Promise(function (resolve) {
            var d = document.createElement('dialog');
            d.className = 'rtDlg';
            var h = '<form method="dialog" class="rtIn"><h2></h2><div class="rtTxt">' + (o.texte || '') + '</div>';
            (o.champs || []).forEach(function (c) {
                h += '<label for="rtc_' + c.id + '">' + esc(c.label) + '</label><input id="rtc_' + c.id + '" type="' + c.type +
                     '" autocomplete="' + (c.type === 'password' ? 'off' : 'on') + '">';
            });
            if (o.fichier) h += '<label for="rtc__f">Fichier d\'export (facultatif)</label><input id="rtc__f" type="file" accept=".json,application/json">';
            h += '<div class="rtAide" aria-live="polite"></div><div class="rtBt"></div></form>';
            d.innerHTML = h;
            d.querySelector('h2').textContent = o.titre;
            var zone = d.querySelector('.rtBt'), aideEl = d.querySelector('.rtAide');
            var aide = function (m) { aideEl.textContent = m || ''; };
            var occupe = false;
            d.addEventListener('cancel', function (ev) { ev.preventDefault(); });
            o.boutons.forEach(function (b, i) {
                var x = document.createElement('button');
                x.type = (b.principal ? 'submit' : 'button'); x.textContent = b.label;
                if (b.principal) x.className = 'rtP';
                x.onclick = function (ev) {
                    ev.preventDefault();
                    if (occupe) return;
                    var valeurs = {};
                    (o.champs || []).forEach(function (c) { valeurs[c.id] = d.querySelector('#rtc_' + c.id).value; });
                    var fi = d.querySelector('#rtc__f');
                    var rep = { bouton: b.id, valeurs: valeurs, fichier: fi && fi.files && fi.files[0] };
                    var r = valider ? valider(rep, aide) : true;
                    occupe = true;
                    Promise.resolve(r).then(function (fermer) {
                        occupe = false;
                        if (fermer !== false) { d.close(); d.remove(); resolve(rep); }
                    }, function (e) { occupe = false; aide('Erreur : ' + (e && e.message ? e.message : e)); });
                };
                zone.appendChild(x);
            });
            document.body.appendChild(d);
            d.showModal();
            var premier = d.querySelector('input'); if (premier && premier.type !== 'file') premier.focus();
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    // Lancement
    // ════════════════════════════════════════════════════════════════════════
    if (!window.showDirectoryPicker) {
        // Chrome sans accès aux dossiers (cas improbable) : on le dit et on reste en consultation.
        S.statut = 'injoignable';
        S.detail = 'Cette version de Chrome ne sait pas écrire dans un dossier.';
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', creerBandeau); else creerBandeau();
        return;
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();
