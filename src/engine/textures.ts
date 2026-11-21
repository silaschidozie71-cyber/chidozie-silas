import * as THREE from 'three';
import { MapTheme } from '../types/game';

function createCanvasTexture(
  size: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  repeat = 1,
  maxAnisotropy = 4,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

export function createThemeTextures(theme: MapTheme, maxAnisotropy: number) {
  const ground = createCanvasTexture(
    512,
    (ctx, s) => {
      if (theme === 'factory') {
        ctx.fillStyle = '#1d222b';
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = '#2d3542';
        ctx.lineWidth = 3;
        for (let y = 0; y < s; y += 64) {
          for (let x = 0; x < s; x += 64) {
            ctx.strokeRect(x, y, 64, 64);
            ctx.fillStyle = 'rgba(180,210,255,0.04)';
            ctx.fillRect(x + 8, y + 8, 48, 48);
          }
        }
      } else if (theme === 'mansion') {
        ctx.fillStyle = '#261a16';
        ctx.fillRect(0, 0, s, s);
        for (let y = 0; y < s; y += 32) {
          ctx.fillStyle = y % 64 === 0 ? '#2f201a' : '#211612';
          ctx.fillRect(0, y, s, 30);
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.fillRect(0, y + 30, s, 2);
        }
        for (let x = 0; x < s; x += 128) {
          ctx.fillStyle = 'rgba(0,0,0,0.28)';
          ctx.fillRect(x, 0, 2, s);
        }
      } else if (theme === 'station') {
        ctx.fillStyle = '#2a303b';
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 1200; i++) {
          const x = Math.random() * s;
          const y = Math.random() * s;
          const r = 1 + Math.random() * 2.5;
          ctx.fillStyle = Math.random() > 0.4 ? 'rgba(210,225,245,0.16)' : 'rgba(15,20,30,0.25)';
          ctx.fillRect(x, y, r, r);
        }
        ctx.strokeStyle = 'rgba(220,235,250,0.08)';
        ctx.lineWidth = 2;
        for (let y = 0; y < s; y += 64) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(s, y);
          ctx.stroke();
        }
      } else {
        // Snow / cobblestone frost for village & forest
        ctx.fillStyle = theme === 'forest' ? '#bccbd9' : '#aebcc9';
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 2400; i++) {
          const x = Math.random() * s;
          const y = Math.random() * s;
          const r = 1 + Math.random() * 3;
          ctx.fillStyle =
            Math.random() > 0.5
              ? 'rgba(255,255,255,0.28)'
              : 'rgba(65,90,120,0.16)';
          ctx.fillRect(x, y, r, r);
        }
      }
    },
    18,
    maxAnisotropy,
  );

  const wall = createCanvasTexture(
    512,
    (ctx, s) => {
      if (theme === 'factory') {
        ctx.fillStyle = '#332524';
        ctx.fillRect(0, 0, s, s);
        for (let row = 0; row < 16; row++) {
          const y = row * 32;
          const offset = (row % 2) * 32;
          for (let col = -1; col < 9; col++) {
            const x = col * 64 + offset;
            ctx.fillStyle = Math.random() > 0.5 ? '#3e2b29' : '#2c1f1e';
            ctx.fillRect(x + 2, y + 2, 60, 28);
          }
        }
        // Frost streak
        ctx.fillStyle = 'rgba(195,220,245,0.14)';
        ctx.fillRect(0, 0, s, 44);
      } else if (theme === 'mansion') {
        ctx.fillStyle = '#241b24';
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = '#3b2b38';
        ctx.lineWidth = 4;
        for (let x = 0; x < s; x += 48) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, s);
          ctx.stroke();
        }
        // Dark wainscoting bottom
        ctx.fillStyle = '#181012';
        ctx.fillRect(0, s * 0.68, s, s * 0.32);
      } else if (theme === 'station') {
        ctx.fillStyle = '#2d323b';
        ctx.fillRect(0, 0, s, s);
        for (let row = 0; row < 12; row++) {
          const y = row * 42;
          ctx.fillStyle = row % 2 === 0 ? '#373d47' : '#282d35';
          ctx.fillRect(0, y + 2, s, 38);
        }
        ctx.fillStyle = 'rgba(215,232,250,0.18)';
        ctx.fillRect(0, 0, s, 36);
      } else {
        // Timber / snow-dusted cottage wall
        ctx.fillStyle = '#3c2e24';
        ctx.fillRect(0, 0, s, s);
        for (let y = 0; y < s; y += 32) {
          ctx.fillStyle = y % 64 === 0 ? '#47362a' : '#35271e';
          ctx.fillRect(0, y + 2, s, 28);
        }
        ctx.fillStyle = '#211813';
        ctx.fillRect(0, 0, 24, s);
        ctx.fillRect(s - 24, 0, 24, s);
        // Glowing frost window pane
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(s * 0.34, s * 0.25, s * 0.32, s * 0.34);
        ctx.strokeStyle = '#1a120d';
        ctx.lineWidth = 10;
        ctx.strokeRect(s * 0.34, s * 0.25, s * 0.32, s * 0.34);
        ctx.beginPath();
        ctx.moveTo(s * 0.5, s * 0.25);
        ctx.lineTo(s * 0.5, s * 0.59);
        ctx.moveTo(s * 0.34, s * 0.42);
        ctx.lineTo(s * 0.66, s * 0.42);
        ctx.stroke();
      }
    },
    1,
    maxAnisotropy,
  );

  const gift = createCanvasTexture(
    256,
    (ctx, s) => {
      ctx.fillStyle = '#9e131e';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#e5b84b';
      ctx.fillRect(s * 0.42, 0, s * 0.16, s);
      ctx.fillRect(0, s * 0.42, s, s * 0.16);
    },
    1,
    maxAnisotropy,
  );

  return { ground, wall, gift };
}
