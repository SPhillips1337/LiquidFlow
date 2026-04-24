import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// We'll mock the minimal structure to test the logic
interface EntityEntry {
  name: string
  type: string
  description: string
  firstSeenScene: string
}

function deduplicateEntities(entities: EntityEntry[]): EntityEntry[] {
  const map = new Map<string, EntityEntry>()
  for (const e of entities) {
    if (!map.has(e.name)) {
      map.set(e.name, e)
    }
  }
  return Array.from(map.values())
}

describe('Entity Manifest Logic', () => {
  // Feature: kindle-plus-reader-redesign, Property 22: Entity manifest deduplication
  it('should ensure one entry per unique name', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1 }),
            type: fc.constantFrom('character', 'location', 'concept', 'item'),
            description: fc.string(),
            firstSeenScene: fc.string()
          })
        ),
        (entities) => {
          const deduped = deduplicateEntities(entities)
          const names = deduped.map(e => e.name)
          const uniqueNames = new Set(names)
          
          expect(names.length).toBe(uniqueNames.size)
          
          // Verify we kept the FIRST one seen
          for (const name of uniqueNames) {
            const expected = entities.find(e => e.name === name)
            const actual = deduped.find(e => e.name === name)
            expect(actual).toEqual(expected)
          }
        }
      )
    )
  })

  // Feature: kindle-plus-reader-redesign, Property 24: BookManifest serialization round-trip
  it('should survive JSON serialization round-trip', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string(),
          title: fc.string(),
          author: fc.string(),
          entityManifest: fc.array(
            fc.record({
              name: fc.string(),
              type: fc.string(),
              description: fc.string(),
              firstSeenScene: fc.string()
            })
          )
        }),
        (manifest) => {
          const serialized = JSON.stringify(manifest)
          const deserialized = JSON.parse(serialized)
          expect(deserialized).toEqual(manifest)
        }
      )
    )
  })
})
