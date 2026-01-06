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

export function DataTable({ data, columns, className }: DataTableProps) {
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
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    return String(value);
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
            <TableRow key={rowIndex}>
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
