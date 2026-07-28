import { Plus, Loader2, Clock, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useComplaints } from '@/hooks/useOrderTabs'
import { cn } from '@/lib/utils'
import {
  COMPLAINT_TYPES,
  COMPLAINT_SEVERITIES,
  COMPLAINT_STATUS_META,
  CAPA_STATUS_META,
  CAPA_STATUSES,
} from '@/types/orders'
import type { CapaActionDto, CapaStatus } from '@/types/orders'

interface Props {
  orderId: string
}

export function ComplaintsTab({ orderId }: Props) {
  const { t } = useTranslation()
  const { list, create, updateRootCause, capaCreate, capaUpdateStatus } = useComplaints(orderId)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [complaintType, setComplaintType] = useState<string>('quality_defect')
  const [severity, setSeverity] = useState<string>('medium')
  const [description, setDescription] = useState('')
  const [escalatedBanner, setEscalatedBanner] = useState(false)

  // CAPA inline form
  const [capaFormComplaintId, setCapaFormComplaintId] = useState<string | null>(null)
  const [capaDesc, setCapaDesc] = useState('')
  const [capaOwner, setCapaOwner] = useState('')
  const [capaDueDate, setCapaDueDate] = useState('')

  const complaints = list.data ?? []
  const openCount = complaints.filter((c) => c.status !== 'resolved').length

  const handleCreate = () => {
    create.mutate(
      {
        type: complaintType as never,
        severity: severity as never,
        description,
      },
      {
        onSuccess: (data) => {
          setDrawerOpen(false)
          setDescription('')
          if (data.severity === 'high' || data.severity === 'critical') {
            setEscalatedBanner(true)
          }
        },
      }
    )
  }

  const handleCapaCreate = (complaintId: string) => {
    capaCreate.mutate(
      {
        complaintId,
        dto: {
          description: capaDesc,
          owner_user_id: capaOwner,
          due_date: capaDueDate,
        },
      },
      {
        onSuccess: () => {
          setCapaFormComplaintId(null)
          setCapaDesc('')
          setCapaOwner('')
          setCapaDueDate('')
        },
      }
    )
  }

  return (
    <div className="space-y-4" data-testid="complaints-tab">
      {escalatedBanner && (
        <div className="rounded-md bg-orange-50 p-3 text-sm text-orange-800 dark:bg-orange-950 dark:text-orange-200">
          {t('complaints.escalated')}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {t('complaints.title')}
          {openCount > 0 && (
            <Badge variant="destructive" className="ml-2">
              {openCount}
            </Badge>
          )}
        </h3>
        <Button size="sm" onClick={() => setDrawerOpen(true)} data-testid="raise-complaint-btn">
          <Plus className="mr-2 h-4 w-4" />
          {t('complaints.raise')}
        </Button>
      </div>

      {list.isPending ? (
        <Loader2 className="h-6 w-6 animate-spin" />
      ) : complaints.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">{t('complaints.none')}</p>
      ) : (
        <div className="space-y-2">
          {complaints.map((c) => {
            const meta = COMPLAINT_STATUS_META[c.status]
            const isExpanded = expandedId === c.id
            return (
              <div key={c.id} className="rounded-md border">
                <button
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span className="font-medium text-sm">{c.complaint_no}</span>
                  <Badge variant="outline" className="text-xs">
                    {t(`complaints.type.${c.type}`)}
                  </Badge>
                  <Badge
                    className={cn('text-xs', {
                      'bg-gray-200 text-gray-700': c.severity === 'low',
                      'bg-amber-100 text-amber-800': c.severity === 'medium',
                      'bg-orange-100 text-orange-800': c.severity === 'high',
                      'bg-red-100 text-red-800': c.severity === 'critical',
                    })}
                  >
                    {t(`complaints.severity.${c.severity}`)}
                  </Badge>
                  <Badge variant={meta.badgeVariant} className={cn('text-xs', meta.badgeClass)}>
                    {t(meta.labelKey)}
                  </Badge>
                  <span className="ml-auto text-xs text-muted-foreground">{c.complaint_date}</span>
                </button>
                {isExpanded && (
                  <div className="border-t px-4 py-3 space-y-3">
                    <p className="text-sm">{c.description}</p>
                    {c.root_cause ? (
                      <p className="text-sm text-muted-foreground">
                        <strong>{t('complaints.rootCause')}:</strong> {c.root_cause}
                      </p>
                    ) : c.status !== 'resolved' ? (
                      <RootCauseEditor
                        complaintId={c.id}
                        onSave={(rc) => updateRootCause.mutate({ id: c.id, root_cause: rc })}
                      />
                    ) : null}

                    {/* CAPA section */}
                    <CapaSection
                      complaintId={c.id}
                      onStatusChange={(capaId, status) =>
                        capaUpdateStatus.mutate({ complaintId: c.id, capaId, dto: { status } })
                      }
                      capaFormOpen={capaFormComplaintId === c.id}
                      capaDesc={capaDesc}
                      capaOwner={capaOwner}
                      capaDueDate={capaDueDate}
                      onCapaDescChange={setCapaDesc}
                      onCapaOwnerChange={setCapaOwner}
                      onCapaDueDateChange={setCapaDueDate}
                      onOpenCapaForm={() => setCapaFormComplaintId(c.id)}
                      onCloseCapaForm={() => setCapaFormComplaintId(null)}
                      onSubmitCapa={() => handleCapaCreate(c.id)}
                      isSubmitting={capaCreate.isPending}
                      t={t}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Raise complaint drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t('complaints.raise')}</SheetTitle>
            <SheetDescription>{t('complaints.raiseDescription')}</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>{t('complaints.type')}</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={complaintType}
                onChange={(e) => setComplaintType(e.target.value)}
              >
                {COMPLAINT_TYPES.map((ct) => (
                  <option key={ct} value={ct}>
                    {t(`complaints.type.${ct}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t('complaints.severity')}</Label>
              <div className="flex gap-4">
                {COMPLAINT_SEVERITIES.map((s) => (
                  <label key={s} className="flex items-center gap-1 text-sm">
                    <input
                      type="radio"
                      name="severity"
                      checked={severity === s}
                      onChange={() => setSeverity(s)}
                    />
                    {t(`complaints.severity.${s}`)}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('complaints.description')}</Label>
              <textarea
                className="h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={create.isPending || !description.trim()}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.save')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ── Root Cause Editor ────────────────────────────────────────────────────────
function RootCauseEditor({
  complaintId: _complaintId,
  onSave,
}: {
  complaintId: string
  onSave: (rc: string) => void
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')

  if (!editing) {
    return (
      <Button
        variant="link"
        size="sm"
        className="h-auto p-0 text-xs"
        onClick={() => setEditing(true)}
      >
        + {t('complaints.addRootCause')}
      </Button>
    )
  }

  return (
    <div className="space-y-2">
      <textarea
        className="h-16 w-full rounded-md border bg-background px-3 py-2 text-sm"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => {
            onSave(value)
            setEditing(false)
          }}
          disabled={!value.trim()}
        >
          {t('common.save')}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  )
}

// ── CAPA Section ─────────────────────────────────────────────────────────────
function CapaSection({
  complaintId,
  onStatusChange,
  capaFormOpen,
  capaDesc,
  capaOwner,
  capaDueDate,
  onCapaDescChange,
  onCapaOwnerChange,
  onCapaDueDateChange,
  onOpenCapaForm,
  onCloseCapaForm,
  onSubmitCapa,
  isSubmitting,
  t,
}: {
  complaintId: string
  onStatusChange: (capaId: string, status: CapaStatus) => void
  capaFormOpen: boolean
  capaDesc: string
  capaOwner: string
  capaDueDate: string
  onCapaDescChange: (v: string) => void
  onCapaOwnerChange: (v: string) => void
  onCapaDueDateChange: (v: string) => void
  onOpenCapaForm: () => void
  onCloseCapaForm: () => void
  onSubmitCapa: () => void
  isSubmitting: boolean
  t: ReturnType<typeof useTranslation>['t']
}) {
  const { capaList: capaQuery } = useComplaints(complaintId)
  const capas = capaQuery(complaintId).data ?? []

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase text-muted-foreground">{t('capa.title')}</h4>
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onOpenCapaForm}>
          <Plus className="mr-1 h-3 w-3" /> {t('capa.add')}
        </Button>
      </div>

      {capas.map((capa: CapaActionDto) => {
        const meta = CAPA_STATUS_META[capa.status]
        const isOverdue = new Date(capa.due_date) < new Date() && capa.status !== 'done'
        return (
          <div
            key={capa.id}
            className="rounded-md bg-muted/30 p-2 text-xs flex items-center justify-between"
          >
            <div className="flex-1">
              <p>{capa.description}</p>
              <p className="text-muted-foreground">
                {t('capa.owner')}: {capa.owner_name ?? capa.owner_user_id.slice(0, 8)}
                {' · '}
                {t('capa.due')}:{' '}
                <span className={cn(isOverdue && 'text-red-600 font-medium')}>
                  {capa.due_date}
                  {isOverdue && <Clock className="ml-1 inline h-3 w-3 text-red-500" />}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={meta.badgeVariant} className={cn('text-xs', meta.badgeClass)}>
                {t(meta.labelKey)}
              </Badge>
              {capa.status !== 'done' && (
                <select
                  className="h-7 rounded border bg-background px-1 text-xs"
                  value={capa.status}
                  onChange={(e) => onStatusChange(capa.id, e.target.value as CapaStatus)}
                >
                  {CAPA_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(CAPA_STATUS_META[s].labelKey)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )
      })}

      {capaFormOpen && (
        <div className="space-y-2 rounded-md border p-3">
          <textarea
            className="h-16 w-full rounded border bg-background px-2 py-1 text-sm"
            placeholder={t('capa.description')}
            value={capaDesc}
            onChange={(e) => onCapaDescChange(e.target.value)}
          />
          <Input
            placeholder={t('capa.ownerId')}
            value={capaOwner}
            onChange={(e) => onCapaOwnerChange(e.target.value)}
            className="h-8 text-sm"
          />
          <Input
            type="date"
            value={capaDueDate}
            onChange={(e) => onCapaDueDateChange(e.target.value)}
            className="h-8 text-sm"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={onSubmitCapa}
              disabled={isSubmitting || !capaDesc.trim() || !capaDueDate}
            >
              {isSubmitting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              {t('common.save')}
            </Button>
            <Button size="sm" variant="outline" onClick={onCloseCapaForm}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
