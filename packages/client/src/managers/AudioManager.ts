import { Scene } from 'phaser';

export default class AudioManager {
  scene: any;
  enabled: boolean;
  musicEnabled: boolean;
  soundEnabled: boolean;
  bgMusic: Phaser.Sound.BaseSound | null;
  audioContext: AudioContext | null;
  initialized: boolean;
  constructor(scene: Scene) {
    this.scene = scene;
    // Load preferences from localStorage
    const savedMusicEnabled = localStorage.getItem('audioMusicEnabled');
    const savedSoundEnabled = localStorage.getItem('audioSoundEnabled');

    this.enabled = true;
    this.musicEnabled =
      savedMusicEnabled !== null ? savedMusicEnabled === 'true' : true;
    this.soundEnabled =
      savedSoundEnabled !== null ? savedSoundEnabled === 'true' : true;
    this.bgMusic = null;
    this.audioContext = null;
    this.initialized = false;
  }

  init() {
    // Don't auto-create AudioContext - wait for user gesture
    // This will be created on first sound play
    this.initialized = true;
  }

  ensureAudioContext() {
    if (!this.audioContext) {
      try {
        this.audioContext = new (
          window.AudioContext || (window as any).webkitAudioContext
        )();
      } catch (e) {
        console.log('Could not create AudioContext');
      }
    }
    // Resume if suspended
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  startBackgroundMusic() {
    if (!this.musicEnabled) return;
    if (this.bgMusic && this.bgMusic.isPlaying) return;

    try {
      if (this.scene.cache.audio.exists('bgm')) {
        if (!this.bgMusic) {
          this.bgMusic = this.scene.sound.add('bgm', {
            volume: 0.3,
            loop: true,
          });
        }
        this.bgMusic!.play();
      }
    } catch (e) {
      console.log('Could not start background music');
    }
  }

  stopBackgroundMusic() {
    if (this.bgMusic && this.bgMusic.isPlaying) {
      this.bgMusic.stop();
    }
  }

  toggleSound() {
    this.enabled = !this.enabled;
    this.musicEnabled = this.enabled;
    this.soundEnabled = this.enabled;

    if (this.enabled) {
      this.ensureAudioContext();
      this.startBackgroundMusic();
    } else {
      this.stopBackgroundMusic();
    }

    return this.enabled;
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
    if (!this.soundEnabled) return;
    this.ensureAudioContext();
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      this.audioContext.currentTime + 0.1
    );

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.1);
  }

  playTrumpSound() {
    if (!this.soundEnabled) return;
    this.ensureAudioContext();
    if (!this.audioContext) return;

    [400, 500, 600].forEach((freq, i) => {
      const oscillator = this.audioContext!.createOscillator();
      const gainNode = this.audioContext!.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext!.destination);

      oscillator.frequency.value = freq;
      oscillator.type = 'triangle';

      gainNode.gain.setValueAtTime(0.15, this.audioContext!.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext!.currentTime + 0.3
      );

      oscillator.start(this.audioContext!.currentTime + i * 0.05);
      oscillator.stop(this.audioContext!.currentTime + 0.3);
    });
  }

  playButtonSound() {
    if (!this.soundEnabled) return;
    this.ensureAudioContext();
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.value = 600;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      this.audioContext.currentTime + 0.05
    );

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.05);
  }

  playWinSound() {
    if (!this.soundEnabled) return;
    this.ensureAudioContext();
    if (!this.audioContext) return;

    [523, 659, 784, 1047].forEach((freq, i) => {
      const oscillator = this.audioContext!.createOscillator();
      const gainNode = this.audioContext!.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext!.destination);

      oscillator.frequency.value = freq;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.2, this.audioContext!.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext!.currentTime + 0.4
      );

      oscillator.start(this.audioContext!.currentTime + i * 0.1);
      oscillator.stop(this.audioContext!.currentTime + 0.4);
    });
  }

  isEnabled() {
    return this.enabled;
  }

  destroy() {
    this.stopBackgroundMusic();
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}
