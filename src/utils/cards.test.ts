import { describe, it, expect } from "vitest";
import { getValidCards } from "./cards";
import { CardData, TrickEntry } from "../type";

// Helper to create test cards
const createCard = (rank: string, suit: string): CardData => ({
  id: `${rank}-${suit}`,
  rank,
  suit,
  value:
    {
      "2": 2,
      "3": 3,
      "4": 4,
      "5": 5,
      "6": 6,
      "7": 7,
      "8": 8,
      "9": 9,
      "10": 10,
      J: 11,
      Q: 12,
      K: 13,
      A: 14,
    }[rank] || 0,
});

describe("getValidCards - Card Play Rules", () => {
  describe("Leading (no lead suit)", () => {
    it("should allow playing any card when leading", () => {
      const hand = [
        createCard("5", "hearts"),
        createCard("K", "spades"),
        createCard("2", "diamonds"),
      ];

      const validCards = getValidCards(hand, null, []);

      expect(validCards).toEqual(hand);
      expect(validCards).toHaveLength(3);
    });
  });

  describe("Rule #2: Must play higher card of lead suit if available", () => {
    it("should return only higher cards when player has higher cards of lead suit", () => {
      const hand = [
        createCard("5", "hearts"),
        createCard("Q", "hearts"),
        createCard("A", "hearts"),
        createCard("K", "spades"),
      ];

      const currentTrick: TrickEntry[] = [
        { playerIndex: 0, card: createCard("J", "hearts") },
      ];

      const validCards = getValidCards(hand, "hearts", currentTrick);

      expect(validCards).toHaveLength(2);
      expect(validCards).toContainEqual(createCard("Q", "hearts"));
      expect(validCards).toContainEqual(createCard("A", "hearts"));
      expect(validCards).not.toContainEqual(createCard("5", "hearts"));
    });

    it("should return all lead suit cards when player has no higher cards", () => {
      const hand = [
        createCard("5", "hearts"),
        createCard("7", "hearts"),
        createCard("K", "spades"),
      ];

      const currentTrick: TrickEntry[] = [
        { playerIndex: 0, card: createCard("A", "hearts") },
      ];

      const validCards = getValidCards(hand, "hearts", currentTrick);

      expect(validCards).toHaveLength(2);
      expect(validCards).toContainEqual(createCard("5", "hearts"));
      expect(validCards).toContainEqual(createCard("7", "hearts"));
      expect(validCards).not.toContainEqual(createCard("K", "spades"));
    });
  });

  describe("Rule #1: Trump (Spades) beats all other suits", () => {
    it("should allow playing higher spade when lead suit is non-trump and spade was played", () => {
      const hand = [
        createCard("5", "spades"),
        createCard("Q", "spades"),
        createCard("2", "diamonds"),
      ];

      const currentTrick: TrickEntry[] = [
        { playerIndex: 0, card: createCard("A", "hearts") },
        { playerIndex: 1, card: createCard("J", "spades") },
      ];

      const validCards = getValidCards(hand, "hearts", currentTrick);

      // Player is void in hearts, has higher spade than J
      expect(validCards).toHaveLength(1);
      expect(validCards).toContainEqual(createCard("Q", "spades"));
      expect(validCards).not.toContainEqual(createCard("5", "spades"));
    });

    it("should require playing higher spade when current highest is also a spade", () => {
      const hand = [
        createCard("5", "spades"),
        createCard("10", "spades"),
        createCard("A", "spades"),
      ];

      const currentTrick: TrickEntry[] = [
        { playerIndex: 0, card: createCard("Q", "spades") },
      ];

      const validCards = getValidCards(hand, "spades", currentTrick);

      expect(validCards).toHaveLength(1);
      expect(validCards).toContainEqual(createCard("A", "spades"));
    });
  });

  describe("Rule #3: When void in lead suit - Mandatory Trumping", () => {
    it("should require playing spade when void in lead suit (mandatoryTrumping=true)", () => {
      const hand = [
        createCard("5", "spades"),
        createCard("2", "diamonds"),
        createCard("3", "clubs"),
      ];

      const currentTrick: TrickEntry[] = [
        { playerIndex: 0, card: createCard("A", "hearts") },
      ];

      const validCards = getValidCards(hand, "hearts", currentTrick, true);

      expect(validCards).toHaveLength(1);
      expect(validCards).toContainEqual(createCard("5", "spades"));
    });

    it("should require wasting lower spade when cannot beat current highest (mandatoryTrumping=true)", () => {
      const hand = [
        createCard("5", "spades"),
        createCard("2", "diamonds"),
        createCard("3", "clubs"),
      ];

      const currentTrick: TrickEntry[] = [
        { playerIndex: 0, card: createCard("A", "hearts") },
        { playerIndex: 1, card: createCard("K", "spades") },
      ];

      const validCards = getValidCards(hand, "hearts", currentTrick, true);

      // Must waste the lower spade
      expect(validCards).toHaveLength(1);
      expect(validCards).toContainEqual(createCard("5", "spades"));
    });

    it("should allow playing any card when cannot beat highest and mandatoryTrumping=false", () => {
      const hand = [
        createCard("5", "spades"),
        createCard("2", "diamonds"),
        createCard("3", "clubs"),
      ];

      const currentTrick: TrickEntry[] = [
        { playerIndex: 0, card: createCard("A", "hearts") },
        { playerIndex: 1, card: createCard("K", "spades") },
      ];

      const validCards = getValidCards(hand, "hearts", currentTrick, false);

      // Overtake exception: can play any card
      expect(validCards).toHaveLength(3);
      expect(validCards).toEqual(hand);
    });

    it("should require playing higher spade even with mandatoryTrumping=false when can beat", () => {
      const hand = [
        createCard("A", "spades"),
        createCard("2", "diamonds"),
        createCard("3", "clubs"),
      ];

      const currentTrick: TrickEntry[] = [
        { playerIndex: 0, card: createCard("A", "hearts") },
        { playerIndex: 1, card: createCard("5", "spades") },
      ];

      const validCards = getValidCards(hand, "hearts", currentTrick, false);

      // Must play higher spade
      expect(validCards).toHaveLength(1);
      expect(validCards).toContainEqual(createCard("A", "spades"));
    });

    it("should allow any card when void in lead suit and no spades in hand", () => {
      const hand = [
        createCard("2", "diamonds"),
        createCard("3", "clubs"),
        createCard("5", "hearts"),
      ];

      const currentTrick: TrickEntry[] = [
        { playerIndex: 0, card: createCard("A", "spades") },
      ];

      const validCards = getValidCards(hand, "spades", currentTrick);

      // Void in spades (trump), no spades in hand, can play anything
      expect(validCards).toHaveLength(3);
      expect(validCards).toEqual(hand);
    });
  });

  describe("Complex scenarios", () => {
    it("should handle multiple players with mixed suits and find correct highest card", () => {
      const hand = [
        createCard("7", "hearts"),
        createCard("Q", "hearts"),
        createCard("K", "spades"),
      ];

      const currentTrick: TrickEntry[] = [
        { playerIndex: 0, card: createCard("5", "hearts") },
        { playerIndex: 1, card: createCard("J", "hearts") },
        { playerIndex: 2, card: createCard("A", "diamonds") }, // Different suit, doesn't matter
      ];

      const validCards = getValidCards(hand, "hearts", currentTrick);

      // Must play higher than J of hearts
      expect(validCards).toHaveLength(1);
      expect(validCards).toContainEqual(createCard("Q", "hearts"));
    });

    it("should handle trump beating lead suit correctly", () => {
      const hand = [
        createCard("2", "spades"),
        createCard("Q", "clubs"),
        createCard("K", "diamonds"),
      ];

      const currentTrick: TrickEntry[] = [
        { playerIndex: 0, card: createCard("A", "hearts") },
      ];

      const validCards = getValidCards(hand, "hearts", currentTrick);

      // Void in hearts, must play spade
      expect(validCards).toHaveLength(1);
      expect(validCards).toContainEqual(createCard("2", "spades"));
    });

    it("should require beating a trump with higher trump when void in lead suit", () => {
      const hand = [
        createCard("2", "spades"),
        createCard("Q", "spades"),
        createCard("K", "diamonds"),
      ];

      const currentTrick: TrickEntry[] = [
        { playerIndex: 0, card: createCard("A", "hearts") },
        { playerIndex: 1, card: createCard("5", "spades") },
      ];

      const validCards = getValidCards(hand, "hearts", currentTrick);

      // Must play higher spade than 5
      expect(validCards).toHaveLength(1);
      expect(validCards).toContainEqual(createCard("Q", "spades"));
    });
  });
});
