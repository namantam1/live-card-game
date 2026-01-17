// Audio Utilities

export const createAudioContext = () => {
  if (typeof window !== 'undefined') {
    return new (window.AudioContext || window.webkitAudioContext)();
  }
  return null;
};

export const playCardSound = (audioContext) => {
  if (!audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.frequency.value = 800;
  oscillator.type = 'sine';
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.1);
};

export const playTrumpSound = (audioContext) => {
  if (!audioContext) return;
  [400, 500, 600].forEach((freq, i) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = freq;
    oscillator.type = 'triangle';
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    oscillator.start(audioContext.currentTime + i * 0.05);
    oscillator.stop(audioContext.currentTime + 0.3);
  });
};

// Background music using HTML5 Audio
let bgMusic = null;
let isPageVisible = true;

export const startBackgroundMusic = () => {
  if (!bgMusic) {
    bgMusic = new Audio(`${import.meta.env.BASE_URL}audio/bgm.mp3`);
    bgMusic.loop = true;
    bgMusic.volume = 0.3;
  }
  if (isPageVisible) {
    bgMusic.play().catch(() => {});
  }
  return bgMusic;
};

export const stopBackgroundMusic = () => {
  if (bgMusic) {
    bgMusic.pause();
    bgMusic.currentTime = 0;
  }
};

export const pauseBackgroundMusic = () => {
  if (bgMusic && !bgMusic.paused) {
    bgMusic.pause();
  }
};

export const resumeBackgroundMusic = () => {
  if (bgMusic && bgMusic.paused && isPageVisible) {
    bgMusic.play().catch(() => {});
  }
};

// Handle page visibility changes
export const initVisibilityListener = () => {
  const handleVisibilityChange = () => {
    isPageVisible = !document.hidden;
    if (document.hidden) {
      pauseBackgroundMusic();
    } else {
      resumeBackgroundMusic();
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Return cleanup function
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
};
