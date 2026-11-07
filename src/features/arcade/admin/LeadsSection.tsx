import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { Badge } from '@mister-guiiug/dev-pwa-config/react/badge';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { Card, CardHeader } from '@mister-guiiug/dev-pwa-config/react/card';
import { ConfirmDialog } from '@mister-guiiug/dev-pwa-config/react/confirm-dialog';
import { EmptyState } from '@mister-guiiug/dev-pwa-config/react/empty-state';
import { ErrorBanner } from '@mister-guiiug/dev-pwa-config/react/error-banner';
import { TextField } from '@mister-guiiug/dev-pwa-config/react/field';
import { useToast } from '@mister-guiiug/dev-pwa-config/react/toast';
import { dateSlug, downloadText } from '@mister-guiiug/dev-pwa-config/download';
import { useI18n } from '../../../i18n/index.ts';
import { arcade } from '../../../backend/index.ts';
import type { LeadRecord } from '../model.ts';
import { toArcadeError, type ArcadeErrorCode } from '../backend/errors.ts';
import { errorKey } from '../errors-i18n.ts';
import { leadsToCsv } from './leads-csv.ts';

const PAGE = 25;
const UNDO_MS = 5000;

/**
 * Les contacts : liste paginée côté serveur, recherche, export CSV, et une
 * suppression RÉELLE. Jusqu'au 07/11/2026 l'admin ne voyait qu'un compteur,
 * et « Effacer les leads » ne vidait que le cache de l'appareil : tout
 * revenait au rechargement.
 *
 * Supprimer un contact s'annule pendant cinq secondes (ADR 0008) ; tout
 * supprimer se confirme, parce que c'est massif et définitif.
 */
export function LeadsSection({ tenantId }: { tenantId: string }) {
  const { t, m, fmt } = useI18n();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<LeadRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ArcadeErrorCode | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const pendingDeletes = useRef(new Map<string, number>());

  const [version, setVersion] = useState(0);
  const fetchPage = useCallback(() => setVersion(v => v + 1), []);

  useEffect(() => {
    let alive = true;
    arcade
      .listLeads(tenantId, { page, pageSize: PAGE, search: query })
      .then(result => {
        if (!alive) return;
        setRows(result.rows);
        setTotal(result.total);
        setError(null);
      })
      .catch(cause => {
        if (alive) setError(toArcadeError(cause).code);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [tenantId, page, query, version]);

  // Une recherche qui attend la fin de la frappe : une requête, pas une par lettre.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(0);
      setQuery(search);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Les suppressions en attente partent si l'on quitte l'écran.
  useEffect(() => {
    const pending = pendingDeletes.current;
    return () => {
      for (const [id, timer] of pending) {
        window.clearTimeout(timer);
        void arcade.deleteLead(tenantId, id);
      }
      pending.clear();
    };
  }, [tenantId]);

  const formatDate = (iso: string) => fmt.dateTime(iso);

  const remove = (lead: LeadRecord) => {
    setHidden(prev => [...prev, lead.id]);
    const timer = window.setTimeout(() => {
      pendingDeletes.current.delete(lead.id);
      void arcade
        .deleteLead(tenantId, lead.id)
        .then(() => fetchPage())
        .catch(cause => {
          setHidden(prev => prev.filter(id => id !== lead.id));
          setError(toArcadeError(cause).code);
        });
    }, UNDO_MS);
    pendingDeletes.current.set(lead.id, timer);
    toast.show(t('adminLeads.deleted'), {
      duration: UNDO_MS,
      action: {
        onAction: () => {
          window.clearTimeout(timer);
          pendingDeletes.current.delete(lead.id);
          setHidden(prev => prev.filter(id => id !== lead.id));
        },
      },
    });
  };

  const exportAll = async () => {
    setExporting(true);
    try {
      const all: LeadRecord[] = [];
      for (let p = 0; ; p += 1) {
        const chunk = await arcade.listLeads(tenantId, {
          page: p,
          pageSize: 500,
          search: query,
        });
        all.push(...chunk.rows);
        if (all.length >= chunk.total || chunk.rows.length === 0) break;
      }
      const csv = leadsToCsv(
        all,
        {
          date: t('adminLeads.date'),
          outcome: t('adminLeads.outcome'),
          prize: t('adminLeads.prize'),
          code: t('adminLeads.code'),
          prenom: t('lead.prenom'),
          nom: t('lead.nom'),
          email: t('lead.email'),
          telephone: t('lead.telephone'),
          source: t('adminLeads.source'),
          consentAt: t('adminLeads.consent'),
          consentText: t('adminForm.consent'),
          won: t('adminLeads.won'),
          lost: t('adminLeads.lost'),
          online: t('adminLeads.online'),
          offline: t('adminLeads.offline'),
        },
        formatDate
      );
      downloadText(csv, `contacts-${dateSlug()}.csv`, 'text/csv;charset=utf-8');
    } catch (cause) {
      setError(toArcadeError(cause).code);
    } finally {
      setExporting(false);
    }
  };

  const visible = rows.filter(row => !hidden.includes(row.id));
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <Card>
      <CardHeader
        title={t('adminLeads.title')}
        subtitle={fmt.plural(total, m.adminLeads.count, { count: total })}
        action={
          <Button
            variant="outline"
            size="sm"
            loading={exporting}
            disabled={total === 0}
            onClick={() => void exportAll()}
          >
            <Download size={16} aria-hidden="true" />
            {t('adminLeads.export')}
          </Button>
        }
      />
      <div className="flex flex-col gap-3">
        <TextField
          label={t('adminLeads.search')}
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {error ? <ErrorBanner message={t(errorKey(error))} /> : null}
        {!loading && visible.length === 0 ? (
          <EmptyState title={t('adminLeads.empty')} />
        ) : (
          <div className="arcade-table-wrap" aria-busy={loading || undefined}>
            <table className="arcade-table">
              <thead>
                <tr>
                  <th scope="col">{t('adminLeads.date')}</th>
                  <th scope="col">{t('adminLeads.outcome')}</th>
                  <th scope="col">{t('adminLeads.contact')}</th>
                  <th scope="col">{t('adminLeads.code')}</th>
                  <th scope="col">{t('adminLeads.source')}</th>
                  <th scope="col">
                    <span className="sr-only">{t('adminLeads.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map(lead => (
                  <tr key={lead.id}>
                    <td>{formatDate(lead.createdAt)}</td>
                    <td>
                      {lead.lose ? (
                        <Badge tone="muted">{t('adminLeads.lost')}</Badge>
                      ) : (
                        <>
                          {lead.lose === false ? (
                            <Badge tone="success">{t('adminLeads.won')}</Badge>
                          ) : null}{' '}
                          {lead.prizeLabel}
                        </>
                      )}
                    </td>
                    <td>
                      {[lead.fields.prenom, lead.fields.nom]
                        .filter(Boolean)
                        .join(' ')}
                      {lead.fields.email ? (
                        <div>{lead.fields.email}</div>
                      ) : null}
                      {lead.fields.telephone ? (
                        <div>{lead.fields.telephone}</div>
                      ) : null}
                    </td>
                    <td>
                      <code>{lead.redeemCode ?? ''}</code>
                    </td>
                    <td>
                      {lead.source === 'offline'
                        ? t('adminLeads.offline')
                        : t('adminLeads.online')}
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        iconOnly
                        aria-label={t('adminLeads.delete', {
                          date: formatDate(lead.createdAt),
                        })}
                        onClick={() => remove(lead)}
                      >
                        <Trash2 size={18} aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
            >
              {t('adminLeads.previous')}
            </Button>
            <span className="text-soft text-sm">
              {t('adminLeads.page', { page: page + 1, pages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= pages}
              onClick={() => setPage(p => p + 1)}
            >
              {t('adminLeads.next')}
            </Button>
          </div>
          {total > 0 ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirmAll(true)}
            >
              {t('adminLeads.deleteAll')}
            </Button>
          ) : null}
        </div>
      </div>
      <ConfirmDialog
        open={confirmAll}
        destructive
        title={t('adminLeads.deleteAllConfirm')}
        message={t('adminLeads.deleteAllBody')}
        onConfirm={() => {
          setConfirmAll(false);
          void arcade
            .deleteAllLeads(tenantId)
            .then(() => {
              setPage(0);
              return fetchPage();
            })
            .catch(cause => setError(toArcadeError(cause).code));
        }}
        onCancel={() => setConfirmAll(false)}
      />
    </Card>
  );
}
