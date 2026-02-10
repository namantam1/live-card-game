import { Scene } from 'phaser';
import BaseModal from './BaseModal';
import AudioManager from '../../../managers/AudioManager';
import { COLORS } from '../../../utils/constants';

const HEIGHT = 300;
const WIDTH = 300;
const SETTINGS_LABEL_FONT_SIZE = '22px';
const ITEM_SPACING = 50;

export default class SettingsModal extends BaseModal {
  private onNewGame: (() => void) | null;
  private onQuit: () => void;

  constructor(
    scene: Scene,
    config: {
      onQuit: () => void;
      onNewGame: null | (() => void);
    }
  ) {
    const { onNewGame, onQuit } = config;
    super(scene, {
      title: 'Settings',
      closeOnOverlayClick: true,
      clearContentOnHide: false,
      width: WIDTH,
      height: onNewGame ? HEIGHT : HEIGHT - ITEM_SPACING,
    });
    this.onNewGame = onNewGame;
    this.onQuit = onQuit;

    this.buildSettingsContent();
  }

  private buildSettingsContent() {
    let startY = -80;

    // Music row
    this.createSettingRow(
      0,
      startY,
      'Music',
      AudioManager.getInstance().isMusicEnabled(),
      () => {
        AudioManager.getInstance().toggleMusic();
      }
    );
    startY += ITEM_SPACING;

    // Sound row
    this.createSettingRow(
      0,
      startY,
      'Sound',
      AudioManager.getInstance().isSoundEnabled(),
      () => {
        AudioManager.getInstance().toggleButtonSound();
      }
    );
    startY += ITEM_SPACING;

    // Divider
    const divider = this.scene.add.graphics();
    divider.fillStyle(0x475569, 0.3);
    divider.fillRect(-100, startY - 20, 200, 1);
    this.content.add(divider);

    // Action buttons
    if (this.onNewGame) {
      const newGameBtn = this.createModalButton({
        x: 0,
        y: startY + 15,
        text: 'New Game',
        callback: () => {
          this.hide();
          this.onNewGame!();
        },
      });
      this.content.add(newGameBtn);
      startY += ITEM_SPACING;
    }

    const quitBtn = this.createModalButton({
      x: 0,
      y: startY + 15,
      text: 'Quit',
      callback: () => {
        this.hide();
        this.onQuit();
      },
      bgColor: COLORS.DANGER,
    });
    this.content.add(quitBtn);
  }

  private createSettingRow(
    x: number,
    y: number,
    label: string,
    initialState: boolean = false,
    callback: () => void
  ) {
    const container = this.scene.add.container(x, y);
    let isEnabled = initialState;

    // Label with responsive font size
    const labelText = this.scene.add
      .text(-100, 0, label, {
        fontFamily: 'Arial, sans-serif',
        fontSize: SETTINGS_LABEL_FONT_SIZE,
        color: '#e2e8f0',
      })
      .setOrigin(0, 0.5);

    // Toggle pill
    const toggleWidth = 46;
    const toggleHeight = 26;
    const toggleBg = this.scene.add.graphics();
    const toggleKnob = this.scene.add.graphics();

    const drawToggle = () => {
      toggleBg.clear();
      toggleBg.fillStyle(isEnabled ? 0x6366f1 : 0x334155, 1);
      toggleBg.fillRoundedRect(
        100 - toggleWidth,
        -toggleHeight / 2,
        toggleWidth,
        toggleHeight,
        toggleHeight / 2
      );

      toggleKnob.clear();
      toggleKnob.fillStyle(0xffffff, 1);
      const knobX = isEnabled ? 100 - 14 : 100 - toggleWidth + 14;
      toggleKnob.fillCircle(knobX, 0, 10);
    };
    drawToggle();

    const hitArea = this.scene.add.rectangle(
      100 - toggleWidth / 2,
      0,
      toggleWidth + 10,
      toggleHeight + 10,
      0x000000,
      0
    );
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on('pointerdown', () => {
      isEnabled = !isEnabled;
      drawToggle();
      AudioManager.getInstance().playButtonSound();
      callback();
    });

    container.add([labelText, toggleBg, toggleKnob, hitArea]);
    this.content.add(container);
  }

  showSettings() {
    // console.log('Showing settings modal');
    this.show();
  }
}
