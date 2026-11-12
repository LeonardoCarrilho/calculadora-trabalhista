import { test, expect } from '@playwright/test';

test('vale-transporte mostra foco de teclado no grupo com contraste', async ({ page }) => {
 await page.goto('./');
 for (let i=0;i<20;i++) {
  await page.keyboard.press('Tab');
  if(await page.locator('#vt').evaluate(e=>e===document.activeElement)) break;
 }
 await expect(page.locator('#vt')).toBeFocused();
 await expect(page.locator('#vt')).toBeInViewport();
 const ring=await page.locator('.check').evaluate(e=>{
  const s=getComputedStyle(e), b=getComputedStyle(e.parentElement);
  const luminance=c=>{const a=c.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return a[0]*.2126+a[1]*.7152+a[2]*.0722;};
  const a=luminance(s.outlineColor),z=luminance(b.backgroundColor);
  return {width:parseFloat(s.outlineWidth),style:s.outlineStyle,color:s.outlineColor,background:b.backgroundColor,contrast:(Math.max(a,z)+.05)/(Math.min(a,z)+.05)};
 });
 expect(ring.width).toBeGreaterThanOrEqual(2);
 expect(ring.style).toBe('solid');
 expect(ring.contrast).toBeGreaterThanOrEqual(3);
 console.log('Keyboard focus wrapper',JSON.stringify(ring));
 await page.screenshot({path:'.taste-skill/checkbox-focus.png'});
 await page.keyboard.press('Space');
 await expect(page.locator('#vt')).toBeChecked();
});
