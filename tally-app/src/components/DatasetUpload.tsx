'use client';

/**
 * DatasetUpload
 *
 * Allows the user to upload a CSV file of transactions, displays upload
 * status messages (success/error), shows the current dataset status, and
 * provides a button to reset back to the sample dataset.
 *
 * Privacy (Requirement 9.5): A persistent notice is displayed before and
 * after file selection stating that data is used only within the current
 * session and is never transmitted or stored.
 *
 * Keyboard accessible: all interactive elements are native HTML controls
 * (button, input[type=file]) that receive focus via Tab.
 *
 * Validates: Requirements 1.3–1.7, 9.5
 */

import React, { useCallback, useRef, useState } from 'react';

import { useDataset } from '../context/DatasetProvider';
import type { CsvError, CsvUploadResult } from '../types';

// ── Status message types ───────────────────────────────────────────────────────

type UploadStatus =
  | { kind: 'idle' }
  | { kind: 'success'; rowsLoaded: number; rowsSkipped: number }
  | { kind: 'error'; message: string };

// ── Component ──────────────────────────────────────────────────────────────────

export function DatasetUpload() {
  const { transactions, categories, uploadCsv, loadSampleDataset } =
    useDataset();

  const [status, setStatus] = useState<UploadStatus>({ kind: 'idle' });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Handle file selection ──────────────────────────────────────────────────

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      setStatus({ kind: 'idle' });

      try {
        const result: CsvUploadResult = await uploadCsv(file);

        if (result.ok) {
          setStatus({
            kind: 'success',
            rowsLoaded: result.rowsLoaded,
            rowsSkipped: result.rowsSkipped,
          });
        } else {
          const errorMessage = formatError(result.error);
          setStatus({ kind: 'error', message: errorMessage });
        }
      } catch {
        setStatus({
          kind: 'error',
          message: 'An unexpected error occurred while processing the file.',
        });
      } finally {
        setIsUploading(false);
        // Reset the input so the same file can be re-selected if needed
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [uploadCsv],
  );

  // ── Reset to sample dataset ────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    loadSampleDataset();
    setStatus({ kind: 'idle' });
  }, [loadSampleDataset]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section
      aria-label="Dataset upload"
      className="w-full"
    >
      {/* Privacy notice */}
      <p className="mb-3 text-xs text-gray-400">
        <span aria-hidden="true" className="mr-1">🔒</span>
        Your data stays in this session — never transmitted or stored.
      </p>

      {/* File input */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label
          htmlFor="csv-upload"
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-[#6c5ce7] to-[#a29bfe] px-4 py-2.5 text-sm font-medium text-white transition-all hover:shadow-lg hover:shadow-[#6c5ce7]/25 focus-within:ring-2 focus-within:ring-[#6c5ce7]"
        >
          <span aria-hidden="true">📄</span>
          {isUploading ? 'Uploading…' : 'Upload CSV'}
          <input
            ref={fileInputRef}
            id="csv-upload"
            type="file"
            accept=".csv"
            className="sr-only"
            onChange={handleFileChange}
            disabled={isUploading}
            aria-describedby="privacy-notice"
          />
        </label>

        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1 rounded-xl border border-[#6c5ce7]/20 px-4 py-2.5 text-sm font-medium text-[#6c5ce7] transition-all hover:bg-[#6c5ce7]/5 focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
        >
          Reset to sample data
        </button>
      </div>

      {/* Status messages */}
      {status.kind === 'success' && (
        <p
          role="status"
          className="mt-3 text-sm text-emerald-600"
        >
          ✓ Loaded {status.rowsLoaded} row{status.rowsLoaded !== 1 ? 's' : ''}
          {status.rowsSkipped > 0 && (
            <span className="text-amber-500">
              {' '}
              • {status.rowsSkipped} row
              {status.rowsSkipped !== 1 ? 's' : ''} skipped
            </span>
          )}
        </p>
      )}

      {status.kind === 'error' && (
        <p
          role="alert"
          className="mt-3 text-sm text-red-500"
        >
          {status.message}
        </p>
      )}

      {/* Current dataset status */}
      <p
        id="privacy-notice"
        className="mt-3 text-xs text-gray-400"
      >
        {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}{' '}
        loaded • {categories.length} categor
        {categories.length !== 1 ? 'ies' : 'y'}
      </p>
    </section>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatError(error: CsvError): string {
  switch (error.type) {
    case 'missing_columns':
      return `Your file is missing required columns: ${error.missingColumns.join(', ')}. Please fix the file and try again.`;
    case 'no_valid_rows':
      return 'No valid transactions were found in this file. Please check the format and try again.';
    case 'file_too_large':
      return 'This file exceeds the 10 MB limit. Please upload a smaller file.';
    default:
      return 'An unknown error occurred.';
  }
}
