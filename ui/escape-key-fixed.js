/**
 * EscapeKeyFixed — Greffon pour Civilization VII
 * Copyright (C) 2025 simon
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Corrige le comportement de la touche Échap pour qu'elle désélectionne
 * l'unité ou la ville en cours avant d'ouvrir le menu pause,
 * comme dans Civilization VI. Ferme aussi les panneaux ouverts
 * (ex. : attributs de dirigeant) avant d'ouvrir le menu pause.
 * En mode de placement (ex. : placement de bâtiment), Échap revient
 * au mode parent (ex. : production de la ville) au lieu de tout
 * fermer et retourner directement à la carte.
 *
 * Problème : dans le jeu de base, trois chemins de code font défaut :
 *
 * 1) WorldInput gère l'action "cancel" (manette) mais pas
 *    "keyboard-escape" (clavier). L'événement passe donc directement
 *    au gestionnaire de root-game.js qui ouvre le menu pause.
 *
 * 2) Quand le panneau de production est ouvert (mode ville), le
 *    FocusManager distribue l'événement sur l'élément focusé dans le
 *    panneau. L'événement remonte (bubble) jusqu'à window où
 *    root-game.js l'attrape et ouvre le menu pause, AVANT que les
 *    gestionnaires enregistrés (engineInputEventHandlers) ne soient
 *    atteints.
 *
 * 3) Quand un panneau est ouvert en mode par défaut (ex. : attributs
 *    de dirigeant), le panneau gère Échap via un écouteur sur window
 *    en phase bubble, mais root-game.js a été enregistré AVANT et
 *    utilise stopPropagation() au lieu de stopImmediatePropagation().
 *    Le menu pause s'ouvre donc en même temps que le panneau ferme.
 *    De plus, canOpenPauseMenu() ne vérifie pas si des écrans sont
 *    sur la pile du ContextManager.
 *
 * Garde de sécurité : on vérifie canOpenPauseMenu() avant d'agir.
 * Quand cette méthode retourne false, le jeu empêche déjà
 * l'ouverture du menu pause (transition d'âge, cinématiques,
 * diplomatie, etc.). Dans ces cas, les écrans actifs gèrent
 * Échap eux-mêmes (ex. : screen-endgame saute l'animation,
 * les panneaux cinématiques ferment la cinématique). Si on
 * interceptait l'événement, on casserait ces gestionnaires
 * natifs — par exemple, fermer screen-endgame durant une
 * transition d'âge laisse une requête orpheline dans le
 * DisplayQueueManager et gèle le jeu.
 *
 * Solution double :
 *
 * A) Un écouteur en phase de capture sur window intercepte
 *    keyboard-escape quand il est distribué sur un élément DOM interne
 *    (event.target !== window). Quand on n'est pas en mode par défaut,
 *    il délègue au gestionnaire du mode via cancelOrDefault() qui
 *    réutilise la logique native d'annulation de chaque mode (ex. :
 *    placement de bâtiment → production de ville). Quand un panneau
 *    est ouvert en mode par défaut, il ferme le panneau via close()
 *    ou ContextManager.pop().
 *
 * B) Un gestionnaire enregistré dans le ContextManager attrape les cas
 *    où aucune distribution DOM interne n'a eu lieu (ex. : sélection
 *    d'unité sans panneau focusé). Utilise aussi cancelOrDefault().
 */

import { InterfaceMode } from '/core/ui/interface-modes/interface-modes.js';
import ContextManager from '/core/ui/context-manager/context-manager.js';

/**
 * Vérifie si l'événement est un keyboard-escape terminé qui ne
 * concerne pas le menu pause.
 */
function isEscapeFinish(inputEvent) {
    if (inputEvent.detail.name !== "keyboard-escape") return false;
    if (inputEvent.detail.status !== InputActionStatuses.FINISH) return false;
    if (InterfaceMode.isInInterfaceMode("INTERFACEMODE_PAUSE_MENU")) return false;
    return true;
}

/**
 * Tente d'annuler le mode d'interface actuel en déléguant au
 * gestionnaire du mode courant, puis retombe sur switchToDefault()
 * si le gestionnaire n'a pas consommé l'événement.
 *
 * Ça réutilise la logique native d'annulation de chaque mode :
 *  - PLACE_BUILDING → CITY_PRODUCTION (avec CityID)
 *  - ChoosePlot (CONSTRUCT_IN_RANGE, etc.) → UNIT_SELECTED ou DEFAULT
 *  - ACQUIRE_TILE → DEFAULT
 *  - etc.
 *
 * Les gestionnaires de mode vérifient isCancelInput() qui retourne
 * true pour "keyboard-escape", "cancel" et "mousebutton-right".
 * Aucun gestionnaire ne vérifie defaultPrevented, donc on peut
 * appeler cette fonction même après preventDefault().
 */
function cancelOrDefault(inputEvent) {
    const consumed = !InterfaceMode.handleInput(inputEvent);
    if (!consumed) {
        InterfaceMode.switchToDefault();
    }
}

// Garde contre un cycle d'appels infini, partagée entre les
// solutions A et B.
//
// Certains gestionnaires de mode (ex. : UNIT_PROMOTION) redistribuent
// une copie de l'événement sur un élément DOM interne via
// InputEngineEvent.CreateNewEvent(). Quand cancelOrDefault() appelle
// InterfaceMode.handleInput(), le gestionnaire redistribue
// l'événement, ce qui redéclenche notre écouteur capture → celui-ci
// rappelle cancelOrDefault() → le gestionnaire redistribue encore →
// cycle infini → débordement de pile.
//
// La variable isProcessing brise ce cycle : on la met à true avant
// d'appeler cancelOrDefault() et on la remet à false après. Si
// l'écouteur se redéclenche pendant ce temps, il sort immédiatement.
let isProcessing = false;

// ═══════════════════════════════════════════════════════════════════
// Solution A : Écouteur capture sur window
//
// Intercepte keyboard-escape quand il est distribué par le
// FocusManager (ou les screens) sur un élément DOM interne.
// L'événement remonte normalement jusqu'à window où root-game.js
// l'attraperait — on le bloque ici en phase de capture.
//
// Deux cas :
//  - Mode non par défaut (unité/ville/placement) → cancelOrDefault()
//    délègue au gestionnaire du mode pour une annulation intelligente
//  - Mode par défaut avec écran ouvert → fermer l'écran
// ═══════════════════════════════════════════════════════════════════
window.addEventListener("engine-input", (inputEvent) => {
    if (isProcessing) return;
    if (inputEvent.target === window) return;
    if (!isEscapeFinish(inputEvent)) return;
    if (!ContextManager.canOpenPauseMenu()) return;

    if (!InterfaceMode.isInDefaultMode()) {
        inputEvent.stopImmediatePropagation();
        inputEvent.preventDefault();
        isProcessing = true;
        try {
            cancelOrDefault(inputEvent);
        } finally {
            isProcessing = false;
        }
        return;
    }

    // Mode par défaut, mais l'événement est distribué sur un élément
    // interne — un panneau est probablement ouvert (ex. : attributs
    // de dirigeant). On ferme l'écran courant du ContextManager pour
    // empêcher root-game.js d'ouvrir le menu pause.
    //
    // Note : getCurrentTarget() retourne l'élément DOM (ComponentRoot),
    // pas l'instance du composant (Component/Panel). Les méthodes comme
    // askForClose() et close() sont sur l'objet .component.
    //
    // Cas spécial : les sous-panneaux de la mini-carte (filtres,
    // clavardage, rendement, etc.) sont ouverts via un mécanisme de
    // bascule dans PanelMiniMap (toggleLensPanel, toggleChatPanel,
    // toggleSubpanel). Chaque méthode synchronise un booléen local
    // (lensPanelState, etc.) avec la pile du ContextManager. Si on
    // ferme le sous-panneau directement via close() →
    // ContextManager.pop(), le booléen reste à true et la prochaine
    // bascule se désynchronise — le panneau s'ouvre et se ferme tout
    // de suite au lieu de s'ouvrir normalement. On délègue donc à
    // closeSubpanels() qui passe par les méthodes de bascule.
    //
    // Ordre de priorité pour la fermeture :
    //  0. closeSubpanels() — sous-panneaux de la mini-carte, passe
    //     par les méthodes de bascule pour garder l'état synchronisé.
    //  1. askForClose() — utilisé par les écrans ouverts via le
    //     PopupSequencer (ex. : screen-unlocks). Cette méthode passe
    //     par PopupSequencer.closePopup() → DisplayQueueManager.close()
    //     pour nettoyer la requête d'affichage. Sans ça, la requête
    //     fantôme reste dans activeRequests et cause une réouverture
    //     de l'écran quand DisplayQueueManager.resume() est appelé
    //     (ex. : après la fermeture du menu pause).
    //  2. close() — utilisé par les panneaux simples (ex. : attributs
    //     de dirigeant) qui sont poussés directement via
    //     ContextManager.push() sans passer par le PopupSequencer.
    //  3. ContextManager.pop() — dernier recours.
    const currentScreen = ContextManager.getCurrentTarget();
    if (currentScreen) {
        inputEvent.stopImmediatePropagation();
        inputEvent.preventDefault();
        const miniMap = currentScreen.closest('panel-mini-map');
        if (miniMap?.component?.closeSubpanels) {
            miniMap.component.closeSubpanels();
        } else {
            const panel = currentScreen.component;
            if (typeof panel?.askForClose === 'function') {
                panel.askForClose();
            } else if (typeof panel?.close === 'function') {
                panel.close();
            } else {
                ContextManager.pop(currentScreen.tagName);
            }
        }
    }
}, true);

// ═══════════════════════════════════════════════════════════════════
// Solution B : Gestionnaire ContextManager
//
// Attrape keyboard-escape quand le FocusManager n'est pas actif
// (ex. : une unité est sélectionnée sans panneau focusé). Dans ce
// cas, l'événement atteint les engineInputEventHandlers (étape 6
// du handleInput du ContextManager). Utilise cancelOrDefault()
// pour déléguer au gestionnaire du mode actuel.
// ═══════════════════════════════════════════════════════════════════
ContextManager.registerEngineInputHandler({
    handleInput(inputEvent) {
        if (isProcessing) return true;
        if (!isEscapeFinish(inputEvent)) return true;
        if (InterfaceMode.isInDefaultMode()) return true;
        if (!ContextManager.canOpenPauseMenu()) return true;
        isProcessing = true;
        try {
            cancelOrDefault(inputEvent);
        } finally {
            isProcessing = false;
        }
        return false;
    },
    handleNavigation() {
        return true;
    }
});
