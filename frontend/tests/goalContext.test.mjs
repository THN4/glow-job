import assert from 'node:assert/strict'
import test from 'node:test'
import { formatGoalContext } from '../src/features/workspace/goalContext.ts'

test('header context uses the saved role and readiness timeframe', () => {
  for (const [readinessTimeframe, label] of [
    ['three_months', '3 months'],
    ['six_months', '6 months'],
    ['one_year', '1 year'],
    ['no_fixed_deadline', 'No fixed deadline'],
  ]) {
    assert.equal(formatGoalContext({ targetRoleTitle: ' Backend Engineer ', readinessTimeframe, targetDate: null }), `Backend Engineer · ${label}`)
  }
})

test('custom target dates are displayed without timezone conversion', () => {
  assert.equal(formatGoalContext({ targetRoleTitle: 'Designer', readinessTimeframe: 'no_fixed_deadline', targetDate: '2027-04-15' }), 'Designer · By 2027-04-15')
})

test('a fixed readiness preference keeps its label when a target date is also saved', () => {
  assert.equal(formatGoalContext({ targetRoleTitle: 'Backend Engineer', readinessTimeframe: 'one_year', targetDate: '2027-10-23' }), 'Backend Engineer · 1 year')
})

test('missing goal data never supplies a sample role or timeline', () => {
  assert.equal(formatGoalContext(null), 'Set your career goal')
  assert.equal(formatGoalContext(undefined), 'Set your career goal')
  assert.equal(formatGoalContext({ targetRoleTitle: ' ', readinessTimeframe: 'one_year', targetDate: null }), 'Set your career goal')
})
