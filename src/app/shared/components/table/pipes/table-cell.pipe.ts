import { Pipe, PipeTransform } from '@angular/core';
import { TableColumn } from '../../../models/table.models';

@Pipe({
  name: 'tableCell',
})
export class TableCellPipe implements PipeTransform {
  transform<T>(row: T, column: TableColumn<T>): unknown {
    return column.cell ? column.cell(row) : row[column.key];
  }
}
