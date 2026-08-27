import { describe, expect, it } from "vitest"
import { pubkeyOf } from "./route"

const KEY = "3a65231e59031a3a0c6f363030712730b11562a3c77556184c05d58adeb6b466"

describe("pubkeyOf", () => {
  it("reads a key out of the hash", () => {
    expect(pubkeyOf(`#${KEY}`)).toBe(KEY)
    expect(pubkeyOf(KEY)).toBe(KEY)
  })

  it("does not care about case", () => {
    expect(pubkeyOf(`#${KEY.toUpperCase()}`)).toBe(KEY)
  })

  it("ignores anything that is not a key", () => {
    expect(pubkeyOf("")).toBe(null)
    expect(pubkeyOf("#")).toBe(null)
    expect(pubkeyOf("#not-a-key")).toBe(null)
    expect(pubkeyOf(`#${KEY.slice(0, 63)}`)).toBe(null)
    expect(pubkeyOf(`#${KEY}z`)).toBe(null)
    expect(pubkeyOf(`#${KEY}/`)).toBe(null)
  })
})
