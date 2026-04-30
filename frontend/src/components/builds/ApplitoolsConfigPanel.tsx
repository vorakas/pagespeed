import { Card, CardContent } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { Download, ExternalLink } from "lucide-react"

/**
 * Setup instructions for the Applitools desktop helper.
 *
 * Pharos no longer calls the Applitools API directly — Railway's egress
 * is blocked at the corporate firewall, so a small standalone helper
 * runs on each QA machine (where the API *is* reachable). The helper
 * fetches the batch and POSTs the rows back to Pharos, where the
 * Visual cards pick them up automatically when generating the +Sheet
 * export.
 *
 * This panel exists purely to point QA at the installer and explain
 * the one-time setup. It holds no credentials and makes no network
 * calls — every Applitools secret stays on the QA machine, in the
 * helper's local config file.
 */
export function ApplitoolsConfigPanel() {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4 text-sm">
          <h3 className="text-sm font-semibold text-foreground">
            Applitools Helper (one-time setup)
          </h3>
          <p className="text-muted-foreground">
            Pharos can't reach the Applitools API from Railway, so each QA
            runs a tiny helper on their own laptop. The helper fetches a
            batch when you tell it to, then uploads the Unresolved/Failed
            rows here so they show up in the regression spreadsheet.
          </p>

          <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
            <li>
              <strong className="text-foreground">Download</strong> the helper
              (Windows, single .exe — no Python needed) and save it somewhere
              memorable, e.g. <code className="text-foreground">C:\Tools\</code>.
            </li>
            <li>
              <strong className="text-foreground">First run</strong>: double-click
              it. You'll be prompted once for your Applitools API key and the
              Pharos upload token (ask Adam). Both are saved next to the .exe
              and you'll never see the prompt again.
            </li>
            <li>
              <strong className="text-foreground">Each release</strong>: run
              <code className="ml-1 text-foreground">applitools-fetch.exe BATCH_ID</code>
              {" "}— or double-click and paste the batch id. It uploads in
              under a second.
            </li>
            <li>
              <strong className="text-foreground">Back in Pharos</strong>: type
              the same batch id into the Visual card and click{" "}
              <strong className="text-foreground">+ Sheet</strong>. The Unresolved
              rows are folded in automatically.
            </li>
          </ol>

          <div className="flex flex-wrap gap-2 pt-1">
            <a
              href="/downloads/applitools-fetch.exe"
              download
              rel="noopener noreferrer"
              className={buttonVariants({ size: "sm" })}
            >
              <Download className="h-4 w-4" /> Download helper (.exe)
            </a>
            <a
              href="/downloads/applitools-helper-readme.txt"
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              <ExternalLink className="h-4 w-4" /> Setup notes
            </a>
          </div>

          <p className="text-xs text-muted-foreground">
            If the helper isn't run for a given batch, Pharos still exports
            the Functional and Skipped sections — only the Unresolved rows
            for that platform are blank.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
