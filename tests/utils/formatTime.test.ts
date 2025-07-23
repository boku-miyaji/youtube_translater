import { formatProcessingTime } from '../../src/utils/formatTime'

describe('formatProcessingTime', () => {
  describe('sub-second times', () => {
    it('should format times less than 1 second with one decimal place', () => {
      expect(formatProcessingTime(0.1)).toBe('0.1 sec')
      expect(formatProcessingTime(0.5)).toBe('0.5 sec')
      expect(formatProcessingTime(0.9)).toBe('0.9 sec')
    })

    it('should handle 0 seconds correctly', () => {
      expect(formatProcessingTime(0)).toBe('0.0 sec')
    })
  })

  describe('seconds', () => {
    it('should format whole seconds without decimal places', () => {
      expect(formatProcessingTime(1)).toBe('1 sec')
      expect(formatProcessingTime(30)).toBe('30 sec')
      expect(formatProcessingTime(59)).toBe('59 sec')
    })
  })

  describe('minutes', () => {
    it('should format minutes correctly', () => {
      expect(formatProcessingTime(60)).toBe('1 min')
      expect(formatProcessingTime(90)).toBe('1 min 30 sec')
      expect(formatProcessingTime(120)).toBe('2 min')
    })
  })

  describe('hours', () => {
    it('should format hours correctly', () => {
      expect(formatProcessingTime(3600)).toBe('1 hr')
      expect(formatProcessingTime(3660)).toBe('1 hr 1 min')
      expect(formatProcessingTime(3665)).toBe('1 hr 1 min 5 sec')
    })
  })
})