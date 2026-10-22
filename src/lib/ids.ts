// Google Sheet tidak punya id baris yang tetap, jadi id dibuat dari nama (hash FNV-1a 31-bit).
// Id tetap sama selama namanya tidak berubah, walaupun baris di Master Data disisipkan atau diurutkan.
export function stableId(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 1) || 1;
}

export const catId = (name: string) => stableId(`cat|${name}`);
export const partId = (cat: string, name: string, type: string) => stableId(`part|${cat}|${name}|${type}`);
export const mcId = (cat: string, mc: string) => stableId(`mc|${cat}|${mc}`);
export const ltId = (name: string) => stableId(`lt|${name}`);
export const memberId = (name: string) => stableId(`mem|${name}`);
export const ngGroupId = (name: string) => stableId(`ng|${name}`);
export const userId = (nik: string) => stableId(`user|${nik}`);
