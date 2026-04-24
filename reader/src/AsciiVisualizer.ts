// ── AsciiVisualizer ──────────────────────────────────────────────────────────
// Implements high-fidelity animated ASCII art with pixel-art effects.
// Inspired by: https://eliteai.tools/agent-skills/ascii-pixel-art

export interface AsciiAsset {
  charGrid: string[][]; // The characters to render
  colorGrid: string[][]; // The colors for each cell
  subjectMask: boolean[][]; // Whether a cell is part of the subject
  width: number;
  height: number;
}

export class AsciiVisualizer {
  private frameCount = 0;
  private readonly ramp = '@#S08Xox+=;:-,.';

  render(
    ctx: CanvasRenderingContext2D,
    asset: AsciiAsset,
    x: number,
    y: number,
    w: number,
    h: number,
    theme: 'dark' | 'light' | 'sepia',
    mouseX?: number,
    mouseY?: number
  ) {
    this.frameCount++;
    const { charGrid, colorGrid, subjectMask, width, height } = asset;
    
    const cellW = w / width;
    const cellH = h / height;
    
    ctx.save();
    ctx.translate(x, y);

    // ── Draw ASCII Subject ──
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.floor(cellH * 1.2)}px monospace`;

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const isSubject = subjectMask[row][col];
        if (!isSubject) continue;

        const cellCenterX = col * cellW + cellW / 2;
        const cellCenterY = row * cellH + cellH / 2;

        // Mouse distance for interactive ripple
        let mouseDist = 999;
        if (mouseX !== undefined && mouseY !== undefined) {
          const dx = (mouseX - x) - cellCenterX;
          const dy = (mouseY - y) - cellCenterY;
          mouseDist = Math.sqrt(dx * dx + dy * dy);
        }

        const char = charGrid[row][col];
        const baseColor = colorGrid[row][col];
        
        // ── Cinematic Effects ──
        
        // A. Sine Wave Pulse
        const pulse = Math.sin(this.frameCount * 0.05 + (row + col) * 0.1) * 0.2 + 0.8;
        
        // B. Diagonal Sweep (Shine)
        const sweepPos = (this.frameCount * 0.2) % (width + height);
        const onSweep = Math.abs(sweepPos - (row + col)) < 2;
        const sweepBright = onSweep ? 1.5 : 1.0;

        // C. Hover Ripple (Glow within 60px)
        const hoverGlow = mouseDist < 60 ? (1.0 - mouseDist / 60) * 0.8 + 1.0 : 1.0;

        // Apply theme-aware colors
        ctx.fillStyle = this.processColor(baseColor, pulse * sweepBright * hoverGlow, theme);
        
        // Add Glow for subject or hover
        if (onSweep || mouseDist < 40) {
            ctx.shadowBlur = mouseDist < 40 ? 15 : 10;
            ctx.shadowColor = ctx.fillStyle;
        } else {
            ctx.shadowBlur = 0;
        }

        ctx.fillText(char, cellCenterX, cellCenterY);
      }
    }

    ctx.restore();
  }

  private processColor(hex: string, intensity: number, theme: 'dark' | 'light' | 'sepia'): string {
    // Basic hex to rgb
    let r = parseInt(hex.slice(1, 3), 16) || 128;
    let g = parseInt(hex.slice(3, 5), 16) || 128;
    let b = parseInt(hex.slice(5, 7), 16) || 128;

    // Boost brightness based on intensity
    r = Math.min(255, r * intensity);
    g = Math.min(255, g * intensity);
    b = Math.min(255, b * intensity);

    if (theme === 'light') {
        // In light mode, we might want to darken the ASCII to keep it readable
        return `rgba(${Math.floor(r * 0.4)}, ${Math.floor(g * 0.4)}, ${Math.floor(b * 0.4)}, 0.9)`;
    }

    return `rgba(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)}, 0.9)`;
  }
}
