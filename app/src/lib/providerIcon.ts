import type { ProviderAppIcon } from '@shared'

const MAX_SOURCE_BYTES = 10 * 1024 * 1024
const MAX_ENCODED_BYTES = 750_000

export async function prepareProviderAppIcon(file: File): Promise<ProviderAppIcon> {
  if (!file.type.startsWith('image/') || file.size > MAX_SOURCE_BYTES) {
    throw new Error('invalid_icon')
  }

  const bitmap = await createImageBitmap(file)
  try {
    if (bitmap.width !== bitmap.height || bitmap.width < 192) throw new Error('invalid_icon')
    const [image192, image512] = await Promise.all([
      encodeSquare(bitmap, 192),
      encodeSquare(bitmap, 512),
    ])
    const encodedBytes = Math.ceil((image192.length + image512.length) * 3 / 4)
    if (encodedBytes > MAX_ENCODED_BYTES) throw new Error('invalid_icon')
    return {
      contentType: 'image/webp',
      image192,
      image512,
      version: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }
  } finally {
    bitmap.close()
  }
}

async function encodeSquare(bitmap: ImageBitmap, size: number): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) throw new Error('invalid_icon')
  context.drawImage(bitmap, 0, 0, size, size)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9))
  if (!blob) throw new Error('invalid_icon')
  return blobToBase64(blob)
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('invalid_icon'))
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.readAsDataURL(blob)
  })
}
