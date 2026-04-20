/**
 * Vitest setup — runs once per test file.
 *
 * - Registers @testing-library/jest-dom custom matchers (toBeInTheDocument, etc.)
 * - Cleans up React components after each test (handled automatically by
 *   Testing Library v16 + Vitest globals, no explicit call needed).
 */
import "@testing-library/jest-dom/vitest";
