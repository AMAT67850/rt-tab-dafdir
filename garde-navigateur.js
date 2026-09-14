/* garde-navigateur.js — Rocket Tower — 14/09/2026
 *
 * Constat D.6. Les données de l'outil vivent uniquement dans le stockage local du
 * navigateur. WebKit — Safari sur Mac, et TOUS les navigateurs sur iPhone et iPad —
 * efface ce stockage au bout de sept jours d'utilisation du navigateur sans que le
 * site ait été ouvert. L'effacement est silencieux et total.
 *
 * Ce garde-fou affiche un voile à chaque ouverture dans un navigateur concerné.
 * Il n'interdit rien : une porte de sortie reste ouverte, sans quoi il deviendrait
 * impossible d'exporter les données restées dans Safari. Le choix n'est jamais
 * mémorisé : le voile revient à chaque page, et un bandeau subsiste ensuite.
 *
 * Une seule copie de ce fichier, appelée par les neuf pages :
 *     <script src="garde-navigateur.js"></script>
 */
(function () {
    'use strict';

    // ── Détection ────────────────────────────────────────────────────────────
    // On vise le moteur, pas la marque. iOS et iPadOS imposent WebKit à tous les
    // navigateurs : Chrome y est concerné au même titre que Safari.
    function navigateurWebKit() {
        try {
            const ua = navigator.userAgent || '';
            const iOS = /iPad|iPhone|iPod/.test(ua)
                     || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPad récent
            if (iOS) return { concerne: true, nom: 'ce navigateur (iPhone ou iPad)' };

            // Sur macOS : Safari se reconnaît à l'absence des marqueurs des autres moteurs.
            const safariMac = /Safari/.test(ua)
                           && !/Chrome|Chromium|Edg|OPR|Brave|Firefox/.test(ua);
            if (safariMac) return { concerne: true, nom: 'Safari' };

            return { concerne: false, nom: '' };
        } catch (e) {
            return { concerne: false, nom: '' };   // dans le doute, on ne gêne personne
        }
    }

    const verdict = navigateurWebKit();
    if (!verdict.concerne) return;

    const ADRESSE = 'https://amat67850.github.io/rt-tab-dafdir/';

    // ── Styles ───────────────────────────────────────────────────────────────
    const style = document.createElement('style');
    style.textContent = `
        #rtGardeVoile {
            position: fixed; inset: 0; z-index: 2147483000;
            background: rgba(17, 24, 39, 0.82);
            display: flex; align-items: center; justify-content: center;
            padding: 24px; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif;
        }
        #rtGardeBoite {
            background: #fff; border-radius: 14px; max-width: 620px; width: 100%;
            padding: 30px 32px 26px; box-shadow: 0 18px 50px rgba(0,0,0,.35);
            border-top: 6px solid #c62828;
        }
        #rtGardeBoite h2 {
            margin: 0 0 14px; font-size: 21px; color: #7f1d1d; line-height: 1.3;
        }
        #rtGardeBoite p { margin: 0 0 13px; font-size: 15px; line-height: 1.6; color: #2f3742; }
        #rtGardeBoite p.rtAdresse {
            background: #f4f6f8; border: 1px solid #dfe4ea; border-radius: 7px;
            padding: 10px 13px; font-size: 14px; word-break: break-all; color: #1f2933;
        }
        #rtGardeActions { display: flex; flex-wrap: wrap; gap: 11px; margin-top: 19px; }
        #rtGardeActions button {
            border: none; border-radius: 8px; padding: 11px 18px;
            font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit;
        }
        #rtGardeCopier    { background: #1565c0; color: #fff; }
        #rtGardeContinuer { background: #eceff1; color: #455a64; }
        #rtGardeBandeau {
            position: sticky; top: 0; z-index: 2147482000;
            background: #c62828; color: #fff;
            padding: 8px 14px; font-size: 13.5px; font-weight: 600; text-align: center;
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif;
        }
    `;
    document.head.appendChild(style);

    // ── Voile ────────────────────────────────────────────────────────────────
    function afficher() {
        if (document.getElementById('rtGardeVoile')) return;

        const voile = document.createElement('div');
        voile.id = 'rtGardeVoile';
        voile.innerHTML =
            '<div id="rtGardeBoite" role="dialog" aria-modal="true">' +
              '<h2>⚠️ Ce navigateur efface les données du tableau de bord</h2>' +
              '<p>Vos données — recettes, charges, prévisionnel — ne sont enregistrées ' +
                 'que dans le navigateur. <strong>' + verdict.nom + ' supprime ce stockage ' +
                 'au bout de sept jours d\'utilisation sans que cette page ait été ouverte</strong>, ' +
                 'sans aucun avertissement.</p>' +
              '<p><strong>Ouvrez le tableau de bord dans Chrome</strong>, qui ne fait pas cela.</p>' +
              '<p class="rtAdresse">' + ADRESSE + '</p>' +
              '<p style="font-size:14px;color:#5b6570;">Si vous continuez ici, ne saisissez rien : ' +
                 'les données de ce navigateur et celles de Chrome sont deux jeux distincts, ' +
                 'et toute saisie faite ici sera perdue au prochain import.</p>' +
              '<div id="rtGardeActions">' +
                '<button id="rtGardeCopier" type="button">📋 Copier l\'adresse</button>' +
                '<button id="rtGardeContinuer" type="button">Continuer ici quand même</button>' +
              '</div>' +
            '</div>';
        document.body.appendChild(voile);

        const boutonCopier = document.getElementById('rtGardeCopier');
        boutonCopier.addEventListener('click', function () {
            const fini = function () {
                boutonCopier.textContent = '✅ Adresse copiée';
                setTimeout(function () { boutonCopier.textContent = '📋 Copier l\'adresse'; }, 2200);
            };
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(ADRESSE).then(fini, secours);
                } else { secours(); }
            } catch (e) { secours(); }

            function secours() {
                // Repli si le presse-papiers est refusé : on sélectionne le texte.
                const p = document.querySelector('#rtGardeBoite .rtAdresse');
                const plage = document.createRange();
                plage.selectNodeContents(p);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(plage);
                boutonCopier.textContent = 'Adresse sélectionnée — ⌘C pour copier';
            }
        });

        document.getElementById('rtGardeContinuer').addEventListener('click', function () {
            voile.remove();
            if (!document.getElementById('rtGardeBandeau')) {
                const bandeau = document.createElement('div');
                bandeau.id = 'rtGardeBandeau';
                bandeau.textContent = '⚠️ ' + verdict.nom.charAt(0).toUpperCase() + verdict.nom.slice(1) +
                                      ' — ce navigateur efface les données du tableau de bord. ' +
                                      'Ne saisissez rien ici : travaillez dans Chrome.';
                document.body.insertBefore(bandeau, document.body.firstChild);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', afficher);
    } else {
        afficher();
    }
})();
