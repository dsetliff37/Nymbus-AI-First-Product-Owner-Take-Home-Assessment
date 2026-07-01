/**
 * Unit tests for intentService.ts
 *
 * The LLM API (fetch) is mocked so no real network calls are made.
 * Tests cover: timeout, non-2xx errors, missing fields, unsupported
 * intent_type, null (unresolvable) fields, and the happy path.
 */

import { interpretQuery } from './intentService';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Builds a minimal valid OpenAI-style chat completions response. */
function makeLlmResponse(content: string, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({
      choices: [{ message: { content } }],
    }),
  } as unknown as Response;
}

const VALID_INTENT_JSON = JSON.stringify({
  intent_type: 'sum',
  categories: ['Groceries'],
  timeframe: { start: '2024-01-01', end: '2024-01-31' },
});

const CATEGORIES = ['Groceries', 'Dining Out', 'Transport'];

// ── Fetch mock setup ───────────────────────────────────────────────────────────

let fetchMock: jest.Mock;

beforeEach(() => {
  fetchMock = jest.fn();
  global.fetch = fetchMock;
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('interpretQuery — happy path', () => {
  it('returns ok:true with a valid ParsedIntent on a successful LLM response', async () => {
    fetchMock.mockResolvedValueOnce(makeLlmResponse(VALID_INTENT_JSON));

    const result = await interpretQuery('How much on groceries last month?', CATEGORIES);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.intent.intent_type).toBe('sum');
      expect(result.intent.categories).toEqual(['Groceries']);
      expect(result.intent.timeframe.start).toBe('2024-01-01');
      expect(result.intent.timeframe.end).toBe('2024-01-31');
    }
  });

  it('supports all four intent types', async () => {
    for (const intentType of ['sum', 'compare', 'average', 'count'] as const) {
      const content = JSON.stringify({
        intent_type: intentType,
        categories: ['Groceries'],
        timeframe: { start: '2024-01-01', end: '2024-01-31' },
      });
      fetchMock.mockResolvedValueOnce(makeLlmResponse(content));

      const result = await interpretQuery('test query', CATEGORIES);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.intent.intent_type).toBe(intentType);
      }
    }
  });
});

describe('interpretQuery — API timeout (Req 4.7)', () => {
  it('returns api_timeout when the fetch is aborted', async () => {
    fetchMock.mockImplementationOnce(
      (_url: string, options: { signal?: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) => {
          // Abort immediately when the signal fires
          options.signal?.addEventListener('abort', () => {
            const err = new DOMException('The operation was aborted.', 'AbortError');
            reject(err);
          });
        })
    );

    // Override timeout to 0 ms so the abort fires immediately in the test
    jest.useFakeTimers();
    const promise = interpretQuery('test', CATEGORIES);
    jest.runAllTimers();
    jest.useRealTimers();

    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('api_timeout');
    }
  });
});

describe('interpretQuery — API failure (Req 4.7)', () => {
  it('returns api_failure with statusCode on a non-2xx response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({}),
    } as unknown as Response);

    const result = await interpretQuery('test', CATEGORIES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('api_failure');
      if (result.error.type === 'api_failure') {
        expect(result.error.statusCode).toBe(503);
      }
    }
  });

  it('returns api_failure on a network-level error', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const result = await interpretQuery('test', CATEGORIES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('api_failure');
    }
  });
});

describe('interpretQuery — missing fields (Req 4.8)', () => {
  it('returns missing_fields when intent_type is absent', async () => {
    const content = JSON.stringify({
      categories: ['Groceries'],
      timeframe: { start: '2024-01-01', end: '2024-01-31' },
    });
    fetchMock.mockResolvedValueOnce(makeLlmResponse(content));

    const result = await interpretQuery('test', CATEGORIES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('missing_fields');
      if (result.error.type === 'missing_fields') {
        expect(result.error.missingFields).toContain('intent_type');
      }
    }
  });

  it('returns missing_fields when categories is absent', async () => {
    const content = JSON.stringify({
      intent_type: 'sum',
      timeframe: { start: '2024-01-01', end: '2024-01-31' },
    });
    fetchMock.mockResolvedValueOnce(makeLlmResponse(content));

    const result = await interpretQuery('test', CATEGORIES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('missing_fields');
    }
  });

  it('returns missing_fields when timeframe is absent', async () => {
    const content = JSON.stringify({
      intent_type: 'sum',
      categories: ['Groceries'],
    });
    fetchMock.mockResolvedValueOnce(makeLlmResponse(content));

    const result = await interpretQuery('test', CATEGORIES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('missing_fields');
    }
  });

  it('returns missing_fields when the LLM returns empty content', async () => {
    fetchMock.mockResolvedValueOnce(makeLlmResponse(''));

    const result = await interpretQuery('test', CATEGORIES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('missing_fields');
    }
  });

  it('returns missing_fields when the LLM returns non-JSON content', async () => {
    fetchMock.mockResolvedValueOnce(makeLlmResponse('Sorry, I cannot answer that.'));

    const result = await interpretQuery('test', CATEGORIES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('missing_fields');
    }
  });
});

describe('interpretQuery — unsupported intent_type (Req 4.6)', () => {
  it('returns unsupported_intent_type for an unknown intent_type string', async () => {
    const content = JSON.stringify({
      intent_type: 'forecast',
      categories: ['Groceries'],
      timeframe: { start: '2024-01-01', end: '2024-01-31' },
    });
    fetchMock.mockResolvedValueOnce(makeLlmResponse(content));

    const result = await interpretQuery('test', CATEGORIES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('unsupported_intent_type');
      if (result.error.type === 'unsupported_intent_type') {
        expect(result.error.received).toBe('forecast');
      }
    }
  });
});

describe('interpretQuery — unresolvable fields (Req 4.8)', () => {
  it('returns unresolvable_fields when intent_type is null', async () => {
    const content = JSON.stringify({
      intent_type: null,
      categories: ['Groceries'],
      timeframe: { start: '2024-01-01', end: '2024-01-31' },
    });
    fetchMock.mockResolvedValueOnce(makeLlmResponse(content));

    const result = await interpretQuery('test', CATEGORIES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('unresolvable_fields');
      if (result.error.type === 'unresolvable_fields') {
        expect(result.error.fields).toContain('intent_type');
      }
    }
  });

  it('returns unresolvable_fields when categories is null', async () => {
    const content = JSON.stringify({
      intent_type: 'sum',
      categories: null,
      timeframe: { start: '2024-01-01', end: '2024-01-31' },
    });
    fetchMock.mockResolvedValueOnce(makeLlmResponse(content));

    const result = await interpretQuery('test', CATEGORIES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('unresolvable_fields');
      if (result.error.type === 'unresolvable_fields') {
        expect(result.error.fields).toContain('categories');
      }
    }
  });

  it('returns unresolvable_fields when timeframe is null', async () => {
    const content = JSON.stringify({
      intent_type: 'sum',
      categories: ['Groceries'],
      timeframe: null,
    });
    fetchMock.mockResolvedValueOnce(makeLlmResponse(content));

    const result = await interpretQuery('test', CATEGORIES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('unresolvable_fields');
      if (result.error.type === 'unresolvable_fields') {
        expect(result.error.fields).toContain('timeframe');
      }
    }
  });

  it('reports all null fields together', async () => {
    const content = JSON.stringify({
      intent_type: null,
      categories: null,
      timeframe: null,
    });
    fetchMock.mockResolvedValueOnce(makeLlmResponse(content));

    const result = await interpretQuery('test', CATEGORIES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('unresolvable_fields');
      if (result.error.type === 'unresolvable_fields') {
        expect(result.error.fields).toEqual(
          expect.arrayContaining(['intent_type', 'categories', 'timeframe'])
        );
      }
    }
  });
});

describe('interpretQuery — privacy invariant (Req 4.2, 9.1)', () => {
  it('sends only query text and category names — no amounts, descriptions, or dates', async () => {
    fetchMock.mockResolvedValueOnce(makeLlmResponse(VALID_INTENT_JSON));

    await interpretQuery('How much on groceries?', ['Groceries', 'Transport']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [_url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as {
      messages: Array<{ role: string; content: string }>;
    };

    // The combined body must contain no amounts, descriptions, or raw dates from transactions.
    // Only the query text and category names should appear.
    const allContent = body.messages.map((m) => m.content).join('\n');

    // Verify the category names are present
    expect(allContent).toContain('Groceries');
    expect(allContent).toContain('Transport');

    // Verify the user query text is present
    expect(allContent).toContain('How much on groceries?');

    // The payload must NOT reference transaction amounts, descriptions, or dates
    // (We assert on the structure: no "amount" or "description" keys in any message content
    //  beyond the system prompt which only contains category names.)
    const bodyString = options.body as string;
    // No transaction amount-like patterns (dollar values prefixed with amounts like "123.45")
    // and no transaction description fields should be serialized into the request body.
    expect(bodyString).not.toMatch(/"amount"\s*:/);
    expect(bodyString).not.toMatch(/"description"\s*:/);
  });
});
