import { CARD_CONFIG } from "../config/uiConfig";
import Card from "../objects/Card";
import { gameCommon } from "../objects/game/common";
import ScoreBoard from "../objects/game/ScoreBoard";
import { CardData } from "../type";
import { createDeck } from "../utils/cards";
import { RANKS, SUITS } from "../utils/constants";

const CARD: CardData = createDeck()[0];

export default class DebugScene extends Phaser.Scene {
    constructor() {
        super({ key: 'DebugScene' });

    }
    
    preload() {
        // this.load.svg(CARD.id, path, { width: CARD_CONFIG.WIDTH, height: CARD_CONFIG.HEIGHT });
        for (const suit of SUITS) {
              for (const rank of RANKS) {
                const key = `card-${rank}-${suit}`;
                const path = `cards/${rank}-${suit}.svg`;
                this.load.svg(key, path, { width: CARD_CONFIG.WIDTH, height: CARD_CONFIG.HEIGHT });
              }
            }
    }
    
    create() {
        // set bg color to dark gray
        this.cameras.main.setBackgroundColor('#2d2d2d');

        // const card = new Card(this, 0, 0, CARD, false);
        // card.setPlayable(true);

        const players = [
            { id: 'player1', name: 'Alice', emoji: '😀', score: 10 },
            { id: 'player2', name: 'Bob', emoji: '😎', score: 20 },
            { id: 'player3', name: 'Charlie', emoji: '🤠', score: 15 },
            { id: 'player4', name: 'Diana', emoji: '🧐', score: 25 },
        ];
        const scoreboard = new ScoreBoard(this, false, players, 0);
        // scoreboard.updateScoreboard(players, 2);
    }
}
