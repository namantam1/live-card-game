import { Scene } from 'phaser';

export default class AudioManager {
  private static instance: AudioManager | null = null;
  private scene: Scene | null = null;
  private musicEnabled: boolean;
  private soundEnabled: boolean;
  private bgMusic: Phaser.Sound.BaseSound | null;

  private constructor() {
    // Load preferences from localStorage
    const savedMusicEnabled = localStorage.getItem('audioMusicEnabled');
    const savedSoundEnabled = localStorage.getItem('audioSoundEnabled');

    this.musicEnabled =
      savedMusicEnabled !== null ? savedMusicEnabled === 'true' : true;
    this.soundEnabled =
      savedSoundEnabled !== null ? savedSoundEnabled === 'true' : true;
    this.bgMusic = null;
  }

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  /**
   * Set the current scene context for audio operations
   * Should be called when a scene is created or becomes active
   */
  setScene(scene: Scene): this {
    this.scene = scene;
    return this;
  }

  /**
   * Get the current scene, returns null with warning if not set
   */
  private getScene(): Scene | null {
    if (!this.scene) {
      console.warn('AudioManager: Scene not set. Call setScene(scene) first.');
      return null;
    }
    return this.scene;
  }

  /**
   * Helper to play sound effects with consistent error handling
   */
  private playSound(audioKey: string, volume: number): void {
    if (!this.soundEnabled) return;

    const scene = this.getScene();
    if (!scene) return;

    try {
      if (scene.cache.audio.exists(audioKey)) {
        scene.sound.play(audioKey, { volume });
      }
    } catch (e) {
      console.log(`Could not play sound '${audioKey}'`, e);
    }
  }

  startBackgroundMusic() {
    if (!this.musicEnabled) return;
    if (this.bgMusic && this.bgMusic.isPlaying) return;

    const scene = this.getScene();
    if (!scene) return;

    try {
      if (scene.cache.audio.exists('bgm')) {
        if (!this.bgMusic) {
          this.bgMusic = scene.sound.add('bgm', {
            volume: 0.3,
            loop: true,
          });
        }
        this.bgMusic.play();
      }
    } catch (e) {
      console.log('Could not start background music', e);
    }
  }

  stopBackgroundMusic() {
    if (this.bgMusic && this.bgMusic.isPlaying) {
      this.bgMusic.stop();
    }
  }

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    localStorage.setItem('audioMusicEnabled', String(this.musicEnabled));

    if (this.musicEnabled) {
      this.startBackgroundMusic();
    } else {
      this.stopBackgroundMusic();
    }

    return this.musicEnabled;
  }

  toggleButtonSound() {
    this.soundEnabled = !this.soundEnabled;
    localStorage.setItem('audioSoundEnabled', String(this.soundEnabled));
    return this.soundEnabled;
  }

  isMusicEnabled() {
    return this.musicEnabled;
  }

  isSoundEnabled() {
    return this.soundEnabled;
  }

  playCardSound() {
    this.playSound('card-play', 0.3);
  }

  playButtonSound() {
    this.playSound('button-click', 0.4);
  }

  playWinSound() {
    this.playSound('game-end', 0.5);
  }

  playAlertSound() {
    this.playSound('alert', 0.4);
  }
}
