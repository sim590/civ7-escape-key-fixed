/**
 * EscapeKeyFixed — Greffon pour Civilization VII
 * Copyright (C) 2025 simon
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Ajoute la désélection de l'unité avec Échap : quand une unité est
 * sélectionnée, Échap la désélectionne au lieu d'ouvrir le menu pause.
 * Dans Civilization VI, Échap servait à fermer les sous-menus et la
 * désélection se faisait par un clic gauche sur la carte. Civilization
 * VII n'offre plus cette action, donc le greffon l'associe à Échap.
 *
 * Depuis Civilization VII 1.5.0, le jeu gère lui-même Échap dans les
 * panneaux, les menus et les modes de placement. Le greffon ne
 * s'occupe donc plus que de la désélection d'unité.
 *
 * Deux mécanismes sont nécessaires :
 *
 * A) Un écouteur en phase de capture sur window. Quand une unité est
 *    sélectionnée, le FocusManager place le focus sur un bouton du
 *    panneau d'actions de l'unité et distribue l'événement sur cet
 *    élément. L'événement remonte ensuite jusqu'à window, où
 *    root-game.js ouvre le menu pause AVANT que les gestionnaires du
 *    ContextManager soient atteints. L'écouteur capture intercepte
 *    donc cette distribution interne avant root-game.
 *
 * B) Un gestionnaire enregistré dans le ContextManager, qui couvre
 *    le cas où aucun élément n'a le focus (pas de distribution DOM
 *    interne).
 *
 * Dans les deux cas, on n'agit que si :
 *  - l'action est keyboard-escape terminée ;
 *  - l'événement n'a pas déjà été consommé ;
 *  - aucun panneau ou écran n'est ouvert (le jeu gère Échap
 *    nativement dans les menus) ;
 *  - le mode courant est INTERFACEMODE_UNIT_SELECTED ;
 *  - le jeu autorise l'ouverture du menu pause (pas de transition
 *    d'âge, cinématique, diplomatie, etc.).
 *
 * Important : l'API utilise maintenant l'énumération InputHandlerState
 * (Active = 0, Handled = 1) et non plus des booléens. Retourner true
 * consomme donc TOUS les événements, ce qui bloquait notamment les
 * touches de déplacement (WASD).
 */

import { ContextManager } from '/core/ui/context-manager/context-manager.js';
import { InputHandlerState } from '/core/ui/input/input-support.js';
import { InterfaceMode } from '/core/ui/interface-modes/interface-modes.js';

/**
 * Vérifie si l'événement est un keyboard-escape terminé.
 */
function isKeyboardEscape(inputEvent) {
    return inputEvent.detail.name === "keyboard-escape" &&
        inputEvent.detail.status === InputActionStatuses.FINISH;
}

/**
 * Détermine si Échap doit désélectionner l'unité courante.
 */
function shouldDeselectUnit(inputEvent) {
    if (!isKeyboardEscape(inputEvent)) return false;

    // Un autre gestionnaire (p. ex. une infobulle verrouillée) a déjà
    // consommé l'événement : on ne s'en mêle pas.
    if (inputEvent.defaultPrevented) return false;

    // Un champ de texte a le focus : Échap doit annuler l'édition en
    // cours, pas désélectionner l'unité.
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
        return false;
    }

    // Un panneau ou un écran est ouvert : le jeu gère Échap
    // nativement, on ne doit pas lui voler l'événement.
    if (!ContextManager.isEmpty) return false;

    // Seulement en mode sélection d'unité. Les autres modes
    // (placement, promotion, production, etc.) ont leur propre
    // gestion native d'Échap.
    if (!InterfaceMode.isInInterfaceMode("INTERFACEMODE_UNIT_SELECTED")) return false;

    // Pendant une transition d'âge, une cinématique ou une
    // diplomatie, le jeu bloque déjà le menu pause et gère Échap
    // lui-même. On ne doit pas court-circuiter ce comportement.
    if (!ContextManager.canOpenPauseMenu()) return false;

    return true;
}

function deselectUnit() {
    InterfaceMode.switchToDefault();
}

// Solution A : distribution interne par le FocusManager. target ===
// window signifie que l'événement a déjà traversé les gestionnaires
// du ContextManager ; on laisse alors le jeu faire.
window.addEventListener("engine-input", (inputEvent) => {
    if (inputEvent.target === window) return;
    if (!shouldDeselectUnit(inputEvent)) return;
    inputEvent.stopImmediatePropagation();
    inputEvent.preventDefault();
    deselectUnit();
}, true);

// Solution B : aucun élément focusé, l'événement atteint les
// gestionnaires du ContextManager.
ContextManager.registerEngineInputHandler({
    handleInput(inputEvent) {
        if (!shouldDeselectUnit(inputEvent)) {
            return InputHandlerState.Active;
        }
        deselectUnit();
        return InputHandlerState.Handled;
    },
    handleNavigation() {
        return InputHandlerState.Active;
    }
});
