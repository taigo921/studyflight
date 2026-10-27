// サブパス配信（例: GitHub Pages の /studyflight）に対応するための接頭辞。
// next/link と router は basePath を自動で付けるので、それ以外の URL（fetch・SW・manifest 等）で使う。
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBase(path: string): string {
  return `${BASE_PATH}${path}`;
}
