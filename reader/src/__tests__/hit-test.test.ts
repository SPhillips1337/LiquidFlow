import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

interface WordBound {
  word: string
  x: number
  w: number
  offset: number
}

interface LayoutLine {
  text: string
  x: number
  y: number
  w: number
  words: WordBound[]
}

function findWordIndicesAt(
  currentLines: LayoutLine[],
  x: number,
  y: number,
  scrollOffset: number,
  lineHeight: number
): { lineIdx: number; wordIdx: number } | null {
  const scrolledY = y + scrollOffset
  const lineIdx = currentLines.findIndex(l => scrolledY >= l.y && scrolledY <= l.y + lineHeight)
  if (lineIdx === -1) return null

  const line = currentLines[lineIdx]
  const wordIdx = line.words.findIndex(w => x >= line.x + w.x && x <= line.x + w.x + w.w)
  if (wordIdx === -1) return null

  return { lineIdx, wordIdx }
}

describe('Word Hit-Testing', () => {
  // Feature: kindle-plus-reader-redesign, Property 16: Word hit-test correctness
  it('should find the correct word indices for given coordinates', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            text: fc.string(),
            x: fc.integer({ min: 0, max: 100 }),
            y: fc.integer({ min: 0, max: 1000 }),
            w: fc.integer({ min: 100, max: 500 }),
            words: fc.array(
              fc.record({
                word: fc.string({ minLength: 1 }),
                x: fc.integer({ min: 0, max: 400 }),
                w: fc.integer({ min: 10, max: 100 }),
                offset: fc.integer()
              }),
              { minLength: 1 }
            )
          }),
          { minLength: 1 }
        ),
        fc.integer({ min: 0, max: 500 }), // tapX
        fc.integer({ min: 0, max: 1500 }), // tapY
        fc.integer({ min: 0, max: 2000 }), // scrollOffset
        fc.integer({ min: 20, max: 40 }), // lineHeight
        (lines, tapX, tapY, scroll, lh) => {
          // Ensure words within a line don't overlap to make test deterministic
          for (const line of lines) {
            line.words.sort((a, b) => a.x - b.x)
            for (let i = 1; i < line.words.length; i++) {
              if (line.words[i].x < line.words[i-1].x + line.words[i-1].w) {
                line.words[i].x = line.words[i-1].x + line.words[i-1].w + 1
              }
            }
            // Ensure line y are separated
            lines.sort((a, b) => a.y - b.y)
            for (let i = 1; i < lines.length; i++) {
               if (lines[i].y < lines[i-1].y + lh) {
                 lines[i].y = lines[i-1].y + lh + 1
               }
            }
          }

          const result = findWordIndicesAt(lines, tapX, tapY, scroll, lh)
          
          if (result) {
            const line = lines[result.lineIdx]
            const word = line.words[result.wordIdx]
            const scrolledTapY = tapY + scroll
            
            expect(scrolledTapY).toBeGreaterThanOrEqual(line.y)
            expect(scrolledTapY).toBeLessThanOrEqual(line.y + lh)
            expect(tapX).toBeGreaterThanOrEqual(line.x + word.x)
            expect(tapX).toBeLessThanOrEqual(line.x + word.x + word.w)
          } else {
            // Verify NO word satisfies the condition
            const scrolledTapY = tapY + scroll
            for (const line of lines) {
              const inY = scrolledTapY >= line.y && scrolledTapY <= line.y + lh
              if (inY) {
                for (const word of line.words) {
                  const inX = tapX >= line.x + word.x && tapX <= line.x + word.x + word.w
                  expect(inX).toBe(false)
                }
              }
            }
          }
        }
      )
    )
  })
})
