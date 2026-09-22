import { describe, it, expect } from 'vitest'
import { decide, sameKey } from '@/lib/access'

const url = (path: string) => new URL(`http://127.0.0.1:47813${path}`)
const KEY = 'k3y-for-this-launch'

describe('who may talk to the server', () => {
  it('lets everything through when run without a key, as from a terminal', () => {
    expect(decide(url('/api/tree'), undefined, undefined)).toEqual({ kind: 'open' })
  })

  it('refuses API requests without the key cookie', () => {
    expect(decide(url('/api/tree'), undefined, KEY).kind).toBe('deny')
    expect(decide(url('/api/note?path=a.md'), 'wrong', KEY).kind).toBe('deny')
  })

  it('allows API requests carrying the key cookie', () => {
    expect(decide(url('/api/tree'), KEY, KEY).kind).toBe('allow')
  })

  it('trades the key in the first URL for a cookie, then drops it from the address', () => {
    const decision = decide(url('/?seyes-key=' + KEY), undefined, KEY)
    expect(decision).toEqual({ kind: 'admit', redirectTo: '/' })
  })

  it('refuses a wrong key in the URL', () => {
    expect(decide(url('/?seyes-key=nope'), undefined, KEY).kind).toBe('deny')
  })

  it('serves the page shell itself, which holds nothing private', () => {
    expect(decide(url('/'), undefined, KEY).kind).toBe('allow')
  })

  it('compares keys safely, including different lengths', () => {
    expect(sameKey('abc', 'abc')).toBe(true)
    expect(sameKey('abc', 'abcd')).toBe(false)
    expect(sameKey(undefined, 'abc')).toBe(false)
  })
})
