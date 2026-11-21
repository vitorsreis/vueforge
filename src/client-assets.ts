export const clientAssetsFile = '.vite/vueforge-assets.json'

export function isClientAsset(file: unknown): file is string {
  return (
    typeof file === 'string' &&
    !file.includes('\\') &&
    !file.includes('\0') &&
    file
      .split('/')
      .every((part) => part.length > 0 && part !== '.' && part !== '..')
  )
}
