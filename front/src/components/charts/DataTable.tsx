'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { TableChartData } from '@/types/chart';

interface DataTableProps {
  data: TableChartData;
  columns?: string[];
  className?: string;
}

export function DataTable({ data, columns, className }: Readonly<DataTableProps>) {
  if (data.length === 0) {
    return (
      <div className="text-muted-foreground text-sm p-4">
        No data available
      </div>
    );
  }

  const displayColumns = columns || Object.keys(data[0]);

  const formatHeader = (key: string): string => {
    return key
      .replaceAll('_', ' ')
      .replaceAll(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  };

  const getRowKey = (row: Record<string, unknown>, index: number): string => {
    // Try to find a unique identifier in the row
    const id = row.id ?? row.uuid ?? row.guid ?? row.key;
    if (id !== undefined) return String(id);
    // Fallback to index-based key with first column value for some stability
    const firstValue = displayColumns.length > 0 ? row[displayColumns[0]] : '';
    return `row-${index}-${String(firstValue ?? '')}`;
  };

  return (
    <div className={`overflow-auto max-h-[400px] ${className || ''}`}>
      <Table>
        <TableHeader>
          <TableRow>
            {displayColumns.map((col) => (
              <TableHead key={col}>
                {formatHeader(col)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, rowIndex) => (
            <TableRow key={getRowKey(row, rowIndex)}>
              {displayColumns.map((col) => (
                <TableCell key={col}>
                  {formatValue(row[col])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
