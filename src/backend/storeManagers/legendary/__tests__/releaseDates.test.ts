import { toIsoReleaseDate } from 'common/releaseDate'
import { axiosClient } from 'backend/utils'
import {
  EpicOffer,
  fetchMissingReleaseDates,
  getCachedReleaseDate,
  pickReleaseDate
} from '../releaseDates'

jest.mock('backend/logger')
jest.mock('backend/utils', () => ({
  axiosClient: { post: jest.fn() }
}))
jest.mock('../electronStores', () => {
  const values = new Map<string, string>()
  return {
    releaseDateStore: {
      get: (key: string) => values.get(key),
      set: (key: string, value: string) => values.set(key, value),
      clear: () => values.clear()
    }
  }
})

const { post } = jest.mocked(axiosClient)

function offer(overrides: Partial<EpicOffer>): EpicOffer {
  return {
    offerType: 'BASE_GAME',
    releaseDate: null,
    pcReleaseDate: null,
    items: [],
    ...overrides
  }
}

describe('toIsoReleaseDate', () => {
  it('normalizes dates with offsets to ISO strings', () => {
    expect(toIsoReleaseDate('2015-05-18T00:00:00+03:00')).toBe(
      '2015-05-17T21:00:00.000Z'
    )
  })

  it('drops missing, invalid and placeholder dates', () => {
    expect(toIsoReleaseDate(undefined)).toBeUndefined()
    expect(toIsoReleaseDate(null)).toBeUndefined()
    expect(toIsoReleaseDate('')).toBeUndefined()
    expect(toIsoReleaseDate('not a date')).toBeUndefined()
    expect(toIsoReleaseDate('1970-01-01T00:00:00Z')).toBeUndefined()
  })
})

describe('pickReleaseDate', () => {
  it('prefers the original PC release date of the matching offer', () => {
    const offers = [
      offer({
        offerType: 'DLC',
        releaseDate: '2026-04-09T18:00:00.000Z',
        items: [{ id: 'credits' }]
      }),
      offer({
        releaseDate: '2020-09-23T15:00:00.000Z',
        pcReleaseDate: '2015-07-07T15:00:00.000Z',
        items: [{ id: 'game' }]
      })
    ]
    expect(pickReleaseDate(offers, 'game')).toBe('2015-07-07T15:00:00.000Z')
  })

  it('falls back to the Epic Store release date', () => {
    const offers = [
      offer({ releaseDate: '2019-12-10T11:00:00.000Z', items: [{ id: 'g' }] })
    ]
    expect(pickReleaseDate(offers, 'g')).toBe('2019-12-10T11:00:00.000Z')
  })

  it('prefers the base game when several offers contain the item', () => {
    const offers = [
      offer({
        offerType: 'EDITION',
        releaseDate: '2021-01-01T00:00:00.000Z',
        items: [{ id: 'g' }, { id: 'soundtrack' }]
      }),
      offer({ releaseDate: '2019-01-01T00:00:00.000Z', items: [{ id: 'g' }] })
    ]
    expect(pickReleaseDate(offers, 'g')).toBe('2019-01-01T00:00:00.000Z')
  })

  it('uses the only base game when no offer contains the item', () => {
    const offers = [
      offer({ offerType: 'DLC', releaseDate: '2022-01-01T00:00:00.000Z' }),
      offer({ releaseDate: '2018-01-01T00:00:00.000Z', items: [{ id: 'x' }] })
    ]
    expect(pickReleaseDate(offers, 'g')).toBe('2018-01-01T00:00:00.000Z')
  })

  it('returns undefined when the matching offer is ambiguous', () => {
    const offers = [
      offer({ releaseDate: '2018-01-01T00:00:00.000Z', items: [{ id: 'a' }] }),
      offer({ releaseDate: '2019-01-01T00:00:00.000Z', items: [{ id: 'b' }] })
    ]
    expect(pickReleaseDate(offers, 'g')).toBeUndefined()
  })
})

describe('fetchMissingReleaseDates', () => {
  beforeEach(() => {
    post.mockReset()
  })

  it('batches namespaces, caches results and skips cached items', async () => {
    post.mockResolvedValueOnce({
      data: {
        data: {
          Catalog: {
            n0: {
              elements: [
                offer({
                  releaseDate: '2019-08-27T15:00:00.000Z',
                  items: [{ id: 'control' }]
                })
              ]
            },
            // unknown namespaces come back as null
            n1: null
          }
        }
      }
    })

    await fetchMissingReleaseDates([
      { namespace: 'calluna', catalogItemId: 'control' },
      { namespace: 'gone', catalogItemId: 'delisted' }
    ])

    expect(post).toHaveBeenCalledTimes(1)
    expect(post.mock.calls[0][1]).toMatchObject({
      variables: { ns0: 'calluna', ns1: 'gone' }
    })
    expect(getCachedReleaseDate('control')).toBe('2019-08-27T15:00:00.000Z')
    expect(getCachedReleaseDate('delisted')).toBeUndefined()

    // both items are cached now, including the one without a date
    await fetchMissingReleaseDates([
      { namespace: 'calluna', catalogItemId: 'control' },
      { namespace: 'gone', catalogItemId: 'delisted' }
    ])
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('does not cache items when the request fails', async () => {
    post.mockRejectedValueOnce(new Error('offline'))
    await fetchMissingReleaseDates([
      { namespace: 'min', catalogItemId: 'hades' }
    ])

    post.mockResolvedValueOnce({
      data: {
        data: {
          Catalog: {
            n0: {
              elements: [
                offer({
                  releaseDate: '2019-12-10T11:00:00.000Z',
                  items: [{ id: 'hades' }]
                })
              ]
            }
          }
        }
      }
    })
    await fetchMissingReleaseDates([
      { namespace: 'min', catalogItemId: 'hades' }
    ])

    expect(post).toHaveBeenCalledTimes(2)
    expect(getCachedReleaseDate('hades')).toBe('2019-12-10T11:00:00.000Z')
  })
})
