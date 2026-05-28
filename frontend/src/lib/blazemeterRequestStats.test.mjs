import assert from "node:assert/strict"
import { buildRequestStatGroups, requestStatGroupName } from "./blazemeterRequestStats.js"

assert.equal(requestStatGroupName("SFP: 1905N"), "SFP")
assert.equal(requestStatGroupName("MORE LIKE THIS: 61Y90"), "More Like This")
assert.equal(requestStatGroupName("01 - PDP: 12345"), "PDP")

const groups = buildRequestStatGroups([
  {
    labelId: 0,
    labelName: "SFP",
    samples: 7,
    errors: 0,
    errorRate: 0,
    avgResponseTime: 90,
    minResponseTime: 30,
    maxResponseTime: 110,
    p50: 80,
    p90: 100,
    p95: 105,
    p99: 109,
    avgLatency: null,
    avgThroughput: 4,
    avgBytes: null,
  },
  {
    labelId: 1,
    labelName: "SFP: 1905N",
    samples: 10,
    errors: 1,
    errorRate: 10,
    avgResponseTime: 100,
    minResponseTime: 50,
    maxResponseTime: 200,
    p50: null,
    p90: null,
    p95: null,
    p99: null,
    avgLatency: null,
    avgThroughput: 2,
    avgBytes: null,
  },
  {
    labelId: 2,
    labelName: "SFP: 2201A",
    samples: 30,
    errors: 3,
    errorRate: 10,
    avgResponseTime: 200,
    minResponseTime: 40,
    maxResponseTime: 500,
    p50: null,
    p90: null,
    p95: null,
    p99: null,
    avgLatency: null,
    avgThroughput: 3,
    avgBytes: null,
  },
  {
    labelId: 3,
    labelName: "MORE LIKE THIS: 61Y90",
    samples: 5,
    errors: 0,
    errorRate: 0,
    avgResponseTime: 300,
    minResponseTime: 100,
    maxResponseTime: 600,
    p50: null,
    p90: null,
    p95: null,
    p99: null,
    avgLatency: null,
    avgThroughput: 1,
    avgBytes: null,
  },
])

assert.equal(groups.length, 2)
assert.equal(groups[0].groupName, "SFP")
assert.equal(groups[0].samples, 7)
assert.equal(groups[0].errors, 0)
assert.equal(groups[0].avgResponseTime, 90)
assert.equal(groups[0].minResponseTime, 30)
assert.equal(groups[0].maxResponseTime, 110)
assert.equal(groups[0].p90, 100)
assert.equal(groups[0].avgThroughput, 4)
assert.deepEqual(groups[0].sourceLabels, ["SFP"])
assert.equal(groups[1].groupName, "More Like This")

const rolled = buildRequestStatGroups(groups[0].sourceLabels.length ? [
  {
    labelId: 1,
    labelName: "SFP: 1905N",
    samples: 10,
    errors: 1,
    errorRate: 10,
    avgResponseTime: 100,
    minResponseTime: 50,
    maxResponseTime: 200,
    p50: null,
    p90: null,
    p95: null,
    p99: null,
    avgLatency: null,
    avgThroughput: 2,
    avgBytes: null,
  },
  {
    labelId: 2,
    labelName: "SFP: 2201A",
    samples: 30,
    errors: 3,
    errorRate: 10,
    avgResponseTime: 200,
    minResponseTime: 40,
    maxResponseTime: 500,
    p50: null,
    p90: null,
    p95: null,
    p99: null,
    avgLatency: null,
    avgThroughput: 3,
    avgBytes: null,
  },
] : [])

assert.equal(rolled[0].samples, 40)
assert.equal(rolled[0].errors, 4)
assert.equal(rolled[0].avgResponseTime, 175)
