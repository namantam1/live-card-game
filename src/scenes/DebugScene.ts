import NetworkIndicator from "../components/NetworkIndicator";
import { CARD_CONFIG, getResponsiveConfig, SETTINGS_ICON_CONFIG } from "../config/uiConfig";
import { CardData } from "../type";
import Button from "../utils/Button";
import { createDeck } from "../utils/cards";
import { COLORS, RANKS, SUITS } from "../utils/constants";

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

        // const players = [
        //     { id: 'player1', name: 'Alice', emoji: '😀', score: 10 },
        //     { id: 'player2', name: 'Bob', emoji: '😎', score: 20 },
        //     { id: 'player3', name: 'Charlie', emoji: '🤠', score: 15 },
        //     { id: 'player4', name: 'Diana', emoji: '🧐', score: 25 },
        // ];
        // const scoreboard = new ScoreBoard(this, false, players, 0);
        // scoreboard.updateScoreboard(players, 2);

        // const roundModal = new RoundModal(
        //     this,
        //     () => {
        //         console.log('Continue to next round');
        //     },
        //     null as any,
        // );
        // this.time.delayedCall(1000, () => {
        //     roundModal.showRoundResults(
        //         {
        //             players: [
        //                 { name: 'Alice', tricksWon: 3, bid: 2, roundScore: 10 },
        //                 { name: 'Bob', tricksWon: 1, bid: 2, roundScore: -5 },
        //                 { name: 'Charlie', tricksWon: 2, bid: 2, roundScore: 0 },
        //                 { name: 'Diana', tricksWon: 4, bid: 3, roundScore: 15 },
        //             ],
        //         }
        //     )
        // });

        // const gameOverModal = new GameOverModal(
        //     this,
        //     () => {
        //         console.log('Play Again clicked');
        //     },
        //     () => {
        //         console.log('Menu clicked');
        //     },
        //     null as any,
        // );
        // this.time.delayedCall(1000, () => {
        //     gameOverModal.showGameResults(
        //         {
        //             winner: { name: 'Bob', emoji: '😎' },
        //             players: [
        //                 { name: 'Alice', emoji: '😀', score: 30 },
        //                 { name: 'Bob', emoji: '😎', score: 50 },
        //                 { name: 'Charlie', emoji: '🤠', score: 40 },
        //                 { name: 'Diana', emoji: '🧐', score: 20 },
        //             ],
        //         }
        //     )
        // });


        const { width, height } = this.cameras.main;
        const config = getResponsiveConfig(SETTINGS_ICON_CONFIG, width, height);
        const { iconSize, fontSize, margin } = config;
        Button.createIconButton(this, width - margin, margin, {
            iconSize,
            fontSize,
            icon: '\u2699',
            onClick: () => console.log('Settings clicked'),
            audioManager: null
        });

        (window as any).indicator = new NetworkIndicator(this, width - 110, 40);
    }
}
