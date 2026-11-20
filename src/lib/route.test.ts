import { describe, expect, it } from "vitest"
import { pubkeyOf } from "./route"

const KEY = "3a65231e59031a3a0c6f363030712730b11562a3c77556184c05d58adeb6b466"

describe("pubkeyOf", () => {
  it("reads a key out of the hash", () => {
    expect(pubkeyOf(`#${KEY}`)).toBe(KEY)
    expect(pubkeyOf(KEY)).toBe(KEY)
    expect(pubkeyOf("#")).toBe(null)
  })
})
