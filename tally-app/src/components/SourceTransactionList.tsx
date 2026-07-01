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
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm text-left border-collapse">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-4 py-2 font-semibold text-gray-700">Date</th>
            <th className="px-4 py-2 font-semibold text-gray-700">Description</th>
            <th className="px-4 py-2 font-semibold text-gray-700">Category</th>
            <th className="px-4 py-2 font-semibold text-gray-700 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {displayRows.map((tx, index) => (
            <tr
              key={`${tx.date}-${tx.description}-${index}`}
              className="border-b border-gray-100 hover:bg-gray-50"
            >
              <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{formatDate(tx.date)}</td>
              <td className="px-4 py-2 text-gray-900">{tx.description}</td>
              <td className="px-4 py-2 text-gray-600">{tx.category}</td>
              <td
                className={`px-4 py-2 text-right whitespace-nowrap font-mono ${
                  tx.amount < 0 ? 'text-red-600' : 'text-gray-900'
                }`}
              >
                {formatAmount(tx.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {transactions.length > 100 && (
        <p className="mt-2 text-sm text-gray-500">
          Showing 100 of {transactions.length} transactions.
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
