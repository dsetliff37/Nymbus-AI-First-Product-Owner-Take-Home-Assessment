/**
 * Unit tests for detectCategoryMismatches (Req 4.10, 8.1, 8.3)
 */

import { detectCategoryMismatches } from '../intentService';

describe('detectCategoryMismatches', () => {
  const available = ['Groceries', 'Dining Out', 'Transport', 'Entertainment'];

  it('returns an empty array when all intent categories match', () => {
    expect(detectCategoryMismatches(['Groceries', 'Transport'], available)).toEqual([]);
  });

  it('returns the mismatched name when one category does not match', () => {
    expect(detectCategoryMismatches(['Groceries', 'Flights'], available)).toEqual(['Flights']);
  });

  it('returns all mismatched names when multiple categories do not match', () => {
    const result = detectCategoryMismatches(['Flights', 'Hotels', 'Groceries'], available);
    expect(result).toEqual(['Flights', 'Hotels']);
  });

  it('matches case-insensitively (lowercase intent vs title-case available)', () => {
    expect(detectCategoryMismatches(['groceries', 'dining out'], available)).toEqual([]);
  });

  it('matches case-insensitively (upper-case intent vs title-case available)', () => {
    expect(detectCategoryMismatches(['GROCERIES', 'TRANSPORT'], available)).toEqual([]);
  });

  it('returns an empty array when intentCategories is empty', () => {
    expect(detectCategoryMismatches([], available)).toEqual([]);
  });

  it('returns all intent categories when availableCategories is empty', () => {
    expect(detectCategoryMismatches(['Groceries', 'Transport'], [])).toEqual([
      'Groceries',
      'Transport',
    ]);
  });
});
