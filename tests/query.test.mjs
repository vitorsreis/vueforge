import assert from 'node:assert/strict'
import test from 'node:test'

import { queryBoolean, queryValue } from '../dist/render/query.js'

test('parses query booleans using explicit true values', () => {
  for (const value of ['', 'on', '1', 'true', 'yes', 'ON', 'YeS']) {
    assert.equal(
      queryBoolean(
        `/render?pretty${value === '' ? '' : `=${value}`}`,
        'pretty',
      ),
      true,
    )
  }
})

test('treats false and unknown query values as disabled', () => {
  for (const value of [undefined, '', 'off', '0', 'false', 'unknown']) {
    const url = value === undefined ? '/render' : `/render?hydrate=${value}`
    assert.equal(queryBoolean(url, 'hydrate'), false)
  }
})

test('reads repeated query values deterministically', () => {
  assert.equal(
    queryValue('/render?template=home&template=invoice', 'template'),
    'home',
  )
})
