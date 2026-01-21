import { Scene } from 'phaser';
import BaseModal from './BaseModal';
import { getFontSize } from '../../config/uiConfig';
import AudioManager from '../../managers/AudioManager';

interface RoundModalData {
  players: Array<{
    name: string;
    tricksWon: number;
    bid: number;
    roundScore: number;
  }>;
}

export default class RoundModal extends BaseModal {
  private onContinue: () => void;

  constructor(
    scene: Scene,
    onContinue: () => void,
    audioManager: AudioManager
  ) {
    super(scene, 'Round Complete', audioManager);
    this.onContinue = onContinue;
  }

  showRoundResults(data: RoundModalData) {
    this.clearContent();
    const { width, height } = this.scene.cameras.main;

    // Player results with responsive font sizes
    data.players.forEach((player, index) => {
      const y = -60 + index * 35;

      const name = this.scene.add.text(-150, y, `${player.name}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: getFontSize('modalContent', width, height),
        color: '#ffffff',
      });

      const result = this.scene.add.text(0, y, `${player.tricksWon}/${player.bid}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: getFontSize('modalContent', width, height),
        color: '#94a3b8',
      }).setOrigin(0.5);

      const score = this.scene.add.text(
        150,
        y,
        player.roundScore >= 0 ? `+${player.roundScore.toFixed(1)}` : `${player.roundScore.toFixed(1)}`,
        {
          fontFamily: 'Arial, sans-serif',
          fontSize: getFontSize('modalContent', width, height),
          fontStyle: 'bold',
          color: player.roundScore >= 0 ? '#22c55e' : '#ef4444',
        }
      ).setOrigin(1, 0);

      this.content.add([name, result, score]);
    });

    // Continue button
    const button = this.createModalButton(0, 100, 'Continue', () => {
      this.hide();
      this.onContinue();
    });
    this.content.add(button);

    this.show();
  }
}
