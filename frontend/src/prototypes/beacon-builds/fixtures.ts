/**
 * Fabricated fixtures for the Beacon Builds prototype.
 *
 * Realistic mix across the 9 role keys: 1 WarmUp + 4 Functional + 4 Visual.
 * Statuses chosen to exercise every visual state on the card:
 *   - WarmUp:               PASSED
 *   - Windows Functional:   PASSED
 *   - Mac Functional:       FAILED (12 failed, 3 skipped)
 *   - iPhone Functional:    PARTIAL with rerun pass
 *   - Android Functional:   RUNNING
 *   - Windows Visual:       PASSED
 *   - Mac Visual:           PASSED
 *   - iPhone Visual:        FAILED + 5 unresolved Applitools rows
 *   - Android Visual:       QUEUED (notStarted)
 *
 * Times are anchored to "now" so the relative timestamps render naturally.
 */

import type {
  DevOpsBuild,
  FailedTest,
  SkippedTest,
  UnresolvedTest,
} from "@/types"

const NOW = Date.now()
const MIN = 60_000
const HR = 60 * MIN

const iso = (offsetMs: number): string => new Date(NOW + offsetMs).toISOString()

function build(
  partial: Partial<DevOpsBuild> & {
    id: number
    buildNumber: string
    definitionId: number
  },
): DevOpsBuild {
  return {
    status: "completed",
    result: "succeeded",
    definitionName: "",
    sourceBranch: "refs/heads/master",
    startTime: iso(-30 * MIN),
    finishTime: iso(-15 * MIN),
    requestedBy: "QA Bot",
    webUrl: "https://dev.azure.com/LampsPlus/TestAutomation/_build/results?buildId=999",
    ...partial,
  }
}

export const FIXTURE_BUILDS: Record<string, DevOpsBuild | null> = {
  WarmUp: build({
    id: 90001,
    buildNumber: "20260429.1",
    definitionId: 219,
    result: "succeeded",
    startTime: iso(-90 * MIN),
    finishTime: iso(-78 * MIN),
  }),
  Windows_Functional: build({
    id: 90002,
    buildNumber: "20260429.42",
    definitionId: 167,
    result: "succeeded",
    startTime: iso(-72 * MIN),
    finishTime: iso(-31 * MIN),
  }),
  Mac_Functional: build({
    id: 90003,
    buildNumber: "20260429.18",
    definitionId: 217,
    result: "failed",
    startTime: iso(-72 * MIN),
    finishTime: iso(-29 * MIN),
  }),
  iPhone_Functional: build({
    id: 90004,
    buildNumber: "20260429.31",
    definitionId: 169,
    result: "partiallySucceeded",
    startTime: iso(-72 * MIN),
    finishTime: iso(-26 * MIN),
  }),
  Android_Functional: build({
    id: 90005,
    buildNumber: "20260429.27",
    definitionId: 248,
    status: "inProgress",
    result: null,
    startTime: iso(-21 * MIN),
    finishTime: null,
  }),
  Windows_Visual: build({
    id: 90006,
    buildNumber: "20260429.12",
    definitionId: 170,
    result: "succeeded",
    startTime: iso(-25 * MIN),
    finishTime: iso(-3 * MIN),
  }),
  Mac_Visual: build({
    id: 90007,
    buildNumber: "20260429.9",
    definitionId: 218,
    result: "succeeded",
    startTime: iso(-25 * MIN),
    finishTime: iso(-2 * MIN),
  }),
  iPhone_Visual: build({
    id: 90008,
    buildNumber: "20260429.15",
    definitionId: 215,
    result: "failed",
    startTime: iso(-2 * HR - 20 * MIN),
    finishTime: iso(-1 * HR - 50 * MIN),
  }),
  Android_Visual: build({
    id: 90009,
    buildNumber: "20260429.6",
    definitionId: 249,
    status: "notStarted",
    result: null,
    startTime: null,
    finishTime: null,
  }),
}

/** Recent builds list per role — used by the per-card Select build dropdown. */
export const FIXTURE_RECENT_BUILDS: Record<string, DevOpsBuild[]> =
  Object.fromEntries(
    Object.entries(FIXTURE_BUILDS).map(([key, b]) => {
      if (!b) return [key, []]
      const olderId1 = b.id - 100
      const olderId2 = b.id - 200
      return [
        key,
        [
          b,
          {
            ...b,
            id: olderId1,
            buildNumber: `${b.buildNumber.split(".")[0]}.${
              parseInt(b.buildNumber.split(".")[1] ?? "0", 10) - 1
            }`,
            startTime: iso(-3 * HR),
            finishTime: iso(-2 * HR - 30 * MIN),
            result: "succeeded",
            status: "completed",
          },
          {
            ...b,
            id: olderId2,
            buildNumber: `${b.buildNumber.split(".")[0]}.${
              parseInt(b.buildNumber.split(".")[1] ?? "0", 10) - 2
            }`,
            startTime: iso(-6 * HR),
            finishTime: iso(-5 * HR - 30 * MIN),
            result: "succeeded",
            status: "completed",
          },
        ],
      ]
    }),
  )

/** iPhone Functional has a partial-success effective resolution to passed,
 *  showing the (RR) re-run badge on the card. */
export const FIXTURE_EFFECTIVE_RESULTS: Record<
  string,
  { effectiveResult: string; hasRerun: boolean }
> = {
  iPhone_Functional: { effectiveResult: "succeeded", hasRerun: true },
  Mac_Functional: { effectiveResult: "failed", hasRerun: false },
  iPhone_Visual: { effectiveResult: "failed", hasRerun: false },
}

/** Failed tests — populated for Mac_Functional (12 rows) and iPhone_Visual (4 rows). */
export const FIXTURE_FAILED_TESTS: Record<number, FailedTest[]> = {
  90003: Array.from({ length: 12 }, (_, i) => ({
    testId: `LP-${4012 + i}`,
    testName: `Cart_AddRemoveItem_${i + 1}`,
    config: "Mac · Chrome · 14.5",
    errorMessage:
      i === 2
        ? "Expected element 'cart-line-item' to be visible after 5000ms"
        : "Element not interactable: cart-checkout-button",
    stackTrace: `at LPCommerce.Tests.Cart.AddRemoveItemTest_${i + 1}() in /src/Tests/CartTests.cs:line ${42 + i * 7}\n  at TestHarness.Run()`,
    zephyrUrl: `https://lampstrack.lampsplus.com/secure/Tests.jspa#/testCase/LP-${4012 + i}`,
    isRerun: false,
    runId: 8800001,
    resultId: 1000 + i,
    screenshotId: null,
  })),
  90008: Array.from({ length: 4 }, (_, i) => ({
    testId: `LP-${5040 + i}`,
    testName: `ProductPage_VisualBaseline_${i + 1}`,
    config: "iOS · Safari · 17.4",
    errorMessage: "Visual regression: pixel diff exceeds tolerance (3.2%)",
    stackTrace: `at VisualHarness.Compare(baseline, current) in /src/Visual/Compare.cs:line ${88 + i * 4}`,
    zephyrUrl: `https://lampstrack.lampsplus.com/secure/Tests.jspa#/testCase/LP-${5040 + i}`,
    isRerun: false,
    runId: 8800042,
    resultId: 2000 + i,
    screenshotId: 99000 + i,
  })),
}

/** Skipped tests — Mac_Functional has 3, iPhone_Visual has 2. */
export const FIXTURE_SKIPPED_TESTS: Record<number, SkippedTest[]> = {
  90003: [
    {
      testId: "LP-4099",
      testName: "Checkout_GuestFlow_PromoCode",
      config: "Mac · Chrome · 14.5",
      userRole: "guest",
      errorMessage:
        "Skipped — flagged unstable in 20260415 release; backlogged under LP-4101.",
      zephyrUrl: "https://lampstrack.lampsplus.com/secure/Tests.jspa#/testCase/LP-4099",
    },
    {
      testId: "LP-4127",
      testName: "Account_PasswordReset_LegacyEmail",
      config: "Mac · Chrome · 14.5",
      userRole: "registered",
      errorMessage:
        "Skipped — depends on legacy SMTP relay decommissioned 2026-04-01.",
      zephyrUrl: "https://lampstrack.lampsplus.com/secure/Tests.jspa#/testCase/LP-4127",
    },
    {
      testId: "LP-4205",
      testName: "Search_AutosuggestPersistence",
      config: "Mac · Chrome · 14.5",
      userRole: "guest",
      errorMessage: "Skipped — pending search API v2 cutover.",
      zephyrUrl: "https://lampstrack.lampsplus.com/secure/Tests.jspa#/testCase/LP-4205",
    },
  ],
  90008: [
    {
      testId: "LP-5108",
      testName: "ProductPage_HeroCarousel_AutoRotate",
      config: "iOS · Safari · 17.4",
      userRole: "guest",
      errorMessage: "Skipped — flagged unstable on iOS 17.4; awaiting fix.",
      zephyrUrl: "https://lampstrack.lampsplus.com/secure/Tests.jspa#/testCase/LP-5108",
    },
    {
      testId: "LP-5191",
      testName: "Filter_PriceRange_RangeSlider",
      config: "iOS · Safari · 17.4",
      userRole: "guest",
      errorMessage: "Skipped — depends on canvas API not yet supported.",
      zephyrUrl: "https://lampstrack.lampsplus.com/secure/Tests.jspa#/testCase/LP-5191",
    },
  ],
}

/** Applitools unresolved rows for iPhone_Visual. */
export const FIXTURE_UNRESOLVED_TESTS: Record<string, UnresolvedTest[]> = {
  iPhone_Visual: [
    {
      testId: "LP-5040",
      testName: "ProductPage_VisualBaseline_1",
      status: "Unresolved",
      zephyrUrl: "https://lampstrack.lampsplus.com/secure/Tests.jspa#/testCase/LP-5040",
    },
    {
      testId: "LP-5052",
      testName: "Cart_VisualBaseline_LineItem",
      status: "Unresolved",
      zephyrUrl: "https://lampstrack.lampsplus.com/secure/Tests.jspa#/testCase/LP-5052",
    },
    {
      testId: "LP-5077",
      testName: "Checkout_VisualBaseline_Address",
      status: "Failed",
      zephyrUrl: "https://lampstrack.lampsplus.com/secure/Tests.jspa#/testCase/LP-5077",
    },
    {
      testId: "LP-5089",
      testName: "Account_VisualBaseline_Orders",
      status: "Unresolved",
      zephyrUrl: "https://lampstrack.lampsplus.com/secure/Tests.jspa#/testCase/LP-5089",
    },
    {
      testId: "LP-5103",
      testName: "Search_VisualBaseline_Results",
      status: "Failed",
      zephyrUrl: "https://lampstrack.lampsplus.com/secure/Tests.jspa#/testCase/LP-5103",
    },
  ],
}

export const FIXTURE_BRANCHES = [
  "master",
  "develop",
  "release/2026.04",
  "release/2026.05",
  "feature/checkout-redesign",
  "feature/visual-baseline-refresh",
  "hotfix/cart-edge-case",
]

export const FIXTURE_DEVOPS_CONFIG = {
  pat: "(server-managed)",
  organization: "LampsPlus",
  project: "TestAutomation",
  orchestratorPipelineId: 261,
  pipelineMap: {
    WarmUp: 219,
    Windows_Functional: 167,
    Mac_Functional: 217,
    iPhone_Functional: 169,
    Android_Functional: 248,
    Windows_Visual: 170,
    Mac_Visual: 218,
    iPhone_Visual: 215,
    Android_Visual: 249,
  },
}
