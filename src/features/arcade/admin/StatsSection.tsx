import { useEffect, useState } from 'react';
import { Card, CardHeader } from '@mister-guiiug/dev-pwa-config/react/card';
import { EmptyState } from '@mister-guiiug/dev-pwa-config/react/empty-state';
import { ErrorBanner } from '@mister-guiiug/dev-pwa-config/react/error-banner';
import { SegmentedControl } from '@mister-guiiug/dev-pwa-config/react/segmented-control';
import { SkeletonGroup } from '@mister-guiiug/dev-pwa-config/react/skeleton';
import { Stat } from '@mister-guiiug/dev-pwa-config/react/stat';
import { useI18n } from '../../../i18n/index.ts';
import { arcade } from '../../../backend/index.ts';
import type { Stats } from '../model.ts';
import { toArcadeError, type ArcadeErrorCode } from '../backend/errors.ts';
import { errorKey } from '../errors-i18n.ts';
import { BarSeries } from './BarSeries.tsx';

const PERIODS = ['7', '30', '90'] as const;
type Period = (typeof PERIODS)[number];

function timeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';
  } catch {
    return 'Europe/Paris';
  }
}

/**
 * Ce qu'un client demande après un salon : combien de parties, de gains, de
 * contacts, et quand. Les chiffres clés en tuiles (ce ne sont pas des
 * graphiques), puis deux séries en barres et la répartition par lot.
 */
export function StatsSection({ tenantId }: { tenantId: string }) {
  const { t, fmt } = useI18n();
  const [period, setPeriod] = useState<Period>('30');
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<ArcadeErrorCode | null>(null);

  useEffect(() => {
    let alive = true;
    arcade
      .stats(tenantId, Number(period), timeZone())
      .then(next => {
        if (!alive) return;
        setStats(next);
        setError(null);
      })
      .catch(cause => {
        if (alive) setError(toArcadeError(cause).code);
      });
    return () => {
      alive = false;
    };
  }, [tenantId, period]);

  const totals = stats?.totals;
  const ratio = (part: number, whole: number) =>
    whole > 0 ? fmt.percent(part / whole, 1) : '–';
  const maxPrize = Math.max(1, ...(stats?.byPrize.map(p => p.count) ?? [1]));

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        value={period}
        onChange={value => setPeriod(value as Period)}
        ariaLabel={t('adminStats.period')}
        options={PERIODS.map(value => ({
          value,
          label: t(`adminStats.days${value}`),
        }))}
      />
      {error ? <ErrorBanner message={t(errorKey(error))} /> : null}
      {!stats && !error ? (
        <SkeletonGroup label={t('adminStats.title')} lines={4} />
      ) : null}
      {stats && totals ? (
        <>
          <div className="arcade-stats-grid">
            <Stat
              label={t('adminStats.spins')}
              value={fmt.number(totals.spins)}
            />
            <Stat
              label={t('adminStats.wins')}
              value={fmt.number(totals.wins)}
              delta={t('adminStats.ofSpins', {
                value: ratio(totals.wins, totals.spins),
              })}
            />
            <Stat
              label={t('adminStats.leads')}
              value={fmt.number(totals.leads)}
              delta={t('adminStats.ofSpins', {
                value: ratio(totals.leads, totals.spins),
              })}
            />
            <Stat
              label={t('adminStats.offline')}
              value={fmt.number(totals.offline)}
            />
            {totals.oversold > 0 ? (
              <Stat
                label={t('adminStats.oversold')}
                value={fmt.number(totals.oversold)}
                delta={t('adminStats.oversoldHint')}
              />
            ) : null}
          </div>

          {totals.spins === 0 ? (
            <EmptyState title={t('adminStats.empty')} />
          ) : (
            <>
              <Card>
                <CardHeader title={t('adminStats.byPrize')} />
                <table className="arcade-table">
                  <thead>
                    <tr>
                      <th scope="col">{t('adminLeads.prize')}</th>
                      <th scope="col">{t('adminStats.count')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byPrize.map(row => (
                      <tr key={`${row.label}|${row.lose}`}>
                        <td>{row.label}</td>
                        <td className="arcade-meter-cell">
                          <span
                            className="arcade-meter"
                            style={{
                              width: `${(row.count / maxPrize) * 100}%`,
                            }}
                            aria-hidden="true"
                          />
                          <span>{fmt.number(row.count)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              <Card>
                <BarSeries
                  title={t('adminStats.byDay')}
                  valueLabel={t('adminStats.spins')}
                  bars={stats.byDay.map((day, i, all) => ({
                    label: fmt.date(`${day.day}T12:00:00`),
                    tick:
                      all.length <= 10 || i % Math.ceil(all.length / 8) === 0
                        ? String(Number(day.day.slice(8, 10)))
                        : '',
                    value: day.spins,
                  }))}
                />
              </Card>
              <Card>
                <BarSeries
                  title={t('adminStats.byHour')}
                  valueLabel={t('adminStats.spins')}
                  bars={stats.byHour.map((value, hour) => ({
                    label: `${hour} h`,
                    tick: hour % 3 === 0 ? `${hour}h` : '',
                    value,
                  }))}
                />
              </Card>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
