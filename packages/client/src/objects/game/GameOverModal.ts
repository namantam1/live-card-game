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
    const winnerText = this.scene.add
      .text(0, -110, `${winner.emoji} ${winner.name} Wins!`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#fbbf24',
      })
      .setOrigin(0.5);

    this.content.add(winnerText);

    // Final scores
    data.players.forEach((player, index) => {
      const y = -80 + index * 30;

      const name = this.scene.add
        .text(-100, y, `${player.emoji} ${player.name}`, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '14px',
          color: index === 0 ? '#fbbf24' : '#ffffff',
        })
        .setPadding({ top: 5, bottom: 5 });

      const score = this.scene.add
        .text(100, y, player.score.toFixed(1), {
          fontFamily: 'Arial, sans-serif',
          fontSize: '14px',
          fontStyle: 'bold',
          color: index === 0 ? '#fbbf24' : '#94a3b8',
        })
        .setPadding({ top: 5, bottom: 5 })
        .setOrigin(1, 0);

      this.content.add([name, score]);
    });

    // Buttons
    const playAgainBtn = this.createModalButton({
      x: -70,
      y: 75,
      text: 'Play Again',
      callback: () => {
        this.hide();
        this.onPlayAgain();
      },
      width: 120,
    });

    const menuBtn = this.createModalButton({
      x: 70,
      y: 75,
      text: 'Menu',
      callback: () => {
        this.hide();
        this.onMenu();
      },
      width: 120,
    });

    this.content.add([playAgainBtn, menuBtn]);

    this.show();
  }
}
