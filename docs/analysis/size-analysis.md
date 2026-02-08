```ts
import NetworkIndicator from '../components/NetworkIndicator';
import AudioManager from '../managers/AudioManager';
import SettingsModal from '../objects/game/SettingsModal';
import type { CardData } from '../type';
import { createDeck, shuffleDeck } from '../utils/cards';
import { COLORS, SUITS } from '../utils/constants';
import ScoreBoard from '../objects/game/ScoreBoard';
import Common from '../objects/game/Common';
import Player from '../objects/Player';
import TrickArea from '../objects/TrickArea';
import BootScene from './BootScene';
import ReactionPanel from '../components/ReactionPanel';
import Button from '../components/Button';
import { OnlineUsersPanel } from '../components/lobby/OnlineUsersPanel';
import { InviteModal } from '../components/InviteModal';
import ChatPanel from '../components/ChatPanel';

const CARD: CardData = createDeck()[0];

export default class DebugScene extends Phaser.Scene {
  audioManager: AudioManager = new AudioManager(this);
  private domInput: Phaser.GameObjects.DOMElement | null = null;

  constructor() {
    super({ key: 'DebugScene' });
  }

  preload() {
    BootScene.loadAssets(this);
  }

  create() {
    // Add a background so we can see the scene is working
    const rect = this.add
      .rectangle(100, 50, 400, 400, 0x1a1a2e)
      .setOrigin(0, 0);
    rect.fillColor = COLORS.PRIMARY;

    // Add text label
    this.add
      .text(100, 470, 'Debug Input Field:', {
        fontSize: '24px',
        color: '#ffffff',
      })
      .setOrigin(0, 0);

    // createFromHTML takes an HTML string
    const inputHTML = `
      <input 
        type="text" 
        id="chatInput"
        placeholder="Type message..."
        maxlength="200"
        style="
          width: 300px;
          height: 40px;
          padding: 8px 12px;
          background: #ff0000;
          border: 2px solid #ffffff;
          border-radius: 6px;
          color: #f1f5f9;
          font-family: Arial, sans-serif;
          font-size: 16px;
          outline: none;
        "
      />
    `;

    // Create DOM element with game coordinates
    // DOM elements need special handling for scaled games
    this.domInput = this.add
      .dom(100, 510)
      .createFromHTML(inputHTML)
      .setOrigin(0, 0);

    // Update position on scale
    this.updateDOMPosition();

    // Listen for scale changes
    this.scale.on('resize', this.updateDOMPosition, this);

    // Log debug info
    // console.log('DOM element created');
    // console.log('Game size:', this.scale.gameSize);
    // console.log('Display size:', this.scale.displaySize);
    // console.log('Scale:', this.scale.displayScale);
  }

  private updateDOMPosition() {
    if (!this.domInput) return;

    // Convert game coordinates to screen coordinates
    const gameX = 100;
    const gameY = 510;

    // Get the camera's world view
    const camera = this.cameras.main;

    console.log(
      'Display Size:',
      this.scale.displaySize.width,
      this.scale.displaySize.height
    );
    console.log(
      'Game Size:',
      this.scale.gameSize.aspectRatio,
      this.scale.gameSize.width,
      this.scale.gameSize.height
    );
    console.log('Camera Scroll:', camera.scrollX, camera.scrollY);
    console.log('Camera Position:', camera.x, camera.y);

    // Calculate screen position accounting for scale
    const scaleX = this.scale.displaySize.width / this.scale.gameSize.width;
    const scaleY = this.scale.displaySize.height / this.scale.gameSize.height;

    const screenX = (gameX - camera.scrollX) * scaleX + camera.x;
    const screenY = (gameY - camera.scrollY) * scaleY + camera.y;

    // Set the DOM element position directly
    this.domInput.setPosition(screenX, screenY);

    console.log(
      `Updated position - Game: (${gameX}, ${gameY}), Screen: (${screenX}, ${screenY}), Scale: (${scaleX}, ${scaleY})`
    );
  }

  destroy() {
    this.scale.off('resize', this.updateDOMPosition, this);
  }
}
```
