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
 * Solution double :
 *
 * A) Un écouteur en phase de capture sur window intercepte
 *    keyboard-escape quand il est distribué sur un élément DOM interne
 *    (event.target !== window). Quand une unité ou ville est
 *    sélectionnée, il appelle InterfaceMode.switchToDefault(). Quand
 *    un panneau est ouvert en mode par défaut, il ferme le panneau
 *    via close() ou ContextManager.pop().
 *
 * B) Un gestionnaire enregistré dans le ContextManager attrape les cas
 *    où aucune distribution DOM interne n'a eu lieu (ex. : sélection
 *    d'unité sans panneau focusé).
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

// ═══════════════════════════════════════════════════════════════════
// Solution A : Écouteur capture sur window
//
// Intercepte keyboard-escape quand il est distribué par le
// FocusManager (ou les screens) sur un élément DOM interne.
// L'événement remonte normalement jusqu'à window où root-game.js
// l'attraperait — on le bloque ici en phase de capture.
//
// Deux cas :
//  - Mode non par défaut (unité/ville) → désélectionner
//  - Mode par défaut avec écran ouvert → fermer l'écran
// ═══════════════════════════════════════════════════════════════════
window.addEventListener("engine-input", (inputEvent) => {
    if (inputEvent.target === window) return;
    if (!isEscapeFinish(inputEvent)) return;

    if (!InterfaceMode.isInDefaultMode()) {
        inputEvent.stopImmediatePropagation();
        inputEvent.preventDefault();
        InterfaceMode.switchToDefault();
        return;
    }

    // Mode par défaut, mais l'événement est distribué sur un élément
    // interne — un panneau est probablement ouvert (ex. : attributs
    // de dirigeant). On ferme l'écran courant du ContextManager pour
    // empêcher root-game.js d'ouvrir le menu pause.
    const currentScreen = ContextManager.getCurrentTarget();
    if (currentScreen) {
        inputEvent.stopImmediatePropagation();
        inputEvent.preventDefault();
        if (typeof currentScreen.close === 'function') {
            currentScreen.close();
        } else {
            ContextManager.pop(currentScreen.tagName);
        }
    }
}, true);

// ═══════════════════════════════════════════════════════════════════
// Solution B : Gestionnaire ContextManager
//
// Attrape keyboard-escape quand le FocusManager n'est pas actif
// (ex. : une unité est sélectionnée sans panneau focusé). Dans ce
// cas, l'événement atteint les engineInputEventHandlers (étape 6
// du handleInput du ContextManager).
// ═══════════════════════════════════════════════════════════════════
ContextManager.registerEngineInputHandler({
    handleInput(inputEvent) {
        if (!isEscapeFinish(inputEvent)) return true;
        if (InterfaceMode.isInDefaultMode()) return true;
        InterfaceMode.switchToDefault();
        return false;
    },
    handleNavigation() {
        return true;
    }
});
