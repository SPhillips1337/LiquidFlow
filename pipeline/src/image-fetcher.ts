// ── Image fetcher for illustrations ─────────────────────────────────────────
// Fetches images from free sources and converts to ASCII assets

import Jimp from 'jimp'

export interface ImageResult {
  url: string
  author: string
  authorUrl: string
}

export interface AsciiAsset {
  charGrid: string[][]
  colorGrid: string[][]
  subjectMask: boolean[][]
  width: number
  height: number
}

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || ''

// Keyword to image URL mapping (fallback when no API key)
const FALLBACK_IMAGES: Record<string, string[]> = {
  default: [
    'https://images.unsplash.com/photo-1507003217269-7a53216e363a?w=400'
  ],
  nature: [
    'https://images.unsplash.com/photo-1501854140801-50d01698929b?w=400'
  ],
  forest: [
    'https://images.unsplash.com/photo-1448375240586-882707db988b?w=400'
  ],
  ocean: [
    'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=400'
  ],
  sea: [
    'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=400'
  ],
  mountain: [
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400'
  ],
  city: [
    'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400'
  ],
  night: [
    'https://images.unsplash.com/photo-1507003217269-7a53216e363a?w=400'
  ],
  space: [
    'https://images.unsplash.com/photo-1462331940025-496dfa562ee4?w=400'
  ],
  desert: [
    'https://images.unsplash.com/photo-1509316785289-025f5b846bcf?w=400'
  ],
  snow: [
    'https://images.unsplash.com/photo-1491002052546-bf38f4af86d3?w=400'
  ],
  rain: [
    'https://images.unsplash.com/photo-1515694346937-94d85e41e6ed?w=400'
  ],
  book: [
    'https://images.unsplash.com/photo-1544716278-fa500798e8d7?w=400'
  ],
  star: [
    'https://images.unsplash.com/photo-1419242902214-272b3f66a9c7?w=400'
  ],
  moon: [
    'https://images.unsplash.com/photo-1531761535209-180857e963b8b?w=400'
  ],
  sun: [
    'https://images.unsplash.com/photo-1507003217269-7a53216e363a?w=400'
  ],
  flower: [
    'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=400'
  ],
  bird: [
    'https://images.unsplash.com/photo-1444464666168-49d633b86786?w=400'
  ],
  rabbit: [
    'https://images.unsplash.com/photo-1585110396000-c928ffd89b58f?w=400'
  ],
  hare: [
    'https://images.unsplash.com/photo-1585110396000-c928ffd89b58f?w=400'
  ],
  cat: [
    'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400'
  ],
  dog: [
    'https://images.unsplash.com/photo-1543466835-386a02561f52?w=400'
  ],
  horse: [
    'https://images.unsplash.com/photo-1553284965-83fd3e82c277?w=400'
  ],
  ship: [
    'https://images.unsplash.com/photo-1559825481-12a05cc40344?w=400'
  ],
  whale: [
    'https://images.unsplash.com/photo-1568430462989-44163eb1752f?w=400'
  ],
  fish: [
    'https://images.unsplash.com/photo-1568430462989-44163eb1752f?w=400'
  ]
}

export async function searchImages(query: string, perPage = 3): Promise<ImageResult[]> {
  const q = query.toLowerCase()
  
  // Find matching keywords
  for (const [key, urls] of Object.entries(FALLBACK_IMAGES)) {
    if (q.includes(key)) {
      return urls.slice(0, perPage).map(url => ({
        url,
        author: 'Unsplash',
        authorUrl: ''
      }))
    }
  }
  
  // Try to match any word
  const words = q.split(/\s+/)
  for (const word of words) {
    const matches = FALLBACK_IMAGES[word]
    if (matches) {
      return matches.slice(0, perPage).map(url => ({
        url,
        author: 'Unsplash', 
        authorUrl: ''
      }))
    }
  }
  
  // Default fallback
  return FALLBACK_IMAGES.default.slice(0, perPage).map(url => ({
    url,
    author: 'Unsplash',
    authorUrl: ''
  }))
}

export async function fetchAndConvert(query: string, targetWidth = 60): Promise<AsciiAsset | null> {
  const images = await searchImages(query)
  if (images.length === 0) return null
  
  for (const img of images) {
    try {
      console.log(`[ImageSearch] Downloading: ${img.url.slice(0, 50)}...`)
      const response = await fetch(img.url)
      if (!response.ok) continue
      
      const buffer = await response.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      const image = await Jimp.read(`data:image/png;base64,${base64}`)
      
      // Resize and convert
      const asset = await imageToAsciiAsset(image, targetWidth)
      console.log(`[ImageSearch] Converted: ${asset.width}x${asset.height}`)
      return asset
    } catch (e) {
      console.log(`[ImageSearch] Failed to convert: ${e}`)
      continue
    }
  }
  
  return null
}

async function imageToAsciiAsset(image: Jimp, targetWidth: number): Promise<AsciiAsset> {
  image.resize(targetWidth, Jimp.AUTO)
  
  const width = image.getWidth()
  const height = image.getHeight()
  
  const RAMP = '@#S08Xox+=;:-,.'
  
  const charGrid: string[][] = []
  const colorGrid: string[][] = []
  const subjectMask: boolean[][] = []

  for (let y = 0; y < height; y++) {
    const charRow: string[] = []
    const colorRow: string[] = []
    const maskRow: boolean[] = []

    for (let x = 0; x < width; x++) {
      const color = image.getPixelColor(x, y)
      const rgba = Jimp.intToRGBA(color)
      
      const luminance = (0.299 * rgba.r + 0.587 * rgba.g + 0.114 * rgba.b) / 255
      const charIdx = Math.floor(luminance * (RAMP.length - 1))
      
      charRow.push(RAMP[charIdx])
      colorRow.push('#' + 
        rgba.r.toString(16).padStart(2, '0') + 
        rgba.g.toString(16).padStart(2, '0') + 
        rgba.b.toString(16).padStart(2, '0')
      )
      maskRow.push(luminance > 0.15)
    }
    
    charGrid.push(charRow)
    colorGrid.push(colorRow)
    subjectMask.push(maskRow)
  }

  return { charGrid, colorGrid, subjectMask, width, height }
}

// Simple ASCII text banners (fallback for art library)
const ASCII_BANNERS: Record<string, string[]> = {
  start: [
    '╔══════════════════╗',
    '║   CHAPTER START   ║',
    '╚══════════════════╝'
  ],
  chapter: [
    '┌───────────────┐',
    '│   CHAPTER   │',
    '└───────────────┘'
  ],
  end: [
    '╔══════════════════╗',
    '║    THE END    ║',
    '╚══════════════════╝'
  ]
}

export function getBanner(type: 'start' | 'chapter' | 'end'): string[] {
  return ASCII_BANNERS[type] || ASCII_BANNERS.chapter
}