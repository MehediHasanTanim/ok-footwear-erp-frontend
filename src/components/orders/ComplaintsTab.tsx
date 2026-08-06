import { useQuery } from '@tanstack/react-query'
import { Plus, Loader2, Clock, ChevronDown, ChevronRight, Search } from 'lucide-react'
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
import { useDebounce } from '@/hooks/useDebounce'
import { unwrapPaginatedList } from '@/hooks/useOrders'
import { useComplaints } from '@/hooks/useOrderTabs'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  COMPLAINT_TYPES,
  COMPLAINT_SEVERITIES,
  COMPLAINT_STATUS_META,
  CAPA_STATUS_META,
  CAPA_STATUSES,
} from '@/types/orders'
import type { CapaActionDto, CapaStatus, ComplaintSeverity, ComplaintType } from '@/types/orders'

interface Props {
  orderId: string
}

interface UserSuggestion {
  id: string
  email: string
  fullName?: string
  full_name?: string
  firstName?: string
  lastName?: string
}

function userDisplayName(u: UserSuggestion): string {
  return u.fullName || u.full_name || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email
}

export function ComplaintsTab({ orderId }: Props) {
  const { t } = useTranslation()
  const { list, create, updateRootCause, capaCreate, capaUpdateStatus, capaList } =
    useComplaints(orderId)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [complaintType, setComplaintType] = useState<ComplaintType>('quality')
  const [severity, setSeverity] = useState<ComplaintSeverity>('medium')
  const [description, setDescription] = useState('')
  const [escalatedBanner, setEscalatedBanner] = useState(false)

  const [capaFormComplaintId, setCapaFormComplaintId] = useState<string | null>(null)
  const [capaDesc, setCapaDesc] = useState('')
  const [capaOwnerId, setCapaOwnerId] = useState('')
  const [capaOwnerName, setCapaOwnerName] = useState('')
  const [capaDueDate, setCapaDueDate] = useState('')

  const complaints = list.data ?? []
  const openCount = complaints.filter((c) => c.status !== 'resolved').length

  const resetCapaForm = () => {
    setCapaFormComplaintId(null)
    setCapaDesc('')
    setCapaOwnerId('')
    setCapaOwnerName('')
    setCapaDueDate('')
  }

  const handleCreate = () => {
    create.mutate(
      {
        type: complaintType,
        severity,
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
          ownerId: capaOwnerId,
          dueDate: capaDueDate,
        },
      },
      {
        onSuccess: () => {
          resetCapaForm()
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
                  <span className="font-medium text-sm">{c.complaintNo ?? c.id.slice(0, 8)}</span>
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
                  <span className="ml-auto text-xs text-muted-foreground">{c.complaintDate}</span>
                </button>
                {isExpanded && (
                  <div className="border-t px-4 py-3 space-y-3">
                    <p className="text-sm">{c.description}</p>
                    {c.rootCause ? (
                      <p className="text-sm text-muted-foreground">
                        <strong>{t('complaints.rootCause')}:</strong> {c.rootCause}
                      </p>
                    ) : c.status !== 'resolved' ? (
                      <RootCauseEditor
                        complaintId={c.id}
                        onSave={(rc) => updateRootCause.mutate({ id: c.id, rootCause: rc })}
                      />
                    ) : null}

                    <CapaSection
                      complaintId={c.id}
                      capaList={capaList}
                      onStatusChange={(capaId, status) =>
                        capaUpdateStatus.mutate({ complaintId: c.id, capaId, dto: { status } })
                      }
                      capaFormOpen={capaFormComplaintId === c.id}
                      capaDesc={capaDesc}
                      capaOwnerId={capaOwnerId}
                      capaOwnerName={capaOwnerName}
                      capaDueDate={capaDueDate}
                      onCapaDescChange={setCapaDesc}
                      onCapaOwnerSelect={(id, name) => {
                        setCapaOwnerId(id)
                        setCapaOwnerName(name)
                      }}
                      onCapaOwnerClear={() => {
                        setCapaOwnerId('')
                        setCapaOwnerName('')
                      }}
                      onCapaDueDateChange={setCapaDueDate}
                      onOpenCapaForm={() => setCapaFormComplaintId(c.id)}
                      onCloseCapaForm={resetCapaForm}
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

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t('complaints.raise')}</SheetTitle>
            <SheetDescription>{t('complaints.raiseDescription')}</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>{t('complaints.typeLabel')}</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={complaintType}
                onChange={(e) => setComplaintType(e.target.value as ComplaintType)}
              >
                {COMPLAINT_TYPES.map((ct) => (
                  <option key={ct} value={ct}>
                    {t(`complaints.type.${ct}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t('complaints.severityLabel')}</Label>
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

function CapaOwnerPicker({
  ownerId,
  ownerName,
  onSelect,
  onClear,
  t,
}: {
  ownerId: string
  ownerName: string
  onSelect: (id: string, name: string) => void
  onClear: () => void
  t: ReturnType<typeof useTranslation>['t']
}) {
  const [userSearch, setUserSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const debouncedSearch = useDebounce(userSearch, 300)

  const { data: suggestions = [] } = useQuery({
    queryKey: ['users', 'search', 'capa-owner', debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch.trim()) return [] as UserSuggestion[]
      // Backend may return { data: User[] } or nested { data: { data: User[], meta } }
      const { data: body } = await api.get('/users', {
        params: { search: debouncedSearch, limit: 5 },
      })
      return unwrapPaginatedList<UserSuggestion>(body).data
    },
    enabled: debouncedSearch.trim().length > 0,
  })

  const suggestionList = Array.isArray(suggestions) ? suggestions : []

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <Input
          value={ownerName || userSearch}
          onChange={(e) => {
            setUserSearch(e.target.value)
            onClear()
            if (e.target.value) setDropdownOpen(true)
          }}
          onFocus={() => {
            if (suggestionList.length > 0) setDropdownOpen(true)
          }}
          placeholder={t('capa.ownerSearch')}
          className="h-8 text-sm"
          autoComplete="off"
          data-testid="capa-owner-search"
        />
      </div>
      {ownerId && ownerName && (
        <p className="mt-1 text-xs text-muted-foreground" data-testid="capa-owner-selected">
          {ownerName}
        </p>
      )}
      <div
        className={cn(
          'absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md',
          dropdownOpen && suggestionList.length > 0 ? '' : 'hidden'
        )}
      >
        {suggestionList.map((u) => {
          const name = userDisplayName(u)
          return (
            <button
              key={u.id}
              type="button"
              className="block w-full cursor-pointer px-3 py-1.5 text-left text-xs hover:bg-muted"
              onMouseDown={(e) => {
                e.preventDefault()
                onSelect(u.id, name)
                setUserSearch('')
                setDropdownOpen(false)
              }}
              data-testid={`capa-owner-opt-${u.id}`}
            >
              <div className="font-medium">{name}</div>
              <div className="text-muted-foreground">{u.email}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CapaSection({
  complaintId,
  capaList,
  onStatusChange,
  capaFormOpen,
  capaDesc,
  capaOwnerId,
  capaOwnerName,
  capaDueDate,
  onCapaDescChange,
  onCapaOwnerSelect,
  onCapaOwnerClear,
  onCapaDueDateChange,
  onOpenCapaForm,
  onCloseCapaForm,
  onSubmitCapa,
  isSubmitting,
  t,
}: {
  complaintId: string
  capaList: (complaintId: string) => { data?: CapaActionDto[] }
  onStatusChange: (capaId: string, status: CapaStatus) => void
  capaFormOpen: boolean
  capaDesc: string
  capaOwnerId: string
  capaOwnerName: string
  capaDueDate: string
  onCapaDescChange: (v: string) => void
  onCapaOwnerSelect: (id: string, name: string) => void
  onCapaOwnerClear: () => void
  onCapaDueDateChange: (v: string) => void
  onOpenCapaForm: () => void
  onCloseCapaForm: () => void
  onSubmitCapa: () => void
  isSubmitting: boolean
  t: ReturnType<typeof useTranslation>['t']
}) {
  const capas = capaList(complaintId).data ?? []

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
        const isOverdue = new Date(capa.dueDate) < new Date() && capa.status !== 'done'
        return (
          <div
            key={capa.id}
            className="rounded-md bg-muted/30 p-2 text-xs flex items-center justify-between"
          >
            <div className="flex-1">
              <p>{capa.description}</p>
              <p className="text-muted-foreground">
                {t('capa.owner')}: {capa.ownerName ?? capa.ownerId.slice(0, 8)}
                {' · '}
                {t('capa.due')}:{' '}
                <span className={cn(isOverdue && 'text-red-600 font-medium')}>
                  {capa.dueDate}
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
          <CapaOwnerPicker
            ownerId={capaOwnerId}
            ownerName={capaOwnerName}
            onSelect={onCapaOwnerSelect}
            onClear={onCapaOwnerClear}
            t={t}
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
              disabled={isSubmitting || !capaDesc.trim() || !capaOwnerId || !capaDueDate}
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
