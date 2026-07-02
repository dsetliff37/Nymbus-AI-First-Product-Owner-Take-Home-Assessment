'use client';

import type { Transaction } from '../types/index';

interface SourceTransactionListProps {
  transactions: Transaction[];
}

/**
 * Renders up to 100 transaction rows in a table.
 * Columns: Date, Description, Category, Amount.
 * Amount formatted with $ and 2 decimal places; negative amounts shown in red.
 *
 * Validates: Requirements 6.4, 6.5
 */
export default function SourceTransactionList({ transactions }: SourceTransactionListProps) {
  const displayRows = transactions.slice(0, 100);

  if (displayRows.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto">
      <p className="text-xs font-medium uppercase tracking-wider text-[#6c5ce7] mb-3">Transactions</p>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {displayRows.map((tx, index) => (
          <div
            key={`${tx.date}-${tx.description}-${index}`}
            className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{tx.description}</p>
              <p className="text-xs text-gray-400">{formatDate(tx.date)} • {tx.category}</p>
            </div>
            <span
              className={`text-sm font-semibold ml-3 whitespace-nowrap ${
                tx.amount < 0 ? 'text-emerald-500' : 'text-gray-800'
              }`}
            >
              {formatAmount(tx.amount)}
            </span>
          </div>
        ))}
      </div>
      {transactions.length > 100 && (
        <p className="mt-2 text-xs text-gray-400 text-center">
          Showing 100 of {transactions.length} transactions
        </p>
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${month}/${day}/${year}`;
}

function formatAmount(amount: number): string {
  const absAmount = Math.abs(amount).toFixed(2);
  return amount < 0 ? `-$${absAmount}` : `$${absAmount}`;
}
