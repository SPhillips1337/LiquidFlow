import Jimp from 'jimp';

export interface AsciiAsset {
  charGrid: string[][];
  colorGrid: string[][];
  subjectMask: boolean[][];
  width: number;
  height: number;
}

const RAMP = '@#S08Xox+=;:-,.';

export async function convertToAscii(imagePath: string, targetWidth = 60): Promise<AsciiAsset> {
  const image = await Jimp.read(imagePath);
  
  // Resize to target width while maintaining aspect ratio
  image.resize(targetWidth, Jimp.AUTO);
  
  const width = image.getWidth();
  const height = image.getHeight();
  
  const charGrid: string[][] = [];
  const colorGrid: string[][] = [];
  const subjectMask: boolean[][] = [];

  for (let y = 0; y < height; y++) {
    const charRow: string[] = [];
    const colorRow: string[] = [];
    const maskRow: boolean[] = [];

    for (let x = 0; x < width; x++) {
      const color = image.getPixelColor(x, y);
      const rgba = Jimp.intToRGBA(color);
      
      // Calculate luminance
      const luminance = (0.299 * rgba.r + 0.587 * rgba.g + 0.114 * rgba.b) / 255;
      
      // Map luminance to character (inverted ramp for dark mode)
      const charIdx = Math.floor(luminance * (RAMP.length - 1));
      charRow.push(RAMP[charIdx]);
      
      // Store color as hex
      colorRow.push('#' + 
        rgba.r.toString(16).padStart(2, '0') + 
        rgba.g.toString(16).padStart(2, '0') + 
        rgba.b.toString(16).padStart(2, '0')
      );
      
      // Simple subject detection: non-black pixels (thresholding)
      // In a better version, we'd use rembg, but here we'll assume a dark background for the source.
      maskRow.push(luminance > 0.1); 
    }
    
    charGrid.push(charRow);
    colorGrid.push(colorRow);
    subjectMask.push(maskRow);
  }

  return {
    charGrid,
    colorGrid,
    subjectMask,
    width,
    height
  };
}
