import { Scene } from 'phaser';
import BaseModal from './BaseModal';
import AudioManager from '../../managers/AudioManager';

interface GameOverModalData {
  winner: {
    emoji: string;
    name: string;
  };
  players: Array<{
    emoji: string;
    name: string;
    score: number;
  }>;
}

export default class GameOverModal extends BaseModal {
  private onPlayAgain: () => void;
  private onMenu: () => void;

  constructor(
    scene: Scene,
    onPlayAgain: () => void,
    onMenu: () => void,
    audioManager: AudioManager
  ) {
    super(scene, 'Game Over', audioManager);
    this.onPlayAgain = onPlayAgain;
    this.onMenu = onMenu;
  }

  showGameResults(data: GameOverModalData) {
    this.clearContent();

    // Winner announcement
    const winner = data.winner;
    const winnerText = this.scene.add.text(0, -70, `${winner.emoji} ${winner.name} Wins!`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#fbbf24',
    }).setOrigin(0.5);

    this.content.add(winnerText);

    // Final scores
    data.players.forEach((player, index) => {
      const y = -20 + index * 30;

      const name = this.scene.add.text(-100, y, `${player.emoji} ${player.name}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: index === 0 ? '#fbbf24' : '#ffffff',
      });

      const score = this.scene.add.text(100, y, player.score.toFixed(1), {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: index === 0 ? '#fbbf24' : '#94a3b8',
      }).setOrigin(1, 0);

      this.content.add([name, score]);
    });

    // Buttons
    const playAgainBtn = this.createModalButton(-70, 110, 'Play Again', () => {
      this.hide();
      this.onPlayAgain();
    });

    const menuBtn = this.createModalButton(70, 110, 'Menu', () => {
      this.hide();
      this.onMenu();
    });

    this.content.add([playAgainBtn, menuBtn]);

    this.show();
  }
}
