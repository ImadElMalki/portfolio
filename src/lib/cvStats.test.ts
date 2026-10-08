import { describe, expect, it } from "vitest"
import { experienceMonths, experienceYears } from "./cvStats"

const NOW = new Date("2026-10-06T12:00:00Z")

const job = (startDate: string, endDate: string | null = null) => ({
  startDate,
  endDate,
})

describe("experienceMonths", () => {
  it("sums each span and leaves out the gap between jobs", () => {
    const work = [job("2022-05-02", "2022-09-21"), job("2023-07-04", null)]

    expect(experienceMonths(work, NOW)).toBe(4 + 39)
  })

  it("closes the current job at the given date", () => {
    expect(experienceMonths([job("2026-01-15")], NOW)).toBe(9)
  })

  it("counts an inverted span as zero", () => {
    expect(experienceMonths([job("2024-05-01", "2024-01-01")], NOW)).toBe(0)
  })
})

describe("experienceYears", () => {
  it("rounds down to whole years", () => {
    const work = [job("2022-05-02", "2022-09-21"), job("2023-07-04", null)]

    expect(experienceYears(work, NOW)).toBe(3)
  })
})
