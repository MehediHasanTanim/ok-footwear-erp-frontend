/* eslint-disable react-refresh/only-export-components -- shared form defaults used by list/detail pages */
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { createVendorSchema, type CreateVendorFormData } from '@/lib/schemas'
import { cn } from '@/lib/utils'
import {
  VENDOR_STATUS_META,
  VENDOR_STATUSES,
  VENDOR_TYPES,
  type VendorCategoryDto,
  type VendorDto,
} from '@/types/procurement'

export const emptyVendorForm: CreateVendorFormData = {
  vendorCode: '',
  name: '',
  type: 'raw_material',
  categoryId: '',
  contactName: '',
  email: '',
  phone: '',
  address: '',
  tradeLicense: '',
  tinNumber: '',
  bankName: '',
  bankAccount: '',
  paymentTerms: 30,
  creditLimit: 0,
  status: 'under_review',
  notes: '',
}

export function vendorToFormValues(vendor: VendorDto): CreateVendorFormData {
  return {
    vendorCode: vendor.vendorCode,
    name: vendor.name,
    type: vendor.type,
    categoryId: vendor.categoryId ?? '',
    contactName: vendor.contactName ?? '',
    email: vendor.email ?? '',
    phone: vendor.phone ?? '',
    address: vendor.address ?? '',
    tradeLicense: vendor.tradeLicense ?? '',
    tinNumber: vendor.tinNumber ?? '',
    bankName: vendor.bankName ?? '',
    bankAccount: vendor.bankAccount ?? '',
    paymentTerms: vendor.paymentTerms ?? 30,
    creditLimit: vendor.creditLimit ?? 0,
    status: vendor.status,
    notes: vendor.notes ?? '',
  }
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  categories: VendorCategoryDto[]
  /** Remount key so create vs edit / different vendors reset cleanly */
  formKey?: string
  initialValues?: CreateVendorFormData
  saving?: boolean
  onSubmit: (values: CreateVendorFormData) => void
}

const textareaClass =
  'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

export function VendorFormSheet({
  open,
  onOpenChange,
  title,
  categories,
  formKey = 'new',
  initialValues = emptyVendorForm,
  saving = false,
  onSubmit,
}: Props) {
  const { t } = useTranslation()
  const form = useForm<CreateVendorFormData>({
    resolver: zodResolver(createVendorSchema),
    defaultValues: initialValues,
  })

  useEffect(() => {
    if (open) form.reset(initialValues)
    // Reset only when sheet opens or switches create/edit identity — not on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [open, formKey])

  const err = (name: keyof CreateVendorFormData) => form.formState.errors[name]?.message

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <form
          className="mt-4 space-y-3"
          onSubmit={form.handleSubmit((values) =>
            onSubmit({
              ...values,
              notes: values.notes?.trim() ? values.notes.trim() : undefined,
            })
          )}
          data-testid="vendor-form"
        >
          <Field label={t('procurement.vendors.code')} error={err('vendorCode')}>
            <Input {...form.register('vendorCode')} data-testid="vendor-code" />
          </Field>
          <Field label={t('procurement.vendors.name')} error={err('name')}>
            <Input {...form.register('name')} data-testid="vendor-name" />
          </Field>
          <Field label={t('procurement.vendors.type')} error={err('type')}>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              {...form.register('type')}
              data-testid="vendor-type"
            >
              {VENDOR_TYPES.map((vt) => (
                <option key={vt} value={vt}>
                  {t(`procurement.vendorType.${vt}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('procurement.vendors.category')} error={err('categoryId')}>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              {...form.register('categoryId')}
              data-testid="vendor-category-select"
            >
              <option value="">{t('procurement.vendors.selectCategory')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('procurement.vendors.status')} error={err('status')}>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              {...form.register('status')}
              data-testid="vendor-status"
            >
              {VENDOR_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(VENDOR_STATUS_META[s].labelKey)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('procurement.vendors.contact')} error={err('contactName')}>
            <Input {...form.register('contactName')} />
          </Field>
          <Field label={t('procurement.vendors.email')} error={err('email')}>
            <Input type="email" {...form.register('email')} />
          </Field>
          <Field label={t('procurement.vendors.phone')} error={err('phone')}>
            <Input {...form.register('phone')} />
          </Field>
          <Field label={t('procurement.vendors.address')} error={err('address')}>
            <textarea className={cn(textareaClass)} rows={2} {...form.register('address')} />
          </Field>
          <Field label={t('procurement.vendors.tradeLicense')} error={err('tradeLicense')}>
            <Input {...form.register('tradeLicense')} />
          </Field>
          <Field label={t('procurement.vendors.tin')} error={err('tinNumber')}>
            <Input {...form.register('tinNumber')} />
          </Field>
          <Field label={t('procurement.vendors.bankName')} error={err('bankName')}>
            <Input {...form.register('bankName')} />
          </Field>
          <Field label={t('procurement.vendors.bankAccount')} error={err('bankAccount')}>
            <Input {...form.register('bankAccount')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('procurement.vendors.paymentTerms')} error={err('paymentTerms')}>
              <Input
                type="number"
                min={0}
                step={1}
                {...form.register('paymentTerms', { valueAsNumber: true })}
              />
            </Field>
            <Field label={t('procurement.vendors.creditLimit')} error={err('creditLimit')}>
              <Input
                type="number"
                min={0}
                step="any"
                {...form.register('creditLimit', { valueAsNumber: true })}
              />
            </Field>
          </div>
          <Field label={t('procurement.vendors.notes')} error={err('notes')} required={false}>
            <textarea
              className={cn(textareaClass)}
              rows={3}
              {...form.register('notes')}
              data-testid="vendor-notes"
            />
          </Field>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={saving} data-testid="vendor-save-btn">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.save')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function Field({
  label,
  error,
  children,
  required = true,
}: {
  label: string
  error?: string
  children: ReactNode
  required?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
