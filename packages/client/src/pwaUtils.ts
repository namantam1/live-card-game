import { registerSW } from 'virtual:pwa-register';

/**
 * Register service worker with update notification
 * Follows best practices for game PWA updates
 */
export function registerServiceWorker() {
  const updateSW = registerSW({
    onNeedRefresh() {
      // Auto-update in background, but show a notification
      // The update will apply on next visit without interrupting current session
      console.log('New version available, updating in background...');
      showToast('New version available, updating game...', 5000);
      // Optionally: auto-reload immediately (uncomment if preferred)
      setTimeout(() => {
        updateSW(true);
      }, 5000);
      // // Show a simple update notification
      // const shouldUpdate = confirm(
      //   "A new version of Call Break is available! Click OK to update now or Cancel to update later.",
      // );
      // if (shouldUpdate) {
      //   updateSW(true);
      // }
    },
    onOfflineReady() {
      console.log('Call Break is ready to work offline!');
      // Optional: Show a toast notification
      showToast('Game is ready to play offline!');
    },
    onRegistered(registration) {
      console.log('Service Worker registered successfully');

      // Check for updates periodically (every hour)
      if (registration) {
        setInterval(
          () => {
            registration.update();
          },
          60 * 60 * 1000
        ); // 1 hour
      }
    },
    onRegisterError(error) {
      console.error('Service Worker registration failed:', error);
    },
  });

  return updateSW;
}

/**
 * Simple toast notification for PWA events
 * @param message - The message to display
 * @param duration - Duration in milliseconds before auto-dismissing (default: 3000)
 */
function showToast(message: string, duration: number = 3000): void {
  // Create toast element
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(129, 140, 248, 0.95);
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-family: sans-serif;
    font-size: 14px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    animation: slideUp 0.3s ease-out;
  `;

  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(toast);

  // Remove toast after specified duration
  setTimeout(() => {
    toast.style.animation = 'slideUp 0.3s ease-in reverse';
    setTimeout(() => {
      document.body.removeChild(toast);
      document.head.removeChild(style);
    }, 300);
  }, duration);
}

/**
 * Check if the app is running as a PWA
 */
export function isPWA(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

/**
 * Force landscape orientation on mobile devices
 * Only enforces on mobile, allows desktop to be flexible
 */
export function enforceLandscapeOnMobile(): void {
  // Check if device is mobile
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

  if (!isMobile) {
    return; // Don't enforce on desktop
  }

  // Check if screen orientation API is available
  if (!screen.orientation) {
    console.warn('Screen Orientation API not supported');
    return;
  }

  // Function to check and show warning
  function checkOrientation(): void {
    const isPortrait = window.innerHeight > window.innerWidth;

    if (isPortrait) {
      showOrientationWarning();
    } else {
      hideOrientationWarning();
    }
  }

  // Show orientation warning overlay
  function showOrientationWarning(): void {
    let overlay = document.getElementById('orientation-overlay');

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'orientation-overlay';
      overlay.innerHTML = `
        <div style="text-align: center;">
          <svg width="100" height="100" viewBox="0 0 100 100" style="margin-bottom: 20px;">
            <rect x="25" y="15" width="50" height="70" rx="5" fill="none" stroke="white" stroke-width="3"/>
            <path d="M 40 45 L 60 45 M 50 35 L 50 55" stroke="white" stroke-width="3" stroke-linecap="round"/>
          </svg>
          <p style="font-size: 20px; margin: 0; font-weight: bold;">Please rotate your device</p>
          <p style="font-size: 14px; margin: 10px 0 0 0; opacity: 0.8;">This game is best played in landscape mode</p>
        </div>
      `;
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #1a1a2e;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        font-family: sans-serif;
      `;
      document.body.appendChild(overlay);
    } else {
      overlay.style.display = 'flex';
    }
  }

  // Hide orientation warning overlay
  function hideOrientationWarning(): void {
    const overlay = document.getElementById('orientation-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  // Initial check
  checkOrientation();

  // Listen for orientation changes
  window.addEventListener('resize', checkOrientation);
  window.addEventListener('orientationchange', checkOrientation);
}
