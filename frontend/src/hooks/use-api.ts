import { useState, useCallback } from "react"

interface UseApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

interface UseApiReturn<T> extends UseApiState<T> {
  execute: (...args: unknown[]) => Promise<T | undefined>
  reset: () => void
  setData: (data: T | null) => void
}

export function useApi<T>(
  apiFunction: (...args: unknown[]) => Promise<T>
): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  })

  const execute = useCallback(
    async (...args: unknown[]): Promise<T | undefined> => {
      setState(prev => ({ ...prev, loading: true, error: null }))
      try {
        const data = await apiFunction(...args)
        setState({ data, loading: false, error: null })
        return data
      } catch (error) {
        const message = error instanceof Error ? error.message : "An error occurred"
        setState(prev => ({ ...prev, loading: false, error: message }))
        return undefined
      }
    },
    [apiFunction]
  )

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null })
  }, [])

  const setData = useCallback((data: T | null) => {
    setState(prev => ({ ...prev, data }))
  }, [])

  return { ...state, execute, reset, setData }
}
