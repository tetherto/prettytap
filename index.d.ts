declare module 'prettytap' {
  export interface Test {
    testNumber: number
    passed: boolean
    failed: boolean
    skipped: boolean
    todo: boolean
    description: string
    directiveText: string
    diagnostics: string[]
    yamlBytes: string
  }

  export interface Results {
    expectedTests: number
    totalTests: number
    passedTests: number
    failedTests: number
    skippedTests: number
    todoTests: number
    tapVersion: number
    bailOut: boolean
    bailOutReason: string
    foundTapData: boolean
    tests: Test[]
    lines: string[]
    explanation: string[]
    isPassing(): boolean
    toString(): string
  }

  export type ParseEvent =
    | { type: 'test'; test: Test }
    | { type: 'yaml'; test: Test }
    | { type: 'comment'; text: string }
    | { type: 'bail'; reason: string }

  export class Parser {
    results: Results
    constructor()
    write(chunk: string): ParseEvent[]
    end(): ParseEvent[]
  }

  export function parse(input: string | string[]): Results
  export function isPassing(r: Results): boolean
  export function resultsToString(r: Results): string

  export interface TestResult {
    suite?: string
    group?: string
    test_number: number
    passed: boolean
    directive?: string
    description: string
    info?: string
  }

  export interface ResultSummary {
    total: number
    passed: number
    failed: number
    skipped: number
    todo: number
    expected: number
    bailout?: boolean
    bailout_reason?: string
    failures?: TestResult[]
  }

  export interface JsonResults {
    version: number
    summary: ResultSummary
    results: TestResult[]
  }

  export interface Formatter {
    format(results: Results): void
    summary(): void
    formatToString?(results: Results): string
    summaryToString?(): string
  }

  export class SpecFormatter implements Formatter {
    results: Results | null
    failedTests: Test[]
    formatToString(results: Results): string
    summaryToString(): string
    streamStart(results: Results): void
    streamComment(text: string): void
    streamTest(test: Test): void
    streamYaml(test: Test): void
    streamBail(reason: string): void
    format(results: Results): void
    summary(): void
  }

  export function formatSpec(results: Results): SpecFormatter

  export class JsonFormatter implements Formatter {
    results: Results | null
    toJson(results: Results): JsonResults
    formatToString(results: Results): string
    format(results: Results): void
    summary(): void
  }

  export function formatJson(results: Results): JsonResults

  export type Style = (str: string | number) => string

  export function setColorEnabled(enabled: boolean): void
  export function isColorEnabled(): boolean
  export function stripAnsi(str: string): string

  export const bold: Style
  export const faint: Style
  export const dim: Style
  export const italic: Style
  export const underline: Style
  export const red: Style
  export const green: Style
  export const yellow: Style
  export const blue: Style
  export const magenta: Style
  export const cyan: Style
  export const brightRed: Style
  export const brightMagenta: Style
}
