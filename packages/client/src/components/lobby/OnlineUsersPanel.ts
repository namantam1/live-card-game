import Phaser from 'phaser';
import Button from '../shared/Button';

export interface OnlineUser {
  id: string;
  name: string;
  inGame: boolean;
}

export interface OnlineUsersPanelConfig {
  width?: number;
  expandedHeight?: number;
  collapsedHeight?: number;
  padding?: number;
}

export interface OnlineUsersPanelCallbacks {
  onInviteUser: (userId: string) => void;
}

/**
 * OnlineUsersPanel - A modern, reusable panel component that displays online users
 * with glassmorphism design, avatars, and smooth animations
 */
export class OnlineUsersPanel {
  private scene: Phaser.Scene;
  public container: Phaser.GameObjects.Container;
  private panelBg!: Phaser.GameObjects.Graphics;
  private panelGlow!: Phaser.GameObjects.Graphics;
  private headerContainer!: Phaser.GameObjects.Container;
  private panelTitle!: Phaser.GameObjects.Text;
  private userCountBadge!: Phaser.GameObjects.Container;
  private userCountText!: Phaser.GameObjects.Text;
  private toggleBtn!: Phaser.GameObjects.Container;
  private usersContainer!: Phaser.GameObjects.Container;
  private isCollapsed = false;
  private callbacks: OnlineUsersPanelCallbacks;
  private userItemContainers: Phaser.GameObjects.Container[] = [];

  // Configuration
  private panelWidth: number;
  private expandedHeight: number;
  private collapsedHeight: number;
  private screenHeight: number;
  private bottomPadding: number;
  private localPlayerId: string = '';
  private canInvite: boolean = false;
  private pendingInvitees: Set<string> = new Set();
  private onlineUsers: OnlineUser[] = [];

  // Modern design colors
  private readonly colors = {
    panelBg: 0x0a0e27,
    panelAccent: 0x1e3a8a,
    headerGradient: [0x6366f1, 0x8b5cf6],
    online: 0x10b981,
    inGame: 0xf59e0b,
    invited: 0x3b82f6,
    textPrimary: '#ffffff',
    textSecondary: '#94a3b8',
    avatarColors: [0xef4444, 0xf59e0b, 0x10b981, 0x3b82f6, 0x8b5cf6, 0xec4899],
  };

  constructor(
    scene: Phaser.Scene,
    callbacks: OnlineUsersPanelCallbacks,
    _config: OnlineUsersPanelConfig = {}
  ) {
    const {
      width: panelWidth = 420,
      expandedHeight = 320,
      collapsedHeight = 50,
      padding = 20,
    } = _config;
    this.scene = scene;
    this.callbacks = callbacks;

    // Apply config with defaults
    this.panelWidth = panelWidth;
    this.expandedHeight = expandedHeight;
    this.collapsedHeight = collapsedHeight;

    // Create container
    this.container = this.scene.add.container(0, 0);

    // Position panel (default: bottom-right with padding)
    const { width, height } = this.scene.cameras.main;

    // Store for later use during collapse/expand
    this.screenHeight = height;
    this.bottomPadding = padding;

    const x = width - this.panelWidth / 2 - padding;
    const y = height - this.expandedHeight / 2 - padding;
    this.container.setPosition(x, y);

    this.createPanel();
  }

  private createPanel() {
    // Glow effect (outer shadow)
    this.panelGlow = this.scene.add.graphics();

    // Main background with glassmorphism
    this.panelBg = this.scene.add.graphics();

    // Header container
    this.headerContainer = this.scene.add.container(
      -this.panelWidth / 2 + 20,
      -this.expandedHeight / 2 + 25
    );

    // Title with gradient effect
    this.panelTitle = this.scene.add
      .text(0, 0, '● Online', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0, 0.5);

    // User count badge
    const badgeBg = this.scene.add.graphics();
    badgeBg.fillStyle(0x6366f1, 0.3);
    badgeBg.lineStyle(2, 0x6366f1, 0.8);
    badgeBg.fillRoundedRect(0, -12, 36, 24, 12);
    badgeBg.strokeRoundedRect(0, -12, 36, 24, 12);

    this.userCountText = this.scene.add
      .text(18, 0, '0', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#c7d2fe',
      })
      .setOrigin(0.5);

    this.userCountBadge = this.scene.add.container(95, 0);
    this.userCountBadge.add([badgeBg, this.userCountText]);

    // Modern toggle button with icon background
    const toggleBg = this.scene.add.graphics();
    toggleBg.fillStyle(0x1e293b, 0.5);
    toggleBg.fillRoundedRect(-18, -18, 36, 36, 18);

    const toggleIcon = this.scene.add
      .text(0, 0, '▼', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#cbd5e1',
      })
      .setOrigin(0.5);

    this.toggleBtn = this.scene.add.container(
      this.panelWidth / 2 - 40,
      -this.expandedHeight / 2 + 25
    );
    this.toggleBtn.add([toggleBg, toggleIcon]);
    this.toggleBtn.setSize(36, 36);
    this.toggleBtn.setInteractive({ useHandCursor: true });

    // Hover effect for toggle button
    this.toggleBtn.on('pointerover', () => {
      this.scene.tweens.add({
        targets: toggleBg,
        alpha: 0.8,
        duration: 200,
      });
    });

    this.toggleBtn.on('pointerout', () => {
      this.scene.tweens.add({
        targets: toggleBg,
        alpha: 1,
        duration: 200,
      });
    });

    this.toggleBtn.on('pointerdown', () => {
      this.isCollapsed = !this.isCollapsed;
      this.animateToggle(toggleIcon);
      this.refresh();
    });

    this.headerContainer.add([this.panelTitle, this.userCountBadge]);

    // Users container with padding
    this.usersContainer = this.scene.add.container(
      0,
      -this.expandedHeight / 2 + 70
    );

    // Add all to main container
    this.container.add([
      this.panelGlow,
      this.panelBg,
      this.headerContainer,
      this.toggleBtn,
      this.usersContainer,
    ]);

    // Initial render
    this.refresh();
  }

  private animateToggle(icon: Phaser.GameObjects.Text) {
    const rotation = this.isCollapsed ? 0 : Math.PI;
    this.scene.tweens.add({
      targets: icon,
      angle: rotation * (180 / Math.PI),
      duration: 300,
      ease: 'Back.easeOut',
    });
  }

  /**
   * Update the list of online users displayed in the panel
   */
  public updateUsers(
    users: OnlineUser[],
    localPlayerId: string,
    canInvite: boolean,
    pendingInvitees: Set<string>
  ) {
    this.onlineUsers = users;
    this.localPlayerId = localPlayerId;
    this.canInvite = canInvite;
    this.pendingInvitees = pendingInvitees;

    this.renderUsersList();
    this.refresh();
  }

  private renderUsersList() {
    // Clear existing list
    this.usersContainer.removeAll(true);
    this.userItemContainers = [];

    // Filter out local player
    const visibleUsers = this.onlineUsers.filter(
      (user) => user.id !== this.localPlayerId
    );

    // Update count badge
    this.userCountText.setText(visibleUsers.length.toString());

    // Show empty state if no users
    if (visibleUsers.length === 0) {
      const emptyContainer = this.scene.add.container(0, 80);

      const emptyIcon = this.scene.add
        .text(0, 0, '👥', {
          fontSize: '48px',
        })
        .setOrigin(0.5);

      const emptyText = this.scene.add
        .text(0, 50, 'No users online', {
          fontFamily: 'Arial, sans-serif',
          fontSize: '16px',
          color: '#64748b',
        })
        .setOrigin(0.5);

      emptyContainer.add([emptyIcon, emptyText]);
      this.usersContainer.add(emptyContainer);
      return;
    }

    // Render each user with modern design
    visibleUsers.forEach((user, index) => {
      const userItem = this.createModernUserItem(user, index);
      this.userItemContainers.push(userItem);
      this.usersContainer.add(userItem);
    });
  }

  private createModernUserItem(
    user: OnlineUser,
    index: number
  ): Phaser.GameObjects.Container {
    const y = index * 72; // More spacing for modern look
    const itemContainer = this.scene.add.container(0, y);

    // Avatar circle with user initial
    const avatarColor = this.getAvatarColor(user.id);
    const avatar = this.scene.add.graphics();
    avatar.fillStyle(avatarColor, 1);
    avatar.fillCircle(-this.panelWidth / 2 + 45, 10, 20);

    // Avatar border with glow
    avatar.lineStyle(3, avatarColor, 0.5);
    avatar.strokeCircle(-this.panelWidth / 2 + 45, 10, 23);

    // User initial
    const initial = this.scene.add
      .text(-this.panelWidth / 2 + 45, 10, user.name.charAt(0).toUpperCase(), {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // User name with better typography
    const nameText = this.scene.add
      .text(-this.panelWidth / 2 + 80, 10, user.name, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '17px',
        fontStyle: 'bold',
        color: this.colors.textPrimary,
      })
      .setOrigin(0, 0.5);

    // Truncate long names to prevent overlap with status badges
    const maxNameWidth = 140;
    if (nameText.width > maxNameWidth) {
      let truncated = user.name;
      while (nameText.width > maxNameWidth && truncated.length > 0) {
        truncated = truncated.substring(0, truncated.length - 1);
        nameText.setText(truncated + '...');
      }
    }

    // Status badge or invite button (positioned on the right side)
    const statusElement = this.createStatusElement(
      user,
      this.panelWidth / 2 - 110,
      12
    );

    itemContainer.add([avatar, initial, nameText, statusElement]);

    return itemContainer;
  }

  private createStatusElement(
    user: OnlineUser,
    x: number,
    y: number
  ): Phaser.GameObjects.Container {
    const statusContainer = this.scene.add.container(x, y);

    if (user.inGame) {
      // In Game badge
      const badge = this.createStatusBadge('🎮 In Game', this.colors.inGame);
      statusContainer.add(badge);
    } else if (this.pendingInvitees.has(user.id)) {
      // Invited badge with animation
      const badge = this.createStatusBadge('📨 Invited', this.colors.invited);
      statusContainer.add(badge);

      // Pulse animation
      this.scene.tweens.add({
        targets: badge,
        alpha: 0.6,
        duration: 800,
        yoyo: true,
        repeat: -1,
      });
    } else if (this.canInvite) {
      // Modern invite button
      const inviteBtn = this.createModernInviteButton(user.id);
      statusContainer.add(inviteBtn);
    } else {
      // Online badge
      const badge = this.createStatusBadge('● Online', this.colors.online);
      statusContainer.add(badge);
    }

    return statusContainer;
  }

  private createStatusBadge(
    text: string,
    color: number
  ): Phaser.GameObjects.Container {
    const badgeContainer = this.scene.add.container(0, 0);

    const badge = this.scene.add.graphics();
    badge.fillStyle(color, 0.2);
    badge.lineStyle(1.5, color, 0.6);
    const width = text.length * 8 + 16;
    badge.fillRoundedRect(0, -10, width, 20, 10);
    badge.strokeRoundedRect(0, -10, width, 20, 10);

    const badgeText = this.scene.add
      .text(width / 2, 0, text, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: this.getColorString(color),
      })
      .setOrigin(0.5);

    badgeContainer.add([badge, badgeText]);
    return badgeContainer;
  }

  private createModernInviteButton(
    userId: string
  ): Phaser.GameObjects.Container {
    return Button.create(this.scene, 50, 0, {
      width: 90,
      height: 28,
      text: '✉ Invite',
      fontSize: '13px',
      onClick: () => this.callbacks.onInviteUser(userId),
    });
  }

  private getAvatarColor(userId: string): number {
    // Generate consistent color based on user ID
    const hash = userId
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return this.colors.avatarColors[hash % this.colors.avatarColors.length];
  }

  private getColorString(color: number): string {
    return '#' + color.toString(16).padStart(6, '0');
  }

  /**
   * Refresh the panel layout based on collapsed state with smooth animations
   */
  private refresh() {
    const height = this.isCollapsed
      ? this.collapsedHeight
      : this.expandedHeight;

    // Outer glow effect (shadow)
    this.panelGlow.clear();
    this.panelGlow.fillStyle(0x6366f1, 0.15);
    this.panelGlow.fillRoundedRect(
      -this.panelWidth / 2 - 4,
      -height / 2 - 4,
      this.panelWidth + 8,
      height + 8,
      18
    );

    // Main background with glassmorphism effect
    this.panelBg.clear();

    // Dark base with gradient
    this.panelBg.fillGradientStyle(
      this.colors.panelBg,
      this.colors.panelBg,
      0x0f172a,
      0x0f172a,
      0.95,
      0.95,
      0.98,
      0.98
    );
    this.panelBg.fillRoundedRect(
      -this.panelWidth / 2,
      -height / 2,
      this.panelWidth,
      height,
      16
    );

    // Accent border with gradient effect
    this.panelBg.lineStyle(2, 0x475569, 0.6);
    this.panelBg.strokeRoundedRect(
      -this.panelWidth / 2,
      -height / 2,
      this.panelWidth,
      height,
      16
    );

    // Top accent bar with gradient
    this.panelBg.fillGradientStyle(
      this.colors.headerGradient[0],
      this.colors.headerGradient[1],
      this.colors.headerGradient[0],
      this.colors.headerGradient[1],
      0.3,
      0.3,
      0.1,
      0.1
    );
    this.panelBg.fillRoundedRect(
      -this.panelWidth / 2,
      -height / 2,
      this.panelWidth,
      50,
      { tl: 16, tr: 16, bl: 0, br: 0 }
    );

    // Update header position
    this.headerContainer.setPosition(
      -this.panelWidth / 2 + 20,
      -height / 2 + 25
    );
    this.toggleBtn.setPosition(this.panelWidth / 2 - 40, -height / 2 + 25);

    // Update container Y position to keep panel anchored to bottom
    const newY = this.screenHeight - height / 2 - this.bottomPadding;

    // Animate position change to keep anchored to bottom
    this.scene.tweens.add({
      targets: this.container,
      y: newY,
      duration: 300,
      ease: 'Back.easeOut',
    });

    // Animate users container visibility
    if (this.isCollapsed) {
      this.scene.tweens.add({
        targets: this.usersContainer,
        alpha: 0,
        duration: 200,
        onComplete: () => {
          this.usersContainer.setVisible(false);
        },
      });
    } else {
      this.usersContainer.setVisible(true);
      this.usersContainer.setAlpha(0);
      this.scene.tweens.add({
        targets: this.usersContainer,
        alpha: 1,
        duration: 300,
        delay: 100,
      });
    }
  }

  public destroy() {
    this.container.destroy();
  }
}
