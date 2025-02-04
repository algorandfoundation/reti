import { Link } from '@tanstack/react-router'
import { Ban, Signpost } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Validator } from '@/interfaces/validator'
import { isMigrationSet, isSunsetted } from '@/utils/contracts'
import { dayjs } from '@/utils/dayjs'

interface SunsetNoticeProps {
  validator: Validator
}

export function SunsetNotice({ validator }: SunsetNoticeProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <div className="w-full md:flex-1">
        <Alert className="bg-background/50 pb-4">
          <Ban className="h-5 w-5 -mt-[3px] text-muted-foreground" />
          <AlertTitle className="leading-normal">Sunset Notice</AlertTitle>
          <AlertDescription className="max-w-[60ch]">
            Adding stake {isSunsetted(validator) ? 'was disabled as of' : 'will be disabled on'}{' '}
            {dayjs.unix(Number(validator.config.sunsettingOn)).format('ll')}. Stakers may still
            withdraw stake and rewards.
          </AlertDescription>
        </Alert>
      </div>

      {isMigrationSet(validator) && (
        <div className="w-full md:flex-1">
          <Alert className="bg-background/50 pb-4">
            <Signpost className="h-5 w-5 -mt-[3px] text-muted-foreground" />
            <AlertTitle className="leading-normal">Migration Notice</AlertTitle>
            <AlertDescription className="max-w-[60ch]">
              The validator owner has indicated stakers should migrate to{' '}
              <Link
                to="/validators/$validatorId"
                params={{ validatorId: String(validator.config.sunsettingTo) }}
                className="whitespace-nowrap font-semibold link"
              >
                Validator {Number(validator.config.sunsettingTo)}
              </Link>
              .
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  )
}
