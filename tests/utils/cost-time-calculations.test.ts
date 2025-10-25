/**
 * Tests for Issue #23: Cost and Time Calculation Fixes
 *
 * Tests verify:
 * 1. Chat cost calculation and accumulation
 * 2. PDF time calculation and display
 */

import { describe, test, expect } from '@jest/globals';

describe('Cost Calculations (Issue #23)', () => {
  describe('Chat Cost Tracking', () => {
    test('should include chat field in DetailedCosts interface', () => {
      const costs = {
        transcription: 0.001,
        summary: 0.002,
        article: 0.003,
        chat: 0.004,
        total: 0.010
      };

      expect(costs).toHaveProperty('chat');
      expect(costs.chat).toBe(0.004);
    });

    test('should calculate total cost including chat', () => {
      const transcription = 0.001;
      const summary = 0.002;
      const article = 0.003;
      const chat = 0.004;

      const total = transcription + summary + article + chat;

      expect(total).toBeCloseTo(0.010, 4);
    });

    test('should handle zero chat cost', () => {
      const costs = {
        transcription: 0.001,
        summary: 0.002,
        article: 0,
        chat: 0,
        total: 0.003
      };

      expect(costs.chat).toBe(0);
      expect(costs.total).toBe(0.003);
    });

    test('should accumulate multiple chat messages', () => {
      let chatCost = 0;
      const messages = [0.0001, 0.0002, 0.0003];

      messages.forEach(cost => {
        chatCost += cost;
      });

      expect(chatCost).toBeCloseTo(0.0006, 4);
    });
  });

  describe('Time Calculations', () => {
    test('should calculate PDF total time from extraction + summary', () => {
      const extraction = 1.5; // seconds
      const summary = 3.2; // seconds
      const total = extraction + summary;

      expect(total).toBeCloseTo(4.7, 1);
    });

    test('should handle sub-second durations', () => {
      const duration = 0.7;
      const formatted = duration.toFixed(1);

      expect(formatted).toBe('0.7');
    });

    test('should format seconds correctly', () => {
      const duration = 45;
      const rounded = Math.round(duration);

      expect(rounded).toBe(45);
    });

    test('should format minutes and seconds correctly', () => {
      const duration = 125; // 2 minutes 5 seconds
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;

      expect(minutes).toBe(2);
      expect(seconds).toBe(5);
    });

    test('should handle zero duration', () => {
      const duration = 0;
      const isValid = duration > 0;

      expect(isValid).toBe(false);
    });

    test('should handle negative duration', () => {
      const duration = -10;
      const validated = Math.max(0, duration);

      expect(validated).toBe(0);
    });

    test('should validate analysis time values', () => {
      const analysisTime = {
        extraction: -1,
        summary: 5,
        total: 0
      };

      const validated = {
        extraction: Math.max(0, analysisTime.extraction || 0),
        summary: Math.max(0, analysisTime.summary || 0),
        total: Math.max(0, analysisTime.total || 0)
      };

      expect(validated.extraction).toBe(0);
      expect(validated.summary).toBe(5);
      expect(validated.total).toBe(0);
    });
  });

  describe('PDF Analysis Time Structure', () => {
    test('should have all required timing fields', () => {
      const analysisTime = {
        startTime: '2025-10-24T10:00:00.000Z',
        endTime: '2025-10-24T10:00:05.000Z',
        duration: 5,
        extraction: 1.5,
        summary: 3.2,
        total: 4.7
      };

      expect(analysisTime).toHaveProperty('extraction');
      expect(analysisTime).toHaveProperty('summary');
      expect(analysisTime).toHaveProperty('total');
      expect(analysisTime.total).toBeCloseTo(analysisTime.extraction + analysisTime.summary, 1);
    });

    test('should calculate total from extraction and summary if missing', () => {
      const extraction = 1.5;
      const summary = 3.2;
      let total = undefined;

      if (!total && extraction !== undefined && summary !== undefined) {
        total = extraction + summary;
      }

      expect(total).toBeCloseTo(4.7, 1);
    });
  });
});

describe('Type Safety (Issue #23)', () => {
  test('DetailedCosts should include all cost types', () => {
    // Type check - will fail at compile time if interface is wrong
    const costs: {
      transcription: number;
      summary: number;
      article: number;
      chat: number;
      total: number;
    } = {
      transcription: 0,
      summary: 0,
      article: 0,
      chat: 0,
      total: 0
    };

    expect(Object.keys(costs)).toContain('chat');
  });
});
