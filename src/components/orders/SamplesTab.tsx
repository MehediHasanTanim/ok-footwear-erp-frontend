import { CheckCircle2, Circle, AlertTriangle, Plus, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { useSamples } from '@/hooks/useOrderTabs'
import { cn } from '@/lib/utils'
import { SAMPLE_TYPES, SAMPLE_APPROVAL_STATUS_META } from '@/types/orders'
import type { SampleDto, SampleApprovalStatus } from '@/types/orders'

interface Props {
  orderId: string
  sampleApproved: boolean
}

export function SamplesTab({ orderId, sampleApproved }: Props) {
  const { t } = useTranslation()
  const { list, create, approve, reject } = useSamples(orderId)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [approveTarget, setApproveTarget] = useState<SampleDto | null>(null)
  const [sampleType, setSampleType] = useState<string>('pp_sample')
  const [dispatchDate, setDispatchDate] = useState('')

  const samples = list.data ?? []
  const nextRound = Math.max(...samples.map((s) => s.round_number), 0) + 1

  const handleCreate = () => {
    create.mutate(
      {
        sample_type: sampleType as never,
        dispatch_date: dispatchDate || undefined,
      },
      {
        onSuccess: () => {
          setDrawerOpen(false)
          setSampleType('pp_sample')
          setDispatchDate('')
        },
      }
    )
  }

  const StatusIcon = ({ status }: { status: SampleApprovalStatus }) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />
      case 'rejected':
        return <AlertTriangle className="h-5 w-5 text-red-600" />
      default:
        return <Circle className="h-5 w-5 text-amber-500" />
    }
  }

  return (
    <div className="space-y-4" data-testid="samples-tab">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('samples.title')}</h3>
        <div className="flex items-center gap-3">
          <Badge
            variant={sampleApproved ? 'default' : 'secondary'}
            className={
              sampleApproved ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
            }
            data-testid="samples-tab-badge"
          >
            {sampleApproved ? `✓ ${t('samples.approved')}` : t('samples.pending')}
          </Badge>
          <Button size="sm" onClick={() => setDrawerOpen(true)} data-testid="add-sample-btn">
            <Plus className="mr-2 h-4 w-4" />
            {t('samples.addRound')}
          </Button>
        </div>
      </div>

      {list.isPending ? (
        <Loader2 className="h-6 w-6 animate-spin" />
      ) : samples.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">{t('samples.none')}</p>
      ) : (
        <div className="space-y-0">
          {[...samples]
            .sort((a, b) => a.round_number - b.round_number)
            .map((s, idx) => {
              const meta = SAMPLE_APPROVAL_STATUS_META[s.approval_status]
              const isLast = idx === samples.length - 1
              return (
                <div
                  key={s.id}
                  className="flex gap-3"
                  data-testid="sample-round-row"
                  data-approval-status={s.approval_status}
                >
                  <div className="flex flex-col items-center">
                    <StatusIcon status={s.approval_status} />
                    {!isLast && (
                      <div
                        className={cn(
                          'w-0.5 flex-1 min-h-[24px]',
                          s.approval_status === 'approved'
                            ? 'bg-green-500'
                            : s.approval_status === 'rejected'
                              ? 'bg-red-500'
                              : 'bg-gray-300'
                        )}
                      />
                    )}
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium">
                      {t('samples.roundN', { n: s.round_number })}
                    </p>
                    <p className="text-xs">
                      <Badge variant="outline" className="text-xs">
                        {t(`samples.type.${s.sample_type}`)}
                      </Badge>
                      <Badge
                        variant={meta.badgeVariant}
                        className={cn('ml-2 text-xs', meta.badgeClass)}
                      >
                        {t(meta.labelKey)}
                      </Badge>
                    </p>
                    {s.dispatch_date && (
                      <p className="text-xs text-muted-foreground">
                        {t('samples.dispatched')}: {s.dispatch_date}
                      </p>
                    )}
                    {s.buyer_comment && (
                      <p className="text-xs text-muted-foreground mt-1">{s.buyer_comment}</p>
                    )}
                    {s.approval_status === 'pending' && (
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" variant="default" onClick={() => setApproveTarget(s)}>
                          {t('samples.approve')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reject.mutate({ id: s.id })}
                          disabled={reject.isPending}
                        >
                          {t('samples.reject')}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
        </div>
      )}

      {/* Approve confirmation dialog */}
      <AlertDialog open={!!approveTarget} onOpenChange={(open) => !open && setApproveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('samples.approveTitle', { n: approveTarget?.round_number ?? '' })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('samples.approveDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (approveTarget) {
                  approve.mutate(approveTarget.id)
                  setApproveTarget(null)
                }
              }}
              disabled={approve.isPending}
            >
              {approve.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('samples.approve')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add round drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t('samples.addRound')}</SheetTitle>
            <SheetDescription>{t('samples.addRoundDescription')}</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>{t('samples.sampleType')}</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={sampleType}
                onChange={(e) => setSampleType(e.target.value)}
              >
                {SAMPLE_TYPES.map((st) => (
                  <option key={st} value={st}>
                    {t(`samples.type.${st}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t('samples.expectedRound')}</Label>
              <Input value={String(nextRound)} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">{t('samples.expectedRoundHint')}</p>
            </div>
            <div className="space-y-2">
              <Label>{t('samples.dispatchDate')}</Label>
              <Input
                type="date"
                value={dispatchDate}
                onChange={(e) => setDispatchDate(e.target.value)}
              />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={create.isPending}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.save')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
