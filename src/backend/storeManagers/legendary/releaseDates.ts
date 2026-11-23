import { toIsoReleaseDate } from 'common/releaseDate'
import { logError, logInfo, LogPrefix } from 'backend/logger'
import { axiosClient } from 'backend/utils'
import { releaseDateStore } from './electronStores'

// Legendary's metadata has no release date, so we look it up from the store
// offers in each game's catalog namespace.
const GRAPHQL_URL = 'https://launcher.store.epicgames.com/graphql'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) EpicGamesLauncher'
const NAMESPACES_PER_REQUEST = 20
// Stored for catalog items that have no matching offer, so they are not
// looked up again on every refresh (until the cache entry expires).
const NO_RELEASE_DATE = ''

export interface EpicOffer {
  offerType: string
  releaseDate: string | null
  pcReleaseDate: string | null
  items: { id: string }[] | null
}

export interface ReleaseDateLookup {
  namespace: string
  catalogItemId: string
}

/**
 * Picks the release date for a catalog item out of its namespace's offers.
 * Prefers the offer that contains the item (base game over editions/bundles),
 * falling back to the namespace's only base game. Uses the original PC release
 * date when the publisher set one, otherwise the Epic Store release date.
 */
export function pickReleaseDate(
  offers: EpicOffer[],
  catalogItemId: string
): string | undefined {
  const containingItem = offers.filter((offer) =>
    offer.items?.some(({ id }) => id === catalogItemId)
  )
  const baseGames = offers.filter(({ offerType }) => offerType === 'BASE_GAME')

  const offer =
    containingItem.find(({ offerType }) => offerType === 'BASE_GAME') ??
    containingItem[0] ??
    (baseGames.length === 1 ? baseGames[0] : undefined)
  if (!offer) return undefined

  return (
    toIsoReleaseDate(offer.pcReleaseDate) ?? toIsoReleaseDate(offer.releaseDate)
  )
}

export function getCachedReleaseDate(catalogItemId: string) {
  return releaseDateStore.get(catalogItemId) || undefined
}

async function fetchOffers(
  namespaces: string[]
): Promise<Map<string, EpicOffer[] | null>> {
  const variables: Record<string, string> = {}
  const fields = namespaces.map((namespace, i) => {
    variables[`ns${i}`] = namespace
    return `n${i}: catalogOffers(namespace: $ns${i}, params: {count: 1000}) {
      elements { offerType releaseDate pcReleaseDate items { id } }
    }`
  })
  const declarations = namespaces.map((_, i) => `$ns${i}: String!`).join(', ')
  const query = `query(${declarations}) { Catalog { ${fields.join('\n')} } }`

  const { data } = await axiosClient.post<{
    data?: {
      Catalog?: Record<string, { elements: EpicOffer[] } | null>
    }
  }>(
    GRAPHQL_URL,
    { query, variables },
    {
      headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT }
    }
  )

  // Unknown namespaces come back as null alongside a per-field error, while
  // the rest of the batch still succeeds.
  const catalog = data.data?.Catalog ?? {}
  return new Map(
    namespaces.map((namespace, i) => [
      namespace,
      catalog[`n${i}`]?.elements ?? null
    ])
  )
}

/**
 * Looks up and caches release dates for catalog items that aren't cached yet.
 * Network failures are logged and skipped, so they are retried next refresh.
 */
export async function fetchMissingReleaseDates(lookups: ReleaseDateLookup[]) {
  const missing = lookups.filter(
    ({ catalogItemId }) => releaseDateStore.get(catalogItemId) === undefined
  )
  if (!missing.length) return

  const byNamespace = new Map<string, string[]>()
  for (const { namespace, catalogItemId } of missing) {
    const ids = byNamespace.get(namespace) ?? []
    ids.push(catalogItemId)
    byNamespace.set(namespace, ids)
  }

  logInfo(
    `Fetching release dates for ${missing.length} Epic games`,
    LogPrefix.Legendary
  )

  const namespaces = Array.from(byNamespace.keys())
  for (let i = 0; i < namespaces.length; i += NAMESPACES_PER_REQUEST) {
    const batch = namespaces.slice(i, i + NAMESPACES_PER_REQUEST)
    let offersByNamespace: Map<string, EpicOffer[] | null>
    try {
      offersByNamespace = await fetchOffers(batch)
    } catch (error) {
      logError(
        ['Failed to fetch Epic release dates:', error],
        LogPrefix.Legendary
      )
      continue
    }

    for (const [namespace, offers] of offersByNamespace) {
      for (const catalogItemId of byNamespace.get(namespace) ?? []) {
        releaseDateStore.set(
          catalogItemId,
          (offers && pickReleaseDate(offers, catalogItemId)) || NO_RELEASE_DATE
        )
      }
    }
  }
}
