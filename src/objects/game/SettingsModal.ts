import { Scene } from 'phaser';
import BaseModal from './BaseModal';
import Button from '../../utils/Button';
import { getFontSize } from '../../config/uiConfig';
import AudioManager from '../../managers/AudioManager';
import { COLORS } from '../../utils/constants';

export default class SettingsModal extends BaseModal {
  private onNewGame: () => void;
  private onQuit: () => void;

  constructor(
    scene: Scene,
    onNewGame: () => void,
    onQuit: () => void,
    audioManager: AudioManager
  ) {
    super(scene, 'Settings', audioManager, true); // Enable close on overlay click
    this.onNewGame = onNewGame;
    this.onQuit = onQuit;
    
    this.buildSettingsContent();
  }

  private buildSettingsContent() {
    const { width, height } = this.scene.cameras.main;
    const startY = -60;
    const itemSpacing = 50;

    // Music row
    this.createSettingRow(0, startY, 'Music', this.audioManager.isMusicEnabled(), () => {
      this.audioManager.toggleMusic();
    });

    // Sound row
    this.createSettingRow(0, startY + itemSpacing, 'Sound', this.audioManager.isSoundEnabled(), () => {
      this.audioManager.toggleButtonSound();
    });

    // Divider
    const divider = this.scene.add.graphics();
    divider.fillStyle(0x475569, 0.3);
    divider.fillRect(-100, startY + itemSpacing * 2 - 15, 200, 1);
    this.content.add(divider);

    // Action buttons
    const newGameBtn = Button.create(this.scene, 0, startY + itemSpacing * 2 + 15, {
      width: 180,
      height: 44,
      text: 'New Game',
      onClick: () => {
        this.hide();
        this.onNewGame();
      },
      fontSize: getFontSize('actionButton', width, height),
      audioManager: this.audioManager
    });
    this.content.add(newGameBtn);

    const quitBtn = Button.create(this.scene, 0, startY + itemSpacing * 3 + 15, {
      width: 180,
      height: 44,
      text: 'Quit',
      onClick: () => {
        this.hide();
        this.onQuit();
      },
      bgColor: COLORS.DANGER,
      fontSize: getFontSize('actionButton', width, height),
      audioManager: this.audioManager
    });
    this.content.add(quitBtn);
  }

  private createSettingRow(x: number, y: number, label: string, initialState: boolean, callback: () => void) {
    const container = this.scene.add.container(x, y);
    let isEnabled = initialState;
    const { width, height } = this.scene.cameras.main;

    // Label with responsive font size
    const labelText = this.scene.add.text(-100, 0, label, {
      fontFamily: 'Arial, sans-serif',
      fontSize: getFontSize('settingsLabel', width, height),
      color: '#e2e8f0',
    }).setOrigin(0, 0.5);

    // Toggle pill
    const toggleWidth = 46;
    const toggleHeight = 26;
    const toggleBg = this.scene.add.graphics();
    const toggleKnob = this.scene.add.graphics();

    const drawToggle = () => {
      toggleBg.clear();
      toggleBg.fillStyle(isEnabled ? 0x6366f1 : 0x334155, 1);
      toggleBg.fillRoundedRect(100 - toggleWidth, -toggleHeight / 2, toggleWidth, toggleHeight, toggleHeight / 2);

      toggleKnob.clear();
      toggleKnob.fillStyle(0xffffff, 1);
      const knobX = isEnabled ? 100 - 14 : 100 - toggleWidth + 14;
      toggleKnob.fillCircle(knobX, 0, 10);
    };
    drawToggle();

    const hitArea = this.scene.add.rectangle(100 - toggleWidth / 2, 0, toggleWidth + 10, toggleHeight + 10, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on('pointerdown', () => {
      isEnabled = !isEnabled;
      drawToggle();
      this.audioManager.playButtonSound();
      callback();
    });

    container.add([labelText, toggleBg, toggleKnob, hitArea]);
    this.content.add(container);
  }

  showSettings() {
    this.show();
  }
}
