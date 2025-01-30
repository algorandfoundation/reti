import * as isIPFS from 'is-ipfs'

const IPFS_GATEWAYS = ['https://images.nf.domains/ipfs', 'https://ipfs.algonode.dev/ipfs'] as const

export interface IpfsGatewayResponse {
  url: string
  contentType: string | null
}

async function checkGateway(gateway: string, cid: string): Promise<IpfsGatewayResponse | null> {
  try {
    const response = await fetch(`${gateway}/${cid}`, {
      method: 'HEAD',
    })

    if (!response.ok) {
      return null
    }

    return {
      url: `${gateway}/${cid}`,
      contentType: response.headers.get('content-type'),
    }
  } catch (error: unknown) {
    console.error(`Failed to check IPFS gateway ${gateway}:`, error)
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

  // Try each gateway in sequence
  for (const gateway of IPFS_GATEWAYS) {
    const result = await checkGateway(gateway, cid)
    if (result && result.contentType?.startsWith('image/')) {
      return result.url
    }
  }

  return ''
}
