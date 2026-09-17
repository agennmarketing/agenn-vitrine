export function mediaUrl(path: string, baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

function entries(storagePaths: unknown): [number, string][] {
  if (!storagePaths || typeof storagePaths !== 'object') return []
  return Object.entries(storagePaths as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && Number.isFinite(Number(entry[0])))
    .map(([width, path]) => [Number(width), path] as [number, string])
    .sort((a, b) => a[0] - b[0])
}

export function storagePathList(storagePaths: unknown): string[] {
  return entries(storagePaths).map(([, path]) => path)
}

export function imageSources(storagePaths: unknown, baseUrl: string) {
  const list = entries(storagePaths)
  if (list.length === 0) return null
  const [smallWidth, small] = list[0]
  const [largeWidth, large] = list[list.length - 1]
  return { small: mediaUrl(small, baseUrl), large: mediaUrl(large, baseUrl), smallWidth, largeWidth }
}
