import { Scene } from "phaser";
import {
  getResponsiveConfig,
  isMobile,
  SCOREBOARD_CONFIG,
} from "../../utils/uiConfig";
import { TOTAL_ROUNDS } from "../../utils/constants";

export default class ScoreBoard {
  scoreboard: Phaser.GameObjects.Container;
  scoreboardConfig: {
    height: number;
    padding: number,
    spacing: number;
    roundFontSize?: string | number;
    emojiFontSize?: string | number;
    scoreFontSize?: string | number;
    isMobile: boolean;
  };
  scoreboardBg: Phaser.GameObjects.Graphics;
  roundIndicator: Phaser.GameObjects.Text;
  divider: Phaser.GameObjects.Graphics;

  playerScoreEntries: any[];
  isMultiplayer: boolean;

  constructor(scene: Scene, isMultiplayer: boolean, players: any[], round: number) {
    this.isMultiplayer = isMultiplayer;

    const { width, height } = scene.cameras.main;

    // Get responsive sizing from centralized config
    const config: any = getResponsiveConfig(SCOREBOARD_CONFIG, width, height);
    const mobile = isMobile(width, height);

    // Modern compact horizontal scoreboard (pill-shaped)
    this.scoreboard = scene.add.container(config.margin, config.marginTop);
    this.scoreboard.setDepth(1000); // Ensure it's always on top

    // Store responsive values for updates
    this.scoreboardConfig = {
      isMobile: mobile,
      ...config,
    };

    // We'll rebuild the scoreboard content on each update
    this.scoreboardBg = scene.add.graphics();
    // Round text
    this.roundIndicator = scene.add
      .text(this.scoreboardConfig.padding, 0, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: this.scoreboardConfig.roundFontSize,
        fontStyle: "bold",
        color: "#94a3b8",
      })
      .setOrigin(0, 0.5);
    // Divider
    this.divider = scene.add.graphics();
    this.scoreboard.add([this.scoreboardBg, this.roundIndicator, this.divider]);

    // Player score entries (emoji + score)
    this.playerScoreEntries = [];
    players.forEach((player, index) => {
      const entry = {
        emoji: scene.add
          .text(0, 0, player.emoji, {
            fontFamily: "Arial, sans-serif",
            fontSize: this.scoreboardConfig.emojiFontSize,
          })
          .setOrigin(0, 0.5),
        score: scene.add
          .text(0, 0, "0.0", {
            fontFamily: "Arial, sans-serif",
            fontSize: this.scoreboardConfig.scoreFontSize,
            fontStyle: "bold",
            color: "#22c55e",
          })
          .setOrigin(0, 0.5),
        playerId: this.isMultiplayer ? player.id : index,
      };
      this.scoreboard.add([entry.emoji, entry.score]);
      this.playerScoreEntries.push(entry);
    });

    this.updateScoreboard(players, round);
  }

  updateScoreboard(players: any[], round: number) {
    const config = this.scoreboardConfig;

    // Update round indicator
    this.roundIndicator.setText(`R${round}/${TOTAL_ROUNDS}`);

    // Sort players by score for coloring
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    const topPlayer = sortedPlayers[0];

    // Calculate positions with responsive padding
    let xOffset = config.padding;
    const roundWidth = this.roundIndicator.width;
    xOffset += roundWidth + (config.isMobile ? 16 : 14);

    // Draw divider
    this.divider.clear();
    this.divider.fillStyle(0x475569, 1);
    const dividerHeight = config.height - 20;
    this.divider.fillRect(xOffset, -dividerHeight / 2, 2, dividerHeight);
    xOffset += config.isMobile ? 20 : 16;

    // Position each player entry
    this.playerScoreEntries.forEach((entry, index) => {
      const player = players[index];
      if (!player) return;

      const score = player.score;

      entry.emoji.setX(xOffset);
      entry.emoji.setY(0);
      xOffset += entry.emoji.width + config.spacing;

      entry.score.setText(score.toFixed(1));
      entry.score.setX(xOffset);
      entry.score.setY(0);

      // Color based on ranking and score
      const isTopPlayer = this.isMultiplayer
        ? player.id === topPlayer?.id
        : player === topPlayer;
      if (isTopPlayer && score > 0) {
        entry.score.setColor("#facc15"); // Yellow for leader
      } else if (score >= 0) {
        entry.score.setColor("#22c55e"); // Green for positive
      } else {
        entry.score.setColor("#ef4444"); // Red for negative
      }

      xOffset += entry.score.width + (config.isMobile ? 20 : 16);
    });

    // Draw background pill with responsive height
    const totalWidth = xOffset;
    const height = config.height;

    this.scoreboardBg.clear();
    this.scoreboardBg.fillStyle(0x0f172a, 0.95);
    this.scoreboardBg.fillRoundedRect(
      0,
      -height / 2,
      totalWidth,
      height,
      height / 2,
    );
    this.scoreboardBg.lineStyle(config.isMobile ? 2 : 1, 0x6366f1, 0.6);
    this.scoreboardBg.strokeRoundedRect(
      0,
      -height / 2,
      totalWidth,
      height,
      height / 2,
    );
  }
}
