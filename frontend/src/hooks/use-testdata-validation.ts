import { useCallback, useEffect, useRef, useState } from "react"
import { api } from "@/services/api"
import type { TestDataValidationRun, ValidationSiteKey } from "@/types"

export function useTestDataValidation() {
  const [run, setRun] = useState<TestDataValidationRun | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<number | null>(null)

  const stopPolling = useCallback(() => {
    if (timer.current !== null) {
      window.clearInterval(timer.current)
      timer.current = null
    }
  }, [])

  const start = useCallback(
    async (files: File[], sites: ValidationSiteKey[]) => {
      setError(null)
      setBusy(true)
      try {
        const initial = await api.startTestDataValidation(files, sites)
        setRun(initial)
        stopPolling()
        timer.current = window.setInterval(async () => {
          try {
            const next = await api.getTestDataValidation(initial.runId)
            setRun(next)
            if (next.status !== "running") {
              stopPolling()
              setBusy(false)
            }
          } catch (e) {
            stopPolling()
            setBusy(false)
            setError(e instanceof Error ? e.message : "Polling failed")
          }
        }, 1500)
      } catch (e) {
        setBusy(false)
        setError(e instanceof Error ? e.message : "Validation failed to start")
      }
    },
    [stopPolling],
  )

  useEffect(() => stopPolling, [stopPolling])

  return { run, busy, error, start }
}
