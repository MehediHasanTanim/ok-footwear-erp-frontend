import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { changeLanguage, LOCALE_LABELS, SUPPORTED_LOCALES } from '@/lib/i18n'
import { useUIStore, type Locale } from '@/stores/uiStore'

export function LanguageSwitcher() {
  const { t } = useTranslation()
  const locale = useUIStore((s) => s.locale)

  const handleChange = (value: string) => {
    void changeLanguage(value as Locale)
  }

  return (
    <Select value={locale} onValueChange={handleChange}>
      <SelectTrigger className="w-[130px]">
        <SelectValue placeholder={t('common.language')} />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LOCALES.map((lng) => (
          <SelectItem key={lng} value={lng}>
            {LOCALE_LABELS[lng]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
