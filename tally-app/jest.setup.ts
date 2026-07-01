import '@testing-library/jest-dom';
import { configureAxe, toHaveNoViolations } from 'jest-axe';

// Extend Jest expect with jest-axe matchers
expect.extend(toHaveNoViolations);

// Configure axe with default settings
// Individual tests can override by calling configureAxe() directly
export { configureAxe };
