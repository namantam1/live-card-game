import {
  BaseGame,
  type PlayAreaConfig,
  type PlayerPositionConfig,
  type GameUIConfig,
  type GamePhaseConfig,
  type ActionPanelConfig,
  type CardPlayHandler,
} from '../BaseGame';
import type { CardData, PlayerData, GameState } from '../../type.d';
import type { Suit } from '../../utils/constants';
import { TRUMP_SUIT } from '../../utils/constants';
import { getValidCards, calculateScore as calcScore } from '../../utils/cards';
import {
  calculateBid,
  chooseBotCard,
  type TrickEntry,
} from '@call-break/shared';

/**
 * Call Break card game implementation
 */
export class CallBreakGame extends BaseGame {
  readonly id = 'callbreak';
  readonly name = 'Call Break';
  readonly minPlayers = 4;
  readonly maxPlayers = 4;
  readonly description = 'A classic trick-taking card game';

  getPlayAreaConfig(): PlayAreaConfig {
    return {
      type: 'trick',
      positions: 4,
    };
  }

  getPlayerPositions(): PlayerPositionConfig[] {
    return [
      { x: 0.5, y: 0.85, rotation: 0 }, // Bottom (local)
      { x: 0.2, y: 0.5, rotation: 90 }, // Left
      { x: 0.5, y: 0.15, rotation: 180 }, // Top
      { x: 0.8, y: 0.5, rotation: 270 }, // Right
    ];
  }

  getUIConfig(): GameUIConfig {
    return {
      showBidding: true,
      showTricks: true,
      showScoreboard: true,
      cardBackStyle: 'callbreak-back',
    };
  }

  validateMove(card: CardData, state: GameState): boolean {
    if (!state.currentPlayer.hand) return false;
    const validCards = this.getValidMoves(
      state.currentPlayer.hand,
      state.leadSuit,
      state.currentTrick
    );
    return validCards.some((c) => c.id === card.id);
  }

  getValidMoves(
    hand: CardData[],
    leadSuit: Suit | null,
    currentTrick: TrickEntry[]
  ): CardData[] {
    return getValidCards(hand, leadSuit, currentTrick);
  }

  calculateScore(player: PlayerData, _state: GameState): number {
    return calcScore(player.bid, player.tricksWon);
  }

  shouldEndRound(state: GameState): boolean {
    return state.trickNumber >= 13;
  }

  shouldEndGame(state: GameState): boolean {
    return state.currentRound >= 5;
  }

  override getWinner(players: PlayerData[]): PlayerData {
    return players.reduce((winner, player) =>
      player.score > winner.score ? player : winner
    );
  }

  getAIMove(hand: CardData[], state: GameState): CardData {
    return chooseBotCard(hand, state.leadSuit, state.currentTrick, {
      trumpSuit: TRUMP_SUIT,
      tricksWon: state.currentPlayer.tricksWon,
      bid: state.currentPlayer.bid,
      numPlayers: 4,
    });
  }

  getAIBid(hand: CardData[]): number {
    return calculateBid(hand, TRUMP_SUIT);
  }

  // ===== Rendering Config =====

  getPhases(): GamePhaseConfig[] {
    return [
      { id: 'dealing', label: 'Dealing', hasUI: false },
      { id: 'bidding', label: 'Bidding', hasUI: true },
      { id: 'playing', label: 'Playing', hasUI: false },
      { id: 'trickEnd', label: 'Trick End', hasUI: false },
      { id: 'roundEnd', label: 'Round End', hasUI: true },
      { id: 'gameOver', label: 'Game Over', hasUI: true },
    ];
  }

  getActionPanels(): ActionPanelConfig[] {
    return [{ type: 'bidding', showDuring: 'bidding' }];
  }

  override getCardPlayHandler(): CardPlayHandler {
    return 'trick';
  }
}
