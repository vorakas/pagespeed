import { Component, type ErrorInfo, type ReactNode } from "react"
import { Button } from "@/components/ui/button"

interface RouteErrorBoundaryProps {
  children: ReactNode
}

interface RouteErrorBoundaryState {
  error: Error | null
}

export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Route failed to render", error, errorInfo)
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground">Page needs a refresh</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Pharos could not load the latest page bundle. Refresh the app to continue.
          </p>
        </div>
        <Button onClick={() => window.location.reload()}>Refresh Pharos</Button>
      </div>
    )
  }
}
