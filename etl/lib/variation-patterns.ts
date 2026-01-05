/**
 * Loads variation patterns from a configurable JSON file.
 * Patterns are used for extracting variations from product names.
 */

import { readFileSync } from 'fs';
import { VariationPatternsConfigSchema, type VariationPatternsConfig, type VariationPattern } from './schemas.js';

export interface CompiledVariationPattern {
  name: string;
  regex: RegExp;
  type: 'quantity' | 'size' | 'serving' | 'strength';
  format: (match: RegExpMatchArray) => string;
}

// Format transformers for pattern format strings
const FORMAT_TRANSFORMERS: Record<string, (value: string) => string> = {
  capitalize: (str: string) =>
    str
      .toLowerCase()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' '),

  size_expand: (str: string) => {
    const sizeMap: Record<string, string> = {
      lg: 'Large',
      sm: 'Small',
      med: 'Medium',
    };
    return sizeMap[str.toLowerCase()] || str;
  },

  strength_expand: (str: string) => {
    const strengthMap: Record<string, string> = {
      single: 'Single',
      double: 'Double',
      dbl: 'Double',
    };
    return strengthMap[str.toLowerCase()] || str;
  },
};

/**
 * Parse a format template like "{1}" or "{1|capitalize}" and return a formatter function
 */
function createFormatter(formatTemplate: string): (match: RegExpMatchArray) => string {
  return (match: RegExpMatchArray) => {
    return formatTemplate.replace(/\{(\d+)(?:\|(\w+))?\}/g, (_, groupNum, transformer) => {
      const value = match[parseInt(groupNum, 10)] || '';
      if (transformer && FORMAT_TRANSFORMERS[transformer]) {
        return FORMAT_TRANSFORMERS[transformer](value);
      }
      return value;
    });
  };
}

/**
 * Compile a pattern from JSON config into a usable pattern with RegExp and formatter
 */
function compilePattern(pattern: VariationPattern): CompiledVariationPattern {
  return {
    name: pattern.name,
    regex: new RegExp(pattern.regex, pattern.flags || ''),
    type: pattern.type,
    format: createFormatter(pattern.format),
  };
}

// Cached compiled patterns and abbreviations
let cachedPatterns: CompiledVariationPattern[] | null = null;
let cachedAbbreviations: Record<string, string> | null = null;

/**
 * Load and validate variation patterns from JSON file
 */
export function loadVariationPatterns(filePath: string): VariationPatternsConfig {
  const rawData = readFileSync(filePath, 'utf-8');
  const jsonData = JSON.parse(rawData);

  const result = VariationPatternsConfigSchema.safeParse(jsonData);
  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `  - ${String(e.path.join('.'))}: ${e.message}`)
      .join('\n');
    throw new Error(`Invalid variation patterns config:\n${errors}`);
  }

  return result.data;
}

/**
 * Initialize patterns from the config file path in environment
 */
export function initializePatterns(filePath: string): void {
  const config = loadVariationPatterns(filePath);

  cachedPatterns = config.patterns.map(compilePattern);
  cachedAbbreviations = config.abbreviations;
}

/**
 * Get compiled variation patterns (must call initializePatterns first)
 */
export function getVariationPatterns(): CompiledVariationPattern[] {
  if (!cachedPatterns) {
    throw new Error('Variation patterns not initialized. Call initializePatterns() first.');
  }
  return cachedPatterns;
}

/**
 * Get abbreviation map (must call initializePatterns first)
 */
export function getAbbreviationMap(): Record<string, string> {
  if (!cachedAbbreviations) {
    throw new Error('Variation patterns not initialized. Call initializePatterns() first.');
  }
  return cachedAbbreviations;
}
