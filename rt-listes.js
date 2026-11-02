/*
 * rt-listes.js — Rocket Tower
 * AJOUT 02/11/2026
 *
 * Listes modifiables par l'utilisatrice, communes aux modules 2 (recettes) et
 * 3 (charges récurrentes) et à la page « Sauvegarde et données » :
 *
 *  - les CENTRES (Gare, Wissembourg, Domaine Mazerand…), une seule liste pour
 *    les recettes et les charges. « Mixte » et « Frais généraux » n'en font
 *    pas partie : ils sont réservés aux charges et gardent leur valeur stockée
 *    d'origine ('mixte', 'général') ;
 *  - les TYPES DE CHARGES.
 *
 * Les types de recettes restent gérés comme avant (typesRecettesRT).
 *
 * Les listes sont lues sous les étiquettes 'centresRT' et 'typesChargesRT' ;
 * rt-donnees.js les aiguille vers 'rt-centres' et 'rt-types-charges' et les
 * range dans le fichier de données iCloud, comme le reste. Tant qu'aucune
 * liste n'a été enregistrée, la liste par défaut s'applique — sans être
 * écrite : ouvrir une page ne crée aucune révision.
 *
 * Correspondance entre une fiche et la liste : insensible à la casse et aux
 * accents (« GARE », « gare » et « Gare » désignent le même centre). Une fiche
 * portant un sous-centre numéroté (« GARE 1 », « WISSEMBOURG 2 ») se range sous
 * le centre correspondant, comme le faisait l'ancien filtre « GARE (tous) ».
 *
 * Ce fichier ne modifie aucune donnée. Il est chargé après rt-donnees.js.
 */
(function () {
    'use strict';

    var CENTRES_DEFAUT = ['Gare', 'Wissembourg'];
    var TYPES_CHARGES_DEFAUT = ['emprunts', 'frais bancaires', 'loyers', 'télécomm.',
        'assurances', 'véhicules', 'abonnements', 'rémunérations', 'ES', 'autres'];

    // Centres réservés aux charges, hors liste modifiable
    var CENTRES_CHARGES_FIXES = [
        { valeur: 'mixte', libelle: 'Mixte' },
        { valeur: 'général', libelle: 'Frais généraux' }
    ];
    // Noms refusés dans la liste des centres
    var NOMS_RESERVES = ['mixte', 'general', 'frais generaux', 'non precise', 'tous', 'tous les centres'];

    // Clé de comparaison : sans casse, sans accents, espaces réduits
    function cle(v) {
        return (v === undefined || v === null ? '' : String(v))
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .toLowerCase().replace(/\s+/g, ' ').trim();
    }

    function lireListe(etiquette, defaut) {
        try {
            var t = localStorage.getItem(etiquette);
            if (t) {
                var a = JSON.parse(t);
                if (Array.isArray(a)) {
                    var vus = {};
                    var propre = a.map(function (x) { return (x === null || x === undefined) ? '' : String(x).trim(); })
                        .filter(function (x) {
                            var k = cle(x);
                            if (!k || vus[k]) return false;
                            vus[k] = true; return true;
                        });
                    if (propre.length) return propre;
                }
            }
        } catch (e) { /* liste par défaut */ }
        return defaut.slice();
    }

    function centres() { return lireListe('centresRT', CENTRES_DEFAUT); }
    function typesCharges() { return lireListe('typesChargesRT', TYPES_CHARGES_DEFAUT); }

    // Entrée de la liste qui porte exactement ce nom (casse et accents ignorés)
    function entreeExacte(valeur, liste) {
        var k = cle(valeur);
        if (!k) return null;
        for (var i = 0; i < liste.length; i++) if (cle(liste[i]) === k) return liste[i];
        return null;
    }

    // Centre de la liste dont relève une fiche : nom exact, ou sous-centre
    // numéroté (« GARE 1 » relève de « Gare »).
    function centreDeFiche(valeur, liste) {
        var exact = entreeExacte(valeur, liste);
        if (exact !== null) return exact;
        var k = cle(valeur);
        if (!k) return null;
        for (var i = 0; i < liste.length; i++) {
            var e = cle(liste[i]);
            if (k.indexOf(e + ' ') === 0 && /^\d+$/.test(k.slice(e.length + 1))) return liste[i];
        }
        return null;
    }

    function estCentreFixe(valeur) {
        var k = cle(valeur);
        for (var i = 0; i < CENTRES_CHARGES_FIXES.length; i++)
            if (cle(CENTRES_CHARGES_FIXES[i].valeur) === k) return CENTRES_CHARGES_FIXES[i];
        return null;
    }

    function estNomReserve(nom) { return NOMS_RESERVES.indexOf(cle(nom)) >= 0; }

    // Première lettre en capitale, pour l'affichage seulement
    function libelle(v) {
        var s = (v === undefined || v === null) ? '' : String(v);
        return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
    }

    function echapper(s) {
        return String(s === undefined || s === null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Remplit une liste déroulante de formulaire et sélectionne la valeur de la
    // fiche. Si cette valeur n'est pas exactement dans la liste (nom supprimé,
    // renommé, sous-centre numéroté), elle est ajoutée telle quelle avec la
    // mention « hors liste » : modifier une fiche ne doit jamais effacer en
    // silence une valeur qu'on n'a pas touchée.
    //   options : [{ valeur, libelle }] ; premiere : option vide en tête (ou null)
    function remplirSelect(select, options, valeurFiche, premiere) {
        if (!select) return;
        var html = premiere ? '<option value="">' + echapper(premiere) + '</option>' : '';
        var choisie = null;
        var kFiche = cle(valeurFiche);
        options.forEach(function (o) {
            if (kFiche && choisie === null && cle(o.valeur) === kFiche) choisie = o.valeur;
            html += '<option value="' + echapper(o.valeur) + '">' + echapper(o.libelle) + '</option>';
        });
        var brute = (valeurFiche === undefined || valeurFiche === null) ? '' : String(valeurFiche).trim();
        if (brute && choisie === null) {
            html += '<option value="' + echapper(brute) + '">' + echapper(brute) + ' (hors liste)</option>';
            choisie = brute;
        }
        select.innerHTML = html;
        select.value = choisie === null ? '' : choisie;
        if (!premiere && choisie === null && select.options.length) select.selectedIndex = 0;
    }

    // Valeur à enregistrer : si le choix désigne la même chose que la valeur
    // d'origine (seule la casse ou les accents diffèrent), l'origine est gardée,
    // pour qu'une simple modification de fiche ne réécrive pas « gare » en « Gare ».
    function valeurAEnregistrer(choix, origine) {
        if (origine !== undefined && origine !== null && cle(choix) === cle(origine)) return origine;
        return choix;
    }

    // Déplacement d'un groupe de fiches. selection : les fiches cochées (objets
    // du tableau) ; glisse : la fiche saisie à la souris ; cible : la fiche sur
    // laquelle on la lâche. Si la fiche saisie n'est pas cochée, elle se déplace
    // seule. Le groupe garde son ordre interne. Il se place après la cible quand
    // on descend, avant quand on monte — comme le déplacement d'une seule ligne.
    // Le repérage se fait sur les fiches elles-mêmes et non sur un identifiant,
    // pour fonctionner aussi avec une fiche ancienne qui n'en aurait pas.
    // Renvoie la nouvelle liste, ou null si rien ne bouge.
    function deplacerGroupe(liste, selection, glisse, cible) {
        var sel = (selection && typeof selection.has === 'function') ? selection : new Set(selection || []);
        var groupeSet = sel.has(glisse) ? sel : new Set([glisse]);
        if (groupeSet.has(cible)) return null;
        var iGlisse = liste.indexOf(glisse), iCible = liste.indexOf(cible);
        if (iGlisse < 0 || iCible < 0) return null;
        var groupe = liste.filter(function (x) { return groupeSet.has(x); });
        var reste = liste.filter(function (x) { return !groupeSet.has(x); });
        var pos = reste.indexOf(cible);
        if (iCible > iGlisse) pos += 1;
        return reste.slice(0, pos).concat(groupe, reste.slice(pos));
    }

    window.RTListes = {
        CENTRES_DEFAUT: CENTRES_DEFAUT,
        TYPES_CHARGES_DEFAUT: TYPES_CHARGES_DEFAUT,
        CENTRES_CHARGES_FIXES: CENTRES_CHARGES_FIXES,
        cle: cle,
        centres: centres,
        typesCharges: typesCharges,
        entreeExacte: entreeExacte,
        centreDeFiche: centreDeFiche,
        estCentreFixe: estCentreFixe,
        estNomReserve: estNomReserve,
        libelle: libelle,
        echapper: echapper,
        remplirSelect: remplirSelect,
        valeurAEnregistrer: valeurAEnregistrer,
        deplacerGroupe: deplacerGroupe
    };
})();
