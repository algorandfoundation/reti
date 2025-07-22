import * as isIPFS from 'is-ipfs'

const IMAGE_PROVIDERS = [
  'https://images.nf.domains/ipfs',
  'https://ipfs.algonode.dev/ipfs',
] as const

export interface ImageProviderResponse {
  url: string
  contentType: string | null
}

async function checkProvider(provider: string, cid: string): Promise<ImageProviderResponse | null> {
  try {
    const response = await fetch(`${provider}/${cid}`, {
      method: 'HEAD',
    })

    if (!response.ok) {
      return null
    }

    return {
      url: `${provider}/${cid}`,
      contentType: response.headers.get('content-type'),
    }
  } catch (error: unknown) {
    console.error(`Failed to fetch from provider ${provider}:`, error)
    return null
  }
}

export async function resolveIpfsUrl(ipfsUrl: string): Promise<string> {
  // Extract CID from ipfs:// URL
  const cid = ipfsUrl.replace('ipfs://', '')

  // Validate CID
  if (!isIPFS.cid(cid)) {
    return ''
  }

  // Try each provider in sequence
  for (const provider of IMAGE_PROVIDERS) {
    const result = await checkProvider(provider, cid)
    if (result && result.contentType?.startsWith('image/')) {
      return result.url
    }
  }

  return ''
}
