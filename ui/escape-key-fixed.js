/**
 * EscapeKeyFixed — Greffon pour Civilization VII
 *
 * Corrige le comportement de la touche Échap pour qu'elle désélectionne
 * l'unité ou la ville en cours avant d'ouvrir le menu pause,
 * comme dans Civilization VI.
 *
 * Problème : dans le jeu de base, WorldInput gère l'action "cancel"
 * (manette) mais pas "keyboard-escape" (clavier). L'événement Échap
 * passe donc directement au gestionnaire de root-game.js qui ouvre
 * le menu pause sans vérifier si quelque chose est sélectionné.
 *
 * Solution : enregistrer un gestionnaire d'entrée via le ContextManager
 * pour intercepter "keyboard-escape" AVANT que l'événement ne soit
 * distribué sur window (où root-game.js l'attrape). Si le mode
 * d'interface n'est pas le mode par défaut, on revient au mode par
 * défaut (ce qui désélectionne unités et villes) et on consomme
 * l'événement. Sinon, on laisse passer pour ouvrir le menu pause.
 */

import { InterfaceMode } from '/core/ui/interface-modes/interface-modes.js';
import ContextManager from '/core/ui/context-manager/context-manager.js';

const escapeHandler = {
    handleInput(inputEvent) {
        // On ne gère que keyboard-escape au moment du relâchement
        if (inputEvent.detail.name !== "keyboard-escape") return true;
        if (inputEvent.detail.status !== InputActionStatuses.FINISH) return true;

        // Si on est déjà en mode par défaut, laisser passer → menu pause
        if (InterfaceMode.isInDefaultMode()) return true;

        // Si on est dans le menu pause, laisser passer → le menu gère lui-même
        if (InterfaceMode.isInInterfaceMode("INTERFACEMODE_PAUSE_MENU")) return true;

        // Retourner au mode par défaut (désélectionne unités et villes)
        InterfaceMode.switchToDefault();

        // Retourner false = événement consommé, le menu pause ne s'ouvre pas
        return false;
    },
    handleNavigation(navigationEvent) {
        return true;
    }
};

ContextManager.registerEngineInputHandler(escapeHandler);
