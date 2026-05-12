import { useContext } from "react"
import { BatchTestContext } from "@/context/BatchTestContext"

export function useBatchTest() {
  const context = useContext(BatchTestContext)
  if (!context) {
    throw new Error("useBatchTest must be used within a BatchTestProvider")
  }
  return context
}
