import { useState, useCallback } from "react"

export function useLocalConfig<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const [config, setConfigState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : defaultValue
    } catch {
      return defaultValue
    }
  })

  const setConfig = useCallback(
    (value: T) => {
      setConfigState(value)
      localStorage.setItem(key, JSON.stringify(value))
    },
    [key]
  )

  return [config, setConfig]
}
