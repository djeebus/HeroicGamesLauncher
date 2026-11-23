import {
  ArrowDown01,
  ArrowDown10,
  ArrowDownAZ,
  ArrowDownZA,
  CalendarDays,
  HardDrive,
  LayoutGrid,
  List,
  ListFilter,
  FilterX,
  RefreshCw
} from 'lucide-react'

import React, { useContext, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ContextProvider from 'frontend/state/ContextProvider'
import FormControl from '../FormControl'
import Icon from '../Icon'
import Tooltip from '../Tooltip'
import './index.css'
import classNames from 'classnames'
import LibraryContext from 'frontend/screens/Library/LibraryContext'
import TourButton from 'frontend/components/Tour/TourButton'
import { LIBRARY_TOUR_ID } from 'frontend/screens/Library/components/LibraryTour'

interface ActionIconsProps {
  'data-tour'?: string
}

export default React.memo(function ActionIcons({
  'data-tour': dataTour
}: ActionIconsProps = {}) {
  const { t } = useTranslation()
  const { refreshLibrary, refreshing } = useContext(ContextProvider)
  const [spinning, setSpinning] = useState(false)
  const spinTimeout = useRef<ReturnType<typeof setTimeout>>()

  useEffect(
    () => () => {
      if (spinTimeout.current) clearTimeout(spinTimeout.current)
    },
    []
  )

  const handleRefresh = async () => {
    if (spinTimeout.current) clearTimeout(spinTimeout.current)
    setSpinning(true)
    const startedAt = Date.now()
    await refreshLibrary({ checkForUpdates: true })
    spinTimeout.current = setTimeout(
      () => setSpinning(false),
      Math.max(0, 700 - (Date.now() - startedAt))
    )
  }

  const {
    handleLayout,
    layout,
    sortDescending,
    setSortDescending,
    sortInstalled,
    setSortInstalled,
    sortBy,
    setSortBy,
    showAlphabetFilter,
    onToggleAlphabetFilter
  } = useContext(LibraryContext)

  const sortByReleaseDate = sortBy === 'releaseDate'
  const sortDirectionIcon = sortByReleaseDate
    ? sortDescending
      ? ArrowDown10
      : ArrowDown01
    : sortDescending
      ? ArrowDownZA
      : ArrowDownAZ

  return (
    <div className="ActionIcons" data-tour={dataTour}>
      <FormControl segmented small>
        {layout === 'grid' ? (
          <Tooltip
            content={t('library.toggleLayout.list', 'Toggle to a list layout')}
            asChild
          >
            <button
              aria-label={t(
                'library.toggleLayout.list',
                'Toggle to a list layout'
              )}
              className="FormControl__button"
              onClick={() => handleLayout('list')}
            >
              <Icon
                glyph={List}
                className="FormControl__segmentedLucideIcon"
                data-tour="library-view-toggle"
              />
            </button>
          </Tooltip>
        ) : (
          <Tooltip
            content={t('library.toggleLayout.grid', 'Toggle to a grid layout')}
            asChild
          >
            <button
              aria-label={t(
                'library.toggleLayout.grid',
                'Toggle to a grid layout'
              )}
              className="FormControl__button"
              onClick={() => handleLayout('grid')}
            >
              <Icon
                glyph={LayoutGrid}
                className="FormControl__segmentedLucideIcon"
                data-tour="library-view-toggle"
              />
            </button>
          </Tooltip>
        )}
        <Tooltip
          content={
            sortDescending
              ? t('library.sortDescending', 'Sort descending')
              : t('library.sortAscending', 'Sort ascending')
          }
          asChild
        >
          <button
            aria-label={
              sortDescending
                ? t('library.sortDescending', 'Sort descending')
                : t('library.sortAscending', 'Sort ascending')
            }
            className="FormControl__button"
            onClick={() => setSortDescending(!sortDescending)}
          >
            <Icon
              glyph={sortDirectionIcon}
              className="FormControl__segmentedLucideIcon"
              data-tour="library-sort-az"
            />
          </button>
        </Tooltip>
        <Tooltip
          content={t('library.sortByReleaseDate', 'Sort by release date')}
          asChild
        >
          <button
            aria-label={t('library.sortByReleaseDate', 'Sort by release date')}
            aria-pressed={sortByReleaseDate}
            className="FormControl__button"
            onClick={() =>
              setSortBy(sortByReleaseDate ? 'title' : 'releaseDate')
            }
          >
            <Icon
              glyph={CalendarDays}
              className="FormControl__segmentedLucideIcon"
              strokeWidth={sortByReleaseDate ? 2.25 : undefined}
              fill={sortByReleaseDate ? 'currentColor' : 'none'}
              fillOpacity={sortByReleaseDate ? 0.15 : 0}
              data-tour="library-sort-release-date"
            />
          </button>
        </Tooltip>
        <Tooltip content={t('library.sortByStatus', 'Sort by status')} asChild>
          <button
            aria-label={t('library.sortByStatus', 'Sort by status')}
            className="FormControl__button"
            onClick={() => setSortInstalled(!sortInstalled)}
          >
            <Icon
              glyph={HardDrive}
              className="FormControl__segmentedLucideIcon"
              strokeWidth={sortInstalled ? 2.25 : undefined}
              fill={sortInstalled ? 'currentColor' : 'none'}
              fillOpacity={sortInstalled ? 0.15 : 0}
              data-tour="library-sort-installed"
            />
          </button>
        </Tooltip>
        <Tooltip
          content={
            showAlphabetFilter
              ? t('library.hideAlphabetFilter', 'Hide alphabet filter')
              : t('library.showAlphabetFilter', 'Show alphabet filter')
          }
          asChild
        >
          <button
            aria-label={
              showAlphabetFilter
                ? t('library.hideAlphabetFilter', 'Hide alphabet filter')
                : t('library.showAlphabetFilter', 'Show alphabet filter')
            }
            className="FormControl__button"
            onClick={onToggleAlphabetFilter}
          >
            {showAlphabetFilter ? (
              <Icon
                glyph={FilterX}
                className="FormControl__segmentedLucideIcon"
              />
            ) : (
              <Icon
                glyph={ListFilter}
                className="FormControl__segmentedLucideIcon"
              />
            )}
          </button>
        </Tooltip>
        <Tooltip
          content={t('generic.library.refresh', 'Refresh library')}
          asChild
        >
          <button
            aria-label={t('generic.library.refresh', 'Refresh library')}
            className={classNames('FormControl__button', {
              active: refreshing || spinning
            })}
            onClick={handleRefresh}
          >
            <Icon
              glyph={RefreshCw}
              className={classNames('FormControl__segmentedLucideIcon', {
                ['lucide-spin']: refreshing || spinning
              })}
              data-tour="library-refresh"
            />
          </button>
        </Tooltip>
        <TourButton tourId={LIBRARY_TOUR_ID} className="library-tour-button" />
      </FormControl>
    </div>
  )
})
