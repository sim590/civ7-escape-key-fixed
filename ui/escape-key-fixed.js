/**
 * EscapeKeyFixed — Greffon pour Civilization VII
 *
 * Corrige le comportement de la touche Échap pour qu'elle désélectionne
 * l'unité ou la ville en cours avant d'ouvrir le menu pause,
 * comme dans Civilization VI.
 *
 * Problème : dans le jeu de base, deux chemins de code font défaut :
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
 * Solution double :
 *
 * A) Un écouteur en phase de capture sur window intercepte
 *    keyboard-escape quand il est distribué sur un élément DOM interne
 *    (event.target !== window). Cela bloque l'événement avant que
 *    root-game.js ne le voie pendant la remontée du FocusManager.
 *
 * B) Un gestionnaire enregistré dans le ContextManager attrape les cas
 *    où le FocusManager n'est pas actif (ex. : sélection d'unité).
 */

import { InterfaceMode } from '/core/ui/interface-modes/interface-modes.js';
import ContextManager from '/core/ui/context-manager/context-manager.js';

/**
 * Vérifie si l'événement keyboard-escape devrait désélectionner
 * au lieu d'ouvrir le menu pause.
 */
function shouldIntercept(inputEvent) {
    if (inputEvent.detail.name !== "keyboard-escape") return false;
    if (inputEvent.detail.status !== InputActionStatuses.FINISH) return false;
    if (InterfaceMode.isInDefaultMode()) return false;
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
// On distingue les distributions internes (target !== window) de
// la distribution finale par action-handler (target === window).
// ═══════════════════════════════════════════════════════════════════
window.addEventListener("engine-input", (inputEvent) => {
    if (inputEvent.target === window) return;
    if (!shouldIntercept(inputEvent)) return;

    inputEvent.stopImmediatePropagation();
    inputEvent.preventDefault();
    InterfaceMode.switchToDefault();
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
        if (!shouldIntercept(inputEvent)) return true;
        InterfaceMode.switchToDefault();
        return false;
    },
    handleNavigation() {
        return true;
    }
});
